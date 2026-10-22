/**
 * 精选画廊里「单张照片随手拖动」。
 *
 * 方案原文的三条约束，逐条对应到实现：
 *   ① **鼠标拖动时照片 1:1 跟手** —— 位移直接等于指针位移，不加阻尼、不做惯性。
 *      所以写的是 `translate3d(baseX + dx, baseY + dy, 0)`，不是补间。
 *   ② **只有被拖的那张移动，其他照片不动** —— 偏移量存在**每张自己**的
 *      WeakMap 条目里，不是画廊一个共享状态。
 *   ③ **拖动后照片保持当前位置，画廊仍保留文档空间** —— 只改 `transform`，
 *      绝不碰 `position` / `margin` / `order`。元素的布局盒原地不动，
 *      所以后面的照片不会被顶走，滚动高度也不会变（这是「保留文档空间」的
 *      唯一正确做法：一旦改成 `position: absolute` 就立刻塌出空洞）。
 *
 * ⚠️ **只有鼠标能拖**（`pointerType === 'mouse'`）。触摸一律不接管 ——
 *    手机上必须保证纵向滚动随时可用（方案明确要求），而 `touch-action: none`
 *    一旦加上，手指在照片上滑动就再也滚不动页面了。手机上的交互是「点一下看
 *    完整照片」，不是拖动。
 *
 * ⚠️ **拖完不能顺手打开查看器**：拖动结束后的那一次 `click` 必须被吞掉。
 *    做法是在**捕获阶段**监听 root 上的 click 并 `stopPropagation` —— 挂在
 *    按钮自己的 bubble 监听（Vue 的 `@click`）之前，才能真正拦住它。
 *    阈值 4px：低于它算手抖，仍然是一次正常点击。
 *
 * ⚠️ **绝不能用 `setPointerCapture`**（2026-10-10 实测踩过）。
 *
 *    直觉上「按下时捕获指针」是拖动的最优解：捕获之后指针移到元素外面，
 *    `pointermove` 依然会派发过来。但它有一个要命的副作用 ——
 *    **指针被捕获时，`click` 会被改派给「捕获元素」**。
 *    捕获的是 `<figure class="pg__item">`，而 `@click` 挂在它的子节点
 *    `<button class="pg__btn">` 上 ⇒ 按钮永远收不到点击，**普通点击也打不开
 *    查看器**（实测：脚本里「未拖动的普通点击」等 8 秒超时，一次都没开）。
 *    而拖动那条路径是绿的（因为它本来就要吞掉 click）—— 一个只坏一半、
 *    看起来像「偶尔点不动」的 bug。
 *
 *    所以改成：`pointerdown` 只记起点，**拖动期间在 `window` 上**听
 *    `pointermove` / `pointerup` / `pointercancel`，`endDrag()` 时摘掉。
 *    指针事件语义完全不变（没有捕获就没有改派），而且指针拖到画廊外面
 *    也照样收得到 `pointerup`。
 */

import { onBeforeUnmount, ref, type Ref } from 'vue'

export interface PhotoDragHandle {
  /** 拖动过至少一次（「恢复排布」按钮据此显隐） */
  dirty: Ref<boolean>
  /** 把每一张的偏移清零，回到原始排布 */
  reset(): void
  /** 挂监听。组件 `onMounted` 时调 —— root 那时才在 DOM 上。 */
  attach(): void
  /** 摘监听（组件卸载时自动调一次，幂等） */
  detach(): void
}

/** 判定为「拖动」的最小位移（px）—— 低于它算手抖，仍是点击。 */
const DRAG_THRESHOLD = 4
/** 拖动结束后继续吞掉点击的时长（ms）：click 在 pointerup 之后才派发 */
const CLICK_SUPPRESS_MS = 250

/**
 * 给一组照片装上「鼠标拖动」。
 *
 * @param getRoot  返回画廊容器（延迟取值 —— 调用时可能还没挂载）
 * @param itemSel  可拖动的元素选择器（相对容器）
 * @returns        句柄：`dirty`（拖过没有）/ `reset()` / `attach()` / `detach()`
 *
 * ⚠️ 触摸一律不接管（见文件头）；`attach()` 必须等 root 在 DOM 上之后再调。
 * ⚠️ 卸载时会自动 `detach()`，包括把拖动途中挂在 `window` 上的三个监听摘干净。
 */
