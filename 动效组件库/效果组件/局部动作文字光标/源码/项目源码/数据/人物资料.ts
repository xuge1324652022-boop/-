/**
 * 公开模板示例资料。姓名、教育、组织、经历、成果与联系方式均为虚构占位，
 * 不对应仓库作者或任何真实求职者；使用前应自行填写并核对发布范围。
 * 保留双语、稳定作品 ID 与数组结构，供现有展示及动效组件演示。
 */
export type Lang = 'zh' | 'en'

export interface Bi {
  zh: string
  en: string
}

/** 展示时去掉文案末尾的句号。 */
export const withoutFinalStop = (value: string): string => value.replace(/[。．.]+(?=\s*$)/u, '')
export const pick = (v: Bi, lang: Lang): string => withoutFinalStop(v[lang])

export const IDENTITY = {
  nameZh: '示例求职者',
  nameEn: 'Example Candidate',
  initials: 'EC',
  en: { title: 'Meet the Example Candidate', short: 'Example' },
  zh: { title: '关于这位示例求职者' },
} as const

export const TAGLINE: Bi = {
  zh: '模板示例：把想法整理为清晰的表达。',
  en: 'Template example: turn ideas into clear communication.',
}

export const ROLE_LINE: Bi = {
  zh: '模板示例 · 内容策划 · 视觉表达',
  en: 'Template example · Content planning · Visual communication',
}

interface FactRow {
  k: Bi
  v: Bi
}

export const FACTS: readonly FactRow[] = [
  {
    k: { zh: '意向岗位', en: 'Target role' },
    v: { zh: '模板示例 · 请填写目标岗位', en: 'Template example · Add a target role' },
  },
  {
    k: { zh: '方向', en: 'Focus' },
    v: { zh: '模板示例 · 请填写专业方向', en: 'Template example · Add a focus area' },
  },
  {
    k: { zh: '最高学历', en: 'Education' },
    v: { zh: '模板示例 · 请填写学历与专业', en: 'Template example · Add education and subject' },
  },
  {
    k: { zh: '院校', en: 'University' },
    v: {
      zh: '示例院校 · 20XX.XX – 20XX.XX（模板示例）',
      en: 'Example University · 20XX.XX – 20XX.XX (fictional template)',
    },
  },
  {
    k: { zh: '可实习', en: 'Availability' },
    v: { zh: '模板示例 · 请填写可到岗时间', en: 'Template example · Add availability' },
  },
  {
    k: { zh: '在校荣誉', en: 'Honours' },
    v: {
      zh: '示例奖项 · 示例项目表彰（模板示例）',
      en: 'Example Award · Example Project Recognition (fictional template)',
    },
  },
]

export const RESUME_SKILLS: readonly { id: string; title: Bi; body: Bi }[] = [
  {
    id: 'pre-production',
    title: { zh: '策划示例', en: 'Planning example' },
    body: {
      zh: '模板示例：需求梳理、资料组织、脚本草拟与任务协作。请替换为自己的技能。',
      en: 'Template example: organise requirements, research, draft scripts and coordinate tasks. Replace with your own skills.',
    },
  },
  {
    id: 'post-production',
    title: { zh: '制作与协作示例', en: 'Production and collaboration example' },
    body: {
      zh: '模板示例：文字排版、图像处理、视频剪辑与文件协作。此处不代表真实熟练度。',
      en: 'Template example: typography, image editing, video editing and file collaboration. No real proficiency is claimed.',
    },
  },
  {
    id: 'ai-software',
    title: { zh: '辅助工具示例', en: 'Assisted tooling example' },
    body: {
      zh: '模板示例：使用合适的辅助工具探索方案，并人工检查最终交付。',
      en: 'Template example: explore alternatives with suitable tools and review the final deliverable manually.',
    },
  },
]

export const PROFILE_LINES: readonly Bi[] = [
  {
    zh: '我是示例求职者。这是用于演示求职网站布局与动效的虚构个人简介，院校、经历和成果均为模板占位资料，不对应真实人物。',
    en: 'I am Example Candidate. This fictional profile demonstrates the job application template and its animations. Its education, experience and results do not describe a real person.',
  },
]

export interface Capability {
  id: string
  title: Bi
  desc: Bi
  workId: string
}

