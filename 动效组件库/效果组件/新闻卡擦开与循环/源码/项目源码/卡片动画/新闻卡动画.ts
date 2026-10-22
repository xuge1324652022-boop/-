import gsap from 'gsap'
import { BaseAnimation, type BoundLayer, type CardTimeline } from './卡片动画基础'

/**
 * 04 / NEWS —— Information / Broadcast / Headline（信息 / 播报 / 头条）。
 *
 * 四个深度图层，各有自己的响应幅度：
 *
 *   巨型 NEWS     40 / 30 px   最前，最灵敏
 *   视频框        30 / 22 px
 *   头条          23 / 14 px
 *   LIVE          15 / 10 px   最后，最克制
 *
 * 静态信息（04 / NEWS / 新闻影像 / 日期线）**完全不动** ——
 * 它是承载整套播报元素的固定网格。
 *
 * 只有两样东西会自己动，因为那才是「直播」的含义：跑马灯以恒定速率爬行，
 * 直播中的圆点在呼吸。其余一切在指针触碰之前都是死寂的。
 * 没有故障效果、没有 RGB 分离、没有扫描线扫过 ——
 * 这是一张编辑部风格的播报卡，不是赛博朋克风。
 *
 * 指针只做位移。不旋转、不缩放，巨型字也不随位置改变字重或颜色。
 */
export class NewsAnimation extends BaseAnimation {
  readonly name = 'news'

  /** 每个图层的响应参数，单位是「满偏转时卡片局部坐标的像素数」。 */
  private static readonly LAYERS = [
    { selector: '.cv-news__type', ax: 40, ay: 30, duration: 1.0 },
    { selector: '.cv-news__frames', ax: 30, ay: 22, duration: 1.12 },
    { selector: '.cv-news__headline', ax: 23, ay: 14, duration: 1.24 },
    { selector: '.cv-news__live', ax: 15, ay: 10, duration: 1.36 },
  ] as const

  /** 跑马灯爬行速率，px/s。恒定值，因此任何尺寸下观感一致。 */
  private static readonly SPEED = 30

  private layers: BoundLayer[] = []
  private active = true
  private onMove: ((e: PointerEvent) => void) | null = null
  private onLeave: (() => void) | null = null
  /** 跑马灯的半宽 —— 也就是循环周期。每次变化时重新测量。 */
  private half = 160
  private ro: ResizeObserver | null = null

  /** 入场动画在 0.15s 后开始 */
  protected introDelay(): number {
    return 0.15
  }

  /**
   * 环境循环 —— **只有**爬行和直播圆点。其它任何东西都不呼吸、不漂移、
   * 不脉动：一间静止的新闻编辑室是不会动的。
   */
  protected build(tl: CardTimeline, host: HTMLElement): void {
    const track = host.querySelector<HTMLElement>('.cv-news__ticker-track')
    if (track) {
      // 卡片可能在完成布局之前就被构建（remount 拿到的 host 宽度还是 0），
      // 所以周期不能「测一次就写死进 duration」—— 那会悄悄改变爬行速率。
      // 这里的做法是：让 tween 跑一个极长的线性距离，再用 modifier 把它
      // 折叠回一个周期内。这样任何宽度下速率都精确，
      // 且 resize 会在下一帧自动生效。
      const measure = () => {
        this.half = Math.max(160, track.scrollWidth / 2)
      }
      measure()
      if (typeof ResizeObserver !== 'undefined') {
        this.ro = new ResizeObserver(measure)
        this.ro.observe(track)
      }
      tl.fromTo(
        track,
        { x: 0 },
        {
          x: -1e6,
          duration: 1e6 / NewsAnimation.SPEED,
          ease: 'none',
          modifiers: { x: (v: string) => `${parseFloat(v) % this.half}px` },
        },
        0,
      )
    }

    // 直播圆点的呼吸
    const dot = host.querySelector<HTMLElement>('.cv-news__live-dot')
    if (dot) {
      tl.to(dot, { opacity: 0.65, duration: 0.95, ease: 'sine.inOut', yoyo: true, repeat: -1 }, 0)
    }
  }

