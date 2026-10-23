/**
 * 公开模板的合成图像与海报清单，不登记个人摄影、原始文件或真实项目。
 * 26 张图像与 10 张海报均使用程序生成的几何素材，标题按编号展示。
 * 素材清单保持显式登记；页面章节与顺序分别由 photoPage、posterPage 管理。
 * 图片三档地址由 id 构造，尺寸只用于预留同一宽高比的展示区域。
 */

import type { Bi } from './aboutProfile'

/** 双语文本：组件一律 `pick(x, lang)` 取值。 */
export type { Bi }

export interface VisualAsset {
  /** 唯一 id：同时是文件名前缀（`<id>-1600.webp` / `<id>-2560.webp` / `<id>-400.webp`） */
  id: string
  /** 示例标题 */
  title: Bi
  /**
   * 合成素材登记版面比例整数；示例文档版面另存等比例整数。
   * ⚠️ 只用来给 `<img>` 提供宽高比（避免加载时布局跳动），不是文件实际尺寸 ——
   *    网页版是等比例缩放过的，比例相同，所以宽高比照样对。
   */
  width: number
  height: number
  /** 默认展示档：最长边 1600（列表 / 作品带 / 展开区 / 画廊都用它） */
  src: string
  /** 高清档：最长边2560，用于查看器及大屏响应式展示 */
  large: string
  /**
   * 缩略图档：最长边 400。
   * ⚠️ 只有这里才用小图：查看器的缩略图导航一次要列 26 张，用 1600 档
   *    等于打开一次多拉好几 MB —— 缩略图本身在屏幕上只有几十像素宽。
   */
  thumb: string
  /** 用途标注：说明这是合成模板示例 */
  note?: Bi
  /** 无障碍替代文本（**按实际画面写**，不能只从中文文件名推测） */
  alt: Bi
}

/** 示例素材路径只在此处由 id 构造；输出文件需通过公开素材清单校验。 */
function asset(
  id: string,
  title: Bi,
  width: number,
  height: number,
  alt: Bi,
  note?: Bi,
): VisualAsset {
  return {
    id,
    title,
    width,
    height,
    src: `/portfolio/${id}-1600.webp`,
    large: `/portfolio/${id}-2560.webp`,
    thumb: `/portfolio/${id}-400.webp`,
    alt,
    note,
  }
}

/** 九张合成海报共用的示例标注。 */
const POSTER_NOTE: Bi = { zh: '合成海报示例', en: 'Synthetic poster sample' }
/** 编辑设计示例的用途标注。 */
const COVER_NOTE: Bi = { zh: '封面版式示例', en: 'Sample cover layout' }