export const CAPABILITIES: readonly Capability[] = [
  {
    id: 'script-storyboard',
    title: { zh: '策划示例', en: 'Planning example' },
    desc: {
      zh: '模板示例：将需求整理成可交流的提纲与分镜。',
      en: 'Template example: organise requirements into a brief and storyboard.',
    },
    workId: 'aigc-drama',
  },
  {
    id: 'video-editing',
    title: { zh: '剪辑示例', en: 'Editing example' },
    desc: {
      zh: '模板示例：通过素材筛选、节奏与字幕展示制作过程。',
      en: 'Template example: demonstrate selection, pacing and subtitles.',
    },
    workId: 'overseas-social',
  },
  {
    id: 'aigc-production',
    title: { zh: '生成探索示例', en: 'Generation example' },
    desc: {
      zh: '模板示例：比较视觉方案并记录可复用步骤，不作真实成果承诺。',
      en: 'Template example: compare visual alternatives and record reusable steps. No real achievement is claimed.',
    },
    workId: 'aigc-drama',
  },
  {
    id: 'publish-data',
    title: { zh: '交付记录示例', en: 'Delivery example' },
    desc: {
      zh: '模板示例：整理版本、交付清单与演示数据。',
      en: 'Template example: organise versions, deliverables and demonstration data.',
    },
    workId: 'overseas-social',
  },
]

interface ChatPair {
  q: Bi
  a: Bi
}

export const CHAT: readonly ChatPair[] = [
  {
    q: { zh: '这个人物是真实的吗？', en: 'Is this a real person?' },
    a: {
      zh: '不是。此页是模板示例，所有身份与履历资料均为虚构占位。',
      en: 'No. This is a template example with fictional identity and career placeholders.',
    },
  },
  {
    q: { zh: '如何使用这份模板？', en: 'How should I use this template?' },
    a: {
      zh: '模板示例：替换个人资料与有权使用的素材，再核对公开范围。',
      en: 'Template example: replace the profile and use assets you may publish, then review the publication scope.',
    },
  },
  {
    q: { zh: '这里的数据代表真实成绩吗？', en: 'Are these real achievements?' },
    a: {
      zh: '不代表。数值仅用于演示排版与计数动效，不能当作任何人的履历。',
      en: 'No. Values only demonstrate layout and counters and do not represent anyone’s career.',
    },
  },
]

export interface Work {
  id: string
  index: string
  title: Bi
  org: Bi
  period: Bi
  /** 公开演示封面的相对路径。 */
  cover: string
  /** 演示封面不作为任何真实项目的证明。 */
  coverConfirmed: boolean
  /** 所有数值均为虚构演示值，仅用于计数动效。 */
  stats: readonly { value: Bi; label: Bi }[]
  tags: readonly Bi[]
  summary: Bi
}

