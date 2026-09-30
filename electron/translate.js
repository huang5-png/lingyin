const axios = require('axios')
const logger = require('./logger')

// 谷歌翻译免费接口
const GOOGLE_URL = 'https://translate.googleapis.com/translate_a/single'

// 微软翻译 token 接口
const MS_AUTH_URL = 'https://edge.microsoft.com/translate/auth'
const MS_TRANSLATE_URL = 'https://api.cognitive.microsofttranslator.com/translate'

// 百度翻译接口（免费网页版）
const BAIDU_URL = 'https://fanyi.baidu.com/transapi'

// 单块最大字符数（谷歌POST请求安全上限）
const CHUNK_MAX_CHARS = 4000
// 并发请求数
const CONCURRENCY = 4

let msToken = null
let msTokenExpire = 0

let getProxyConfig = null

// 取消翻译的控制器映射
const abortControllers = new Map()

function setProxyHelper(getProxy) {
  getProxyConfig = getProxy
}

async function getAxiosConfig() {
  const config = {
    timeout: 20000,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    },
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
  return config
}

// 取消指定翻译任务
function cancelTranslation(cancelId) {
  let cancelled = false
  // 支持前缀匹配：取消所有以该 cancelId 开头的请求
  for (const [id, controller] of abortControllers.entries()) {
    if (id === cancelId || id.startsWith(cancelId + '_')) {
      controller.abort()
      abortControllers.delete(id)
      cancelled = true
    }
  }
  return cancelled
}

// 创建取消令牌
function createAbortSignal(cancelId) {
  if (!cancelId) return null
  const controller = new AbortController()
  abortControllers.set(cancelId, controller)
  return controller.signal
}

// 清理取消令牌
function clearAbortSignal(cancelId) {
  if (cancelId && abortControllers.has(cancelId)) {
    abortControllers.delete(cancelId)
  }
}

