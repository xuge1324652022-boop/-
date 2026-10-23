/**
 * 公开模板调色页的合成短片清单。
 * 15 段静音短片均由程序生成的几何图形组成，不包含个人原片、实拍场景或真实调色履历。
 * 保留清单字段与导出接口，供播放器、预览、字幕和分段轨道共用。
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
    title: '示例01',
    en: 'SAMPLE 01',
    note: '网格上的合成色块',
    color: '#5e4423',
  },
  {
    n: 2,
    src: enc(2),
    title: '示例02',
    en: 'SAMPLE 02',
    note: '圆环与色块形成对比',
    color: '#006c7e',
  },
  {
    n: 3,
    src: enc(3),
    title: '示例03',
    en: 'SAMPLE 03',
    note: '短线标识信息层级',
    color: '#096476',
  },
  {
    n: 4,
    src: enc(4),
    title: '示例04',
    en: 'SAMPLE 04',
    note: '留白连接几何元素',
    color: '#145970',
  },
  {
    n: 5,
    src: enc(5),
    title: '示例05',
    en: 'SAMPLE 05',
    note: '几何形状展示层次',
    color: '#526c4c',
  },
  {
    n: 6,
    src: enc(6),
    title: '示例06',
    en: 'SAMPLE 06',
    note: '色块呼应网格背景',
    color: '#324e5f',
  },
  {
    n: 7,
    src: enc(7),
    title: '示例07',
    en: 'SAMPLE 07',
    note: '圆环形成视觉重心',
    color: '#095c75',
  },
  {
    n: 8,
    src: enc(8),
    title: '示例08',
    en: 'SAMPLE 08',
    note: '横向版面保留构图',
    color: '#104f6c',
  },
  {
    n: 9,
    src: enc(9),
    title: '示例09',
    en: 'SAMPLE 09',
    note: '合成图形持续循环',
    color: '#531b05',
  },
  {
    n: 10,
    src: enc(10),
    title: '示例10',
    en: 'SAMPLE 10',
    note: '色彩关系保持统一',
    color: '#0067d7',
  },
  {
    n: 11,
    src: enc(11),
    title: '示例11',
    en: 'SAMPLE 11',
    note: '深浅背景衬托图形',
    color: '#34545b',
  },
  {
    n: 12,
    src: enc(12),
    title: '示例12',
    en: 'SAMPLE 12',
    note: '合成短片演示播放',
    color: '#3c4a42',
  },
  {
    n: 13,
    src: enc(13),
    title: '示例13',
    en: 'SAMPLE 13',
    note: '色块与圆环相互呼应',
    color: '#5d4d40',
  },
  {
    n: 14,
    src: enc(14),
    title: '示例14',
    en: 'SAMPLE 14',
    note: '几何版面完成组合',
    color: '#5d573d',
  },
  {
    n: 15,
    src: enc(15),
    title: '示例15',
    en: 'SAMPLE 15',
    note: '合成素材完成收束',
    color: '#007e78',
  },

]

/** 新增示例时，预览、读数与分段轨道随同一份清单更新。 */
export const CLIP_COUNT = CLIPS.length
export const PREVIEWS = CLIPS.map((clip) => ({
  src: clip.src,
  previewSrc: `/color-previews/clip-${clip.n}.mp4`,
  poster: `/color-previews/clip-${clip.n}.jpg`,
}))

export const COLOR_INTRO = {
  zh: `${CLIP_COUNT} 段合成静音短片，用来演示视频播放、滚动叙事和分段色轨。图像完全由几何元素生成，可替换为自己的公开作品`,
  en: `${CLIP_COUNT} synthetic silent clips demonstrate video playback, scrolling storytelling and segmented colour tracks. The geometry is programmatically generated and can be replaced with your own public work`,
}
export const INTRO_LABEL = { zh: '示例说明', en: 'Sample introduction' }

/** 只引用 public/color 内的公开合成短片；文件名含空格，地址必须编码。 */
function enc(n: number): string {
  return `/color/${encodeURIComponent(`color grade-${n}.mp4`)}`
}

export const NOTES: readonly { k: string; v: string; en: string }[] = [
  {
    k: '合成素材',
    v: '短片完全由程序生成的网格、色块与圆环组成，不使用真实摄影画面、声音或个人素材',
    en: 'Each clip consists of programmatically generated grids, colour blocks and rings, without real footage, audio or personal material',
  },
  {
    k: '交互示例',
    v: '通过静音循环、分段导航与滚动切换，演示调色作品页的浏览体验，不表示真实项目成果',
    en: 'Silent loops, segmented navigation and scroll transitions demonstrate a colour portfolio browsing experience without claiming real project work',
  },
  {
    k: '替换提示',
    v: '使用自己的公开作品时，同步更新字幕、说明、预览与尺寸，并在不同屏幕中检查播放和阅读体验',
    en: 'When adding your own public work, update captions, descriptions, previews and dimensions, then review playback and reading across screen sizes',
  },
]

/** 轨道色仅用于模板的导航区分，不声称由真实作品抽帧测得。 */
const TRACK_COLORS = CLIPS.map((clip) => clip.color)

/** 将清单颜色沿水平方向均分，供底部分段轨道使用。 */
export const COLOR_TRACK_FACE = (() => {
  const pct = 100 / TRACK_COLORS.length
  const stops = TRACK_COLORS.map(
    (c, i) => `${c} ${(i * pct).toFixed(3)}% ${((i + 1) * pct).toFixed(3)}%`,
  )
  return `linear-gradient(90deg, ${stops.join(', ')})`
})()
