import { describe, it, expect } from 'vitest'
import { compareVersions, resolveDownloadUrl, formatBytes } from '../updaterHelpers'

describe('compareVersions', () => {
  it('正确比较相同版本号', () => {
    expect(compareVersions('1.50.0', '1.50.0')).toBe(0)
    expect(compareVersions('v1.50.0', '1.50.0')).toBe(0)
    expect(compareVersions('1.50', 'v1.50.0')).toBe(0)
  })

  it('正确识别新版本', () => {
    expect(compareVersions('1.50.0', '1.49.1')).toBe(1)
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
  it('直连或空镜像保持原链接', () => {
    const raw = 'https://github.com/user/repo/releases/download/v1.50.0/app.zip'
    expect(resolveDownloadUrl(raw, '')).toBe(raw)
    expect(resolveDownloadUrl(raw, 'direct')).toBe(raw)
  })

  it('正确拼接镜像前缀', () => {
    const raw = 'https://github.com/user/repo/releases/download/v1.50.0/app.zip'
    expect(resolveDownloadUrl(raw, 'https://ghfast.top/')).toBe(`https://ghfast.top/${raw}`)
    expect(resolveDownloadUrl(raw, 'https://ghproxy.net')).toBe(`https://ghproxy.net/${raw}`)
  })

  it('避免重复拼接已有代理镜像前缀', () => {
    const raw = 'https://github.com/user/repo/releases/download/v1.50.0/app.zip'
    const alreadyWrapped = `https://ghfast.top/${raw}`
    expect(resolveDownloadUrl(alreadyWrapped, 'https://ghfast.top/')).toBe(alreadyWrapped)
    expect(resolveDownloadUrl(alreadyWrapped, 'https://ghproxy.net/')).toBe(alreadyWrapped)
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
