import { ScrollTrigger } from 'gsap/ScrollTrigger'

/**
 * 一次性入场自然播放；整块滚出屏幕后才兜底完成，避免在阅读中途突然跳完。
 * 特殊调用仍可指定收尾位置。快滚、锚点或异步准备过晚时保留终态，回滚不隐藏已读内容。
 * 在组件的 GSAP context 中创建，并由创建者随媒体查询/卸载撤销。
 */
export function createViewportEntrance(options: {
  trigger: Element
  play: () => void
  complete: () => void
  start?: string
  finishAt?: number
}): ScrollTrigger {
  let completed = false
  const complete = () => {
    if (completed) return
    completed = true
    options.complete()
  }
  const settle = (self: ScrollTrigger) => { if (self.progress >= 1) complete() }
  const trigger = ScrollTrigger.create({
    trigger: options.trigger,
    start: options.start ?? 'top 95%',
    end: options.finishAt === undefined ? 'bottom top' : `top ${options.finishAt * 100}%`,
    once: true,
    onEnter: () => { if (!completed) options.play() },
    onUpdate: settle,
    onRefresh: settle,
    onLeave: complete,
  })
  // 创建时可能已处于触发区间之后；不要依赖用户还会再滚动一帧。
  settle(trigger)
  return trigger
}
