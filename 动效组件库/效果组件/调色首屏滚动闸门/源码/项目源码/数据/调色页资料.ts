/** 调色页的事实登记：作品路径、双语文案、预览和分段色轨均从同一份成片清单派生。 */
/*
 * 03 / COLOR 的专属叙事页（白底、滚动叙事）。
 *
 * 使用独立路由 /color 展示真实调色成片；规范卡号通过 jumpPathFor 分流，
 * 通用 /card/:id 仍作为兼容占位入口，不负责本页的叙事结构。
 */

/*
 * 真实调色成片的显式清单。文件名含空格，src 必须编码。
 * 三段文字按**画面特征**写：中文大字 / 英文大写 / 一句画面观察，
 * 与画廊里 03 卡左下角那几行是同一套语法（「画面特征 → 短句」）。
 *
 * ⚠️ 第三行（note）的字数**是有约束的**，不是随手写的长短：
 *    `.cview__caption .cview__line:first-child` 这条规则把 caption 里**每一行**
 *    都匹配上了（每行的 `.cview__mask` 里它都是 first-child），所以 note 实际
 *    按 52px 那一档渲染（1440 实测 48.96px），一行只放得下 11 个汉字。于是
 *    每段 note 的行数由字数决定，而行数直接决定区块高度：
 *      · 320px（11 字/行）与 1440px（11 字/行）要 2 行 ⇒ 12~22 字
 *      · 390px（14 字/行）要 1 行 ⇒ ≤14 字（第 2 段例外：它 390 下本来就是 2 行）
 *      · 9 / 10 / 12 / 14 段三处要保持 1 行 ⇒ ≤11 字
 *    改文案前需在 320 / 390 / 1440px 检查各段换行与区块高度，避免改变阅读节奏。
 */
export const CLIPS: readonly {
  n: number
  src: string
  title: string
  en: string
  note: string
  color: string
}[] = [
  {
    n: 1,
    src: enc(1),
    title: '逆光',
    en: 'BACKLIT',
    note: '书架前的人影只剩一道轮廓',
    color: '#5e4423',
  },
  {
    n: 2,
    src: enc(2),
    title: '雪线',
    en: 'SNOWLINE',
    note: '山脊逆着强光，雪线只剩一条白边',
    color: '#006c7e',
  },
  {
    n: 3,
    src: enc(3),
    title: '灯塔',
    en: 'LIGHTHOUSE',
    note: '小船拖出尾迹，灯塔立在堤上',
    color: '#096476',
  },
  {
    n: 4,
    src: enc(4),
    title: '退潮',
    en: 'LOW TIDE',
    note: '深蓝海面上，灯塔与远岛相望',
    color: '#145970',
  },
  {
    n: 5,
    src: enc(5),
    title: '荒脊',
    en: 'RIDGE',
    note: '残雪压着赭石坡，脊线顶住天',
    color: '#526c4c',
  },
  {
    n: 6,
    src: enc(6),
    title: '谷地',
    en: 'VALLEY',
    note: '谷底蓝影里，远山一层层退青',
    color: '#324e5f',
  },
  {
    n: 7,
    src: enc(7),
    title: '红白',
    en: 'RED & WHITE',
    note: '红白条纹绕着塔身，蓝天当底',
    color: '#095c75',
  },
  {
    n: 8,
    src: enc(8),
    title: '海岸',
    en: 'COASTLINE',
    note: '浪推上滩，人小得像一串逗号',
    color: '#104f6c',
  },
  {
    n: 9,
    src: enc(9),
    title: '篝火',
    en: 'CAMPFIRE',
    note: '四周吃成黑，只剩火舌',
    color: '#531b05',
  },
  {
    n: 10,
    src: enc(10),
    title: '山光',
    en: 'SUNLIT',
    note: '亮坡烧到顶，暗坡沉蓝',
    color: '#0067d7',
  },
  {
    n: 11,
    src: enc(11),
    title: '雾海',
    en: 'SEA OF FOG',
    note: '云从谷里漫上来，把山吃掉',
    color: '#34545b',
  },
  {
    n: 12,
    src: enc(12),
    title: '金时',
    en: 'GOLDEN HOUR',
    note: '斜光把楼群染成暖色',
    color: '#3c4a42',
  },
  {
    n: 13,
    src: enc(13),
    title: '跋涉',
    en: 'TREK',
    note: '碎石与残雪里，只剩一双黄靴',
    color: '#5d4d40',
  },
  {
    n: 14,
    src: enc(14),
    title: '抵达',
    en: 'ARRIVAL',
    note: '楼群与路网铺到天边',
    color: '#5d573d',
  },
  {
    n: 15,
    src: enc(15),
    title: '青潮',
    en: 'TURQUOISE TIDE',
    note: '白浪沿礁石铺开，海水显出青绿',
    color: '#007e78',
  },
]
// 成片数统一由清单派生，新增素材时读数、文案与分段刻度会一起更新。
export const CLIP_COUNT = CLIPS.length
// 小尺寸指针素材场不解码 4K 母版；正文仍使用独立的 1080p 网页成片。
export const PREVIEWS = CLIPS.map((clip) => ({
  src: clip.src,
  previewSrc: `/color-previews/clip-${clip.n}.mp4`,
  poster: `/color-previews/clip-${clip.n}.jpg`,
}))
// 作者确认全部素材围绕 DaVinci Resolve 与 Kodak 2383 制作；双语开篇与理念保持一致。
export const COLOR_INTRO = {
  zh: `${CLIP_COUNT} 段影像均在 DaVinci Resolve 中完成调色，围绕 Kodak 2383 的胶片色彩风格展开，探索不同光线与场景中的影像情绪`,
  en: `${CLIP_COUNT} clips graded in DaVinci Resolve, exploring the Kodak 2383 film look across different lighting conditions, scenes and moods`,
}
export const INTRO_LABEL = { zh: '开篇', en: 'Intro' }

