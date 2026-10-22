/**
 * 把「一行大标题」的字号按**内容容器宽度**拟合。
 *
 * 为什么需要它（2026-10-10 验收记录 P2-1）：
 *   `/photo` 的开场大字原先写 `font-size: clamp(40px, 12.4vw, 176px)` ——
 *   字号跟的是**整个视口**的宽度，可标题实际能用的宽度是
 *   「`.pv__hero` 的 `max-width: 1400px` − 左右 `padding-inline: clamp(20px, 4.4vw, 64px)`」。
 *   1280 视口实测：可用 1157，而 `PHOTOGRAPHY` 在 12.4vw 下要 1331 ⇒
 *   末尾的 `Y` 被根元素的 `overflow-x: clip` 吃掉。1920 视口更糟：
 *   `max-width: 1400` 把可用宽度封在 1272，而 `12.4vw` 早被 `clamp` 顶到 176px，
 *   照样溢出。
 *
 * 为什么用 JS 量而不是写死一个 `cqw` 比例：
 *   文字宽度 = 字号 × **字体度量**（每个字的 advance 之和 + 字距），
 *   字体度量随字体回退、字重、letter-spacing 变。写死比例就是把
 *   「这台机器上刚好放得下」当成判据 —— 换台机器、换个字体栈就重新溢出。
 *   这里改成**实测**：先按参考字号量出文字的自然宽度，再按比例反算字号。
 *
 * 判据：`fit()` 之后 `el.scrollWidth <= el.clientWidth`（不靠 overflow 隐藏）。
 *
 * ⚠️ 量宽时临时加 `white-space: nowrap`：不加的话文字会换行，
 *    `Range` 量到的是「换行后最宽的一行」，永远量不出自然宽度。
 * ⚠️ 只观察**父元素**，不观察自己：字号一变，自己的高度就变，
 *    观察自己会自触发。父元素的高度变化仍会通知一次，所以先用
 *    宽度、文本、字体参数的缓存判断，未变化时不再临时写字号、测量行盒。
 */

import { onBeforeUnmount, onMounted, type Ref } from 'vue'

/** 量文字宽度用的参考字号。取 100 是为了让比例算得准（浮点相对误差小）。 */
const REF_PX = 100

/**
 * 安全余量。拟合出来的字号是「文字宽度**正好等于**容器宽度」，而浏览器的行盒
 * 宽度是带小数的：差 0.4px 就会换行，而换行之后 `scrollWidth === clientWidth`
 * —— 「没溢出」的判据照样通过，看起来一切正常，只是标题变成了两行。
 * 所以先留 0.5% 余量，再用行数复核（见 `lines()`）。
 */
const SAFETY = 0.995
/** 复核不通过时每次再收 2%，最多 3 次。 */
const SHRINK = 0.98
const MAX_SHRINK_TRIES = 3

/*
 * ⚠️ 这两个 interface **不 export**：它们只出现在本文件导出的函数签名里，
 *    没有别的模块会 import 它们。`_audit-dead-exports.cjs` 会把「导出了但
 *    全项目零引用」的符号列成幽灵 API —— 不留这种噪音。
 */
interface FitTextOptions {
  /** 下限（px）—— 再窄的容器也不缩到比这更小，否则标题会变成一条小字。 */
  min: number
  /** 上限（px）—— 设计稿的桌面最大字号。 */
  max: number
}

interface FitTextHandle {
  /** 手动重算（例如字体加载完成、内容语言切换之后）。 */
  fit: () => void
}

/**
 * 按**内容容器**的可用宽度反算字号，写回 `style.fontSize`。
 *
 * 为什么不能用 `vw` 单位：`vw` 跟的是视口宽度，而标题实际能用的宽度由
 * 外层容器的 `max-width` 与内边距决定 —— 视口越宽两者差得越多，最后
 * 一行会被根元素的 `overflow-x: clip` 吃掉（实测 1280 视口下末尾的 `Y` 被切）。
 *
 * ⚠️ 幂等：输入与上次相同时直接返回，不做参考字号的写入与文字行盒测量。
 *    `ResizeObserver` 的初次通知、父元素的高度变化不会重复触发强制布局。
 *
 * @param target 标题元素（`ref`）
 * @param opts   `min` / `max` 字号边界（px）
 * @returns      句柄：`fit()` 可手动重算（字体加载完成、切语言之后）
 */
