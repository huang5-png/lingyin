import { describe, it, expect } from 'vitest'
import {
  compareVersions,
  resolveDownloadUrl,
  unwrapDownloadUrl,
  formatUpdateFileName,
  formatBytes,
} from '../updaterHelpers'

describe('unwrapDownloadUrl', () => {
  it('原始 GitHub URL 保持不变', () => {
    const raw = 'https://github.com/huang5-png/lingyin/releases/download/v1.50.0/1.50.0.zip'
    expect(unwrapDownloadUrl(raw)).toBe(raw)
  })

  it('剥离单层镜像前缀', () => {
    const raw = 'https://github.com/huang5-png/lingyin/releases/download/v1.50.0/1.50.0.zip'
    const wrapped = `https://ghfast.top/${raw}`
    expect(unwrapDownloadUrl(wrapped)).toBe(raw)
  })

  it('剥离多层嵌套镜像前缀', () => {
    const raw = 'https://github.com/huang5-png/lingyin/releases/download/v1.50.0/1.50.0.zip'
    const multiWrapped = `https://ghproxy.net/https://ghfast.top/${raw}`
    expect(unwrapDownloadUrl(multiWrapped)).toBe(raw)
  })

  it('空值与非字符串安全容错', () => {
    expect(unwrapDownloadUrl('')).toBe('')
    expect(unwrapDownloadUrl(null)).toBe('')
    expect(unwrapDownloadUrl(undefined)).toBe('')
  })
})

describe('compareVersions', () => {
  it('正确比较相同版本号', () => {
    expect(compareVersions('1.50.0', '1.50.0')).toBe(0)
    expect(compareVersions('v1.50.0', '1.50.0')).toBe(0)
    expect(compareVersions('1.50', 'v1.50.0')).toBe(0)
  })

  it('正确识别新版本', () => {
    expect(compareVersions('1.50.1', '1.50.0')).toBe(1)
    expect(compareVersions('v1.50.1', '1.50.0')).toBe(1)
    expect(compareVersions('2.0.0', '1.99.99')).toBe(1)
    expect(compareVersions('1.50.0', '1.49.99')).toBe(1)
  })

  it('正确识别旧版本', () => {
    expect(compareVersions('1.48.0', '1.49.1')).toBe(-1)
    expect(compareVersions('1.49.0', 'v1.49.1')).toBe(-1)
  })

  it('容错空值与异常格式', () => {
    expect(compareVersions('', '')).toBe(0)
    expect(compareVersions('1.50.0', '')).toBe(1)
    expect(compareVersions('', '1.50.0')).toBe(-1)
  })
})

describe('resolveDownloadUrl', () => {
  it('直连或空镜像保持原链接或解包后直连', () => {
    const raw = 'https://github.com/user/repo/releases/download/v1.50.0/app.zip'
    expect(resolveDownloadUrl(raw, '')).toBe(raw)
    expect(resolveDownloadUrl(raw, 'direct')).toBe(raw)

    const wrapped = `https://ghfast.top/${raw}`
    expect(resolveDownloadUrl(wrapped, 'direct')).toBe(raw)
  })

  it('正确拼接镜像前缀', () => {
    const raw = 'https://github.com/user/repo/releases/download/v1.50.0/app.zip'
    expect(resolveDownloadUrl(raw, 'https://ghfast.top/')).toBe(`https://ghfast.top/${raw}`)
    expect(resolveDownloadUrl(raw, 'https://ghproxy.net')).toBe(`https://ghproxy.net/${raw}`)
  })

  it('支持从旧镜像无缝切换到新镜像', () => {
    const raw = 'https://github.com/user/repo/releases/download/v1.50.0/app.zip'
    const alreadyWrapped = `https://ghfast.top/${raw}`
    expect(resolveDownloadUrl(alreadyWrapped, 'https://ghproxy.net/')).toBe(`https://ghproxy.net/${raw}`)
    expect(resolveDownloadUrl(alreadyWrapped, 'https://ghfast.top/')).toBe(`https://ghfast.top/${raw}`)
  })
})

describe('formatUpdateFileName', () => {
  it('将纯数字版本文件名规范化为易读中文便携版名称', () => {
    expect(formatUpdateFileName('1.50.1.zip', '1.50.1')).toBe('聆音-v1.50.1-便携版.zip')
    expect(formatUpdateFileName('1.50.0.zip', 'v1.50.0')).toBe('聆音-v1.50.0-便携版.zip')
  })

  it('已包含产品名的文件名保持原样', () => {
    expect(formatUpdateFileName('聆音 1.50.1 便携版.zip', '1.50.1')).toBe('聆音 1.50.1 便携版.zip')
    expect(formatUpdateFileName('Lingyin-1.50.1-win.zip', '1.50.1')).toBe('Lingyin-1.50.1-win.zip')
  })

  it('空值时生成默认便携版名称', () => {
    expect(formatUpdateFileName('', '1.50.1')).toBe('聆音-v1.50.1-便携版.zip')
    expect(formatUpdateFileName(null, '')).toBe('聆音-便携版.zip')
  })
})

describe('formatBytes', () => {
  it('正确格式化各种字节大小', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(1024)).toBe('1.0 KB')
    expect(formatBytes(1024 * 1024 * 2.5)).toBe('2.5 MB')
    expect(formatBytes(1024 * 1024 * 1024 * 1.2)).toBe('1.2 GB')
  })
})
