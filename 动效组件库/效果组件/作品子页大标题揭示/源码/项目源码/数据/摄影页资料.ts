/**
 * `/photo` 页的文案与素材编排：开场、色彩章节、手记和完整画廊顺序。
 * 通用页尾的跨章节动作由 WorkContinuation 统一维护，不在这里复制。
 *
 * 与 `visualPortfolio.ts` 的分工（不要互相越界）
 *   · `visualPortfolio.ts` —— 素材本体：id / 标题 / 版面比例尺寸 / alt。
 *   · 本文件 —— 把这些素材**编排**成章节与顺序，并持有页面文案。
 *     素材引用一律走 `visualById(id)`，本文件不重复写尺寸或标题。
 *
 * 三段内容（对应页面 01 / 02 / 03）：
 *   01 `PHOTO_SETS`                      —— 色彩章节（`PhotoSets` 全屏固定舞台，
 *                                           标题 / 描述 / 配色都挂在 `PhotoSet` 上，
 *                                           组内走完后遮罩换章）
 *   02 `SECTIONS.notes` + `NOTES`        —— 示例说明
 *   03 `SECTIONS.gallery` + `photoGallery` —— 完整画廊（26 张，可拖动 / 可点开）
 *
 * ⚠️ 01 段**没有** `SECTIONS` 条目：它不再走 `AboutSection` 的章节头，
 *    文案来自 `PhotoSet.name` / `PhotoSet.description`（见 `SET_PLAN`）。
 *
 * ⚠️ `PHOTO_SETS` 是 `photoCollection` 的一个**划分**：每张照片恰好属于一章。
 *    漏一张不会报错，只会在推进到那一章时那张永远不出现 —— 由
 *    `assertPhotoSets()` 在开发期兜住（生产构建不会跑它）。
 */
import type { Bi } from './人物资料'
import { photoCollection, visualById, type VisualAsset } from './视觉作品资料'

export const HERO = {
  big: 'PHOTOGRAPHY',
  kicker: { zh: '图像展示示例', en: 'Sample image showcase' } as Bi,
  lead: {
    zh: '用合成图像，体验完整的展示流程。',
    en: 'Explore the full showcase with synthetic sample imagery.',
  } as Bi,
} as const

export const SECTIONS = {
  notes: {
    label: 'NOTES',
    title: { zh: '示例说明', en: 'Sample notes' },
    lead: {
      zh: '这里展示版面、滚动与查看器的组合方式。',
      en: 'Explore how layout, scrolling and the viewer work together.',
    },
  },
  gallery: {
    label: 'GALLERY',
    title: { zh: '合成图像画廊', en: 'Synthetic image gallery' },
    lead: (n: number): Bi => ({
      zh: `${n} 张合成图像，演示横竖构图与完整浏览流程。`,
      en: `${n} synthetic images demonstrate mixed aspect ratios and the full browsing flow.`,
    }),
  },
} as const

/** 公开模板只描述合成图像和交互，不声称存在真实摄影、器材或拍摄经历。 */
export const NOTES: readonly Bi[] = [
  {
    zh: '所有图像均为合成几何示例，由网格、色块、圆环与短线组成，不含真实人物、地名或摄影作品。',
    en: 'All images are synthetic geometric samples made from grids, colour blocks, rings and short lines, with no real people, locations or photographs.',
  },
  {
    zh: '横向与竖向图像保留各自的宽高比，用来检查留白、章节切换与不同屏幕上的版面表现。',
    en: 'Landscape and portrait samples retain their aspect ratios to demonstrate spacing, chapter transitions and layouts across screen sizes.',
  },
  {
    zh: '替换成自己的公开作品时，请同步更新标题、替代文本与尺寸，并检查缩略图和查看器是否仍然对应。',
    en: 'When adding your own public work, update titles, alt text and dimensions together, then check that thumbnails still match the viewer.',
  },
] as const

/**
 * 一个色彩章节（滚动推进的单位）。`PhotoSets.vue` 的章节标题、描述、底色、
 * 页脚计数全部读它；`items` 顺序即滚动观看顺序。
 */
export interface PhotoSet {
  /** 唯一 id：章节的稳定标识 */
  id: string
  /** 章名：章节标题 */
  name: Bi
  /** 一句话介绍章节的示例编排（展示在章节标题旁） */
  description: Bi
  /** 章节底色、文字和进度线的颜色；不对图像添加滤镜。 */
  palette: {
    background: string
    foreground: string
    accent: string
  }
  /** 组内照片，**顺序就是版面上的出场顺序**（不按横竖构图重排） */
  items: readonly VisualAsset[]
}

/**
 * 写作态：`SET_PLAN` 里只写素材 **id**，`PHOTO_SETS` 再 `visualById()` 换成素材本体。
 * 好处是编排表短、一眼看得出分组，尺寸 / 标题这类事实仍然只有 `visualPortfolio.ts` 一份。
 */
type PhotoSetPlan = Omit<PhotoSet, 'items'> & { ids: readonly string[] }

/**
 * 五个章节保留既有分组与顺序（7 / 6 / 4 / 7 / 2），便于检验完整浏览流程。
 * 名称表示舞台底色，不把合成图像描述成某处真实风景或个人摄影经历。
 * palette 只控制舞台、文字与进度线，每张图像必须且只能出现于一章。
 */
