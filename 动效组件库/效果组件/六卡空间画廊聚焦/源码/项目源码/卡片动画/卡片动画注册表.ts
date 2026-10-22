import type { CardAnimation } from './卡片动画类型'
import { AboutAnimation } from './关于我卡动画'
import { EditAnimation } from './剪辑卡动画'
import { ColorAnimation } from './调色卡动画'
import { NewsAnimation } from './新闻卡动画'
import { PosterAnimation } from './海报卡动画'
import { PhotoAnimation } from './摄影卡动画'
import { CHAPTERS } from '../数据/作品章节资料'

/**
 * 每张卡片一个条目，顺序与 ThreeHome 的 chapters 数组保持一致。
 *
 * 相位偏移走 CHAPTERS.delay（构造器参数），参见 BaseAnimation —— 它
 * 错开每个循环首次启动的时机，使六张卡永远不会齐刷刷地一起「呼吸」。
 * 各卡的循环周期长度也互不相同，这会让它们随时间推移越飘越开。
 */
interface CardAnimationEntry {
  readonly name: string
  /** 造一个**新实例**（每次调用都 new），实例互不共享时间线。 */
  create(): CardAnimation
}

// key → 类的查找表。注册表不再写硬编码 class 引用，全靠 CHAPTERS 单一来源。
// 若要调整卡片顺序，只改 CHAPTERS 与 ThreeHome 的 chapters 读取路径即可，
// 这里不会出现「动画类张冠李戴」。
const ANIMATION_CLASSES = {
  about:  AboutAnimation,
  edit:   EditAnimation,
  color:  ColorAnimation,
  news:   NewsAnimation,
  poster: PosterAnimation,
  photo:  PhotoAnimation,
} as const

/**
 * 对外暴露的注册表：顺序、名字、延迟全部由 `CHAPTERS` 推导，类映射只按稳定 key 关联。
 * 索引即卡片下标 —— `createCardAnimation(index)` 与 `ThreeHome` 的章节下标一一对应。
 */
export const CARD_ANIMATION_REGISTRY: readonly CardAnimationEntry[] = CHAPTERS.map((chapter) => ({
  name: chapter.key,
  create: () => new ANIMATION_CLASSES[chapter.key](chapter.delay),
}))

/**
 * 按下标创建对应的卡片动画。
 * @returns 下标越界时返回 null，调用方需自行判空
 */
export function createCardAnimation(index: number): CardAnimation | null {
  const entry = CARD_ANIMATION_REGISTRY[index]
  return entry ? entry.create() : null
}

export type { CardAnimation, CardMedia, CardMediaType } from './卡片动画类型'
