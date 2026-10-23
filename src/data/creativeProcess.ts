/**
 * 虚构求职者的五个工作流页签：只演示判断、工具辅助与交付形式，不陈述维护者的真实经历。
 * 顺序就是键盘与点击切换顺序；tools 引用 aiTools.ts 的 id，不直接复制图标或详情。
 */
import type { Bi } from './aboutProfile'

/** 方法说明使用合成图像与虚构流程，不作为真实项目或实习的成果凭证。 */
export interface CreativeStage {
  id: string
  title: Bi
  heading: Bi
  judgment: Bi
  assistance: Bi
  output: Bi
  tools: readonly string[]
}
export const CREATIVE_STAGES: readonly CreativeStage[] = [
  {
    id: 'brief', title: { zh: '需求', en: 'Brief' },
    heading: { zh: '先弄清楚，要说什么', en: 'Start with what needs to be said' },
    judgment: { zh: '把需求拆成受众、核心信息和交付形式。先核对资料，再决定值得讲的角度', en: 'Define the audience, key message and format. Check the sources before choosing a useful angle' },
    assistance: { zh: '辅助阅读资料、交叉提问和归纳；内容取舍与事实核对需由使用者完成', en: 'Tools support reading, questioning and synthesis; the user decides what to use and checks the facts' },
    output: { zh: '明确的选题与内容提纲', en: 'A focused brief and content outline' }, tools: ['kimi', 'yuanbao'],
  },
  {
    id: 'script', title: { zh: '脚本', en: 'Script' },
    heading: { zh: '给想法一个阅读顺序', en: 'Give the idea a clear sequence' },
    judgment: { zh: '把信息转成开场、展开和收束，明确每个镜头承担的内容，再调整节奏与表达', en: 'Shape an opening, development and close, define the purpose of each shot, then refine the pace and expression' },
    assistance: { zh: '辅助比较叙述角度、压缩文案和校对中英文，最终脚本需由使用者组织', en: 'Compare narrative angles, tighten copy and review both languages; the user shapes the final script' },
    output: { zh: '可执行的镜头脚本', en: 'An actionable shot script' }, tools: ['chatgpt', 'qianwen'],
  },
  {
    id: 'storyboard', title: { zh: '分镜', en: 'Storyboard' },
    heading: { zh: '让镜头之间有关系', en: 'Build a relationship between frames' },
    judgment: { zh: '安排景别、动作与信息出现的位置，检查空间和视线是否连贯。这里用合成几何图像演示版面关系', en: 'Plan framing, action and the placement of information, checking spatial and visual continuity. Synthetic geometric images demonstrate layout relationships here' },
    assistance: { zh: '辅助发散构图与视觉方向，画面顺序和叙事逻辑需由使用者把控', en: 'Explore framing and visual directions with tools; the user controls the sequence and narrative logic' },
    output: { zh: '有画面意图的分镜安排', en: 'A storyboard with visual intent' }, tools: ['doubao', 'chatgpt'],
  },
  {
    id: 'image', title: { zh: '画面', en: 'Image' },
    heading: { zh: '从一张图，到清楚的表达', en: 'Turn an image into a clear message' },
    judgment: { zh: '用主体、构图、光线与风格约束画面，并反复检查一致性。这里展示合成几何图像与封面版式示例', en: 'Guide the image through subject, composition, light and style, then check consistency. The examples here are synthetic geometric images and a sample cover layout' },
    assistance: { zh: '辅助探索视觉版本与提示词；取舍、版式层级和最终检查需由使用者完成', en: 'Explore visual variations and prompts with tools; the user selects the imagery, organises the layout and reviews the result' },
    output: { zh: '能够继续制作的画面与版式', en: 'Imagery and layout ready for production' }, tools: ['doubao', 'chatgpt'],
  },
  {
    id: 'delivery', title: { zh: '交付', en: 'Delivery' },
    heading: { zh: '完成之后，再检查一次', en: 'Finish, then review once more' },
    judgment: { zh: '通过剪辑、字幕、声音和封面完成表达，检查规格并保留制作记录。页面项目还需要验证链接、响应布局与交互', en: 'Complete the story with editing, subtitles, sound and cover design, check the specifications and keep production notes. Web projects also need link, responsive layout and interaction checks' },
    assistance: { zh: 'Codex 协助页面实现与调试，千问协助整理交付说明；最终质量需由使用者核对', en: 'Codex supports implementation and debugging, while Qianwen helps organise delivery notes; the user reviews the final quality' },
    output: { zh: '交付版本、检查记录与可复用方法', en: 'A delivery version, review notes and reusable methods' }, tools: ['codex', 'qianwen'],
  },
]
