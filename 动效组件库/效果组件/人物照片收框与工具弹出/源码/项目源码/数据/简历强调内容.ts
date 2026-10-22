/**
 * 公开模板的文字强调映射；仅引用虚构占位内容。
 * 与 aboutProfile 的示例正文保持一致，不包含真实简历或履历事实。
 */
import type { Lang } from './人物资料'

export interface ResumeTextPart {
  text: string
  strong: boolean
}

const DETAIL_EMPHASIS: Readonly<Record<string, readonly Record<Lang, readonly string[]>[]>> = {
  'template-content': [
    {
      zh: ['虚构需求', '受众、信息与表达方向'],
      en: ['fictional brief', 'audience, information and communication goals'],
    },
    {
      zh: ['脚本、素材筛选、节奏剪辑与字幕检查'],
      en: ['scripting, asset selection, pacing and subtitle review'],
    },
    { zh: ['虚构活动', '统一命名'], en: ['fictional activity', 'consistent names'] },
    {
      zh: ['演示版本', '不使用真实账号数据或个人业绩'],
      en: ['demonstration data rather than real account metrics or personal achievements'],
    },
    {
      zh: ['素材授权、内容检查与文件清单'],
      en: ['asset permissions, content review and a delivery checklist'],
    },
  ],
  'template-ai': [
    {
      zh: ['虚构主题', '故事结构、镜头顺序与画面说明'],
      en: ['story structure, shot order and visual notes', 'fictional topic'],
    },
    { zh: ['不同画面方向', '一致性检查步骤'], en: ['visual directions', 'consistency checks'] },
    {
      zh: ['尺寸、字幕与文件版本', '可复用清单'],
      en: ['dimensions, subtitles and file versions', 'reusable checklist'],
    },
  ],
  'template-product': [
    {
      zh: ['虚构产品', '镜头清单、场景说明与素材目录'],
      en: ['shots, scene notes and an asset catalogue', 'fictional product'],
    },
    {
      zh: ['不关联真实客户、品牌或商业成果'],
      en: ['without reference to a real client, brand or commercial result'],
    },
  ],
  'media-centre': [
    {
      zh: ['虚构活动', '设备清单、记录计划与协作约定'],
      en: ['equipment, documentation and collaboration checklists', 'fictional activity'],
    },
    {
      zh: ['演示素材', '不包含真实学校、媒体推选或获奖记录'],
      en: ['demonstration assets', 'without real university, media or award records'],
    },
  ],
}

/** 下标与 FACTS 展示顺序绑定。 */
const FACT_EMPHASIS: Readonly<Record<number, Record<Lang, readonly string[]>>> = {
  3: { zh: ['示例院校', '20XX.XX – 20XX.XX'], en: ['Example University', '20XX.XX – 20XX.XX'] },
  5: { zh: ['示例奖项', '示例项目表彰'], en: ['Example Award', 'Example Project Recognition'] },
}

const SKILL_EMPHASIS: Readonly<Record<string, Record<Lang, readonly string[]>>> = {
  'post-production': {
    zh: ['模板示例', '文字排版、图像处理、视频剪辑与文件协作'],
    en: ['Template example', 'typography, image editing, video editing and file collaboration'],
  },
  'ai-software': {
    zh: ['模板示例', '人工检查最终交付'],
    en: ['Template example', 'review the final deliverable manually'],
  },
}

/** 只拆分纯文本给 Vue 转义插值；不插 HTML，保证原文拼接后完全不变。 */
export function splitResumeEmphasis(text: string, fragments: readonly string[]): ResumeTextPart[] {
  const ranges: { start: number; end: number }[] = []
  for (const fragment of fragments) {
    if (!fragment) continue
    let start = text.indexOf(fragment)
    while (start !== -1) {
      ranges.push({ start, end: start + fragment.length })
      start = text.indexOf(fragment, start + fragment.length)
    }
  }
  if (!ranges.length) return [{ text, strong: false }]
  ranges.sort((a, b) => a.start - b.start || b.end - a.end)
  // 先合并嵌套与相邻命中，防止长短重点片段重叠造成文字重复或丢失。
  const merged: typeof ranges = []
  for (const range of ranges) {
    const previous = merged[merged.length - 1]
    if (previous && range.start <= previous.end) previous.end = Math.max(previous.end, range.end)
    else merged.push({ ...range })
  }
  const parts: ResumeTextPart[] = []
  let cursor = 0
  for (const range of merged) {
    if (cursor < range.start) parts.push({ text: text.slice(cursor, range.start), strong: false })
    parts.push({ text: text.slice(range.start, range.end), strong: true })
    cursor = range.end
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor), strong: false })
  return parts
}

/** 经历按稳定 id + 详情序号取重点；找不到映射就保留普通正文，不猜测加粗内容。 */
export function resumeDetailParts(
  text: string,
  experienceId: string,
  detailIndex: number,
  lang: Lang,
): ResumeTextPart[] {
  return splitResumeEmphasis(text, DETAIL_EMPHASIS[experienceId]?.[detailIndex]?.[lang] ?? [])
}

/** 资料行按 FACTS 下标关联；调整行序时同步更新 FACT_EMPHASIS。 */
export function resumeFactParts(text: string, factIndex: number, lang: Lang): ResumeTextPart[] {
  return splitResumeEmphasis(text, FACT_EMPHASIS[factIndex]?.[lang] ?? [])
}

/** 技能使用 id 而非显示名称，避免语言切换影响查找。 */
export function resumeSkillParts(text: string, skillId: string, lang: Lang): ResumeTextPart[] {
  return splitResumeEmphasis(text, SKILL_EMPHASIS[skillId]?.[lang] ?? [])
}
