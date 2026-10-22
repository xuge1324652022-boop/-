/**
 * 六个 AI 工具的展示资料与本地图标；职责描述创作方法，不代表认证等级或量化业绩。
 * 图标与产品介绍来源见 docs/AI工具图标来源.md；不在运行时请求远端图标。
 * id 是头像浮层与工作流选择的共享键，creativeProcess.tools 也必须引用这些稳定 id。
 */
export interface AiTool {
  id: string
  name: string
  english: string
  src: string
  roleZh: string
  roleEn: string
  detailZh: string
  detailEn: string
  tasksZh: readonly string[]
  tasksEn: readonly string[]
  /** 资料来源链接，不是图片下载地址；更换图标同时更新来源文档。 */
  sourceUrl: string
  accent: string
  /** 深色照片背景上的图标适配方式，避免把品牌图案误当作白色卡片背景。 */
  logoTone: 'light' | 'original'
}

export const AI_TOOLS: readonly AiTool[] = [
  {
    id: 'kimi',
    name: 'Kimi',
    english: 'Kimi',
    src: '/ai-tools/kimi.png',
    roleZh: '阅读长文与项目资料，把零散信息整理成创作线索',
    roleEn: 'Read deeply, connect ideas',
    detailZh: '从项目需求、PDF 和参考资料中提取关键观点，比较不同方案，再整理成可用的主题结构与内容提纲。把来源、疑问和下一步一起留下，让研究能够接着推进',
    detailEn: 'Extract key ideas from briefs, PDFs and reference material, compare directions, and turn scattered information into a clear outline. Keep sources, open questions and next steps together so the research can continue',
    tasksZh: ['资料阅读', '主题梳理', '方案比较'],
    tasksEn: ['Document reading', 'Topic structure', 'Direction comparison'],
    sourceUrl: 'https://www.kimi.com/en/help/new-user-guide/overview',
    accent: '#2b76f6',
    logoTone: 'original',
  },
  {
    id: 'doubao',
    name: '豆包',
    english: 'Doubao',
    src: '/ai-tools/doubao.png',
    roleZh: '发散画面与表达方式，快速建立可讨论的视觉方向',
    roleEn: 'Explore images and possibilities',
    detailZh: '把一个初步想法拆成文案、画面和语气的多种版本，用图像生成与对话辅助寻找合适的视觉方向。结合截图理解、翻译与改写，让参考分析和创意试验更快形成可讨论的内容',
    detailEn: 'Explore alternatives in copy, imagery and tone, using conversation and image generation to shape a visual direction. Use screenshot understanding, translation and rewriting to turn early references into ideas that can be reviewed',
    tasksZh: ['创意发散', '图像试验', '文案改写'],
    tasksEn: ['Idea exploration', 'Image studies', 'Copy variations'],
    sourceUrl: 'https://www.doubao.com/download/desktop',
    accent: '#afcfea',
    logoTone: 'original',
  },
  {
    id: 'qianwen',
    name: '千问',
    english: 'Qianwen',
    src: '/ai-tools/qianwen.png',
    roleZh: '整理信息与演示结构，让复杂内容更容易被阅读',
    roleEn: 'Structure content into clear stories',
    detailZh: '围绕汇报、演示和项目说明，整理文档要点、表格信息与叙述顺序，再转换为页面或演示的内容结构。对中英文表达做多轮压缩与校对，让信息层级与设计节奏相互配合',
    detailEn: 'Organize document highlights, tabular information and narrative order for presentations and project explanations. Refine Chinese and English copy through several passes so the information hierarchy supports the design',
    tasksZh: ['文档整理', '演示提纲', '双语表达'],
    tasksEn: ['Document synthesis', 'Presentation outlines', 'Bilingual copy'],
    sourceUrl: 'https://www.qianwen.com/',
    accent: '#173cff',
    logoTone: 'original',
  },
  {
    id: 'yuanbao',
    name: '腾讯元宝',
    english: 'Yuanbao',
    src: '/ai-tools/yuanbao.png',
    roleZh: '检索背景资料与交叉提问，为创作补充更多视角',
    roleEn: 'Research context, question assumptions',
    detailZh: '从一个主题延伸问题，通过搜索和对话补充背景信息，再与已有资料进行交叉阅读。把不同观点整理成创作备注，关键内容回到原始来源核对，再决定是否放入最终表达',
    detailEn: 'Expand a theme into useful questions, research its context, and read new findings alongside existing material. Turn different perspectives into working notes, checking important points against their original sources before using them',
    tasksZh: ['背景检索', '问题拆解', '观点交叉阅读'],
    tasksEn: ['Context research', 'Question framing', 'Cross-reading'],
    sourceUrl: 'https://yuanbao.tencent.com/',
    accent: '#00c76f',
    logoTone: 'original',
  },
  {
    id: 'chatgpt',
    name: 'ChatGPT',
    english: 'ChatGPT',
    src: '/ai-tools/chatgpt.svg',
    roleZh: '连接研究、文字与图像，把想法推向完整的方案',
    roleEn: 'Connect research, words and images',
    detailZh: '先明确目标、受众与限制，再通过追问组织研究、双语文案和视觉说明。把截图、草稿和反馈带回同一条工作线，持续比较与修改，让想法逐步成为能够展示的方案',
    detailEn: 'Define the goal, audience and constraints, then develop research, bilingual copy and visual explanations through focused follow-up questions. Bring screenshots, drafts and feedback into the same workflow to compare, revise and shape a presentable direction',
    tasksZh: ['研究整合', '双语文案', '视觉推敲'],
    tasksEn: ['Research synthesis', 'Bilingual writing', 'Visual iteration'],
    sourceUrl: 'https://learn.chatgpt.com/docs/web',
    accent: '#111111',
    logoTone: 'original',
  },
  {
    id: 'codex',
    name: 'Codex',
    english: 'Codex',
    src: '/ai-tools/codex.png',
    roleZh: '把设计要求转成可运行的页面，并检查交互细节',
    roleEn: 'Build, test and refine interactions',
    detailZh: '把排版、动效与交互要求写成具体任务，在现有代码中逐步实现组件、样式和动画。结合预览、错误定位与测试检查结果，再继续调整滚动节奏、响应布局与细节，让设计能够真正运行',
    detailEn: 'Translate layout, motion and interaction requirements into focused tasks, then implement them in the existing codebase. Review previews, investigate errors and run relevant checks before refining scroll pacing, responsive layouts and interaction details',
    tasksZh: ['页面实现', '交互动效', '调试与验证'],
    tasksEn: ['Page implementation', 'Interactive motion', 'Debugging and verification'],
    sourceUrl: 'https://learn.chatgpt.com/docs/cli',
    accent: '#333333',
    logoTone: 'light',
  },
]
