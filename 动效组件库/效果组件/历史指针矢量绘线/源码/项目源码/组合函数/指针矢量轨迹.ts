/**
 * 鼠标轨迹绘线 —— 「鼠标即笔尖」。
 *
 * 鼠标划过哪里，线就画到哪里；画 S 得 S，画圆得圆。
 *
 * ⚠️ 它和**上一代「整条曲线平移」**是两回事，别混：
 *    旧做法是把一条**固定形状**的开场曲线整体 translate 一段距离，
 *    所以鼠标怎么动都还是那条线，只是挪了个位置（画 S 不可能得到 S）。
 *    这里反过来 —— 每一帧用**鼠标历史坐标**重新生成 `d`，
 *    线的形状就是鼠标走过的形状。
 *
 * 三条不可省的机制（少任何一条都会出可见的毛病）：
 *  ① `getCoalescedEvents()` —— 快速画圈时浏览器会把一帧内的多个移动**合并**成
 *     一个 pointermove，只取 `event` 的话圆会被削成多边形。取合并前的采样点，
 *     快速手势才保留得住轨迹。
 *  ② 笔尖用 `head`（最新坐标）而不是「最后一个采样点」—— 采样点按 `STEP`
 *     间隔存，直接用最后一个点会让线头**永远慢半拍**、拖在指针后面。
 *  ③ `breakNext` —— 指针离开区域再回来（或第一笔落下）时必须**另起一笔**
 *     （`M` 新起一段），否则会从离开点直接拉一条长直线横穿画面。
 */

/** 轨迹上的一个采样点。`move = true` 表示「另起一笔」，不与上一点连线。 */
type TrailPoint = {
  x: number
  y: number
  time: number
  move: boolean
}

/**
 * 把采样点串成 SVG 路径：相邻点取中点当二次贝塞尔的锚，用 `Q` 平滑连接。
 *
 * ⚠️ 为什么不用 `L` 直连：鼠标采样是折线，直连在快速划动时是一串可见的硬折角。
 *    用「当前点当控制点、中点当端点」的写法是折线的标准圆滑法 —— 曲线**穿过
 *    每个中点**，笔尖再用 `L` 接到真实的最后一个点（保证线头落在指针上）。
 */
function pointsToPath(points: TrailPoint[]): string {
  const strokes: TrailPoint[][] = []

  for (const point of points) {
    if (!strokes.length || point.move) strokes.push([])
    strokes[strokes.length - 1].push(point)
  }

  return strokes
    .map((stroke) => {
      const first = stroke[0]
      let d = `M ${first.x} ${first.y}`

      for (let i = 1; i < stroke.length - 1; i++) {
        const current = stroke[i]
        const next = stroke[i + 1]
        d += ` Q ${current.x} ${current.y} ${(current.x + next.x) / 2} ${(current.y + next.y) / 2}`
      }

      const last = stroke[stroke.length - 1]
      // 笔尖必须落在**最新坐标**上：末段用 L 直接收口，不用中点
      return d + ` L ${last.x} ${last.y}`
    })
    .join(' ')
}

/**
 * 建一条「指针绘线」。
 *
 * @param host 坐标基准元素（紫色首屏）。轨迹的坐标以它为准，也是「离开区域」的判据。
 * @param svg  绘线层（`inset: 0` 覆盖 host，viewBox 与 host 同尺寸）。
 * @param path 被反复改写 `d` 的那条 `<path>`。
 * @param onDraw 第一笔落下时调一次（宿主据此淡出开场曲线）。
 * @param onRest 轨迹彻底消退、回到静止时调一次（宿主据此淡回开场曲线）。
 */