// AI 翻译（OpenAI 兼容 API）
async function aiTranslate(text, targetLang = 'zh-CN', aiConfig) {
  if (!aiConfig || !aiConfig.apiKey || !aiConfig.baseUrl) {
    throw new Error('AI 翻译配置不完整')
  }

  const baseConfig = await getAxiosConfig()
  const config = {
    timeout: 60000,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${aiConfig.apiKey}`,
    },
  }
  // 只有明确开启时才使用代理
  if (aiConfig.useProxy && baseConfig.proxy) {
    config.proxy = baseConfig.proxy
  }

  let baseUrl = aiConfig.baseUrl.replace(/\/$/, '')
  // 智能检测：如果用户填的 URL 已经包含 /chat/completions，就不重复拼接
  let url
  if (/\/chat\/completions\/?$/.test(baseUrl)) {
    url = baseUrl
  } else {
    url = `${baseUrl}/chat/completions`
  }

  const targetLangName = targetLang === 'zh-CN' || targetLang === 'zh-Hans' ? '简体中文' :
                        targetLang === 'zh' ? '中文' :
                        targetLang === 'ja' ? '日语' :
                        targetLang === 'en' ? '英语' : targetLang

  const systemPrompt = `翻译为${targetLangName}。只输出译文，不加解释。`

  const body = {
    model: aiConfig.model || 'gpt-3.5-turbo',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: text }
    ],
    temperature: 0.2,
  }

  try {
    const resp = await axios.post(url, body, config)
    if (resp.data && resp.data.choices && resp.data.choices[0] && resp.data.choices[0].message) {
      return resp.data.choices[0].message.content.trim()
    }
    return text
  } catch (e) {
    if (e.code === 'ERR_CANCELED') {
      const err = new Error('cancelled')
      err.name = 'CancelError'
      throw err
    }
    let errorMsg = e.message
    if (e.response) {
      const data = e.response.data
      if (data?.error?.message) {
        errorMsg = data.error.message
      } else if (typeof data === 'string') {
        errorMsg = data
      }
    }
    logger.error(`[翻译:ai] 失败:`, errorMsg)
    const err = new Error(errorMsg)
    err.name = 'TranslateError'
    err.status = e.response?.status
    throw err
  }
}

// AI 批量翻译
async function aiTranslateBatch(texts, targetLang = 'zh-CN', aiConfig, cancelId) {
  if (texts.length === 0) return []

  const validTexts = texts.filter(t => t && t.trim())
  if (validTexts.length === 0) return texts

  const baseConfig = await getAxiosConfig()
  const config = {
    timeout: 120000,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${aiConfig.apiKey}`,
    },
  }
  // 只有明确开启时才使用代理
  if (aiConfig.useProxy && baseConfig.proxy) {
    config.proxy = baseConfig.proxy
  }

  if (cancelId) {
    const signal = createAbortSignal(cancelId)
    if (signal) {
      config.signal = signal
    }
  }

  try {
    let baseUrl = aiConfig.baseUrl.trim().replace(/[\/,]+$/, '')
    // 智能检测：如果用户填的 URL 已经包含 /chat/completions，就不重复拼接
    let url
    if (/\/chat\/completions\/?$/.test(baseUrl)) {
      url = baseUrl
    } else {
      url = `${baseUrl}/chat/completions`
    }

    logger.info(`[翻译:ai] 请求地址: ${url}, 模型: ${aiConfig.model}, 文本数: ${validTexts.length}`)
    logger.info(`[翻译:ai] 代理配置: ${config.proxy ? `${config.proxy.protocol}://${config.proxy.host}:${config.proxy.port}` : '无'}`)

    const targetLangName = targetLang === 'zh-CN' || targetLang === 'zh-Hans' ? '简体中文' :
                          targetLang === 'zh' ? '中文' :
                          targetLang === 'ja' ? '日语' :
                          targetLang === 'en' ? '英语' : targetLang

    const numberedText = validTexts.map((text, i) => `${i + 1}. ${text}`).join('\n')

    const systemPrompt = `翻译为${targetLangName}。保留行号格式：数字+点+空格+译文。只输出译文，不加解释。`

    const body = {
      model: aiConfig.model || 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: numberedText }
      ],
      temperature: 0.2,
    }

    logger.info(`[翻译:ai] 请求体大小: ${JSON.stringify(body).length} bytes`)

    const resp = await axios.post(url, body, config)
    
    if (resp.data && resp.data.choices && resp.data.choices[0] && resp.data.choices[0].message) {
      const translatedText = resp.data.choices[0].message.content.trim()
      const lines = translatedText.split('\n').map(l => l.trim()).filter(l => l)
      
      const results = [...texts]
      const translatedMap = new Map()
      
      for (const line of lines) {
        const match = line.match(/^(\d+)[.、\s]+(.+)$/)
        if (match) {
          const idx = parseInt(match[1]) - 1
          const translated = match[2].trim()
          if (idx >= 0 && idx < validTexts.length && translated) {
            translatedMap.set(validTexts[idx], translated)
          }
        }
      }
      
      let validIdx = 0
      for (let i = 0; i < texts.length; i++) {
        if (!texts[i] || !texts[i].trim()) continue
        
        if (translatedMap.has(texts[i])) {
          results[i] = translatedMap.get(texts[i])
        } else if (validIdx < lines.length) {
          let line = lines[validIdx].replace(/^\d+[.、\s]+/, '').trim()
          if (line) {
            results[i] = line
          }
          validIdx++
        }
      }
      
      clearAbortSignal(cancelId)
      return results
    }
    
    clearAbortSignal(cancelId)
    return texts
  } catch (e) {
    clearAbortSignal(cancelId)
    if (e.code === 'ERR_CANCELED' || e.name === 'CancelError') {
      const err = new Error('cancelled')
      err.name = 'CancelError'
      throw err
    }
    let errorMsg = e.message
    if (e.response) {
      const status = e.response.status
      const data = e.response.data
      logger.error(`[翻译:ai] 错误响应 ${status}:`, JSON.stringify(data))
      if (data?.error?.message) {
        errorMsg = data.error.message
      } else if (typeof data === 'string') {
        errorMsg = data
      }
    }
    logger.error(`[翻译:ai] 批量翻译失败:`, errorMsg)
    const err = new Error(errorMsg)
    err.name = 'TranslateError'
    err.status = e.response?.status
    throw err
  }
}

