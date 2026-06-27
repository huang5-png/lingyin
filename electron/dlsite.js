const axios = require('axios')
const cheerio = require('cheerio')
const http = require('http')
const https = require('https')
const logger = require('./logger')

const BASE_URL = 'https://www.dlsite.com'
const SEARCH_URL = 'https://www.dlsite.com/maniax/fsr/=/language/jp/sex_category%5B0%5D/male/keyword/'
const DETAIL_BASE = 'https://www.dlsite.com/maniax/work/=/product_id/'

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
  'Accept-Language': 'ja-JP,ja;q=0.9,zh-CN;q=0.8,zh;q=0.7,en;q=0.6',
  'Accept-Encoding': 'gzip, deflate',
  'Cache-Control': 'no-cache',
  'Pragma': 'no-cache',
  'Sec-Ch-Ua': '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
  'Sec-Ch-Ua-Mobile': '?0',
  'Sec-Ch-Ua-Platform': '"Windows"',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1',
  'Upgrade-Insecure-Requests': '1',
}

const httpAgent = new http.Agent({ keepAlive: true, maxSockets: 10 })
const httpsAgent = new https.Agent({ keepAlive: true, maxSockets: 10 })

let getProxyConfig = null
let parseProxyUrl = null

let dlsiteAxios = null
let sessionInitialized = false

function setProxyHelpers(getProxy, parseProxy) {
  getProxyConfig = getProxy
  parseProxyUrl = parseProxy
}

async function initDlsiteSession() {
  if (sessionInitialized && dlsiteAxios) return

  const config = {
    baseURL: BASE_URL,
    headers: { ...HEADERS },
    timeout: 30000,
    httpAgent,
    httpsAgent,
    withCredentials: true,
    maxRedirects: 5,
  }

  if (getProxyConfig) {
    const proxy = await getProxyConfig()
    if (proxy && proxy.protocol !== 'socks5') {
      config.proxy = {
        host: proxy.host,
        port: proxy.port,
        protocol: proxy.protocol,
      }
    }
  }

  dlsiteAxios = axios.create(config)
  
  try {
    logger.info('[DLsite] 初始化会话，访问首页...')
    await dlsiteAxios.get('/maniax/')
    sessionInitialized = true
    logger.info('[DLsite] 会话初始化成功')
  } catch (e) {
    logger.warn('[DLsite] 会话初始化失败:', e.message)
  }
}

async function dlsiteGet(url, retries = 3, referer = null) {
  await initDlsiteSession()
  
  let lastError = null
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const headers = { ...HEADERS }
      if (referer) {
        headers['Referer'] = referer
        headers['Sec-Fetch-Site'] = 'same-origin'
      }
      
      const res = await dlsiteAxios.get(url, { 
        headers,
        validateStatus: (status) => status < 500,
      })
      
      if (res.status === 404) {
        const bodyPreview = (res.data || '').toString().slice(0, 500)
        logger.warn(`[DLsite] 404 响应内容预览:`, bodyPreview)
        logger.warn(`[DLsite] 404 错误，尝试第 ${attempt + 1} 次重试: ${url}`)
        if (attempt < retries - 1) {
          sessionInitialized = false
          await initDlsiteSession()
          await new Promise(resolve => setTimeout(resolve, 3000 * (attempt + 1)))
          continue
        }
        throw new Error(`Request failed with status code 404`)
      }
      
      return res
    } catch (e) {
      lastError = e
      const isRetryable = e.code === 'ECONNRESET' || 
                         e.code === 'ECONNREFUSED' ||
                         e.code === 'ETIMEDOUT' ||
                         e.code === 'ECONNABORTED' ||
                         e.code === 'ERR_NETWORK' ||
                         e.code === 'EPIPE' ||
                         e.code === 'ERR_BAD_RESPONSE' ||
                         e.message?.includes('404') ||
                         (e.response && e.response.status >= 500)
      
      if (!isRetryable || attempt >= retries - 1) {
        break
      }
      logger.info(`[DLsite] 重试第 ${attempt + 1}/${retries - 1} 次，错误: ${e.code || e.message}`)
      if (e.message?.includes('404')) {
        sessionInitialized = false
      }
      await new Promise(resolve => setTimeout(resolve, 2000 * (attempt + 1)))
    }
  }
  throw lastError
}

function extractRJCode(text) {
  if (!text) return null
  const match = text.match(/[Rr][Jj]\s*(\d{3,8})/)
  if (match) {
    return 'RJ' + match[1]
  }
  return null
}

async function searchDLsite(query) {
  try {
    const rjCode = extractRJCode(query)
    if (rjCode) {
      const detail = await getWorkDetail(rjCode)
      if (detail) {
        return [detail]
      }
    }

    const url = SEARCH_URL + encodeURIComponent(query) + '/.html'
    const response = await dlsiteGet(url)
    const $ = cheerio.load(response.data)

    const results = []
    $('.search_result_img_box').each((i, el) => {
      if (i >= 10) return
      const $el = $(el)
      const link = $el.find('a').attr('href') || ''
      const img = $el.find('img').attr('src') || $el.find('img').attr('data-src') || ''
      const title = $el.find('img').attr('alt') || ''
      const rjMatch = link.match(/(RJ\d+)/)
      const rj = rjMatch ? rjMatch[1] : ''

      if (rj) {
        results.push({
          rjCode: rj,
          title: title,
          cover: img.startsWith('//') ? 'https:' + img : img,
          url: link.startsWith('http') ? link : BASE_URL + link,
        })
      }
    })

    return results
  } catch (e) {
    console.error('DLsite search error:', e.message)
    return []
  }
}

async function getWorkDetail(rjCode) {
  try {
    const url = DETAIL_BASE + rjCode + '.html'
    const response = await dlsiteGet(url)
    const html = response.data
    const $ = cheerio.load(html)

    const title = $('h1#work_name').text().trim()
    const cover = $('meta[property="og:image"]').attr('content') || ''

    let rating = 0
    const ratingEl = $('.rating_total strong')
    if (ratingEl.length) {
      rating = parseFloat(ratingEl.text().trim()) || 0
    }

    const tags = []
    $('a[href*="/genre/"]').each((i, el) => {
      const tag = $(el).text().trim()
      if (tag && tags.length < 20) {
        tags.push(tag)
      }
    })

    const cvs = []
    $('th:contains("声優"), th:contains("声优")').next('td').find('a').each((i, el) => {
      const cv = $(el).text().trim()
      if (cv) cvs.push(cv)
    })

    if (cvs.length === 0) {
      $('.work_outline td a[href*="voice_by"]').each((i, el) => {
        const cv = $(el).text().trim()
        if (cv) cvs.push(cv)
      })
    }

    let circle = ''
    const circleEl = $('span.maker_name a')
    if (circleEl.length) {
      circle = circleEl.first().text().trim()
    }

    let description = ''
    const descEl = $('.work_parts_container')
    if (descEl.length) {
      description = descEl.text().trim().slice(0, 500)
    }

    return {
      rjCode,
      title,
      cover: cover.startsWith('//') ? 'https:' + cover : cover,
      rating,
      tags,
      cvs,
      circle,
      description,
      url,
    }
  } catch (e) {
    console.error('DLsite detail error:', rjCode, e.message)
    return null
  }
}

module.exports = {
  searchDLsite,
  getWorkDetail,
  extractRJCode,
  setProxyHelpers,
}