/* 显式清单：保留不同横竖比例，供响应式布局与查看器演示。 */
export const photoCollection: readonly VisualAsset[] = [
  asset(
    'sample-photo-01',
    { zh: '图像示例 01', en: 'Image sample 01' },
    5568,
    3712,
    { zh: '横向合成几何示例 01，网格背景上排列色块、圆环与短线', en: 'Landscape synthetic geometric sample 01, with colour blocks, a ring and short lines on a grid' },
  ),
  asset(
    'sample-photo-02',
    { zh: '图像示例 02', en: 'Image sample 02' },
    3712,
    5568,
    { zh: '竖向合成几何示例 02，网格背景上排列色块、圆环与短线', en: 'Portrait synthetic geometric sample 02, with colour blocks, a ring and short lines on a grid' },
  ),
  asset(
    'sample-photo-03',
    { zh: '图像示例 03', en: 'Image sample 03' },
    5568,
    3712,
    { zh: '横向合成几何示例 03，网格背景上排列色块、圆环与短线', en: 'Landscape synthetic geometric sample 03, with colour blocks, a ring and short lines on a grid' },
  ),
  asset(
    'sample-photo-04',
    { zh: '图像示例 04', en: 'Image sample 04' },
    3712,
    5568,
    { zh: '竖向合成几何示例 04，网格背景上排列色块、圆环与短线', en: 'Portrait synthetic geometric sample 04, with colour blocks, a ring and short lines on a grid' },
  ),
  asset(
    'sample-photo-05',
    { zh: '图像示例 05', en: 'Image sample 05' },
    5568,
    3712,
    { zh: '横向合成几何示例 05，网格背景上排列色块、圆环与短线', en: 'Landscape synthetic geometric sample 05, with colour blocks, a ring and short lines on a grid' },
  ),
  asset(
    'sample-photo-06',
    { zh: '图像示例 06', en: 'Image sample 06' },
    6240,
    4160,
    { zh: '横向合成几何示例 06，网格背景上排列色块、圆环与短线', en: 'Landscape synthetic geometric sample 06, with colour blocks, a ring and short lines on a grid' },
  ),
  asset(
    'sample-photo-07',
    { zh: '图像示例 07', en: 'Image sample 07' },
    3840,
    2160,
    { zh: '横向合成几何示例 07，网格背景上排列色块、圆环与短线', en: 'Landscape synthetic geometric sample 07, with colour blocks, a ring and short lines on a grid' },
  ),
  asset(
    'sample-photo-08',
    { zh: '图像示例 08', en: 'Image sample 08' },
    3840,
    2160,
    { zh: '横向合成几何示例 08，网格背景上排列色块、圆环与短线', en: 'Landscape synthetic geometric sample 08, with colour blocks, a ring and short lines on a grid' },
  ),
  asset(
    'sample-photo-09',
    { zh: '图像示例 09', en: 'Image sample 09' },
    6240,
    4160,
    { zh: '横向合成几何示例 09，网格背景上排列色块、圆环与短线', en: 'Landscape synthetic geometric sample 09, with colour blocks, a ring and short lines on a grid' },
  ),
  asset(
    'sample-photo-10',
    { zh: '图像示例 10', en: 'Image sample 10' },
    4032,
    2268,
    { zh: '横向合成几何示例 10，网格背景上排列色块、圆环与短线', en: 'Landscape synthetic geometric sample 10, with colour blocks, a ring and short lines on a grid' },
  ),
  asset(
    'sample-photo-11',
    { zh: '图像示例 11', en: 'Image sample 11' },
    3712,
    5568,
    { zh: '竖向合成几何示例 11，网格背景上排列色块、圆环与短线', en: 'Portrait synthetic geometric sample 11, with colour blocks, a ring and short lines on a grid' },
  ),
  asset(
    'sample-photo-12',
    { zh: '图像示例 12', en: 'Image sample 12' },
    5568,
    3712,
    { zh: '横向合成几何示例 12，网格背景上排列色块、圆环与短线', en: 'Landscape synthetic geometric sample 12, with colour blocks, a ring and short lines on a grid' },
  ),
  asset(
    'sample-photo-13',
    { zh: '图像示例 13', en: 'Image sample 13' },
    3712,
    5568,
    { zh: '竖向合成几何示例 13，网格背景上排列色块、圆环与短线', en: 'Portrait synthetic geometric sample 13, with colour blocks, a ring and short lines on a grid' },
  ),
  asset(
    'sample-photo-14',
    { zh: '图像示例 14', en: 'Image sample 14' },
    3712,
    5568,
    { zh: '竖向合成几何示例 14，网格背景上排列色块、圆环与短线', en: 'Portrait synthetic geometric sample 14, with colour blocks, a ring and short lines on a grid' },
  ),
  asset(
    'sample-photo-15',
    { zh: '图像示例 15', en: 'Image sample 15' },
    4032,
    2268,
    { zh: '横向合成几何示例 15，网格背景上排列色块、圆环与短线', en: 'Landscape synthetic geometric sample 15, with colour blocks, a ring and short lines on a grid' },
  ),
  asset(
    'sample-photo-16',
    { zh: '图像示例 16', en: 'Image sample 16' },
    4032,
    1968,
    { zh: '横向合成几何示例 16，网格背景上排列色块、圆环与短线', en: 'Landscape synthetic geometric sample 16, with colour blocks, a ring and short lines on a grid' },
  ),
  asset(
    'sample-photo-17',
    { zh: '图像示例 17', en: 'Image sample 17' },
    5568,
    3712,
    { zh: '横向合成几何示例 17，网格背景上排列色块、圆环与短线', en: 'Landscape synthetic geometric sample 17, with colour blocks, a ring and short lines on a grid' },
  ),
  asset(
    'sample-photo-18',
    { zh: '图像示例 18', en: 'Image sample 18' },
    3712,
    5568,
    { zh: '竖向合成几何示例 18，网格背景上排列色块、圆环与短线', en: 'Portrait synthetic geometric sample 18, with colour blocks, a ring and short lines on a grid' },
  ),
  asset(
    'sample-photo-19',
    { zh: '图像示例 19', en: 'Image sample 19' },
    5568,
    3712,
    { zh: '横向合成几何示例 19，网格背景上排列色块、圆环与短线', en: 'Landscape synthetic geometric sample 19, with colour blocks, a ring and short lines on a grid' },
  ),
  asset(
    'sample-photo-20',
    { zh: '图像示例 20', en: 'Image sample 20' },
    8064,
    4536,
    { zh: '横向合成几何示例 20，网格背景上排列色块、圆环与短线', en: 'Landscape synthetic geometric sample 20, with colour blocks, a ring and short lines on a grid' },
  ),
  asset(
    'sample-photo-21',
    { zh: '图像示例 21', en: 'Image sample 21' },
    8064,
    3846,
    { zh: '横向合成几何示例 21，网格背景上排列色块、圆环与短线', en: 'Landscape synthetic geometric sample 21, with colour blocks, a ring and short lines on a grid' },
  ),
  asset(
    'sample-photo-22',
    { zh: '图像示例 22', en: 'Image sample 22' },
    3712,
    5568,
    { zh: '竖向合成几何示例 22，网格背景上排列色块、圆环与短线', en: 'Portrait synthetic geometric sample 22, with colour blocks, a ring and short lines on a grid' },
  ),
  asset(
    'sample-photo-23',
    { zh: '图像示例 23', en: 'Image sample 23' },
    3712,
    5568,
    { zh: '竖向合成几何示例 23，网格背景上排列色块、圆环与短线', en: 'Portrait synthetic geometric sample 23, with colour blocks, a ring and short lines on a grid' },
  ),
  asset(
    'sample-photo-24',
    { zh: '图像示例 24', en: 'Image sample 24' },
    8064,
    4536,
    { zh: '横向合成几何示例 24，网格背景上排列色块、圆环与短线', en: 'Landscape synthetic geometric sample 24, with colour blocks, a ring and short lines on a grid' },
  ),
  asset(
    'sample-photo-25',
    { zh: '图像示例 25', en: 'Image sample 25' },
    3712,
    5568,
    { zh: '竖向合成几何示例 25，网格背景上排列色块、圆环与短线', en: 'Portrait synthetic geometric sample 25, with colour blocks, a ring and short lines on a grid' },
  ),
  asset(
    'sample-photo-26',
    { zh: '图像示例 26', en: 'Image sample 26' },
    6938,
    3800,
    { zh: '横向合成几何示例 26，网格背景上排列色块、圆环与短线', en: 'Landscape synthetic geometric sample 26, with colour blocks, a ring and short lines on a grid' },
  ),
]

