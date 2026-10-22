import gsap from 'gsap'

/**
 * 01 / ABOUT —— 首页画廊「关于我」卡片内部的指针视差。
 *
 * 三层按深度给不同的**幅度**和不同的**阻尼时长**：
 * 远处（巨型 ABOUT）幅度小、跟得慢；近处（文字信息）幅度大、跟得快。
 * 幅度差负责「前后」，时长差负责「重量」—— 两者叠加才有空间感，
 * 只差幅度会像整体平移，只差时长会像各自抖动。
 *
 * 阻尼用 `gsap.quickTo`（项目已有 gsap，不引入新依赖）：它内部是补间，
 * 天然带阻尼；缓动一律 `power3.out` —— 出发快、收尾稳。
 * **不用** bounce / elastic / back：那些缓动会回弹，把「空间」变成「弹窗」。
 *
 * 只写 x / y。**不写** scale / rotate / opacity：
 * 它们属于静止构图（见 aboutExperience.css），指针无权改动。
 */

interface LayerSpec {
  selector: string
  /** 满偏转时该层沿 X 轴的位移（px） */
  ax: number
  /** 满偏转时该层沿 Y 轴的位移（px） */
  ay: number
  /** 阻尼时长（s）—— 越大越「重」 */
  duration: number
}

/**
 * 三层参数，由远及近。改这里就能整体调空间深度，
 * 不要在别处散落魔法数字。
 */
const LAYERS: readonly LayerSpec[] = [
  // 远：巨型 ABOUT。它已经是主导尺度了，再让它大幅移动会喧宾夺主
  { selector: '.about-exp__type', ax: 16, ay: 11, duration: 1.7 },
  // 中：DEMO 几何图形
  { selector: '.about-exp__logo', ax: 34, ay: 24, duration: 1.3 },
  // 近：文字信息。位移最大，读起来像贴在镜头前
  { selector: '.about-exp__info', ax: 52, ay: 36, duration: 1.0 },
]

/**
 * 一个已绑定 quickTo 的视差图层 —— 幅度与设置器在**同一个对象**里。
 *
 * ⚠️ 不能拆成「setters 数组 + LAYERS 数组按下标对齐」：下面构建时找不到
 *    selector 就 `continue`，setters 会短一截，之后每一层都用错幅度，
 *    而且不报错。绑在一起，少一层也只是少一层。
 */
interface BoundLayer {
  ax: number
  ay: number
  sx: (v: number) => void
  sy: (v: number) => void
}

export interface AboutExperienceHandle {
  /** 卸载所有监听。组件卸载时必须调用。 */
  destroy(): void
}

/** 当前是否开启了「减少动态效果」——决定要不要注册指针监听 */
function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * 给 host 子树挂上视差。
 *
 * host 是 `.about-exp`：所有位移都写在这棵子树里的三个层上，
 * 绝不碰 host 之外的节点 —— 卡片在 3D 空间里的位置由 galleryMotion 独占。
 */
export function createAboutExperience(host: HTMLElement): AboutExperienceHandle {
  const layers: BoundLayer[] = []

  for (const spec of LAYERS) {
    const el = host.querySelector<HTMLElement>(spec.selector)
    if (!el) continue
    layers.push({
      ax: spec.ax,
      ay: spec.ay,
      sx: gsap.quickTo(el, 'x', { duration: spec.duration, ease: 'power3.out' }),
      sy: gsap.quickTo(el, 'y', { duration: spec.duration, ease: 'power3.out' }),
    })
  }

  // 一次 pointermove 的全部工作量：两次除法 + 每层两次 quickTo
  function apply(clientX: number, clientY: number): void {
    const w = window.innerWidth || 1
    const h = window.innerHeight || 1
    const nx = Math.max(-1, Math.min(1, (clientX / w) * 2 - 1))
    const ny = Math.max(-1, Math.min(1, (clientY / h) * 2 - 1))
    for (const l of layers) {
      l.sx(nx * l.ax)
      l.sy(ny * l.ay)
    }
  }

  /** 指针移出窗口：漂回基线，而不是僵在最后一个偏移上 */
  function toBase(): void {
    for (const l of layers) {
      l.sx(0)
      l.sy(0)
    }
  }

  /** 指针移动：把视口坐标交给 `apply`（归一化 + 按层权重分摊都在里面） */
  const onMove = (e: PointerEvent) => apply(e.clientX, e.clientY)

  /*
   * 开启「减少动态效果」时完全不注册监听：一张跟随鼠标的卡本身仍在运动，
   * 让构图停在被设计好的位置上才对。passive: 只读坐标，绝不拦截画廊
   * 自己的拖拽转环逻辑。
   */
  if (!prefersReducedMotion()) {
    window.addEventListener('pointermove', onMove, { passive: true })
    document.addEventListener('pointerleave', toBase)
  }

  return {
    /** 摘掉两个全局监听并清空图层引用。组件卸载时必须调用（幂等）。 */
    destroy() {
      window.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerleave', toBase)
      layers.length = 0
    },
  }
}
