/**
 * 旧版 iOS 微信不能只靠 overflow/overscroll-behavior 锁住弹层背后的页面。
 * 仅阻止弹层无法消费的单指拖动；内部滚动、多指缩放和正常点击继续交给浏览器。
 */
export function guardOverlayTouchScroll(
  root: () => HTMLElement | null,
  active: () => boolean,
  events: EventTarget = document,
): () => void {
  let previous: { x: number; y: number } | undefined
  const zoomed = () => typeof window !== 'undefined' && (window.visualViewport?.scale ?? 1) > 1.01

  function start(event: Event): void {
    const touch = event as TouchEvent
    previous = active() && !zoomed() && touch.touches.length === 1
      ? { x: touch.touches[0].clientX, y: touch.touches[0].clientY }
      : undefined
  }

  function reset(): void { previous = undefined }

  function move(event: Event): void {
    const touch = event as TouchEvent
    if (!active() || zoomed() || touch.touches.length !== 1) { reset(); return }
    if (!previous) return
    const point = touch.touches[0]
    const dx = point.clientX - previous.x, dy = point.clientY - previous.y
    previous = { x: point.clientX, y: point.clientY }
    if (!dx && !dy) return

    const host = root()
    const horizontal = Math.abs(dx) > Math.abs(dy)
    const delta = horizontal ? dx : dy
    let node = touch.target instanceof Element ? touch.target as HTMLElement : null
    if (host && node && host.contains(node)) {
      // 先找能沿手势方向继续滚动的内部容器，抵达边界后才阻止滚动链透到正文。
      while (node) {
        const style = getComputedStyle(node)
        const overflow = horizontal ? style.overflowX : style.overflowY
        const position = horizontal ? node.scrollLeft : node.scrollTop
        const extent = horizontal ? node.scrollWidth - node.clientWidth : node.scrollHeight - node.clientHeight
        if (/auto|scroll|overlay/.test(overflow) && extent > 1 &&
            (delta > 0 ? position > 0 : position < extent - 1)) return
        if (node === host) break
        node = node.parentElement
      }
    }
    if (touch.cancelable) touch.preventDefault()
  }

  events.addEventListener('touchstart', start, { capture: true, passive: true })
  events.addEventListener('touchmove', move, { capture: true, passive: false })
  events.addEventListener('touchend', reset, { capture: true, passive: true })
  events.addEventListener('touchcancel', reset, { capture: true, passive: true })
  return () => {
    reset()
    events.removeEventListener('touchstart', start, true)
    events.removeEventListener('touchmove', move, true)
    events.removeEventListener('touchend', reset, true)
    events.removeEventListener('touchcancel', reset, true)
  }
}
