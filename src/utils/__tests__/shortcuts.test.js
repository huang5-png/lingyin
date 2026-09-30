import { describe, it, expect } from 'vitest'
import {
  ACTION_LABELS,
  DEFAULT_SHORTCUTS,
  buildActionGroups,
  eventToShortcut,
  findConflict,
  getAllConflicts,
  matchShortcut,
  normalizeKey,
  normalizeShortcuts,
  parseShortcut,
  shortcutEquals,
} from '../shortcuts.js'

const keyEvent = (key, { ctrl = false, shift = false, alt = false } = {}) => ({
  key,
  ctrlKey: ctrl,
  shiftKey: shift,
  altKey: alt,
})

describe('normalizeKey', () => {
  it('空格归一化为 Space', () => {
    expect(normalizeKey(' ')).toBe('Space')
  })

  it('单字符统一大写，保证大小写不敏感', () => {
    expect(normalizeKey('m')).toBe('M')
  })

  it('多字符键名保持不变', () => {
    expect(normalizeKey('ArrowLeft')).toBe('ArrowLeft')
  })

  it('空值返回空串', () => {
    expect(normalizeKey('')).toBe('')
    expect(normalizeKey(undefined)).toBe('')
  })
})

describe('parseShortcut', () => {
  it('解析组合键', () => {
    expect(parseShortcut('Ctrl+Shift+P')).toEqual({ ctrl: true, shift: true, alt: false, key: 'P' })
  })

  it('解析单键并归一化大小写', () => {
    expect(parseShortcut('m')).toEqual({ ctrl: false, shift: false, alt: false, key: 'M' })
  })

  it('空字符串返回 null', () => {
    expect(parseShortcut('')).toBeNull()
    expect(parseShortcut(undefined)).toBeNull()
  })
})

describe('matchShortcut', () => {
  it('小写按键事件命中大写绑定（修复大小写敏感导致字母键失效）', () => {
    expect(matchShortcut(keyEvent('m'), 'M')).toBe(true)
  })

  it('空格键命中 Space 绑定', () => {
    expect(matchShortcut(keyEvent(' '), 'Space')).toBe(true)
  })

  it('修饰键不一致时不命中', () => {
    expect(matchShortcut(keyEvent('k'), 'Ctrl+K')).toBe(false)
    expect(matchShortcut(keyEvent('k', { ctrl: true }), 'Ctrl+K')).toBe(true)
  })

  it('未绑定时不命中', () => {
    expect(matchShortcut(keyEvent('m'), '')).toBe(false)
  })
})

describe('eventToShortcut', () => {
  it('只按修饰键时返回 null', () => {
    expect(eventToShortcut(keyEvent('Control', { ctrl: true }))).toBeNull()
    expect(eventToShortcut(keyEvent('Shift', { shift: true }))).toBeNull()
  })

  it('组合键按固定顺序拼接', () => {
    expect(eventToShortcut(keyEvent('P', { ctrl: true, shift: true }))).toBe('Ctrl+Shift+P')
  })

  it('字母键记录为大写', () => {
    expect(eventToShortcut(keyEvent('m'))).toBe('M')
  })
})

describe('shortcutEquals', () => {
  it('忽略大小写差异', () => {
    expect(shortcutEquals('M', 'm')).toBe(true)
  })

  it('修饰键不同则不等价', () => {
    expect(shortcutEquals('Ctrl+M', 'M')).toBe(false)
  })

  it('任一为空则不等价', () => {
    expect(shortcutEquals('', '')).toBe(false)
    expect(shortcutEquals('M', '')).toBe(false)
  })
})

describe('findConflict / getAllConflicts', () => {
  it('检测到同一组合键被多个动作占用', () => {
    const shortcuts = { playPause: 'Space', toggleMute: 'Space' }
    expect(findConflict(shortcuts, 'playPause', 'Space')).toBe('toggleMute')
  })

  it('排除自身', () => {
    const shortcuts = { playPause: 'Space' }
    expect(findConflict(shortcuts, 'playPause', 'Space')).toBeNull()
  })

  it('扫描全部冲突动作', () => {
    const shortcuts = { a1: 'M', a2: 'M', a3: 'Space' }
    const conflicts = getAllConflicts(shortcuts)
    expect(conflicts.a1).toEqual(['a2'])
    expect(conflicts.a2).toEqual(['a1'])
    expect(conflicts.a3).toBeUndefined()
  })

  it('未绑定动作不参与冲突', () => {
    expect(getAllConflicts({ a1: '', a2: '' })).toEqual({})
  })
})

describe('normalizeShortcuts', () => {
  it('为老用户补齐新增动作的默认值', () => {
    const result = normalizeShortcuts({ playPause: 'Space' })
    expect(result.toggleMute).toBe(DEFAULT_SHORTCUTS.toggleMute)
    expect(result.playPause).toBe('Space')
  })

  it('迁移旧版方向键绑定（上一曲/下一曲 → 快退/快进）', () => {
    const result = normalizeShortcuts({ prevTrack: 'ArrowLeft', nextTrack: 'ArrowRight' })
    expect(result.prevTrack).toBe('')
    expect(result.nextTrack).toBe('')
    expect(result.seekBackward).toBe('ArrowLeft')
    expect(result.seekForward).toBe('ArrowRight')
  })

  it('用户已自定义快退/快进时不迁移', () => {
    const result = normalizeShortcuts({
      prevTrack: 'ArrowLeft',
      nextTrack: 'ArrowRight',
      seekBackward: 'Ctrl+J',
    })
    expect(result.prevTrack).toBe('ArrowLeft')
    expect(result.nextTrack).toBe('ArrowRight')
    expect(result.seekBackward).toBe('Ctrl+J')
  })

  it('迁移可重复执行且结果稳定', () => {
    const once = normalizeShortcuts({ prevTrack: 'ArrowLeft', nextTrack: 'ArrowRight' })
    expect(normalizeShortcuts(once)).toEqual(once)
  })

  it('入参为空时返回完整默认值', () => {
    expect(normalizeShortcuts(undefined)).toEqual(DEFAULT_SHORTCUTS)
  })
})

describe('buildActionGroups', () => {
  it('覆盖所有已定义的动作且不重复', () => {
    const actions = buildActionGroups().flatMap((group) => group.actions)
    expect(actions.length).toBe(Object.keys(ACTION_LABELS).length)
    expect(new Set(actions).size).toBe(actions.length)
  })

  it('分组顺序与 SHORTCUT_GROUPS 一致', () => {
    expect(buildActionGroups().map((group) => group.label)).toEqual([
      '播放控制',
      '音量与速度',
      '界面与窗口',
      '导航',
    ])
  })
})
