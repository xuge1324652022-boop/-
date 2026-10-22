import gsap from 'gsap'
import { BaseAnimation, type BoundLayer, type CardTimeline } from './卡片动画基础'
import type { CardMedia } from './卡片动画类型'

/**
 * 05 / POSTER —— Composition / Layout / Graphic Design（构成 / 版式 / 平面设计）。
 *
 * 四个深度图层，各有自己的响应幅度：
 *
 *   巨型 POSTER    46 / 30 px   最灵敏
 *   印刷印张       33 / 24 px
 *   裁切标记       22 / 15 px
 *   版式网格       16 / 12 px   最慢 —— 参考线几乎不动
 *
 * 网格**故意**滞后于其它一切。正是这个差异，让这张卡读起来像一块
 * 铺了好几层描图纸的设计板，而不是一张被整体推来推去的扁平图片。
 *
 * 说明文字块（05 / POSTER / 海报设计、01-02-03 系列，以及
 * GRAPHIC DESIGN / VISUAL STUDY / 2026 那一行）**完全不动** ——
 * 它是页面的固定边距。
 *
 * 这里没有环境循环。没有任何东西呼吸、漂移、旋转或缩放：
 * 一块静置的印刷板就是静止的。`gsap.quickTo` 就是全部机制 ——
 * 每个属性一条可复用的 tween，指针移动时不再反复创建动画，
 * 只是重新设定目标值；缓动滑行本身就是惯性。
 */
export class PosterAnimation extends BaseAnimation {
  readonly name = 'poster'

  /** 每个图层的响应参数，单位是「满偏转时卡片局部坐标的像素数」。 */
  private static readonly LAYERS = [
    { selector: '.cv-poster__type', ax: 46, ay: 30, duration: 1.0 },
    { selector: '.cv-poster__plate', ax: 33, ay: 24, duration: 1.12 },
    { selector: '.cv-poster__marks', ax: 22, ay: 15, duration: 1.24 },
    { selector: '.cv-poster__grid', ax: 16, ay: 12, duration: 1.38 },
  ] as const

  private layers: BoundLayer[] = []
  private active = true
  private onMove: ((e: PointerEvent) => void) | null = null
  private onLeave: (() => void) | null = null

  /** 入场（显影）动画在 0.1s 后开始 */
  protected introDelay(): number {
    return 0.1
  }

  /** 没有环境循环 —— 网格不呼吸、印张不漂移、不自动对齐。 */
  protected build(_tl: CardTimeline, _host: HTMLElement): void {}

  /**
   * 一次性显影动画，在章节打开时播放：先浮出参考线，再是印张，
   * 然后是巨型字，最后说明文字。
   *
   * **只改透明度，不动位置** —— 这是在灯下显影的板子，不是飞进来的海报。
   * ⚠️ `immediateRender: false` 很关键 —— 没有它，"from" 状态会在时间线
   * 构建的那一刻就被应用，导致卡片在画廊里一直空白，直到有人打开它。
   */
  protected buildIntro(tl: CardTimeline, host: HTMLElement): void {
    const grid = host.querySelector<HTMLElement>('.cv-poster__grid')
    const plate = host.querySelector<HTMLElement>('.cv-poster__plate')
    const type = host.querySelector<HTMLElement>('.cv-poster__type')
    const marks = host.querySelector<HTMLElement>('.cv-poster__marks')
    const captions = host.querySelectorAll<HTMLElement>(
      '.cv-poster__info > *, .cv-poster__series > *, .cv-poster__meta > *',
    )

    // 参考网格：只到 0.12 的极低透明度，是"衬底"而不是主角
    if (grid) {
      tl.fromTo(
        grid,
        { opacity: 0 },
        { opacity: 0.12, duration: 0.5, ease: 'sine.out', immediateRender: false },
        0,
      )
    }
    if (plate) {
      tl.fromTo(
        plate,
        { opacity: 0 },
        { opacity: 1, duration: 0.6, ease: 'sine.out', immediateRender: false },
        0.18,
      )
    }
    if (marks) {
      tl.fromTo(
        marks,
        { opacity: 0 },
        { opacity: 1, duration: 0.5, ease: 'sine.out', immediateRender: false },
        0.3,
      )
    }
    if (type) {
      tl.fromTo(
        type,
        { opacity: 0 },
        { opacity: 1, duration: 0.6, ease: 'sine.out', immediateRender: false },
        0.36,
      )
    }
    if (captions.length) {
      tl.fromTo(
        captions,
        { opacity: 0 },
        {
          opacity: 1,
          duration: 0.4,
          ease: 'sine.out',
          stagger: 0.03,
          immediateRender: false,
        },
        0.5,
      )
    }
  }

  /**
   * 为四个图层各建一组 `quickTo` 设置器，并注册指针监听。
   * 先调 `super.mount()`：杀掉旧时间线、建（本例为空的）环境循环 + 显影入场。
   */
  mount(host: HTMLElement): void {
    super.mount(host)
    // 为四个图层各建一组 quickTo 设置器。幅度与设置器绑在同一个对象上 ——
    // 少一层（selector 没匹配上）也不会让后面的层用错幅度。
    this.layers = []
    for (const l of PosterAnimation.LAYERS) {
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

  /** 成对摘掉两个全局监听并清空图层引用，最后交给基类杀时间线。 */
  destroy(): void {
    if (this.onMove) window.removeEventListener('pointermove', this.onMove)
    if (this.onLeave) document.removeEventListener('pointerleave', this.onLeave)
    this.onMove = null
    this.onLeave = null
    this.layers = []
    super.destroy()
  }

  /**
   * 把排版占位图换成真实作品。**只有印张会变** —— 构图、参考线和动效
   * 一概不动，所以日后换成真实海报时，永远不需要碰动效代码。
   */
  setMedia(media: CardMedia): void {
    const plate = this.q('.cv-poster__plate')
    const art = this.q('.cv-poster__art')
    if (!plate) return
    if (media.type === 'image' && media.src) {
      plate.style.backgroundImage = `url("${media.src}")`
      plate.style.backgroundSize = 'cover'
      plate.style.backgroundPosition = 'center'
      // 有真实作品时，把排版占位层藏掉
      if (art) art.style.opacity = '0'
    }
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
