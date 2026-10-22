/**
 * 视觉作品素材的**唯一内容来源**（个人摄影 + 海报/设计）。
 *
 * ⚠️ 这个文件与 `aboutProfile.ts` **刻意分开**，两者不能互相污染：
 *
 *    `aboutProfile.ts`  → 就业案例（公司 / 时间 / 成果数字），是**可核对的履历**；
 *    本文件            → 个人摄影与设计作品，是**个人创作的展示**。
 *
 *    方案原文：「这些作品独立展示，不套用到现有公司的工作案例中」，
 *    「新增作品数据与现有就业案例数据分开，不能把个人摄影和海报当成公司案例封面」。
 *    曾经踩过一次同类错误：四个公司案例的封面全挂了 `/color/` 的调色素材，
 *    归属根本不成立（见 `aboutProfile.ts` 里 `Work` 的注释）。所以这里
 *    在开发期直接**断言两套 id 不重叠**，从结构上防止再次混用。
 *
 * ⚠️ **清单是显式的，不自动扫描目录**：`作品/摄影-照片/` 有 26 张，
 *    `作品/海报-设计/八一-个人练习海报/` 有 10 张；实习 PDF 由 internshipPosters 独立登记。
 *    自动列目录会把未经挑选的素材推上网页，而且以后往目录里丢一张新图就会
 *    静默上线。数量判据写在 `assertCollectionCoverage()`，改清单必须同步改那里。
 *
 * ⚠️ 图片文件由 `scripts/build-portfolio-images.py` 生成到 `public/portfolio/`：
 *    1600 档默认展示、2560 档用于查看器及按需高清展示、400 档给缩略图导航。
 *    生成脚本里有一份 **id ↔ 原始文件**的映射表（原图是中文名，集中在那里，
 *    改名不会断链）。**两处清单必须一致** —— `python scripts/build-portfolio-images.py --verify`
 *    会核对源文件、输出文件与比例。
 *
 * ⚠️ 结构（2026-10-10 全量扩展后）：
 *    ① 完整集合 `photoCollection`(26) / `posterCollection`(10) —— 每个原图只登记一次；
 *    ② `visualById` 走 **Map 索引**，重复 id 直接抛错（不能静默覆盖）；
 *    ③ 保留的八张精选是对完整集合的引用（photography / editorial / posters），
 *       兼容既有组件和校验；当前 About 人物专题不等同于旧八图版面。
 */

import type { Bi } from './人物资料'

/** 双语文本：组件一律 `pick(x, lang)` 取值。 */
export type { Bi }

export interface VisualAsset {
  /** 唯一 id：同时是文件名前缀（`<id>-1600.webp` / `<id>-2560.webp` / `<id>-400.webp`） */
  id: string
  /** 作品名 */
  title: Bi
  /**
   * 摄影 / 个人海报登记原始像素宽高（EXIF 摆正后的值）；实习 PDF 另存等比例整数。
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
  /** 用途标注（方案要求）：如「个人封面排版练习」「个人主题海报系列」 */
  note?: Bi
  /** 无障碍替代文本（**按实际画面写**，不能只从中文文件名推测） */
  alt: Bi
}

/** 个人作品路径只在此处由 id 构造；仍需生成脚本验证对应输出真实存在。 */
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

/** 个人主题海报系列的用途标注（九张车辆海报共用）。 */
const POSTER_NOTE: Bi = { zh: '个人主题海报系列', en: 'Personal poster series' }
/** 封面排版练习的用途标注（千年楼阁）。 */
const COVER_NOTE: Bi = { zh: '个人封面排版练习', en: 'Personal cover layout study' }

/* ═══════════════════════ 完整集合 ═══════════════════════
 *
 * ⚠️ 这里的顺序**只是素材清单自己的顺序**，不是页面上出现的顺序：
 *    `/photo` 的章节划分与画廊顺序由 `photoPage.ts` 的 `SET_PLAN` 决定
 *    （按主色与明度编排，晴蓝 → 雾青 → 苔绿 → 鎏金 → 银白），
 *    `photoCollection` 只负责「有哪 26 张」。
 *    分组按题材聚拢，读起来是一段一段的，而不是随机。
 * ⚠️ 尺寸全部来自 `python scripts/build-portfolio-images.py --probe`（EXIF 摆正后）。
 */

