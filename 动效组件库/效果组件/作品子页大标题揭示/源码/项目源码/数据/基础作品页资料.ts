/**
 * 剪辑 / 新闻基础页的数据契约：先形成可进入、可阅读、可操作的版面，等待正式作品迁入。
 * 这里的主题与文案属于创作研究，不应补上不存在的客户、业绩或成片路径。
 */
import type { Bi } from './人物资料'

export type FoundationKind = 'edit' | 'news'
export type FoundationTheme = {
  /** 同时用于页签 id 与内容锚点，改名需检查深链接。 */
  key: string
  title: Bi
  /** 当前交互按三个词分段；主题词数量改变时须同步 FoundationView 的时间线映射。 */
  words: string[]
  description: Bi
  detail: Bi
}
export type FoundationPage = {
  id: string
  heading: string
  title: Bi
  introduction: Bi
  studyLabel: Bi
  closing: Bi
  themes: readonly FoundationTheme[]
}

/** 先建立主题与阅读结构，独立于后续迁入的正式作品清单 */
export const FOUNDATION_PAGES: Record<FoundationKind, FoundationPage> = {
  edit: {
    id: '02', heading: 'EDITING', title: { zh: '剪辑', en: 'Editing' },
    introduction: {
      zh: '把零散的片段组织成一次完整的观看，让节奏带着情绪前行，让每一次切换都有理由',
      en: 'A sequence becomes a story through rhythm, emotion and the reason behind every cut',
    },
    studyLabel: { zh: '节奏实验', en: 'A study in rhythm' },
    closing: {
      zh: '剪辑的力量，藏在两个画面相遇的地方',
      en: 'The energy of an edit lives where two images meet',
    },
    themes: [
      {
        key: 'rhythm', title: { zh: '节奏', en: 'Rhythm' }, words: ['HOLD', 'CUT', 'FEEL'],
        description: { zh: '快慢之间，留出感受的时间', en: 'Give each moment room to be felt' },
        detail: {
          zh: '从一个动作的起落到一段情绪的停留，镜头的长短决定观看的呼吸，先找到段落的重心，再调整密度和留白',
          en: 'The length of a shot shapes the breath of a sequence, from a gesture to a pause — find its emotional centre, then balance pace with space',
        },
      },
      {
        key: 'continuity', title: { zh: '衔接', en: 'Continuity' }, words: ['LOOK', 'MOVE', 'CONNECT'],
        description: { zh: '让视线带着画面走向下一个画面', en: 'Let attention travel from one image to the next' },
        detail: {
          zh: '用动作、视线和构图建立联系，转场可以很轻，也可以成为段落的标点，重要的是让观众始终知道自己在看什么',
          en: 'Movement, eyelines and composition connect the shots — a transition can be quiet or decisive, while the viewer always keeps their bearings',
        },
      },
      {
        key: 'sound', title: { zh: '声音', en: 'Sound' }, words: ['LISTEN', 'PAUSE', 'RESONATE'],
        description: { zh: '声音先到，情绪随后抵达', en: 'Sound arrives first, emotion follows' },
        detail: {
          zh: '对白交代信息，环境声建立空间，音乐推动情绪，让声音跨过切点，画面之间就有了更自然的连接',
          en: 'Dialogue carries information, ambience builds a place and music shapes emotion — sound bridges can make a cut feel natural before it is seen',
        },
      },
    ],
  },
  news: {
    id: '04', heading: 'NEWS', title: { zh: '新闻影像', en: 'News & visual stories' },
    introduction: {
      zh: '从现场出发，把人物、细节与背景放回同一个故事，让影像不仅记录发生了什么，也帮助理解为什么',
      en: 'Begin on location, bring people and context into the same story, and use images to make events easier to understand',
    },
    studyLabel: { zh: '观察笔记', en: 'Notes on observation' },
    closing: {
      zh: '把镜头靠近现场，把表达交还给事实',
      en: 'Bring the camera closer to life and let the facts lead',
    },
    themes: [
      {
        key: 'people', title: { zh: '人物', en: 'People' }, words: ['A VOICE', 'A PERSON', 'A STORY'],
        description: { zh: '由一个人的经历，进入一个议题', en: 'Enter a wider subject through one person' },
        detail: {
          zh: '先倾听，再提问，把人物放在具体的生活和选择中，通过动作、语言与细节呈现真实的处境，避免只留下标签',
          en: 'Listen before asking — gestures, words and everyday choices place a person in context, with room for a life beyond a label',
        },
      },
      {
        key: 'location', title: { zh: '现场', en: 'On location' }, words: ['BE THERE', 'LOOK CLOSE', 'RECORD'],
        description: { zh: '在发生的地方，找到故事的线索', en: 'Find the story where it happens' },
        detail: {
          zh: '远景建立环境，中景交代关系，近景留下细节，让空间、行动与同期声共同构成信息，而不是只依靠解说完成叙事',
          en: 'Wide shots establish a place, medium shots explain relationships and close-ups preserve details — space, action and location sound all carry information',
        },
      },
      {
        key: 'context', title: { zh: '观察', en: 'Context' }, words: ['NOTICE', 'QUESTION', 'UNDERSTAND'],
        description: { zh: '把眼前的细节，放回更大的背景', en: 'Connect a small detail to a larger picture' },
        detail: {
          zh: '将采访信息、时间线与影像证据相互对照，区分事实和判断，在清楚交代背景的同时，保留观看者思考的空间',
          en: 'Compare interviews, timelines and visual evidence, distinguish facts from interpretation, and make the context clear while leaving room to think',
        },
      },
    ],
  },
}
