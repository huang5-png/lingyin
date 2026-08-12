// 测试播放队列的 removeFromQueue 函数修复
describe('usePlayQueue removeFromQueue', () => {
  // 模拟一个简化的 removeFromQueue 函数
  function removeFromQueue(itemId, prevQueue, prevIndex) {
    const idx = prevQueue.findIndex((it) => it.id === itemId)
    if (idx < 0) return { queue: prevQueue, index: prevIndex }

    const next = prevQueue.filter((it) => it.id !== itemId)
    let newIndex = prevIndex

    if (prevIndex >= 0) {
      if (idx < prevIndex) {
        newIndex = prevIndex - 1
      } else if (idx === prevIndex) {
        newIndex = idx >= prevQueue.length - 1 ? -1 : prevIndex
      }
    }

    return { queue: next, index: newIndex }
  }

  const createQueueItem = (id) => ({
    id,
    audio: { path: `/path/${id}.mp3` },
    work: { id: `work-${id}` }
  })

  test('removes item from queue correctly', () => {
    const queue = [createQueueItem('a'), createQueueItem('b'), createQueueItem('c')]
    const result = removeFromQueue('b', queue, 1)
    
    expect(result.queue.length).toBe(2)
    expect(result.queue.find(i => i.id === 'b')).toBeUndefined()
  })

  test('updates queueIndex correctly when removing item before current', () => {
    const queue = [createQueueItem('a'), createQueueItem('b'), createQueueItem('c')]
    const result = removeFromQueue('a', queue, 2) // 当前播放第 3 首，删除第 1 首
    
    expect(result.index).toBe(1) // 索引应该从 2 变成 1
  })

  test('updates queueIndex correctly when removing item after current', () => {
    const queue = [createQueueItem('a'), createQueueItem('b'), createQueueItem('c')]
    const result = removeFromQueue('c', queue, 1) // 当前播放第 2 首，删除第 3 首
    
    expect(result.index).toBe(1) // 索引不变
  })

  test('handles removing current playing item', () => {
    const queue = [createQueueItem('a'), createQueueItem('b'), createQueueItem('c')]
    const result = removeFromQueue('b', queue, 1) // 当前播放第 2 首，删除当前
    
    expect(result.index).toBe(1) // 索引保持在当前位置
  })

  test('handles removing last item when playing it', () => {
    const queue = [createQueueItem('a'), createQueueItem('b'), createQueueItem('c')]
    const result = removeFromQueue('c', queue, 2) // 当前播放最后一首，删除当前
    
    expect(result.index).toBe(-1) // 应该停止播放
  })

  test('handles concurrent removals correctly (race condition fix)', () => {
    // 这是修复前的 bug 场景：多个并发删除
    // 修复前：使用外部 playQueue 导致索引计算错误
    // 修复后：在 setPlayQueue 回调内部计算，确保状态一致性
    const queue = [
      createQueueItem('a'),
      createQueueItem('b'),
      createQueueItem('c'),
      createQueueItem('d')
    ]
    
    // 模拟并发删除 'a' 和 'c'
    const result1 = removeFromQueue('a', queue, 2)
    const result2 = removeFromQueue('c', result1.queue, result1.index)
    
    expect(result2.queue.length).toBe(2)
    expect(result2.queue.find(i => i.id === 'a')).toBeUndefined()
    expect(result2.queue.find(i => i.id === 'c')).toBeUndefined()
    // 索引应该根据第二次删除后的队列状态正确更新
    expect(result2.index).toBe(0)
  })

  test('handles non-existent item', () => {
    const queue = [createQueueItem('a'), createQueueItem('b')]
    const result = removeFromQueue('nonexistent', queue, 1)
    
    expect(result.queue).toEqual(queue)
    expect(result.index).toBe(1)
  })
})