// 谷歌翻译：单条/单块文本
// 使用 POST 请求避免 URL 长度限制，支持大批量文本
async function googleTranslate(text, targetLang = 'zh-CN') {
  const config = await getAxiosConfig()
  config.headers['Content-Type'] = 'application/x-www-form-urlencoded'

  const params = new URLSearchParams()
  params.append('client', 'gtx')
  params.append('sl', 'auto')
  params.append('tl', targetLang)
  params.append('dt', 't')
  params.append('q', text)

  const resp = await axios.post(GOOGLE_URL, params, config)
  if (resp.data && resp.data[0]) {
    return resp.data[0].map(item => item[0]).join('')
  }
  return text
}

// 谷歌单块批量翻译：一块内的多条文本用换行符拼接，一次请求完成
async function googleTranslateChunk(texts, targetLang = 'zh-CN') {
  const config = await getAxiosConfig()
  config.headers['Content-Type'] = 'application/x-www-form-urlencoded'

  const joined = texts.join('\n')
  const params = new URLSearchParams()
  params.append('client', 'gtx')
  params.append('sl', 'auto')
  params.append('tl', targetLang)
  params.append('dt', 't')
  params.append('q', joined)

  const resp = await axios.post(GOOGLE_URL, params, config)
  if (resp.data && resp.data[0]) {
    const allTranslated = resp.data[0].map(item => item[0]).join('')
    const lines = allTranslated.split('\n')
    if (lines.length === texts.length) {
      return lines
    }
    // 行数不匹配：可能谷歌合并了某些行，逐条翻译回退
    const results = []
    for (const text of texts) {
      try {
        results.push(await googleTranslate(text, targetLang))
      } catch {
        results.push(text)
      }
    }
    return results
  }
  return texts
}

// 谷歌批量翻译：自动分块 + 并发请求
// 这是网页版谷歌翻译快速的核心原理：分块并行 + 单块多行
async function googleTranslateBatch(texts, targetLang = 'zh-CN') {
  if (texts.length === 0) return []
  if (texts.length === 1) {
    try {
      return [await googleTranslate(texts[0], targetLang)]
    } catch {
      return texts
    }
  }

  // 按字符数分块
  const chunks = []
  let currentChunk = []
  let currentLen = 0
  for (const text of texts) {
    const textLen = (text || '').length
    // 单条文本超过块上限：单独成块（POST 支持大文本）
    if (textLen >= CHUNK_MAX_CHARS) {
      if (currentChunk.length > 0) {
        chunks.push(currentChunk)
        currentChunk = []
        currentLen = 0
      }
      chunks.push([text])
      continue
    }
    if (currentLen + textLen + 1 > CHUNK_MAX_CHARS && currentChunk.length > 0) {
      chunks.push(currentChunk)
      currentChunk = []
      currentLen = 0
    }
    currentChunk.push(text)
    currentLen += textLen + 1
  }
  if (currentChunk.length > 0) chunks.push(currentChunk)

  // 并发执行各块
  const results = new Array(texts.length).fill(null)
  const chunkResults = await Promise.all(
    chunks.map(chunk =>
      googleTranslateChunk(chunk, targetLang).catch(err => {
        logger.warn(`[翻译:google] 块翻译失败:`, err.message)
        return null
      })
    )
  )

  // 按原顺序回填
  let idx = 0
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]
    const r = chunkResults[i]
    for (let j = 0; j < chunk.length; j++) {
      results[idx++] = r ? r[j] || chunk[j] : chunk[j]
    }
  }
  return results
}

