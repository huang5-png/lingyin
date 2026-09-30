import { describe, it, expect } from 'vitest'
import { detectLanguageFromContent } from '../scanner.js'

describe('detectLanguageFromContent', () => {
  // ===== Japanese (pure) =====
  it.each([
    ['plain hiragana sentence', '[00:01.00]今日はとても良い天気ですね。\n[00:03.50]公園に行きましょうか。', 'ja'],
    ['katakana heavy', '[00:01.00]コーヒーを飲みながらショッピングモールを歩いた。\n[00:04.00]エレベーターで上の階へ。', 'ja'],
    ['kanji-heavy with minimal kana', '[00:01.00]日本語教育促進法案\n[00:03.00]東京都港区\n[00:05.00]現在進行形', 'ja'],
    ['mixed kanji+kana+romaji (typical ASMR subtitle)', '[00:00.50]ねえ、聞こえる？\n[00:02.00]ASMRって知ってる？\n[00:04.00]耳元で囁くからね…\n[00:06.00]リラックスしてね。', 'ja'],
  ])('JA: %s', (_name, text, expected) => {
    expect(detectLanguageFromContent(text)).toBe(expected)
  })

  // ===== Chinese (pure) =====
  it.each([
    ['simplified function-word heavy', '[00:01.00]今天的天气真的很不错呢。\n[00:03.50]我们一起去公园走走吧。\n[00:06.00]他不在家，所以只能等了。', 'zh'],
    ['traditional', '[00:01.00]今天的天氣真的很不錯呢。\n[00:03.50]我們一起去公園走走吧。\n[00:06.00]他不在家，所以只能等了。', 'zh'],
    ['pure han no kana no latin', '[00:01.00]欢迎使用本软件。\n[00:03.00]如有问题请联系客服。\n[00:05.00]谢谢您的支持。', 'zh'],
  ])('ZH: %s', (_name, text, expected) => {
    expect(detectLanguageFromContent(text)).toBe(expected)
  })

  // ===== English =====
  it.each([
    ['plain english', '[00:01.00]Hello, how are you today?\n[00:03.50]I hope you are doing well.\n[00:06.00]Let me whisper in your ear.', 'en'],
    ['english with numbers', '[00:00.00]Chapter 1: The Beginning\n[00:05.00]3 hours later, he woke up.\n[00:08.00]Nothing happened.', 'en'],
  ])('EN: %s', (_name, text, expected) => {
    expect(detectLanguageFromContent(text)).toBe(expected)
  })

  // ===== Dual (bilingual) =====
  it.each([
    ['zh/ja alternating lines', '[00:01.00]今日は良い天気ですね。\n[00:03.00]今天天气真不错呢。\n[00:05.00]公園へ行きましょう。\n[00:07.00]我们去公园吧。', 'dual'],
    ['zh/en alternating', '[00:01.00]Hello everyone.\n[00:03.00]大家好。\n[00:05.00]Welcome to my channel.\n[00:07.00]欢迎来到我的频道。', 'dual'],
    ['ja/en alternating', '[00:01.00]こんにちは。\n[00:03.00]Hello.\n[00:05.00]はじめまして。\n[00:07.00]Nice to meet you.', 'dual'],
    ['inline zh+ja in same line', '[00:01.00]今日は / 今天天气不错', 'dual'],
  ])('DUAL: %s', (_name, text, expected) => {
    expect(detectLanguageFromContent(text)).toBe(expected)
  })

  // ===== Edge cases =====
  it.each([
    ['empty string', '', 'unknown'],
    ['only timestamps', '[00:01.00]\n[00:03.50]\n[00:06.00]', 'unknown'],
    ['numbers only', '1\n00:01:23,456 --> 00:02:00,000\n2\n00:02:00,000 --> 00:02:30,000', 'unknown'],
  ])('EDGE: %s', (_name, text, expected) => {
    expect(detectLanguageFromContent(text)).toBe(expected)
  })
})