/** 海报 / 设计完整集合（10 件）：九张系列示例与一张封面版式示例。 */
export const posterCollection: readonly VisualAsset[] = [
  asset(
    'sample-poster-01',
    { zh: '海报示例 01', en: 'Poster sample 01' },
    5118,
    3198,
    { zh: '横向合成几何示例 01，网格背景上排列色块、圆环与短线', en: 'Landscape synthetic geometric sample 01, with colour blocks, a ring and short lines on a grid' },
    POSTER_NOTE,
  ),
  asset(
    'sample-poster-02',
    { zh: '海报示例 02', en: 'Poster sample 02' },
    5118,
    3198,
    { zh: '横向合成几何示例 02，网格背景上排列色块、圆环与短线', en: 'Landscape synthetic geometric sample 02, with colour blocks, a ring and short lines on a grid' },
    POSTER_NOTE,
  ),
  asset(
    'sample-poster-03',
    { zh: '海报示例 03', en: 'Poster sample 03' },
    5118,
    3198,
    { zh: '横向合成几何示例 03，网格背景上排列色块、圆环与短线', en: 'Landscape synthetic geometric sample 03, with colour blocks, a ring and short lines on a grid' },
    POSTER_NOTE,
  ),
  asset(
    'sample-poster-04',
    { zh: '海报示例 04', en: 'Poster sample 04' },
    5118,
    3198,
    { zh: '横向合成几何示例 04，网格背景上排列色块、圆环与短线', en: 'Landscape synthetic geometric sample 04, with colour blocks, a ring and short lines on a grid' },
    POSTER_NOTE,
  ),
  asset(
    'sample-poster-05',
    { zh: '海报示例 05', en: 'Poster sample 05' },
    5118,
    3198,
    { zh: '横向合成几何示例 05，网格背景上排列色块、圆环与短线', en: 'Landscape synthetic geometric sample 05, with colour blocks, a ring and short lines on a grid' },
    POSTER_NOTE,
  ),
  asset(
    'sample-poster-06',
    { zh: '海报示例 06', en: 'Poster sample 06' },
    5118,
    3198,
    { zh: '横向合成几何示例 06，网格背景上排列色块、圆环与短线', en: 'Landscape synthetic geometric sample 06, with colour blocks, a ring and short lines on a grid' },
    POSTER_NOTE,
  ),
  asset(
    'sample-poster-07',
    { zh: '海报示例 07', en: 'Poster sample 07' },
    5118,
    3198,
    { zh: '横向合成几何示例 07，网格背景上排列色块、圆环与短线', en: 'Landscape synthetic geometric sample 07, with colour blocks, a ring and short lines on a grid' },
    POSTER_NOTE,
  ),
  asset(
    'sample-poster-08',
    { zh: '海报示例 08', en: 'Poster sample 08' },
    5118,
    3198,
    { zh: '横向合成几何示例 08，网格背景上排列色块、圆环与短线', en: 'Landscape synthetic geometric sample 08, with colour blocks, a ring and short lines on a grid' },
    POSTER_NOTE,
  ),
  asset(
    'sample-poster-09',
    { zh: '海报示例 09', en: 'Poster sample 09' },
    5118,
    3198,
    { zh: '横向合成几何示例 09，网格背景上排列色块、圆环与短线', en: 'Landscape synthetic geometric sample 09, with colour blocks, a ring and short lines on a grid' },
    POSTER_NOTE,
  ),
  asset(
    'sample-poster-10',
    { zh: '海报示例 10', en: 'Poster sample 10' },
    6666,
    3750,
    { zh: '横向合成几何示例 10，网格背景上排列色块、圆环与短线', en: 'Landscape synthetic geometric sample 10, with colour blocks, a ring and short lines on a grid' },
    COVER_NOTE,
  ),
]