  /**
   * 一次性入场动画，在章节被打开时播放：视频框向上擦除、头条横条横向擦开、
   * LIVE 亮起，最后静态说明文字落位。
   *
   * ⚠️ `immediateRender: false` 很关键 —— 没有它，"from" 状态会在时间线
   * 构建的那一刻就被应用，导致卡片在画廊里一直空白，直到有人打开它。
   */
  protected buildIntro(tl: CardTimeline, host: HTMLElement): void {
    const frame = host.querySelector<HTMLElement>('.cv-news__frame')
    const bar = host.querySelector<HTMLElement>('.cv-news__headline-bar')
    const line = host.querySelector<HTMLElement>('.cv-news__headline-text')
    const live = host.querySelector<HTMLElement>('.cv-news__live')

    // 视频框：自下而上擦除
    if (frame) {
      tl.fromTo(
        frame,
        { clipPath: 'inset(0% 0% 100% 0%)' },
        {
          clipPath: 'inset(0% 0% 0% 0%)',
          duration: 0.95,
          ease: 'power3.out',
          immediateRender: false,
        },
        0,
      )
    }
    // 头条横条：横向擦开
    if (bar) {
      tl.fromTo(
        bar,
        { clipPath: 'inset(0% 100% 0% 0%)' },
        {
          clipPath: 'inset(0% 0% 0% 0%)',
          duration: 0.6,
          ease: 'power2.out',
          immediateRender: false,
        },
        0.42,
      )
    }
    // 头条文字：轻微上浮
    if (line) {
      tl.fromTo(
        line,
        { y: 10, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.55, ease: 'power2.out', immediateRender: false },
        0.52,
      )
    }
    if (live) {
      // 只改 opacity：这个元素上的 `y` 归指针视差所有，
      // 两个写入方抢同一个 transform 会在擦除过程中打架
      tl.fromTo(
        live,
        { opacity: 0 },
        { opacity: 1, duration: 0.5, ease: 'power2.out', immediateRender: false },
        0.72,
      )
    }

    // 静态说明文字错峰落位
    const captions = host.querySelectorAll<HTMLElement>(
      '.cv-news__info > *, .cv-news__dateline > *',
    )
    if (captions.length) {
      tl.fromTo(
        captions,
        { y: 8, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.5,
          ease: 'power2.out',
          stagger: 0.06,
          immediateRender: false,
        },
        0.86,
      )
    }
  }

  /**
   * 为四个图层各建一组 `quickTo` 设置器，注册指针监听，并起一个
   * ResizeObserver 跟踪跑马灯半宽（周期随宽度变，不能测一次写死）。
   * 先调 `super.mount()`：杀掉旧时间线、建环境循环与入场。
   */
  mount(host: HTMLElement): void {
    super.mount(host)
    // 为四个图层各建一组 quickTo 设置器。幅度与设置器绑在同一个对象上 ——
    // 少一层（selector 没匹配上）也不会让后面的层用错幅度。
    this.layers = []
    for (const l of NewsAnimation.LAYERS) {
      const el = host.querySelector<HTMLElement>(l.selector)
      if (!el) continue
      this.layers.push({
        ax: l.ax,
        ay: l.ay,
        sx: gsap.quickTo(el, 'x', { duration: l.duration, ease: 'power3.out' }),
        sy: gsap.quickTo(el, 'y', { duration: l.duration, ease: 'power3.out' }),
      })
    }

    this.onMove = (e: PointerEvent) => this.apply(e.clientX, e.clientY)
    this.onLeave = () => this.toBase()
    // passive: 只读坐标，绝不拦截画廊自己的拖拽转环逻辑。
    // 开启「减少动态效果」时**完全跳过注册**：一张跟随鼠标的卡本身仍在运动，
    // 让构图就停在被设计好的位置上才对。
    if (!this.reduced()) {
      window.addEventListener('pointermove', this.onMove, { passive: true })
      document.addEventListener('pointerleave', this.onLeave)
    }
  }

  /** 只在自己被聚焦时响应指针；失焦时滑回基线，而不是冻结在偏移上。 */
  setActive(active: boolean): void {
    if (this.active === active) return
    this.active = active
    // 离开章节时是滑回原位，而不是冻结在某个偏移上
    if (!active) this.toBase()
  }

  /**
   * 断开 ResizeObserver、成对摘掉两个全局监听并清空图层引用，
   * 最后交给基类杀时间线。ResizeObserver 必须先 disconnect，
   * 否则 host 被移除后回调仍会打到已失效的节点上。
   */
  destroy(): void {
    this.ro?.disconnect()
    this.ro = null
    if (this.onMove) window.removeEventListener('pointermove', this.onMove)
    if (this.onLeave) document.removeEventListener('pointerleave', this.onLeave)
    this.onMove = null
    this.onLeave = null
    this.layers = []
    super.destroy()
  }

  private apply(clientX: number, clientY: number): void {
    if (!this.active) return
    const w = window.innerWidth || 1
    const h = window.innerHeight || 1
    // 把屏幕坐标归一化到 [-1, 1]
    const nx = Math.max(-1, Math.min(1, (clientX / w) * 2 - 1))
    const ny = Math.max(-1, Math.min(1, (clientY / h) * 2 - 1))
    for (const l of this.layers) {
      l.sx(nx * l.ax)
      l.sy(ny * l.ay)
    }
  }

  /** 指针移出窗口（或章节关闭）：漂回基线。 */
  private toBase(): void {
    for (const l of this.layers) {
      l.sx(0)
      l.sy(0)
    }
  }
}
