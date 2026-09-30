// 播放速度纯函数模块：档位表与档位切换，供播放栏、沉浸式视图与快捷键共用。

export const PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2]

/**
 * 在当前档位基础上上/下调一档，并限制在档位表范围内。
 * @param {number} current 当前播放速度
 * @param {'up'|'down'} direction 调整方向
 * @returns {number} 调整后的播放速度
 */
export function stepPlaybackRate(current, direction) {
  const index = PLAYBACK_RATES.indexOf(current)
  const base = index === -1 ? PLAYBACK_RATES.indexOf(1) : index
  const next = direction === 'up' ? base + 1 : base - 1
  const clamped = Math.max(0, Math.min(PLAYBACK_RATES.length - 1, next))
  return PLAYBACK_RATES[clamped]
}