/* ═══════════════════════ id 索引 ═══════════════════════
 *
 * ⚠️ 用 Map 而不是每次 `find()`：一次要查 26+10 项，`visualById` 在多个页面的
 *    模块求值期就会被调用。
 * ⚠️ **建立时必须查重**：重复 id 会让后者静默覆盖前者（两件作品指向同一张图，
 *    而页面上看起来「都对」）。这里直接抛错。
 * ⚠️ 顺序：先构造完整集合 → 再建索引 → 再用 `visualById` 造精选。
 *    反过来（让集合通过 `visualById` 构造自身）会踩暂时性死区。
 */
const visualIndex = new Map<string, VisualAsset>()
for (const item of [...photoCollection, ...posterCollection]) {
  if (visualIndex.has(item.id)) {
    throw new Error(`[visualPortfolio] 素材 id 重复：${item.id}`)
  }
  visualIndex.set(item.id, item)
}

/** 按 id 取素材。⚠️ 取不到就**抛错**，不返回 undefined —— 静默的空框在截图里看不出来。 */
export function visualById(id: string): VisualAsset {
  const item = visualIndex.get(id)
  if (!item) throw new Error(`[visualPortfolio] 没有 id 为「${id}」的素材（拼错了？）`)
  return item
}

/* ═══════════════════ 保留的八张精选引用（不复制素材记录） ═══════════════════ */

