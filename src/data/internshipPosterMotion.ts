/**
 * 合成版面示例的动效配置
 * 矩形使用完整页面的归一化坐标（0–1），裁片与展示图共用同一公开素材，避免重复请求。
 * 示例组 id 与 internshipPosters 保持一致；裁片按清单页号索引，不能按筛选后的序号取。
 */
import type { Bi } from './aboutProfile'
import type { VisualAsset } from './visualPortfolio'

export type PosterRect = readonly [x: number, y: number, width: number, height: number]
export interface PosterFragment {
  kind: 'headline' | 'block'
  rect: PosterRect
}
export interface InternshipMotionTheme {
  model: string
  title: Bi
  words: readonly Bi[]
  statements: readonly Bi[]
  background: string
  accent: string
  kind: 'guidance' | 'laser' | 'lawn'
}

export const INTERNSHIP_MOTION_THEMES: Readonly<Record<string, InternshipMotionTheme>> = {
  'demo-guidance': {
    model: 'DEMO A',
    title: { zh: '版面示例 A', en: 'LAYOUT SAMPLE A' },
    words: [{ zh: '网格', en: 'GRID' }, { zh: '色块', en: 'BLOCK' }, { zh: '层次', en: 'LAYER' }],
    statements: [{ zh: '合成图形，展示版面', en: 'SYNTHETIC LAYOUT STUDY' }],
    background: '#181a19', accent: '#ffbc25', kind: 'guidance',
  },
  'demo-measure': {
    model: 'DEMO B',
    title: { zh: '版面示例 B', en: 'LAYOUT SAMPLE B' },
    words: [{ zh: '圆环', en: 'RING' }, { zh: '对比', en: 'CONTRAST' }, { zh: '节奏', en: 'RHYTHM' }],
    statements: [
      { zh: '留白，组织信息', en: 'SPACE ORGANISES CONTENT' },
      { zh: '几何，连接画面', en: 'GEOMETRY CONNECTS FRAMES' },
    ],
    background: '#171717', accent: '#ffd22d', kind: 'laser',
  },
  'demo-garden': {
    model: 'DEMO C',
    title: { zh: '版面示例 C', en: 'LAYOUT SAMPLE C' },
    words: [{ zh: '组合', en: 'COMPOSE' }, { zh: '比例', en: 'RATIO' }, { zh: '平衡', en: 'BALANCE' }],
    statements: [{ zh: '以合成素材，演示层次', en: 'SYNTHETIC SHAPES, CLEAR LAYERS' }],
    background: '#154d3c', accent: '#d9ea99', kind: 'lawn',
  },
}

const fragment = (kind: PosterFragment['kind'], rect: PosterRect): PosterFragment => ({ kind, rect })

// 各槽位保留独立裁片配置；更换合成构图后，应逐页复核裁片与展示图的对齐
const laserHeadlines: readonly PosterRect[] = [
  [.055, .52, .69, .31], [.04, .085, .68, .18], [.12, .12, .79, .17],
  [.065, .13, .85, .13], [.065, .12, .84, .29], [.065, .11, .83, .13],
  [.13, .12, .75, .18], [.11, .48, .81, .17], [.14, .12, .70, .14],
  [.06, .145, .38, .29], [.065, .32, .52, .22], [.14, .12, .72, .2],
  [.34, .115, .62, .27], [.54, .16, .41, .45], [.49, .38, .45, .16],
  [.22, .35, .73, .27], [.055, .16, .44, .4], [.52, .055, .43, .23],
  [.35, .055, .6, .19],
]

/** 每页使用少量裁片，浏览器复用同一张 WebP，避免动画再下载一套大图 */
export function internshipFragments(item: VisualAsset): readonly PosterFragment[] {
  const page = Number(item.id.slice(-2)) - 1
  if (item.id.startsWith('demo-guidance-')) return [
    fragment('headline', page === 0 ? [.04, .295, .44, .31] : [.04, .21, .59, .235]),
  ]
  if (item.id.startsWith('demo-measure-')) return [
    fragment('headline', laserHeadlines[page] ?? [.08, .14, .78, .22]),
  ]
  return page === 0 ? [
    fragment('headline', [.13, .155, .76, .135]),
    fragment('block', [.32, .49, .5, .31]),
  ] : [
    fragment('headline', [.07, .035, .86, .105]),
    fragment('block', page === 5 ? [.065, .22, .87, .11] : [.075, .43, .8, .12]),
  ]
}

/** 裁片的内部仍是一整张展示图；位置按裁片尺寸反算，不改变文字比例 */
export function cropStyle([x, y, width, height]: PosterRect) {
  return {
    width: `${100 / width}%`, height: `${100 / height}%`,
    left: `${-x / width * 100}%`, top: `${-y / height * 100}%`,
  }
}

/** 裁片外框直接使用页面百分比；内部整图由 cropStyle 反向定位，两者必须配套。 */
export function fragmentStyle([x, y, width, height]: PosterRect) {
  return { left: `${x * 100}%`, top: `${y * 100}%`, width: `${width * 100}%`, height: `${height * 100}%` }
}
