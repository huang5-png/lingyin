/**
 * Real-world test: run detectLanguageFromContent against actual subtitle files in G:/asmr.
 * Run: node scripts/test-real-subtitles.js
 */
import fs from 'fs'
import path from 'path'

// Inline copy of detectLanguageFromContent to avoid ESM/import issues
// (kept in sync with src/utils/scanner.js)
function detectLanguageFromContent(text) {
  if (!text) return 'unknown'

  const cleaned = text
    .replace(/\{[^}]*\}/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\d{1,2}:\d{2}([:.]\d{2,3})?/g, '')
    .replace(/-->/g, '')
    .replace(/[\r\n]+/g, '\n')
    .replace(/[ \t]+/g, ' ')

  const sample = cleaned.length > 8000 ? cleaned.slice(0, 8000) : cleaned
  const lines = sample.split('\n').map((l) => l.trim()).filter(Boolean)
  if (lines.length === 0) return 'unknown'

  let totalKana = 0, totalHan = 0, totalLatin = 0, totalCyrillic = 0
  const zhFuncChars = new Set('的了是在和也都不就这那这个那个一们个着过吗呢吧啊呀哦么与而则即被把将让使往向於')
  let zhFuncCount = 0, jaMarkerCount = 0
  const zhPunct = new Set('，。、；：？！「」『』（）《》【】…—')
  const jaPunct = new Set('。、・〜～「」『』〈〉《》【】〆〇')
  let zhPunctCount = 0, jaPunctCount = 0
  const langByLine = []

  for (const line of lines) {
    let kana = 0, han = 0, latin = 0
    let lineZhFunc = 0, lineJaMarker = 0
    for (const ch of line) {
      const code = ch.charCodeAt(0)
      if (code >= 0x3040 && code <= 0x309F) { kana++; totalKana++ }
      else if (code >= 0x30A0 && code <= 0x30FF) { kana++; totalKana++ }
      else if (code >= 0x31F0 && code <= 0x31FF) { kana++; totalKana++ }
      else if (code >= 0x4E00 && code <= 0x9FFF) { han++; totalHan++ }
      else if (code >= 0x3400 && code <= 0x4DBF) { han++; totalHan++ }
      else if ((code >= 0x41 && code <= 0x5A) || (code >= 0x61 && code <= 0x7A)) { latin++; totalLatin++ }
      else if (code >= 0x0400 && code <= 0x04FF) { totalCyrillic++ }
      if (zhFuncChars.has(ch)) { lineZhFunc++; zhFuncCount++ }
      if (jaPunct.has(ch)) { zhPunctCount++; jaPunctCount++ }
      if (zhPunct.has(ch)) { zhPunctCount++ }
      if ('っゃゅょゎァィゥェォッャュョゎゕゖー'.includes(ch)) { lineJaMarker++; jaMarkerCount++ }
    }
    const hasKana = kana > 0
    const hasZhFunc = lineZhFunc > 0
    if (hasKana) langByLine.push('ja')
    else if (hasZhFunc && han > 0) langByLine.push('zh')
    else if (han > 0 && latin === 0) langByLine.push('zh')
    else if (latin > 0 && han === 0 && kana === 0) langByLine.push('en')
    else langByLine.push('other')
  }

  const totalChars = totalKana + totalHan + totalLatin + totalCyrillic
  if (totalChars === 0) return 'unknown'

  const kanaRatio = totalKana / totalChars
  const hanRatio = totalHan / totalChars
  const latinRatio = totalLatin / totalChars

  const hasKana = totalKana > 0
  const isChineseLike = !hasKana && totalHan > 0 && (zhFuncCount > 0 || zhPunctCount > 0)
  const isJapaneseLike = hasKana || jaMarkerCount > 0

  const lineLangSet = new Set(langByLine)
  const hasZhLines = lineLangSet.has('zh')
  const hasJaLines = lineLangSet.has('ja')
  const hasEnLines = lineLangSet.has('en')

  const zhLineCount = langByLine.filter((l) => l === 'zh').length
  const jaLineCount = langByLine.filter((l) => l === 'ja').length
  const enLineCount = langByLine.filter((l) => l === 'en').length
  const totalLines = langByLine.length

  const zhLineRatio = zhLineCount / totalLines
  const jaLineRatio = jaLineCount / totalLines
  const enLineRatio = enLineCount / totalLines

  if (hasZhLines && hasJaLines && zhLineRatio > 0.15 && jaLineRatio > 0.15) return 'dual'
  if (hasZhLines && hasEnLines && zhLineRatio > 0.15 && enLineRatio > 0.15) return 'dual'
  if (hasJaLines && hasEnLines && jaLineRatio > 0.15 && enLineRatio > 0.15) return 'dual'
  if (hasKana && zhFuncCount > 0 && hanRatio > 0.1) return 'dual'

  if (isJapaneseLike && kanaRatio > 0.03) return 'ja'
  if (isChineseLike) return 'zh'
  if (hasKana) return 'ja'
  if (totalHan > 0 && !hasKana) {
    if (jaPunctCount > zhPunctCount) return 'ja'
    const jaCompoundRegex = /日本|東京|大阪|京都|横浜|名古屋|札幌|福岡|現在進行|進行形|促進法案|教育促進|東口|西口|南口|北口|号線|市役所|区役所|県庁|地下鉄|改札|出口|入口|非常口|本日|平成|令和|株式会社|有限会社|町田|八王子/
    if (jaCompoundRegex.test(sample)) return 'ja'
    return 'zh'
  }
  if (latinRatio > 0.5) return 'en'
  if (totalCyrillic > totalChars * 0.3) return 'ru'
  return 'unknown'
}