/** 摄影完整集合（26 张）。章节划分见 `photoPage.ts`。 */
export const photoCollection: readonly VisualAsset[] = [
  // ---- 山、镜、洞与银杏（画面最开阔的六张）----
  asset(
    'mountain-cloud',
    { zh: '山云', en: 'Mountain & Cloud' },
    5568,
    3712,
    { zh: '云雾中的层叠山脊', en: 'Layered mountain ridges in cloud' },
  ),
  asset(
    'sky-mirror',
    { zh: '天空之镜', en: 'Mirror of the Sky' },
    3712,
    5568,
    { zh: '逆光下的水面倒影与远处的人影', en: 'Backlit reflections on water with a distant figure' },
  ),
  asset(
    'cave',
    { zh: '盗墓笔记', en: 'The Lost Tomb' },
    5568,
    3712,
    { zh: '洞口框出的纵深与两个人物剪影', en: 'Two silhouetted figures framed by a cave mouth' },
  ),
  asset(
    'sunward',
    { zh: '向阳', en: 'Facing the Sun' },
    3712,
    5568,
    { zh: '背对镜头望向海面的两个人影', en: 'Two figures seen from behind, looking out to sea' },
  ),
  asset(
    'daylight',
    { zh: '天光', en: 'Sky Light' },
    5568,
    3712,
    { zh: '海面上方云隙间落下的天光', en: 'Light breaking through clouds above the sea' },
  ),
  asset(
    'ginkgo-road',
    { zh: '银杏路', en: 'Ginkgo Road' },
    6240,
    4160,
    { zh: '逆光下的金色银杏叶', en: 'Golden ginkgo leaves in backlight' },
  ),
  // ---- 银杏组其余三张 ----
  asset(
    'ginkgo-road-1',
    { zh: '银杏路 (1)', en: 'Ginkgo Road I' },
    3840,
    2160,
    { zh: '蓝天下金黄的银杏枝叶', en: 'Golden ginkgo foliage against blue sky' },
  ),
  asset(
    'ginkgo-road-2',
    { zh: '银杏路 (2)', en: 'Ginkgo Road II' },
    3840,
    2160,
    { zh: '蓝天下的银杏树冠', en: 'A ginkgo canopy against blue sky' },
  ),
  asset(
    'ginkgo-road-4',
    { zh: '银杏路4', en: 'Ginkgo Road IV' },
    6240,
    4160,
    { zh: '逆光中虚化的金色银杏叶', en: 'Backlit ginkgo leaves against a blurred background' },
  ),
  // ---- 山与树 ----
  asset(
    'zhangjiajie-mountains',
    { zh: '青山张家界', en: 'Zhangjiajie Mountains' },
    4032,
    2268,
    { zh: '云雾中群山环抱的城镇', en: 'A town among misty mountains' },
  ),
  asset(
    'mountain-bird',
    { zh: '山鸟', en: 'Mountain Birds' },
    3712,
    5568,
    { zh: '乌云下飞过山脊的鸟群', en: 'Birds crossing a ridge beneath dark cloud' },
  ),
  asset(
    'qingri-molun',
    { zh: '青日摩伦', en: 'Qingri Molun' },
    5568,
    3712,
    { zh: '雾中巨大的摩天轮', en: 'A large Ferris wheel in the mist' },
  ),
  asset(
    'tall-tree',
    { zh: '长树', en: 'Tall Tree' },
    3712,
    5568,
    { zh: '仰视光秃的高树', en: 'Looking up a tall bare tree' },
  ),
  // ---- 村落与城镇 ----
  asset(
    'old-village-walk',
    { zh: '漫步老村', en: 'A Walk Through the Old Village' },
    3712,
    5568,
    { zh: '田野间驶过村落的列车', en: 'A train passing fields beside a village' },
  ),
  asset(
    'urban-village',
    { zh: '城中村', en: 'Urban Village' },
    4032,
    2268,
    { zh: '山谷中密集的城中村屋顶', en: 'Dense rooftops of an urban village in a valley' },
  ),
  asset(
    'guyong-city',
    { zh: '古庸城', en: 'Guyong Old Town' },
    4032,
    1968,
    { zh: '群山与云层下的古镇', en: 'An old town beneath mountains and cloud' },
  ),
  asset(
    'road-to-city',
    { zh: '进城之路', en: 'Road to the City' },
    5568,
    3712,
    { zh: '暮色中穿过群山通往城镇的公路', en: 'A road winding through hills toward town at dusk' },
  ),
  // ---- 校园 ----
  asset(
    'campus',
    { zh: '校园', en: 'Campus' },
    3712,
    5568,
    { zh: '蓝天下的路灯', en: 'A street lamp against a clear sky' },
  ),
  asset(
    'zhangyuan-panorama',
    { zh: '张院全景', en: 'Zhangyuan Panorama' },
    5568,
    3712,
    { zh: '俯瞰校园建筑与远处的群山', en: 'An aerial view of the campus and distant mountains' },
  ),
  // ---- 楼阁 ----
  asset(
    'pavilion-photo',
    { zh: '滕王阁', en: 'Tengwang Pavilion' },
    8064,
    4536,
    { zh: '滕王阁与江对岸的城市天际线', en: 'Tengwang Pavilion against the city skyline' },
  ),
  asset(
    'pavilion-photo-2',
    { zh: '滕王阁2', en: 'Tengwang Pavilion II' },
    8064,
    3846,
    { zh: '滕王阁与江对岸的城市天际线（另一张）', en: 'Tengwang Pavilion and the city skyline, second frame' },
  ),
  // ---- 海与花 ----
  asset(
    'mazu-overlooking-sea',
    { zh: '妈祖望海', en: 'Mazu Looking to Sea' },
    3712,
    5568,
    { zh: '仰望蓝天下的妈祖石像', en: 'The Mazu stone statue seen from below against blue sky' },
  ),
  asset(
    'seaside-sunset',
    { zh: '海边落日', en: 'Seaside Sunset' },
    3712,
    5568,
    { zh: '落日下海滩上的人物剪影', en: 'Silhouettes on the beach at sunset' },
  ),
  asset(
    'binglang-valley',
    { zh: '槟榔谷', en: 'Binglang Valley' },
    8064,
    4536,
    { zh: '热带山谷中的河流与山体', en: 'A river running through a tropical valley' },
  ),
  asset(
    'purple-leaf-plum',
    { zh: '红叶李', en: 'Purple-Leaf Plum' },
    3712,
    5568,
    { zh: '枝头盛开的白粉色花朵', en: 'Pale pink and white blossoms on branches' },
  ),
  // ---- 年度总结 ----
  asset(
    'annual-review-2025',
    { zh: '2025年度总结', en: '2025 in Review' },
    6938,
    3800,
    { zh: '由年度照片拼成的 2025 字样', en: 'The year 2025 spelled out over a grid of photographs' },
  ),
]

