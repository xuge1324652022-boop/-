import { onUnmounted } from 'vue'
import gsap from 'gsap'
import ScrollTrigger from 'gsap/ScrollTrigger'
import { normalizeWheelDelta } from '../utils/wheel'

gsap.registerPlugin(ScrollTrigger)

// 原站实际 Lenis 实例使用 1.2s 指数曲线；沿用现有控制器，统一子页手感。
const DURATION = 1.2
const EXTERNAL_EPSILON = 2
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))
const ease = (progress: number) => Math.min(1, 1.001 - 2 ** (-10 * progress))

/** 页面滚轮只有一个控制器；闸门、原生内部滚动和弹层分别保留自己的输入。 */
export function useSmoothScroll(
  gate?: (pixels: number) => boolean,
  enabled: () => boolean = () => true,
): void {
  const pointer = window.matchMedia('(hover: hover) and (pointer: fine)')
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
  let target = window.scrollY
  let applied = target
  let from = target
  let startedAt = 0
  let raf = 0

  const maxScroll = () => Math.max(0, document.documentElement.scrollHeight - window.innerHeight)
  const blocked = () => {
    const html = document.documentElement
    return !enabled() || !pointer.matches || motion.matches ||
      html.classList.contains('no-scroll') || html.classList.contains('has-subpage-index') || html.classList.contains('page-turn-lock') ||
      html.classList.contains('is-jumping') || html.style.overflow === 'hidden'
  }

  function stop(): void {
    if (raf) cancelAnimationFrame(raf)
    raf = 0
    target = applied = from = window.scrollY
  }

  function write(position: number): void {
    window.scrollTo(0, position)
    applied = window.scrollY
    ScrollTrigger.update()
  }

  function frame(now: number): void {
    raf = 0
    if (blocked()) { stop(); return }
    target = clamp(target, 0, maxScroll())
    const progress = clamp((now - startedAt) / (DURATION * 1000), 0, 1)
    const next = from + (target - from) * ease(progress)
    if (progress === 1 || Math.abs(target - next) < .5) { write(target); return }
    write(next)
    raf = requestAnimationFrame(frame)
  }

  function insideNativeScroller(event: WheelEvent): boolean {
    for (const node of event.composedPath()) {
      if (!(node instanceof HTMLElement) || node === document.body || node === document.documentElement) continue
      if (node.matches('input, textarea, select, [contenteditable="true"], [data-native-scroll]')) return true
      if (node.scrollHeight > node.clientHeight + 1 && /auto|scroll|overlay/.test(getComputedStyle(node).overflowY)) return true
    }
    return false
  }

  function onWheel(event: WheelEvent): void {
    if (event.defaultPrevented || event.ctrlKey || event.metaKey || !event.cancelable) return
    if (blocked() || insideNativeScroller(event) || Math.abs(event.deltaX) > Math.abs(event.deltaY)) { stop(); return }
    const pixels = normalizeWheelDelta(event, window.innerHeight)
    if (!pixels) return
    if (!raf) target = window.scrollY
    const destination = clamp(target + pixels, 0, maxScroll())
    event.preventDefault()
    if (gate?.(pixels)) { stop(); return }
    target = destination
    from = window.scrollY
    startedAt = performance.now()
    if (!raf) raf = requestAnimationFrame(frame)
  }

  // 键盘、锚点和滚动条位置是新的真值，不能被旧目标拉回。
  function onScroll(): void {
    if (Math.abs(window.scrollY - applied) > EXTERNAL_EPSILON) stop()
  }
  function onKey(event: KeyboardEvent): void {
    if (['ArrowDown','ArrowUp','PageDown','PageUp','Home','End',' '].includes(event.key)) stop()
  }

  window.addEventListener('wheel', onWheel, { passive: false })
  window.addEventListener('scroll', onScroll, { passive: true })
  window.addEventListener('keydown', onKey)
  window.addEventListener('pointerdown', stop, { passive: true })
  window.addEventListener('touchstart', stop, { passive: true })
  pointer.addEventListener('change', stop)
  motion.addEventListener('change', stop)
  onUnmounted(() => {
    stop()
    window.removeEventListener('wheel', onWheel)
    window.removeEventListener('scroll', onScroll)
    window.removeEventListener('keydown', onKey)
    window.removeEventListener('pointerdown', stop)
    window.removeEventListener('touchstart', stop)
    pointer.removeEventListener('change', stop)
    motion.removeEventListener('change', stop)
  })
}
