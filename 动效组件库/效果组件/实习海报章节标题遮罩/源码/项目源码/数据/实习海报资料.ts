/**
 * 实习 PDF 版面登记：plan 管文案和来源页号，manifest 管稳定素材 id 与比例。
 * 页面只消费此处筛选后的干净展示图；转换清单保留完整页号，删除展位不删除原件。
 * JSON 字段与重建顺序见本目录 README.md，个人军事练习仍由 visualPortfolio 独立登记。
 */
import plan from './实习海报动效计划.json'
import manifest from './实习海报素材.json'
import type { Bi } from './人物资料'
import type { VisualAsset } from './视觉作品资料'

export interface InternshipPosterGroup {
  id: string
  title: Bi
  description: Bi
  items: readonly VisualAsset[]
}

const attribution: Bi = { zh: '实习产出', en: 'Internship work' }
// 图片内容更新时使用同一版本号，开场、卡片和查看器一起刷新浏览器缓存。
const previewVersion = 'brand-free-20261014'

// 保留原 PDF 与转换清单；网页及查看器只收录选定海报。
// 工程引导只保留 EC100 封面；GNSS 产品阵列与工地场景同步退出展示、开场和查看器。
// V10L 只保留第1页与第12–15页，Vela 只展示封面。
const posterPageSelection: Readonly<Record<string, readonly number[]>> = {
  'demo-guidance': [1],
  'demo-measure': [1, 12, 13, 14, 15],
  'demo-garden': [1],
}

// 通过 group + 一基页号连接两份清单；缺项立即报错，不静默发布破图。
export const internshipGroups: readonly InternshipPosterGroup[] = plan.map(group => ({
  id: group.id,
  title: group.title,
  description: group.description,
  items: group.pages.filter(page => !posterPageSelection[group.id] || posterPageSelection[group.id]!.includes(page.page)).map(page => {
    const entry = manifest.find(item => item.group === group.id && item.page === page.page)
    if (!entry) throw new Error(`Missing PDF preview: ${group.id}, page ${page.page}`)
    return {
      id: entry.id,
      title: page.title,
      // manifest 是 PDF 点数 ×100 的比例整数，不是 WebP 文件的实际像素尺寸。
      width: entry.width,
      height: entry.height,
      src: `/internship-clean/${entry.id}-1600.webp?v=${previewVersion}`,
      large: `/internship-clean/${entry.id}-2560.webp?v=${previewVersion}`,
      thumb: `/internship-clean/${entry.id}-400.webp?v=${previewVersion}`,
      note: attribution,
      alt: { zh: `${page.title.zh}，产品介绍版面`, en: `${page.title.en}, product communication layout` },
    }
  }),
}))

export const internshipPages = internshipGroups.flatMap(group => group.items)
// 开场叠层只使用当前保留的海报；筛选后的海报在下方展示区直接展开。
const FEATURED_IDS = ['demo-guidance-01', 'demo-measure-01', 'demo-garden-01']
// 这些内部 id 兼容既有导出文件与动效映射；可见品牌字样由清理后的图片内容决定。
export const internshipFeatured = FEATURED_IDS.map(id => {
  const item = internshipPages.find(page => page.id === id)
  if (!item) throw new Error(`Missing featured internship poster: ${id}`)
  return item
})

export const POSTER_INTRO: Bi = {
  zh: '把技术信息，变成清晰的视觉表达。从实习中的产品介绍，到个人军事海报练习，让文字、画面与节奏一起传达主题',
  en: 'Turning technical information into clear visual communication. From product communication to personal military poster studies, type, imagery and rhythm work together to express the subject',
}