/** 图像精选三张，供相关组件展示合成几何素材。 */
export const photography: readonly VisualAsset[] = [
  visualById('sample-photo-01'),
  visualById('sample-photo-02'),
  visualById('sample-photo-03'),
]

/** 两张编辑设计示例成对展示，用于比较版面与比例。 */
export const editorial: readonly VisualAsset[] = [
  visualById('sample-photo-20'),
  visualById('sample-poster-10'),
]

/** 三张系列合成海报；按高度统一，保留各自版面比例。 */
export const posters: readonly VisualAsset[] = [
  visualById('sample-poster-01'),
  visualById('sample-poster-02'),
  visualById('sample-poster-03'),
]

/** 保留精选的合并集合，供既有组件 / 开发期结构自检使用，不替代完整专题清单。 */
export const ALL_VISUALS: readonly VisualAsset[] = [...photography, ...editorial, ...posters]

/* ═══════════════════════ 既有视觉区块的兼容文案 ═══════════════════════ */

/**
 * 浅色正文各屏的标题与导语。
 * ⚠️ 与素材放在同一个文件：这几屏的文字全部围绕这八张图展开，分开写
 *    「图在这、字在那」时，改一处忘一处。
 */
export const SECTIONS = {
  photography: {
    label: 'SAMPLE IMAGERY',
    title: { zh: '图像示例', en: 'Sample imagery' },
    lead: {
      zh: '三张合成几何示例，用于展示不同图像比例、版面留白与浏览交互。',
      en: 'Three synthetic geometric samples demonstrate image ratios, layout spacing and browsing interactions.',
    },
  },
  editorial: {
    label: 'LAYOUT STUDIES',
    title: { zh: '版式示例', en: 'Layout studies' },
    lead: {
      zh: '用两张合成示例观察比例、留白与信息层级，展示编辑设计区的成对布局。',
      en: 'Two synthetic samples demonstrate proportions, whitespace and information hierarchy in a paired editorial layout.',
    },
  },
  posters: {
    label: 'SERIES',
    title: { zh: '系列设计', en: 'Series Design' },
    lead: {
      zh: '以统一的几何元素演示系列海报、切换控件与色彩章节。',
      en: 'A shared set of geometric elements demonstrates a poster series, switching controls and colour chapters.',
    },
  },
} as const satisfies Record<string, { label: string; title: Bi; lead: Bi }>

/* ═══════════════════════ 开发期自检 ═══════════════════════ */

/**
 * 保留八张精选接口的结构自检（只在 DEV 调用）。
 *
 * ⚠️ 它防的是**结构错**，不是文案错：
 *   ① 两套 id 命名空间不能重叠 —— 一旦示例图像和示例经历案例撞 id，锚点、
 *      封面、查看器会互相串（这正是方案要求「两套数据分开」的原因）；
 *   ② 八张必须齐 —— 少一张就是页面上一个空框，而空框在截图里常常看不出来；
 *   ③ 路径必须由 id 推出来 —— 防止有人手写一个和 id 不一致的 src。
 *
 * ⚠️ 3 / 2 / 3 / 8 这组判据**不因专题页全量展示而变**：专题页的完整集合
 *    另有一套 `assertCollectionCoverage()`，两者各管一段、互不干扰。
 */
