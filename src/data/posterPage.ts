/**
 * `/poster` 海报页的**唯一文案与版面配置来源**。
 *
 * 与 `photoPage.ts` 同构：素材本体在 `visualPortfolio.ts`，这里只描述
 * 「这一页怎么组织」。两者都不碰 `aboutProfile.ts`（就业案例）。
 *
 * ⚠️ 页面背景是**暖色纸**：色板在 `PosterView.vue` 的根节点上覆盖 `--ab-*`
 *    （那几个变量定义在 `src/style.css` 的 `:root`，是全局的），
 *    这样复用的 AboutSection / EditorialPair 会继承暖色系，不用复制一套组件。
 */

import type { Bi } from './aboutProfile'
import { editorial, posterCollection, type VisualAsset } from './visualPortfolio'

/** 页面顶部开场 */
export const HERO = {
  /** 英文大标题（固定英文，不参与语言切换，与 /photo、/about 首屏同构） */
  big: 'POSTER / DESIGN',
  kicker: { zh: '海报与版面', en: 'Poster & Layout' } as Bi,
} as const

/** 军事海报色带的章节标题；周年表述按本次作品主题固定，不随当前年份推算。 */
export const MILITARY_SERIES_TITLE: Bi = {
  zh: '战争雷霆-军事海报-纪念中华人民共和国人民解放军建军99周年',
  en: 'War Thunder — Military Posters — Commemorating the 99th Anniversary of the People’s Liberation Army',
}

/**
 * 用户提供的装备介绍，按稳定的素材 id 对应到海报，不依赖展示顺序。
 * pg4-04a 是原素材的文件标识；展示名称使用用户指定的 PGZ-04A。
 */
export const MILITARY_PROFILES: Readonly<Record<string, Bi>> = {
  'aft-09': {
    zh: 'AFT-09（红箭-9反坦克导弹发射车）：基于 WZ550 4×4 轮式底盘，搭载红箭-9重型反坦克导弹，采用激光指令制导与大威力串联战斗部。主打远距离打击敌方主战坦克、坚固工事，是陆军重型车载反坦克平台。',
    en: 'AFT-09 (HJ-9 anti-tank missile carrier): built on the WZ550 4×4 wheeled chassis, carrying heavy HJ-9 missiles with laser command guidance and tandem warheads. A heavy vehicle-mounted anti-tank platform for engaging main battle tanks and fortified positions at long range.',
  },
  'mbt-2000': {
    zh: 'MBT-2000 主战坦克（VT-1，外贸型号）：国产第三代外贸主战坦克，源自 90-II 坦克项目。配备 125mm 滑膛炮、自动装弹机、复合装甲与外挂反应装甲，主打外销；巴基斯坦大量装备其阿哈利德型号，兼顾火力、机动与防护。',
    en: 'MBT-2000 (VT-1, export model): a Chinese third-generation export main battle tank derived from the Type 90-II project. A 125mm smoothbore gun, autoloader, composite armour and add-on reactive armour balance firepower, mobility and protection. Its Al-Khalid variant is widely fielded in Pakistan.',
  },
  'pg4-04a': {
    zh: 'PGZ-04A 弹炮合一自行防空系统：PGZ95 的改进型，搭载 4 门 25mm 机关炮与飞弩-6防空导弹，采用履带底盘。弹炮结合，伴随装甲部队拦截低空直升机、巡航导弹与无人机，承担近距离野战防空。',
    en: 'PGZ-04A self-propelled gun-and-missile air-defence system: an improved PGZ95 on a tracked chassis, combining four 25mm autocannons with FN-6 surface-to-air missiles. It accompanies armoured formations and provides close-range field air defence against low-flying helicopters, cruise missiles and drones.',
  },
  'pgz-09': {
    zh: 'PGZ-09 式双 35 毫米自行高炮：陆军高端履带式自行高炮，配备两门 35mm 转膛机关炮、有源相控阵雷达与全套光电火控，可发射可编程预制破片弹药。是装甲集群伴随防空核心，用于拦截直升机、低空导弹与无人机，造价昂贵。',
    en: 'PGZ-09 twin-35mm self-propelled anti-aircraft gun: a high-end tracked system with two 35mm revolver cannons, active phased-array radar and electro-optical fire control, capable of firing programmable prefragmented ammunition. A costly air-defence platform accompanying armoured formations against helicopters, low-flying missiles and drones.',
  },
  'plz-02': {
    zh: 'PLZ-02 轮式突击炮（PTL-02）：基于 WZ551 6×6 轮式底盘，搭载 100mm 反坦克炮，是我军第一款大规模列装的轮式突击炮。机动快，适合快反部队执行反坦克、攻坚与火力支援；外贸版本 WMA301 在多国服役。',
    en: 'PLZ-02 wheeled assault gun (PTL-02): based on the WZ551 6×6 chassis and armed with a 100mm anti-tank gun, it was the first wheeled assault gun fielded by China in large numbers. Its mobility suits rapid-reaction units for anti-tank combat, assaults and fire support. The WMA301 export version serves in several countries.',
  },
  'plz-05': {
    zh: 'PLZ-05 式 155mm 自行加榴炮：国产主力远程履带自行火炮，配备 52 倍径 155mm 长身管与自动装弹机。常规榴弹射程约 40km，火箭增程弹可达 70km 以上，制导炮弹可实现百公里精确打击；是陆军远程压制核心装备，被称为“陆战之神”。',
    en: 'PLZ-05 155mm self-propelled howitzer: a principal Chinese long-range tracked artillery system with a 52-calibre barrel and autoloader. Conventional shells reach about 40km, rocket-assisted rounds exceed 70km, and guided shells can deliver precision strikes at 100km. A core long-range suppression platform, known as the “god of land warfare”.',
  },
  'ztz-59': {
    zh: 'ZTZ-59 式主战坦克：我国第一代国产主战坦克，仿制 T-54A，搭载 100mm 线膛炮。建国后大规模列装，构成初代钢铁洪流，服役数十年并发展出大量改进型号，是国产坦克发展的起点。',
    en: 'ZTZ-59 main battle tank: China’s first domestically produced main battle tank, based on the T-54A and armed with a 100mm rifled gun. Fielded in large numbers after the founding of the PRC, it served for decades, spawned many improved variants and marked the starting point of Chinese tank development.',
  },
  'ztz-96a': {
    zh: 'ZTZ-96A 主战坦克：96 式坦克的深度改进版本，升级上反观瞄、热成像与楔形附加装甲，配备 125mm 滑膛炮和自动装弹机。综合性能对标 T-72，性价比高，曾参加坦克两项竞赛，是本世纪陆军主力坦克之一。',
    en: 'ZTZ-96A main battle tank: a substantially upgraded Type 96 with improved sights, thermal imaging and wedge-shaped add-on armour, retaining a 125mm smoothbore gun and autoloader. A cost-effective tank with overall performance benchmarked against the T-72, it has competed in the Tank Biathlon and is a principal PLA tank of this century.',
  },
  'ztz-96': {
    zh: 'ZTZ-96 式主战坦克：20 世纪 90 年代定型列装的二代半主战坦克，配备 125mm 滑膛炮与下反稳像火控。在 96A 之前大批量装备，填补 99 式成本较高带来的数量缺口，是 90 年代至 2000 年代装甲部队的中坚力量。',
    en: 'ZTZ-96 main battle tank: a second-and-a-half-generation tank introduced in the 1990s, with a 125mm smoothbore gun and stabilised fire control. Produced in large numbers before the 96A, it filled the numerical gap left by the more expensive Type 99 and formed a backbone of armoured units through the 1990s and 2000s.',
  },
}