export const WORKS: readonly Work[] = [
  {
    id: 'overseas-social',
    index: '01',
    title: { zh: '模板示例 · 内容策划项目', en: 'Template Example · Content Planning' },
    org: { zh: '示例组织甲（虚构）', en: 'Example Organisation A (fictional)' },
    period: { zh: '20XX.XX – 20XX.XX（模板示例）', en: '20XX.XX – 20XX.XX (fictional template)' },
    cover: '/about/work-01.webp',
    coverConfirmed: false,
    stats: [
      {
        value: { zh: '12', en: '12' },
        label: { zh: '演示值 · 素材', en: 'Fictional demo · Assets' },
      },
      {
        value: { zh: '34', en: '34' },
        label: { zh: '演示值 · 版本', en: 'Fictional demo · Versions' },
      },
      {
        value: { zh: '56', en: '56' },
        label: { zh: '演示值 · 条目', en: 'Fictional demo · Entries' },
      },
    ],
    tags: [
      { zh: '模板示例', en: 'Fictional template' },
      { zh: '流程展示', en: 'Workflow demo' },
      { zh: '演示数据', en: 'Demo data' },
    ],
    summary: {
      zh: '模板示例：在虚构组织中整理内容需求，完成脚本、制作与交付清单。数值仅演示界面，不代表真实项目或成果。',
      en: 'Template example: organise a fictional brief, script, production and delivery checklist. Values demonstrate the interface and are not real achievements.',
    },
  },
  {
    id: 'aigc-drama',
    index: '02',
    title: { zh: '模板示例 · 视觉探索项目', en: 'Template Example · Visual Exploration' },
    org: { zh: '示例组织乙（虚构）', en: 'Example Organisation B (fictional)' },
    period: { zh: '20XX.XX – 20XX.XX（模板示例）', en: '20XX.XX – 20XX.XX (fictional template)' },
    cover: '/about/work-02.webp',
    coverConfirmed: false,
    stats: [
      {
        value: { zh: '14', en: '14' },
        label: { zh: '演示值 · 草稿', en: 'Fictional demo · Drafts' },
      },
      {
        value: { zh: '28', en: '28' },
        label: { zh: '演示值 · 提案', en: 'Fictional demo · Studies' },
      },
      {
        value: { zh: '42', en: '42' },
        label: { zh: '演示值 · 记录', en: 'Fictional demo · Notes' },
      },
    ],
    tags: [
      { zh: '模板示例', en: 'Fictional template' },
      { zh: '分镜演示', en: 'Storyboard demo' },
      { zh: '方案比较', en: 'Visual studies' },
      { zh: '检查示例', en: 'Review demo' },
    ],
    summary: {
      zh: '模板示例：以虚构主题进行分镜与风格探索，记录不同方案的比较过程。此案例不对应真实客户或工作经历。',
      en: 'Template example: explore storyboards and visual styles for a fictional topic and compare alternatives. This does not describe a real client or employment.',
    },
  },
  {
    id: 'home-3c',
    index: '03',
    title: { zh: '模板示例 · 产品表达项目', en: 'Template Example · Product Communication' },
    org: { zh: '示例组织丙（虚构）', en: 'Example Organisation C (fictional)' },
    period: { zh: '20XX.XX – 20XX.XX（模板示例）', en: '20XX.XX – 20XX.XX (fictional template)' },
    cover: '/about/work-03.webp',
    coverConfirmed: false,
    stats: [
      {
        value: { zh: '16', en: '16' },
        label: { zh: '演示值 · 画面', en: 'Fictional demo · Frames' },
      },
      {
        value: { zh: '32', en: '32' },
        label: { zh: '演示值 · 素材', en: 'Fictional demo · Assets' },
      },
      {
        value: { zh: '48', en: '48' },
        label: { zh: '演示值 · 记录', en: 'Fictional demo · Notes' },
      },
    ],
    tags: [
      { zh: '模板示例', en: 'Fictional template' },
      { zh: '产品表达', en: 'Product communication' },
      { zh: '交付展示', en: 'Delivery demo' },
    ],
    summary: {
      zh: '模板示例：为虚构产品设计镜头与展示版本，以演示内容结构。没有真实品牌、客户或商业业绩关联。',
      en: 'Template example: design shots and presentation versions for a fictional product. There is no association with a real brand, client or commercial performance.',
    },
  },
  {
    id: 'campus-media',
    index: '04',
    title: { zh: '模板示例 · 社区活动记录', en: 'Template Example · Community Activity' },
    org: { zh: '示例院校创作小组（虚构）', en: 'Example University Creative Group (fictional)' },
    period: { zh: '20XX.XX – 20XX.XX（模板示例）', en: '20XX.XX – 20XX.XX (fictional template)' },
    cover: '/about/work-04.webp',
    coverConfirmed: false,
    stats: [
      {
        value: { zh: '18', en: '18' },
        label: { zh: '演示值 · 片段', en: 'Fictional demo · Clips' },
      },
      {
        value: { zh: '示例渠道甲', en: 'Example Channel A' },
        label: { zh: '虚构展示渠道', en: 'Fictional channel' },
      },
      {
        value: { zh: '示例渠道乙', en: 'Example Channel B' },
        label: { zh: '虚构展示渠道', en: 'Fictional channel' },
      },
    ],
    tags: [
      { zh: '模板示例', en: 'Fictional template' },
      { zh: '活动记录', en: 'Activity demo' },
      { zh: '素材整理', en: 'Asset organisation' },
    ],
    summary: {
      zh: '模板示例：在虚构活动中规划记录清单、整理素材并展示交付方式。院校、渠道和成果均为占位示例。',
      en: 'Template example: plan a fictional activity, organise assets and demonstrate delivery. The university, channels and results are placeholders.',
    },
  },
]

export interface Experience {
  id: string
  workId: string
  period: Bi
  company: Bi
  role: Bi
  focus: Bi
  details: readonly { title: Bi; body: Bi }[]
  points: readonly Bi[]
}

