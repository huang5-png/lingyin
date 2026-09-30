// 快捷键纯函数模块：动作定义、按键事件与快捷键字符串的解析/匹配、冲突检测、旧版迁移。
// 抽离为纯模块供 useKeyboardShortcuts / useAppSettings / KeyboardShortcutsPanel 共用，
// 避免 Hook 反向依赖组件（分层倒置），同时便于单元测试。

/**
 * 动作分组，决定设置面板中快捷键的展示顺序与分组标题。
 * 分组未覆盖的动作会由 buildActionGroups 归入「其他」，不会丢失。
 */
export const SHORTCUT_GROUPS = [
  { id: 'playback', label: '播放控制', actions: ['playPause', 'prevTrack', 'nextTrack', 'seekBackward', 'seekForward', 'toggleAbLoop'] },
  { id: 'volume', label: '音量与速度', actions: ['volumeUp', 'volumeDown', 'toggleMute', 'speedUp', 'speedDown'] },
  { id: 'view', label: '界面与窗口', actions: ['toggleImmersive', 'exitImmersive', 'toggleQueue', 'openSettings'] },
  { id: 'nav', label: '导航', actions: ['globalSearch'] },
]

export const DEFAULT_SHORTCUTS = {
  playPause: 'Space',
  prevTrack: '',
  nextTrack: '',
  seekBackward: 'ArrowLeft',
  seekForward: 'ArrowRight',
  toggleAbLoop: '',
  volumeUp: 'ArrowUp',
  volumeDown: 'ArrowDown',
  toggleMute: 'M',
  speedUp: '',
  speedDown: '',
  toggleImmersive: '',
  exitImmersive: 'Escape',
  toggleQueue: '',
  openSettings: '',
  globalSearch: 'Ctrl+K',
}

export const ACTION_LABELS = {
  playPause: '播放/暂停',
  prevTrack: '上一曲',
  nextTrack: '下一曲',
  seekBackward: '快退',
  seekForward: '快进',
  toggleAbLoop: 'A-B 循环',
  volumeUp: '音量增加',
  volumeDown: '音量减少',
  toggleMute: '静音切换',
  speedUp: '加速播放',
  speedDown: '减速播放',
  toggleImmersive: '切换沉浸式',
  exitImmersive: '退出沉浸式',
  toggleQueue: '显示/隐藏队列',
  openSettings: '打开设置',
  globalSearch: '全局搜索',
}

export const ACTION_DESCS = {
  playPause: '切换播放与暂停状态',
  prevTrack: '跳转到上一首曲目',
  nextTrack: '跳转到下一首曲目',
  seekBackward: '向后快退指定秒数',
  seekForward: '向前快进指定秒数',
  toggleAbLoop: '标记 A 点 / 标记 B 点并循环 / 关闭循环',
  volumeUp: '增加播放音量',
  volumeDown: '减少播放音量',
  toggleMute: '静音或恢复上一音量',
  speedUp: '按档位提高播放速度',
  speedDown: '按档位降低播放速度',
  toggleImmersive: '进入或退出沉浸式播放模式',
  exitImmersive: '关闭沉浸式播放模式',
  toggleQueue: '显示或隐藏播放队列浮层',
  openSettings: '打开设置面板',
  globalSearch: '打开/关闭全局搜索弹窗',
}

// 仅按下修饰键时不应被记录为快捷键
const MODIFIER_KEYS = ['Control', 'Shift', 'Alt', 'Meta', 'CapsLock', 'Dead']

/**
 * 把 `KeyboardEvent.key` 归一化为快捷键字符串中的键名。
 * 单字符统一大写，保证「按 M 键」与录制时存下的 `M` 能匹配（大小写不敏感）。
 */
export function normalizeKey(key) {
  if (typeof key !== 'string' || !key) return ''
  if (key === ' ') return 'Space'
  if (key.length === 1) return key.toUpperCase()
  return key
}

/**
 * 解析快捷键字符串为结构化描述。
 * @returns {{ctrl: boolean, shift: boolean, alt: boolean, key: string}|null}
 */
