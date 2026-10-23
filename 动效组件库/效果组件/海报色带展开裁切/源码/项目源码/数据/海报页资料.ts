/**
 * `/poster` 的公开模板文案与版面配置。
 * 素材本体在 visualPortfolio，当前页面只使用程序生成的合成几何图像。
 * 保留既有导出名供组件消费，不将历史接口名称当作真实项目或作品说明。
 */
import type { Bi } from './人物资料'
import { editorial, posterCollection, type VisualAsset } from './视觉作品资料'

export const HERO = {
  big: 'POSTER / DESIGN',
  kicker: { zh: '海报与版面示例', en: 'Poster & layout samples' } as Bi,
} as const

/** 兼容现有组件导入；可见内容是合成系列示例。 */
export const MILITARY_SERIES_TITLE: Bi = {
  zh: '合成几何海报 · 模板系列展示',
  en: 'Synthetic geometric posters · Template series',
}

/** 使用稳定素材键连接示例说明，不描述真实装备、客户或个人项目。 */
export const MILITARY_PROFILES: Readonly<Record<string, Bi>> = {
  'sample-poster-01': {
    zh: '海报示例 01：网格、色块与圆环组成合成版面，用于演示完整海报和色彩章节的展示方式。',
    en: 'Poster sample 01: a synthetic composition of grids, colour blocks and a ring, demonstrating the full poster and colour chapter layouts.',
  },
  'sample-poster-02': {
    zh: '海报示例 02：沿用统一的几何元素，检查系列切换时的比例、留白与信息层级。',
    en: 'Poster sample 02: shared geometric elements demonstrate proportions, spacing and information hierarchy while switching through a series.',
  },
  'sample-poster-03': {
    zh: '海报示例 03：以合成图形代替真实作品，展示横向海报在不同屏幕中的完整构图。',
    en: 'Poster sample 03: synthetic shapes demonstrate a complete landscape poster composition across screen sizes.',
  },
  'sample-poster-04': {
    zh: '海报示例 04：通过色块与圆环建立视觉重点，供查看器、缩略图和章节切换共用。',
    en: 'Poster sample 04: colour blocks and a ring form a visual focus shared by the viewer, thumbnails and chapter transitions.',
  },
  'sample-poster-05': {
    zh: '海报示例 05：统一的网格背景承托几何元素，用来检查动态版面与静态图像的衔接。',
    en: 'Poster sample 05: a consistent grid supports geometric elements and demonstrates transitions between animated layouts and static images.',
  },
  'sample-poster-06': {
    zh: '海报示例 06：使用合成形状与短线演示信息密度，替换作品时应同步更新说明和替代文本。',
    en: 'Poster sample 06: synthetic shapes and short lines demonstrate information density; update the description and alt text when replacing the image.',
  },
  'sample-poster-07': {
    zh: '海报示例 07：保留系列中的独立槽位，便于检验滚动推进、计数与完整素材覆盖。',
    en: 'Poster sample 07: a distinct slot in the series demonstrates scrolling progression, counting and complete asset coverage.',
  },
  'sample-poster-08': {
    zh: '海报示例 08：在统一版式中呈现另一张合成图像，用来体验系列浏览与画面切换。',
    en: 'Poster sample 08: another synthetic image within the shared layout demonstrates browsing and visual transitions through the series.',
  },
  'sample-poster-09': {
    zh: '海报示例 09：作为系列末张，演示章节收束与后续编辑设计区之间的阅读衔接。',
    en: 'Poster sample 09: the final sample demonstrates the transition from the series into the following editorial design section.',
  },
}

export const SECTIONS = {
  pair: {
    label: 'EDITORIAL DESIGN',
    title: { zh: '版式对照示例', en: 'Sample layout comparison' },
    lead: {
      zh: '两张合成几何图像，用于演示成对版面、图像比例与信息层级；不对应真实作品或个人项目。',
      en: 'Two synthetic geometric images demonstrate paired layouts, aspect ratios and information hierarchy, without representing real work or personal projects.',
    },
  },
} as const

/** 前九张系列合成海报，不包含编辑设计区的封面版式示例。 */
export const posterSeries: readonly VisualAsset[] = posterCollection.filter(
  (item) => item.id !== 'sample-poster-10',
)

/** 成对展示的两张合成示例，保留既有引用顺序。 */
export const editorialPair: readonly VisualAsset[] = editorial