export function usePhotoDrag(getRoot: () => HTMLElement | null, itemSel: string): PhotoDragHandle {
  const dirty = ref(false)

  /** 每张自己的位移。WeakMap 而不是 Map：照片从 DOM 上摘掉时自动释放。 */
  const offsets = new WeakMap<HTMLElement, { x: number; y: number }>()

  let el: HTMLElement | null = null
  let startX = 0
  let startY = 0
  let baseX = 0
  let baseY = 0
  let moved = false
  let suppressUntil = 0

  /**
   * 把位移写进 `transform`。
   * ⚠️ **只写 transform** —— 绝不碰 position / margin / order：布局盒原地不动，
   *    后面的照片不会被顶走，滚动高度也不变（文件头约束 ③ 的唯一正确做法）。
   */
  function apply(el: HTMLElement, x: number, y: number): void {
    el.style.transform = `translate3d(${x}px, ${y}px, 0)`
  }

  /**
   * 拖动起点。只认**鼠标左键**（触摸交给原生滚动与点击，见文件头）；
   * 命中的元素必须落在容器内的 `itemSel` 上。
   * 这里只记起点并挂 window 监听 —— 位移在 `onPointerMove` 里算。
   * 刻意不 `preventDefault`，理由见下方块注释。
   */
  function onPointerDown(e: PointerEvent): void {
    // 只认鼠标；触摸交给原生滚动与点击
    if (e.pointerType !== 'mouse' || e.button !== 0) return
    const root = getRoot()
    if (!root) return
    const target = e.target as HTMLElement | null
    const item = target?.closest<HTMLElement>(itemSel) ?? null
    if (!item || !root.contains(item)) return

    el = item
    const off = offsets.get(item) ?? { x: 0, y: 0 }
    baseX = off.x
    baseY = off.y
    startX = e.clientX
    startY = e.clientY
    moved = false

    item.classList.add('is-dragging')
    // 拖动期间在 window 上听 —— 见文件头「绝不能用 setPointerCapture」那段
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', endDrag)
    window.addEventListener('pointercancel', endDrag)
    /*
     * ⚠️ 这里**刻意不调 `e.preventDefault()`**。
     *
     *    它本来想拦的两件事都已经有别的人管：
     *      · 原生图片拖拽 → `<img draggable="false">`；
     *      · 拖拽中选中文字 → `.pg.is-draggable .pg__item { user-select: none }`。
     *
     *    而它有一个真实代价：在 `pointerdown` 上 preventDefault 会连带取消
     *    「按下即聚焦」——按钮点下去不再拿到焦点，关闭大图后焦点还回去时
     *    用户看不到焦点环。更坏的情况是某些浏览器会把它连带成「这次 click 不派发」，
     *    那就直接变成「点不开大图」。既然不需要，就不留这个风险。
     */
  }

  /**
   * 1:1 跟手（位移 = 指针位移，不加阻尼不做惯性）。
   * 首次越过 `DRAG_THRESHOLD` 才置 `dirty` —— 阈值以下算手抖，仍是一次正常点击。
   */
  function onPointerMove(e: PointerEvent): void {
    if (!el) return
    const dx = e.clientX - startX
    const dy = e.clientY - startY

    if (!moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return
    if (!moved) {
      moved = true
      dirty.value = true
    }
    apply(el, baseX + dx, baseY + dy)
  }

  /**
   * 收尾：先摘 window 上的三个监听，再按「有没有真拖动」决定是否记录位移。
   * 摘监听必须在 `if (!el) return` **之前** —— 每次 pointerdown 都会重挂，
   * 漏摘就会累积。
   * 真拖动过则把最终位移写回 `offsets`（下次再拖从这里续），并开启
   * `CLICK_SUPPRESS_MS` 的点击抑制窗口（拖完不能顺手打开查看器）。
   */
  function endDrag(): void {
    // 无论有没有拖成功，window 上的监听都要摘掉（每次 pointerdown 会重新挂）
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('pointerup', endDrag)
    window.removeEventListener('pointercancel', endDrag)

    if (!el) return
    const item = el
    el = null
    item.classList.remove('is-dragging')
    if (moved) {
      // 记下最终位移：下次再拖是从这个位置继续，不是从原点
      const t = item.style.transform.match(/translate3d\((-?[\d.]+)px,\s*(-?[\d.]+)px/)
      offsets.set(item, { x: t ? Number(t[1]) : 0, y: t ? Number(t[2]) : 0 })
      suppressUntil = Date.now() + CLICK_SUPPRESS_MS
    }
  }

  /**
   * 捕获阶段吞掉「拖完的那一次点击」。
   * ⚠️ 必须在捕获阶段：Vue 的 `@click` 是冒泡监听，等到冒泡就来不及了。
   */
  function onClickCapture(e: MouseEvent): void {
    if (Date.now() < suppressUntil) {
      e.preventDefault()
      e.stopPropagation()
    }
  }

  /**
   * 「恢复排布」：清空每一张的 transform 并丢弃记录的偏移，回到原始排布。
   * 只清 `transform`（不改布局），所以视觉上就是滑回原位那一下。
   */
  function reset(): void {
    const root = getRoot()
    if (root) {
      for (const item of Array.from(root.querySelectorAll<HTMLElement>(itemSel))) {
        item.style.transform = ''
        offsets.delete(item)
      }
    }
    dirty.value = false
  }

  let attached: HTMLElement | null = null

  /**
   * 挂监听。必须等 root 真的在 DOM 上之后再调（组件 `onMounted`）。
   * 换 root（重复调用且目标变了）会先 `detach()` 再挂，不会挂两遍。
   */
  function attach(): void {
    const root = getRoot()
    if (!root || root === attached) return
    detach()
    attached = root
    // ⚠️ 只挂 `pointerdown`：`pointermove` / `pointerup` 是**拖动开始后**
    //    才挂到 window 上的（见 `onPointerDown`）。常驻挂在 root 上不但多余，
    //    还会让「没在拖的时候每次移动都跑一遍回调」。
    root.addEventListener('pointerdown', onPointerDown)
    root.addEventListener('click', onClickCapture, true)
  }

  /**
   * 摘监听，幂等。除 root 上的两个，**还要**摘 window 上那三个 ——
   * 拖动途中被卸载时它们仍挂着，不清就会打到已销毁的组件上。
   * 由 `onBeforeUnmount` 自动调一次。
   */
  function detach(): void {
    // 拖动途中被卸载：window 上那三个也得摘，否则它们会一直留着（组件都没了）
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('pointerup', endDrag)
    window.removeEventListener('pointercancel', endDrag)
    el = null
    if (!attached) return
    attached.removeEventListener('pointerdown', onPointerDown)
    attached.removeEventListener('click', onClickCapture, true)
    attached = null
  }

  onBeforeUnmount(detach)

  return { dirty, reset, attach, detach }
}
