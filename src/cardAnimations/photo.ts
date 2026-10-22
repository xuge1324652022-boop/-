import gsap from 'gsap'
import { BaseAnimation, type BoundLayer, type CardTimeline } from './base'
import type { CardMedia } from './types'

/**
 * 06 / PHOTO —— Frame / Light / Moment（取景 / 光线 / 瞬间）。
 *
 * 这是六张卡里最安静的一张，而这正是重点所在。四个深度图层，
 * 每一层的响应幅度都**刻意做得很小**：
 *
 *   照片        30 / 22 px   最灵敏 —— 但仍不到 POSTER 巨型字行程的一半
 *   卡纸框      22 / 15 px
 *   PHOTO      15 / 10 px
 *   元数据       8 /  6 px   标注几乎完全不动
 *
 * 层与层之间的落差小是有意为之。PHOTO 不是视差展示台：
 * 这些图层应该读起来像**同一张相片**浮在卡纸前方几厘米处，
 * 而不是四个各自独立的平面。
 *
 * 这里没有环境循环 —— 不漂浮、不呼吸光圈、不自动旋转、不轮播。
 * 暗房里的一张照片就是静止的。`gsap.quickTo` 就是全部机制，
 * 而且它的 duration 是六张卡里最长的，好让滑行比别处都落得更慢。
 *
 * 聚焦时跑的显影动画，模仿照片在显影盘里渐渐浮现的过程：
 * 卡纸先以淡淡的轮廓出现，照片随之到来，卡纸变亮（像是镜头刚刚合焦），
 * 最后说明文字落位。**只改透明度** —— 没有东西飞进来，也没有东西缩放。
 */
export class PhotoAnimation extends BaseAnimation {
  readonly name = 'photo'

  /** 每个图层的响应参数，单位是「满偏转时卡片局部坐标的像素数」。 */
  private static readonly LAYERS = [
    { selector: '.cv-photo__image', ax: 30, ay: 22, duration: 1.15 },
    { selector: '.cv-photo__frame', ax: 22, ay: 15, duration: 1.25 },
    { selector: '.cv-photo__type', ax: 15, ay: 10, duration: 1.35 },
    { selector: '.cv-photo__meta', ax: 8, ay: 6, duration: 1.45 },
  ] as const

  private layers: BoundLayer[] = []
  private active = true
  private onMove: ((e: PointerEvent) => void) | null = null
  private onLeave: (() => void) | null = null

  /** 入场（显影）动画在 0.08s 后开始 */
  protected introDelay(): number {
    return 0.08
  }

  /** 没有环境循环 —— 不呼吸的光圈、不漂移的照片、不轮播。 */
  protected build(_tl: CardTimeline, _host: HTMLElement): void {}

  /**
   * 一次性显影动画，在章节打开时播放：
   *
   *   0ms    卡纸框    0 → 0.22   一道淡淡的轮廓，像未点亮的边框
   *   200ms  照片      0 → 1      相片浮现
   *   400ms  卡纸框    0.22 → 0.8 边框合焦
   *   500ms  PHOTO     0 → 1
   *   580ms  元数据 + 光 + 说明文字，错峰出现
   *   720ms  卡纸框    0.8 → 0.6  回落定住
   *
   * 全程约 1.0s。⚠️ `immediateRender: false` 很关键 —— 没有它，
   * "from" 状态会在时间线构建的那一刻就被应用，导致卡片在画廊里
   * 一直空白，直到有人打开它。
   */
  protected buildIntro(tl: CardTimeline, host: HTMLElement): void {
    const frame = host.querySelector<HTMLElement>('.cv-photo__frame-box')
    const plate = host.querySelector<HTMLElement>('.cv-photo__plate')
    const type = host.querySelector<HTMLElement>('.cv-photo__type')
    const tails = host.querySelectorAll<HTMLElement>(
      '.cv-photo__meta > *, .cv-photo__light, .cv-photo__info, .cv-photo__note',
    )

    // 卡纸框三段式：淡轮廓 → 合焦变亮 → 回落定住
    if (frame) {
      tl.fromTo(
        frame,
        { opacity: 0 },
        { opacity: 0.22, duration: 0.25, ease: 'sine.out', immediateRender: false },
        0,
      )
      tl.fromTo(
        frame,
        { opacity: 0.22 },
        { opacity: 0.8, duration: 0.32, ease: 'sine.out', immediateRender: false },
        0.4,
      )
      tl.fromTo(
        frame,
        { opacity: 0.8 },
        { opacity: 0.6, duration: 0.26, ease: 'sine.inOut', immediateRender: false },
        0.72,
      )
    }
    // 照片主体浮现
    if (plate) {
      tl.fromTo(
        plate,
        { opacity: 0 },
        { opacity: 1, duration: 0.5, ease: 'sine.out', immediateRender: false },
        0.2,
      )
    }
    if (type) {
      tl.fromTo(
        type,
        { opacity: 0 },
        { opacity: 1, duration: 0.35, ease: 'sine.out', immediateRender: false },
        0.5,
      )
    }
    // 尾部信息错峰落位
    if (tails.length) {
      tl.fromTo(
        tails,
        { opacity: 0 },
        {
          opacity: 1,
          duration: 0.28,
          ease: 'sine.out',
          stagger: 0.025,
          immediateRender: false,
        },
        0.58,
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
    for (const l of PhotoAnimation.LAYERS) {
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
   * 把真实照片放进相纸。**只有印相板会变** —— 卡纸、光线、说明文字
   * 和动效一概不动，所以日后换成真实照片时，永远不需要碰动效代码。
   */
  setMedia(media: CardMedia): void {
    const plate = this.q('.cv-photo__plate')
    const label = this.q('.cv-photo__plate-label')
    if (!plate) return
    if (media.type === 'image' && media.src) {
      plate.style.backgroundImage = `url("${media.src}")`
      plate.style.backgroundSize = 'cover'
      plate.style.backgroundPosition = 'center'
      // 有真实照片时，把占位标签藏掉
      if (label) label.style.opacity = '0'
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