/**
 * 编辑设计的章节头文案（全屏海报展示由调色板与色彩章节各自说明）。
 * ⚠️ 这里**没有** `series` 条目：01 段的标题与导语在 `PosterPalette` /
 *    `PosterColourChapters` 内部各写各的（它们的版式各不相同，
 *    共用一段 `lead` 反而会逼出两处都不贴切的文案）。
 *    留一个没人读的 `SECTIONS.series` 只会让人以为改它能改页面。
 * ⚠️ 2026-10-13 删掉了 `SECTIONS.index`：它服务的「个人作品目录」一屏已移除
 *    （见 `PosterView.vue` 里那段说明），留着就是一个改不动的死配置。
 */
export const SECTIONS = {
  pair: {
    label: 'EDITORIAL DESIGN',
    title: { zh: '编辑设计', en: 'Editorial Design' },
    lead: {
      zh: '同一张照片的两种用法：摄影原片与基于它制作的个人封面排版练习。',
      en: 'One photograph used twice: the original frame and a personal cover layout study built from it.',
    },
  },
} as const

/* ─────────────────────── 页面用的数组（对完整集合的引用） ─────────────────────── */

/**
 * 调色板与色彩章节共用的九张车辆主题海报
 * （**不含**封面排版练习 —— 那是编辑设计那一屏的事）。
 * ⚠️ 顺序 = 两处共用的切换顺序，沿用原 MBT-2000 / PLZ-05 / PLZ-02 在前。
 */
export const posterSeries: readonly VisualAsset[] = posterCollection.filter(
  (item) => item.id !== 'pavilion-cover',
)

/** 编辑设计的两张：原片 + 封面练习（成对出现，顺序不能反）。 */
export const editorialPair: readonly VisualAsset[] = editorial