/** 海报 / 设计完整集合（10 件）：九张车辆主题海报 + 一张封面排版练习。 */
export const posterCollection: readonly VisualAsset[] = [
  asset(
    'mbt-2000',
    { zh: 'MBT-2000', en: 'MBT-2000' },
    5118,
    3198,
    { zh: 'MBT-2000 主战坦克主题海报', en: 'MBT-2000 main battle tank poster' },
    POSTER_NOTE,
  ),
  asset(
    'plz-05',
    { zh: 'PLZ-05榴', en: 'PLZ-05' },
    5118,
    3198,
    { zh: 'PLZ-05 自行榴弹炮主题海报', en: 'PLZ-05 self-propelled howitzer poster' },
    POSTER_NOTE,
  ),
  asset(
    'plz-02',
    { zh: 'PLZ-02轮', en: 'PLZ-02' },
    5118,
    3198,
    { zh: 'PLZ-02 轮式突击炮主题海报', en: 'PLZ-02 wheeled assault gun poster' },
    POSTER_NOTE,
  ),
  asset(
    'aft-09',
    { zh: 'AFT-09', en: 'AFT-09' },
    5118,
    3198,
    { zh: 'AFT-09 反坦克导弹发射车主题海报', en: 'AFT-09 anti-tank missile vehicle poster' },
    POSTER_NOTE,
  ),
  asset(
    'pg4-04a',
    { zh: 'PGZ-04A', en: 'PGZ-04A' },
    5118,
    3198,
    { zh: 'PGZ-04A 弹炮合一自行防空系统主题海报', en: 'PGZ-04A self-propelled gun-and-missile air-defence system poster' },
    POSTER_NOTE,
  ),
  asset(
    'pgz-09',
    { zh: 'PGZ-09高', en: 'PGZ-09' },
    5118,
    3198,
    { zh: 'PGZ-09 自行高炮主题海报', en: 'PGZ-09 self-propelled anti-aircraft gun poster' },
    POSTER_NOTE,
  ),
  asset(
    'ztz-59',
    { zh: 'ZTZ-59式', en: 'ZTZ-59' },
    5118,
    3198,
    { zh: 'ZTZ-59 式主战坦克主题海报', en: 'ZTZ-59 main battle tank poster' },
    POSTER_NOTE,
  ),
  asset(
    'ztz-96a',
    { zh: 'ZTZ-96A', en: 'ZTZ-96A' },
    5118,
    3198,
    { zh: 'ZTZ-96A 主战坦克主题海报', en: 'ZTZ-96A main battle tank poster' },
    POSTER_NOTE,
  ),
  asset(
    'ztz-96',
    { zh: 'ZTZ96式', en: 'ZTZ-96' },
    5118,
    3198,
    { zh: 'ZTZ-96 式主战坦克主题海报', en: 'ZTZ-96 main battle tank poster' },
    POSTER_NOTE,
  ),
  asset(
    'pavilion-cover',
    { zh: '千年楼阁 · 个人封面排版练习', en: 'Millennium Pavilion · personal cover layout study' },
    6666,
    3750,
    {
      zh: '以滕王阁照片排版的封面练习，含标题与信息层级',
      en: 'Cover layout study using the pavilion photograph, with title and information hierarchy',
    },
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

/**
 * 摄影精选三张：山体层次 / 逆光倒影 / 洞口框景。
 * 顺序供使用这组数据的摄影组件读取；当前 BeyondWork 也从个人素材集合取图。
 */
export const photography: readonly VisualAsset[] = [
  visualById('mountain-cloud'),
  visualById('sky-mirror'),
  visualById('cave'),
]

/**
 * 一张摄影原片 + 一张基于它做的封面排版（PosterView 的编辑设计区）。
 * ⚠️ 这是「同一素材 → 不同信息层级」的对照，两张必须**成对**出现；
 *    分成两个不相干的列表就读不出「转换」这件事了。
 */
export const editorial: readonly VisualAsset[] = [
  visualById('pavilion-photo'),
  visualById('pavilion-cover'),
]

/**
 * 三张同系列车辆海报的保留精选：同一套视觉语言换不同主体与色调。
 * ⚠️ 三张都是 5118×3198 ≈ **8:5**，不是 16:9 —— 裁成 16:9 会把标题切掉，
 *    所以作品带里只按**高度**统一、宽度随原始比例走（见 `WorkStrip.vue`）。
 */
export const posters: readonly VisualAsset[] = [
  visualById('mbt-2000'),
  visualById('plz-05'),
  visualById('plz-02'),
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
    label: 'PHOTOGRAPHY',
    title: { zh: '摄影精选', en: 'Selected Photography' },
    lead: {
      zh: '先看画面。三张照片分别处理山体的层次、逆光的倒影与洞口的纵深。',
      en: 'Look first. Three photographs: the layers of a mountain, backlit reflections, and depth framed by a cave mouth.',
    },
  },
  editorial: {
    label: 'FROM PHOTO TO LAYOUT',
    title: { zh: '从照片到版面', en: 'From Photograph to Layout' },
    lead: {
      zh: '从拍下画面，到组织信息。一张照片负责吸引视线，标题、留白与层级决定信息如何被阅读。',
      en: 'From capturing a frame to organising information. The photograph draws the eye; the title, whitespace and hierarchy decide how it is read.',
    },
  },
  posters: {
    label: 'SERIES',
    title: { zh: '系列设计', en: 'Series Design' },
    lead: {
      zh: '同一套视觉语言，换主体、换色调，看它能不能站住。',
      en: 'One visual language, different subjects and tones — a test of whether it holds.',
    },
  },
} as const satisfies Record<string, { label: string; title: Bi; lead: Bi }>

/* ═══════════════════════ 开发期自检 ═══════════════════════ */

/**
 * 保留八张精选接口的结构自检（只在 DEV 调用）。
 *
 * ⚠️ 它防的是**结构错**，不是文案错：
 *   ① 两套 id 命名空间不能重叠 —— 一旦个人作品和公司案例撞 id，锚点、
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
      bad.push(`个人作品 id「${v.id}」与公司案例 id 撞名 —— 两套数据必须分开`)
    }
    if (v.src !== `/portfolio/${v.id}-1600.webp`) bad.push(`${v.id} 的 src 与 id 不一致`)
    if (v.large !== `/portfolio/${v.id}-2560.webp`) bad.push(`${v.id} 的 large 与 id 不一致`)
    if (v.thumb !== `/portfolio/${v.id}-400.webp`) bad.push(`${v.id} 的 thumb 与 id 不一致`)
    if (v.width <= 0 || v.height <= 0) bad.push(`${v.id} 的宽高无效`)
    if (!v.title.zh.trim() || !v.title.en.trim()) bad.push(`${v.id} 的标题缺语言`)
    if (!v.alt.zh.trim() || !v.alt.en.trim()) bad.push(`${v.id} 的替代文本缺语言`)
  }

  if (photography.length !== 3) bad.push(`摄影应为 3 张，实为 ${photography.length}`)
  if (editorial.length !== 2) bad.push(`照片到版面应为 2 张，实为 ${editorial.length}`)
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
 * ⚠️ 26 / 10 是**当前明确授权的素材清单数量**（`作品/摄影-照片/` 26 张、
 *    `作品/海报-设计/八一-个人练习海报/` 10 张）。将来新增素材由清单变更同步更新这里，
 *    不以「自动扫描目录」静默上线。
 * ⚠️ 前端数量自检**不能代替**文件覆盖检查 —— 那一步在
 *    `scripts/build-portfolio-images.py --verify`（源 / 输出 / 比例）。
 */
export function assertCollectionCoverage(workIds: readonly string[]): void {
  const bad: string[] = []

  if (photoCollection.length !== 26) {
    bad.push(`摄影完整集合应为 26 张，实为 ${photoCollection.length}`)
  }
  if (posterCollection.length !== 10) {
    bad.push(`海报完整集合应为 10 件，实为 ${posterCollection.length}`)
  }

  const seen = new Set<string>()
  for (const item of [...photoCollection, ...posterCollection]) {
    if (seen.has(item.id)) bad.push(`完整集合 id 重复：${item.id}`)
    seen.add(item.id)

    if (workIds.includes(item.id)) {
      bad.push(`素材 id「${item.id}」与公司案例撞名 —— 两套数据必须分开`)
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
    bad.push(`摄影完整集合必须有横有竖，实测竖 ${portrait} / 共 ${photoCollection.length}`)
  }

  if (bad.length) {
    throw new Error(`[visualPortfolio] 完整集合自检失败:\n  - ${bad.join('\n  - ')}`)
  }
}
