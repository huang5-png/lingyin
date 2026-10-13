import { describe, it, expect } from 'vitest'
import {
  isImageFile,
  getExtension,
  categorizeImage,
  resolveWorkGallery,
  naturalCompare,
} from '../galleryScanner'

describe('galleryScanner 图片文件识别与分类', () => {
  it('正确识别常见图像扩展名', () => {
    expect(isImageFile('cover.jpg')).toBe(true)
    expect(isImageFile('sample.png')).toBe(true)
    expect(isImageFile('art.webp')).toBe(true)
    expect(isImageFile('animation.gif')).toBe(true)
    expect(isImageFile('track.mp3')).toBe(false)
    expect(isImageFile('sub.vtt')).toBe(false)
  })

  it('getExtension 正确获取扩展名', () => {
    expect(getExtension('illust.PNG')).toBe('.png')
    expect(getExtension('noext')).toBe('')
  })

  it('categorizeImage 智能分类', () => {
    expect(categorizeImage('cover.jpg').key).toBe('cover')
    expect(categorizeImage('01_main.png').key).toBe('cover')
    expect(categorizeImage('scene_01.jpg', 'cg/scene_01.jpg').key).toBe('cg')
    expect(categorizeImage('bonus_card.png', '特典/bonus_card.png').key).toBe('bonus')
    expect(categorizeImage('tachie_smile.png', 'chara/tachie_smile.png').key).toBe('character')
    expect(categorizeImage('comic_p01.jpg', 'book/comic_p01.jpg').key).toBe('comic')
    expect(categorizeImage('random.jpg').key).toBe('illust')
  })

  it('naturalCompare 自然数字排序', () => {
    const list = ['10.jpg', '2.jpg', '1.jpg', '20.jpg']
    list.sort(naturalCompare)
    expect(list).toEqual(['1.jpg', '2.jpg', '10.jpg', '20.jpg'])
  })
})

describe('resolveWorkGallery 作品画集整合', () => {
  it('主封面排在首位且不重复', () => {
    const work = {
      cover: 'http://example.com/cover.jpg',
      title: '测试音声',
    }
    const localImages = [
      { url: 'http://example.com/cover.jpg', name: 'cover.jpg' },
      { url: 'file:///d:/asmr/cg1.jpg', name: 'cg1.jpg', category: 'cg', categoryLabel: 'CG插画' },
    ]

    const gallery = resolveWorkGallery(work, localImages)
    expect(gallery.length).toBe(2)
    expect(gallery[0].name).toBe('主封面')
    expect(gallery[0].url).toBe('http://example.com/cover.jpg')
    expect(gallery[1].name).toBe('cg1.jpg')
  })

  it('在线作品额外包含 images 列表', () => {
    const work = {
      isOnline: true,
      cover: 'http://example.com/cover.jpg',
      images: ['http://example.com/img1.jpg', 'http://example.com/img2.jpg'],
    }
    const gallery = resolveWorkGallery(work)
    expect(gallery.length).toBe(3)
    expect(gallery[1].name).toBe('插图 1')
    expect(gallery[2].name).toBe('插图 2')
  })
})
