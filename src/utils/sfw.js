/**
 * 全年龄（SFW）模式工具
 * 仅在 "全年龄版" 启动项下启用，通过环境变量 VITE_SFW 触发。
 * 作用：应用内置「健全」标签与年龄分级，全年龄模式下只展示
 * 全年龄内容，封面等图片均为安全内容，可正常显示。
 * 对正常版启动完全无影响。
 */

// 全年龄模式下本地媒体库必须包含的标签名
export const SFW_TAG = '健全'

// 是否全年龄模式：仅当环境变量 VITE_SFW 为 '1' 时生效
export const isSfwMode = () => {
  try {
    return import.meta.env.VITE_SFW === '1'
  } catch (e) {
    return false
  }
}