/**
 * 素材地址：`color grade-N.mp4`。
 * ⚠️ 文件名里有空格，必须 `encodeURIComponent`；原片在 `作品/调色-成片/`。
 *    中间件优先读 `media/color/` 的网页版本，没有时读原片（不进 dist、不入库）。
 */
function enc(n: number): string {
  return `/color/${encodeURIComponent(`color grade-${n}.mp4`)}`
}

/*
 * 三条理念分别说明制作工具、2383 风格方向与素材适配，沿用逐条错峰揭示。
 * 只使用作者确认的制作背景，不补写未经确认的 LUT、节点链或色彩空间参数。
 */
export const NOTES: readonly { k: string; v: string; en: string }[] = [
  {
    k: '达芬奇调色',
    v: '以 DaVinci Resolve 为创作工具，让明暗、冷暖与色彩关系服务于画面表达',
    en: 'Grading in DaVinci Resolve, using light, contrast and colour to shape the image',
  },
  {
    k: '柯达 2383',
    v: '以 Kodak 2383 为色彩方向，探索胶片观感与不同场景的情绪表达',
    en: 'Exploring the Kodak 2383 look as a shared colour direction across different scenes',
  },
  {
    k: '素材适配',
    v: '在统一的 2383 风格下，依照每段素材的光线与内容调整，让影像保留各自的气质',
    en: 'Adapting the shared 2383 look to each clip’s light and subject, while preserving its character',
  },
]

/*
 * 每段成片各自的主色调，给底部进度条用。
 *
 * 来源：成片各抽一帧，下采样后按**饱和度加权**
 * 取平均 —— 直接取平均会偏灰（画面里总有黑有白），按 sat² 加权并压低极暗
 * 与极亮像素，调色特征才浮得出来。最后整体提了 1.45 倍饱和：色轮上要一眼
 * 分得开相邻两段。
 *
 * 主色与作品登记在同一条 CLIPS 数据中，避免新增时漏掉一段色或读数。
 * 重抽帧后只需更新该作品的 color。
 *
 * 为什么写成常量而不是运行时取：运行时取要解码全部静帧并跑一遍 canvas，
 * 而这是纯静态的构图参数 —— 跟字号、间距一样，该写死。
 */
const TRACK_COLORS = CLIPS.map((clip) => clip.color)

/**
 * 轨道：按素材清单长度沿**水平方向**均分，左起按序铺满整条。
 * 段间的暗缝由 CSS 的 `repeating-linear-gradient` 叠出来，这里只管色。
 *
 * ⚠️ 必须 `90deg`（横向）：linear-gradient 默认 `180deg`（从上往下），
 *    漏了这个方向整条会变成竖向渐变 —— 在 4px 高的条上看上去就是一块纯色，
 *    而「离开的是第几段」这个读数也就没了。
 */
export const COLOR_TRACK_FACE = (() => {
  const pct = 100 / TRACK_COLORS.length
  const stops = TRACK_COLORS.map(
    (c, i) => `${c} ${(i * pct).toFixed(3)}% ${((i + 1) * pct).toFixed(3)}%`,
  )
  return `linear-gradient(90deg, ${stops.join(', ')})`
})()