// 获取微软翻译 token
async function getMsToken() {
  const now = Date.now()
  if (msToken && now < msTokenExpire) return msToken

  const config = await getAxiosConfig()
  const resp = await axios.get(MS_AUTH_URL, config)
  msToken = resp.data
  msTokenExpire = now + 9 * 60 * 1000
  return msToken
}

// 微软翻译：单块（最多 100 条）
async function msTranslateChunk(texts, targetLang = 'zh-Hans') {
  const token = await getMsToken()
  const config = await getAxiosConfig()
  config.headers['Authorization'] = `Bearer ${token}`
  config.headers['Content-Type'] = 'application/json'

  const url = `${MS_TRANSLATE_URL}?api-version=3.0&to=${targetLang}`
  const body = texts.map(text => ({ Text: text }))
  const resp = await axios.post(url, body, config)
  const results = []
  if (resp.data) {
    resp.data.forEach((item, i) => {
      if (item.translations && item.translations[0]) {
        results.push(item.translations[0].text)
      } else {
        results.push(texts[i])
      }
    })
  }
  return results
}

// 微软批量翻译：分块（每块最多100条）+ 并发
async function msTranslateBatch(texts, targetLang = 'zh-Hans') {
  if (texts.length === 0) return []
  const chunks = []
  for (let i = 0; i < texts.length; i += 100) {
    chunks.push(texts.slice(i, i + 100))
  }
  const chunkResults = await Promise.all(
    chunks.map(chunk =>
      msTranslateChunk(chunk, targetLang).catch(err => {
        logger.warn(`[翻译:microsoft] 块翻译失败:`, err.message)
        return chunk
      })
    )
  )
  return chunkResults.flat()
}

// 微软单条翻译
async function msTranslate(text, targetLang = 'zh-Hans') {
  const results = await msTranslateBatch([text], targetLang)
  return results[0] || text
}

// 百度翻译（网页版接口）
async function baiduTranslate(text, targetLang = 'zh') {
  const config = await getAxiosConfig()
  config.headers['Content-Type'] = 'application/x-www-form-urlencoded'
  const params = new URLSearchParams()
  params.append('from', 'auto')
  params.append('to', targetLang)
  params.append('query', text)
  const resp = await axios.post(BAIDU_URL, params, config)
  if (resp.data && resp.data.data && resp.data.data.length > 0) {
    return resp.data.data.map(item => item.dst).join('')
  }
  return text
}

// 百度批量翻译：分块 + 并发
async function baiduTranslateBatch(texts, targetLang = 'zh') {
  if (texts.length === 0) return []
  // 百度单次请求字符数限制较小，按 ~2000 字符分块
  const chunks = []
  let currentChunk = []
  let currentLen = 0
  for (const text of texts) {
    const textLen = (text || '').length
    if (currentLen + textLen + 1 > 2000 && currentChunk.length > 0) {
      chunks.push(currentChunk)
      currentChunk = []
      currentLen = 0
    }
    currentChunk.push(text)
    currentLen += textLen + 1
  }
  if (currentChunk.length > 0) chunks.push(currentChunk)

  const config = await getAxiosConfig()
  config.headers['Content-Type'] = 'application/x-www-form-urlencoded'

  const chunkResults = await Promise.all(
    chunks.map(async chunk => {
      try {
        const params = new URLSearchParams()
        params.append('from', 'auto')
        params.append('to', targetLang)
        params.append('query', chunk.join('\n'))
        const resp = await axios.post(BAIDU_URL, params, config)
        if (resp.data && resp.data.data && resp.data.data.length > 0) {
          const allTranslated = resp.data.data.map(item => item.dst).join('')
          const lines = allTranslated.split('\n')
          if (lines.length === chunk.length) return lines
          // 行数不匹配：逐条翻译
          const results = []
          for (const text of chunk) {
            try { results.push(await baiduTranslate(text, targetLang)) }
            catch { results.push(text) }
          }
          return results
        }
        return chunk
      } catch (err) {
        logger.warn(`[翻译:baidu] 块翻译失败:`, err.message)
        return chunk
      }
    })
  )
  return chunkResults.flat()
}