export function useFitText(target: Ref<HTMLElement | null>, opts: FitTextOptions): FitTextHandle {
  let ro: ResizeObserver | null = null
  let mo: MutationObserver | null = null
  let disposed = false
  let frame = 0
  let lastElement: HTMLElement | null = null
  let lastKey = ''
  let fontRevision = 0
  let fontsPending = false

  /**
   * 存的是拟合完成后的计算样式：em 字距会随字号变，不能把参考字号时的值
   * 当作下一次的输入，否则同一次拟合也会被误判为字体变化。
   * fontRevision 捕获字体文件替换（font-family 的字符串可能完全没变）。
   */
  function cacheKey(el: HTMLElement, avail: number): string {
    const style = getComputedStyle(el)
    return JSON.stringify([
      avail, el.textContent, fontRevision, opts.min, opts.max,
      style.fontFamily, style.fontSize, style.fontWeight, style.fontStyle,
      style.fontStretch, style.fontVariant, style.fontFeatureSettings,
      style.fontVariationSettings, style.fontKerning, style.fontOpticalSizing,
      style.fontSynthesis, style.letterSpacing, style.wordSpacing,
      style.textTransform, style.textIndent, style.whiteSpace, style.wordBreak,
      style.overflowWrap, style.direction, style.writingMode, style.lineHeight,
    ])
  }

  /** 将同一帧内的 RO、字体完成和文字变化合并；首次挂载仍同步确定字号。 */
  function scheduleFit(): void {
    if (disposed || frame) return
    frame = requestAnimationFrame(() => {
      frame = 0
      fit()
    })
  }

  function onFontLoading(): void {
    fontsPending = true
  }

  function onFontsSettled(): void {
    if (disposed || !fontsPending) return
    fontsPending = false
    fontRevision += 1
    scheduleFit()
  }

  /**
   * 实测自然宽度，按比例计算字号，再以行数复核。
   *
   * 幂等：输入未变就不写样式、不测 Range。字体真正加载、文字或容器宽度
   * 变化后再重新实测；`disposed` 之后一律空转。
   */
  function fit(): void {
    if (disposed) return
    const el = target.value
    if (!el) return

    /*
     * 当前标题自身不带左右内边距（内边距在父容器），clientWidth 因而就是
     * 文字的可用宽度。不要改用视口宽度或带边框的 offsetWidth 作为拟合基准。
     */
    const avail = el.clientWidth
    if (avail <= 0) return
    if (el === lastElement && cacheKey(el, avail) === lastKey) return

    const prevSize = el.style.fontSize
    const prevWrap = el.style.whiteSpace
    el.style.fontSize = `${REF_PX}px`
    el.style.whiteSpace = 'nowrap'

    const range = document.createRange()
    range.selectNodeContents(el)
    const natural = range.getBoundingClientRect().width

    el.style.whiteSpace = prevWrap

    if (!(natural > 0)) {
      // 量不到（元素还没进布局 / 文本为空）：原样还回去，别把一个参考字号留在 DOM 上
      el.style.fontSize = prevSize
      return
    }

    const size = Math.min(opts.max, Math.max(opts.min, (REF_PX * avail * SAFETY) / natural))
    el.style.fontSize = `${size.toFixed(2)}px`

    /*
     * 复核：**行数必须是 1**。
     * ⚠️ 不能只看 `scrollWidth <= clientWidth` —— 一旦文字换行，它天然就成立，
     *    于是「已经放得下」和「被挤成两行」读数完全一样。行数才是判据。
     */
    for (let i = 0; i < MAX_SHRINK_TRIES && lines(el) > 1; i += 1) {
      const cur = parseFloat(el.style.fontSize) || size
      el.style.fontSize = `${(cur * SHRINK).toFixed(2)}px`
    }

    lastElement = el
    lastKey = cacheKey(el, avail)
  }

  /** 元素里文本的行盒数量（1 = 单行）。 */
  function lines(el: HTMLElement): number {
    const range = document.createRange()
    range.selectNodeContents(el)
    return range.getClientRects().length
  }

  onMounted(() => {
    fontsPending = document.fonts.status === 'loading'
    const initialFontsPending = fontsPending
    document.fonts.addEventListener('loading', onFontLoading)
    document.fonts.addEventListener('loadingdone', onFontsSettled)
    document.fonts.addEventListener('loadingerror', onFontsSettled)

    // 同步先算一次：`onMounted` 时 DOM 已在布局里，赶在第一帧之前定好字号，不会闪。
    fit()

    const parent = target.value?.parentElement
    if (parent && typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(scheduleFit)
      ro.observe(parent)
    }

    const el = target.value
    if (el && typeof MutationObserver !== 'undefined') {
      mo = new MutationObserver(scheduleFit)
      mo.observe(el, {
        childList: true, subtree: true, characterData: true,
        attributes: true, attributeFilter: ['class', 'lang', 'dir'],
      })
    }
    // max-width 容器在断点两侧可能一样宽，但字体/字距仍可能变化。
    window.addEventListener('resize', scheduleFit, { passive: true })

    /*
     * ⚠️ 字体是异步的：`document.fonts.ready` 之前量到的是**回退字体**的度量，
     *    换成正体后宽度会变；仅确有加载时失效。已 ready 的默认系统字体不再
     *    重复量一次，ready 与 loadingdone 同一轮完成也只失效一次。
     */
    if (initialFontsPending) void document.fonts.ready.then(onFontsSettled)
  })

  onBeforeUnmount(() => {
    disposed = true
    if (frame) cancelAnimationFrame(frame)
    frame = 0
    ro?.disconnect()
    ro = null
    mo?.disconnect()
    mo = null
    window.removeEventListener('resize', scheduleFit)
    document.fonts.removeEventListener('loading', onFontLoading)
    document.fonts.removeEventListener('loadingdone', onFontsSettled)
    document.fonts.removeEventListener('loadingerror', onFontsSettled)
    lastElement = null
  })

  return { fit }
}