export function assertVisuals(workIds: readonly string[]): void {
  const bad: string[] = []
  const seen = new Set<string>()

  for (const v of ALL_VISUALS) {
    if (seen.has(v.id)) bad.push(`id 重复：${v.id}`)
    seen.add(v.id)

    if (workIds.includes(v.id)) {
      bad.push(`示例图像 id「${v.id}」与示例经历案例 id 撞名 —— 两套数据必须分开`)
    }
    if (v.src !== `/portfolio/${v.id}-1600.webp`) bad.push(`${v.id} 的 src 与 id 不一致`)
    if (v.large !== `/portfolio/${v.id}-2560.webp`) bad.push(`${v.id} 的 large 与 id 不一致`)
    if (v.thumb !== `/portfolio/${v.id}-400.webp`) bad.push(`${v.id} 的 thumb 与 id 不一致`)
    if (v.width <= 0 || v.height <= 0) bad.push(`${v.id} 的宽高无效`)
    if (!v.title.zh.trim() || !v.title.en.trim()) bad.push(`${v.id} 的标题缺语言`)
    if (!v.alt.zh.trim() || !v.alt.en.trim()) bad.push(`${v.id} 的替代文本缺语言`)
  }

  if (photography.length !== 3) bad.push(`图像示例应为 3 张，实为 ${photography.length}`)
  if (editorial.length !== 2) bad.push(`编辑设计示例应为 2 张，实为 ${editorial.length}`)
  if (posters.length !== 3) bad.push(`系列海报应为 3 张，实为 ${posters.length}`)
  if (ALL_VISUALS.length !== 8) bad.push(`精选素材应为 8 张，实为 ${ALL_VISUALS.length}`)

  if (bad.length) {
    throw new Error(`[visualPortfolio] 内容自检失败:\n  - ${bad.join('\n  - ')}`)
  }
}

/**
 * 专题页**完整集合**的结构自检（只在 DEV 调用）。
 *
 * ⚠️ 刻意**不合并进 `assertVisuals`** —— 那个函数的 3/2/3/8 判据是 `/about`
 *    八张精选的回归依据，混进来就分不清「谁坏了」。
 *
 * 26 / 10 是公开示例清单的数量。新增素材时同步更新清单与断言，
 * 并通过模板素材清单、响应式图片检查确认文件覆盖和尺寸。
 */
export function assertCollectionCoverage(workIds: readonly string[]): void {
  const bad: string[] = []

  if (photoCollection.length !== 26) {
    bad.push(`图像完整集合应为 26 张，实为 ${photoCollection.length}`)
  }
  if (posterCollection.length !== 10) {
    bad.push(`海报完整集合应为 10 件，实为 ${posterCollection.length}`)
  }

  const seen = new Set<string>()
  for (const item of [...photoCollection, ...posterCollection]) {
    if (seen.has(item.id)) bad.push(`完整集合 id 重复：${item.id}`)
    seen.add(item.id)

    if (workIds.includes(item.id)) {
      bad.push(`素材 id「${item.id}」与示例经历案例撞名 —— 两套数据必须分开`)
    }
    if (!Number.isFinite(item.width) || !Number.isFinite(item.height) || item.width <= 0 || item.height <= 0) {
      bad.push(`${item.id} 的宽高无效`)
    }
    for (const field of [item.title, item.alt]) {
      if (!field.zh.trim() || !field.en.trim()) bad.push(`${item.id} 缺少双语内容`)
    }
  }

  /*
   * ⚠️ 这里**不再**校验「精选六张在完整集合里」：那份六张的清单
   *    （`photoSelection`）随 01 段改成色彩章节一起退役了 ——
   *    现在每张照片的归属由 `photoPage.ts` 的 `assertPhotoSets()` 守
   *    （划分是否成立：不重不漏），比「子集包含」严格得多。
   */

  // 章节与画廊都要能「横竖交替」：两种朝向都得有，否则版式读起来是平的
  const portrait = photoCollection.filter((v) => v.height > v.width).length
  if (portrait < 1 || portrait === photoCollection.length) {
    bad.push(`图像完整集合必须有横有竖，实测竖 ${portrait} / 共 ${photoCollection.length}`)
  }

  if (bad.length) {
    throw new Error(`[visualPortfolio] 完整集合自检失败:\n  - ${bad.join('\n  - ')}`)
  }
}