// 翻译单条文本
async function translateText(text, targetLang = 'zh-CN', engine = 'google', extraOptions = {}) {
  if (!text || !text.trim()) return text

  try {
    if (engine === 'baidu') {
      return await baiduTranslate(text, 'zh')
    } else if (engine === 'microsoft') {
      return await msTranslate(text, 'zh-Hans')
    } else if (engine === 'ai') {
      const aiConfig = extraOptions.aiConfig || {}
      return await aiTranslate(text, targetLang, aiConfig)
    } else {
      // 默认谷歌
      const result = await googleTranslate(text, targetLang)
      if (result && result.trim() && result !== text) return result
      // 谷歌失败尝试微软
      return await msTranslate(text, 'zh-Hans')
    }
  } catch (e) {
    if (e.message === 'cancelled' || e.name === 'CancelError') {
      throw e
    }
    // AI 翻译失败时不回退，直接抛出错误
    if (engine === 'ai') {
      logger.error(`[翻译:ai] 失败:`, e.message)
      throw e
    }
    logger.warn(`[翻译:${engine}] 失败:`, e.message)
    // 失败时尝试其他引擎
    try {
      if (engine !== 'google') return await googleTranslate(text, targetLang)
      if (engine !== 'microsoft') return await msTranslate(text, 'zh-Hans')
    } catch {}
    return text
  }
}

// 批量翻译：根据引擎选择最优策略，自动分块并发
async function translateBatch(texts, targetLang = 'zh-CN', engine = 'google', extraOptions = {}) {
  const validTexts = texts.filter(t => t && t.trim())
  if (validTexts.length === 0) return texts

  const cancelId = extraOptions.cancelId

  // 去重
  const uniqueTexts = [...new Set(validTexts)]
  const translateMap = new Map()

  try {
    let results
    if (engine === 'baidu') {
      results = await baiduTranslateBatch(uniqueTexts, 'zh')
    } else if (engine === 'microsoft') {
      results = await msTranslateBatch(uniqueTexts, 'zh-Hans')
    } else if (engine === 'ai') {
      const aiConfig = extraOptions.aiConfig || {}
      results = await aiTranslateBatch(uniqueTexts, targetLang, aiConfig, cancelId)
    } else {
      // 谷歌：分块并发，一次请求翻译大量文本
      results = await googleTranslateBatch(uniqueTexts, targetLang)
    }
    uniqueTexts.forEach((text, i) => translateMap.set(text, results[i] || text))
  } catch (e) {
    if (e.message === 'cancelled' || e.name === 'CancelError') {
      throw e
    }
    // AI 翻译失败时不回退，直接抛出错误
    if (engine === 'ai') {
      logger.error(`[翻译:ai] 翻译失败:`, e.message)
      throw e
    }
    logger.warn(`[翻译:${engine}] 批量翻译失败，尝试其他引擎:`, e.message)
    // 失败时尝试其他引擎
    try {
      let results
      if (engine === 'google') {
        results = await msTranslateBatch(uniqueTexts, 'zh-Hans')
      } else {
        results = await googleTranslateBatch(uniqueTexts, targetLang)
      }
      uniqueTexts.forEach((text, i) => translateMap.set(text, results[i] || text))
    } catch (e2) {
      logger.error('[翻译] 所有引擎都失败:', e2.message)
      uniqueTexts.forEach(text => translateMap.set(text, text))
    }
  }

  return texts.map(text => translateMap.get(text) || text)
}

module.exports = {
  setProxyHelper,
  translateText,
  translateBatch,
  cancelTranslation,
}
