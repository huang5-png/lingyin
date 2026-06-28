/**
 * Tests for detectLanguageFromContent
 * Run with: node --test src/utils/__tests__/detectLanguage.test.js
 * (uses CommonJS shim — see end of file)
 */
import { detectLanguageFromContent } from '../scanner.js'

const cases = [
  // ===== Japanese (pure) =====
  {
    name: 'JA: plain hiragana sentence',
    text: '[00:01.00]今日はとても良い天気ですね。\n[00:03.50]公園に行きましょうか。',
    expect: 'ja',
  },
  {
    name: 'JA: katakana heavy',
    text: '[00:01.00]コーヒーを飲みながらショッピングモールを歩いた。\n[00:04.00]エレベーターで上の階へ。',
    expect: 'ja',
  },
  {
    name: 'JA: kanji-heavy with minimal kana',
    text: '[00:01.00]日本語教育促進法案\n[00:03.00]東京都港区\n[00:05.00]現在進行形',
    expect: 'ja',
  },
  {
    name: 'JA: mixed kanji+kana+romaji (typical ASMR subtitle)',
    text: '[00:00.50]ねえ、聞こえる？\n[00:02.00]ASMRって知ってる？\n[00:04.00]耳元で囁くからね…\n[00:06.00]リラックスしてね。',
    expect: 'ja',
  },

  // ===== Chinese (pure) =====
  {
    name: 'ZH: simplified function-word heavy',
    text: '[00:01.00]今天的天气真的很不错呢。\n[00:03.50]我们一起去公园走走吧。\n[00:06.00]他不在家，所以只能等了。',
    expect: 'zh',
  },
  {
    name: 'ZH: traditional',
    text: '[00:01.00]今天的天氣真的很不錯呢。\n[00:03.50]我們一起去公園走走吧。\n[00:06.00]他不在家，所以只能等了。',
    expect: 'zh',
  },
  {
    name: 'ZH: pure han no kana no latin',
    text: '[00:01.00]欢迎使用本软件。\n[00:03.00]如有问题请联系客服。\n[00:05.00]谢谢您的支持。',
    expect: 'zh',
  },

  // ===== English =====
  {
    name: 'EN: plain english',
    text: '[00:01.00]Hello, how are you today?\n[00:03.50]I hope you are doing well.\n[00:06.00]Let me whisper in your ear.',
    expect: 'en',
  },
  {
    name: 'EN: english with numbers',
    text: '[00:00.00]Chapter 1: The Beginning\n[00:05.00]3 hours later, he woke up.\n[00:08.00]Nothing happened.',
    expect: 'en',
  },

  // ===== Dual (bilingual) =====
  {
    name: 'DUAL: zh/ja alternating lines',
    text: '[00:01.00]今日は良い天気ですね。\n[00:03.00]今天天气真不错呢。\n[00:05.00]公園へ行きましょう。\n[00:07.00]我们去公园吧。',
    expect: 'dual',
  },
  {
    name: 'DUAL: zh/en alternating',
    text: '[00:01.00]Hello everyone.\n[00:03.00]大家好。\n[00:05.00]Welcome to my channel.\n[00:07.00]欢迎来到我的频道。',
    expect: 'dual',
  },
  {
    name: 'DUAL: ja/en alternating',
    text: '[00:01.00]こんにちは。\n[00:03.00]Hello.\n[00:05.00]はじめまして。\n[00:07.00]Nice to meet you.',
    expect: 'dual',
  },
  {
    name: 'DUAL: inline zh+ja in same line',
    text: '[00:01.00]今日は / 今天天气不错',
    expect: 'dual',
  },

  // ===== Edge cases =====
  {
    name: 'EDGE: empty string',
    text: '',
    expect: 'unknown',
  },
  {
    name: 'EDGE: only timestamps',
    text: '[00:01.00]\n[00:03.50]\n[00:06.00]',
    expect: 'unknown',
  },
  {
    name: 'EDGE: numbers only',
    text: '1\n00:01:23,456 --> 00:02:00,000\n2\n00:02:00,000 --> 00:02:30,000',
    expect: 'unknown',
  },
]

let passed = 0
let failed = 0

for (const c of cases) {
  const result = detectLanguageFromContent(c.text)
  if (result === c.expect) {
    passed++
    console.log(`✓ ${c.name} → ${result}`)
  } else {
    failed++
    console.log(`✗ ${c.name}\n   expected: ${c.expect}\n   got:      ${result}`)
  }
}

console.log(`\n${passed} passed, ${failed} failed, ${cases.length} total`)
if (failed > 0) process.exitCode = 1