// ===== Scan files =====
const ROOT = 'G:/asmr'
const EXTS = ['.lrc', '.srt', '.vtt', '.ass', '.ssa']

function walk(dir) {
  let out = []
  let entries
  try { entries = fs.readdirSync(dir, { withFileTypes: true }) } catch { return out }
  for (const e of entries) {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) out = out.concat(walk(full))
    else if (EXTS.includes(path.extname(e.name).toLowerCase())) out.push(full)
  }
  return out
}

const allFiles = walk(ROOT)
console.log(`Found ${allFiles.length} subtitle files total\n`)

// Dedupe by basename (keep .srt > .vtt > .lrc > .ass > .ssa)
const byBase = new Map()
const prio = { srt: 5, vtt: 4, lrc: 3, ass: 2, ssa: 1 }
for (const f of allFiles) {
  const ext = path.extname(f).slice(1).toLowerCase()
  const base = path.basename(f, path.extname(f))
  const key = path.dirname(f) + '::' + base
  const cur = byBase.get(key)
  if (!cur || (prio[ext] || 0) > (prio[path.extname(cur).slice(1)] || 0)) {
    byBase.set(key, f)
  }
}
const files = [...byBase.values()]
console.log(`After dedupe: ${files.length} unique subtitles\n`)

// ===== Run detection =====
const stats = { zh: 0, ja: 0, en: 0, dual: 0, unknown: 0, error: 0 }
const samples = { zh: [], ja: [], en: [], dual: [], unknown: [] }
const disagreements = []

for (const f of files) {
  try {
    const text = fs.readFileSync(f, 'utf-8')
    const result = detectLanguageFromContent(text)
    stats[result] = (stats[result] || 0) + 1
    if (samples[result] && samples[result].length < 3) {
      samples[result].push(path.basename(f))
    }
    // Flag suspicious: content says zh but filename has japanese kana markers, etc.
    const fname = path.basename(f).toLowerCase()
    const fnameSuggestsZh = /中文|简体|繁体|翻译|译文|汉化|chs|cht|cn|中字/.test(fname)
    const fnameSuggestsJa = /日文|日本語|original|原版|生肉|jp|jpn|日字|日语|原文/.test(fname)
    const fnameSuggestsEn = /英文|english|en|eng|英字|英语/.test(fname)
    const fnameSuggestsDual = /双语|中日|日中|dual|bilingual/.test(fname)
    if (fnameSuggestsDual && result !== 'dual') {
      disagreements.push({ f: path.basename(f), expected: 'dual', got: result, reason: 'filename says dual' })
    } else if (fnameSuggestsZh && !fnameSuggestsDual && result !== 'zh') {
      disagreements.push({ f: path.basename(f), expected: 'zh', got: result, reason: 'filename says zh' })
    } else if (fnameSuggestsEn && !fnameSuggestsDual && !fnameSuggestsZh && result !== 'en') {
      disagreements.push({ f: path.basename(f), expected: 'en', got: result, reason: 'filename says en' })
    }
  } catch (e) {
    stats.error++
  }
}

// ===== Report =====
console.log('=== Detection Summary ===')
for (const [lang, count] of Object.entries(stats)) {
  console.log(`  ${lang.padEnd(8)} ${count}`)
}
console.log()

console.log('=== Sample filenames per language ===')
for (const [lang, list] of Object.entries(samples)) {
  if (list.length === 0) continue
  console.log(`\n[${lang}]`)
  for (const s of list) console.log(`  ${s}`)
}

console.log('\n=== Disagreements (filename hint vs content detection) ===')
if (disagreements.length === 0) {
  console.log('  (none)')
} else {
  for (const d of disagreements.slice(0, 30)) {
    console.log(`  ${d.f}\n    expected=${d.expected} got=${d.got} (${d.reason})`)
  }
  if (disagreements.length > 30) console.log(`  ... and ${disagreements.length - 30} more`)
}
