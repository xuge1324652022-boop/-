// 所有卡片内容动画共享的契约。
//
// 铁律：一个动画只允许触碰它自己宿主节点**内部**的元素，
// 绝不能去写 .card-position / .card-plane —— 那两者的 transform 归
// galleryMotion.ts 独占。正是这条约束让「内容动效」与「卡片在 3D 空间中的
// 摆放」彻底解耦；一旦违反，卡片会在转场过程中抖动或错位。

export type CardMediaType = 'image' | 'video' | 'none'

export interface CardMedia {
  type: CardMediaType
  src?: string
  poster?: string
  alt?: string
  /**
   * 换掉第几个素材位（默认 0）。一张卡可能有多个素材位（例如 COLOR 有
   * 六片调色画面），逐位替换才能真正做到「换素材不动构图」。
   */
  index?: number
}

export interface CardAnimation {
  /** 稳定 id，与章节 key 一一对应（about / edit / color / ...）。 */
  readonly name: string
  /** 基于 `host` 中已存在的元素构建 GSAP 时间线。 */
  mount(host: HTMLElement): void
  play(): void
  pause(): void
  reset(): void
  /** 重放一次性的入场动画（本身没有入场动画的卡片则为空实现）。 */
  restart(): void
  /**
   * 这张卡当前是否是屏幕上那一张。只有主动接入的卡片才会用到它 ——
   * 例如 ABOUT 会在别的章节打开时停止响应指针，而不是在自己不可见时
   * 还继续做环境漂移。
   */
  setActive(active: boolean): void
  destroy(): void
  /** 之后可用真实作品替换占位图，无需改动任何动效代码。 */
  setMedia(media: CardMedia): void
}