export function createPointerTrail(
  host: HTMLElement,
  svg: SVGSVGElement,
  path: SVGPathElement,
  onDraw: () => void,
  onRest: () => void,
) {
  /** 最多保留最近 1.4 秒 —— 「尾巴自然退去」靠的是按时间淘汰旧点 */
  const LIFE = 1400
  /** 停止后的末段淡出时长 */
  const FADE = 250
  /** 每移动约 3px 才留一个采样点：太密会白算路径，太疏会丢细节 */
  const STEP = 3
  /** 点数上限：1.4s 内即使疯狂划动也不会无限堆积（内存 / 路径复杂度双保险） */
  const MAX_POINTS = 360

  /** 入场演完前不采集（见宿主：时间轴 onComplete 才 enable(true)） */
  let enabled = false
  /** 是否处于「一笔进行中」—— 用来保证 onDraw / onRest 各只调一次 */
  let drawing = false
  /** 下一个采样点是否另起一笔（初始为 true：第一笔必须自成一段） */
  let breakNext = true
  let points: TrailPoint[] = []
  /** 笔尖（最新坐标）。它不进 `points` 数组，只用于把线头钉在指针上 */
  let head: TrailPoint | null = null
  let raf = 0

  const abort = new AbortController()

  /**
   * 每帧重算路径。
   * ⚠️ 只有这一处改 `d` —— 「一个属性一个写入者」。
   */
  function frame(now: number) {
    raf = 0

    // 按时间淘汰：这就是「尾部逐渐退去」的全部实现（不需要逐点做 alpha）
    points = points.filter((p) => now - p.time < LIFE)
    if (head && now - head.time >= LIFE) head = null

    const visible = points.slice()
    // 笔尖不受 STEP 间隔限制：永远补上最新坐标
    if (head && visible[visible.length - 1] !== head) visible.push(head)

    if (!visible.length) {
      path.setAttribute('d', '')
      if (drawing) {
        drawing = false
        breakNext = true
        onRest()
      }
      return
    }

    const newest = visible[visible.length - 1]
    path.setAttribute('d', pointsToPath(visible))
    /*
     * 整条轨迹共用一个 opacity：
     *   正在画 → 最新点就是「现在」，比值 > 1 ⇒ 恒为 1（不闪）；
     *   停下后 → 过 FADE 才开始淡，到 LIFE 时正好淡完并被上面淘汰掉。
     */
    path.style.opacity = String(Math.max(0, Math.min(1, (LIFE - (now - newest.time)) / FADE)))

    raf = requestAnimationFrame(frame)
  }

  /**
   * 指针移动：把这一帧的所有采样点接到轨迹末尾。
   * ⚠️ 用 `getCoalescedEvents()` 取**合并前**的点：快速画圈时浏览器会把一帧内的
   *    多次移动合并成一条事件，只用 `event` 会丢点，画出来的圆是断的。
   */
  function onPointerMove(event: PointerEvent) {
    if (!enabled || event.pointerType === 'touch') return

    const rect = host.getBoundingClientRect()
    if (!rect.width || !rect.height) return

    // ① 取合并前的采样点，快速画圈才保留得住轨迹
    const coalesced = event.getCoalescedEvents?.() ?? []
    const samples = coalesced.length ? coalesced : [event]
    const now = performance.now()

    for (const sample of samples) {
      const inside =
        sample.clientX >= rect.left &&
        sample.clientX <= rect.right &&
        sample.clientY >= rect.top &&
        sample.clientY <= rect.bottom

      // ③ 出区域就断笔：再进来必须另起一笔，不能横穿画面连一条长直线
      if (!inside) {
        breakNext = true
        continue
      }

      if (!drawing) {
        drawing = true
        onDraw()
      }

      const point: TrailPoint = {
        x: ((sample.clientX - rect.left) * host.clientWidth) / rect.width,
        y: ((sample.clientY - rect.top) * host.clientHeight) / rect.height,
        time: now,
        move: breakNext,
      }

      const previous = points[points.length - 1]
      if (
        breakNext ||
        !previous ||
        Math.hypot(point.x - previous.x, point.y - previous.y) >= STEP
      ) {
        points.push(point)
      }

      // ② 笔尖永远取最新坐标，不受 STEP 限制
      head = point
      breakNext = false
    }

    if (points.length > MAX_POINTS) points.splice(0, points.length - MAX_POINTS)
    if (!raf && head) raf = requestAnimationFrame(frame)
  }

  /** 清空并回到静止态（尺寸变化 / 滚动 / 失焦 / 禁用都走这里） */
  function reset() {
    cancelAnimationFrame(raf)
    raf = 0
    points = []
    head = null
    breakNext = true
    path.setAttribute('d', '')
    path.style.opacity = '1'

    if (drawing) {
      drawing = false
      onRest()
    }
  }

  /*
   * 尺寸变化：viewBox 要跟着 host 走（1 用户单位 = 1px），否则描边与坐标全歪。
   * 旧轨迹按旧尺寸算的，一并作废。
   */
  const resize = new ResizeObserver(() => {
    svg.setAttribute('viewBox', `0 0 ${host.clientWidth} ${host.clientHeight}`)
    reset()
  })
  resize.observe(host)

  /*
   * ⚠️ 监听挂在 window 而不是 host：坐标仍以 host 为准（里面自己判 in/out）。
   *    挂 host 的话，指针移出区域的那一刻收不到事件，轨迹会停在最后一次
   *    「区域内」的位置 —— 而我们要的是「出区域即断笔」。
   */
  const options = { passive: true, signal: abort.signal }
  window.addEventListener('pointermove', onPointerMove, options)
  /*
   * ⚠️ 「出区域断笔」是**双保险**，两条都在：
   *    ① 这里的 pointerleave（指针离开 host 的那一刻）；
   *    ② 下面 `onPointerMove` 里的 in/out 判定（采样点落在 host 之外）。
   *    证伪实测：只打断其中一条，C 段照样通过；**两条一起**打断才会红
   *    （两笔被连成一笔）。所以别以为哪一条是多余的。
   */
  host.addEventListener(
    'pointerleave',
    () => {
      breakNext = true
    },
    options,
  )
  window.addEventListener('blur', reset, options)
  /*
   * 滚动会让 host 相对视口移动，而轨迹是**host 局部坐标**画的 ——
   * 不重算就整体错位，所以直接作废重来。
   */
  window.addEventListener('scroll', reset, { ...options, capture: true })

  return {
    /** 开/关采集。关掉时会立刻 `reset()` 抹掉已有轨迹，不留半条线在屏幕上。 */
    enable(value: boolean) {
      enabled = value
      if (!value) reset()
    },
    /** 彻底拆除：停掉所有监听、断开 ResizeObserver、清空 path 的 `d`。 */
    destroy() {
      abort.abort()
      resize.disconnect()
      cancelAnimationFrame(raf)
      raf = 0
      path.setAttribute('d', '')
    },
  }
}
