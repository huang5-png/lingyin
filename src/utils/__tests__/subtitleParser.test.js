/**
 * Tests for parseSubtitle (SRT / VTT timestamp handling)
 * Run with: node --test src/utils/__tests__/subtitleParser.test.js
 */
import { parseSubtitle } from '../subtitleParser.js'

let passed = 0
let failed = 0

function assert(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (ok) {
    passed++
    console.log(`✓ ${name}`)
  } else {
    failed++
    console.log(`✗ ${name}`)
    console.log(`   expected: ${JSON.stringify(expected)}`)
    console.log(`   got:      ${JSON.stringify(actual)}`)
  }
}

// --- Bug F regression: WebVTT with MM:SS.mmm (one colon) timestamps ---
// The WebVTT spec allows omitting the hours component for sub-hour cues.
// Previously parseSRT required HH:MM:SS.mmm and silently returned 0 cues.
const vttShort = `WEBVTT

00:01.000 --> 00:04.000
Hello world

00:04.500 --> 00:07.000
Second cue
`
assert(
  'VTT: MM:SS.mmm timestamps parse to cues',
  parseSubtitle(vttShort, '.vtt'),
  [
    { time: 1, endTime: 4, text: 'Hello world' },
    { time: 4.5, endTime: 7, text: 'Second cue' },
  ],
)

// --- VTT with HH:MM:SS.mmm (two colons) still works ---
const vttFull = `WEBVTT

01:02:03.000 --> 01:02:05.500
Long form cue
`
assert(
  'VTT: HH:MM:SS.mmm timestamps parse to cues',
  parseSubtitle(vttFull, '.vtt'),
  [{ time: 3723, endTime: 3725.5, text: 'Long form cue' }],
)

// --- SRT regression: HH:MM:SS,mmm (comma) still works ---
const srt = `1
00:00:01,000 --> 00:00:02,500
SRT cue one

2
00:00:03,000 --> 00:00:04,000
SRT cue two
`
assert(
  'SRT: HH:MM:SS,mmm timestamps parse to cues',
  parseSubtitle(srt, '.srt'),
  [
    { time: 1, endTime: 2.5, text: 'SRT cue one' },
    { time: 3, endTime: 4, text: 'SRT cue two' },
  ],
)

// --- Empty / no-timestamp input returns empty array (no crash) ---
assert('VTT: no cues returns []', parseSubtitle('WEBVTT\n\n', '.vtt'), [])

console.log(`\n${passed} passed, ${failed} failed, ${passed + failed} total`)
if (failed > 0) process.exitCode = 1