/** 虚构经历保留演示结构；20XX 日期不对应真实任职时间。 */
const EXPERIENCE_DETAILS: readonly Omit<Experience, 'points'>[] = [
  {
    id: 'template-content',
    workId: 'overseas-social',
    period: { zh: '20XX.XX – 20XX.XX（模板示例）', en: '20XX.XX – 20XX.XX (fictional template)' },
    company: { zh: '示例组织甲（虚构）', en: 'Example Organisation A (fictional)' },
    role: { zh: '内容策划岗位（模板示例）', en: 'Content Planning Role (fictional template)' },
    focus: {
      zh: '模板示例：展示从需求梳理到交付的过程。',
      en: 'Template example: demonstrate a brief-to-delivery process.',
    },
    details: [
      {
        title: { zh: '需求整理示例', en: 'Brief example' },
        body: {
          zh: '模板示例：根据虚构需求整理受众、信息与表达方向，形成可供讨论的提纲。',
          en: 'Template example: organise a fictional brief into audience, information and communication goals.',
        },
      },
      {
        title: { zh: '内容制作示例', en: 'Production example' },
        body: {
          zh: '模板示例：演示脚本、素材筛选、节奏剪辑与字幕检查的协作流程。',
          en: 'Template example: demonstrate scripting, asset selection, pacing and subtitle review.',
        },
      },
      {
        title: { zh: '视觉物料示例', en: 'Visual asset example' },
        body: {
          zh: '模板示例：为虚构活动准备展示版式，并以统一命名整理交付文件。',
          en: 'Template example: prepare layouts for a fictional activity and organise deliverables with consistent names.',
        },
      },
      {
        title: { zh: '记录与复盘示例', en: 'Review example' },
        body: {
          zh: '模板示例：记录演示版本的修改过程，不使用真实账号数据或个人业绩。',
          en: 'Template example: record revisions using demonstration data rather than real account metrics or personal achievements.',
        },
      },
      {
        title: { zh: '发布清单示例', en: 'Publishing checklist example' },
        body: {
          zh: '模板示例：整理公开前的素材授权、内容检查与文件清单。',
          en: 'Template example: organise asset permissions, content review and a delivery checklist before publication.',
        },
      },
    ],
  },
  {
    id: 'template-ai',
    workId: 'aigc-drama',
    period: { zh: '20XX.XX – 20XX.XX（模板示例）', en: '20XX.XX – 20XX.XX (fictional template)' },
    company: { zh: '示例组织乙（虚构）', en: 'Example Organisation B (fictional)' },
    role: { zh: '视觉探索岗位（模板示例）', en: 'Visual Exploration Role (fictional template)' },
    focus: {
      zh: '模板示例：通过分镜与方案比较展示工作方式。',
      en: 'Template example: demonstrate storyboards and visual comparisons.',
    },
    details: [
      {
        title: { zh: '分镜示例', en: 'Storyboard example' },
        body: {
          zh: '模板示例：为虚构主题整理故事结构、镜头顺序与画面说明。',
          en: 'Template example: organise story structure, shot order and visual notes for a fictional topic.',
        },
      },
      {
        title: { zh: '方案探索示例', en: 'Visual study example' },
        body: {
          zh: '模板示例：比较不同画面方向，记录风格与内容的一致性检查步骤。',
          en: 'Template example: compare visual directions and record style and content consistency checks.',
        },
      },
      {
        title: { zh: '交付检查示例', en: 'Delivery review example' },
        body: {
          zh: '模板示例：检查尺寸、字幕与文件版本，将演示方法整理为可复用清单。',
          en: 'Template example: review dimensions, subtitles and file versions and record a reusable checklist.',
        },
      },
    ],
  },
  {
    id: 'template-product',
    workId: 'home-3c',
    period: { zh: '20XX.XX – 20XX.XX（模板示例）', en: '20XX.XX – 20XX.XX (fictional template)' },
    company: { zh: '示例组织丙（虚构）', en: 'Example Organisation C (fictional)' },
    role: { zh: '产品表达岗位（模板示例）', en: 'Product Communication Role (fictional template)' },
    focus: {
      zh: '模板示例：将产品信息整理成便于理解的画面。',
      en: 'Template example: turn fictional product information into clear visuals.',
    },
    details: [
      {
        title: { zh: '拍摄规划示例', en: 'Shoot planning example' },
        body: {
          zh: '模板示例：为虚构产品准备镜头清单、场景说明与素材目录。',
          en: 'Template example: prepare shots, scene notes and an asset catalogue for a fictional product.',
        },
      },
      {
        title: { zh: '展示版本示例', en: 'Presentation version example' },
        body: {
          zh: '模板示例：比较不同版式与节奏，不关联真实客户、品牌或商业成果。',
          en: 'Template example: compare layouts and pacing without reference to a real client, brand or commercial result.',
        },
      },
    ],
  },
  {
    id: 'media-centre',
    workId: 'campus-media',
    period: { zh: '20XX.XX – 20XX.XX（模板示例）', en: '20XX.XX – 20XX.XX (fictional template)' },
    company: {
      zh: '示例院校创作小组（虚构）',
      en: 'Example University Creative Group (fictional)',
    },
    role: {
      zh: '活动记录岗位（模板示例）',
      en: 'Activity Documentation Role (fictional template)',
    },
    focus: {
      zh: '模板示例：展示活动记录与素材协作。',
      en: 'Template example: demonstrate activity documentation and asset collaboration.',
    },
    details: [
      {
        title: { zh: '活动规划示例', en: 'Activity planning example' },
        body: {
          zh: '模板示例：为虚构活动准备设备清单、记录计划与协作约定。',
          en: 'Template example: prepare equipment, documentation and collaboration checklists for a fictional activity.',
        },
      },
      {
        title: { zh: '素材整理示例', en: 'Asset organisation example' },
        body: {
          zh: '模板示例：分类演示素材并说明交付方式，不包含真实学校、媒体推选或获奖记录。',
          en: 'Template example: organise demonstration assets and delivery notes without real university, media or award records.',
        },
      },
    ],
  },
]

