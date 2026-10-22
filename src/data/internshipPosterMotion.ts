/**
 * 实习海报的动效版面配置
 * 矩形使用完整页面的归一化坐标（0–1），分层终态对齐当前展示图，原 PDF 保持不动。
 * 产品组 id 与 internshipPosters 保持一致；标题裁片按原始页号索引，不能按筛选后的序号取。
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
    model: 'EC100',
    title: { zh: '工程引导', en: 'MACHINE GUIDANCE' },
    words: [{ zh: '引导', en: 'GUIDE' }, { zh: '定位', en: 'POSITION' }, { zh: '施工', en: 'BUILD' }],
    statements: [{ zh: '把方向，变成坐标', en: 'GUIDANCE IN VIEW' }],
    background: '#181a19', accent: '#ffbc25', kind: 'guidance',
  },
  'demo-measure': {
    model: 'V10L',
    title: { zh: '激光测量', en: 'LASER RTK' },
    words: [{ zh: '激光', en: 'LASER' }, { zh: '影像', en: 'VIDEO' }, { zh: '放样', en: 'AR' }],
    statements: [
      { zh: '精度，进入视野', en: 'PRECISION MADE VISIBLE' },
      { zh: '连接，持续在线', en: 'UNBREAKABLE CONNECTIVITY' },
    ],
    background: '#171717', accent: '#ffd22d', kind: 'laser',
  },
  'demo-garden': {
    model: 'VELA',
    title: { zh: '智能草坪', en: 'ROBOTIC MOWER' },
    words: [{ zh: '建图', en: 'MAP' }, { zh: '修剪', en: 'MOW' }, { zh: '护理', en: 'CARE' }],
    statements: [{ zh: '留出生活的空间', en: 'PRECISE MOWING, PERFECT LAWNS' }],
    background: '#154d3c', accent: '#d9ea99', kind: 'lawn',
  },
}

const fragment = (kind: PosterFragment['kind'], rect: PosterRect): PosterFragment => ({ kind, rect })

// 各页标题位置不一致，逐页登记，不用一个坐标裁所有产品海报
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