const SET_PLAN: readonly PhotoSetPlan[] = [
  {
    id: 'azure',
    name: { zh: '浅蓝章节', en: 'Light blue chapter' },
    description: {
      zh: '浅蓝舞台中，体验横竖图像的连续切换。',
      en: 'A light blue stage demonstrates transitions between landscape and portrait samples.',
    },
    palette: { background: '#BCD5E3', foreground: '#183747', accent: '#416C86' },
    ids: [
      'sample-photo-20',
      'sample-photo-21',
      'sample-photo-04',
      'sample-photo-22',
      'sample-photo-12',
      'sample-photo-14',
      'sample-photo-18',
    ],
  },
  {
    id: 'mist',
    name: { zh: '深青章节', en: 'Deep teal chapter' },
    description: {
      zh: '深色舞台中，观察几何轮廓与滚动节奏。',
      en: 'A dark stage highlights geometric outlines and scrolling rhythm.',
    },
    palette: { background: '#263A42', foreground: '#E6EEF0', accent: '#A7C5CD' },
    ids: [
      'sample-photo-01',
      'sample-photo-11',
      'sample-photo-10',
      'sample-photo-16',
      'sample-photo-19',
      'sample-photo-03',
    ],
  },
  {
    id: 'moss',
    name: { zh: '浅绿章节', en: 'Light green chapter' },
    description: {
      zh: '浅绿舞台中，比较不同图像比例与留白。',
      en: 'A light green stage demonstrates different image proportions and spacing.',
    },
    palette: { background: '#CCD1B9', foreground: '#29352B', accent: '#61704C' },
    ids: ['sample-photo-24', 'sample-photo-17', 'sample-photo-15', 'sample-photo-05'],
  },
  {
    id: 'amber',
    name: { zh: '暖金章节', en: 'Warm gold chapter' },
    description: {
      zh: '暖金舞台中，演示较长图组的推进与计数。',
      en: 'A warm gold stage demonstrates progression and counting through a longer image set.',
    },
    palette: { background: '#D7B05E', foreground: '#392B18', accent: '#77501F' },
    ids: [
      'sample-photo-06',
      'sample-photo-09',
      'sample-photo-07',
      'sample-photo-08',
      'sample-photo-02',
      'sample-photo-23',
      // 保留这一槽位，维持章节总数与完整画廊覆盖。
      'sample-photo-26',
    ],
  },
  {
    id: 'silver',
    name: { zh: '浅灰章节', en: 'Light grey chapter' },
    description: {
      zh: '浅灰舞台中，以两张示例完成章节浏览。',
      en: 'Two samples complete the chapter sequence on a light grey stage.',
    },
    palette: { background: '#E7E1DE', foreground: '#3E3539', accent: '#8E747F' },

    ids: ['sample-photo-25', 'sample-photo-13'],
  },
]

export const PHOTO_SETS: readonly PhotoSet[] = SET_PLAN.map(({ ids, ...set }) => ({
  ...set,
  items: ids.map(visualById),
}))

/**
 * 开发期自检（`import.meta.env.DEV` 才调用，见 `PhotoView.vue`）。守四条：
 *   ① 章 id 不重复、章非空；
 *   ② 每章双语文案齐全、`palette` 是六位十六进制色值；
 *   ③ 每张素材都真实存在于 `photoCollection`；
 *   ④ **划分成立** —— 没有一张被分进两章、也没有一张落单。
 *
 * ⚠️ ④ 是这里最要紧的一条：漏一张 / 重一张都不会让页面报错，
 *    只会在推进到那一章或画廊里少一张 / 多一张，而截图上看不出来。
 */
export function assertPhotoSets(): void {
  const bad: string[] = []
  const seen = new Set<string>()
  const setIds = new Set<string>()
  const collectionIds = new Set(photoCollection.map((item) => item.id))

  for (const set of PHOTO_SETS) {
    if (setIds.has(set.id)) bad.push(`色彩章节 id 重复：${set.id}`)
    setIds.add(set.id)
    if (!set.items.length) bad.push(`色彩章节「${set.id}」不能为空`)
    if (!set.name.zh.trim() || !set.name.en.trim() || !set.description.zh.trim() || !set.description.en.trim()) {
      bad.push(`色彩章节「${set.id}」缺少双语文案`)
    }
    if (Object.values(set.palette).some((value) => !/^#[0-9a-f]{6}$/i.test(value))) {
      bad.push(`色彩章节「${set.id}」的配色不是六位十六进制色值`)
    }
    for (const item of set.items) {
      if (!collectionIds.has(item.id)) bad.push(`素材「${item.id}」不在摄影集合中`)
      if (seen.has(item.id)) bad.push(`素材「${item.id}」被分进了多个色彩章节`)
      seen.add(item.id)
    }
  }

  for (const item of photoCollection) {
    if (!seen.has(item.id)) bad.push(`素材「${item.id}」没有分进任何色彩章节`)
  }
  if (bad.length) throw new Error(`[photoPage] 色彩章节自检失败:\n  - ${bad.join('\n  - ')}`)
}

/**
 * 完整画廊的一个槽位。`span` 决定它在栅格里占几列 —— 由**照片自己的比例**
 * 和它在组内的序号共同决定，不是手写死的：
 *   竖构图 → `md`（窄一点，免得一张竖图撑掉半行）
 *   横构图 → 每三张里的第一张 `lg`，其余 `sm`（做出疏密，不是均分）
 */
interface GallerySlot {
  item: VisualAsset
  span: 'lg' | 'md' | 'sm'
}

/**
 * 03 完整画廊的展位表（26 张，顺序 = 章节顺序）。
 * ⚠️ 沿用章节的颜色顺序，避免读完章节后又把不同色调混排。
 * ⚠️ 这个数组同时是 `PhotoView.vue` 的查看器集合（`galleryViewerItems`）——
 *    两者顺序必须一致，查看器的下标才与点击的槽位对得上。
 */
export const photoGallery: readonly GallerySlot[] = PHOTO_SETS.flatMap((set) =>
  set.items.map((item, index): GallerySlot => ({
    item,
    span: item.height > item.width ? 'md' : index % 3 === 0 ? 'lg' : 'sm',
  })),
)