export function parseShortcut(shortcutStr) {
  if (!shortcutStr || typeof shortcutStr !== 'string') return null
  const parts = shortcutStr.split('+').filter(Boolean)
  if (parts.length === 0) return null
  return {
    ctrl: parts.includes('Ctrl'),
    shift: parts.includes('Shift'),
    alt: parts.includes('Alt'),
    key: normalizeKey(parts[parts.length - 1]),
  }
}

/**
 * 判断按键事件是否命中某个快捷键字符串。
 */
export function matchShortcut(e, shortcutStr) {
  const expected = parseShortcut(shortcutStr)
  if (!expected || !e) return false
  return (
    e.ctrlKey === expected.ctrl &&
    e.shiftKey === expected.shift &&
    e.altKey === expected.alt &&
    normalizeKey(e.key) === expected.key
  )
}

/**
 * 把按键事件转换为快捷键字符串。
 * 只按下修饰键时返回 null，表示「尚未构成一个有效快捷键」。
 */
export function eventToShortcut(e) {
  if (!e || MODIFIER_KEYS.includes(e.key)) return null
  const parts = []
  if (e.ctrlKey) parts.push('Ctrl')
  if (e.shiftKey) parts.push('Shift')
  if (e.altKey) parts.push('Alt')
  parts.push(normalizeKey(e.key))
  return parts.join('+')
}

/**
 * 两个快捷键字符串是否等价（忽略大小写差异）。
 */
export function shortcutEquals(a, b) {
  const pa = parseShortcut(a)
  const pb = parseShortcut(b)
  if (!pa || !pb) return false
  return pa.ctrl === pb.ctrl && pa.shift === pb.shift && pa.alt === pb.alt && pa.key === pb.key
}

/**
 * 找出与指定动作冲突的其他动作（同一组合键被多个动作占用）。
 * @returns {string|null} 冲突动作的 key，无冲突返回 null
 */
export function findConflict(shortcuts, action, shortcutStr) {
  if (!shortcuts || !shortcutStr) return null
  for (const [other, value] of Object.entries(shortcuts)) {
    if (other === action) continue
    if (shortcutEquals(value, shortcutStr)) return other
  }
  return null
}

/**
 * 扫描全部快捷键，返回所有存在冲突的动作。
 * @returns {Object<string, string[]>} 动作 -> 与之冲突的其他动作列表（仅包含有冲突的动作）
 */
export function getAllConflicts(shortcuts) {
  const result = {}
  if (!shortcuts) return result
  const entries = Object.entries(shortcuts).filter(([, value]) => !!value)
  for (const [action, value] of entries) {
    for (const [other, otherValue] of entries) {
      if (other === action) continue
      if (shortcutEquals(value, otherValue)) {
        if (!result[action]) result[action] = []
        if (!result[action].includes(other)) result[action].push(other)
      }
    }
  }
  return result
}

/**
 * 合并默认快捷键并执行历史迁移，保证新增动作对老用户也有默认值。
 * 迁移：旧版本 prevTrack/nextTrack 默认为 ←/→，后来方向键让给快退/快进。
 */
export function normalizeShortcuts(saved) {
  const savedMap = saved && typeof saved === 'object' ? saved : {}
  const merged = { ...DEFAULT_SHORTCUTS, ...savedMap }
  if (
    merged.prevTrack === 'ArrowLeft' &&
    merged.nextTrack === 'ArrowRight' &&
    !savedMap.seekBackward &&
    !savedMap.seekForward
  ) {
    merged.prevTrack = ''
    merged.nextTrack = ''
    merged.seekBackward = 'ArrowLeft'
    merged.seekForward = 'ArrowRight'
  }
  return merged
}

/**
 * 按分组整理动作，返回非空分组；未在 SHORTCUT_GROUPS 中登记的动作归入「其他」。
 */
export function buildActionGroups() {
  const grouped = new Set()
  const groups = SHORTCUT_GROUPS.map((group) => {
    const actions = group.actions.filter((action) => ACTION_LABELS[action])
    actions.forEach((action) => grouped.add(action))
    return { id: group.id, label: group.label, actions }
  }).filter((group) => group.actions.length > 0)

  const rest = Object.keys(ACTION_LABELS).filter((action) => !grouped.has(action))
  if (rest.length > 0) {
    groups.push({ id: 'other', label: '其他', actions: rest })
  }
  return groups
}
