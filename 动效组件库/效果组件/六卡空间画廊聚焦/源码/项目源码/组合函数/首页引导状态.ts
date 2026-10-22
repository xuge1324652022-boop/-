import { onMounted, onUnmounted, watch } from 'vue'

const VISIBLE_DELAY_MS = 4000

interface HomeIntroductionOptions {
  eligible: boolean
  disabled?: boolean
  ready: () => boolean
  enter: () => void
}

/** 每次普通首页加载都可引导；返回来源由页面判断，显式切卡由调用方取消。 */
export function useHomeIntroduction(options: HomeIntroductionOptions): () => void {
  let mounted = false
  let cancelled = false
  const enabled = options.eligible && !options.disabled
  let timer: ReturnType<typeof setTimeout> | null = null
  let startedAt = 0
  let remaining = VISIBLE_DELAY_MS

  function pause() {
    if (timer === null) return
    clearTimeout(timer)
    timer = null
    remaining = Math.max(0, remaining - (performance.now() - startedAt))
  }

  function cancel() {
    cancelled = true
    pause()
  }

  function sync() {
    if (!mounted || !enabled || cancelled) return
    if (document.hidden || !options.ready()) { pause(); return }
    if (timer !== null) return
    startedAt = performance.now()
    timer = setTimeout(() => {
      timer = null
      if (document.hidden || !options.ready()) { remaining = 0; return }
      cancelled = true
      options.enter()
    }, remaining)
  }

  const stopReady = watch(options.ready, sync, { flush: 'post' })
  onMounted(() => {
    mounted = true
    if (!enabled) return
    // 页面解锁、浏览器恢复滚动及无效滚轮都不是主动切卡，不应取消引导。
    document.addEventListener('visibilitychange', sync)
    sync()
  })

  onUnmounted(() => {
    mounted = false
    cancel()
    stopReady()
    document.removeEventListener('visibilitychange', sync)
  })

  return cancel
}