export const EXPERIENCE: readonly Experience[] = EXPERIENCE_DETAILS.map((experience) => ({
  ...experience,
  points: experience.details.map((detail) => detail.body),
}))

/** example.com 为保留示例域名；请勿在模板中填写发布者的私人联系方式。 */
export const CONTACT = {
  email: 'candidate@example.com',
  gmail: 'hello@example.com',
  resume: '/resume.pdf',
  portfolio: 'https://example.com/portfolio',
} as const

/** 开发期校验双语完整性及展示结构，不读取任何个人简历。 */
export function assertParity(): void {
  const bad: string[] = []

  /** 判断一个值是不是「双语对」（`{ zh, en }`）—— 递归下钻时的叶子判据 */
  const isBi = (v: unknown): v is Bi =>
    typeof v === 'object' && v !== null && 'zh' in v && 'en' in v

  /** 递归遍历任意嵌套结构，把每个 `Bi` 叶子的空值记进 `bad`（`path` 用于报错定位） */
  const walk = (node: unknown, path: string): void => {
    if (isBi(node)) {
      if (!node.zh.trim()) bad.push(`${path}.zh 为空`)
      if (!node.en.trim()) bad.push(`${path}.en 为空`)
      return
    }
    if (Array.isArray(node)) {
      if (node.length === 0) bad.push(`${path} 是空数组`)
      node.forEach((v, i) => walk(v, `${path}[${i}]`))
      return
    }
    if (typeof node === 'object' && node !== null) {
      for (const [k, v] of Object.entries(node)) walk(v, `${path}.${k}`)
    }
  }

  walk(
    {
      TAGLINE,
      ROLE_LINE,
      FACTS,
      RESUME_SKILLS,
      PROFILE_LINES,
      CAPABILITIES,
      CHAT,
      WORKS,
      EXPERIENCE,
    },
    'about',
  )

  /* 结构约束：这几条是布局前提，不是审美偏好 */
  if (CHAT.length !== 3) bad.push(`CHAT 应为 3 组，实为 ${CHAT.length}`)
  if (WORKS.length !== 4) bad.push(`WORKS 应为 4 组，实为 ${WORKS.length}`)
  if (CAPABILITIES.length !== 4) bad.push(`CAPABILITIES 应为 4 项，实为 ${CAPABILITIES.length}`)
  if (EXPERIENCE.length !== 4) bad.push(`EXPERIENCE 应为 4 段，实为 ${EXPERIENCE.length}`)

  /* 能力项绑定的作品必须真实存在 —— 绑错 id 入口就断链 */
  const workIds = new Set(WORKS.map((w) => w.id))
  for (const c of CAPABILITIES) {
    if (!workIds.has(c.workId))
      bad.push(`CAPABILITIES 的 ${c.title.zh} 绑定了不存在的作品 id: ${c.workId}`)
  }
  for (const experience of EXPERIENCE) {
    if (!workIds.has(experience.workId))
      bad.push(`EXPERIENCE 的 ${experience.id} 绑定了不存在的作品 id: ${experience.workId}`)
    if (experience.details.length !== experience.points.length)
      bad.push(`EXPERIENCE 的 ${experience.id} 详细分类与正文条数不一致`)
  }

  if (bad.length) {
    throw new Error(`[aboutProfile] 内容自检失败:\n  - ${bad.join('\n  - ')}`)
  }
}
