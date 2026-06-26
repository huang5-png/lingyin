const axios = require('axios')
const cheerio = require('cheerio')

const BASE_URL = 'https://www.dlsite.com'
const SEARCH_URL = 'https://www.dlsite.com/maniax/fsr/=/language/jp/sex_category%5B0%5D/male/keyword/'
const DETAIL_BASE = 'https://www.dlsite.com/maniax/work/=/product_id/'

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept-Language': 'ja-JP,ja;q=0.9,zh-CN;q=0.8,zh;q=0.7',
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
    const response = await axios.get(url, { headers: HEADERS, timeout: 15000 })
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
    const response = await axios.get(url, { headers: HEADERS, timeout: 15000 })
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
}
