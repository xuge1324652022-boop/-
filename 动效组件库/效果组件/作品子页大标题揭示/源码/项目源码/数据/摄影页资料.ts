/**
 * `/photo` 页的文案与素材编排：开场、色彩章节、手记和完整画廊顺序。
 * 通用页尾的跨章节动作由 WorkContinuation 统一维护，不在这里复制。
 *
 * 与 `visualPortfolio.ts` 的分工（不要互相越界）
 *   · `visualPortfolio.ts` —— 素材本体：id / 标题 / 原始像素尺寸 / alt。
 *   · 本文件 —— 把这些素材**编排**成章节与顺序，并持有页面文案。
 *     素材引用一律走 `visualById(id)`，本文件不重复写尺寸或标题。
 *
 * 三段内容（对应页面 01 / 02 / 03）：
 *   01 `PHOTO_SETS`                      —— 色彩章节（`PhotoSets` 全屏固定舞台，
 *                                           标题 / 描述 / 配色都挂在 `PhotoSet` 上，
 *                                           组内走完后遮罩换章）
 *   02 `SECTIONS.notes` + `NOTES`        —— 摄影手记
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
  kicker: { zh: '摄影', en: 'Photography' } as Bi,
  lead: {
    zh: '循着颜色，走进光里。',
    en: 'Follow the colour. Step into the light.',
  } as Bi,
} as const

export const SECTIONS = {
  notes: {
    label: 'NOTES',
    title: { zh: '摄影手记', en: 'Notes' },
    lead: {
      zh: '先观察光，再决定画面。',
      en: 'Watch the light first, then decide the frame.',
    },
  },
  gallery: {
    label: 'GALLERY',
    title: { zh: '摄影作品', en: 'Photographic works' },
    lead: (n: number): Bi => ({
      zh: `${n} 次停留，留下风景、人物与光。`,
      en: `${n} moments held in landscapes, people and light.`,
    }),
  },
} as const

/** 只描述画面和观察，不补写原素材没有提供的器材或拍摄参数。 */
export const NOTES: readonly Bi[] = [
  {
    zh: '这组照片里有山、有雾、有水面的倒影，也有树影和天光。共同点是：光先出现，画面才有形状。',
    en: 'Mountains, mist, reflections, shadows and sky light. What they share: the light arrives first, and then the frame takes shape.',
  },
  {
    zh: '拍的时候我更在意层次：前景压住什么、中景留住什么、远处让什么慢慢退掉。构图是取舍。',
    en: 'I look for layers: what the foreground holds, what the middle distance keeps, and what the distance lets fade. Composition is a choice.',
  },
  {
    zh: '把相近的颜色放在一起，原本不同的地方，也会有彼此呼应的片刻。',
    en: 'Bring similar colours together, and distant places begin to echo one another.',
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
  /** 一句话描述这一章的光（展示在章节标题旁） */
  description: Bi
  /** 章节底色、文字和进度线的颜色；不对照片添加滤镜。 */
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
 * 五个色彩章节。**顺序就是滚动推进顺序**，从亮到暗再回到浅色：
 *   晴蓝 → 雾青 → 苔绿 → 鎏金 → 银白。
 *
 * ⚠️ 划分依据是**画面的主色与明度**，不是题材或张数：同一章里的照片放在一起
 *    能读出「同一种光」。所以各章张数不齐（7 / 6 / 4 / 7 / 2）—— 完整看图
 *    比凑齐版式重要。
 * ⚠️ `palette` 只给章节底色 / 文字 / 进度线用，**不给照片加滤镜**：
 *    照片一律按原始色彩呈现，调色只发生在页面纸面上。
 * ⚠️ 每张照片**只能出现在一个章节**里（`assertPhotoSets()` 会查重）。
 */
const SET_PLAN: readonly PhotoSetPlan[] = [
  {
    id: 'azure',
    name: { zh: '晴蓝', en: 'Open blue' },
    description: {
      zh: '天空铺开，城市与人向光而立。',
      en: 'Open skies. Cities and people turning towards the light.',
    },
    palette: { background: '#BCD5E3', foreground: '#183747', accent: '#416C86' },
    ids: [
      'pavilion-photo',
      'pavilion-photo-2',
      'sunward',
      'mazu-overlooking-sea',
      'qingri-molun',
      'old-village-walk',
      'campus',
    ],
  },
  {
    id: 'mist',
    name: { zh: '雾青', en: 'Blue in shadow' },
    description: {
      zh: '山退进云里，轮廓在阴影中留下。',
      en: 'Mountains recede into cloud. Outlines linger in the shadows.',
    },
    palette: { background: '#263A42', foreground: '#E6EEF0', accent: '#A7C5CD' },
    ids: [
      'mountain-cloud',
      'mountain-bird',
      'zhangjiajie-mountains',
      'guyong-city',
      'zhangyuan-panorama',
      'cave',
    ],
  },
  {
    id: 'moss',
    name: { zh: '苔绿', en: 'Quiet green' },
    description: {
      zh: '沿着山谷和道路，绿色慢慢抵达远处。',
      en: 'Through valleys and along roads, green reaches into the distance.',
    },
    palette: { background: '#CCD1B9', foreground: '#29352B', accent: '#61704C' },
    ids: ['binglang-valley', 'road-to-city', 'urban-village', 'daylight'],
  },
  {
    id: 'amber',
    name: { zh: '鎏金', en: 'Held in gold' },
    description: {
      zh: '叶片、水面与晚霞，把一年的光留住。',
      en: 'Leaves, reflections and the last light of a year.',
    },
    palette: { background: '#D7B05E', foreground: '#392B18', accent: '#77501F' },
    ids: [
      'ginkgo-road',
      'ginkgo-road-4',
      'ginkgo-road-1',
      'ginkgo-road-2',
      'sky-mirror',
      'seaside-sunset',
      // 拼图包含多种颜色，按占视觉中心的黄橙年号归入暖色章节。
      'annual-review-2025',
    ],
  },
  {
    id: 'silver',
    name: { zh: '银白', en: 'Pale light' },
    description: {
      zh: '花与枝条，在浅色的天光里呼吸。',
      en: 'Blossoms and branches breathing in the pale light.',
    },
    palette: { background: '#E7E1DE', foreground: '#3E3539', accent: '#8E747F' },

    ids: ['purple-leaf-plum', 'tall-tree'],
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
