import type { Bi } from './aboutProfile'

/** 公开模板示例的双语过渡文案，两种语言同时可见；键名对应 AboutView 中的叙事落点。 */
export const ABOUT_DIVIDERS: Record<
  'experience' | 'process' | 'beyond' | 'contact',
  { label: Bi; text: Bi }
> = {
  experience: {
    label: { zh: '实践', en: 'In practice' },
    text: {
      zh: '模板示例：用虚构项目演示经历的呈现方式',
      en: 'Template example: fictional projects demonstrate an experience section',
    },
  },
  process: {
    label: { zh: '方法', en: 'How I work' },
    text: {
      zh: '模板示例：展示制作方法与可复用流程',
      en: 'Template example: demonstrate production methods and reusable workflows',
    },
  },
  beyond: {
    label: { zh: '观察', en: 'Looking closer' },
    text: {
      zh: '模板示例：通过演示素材展示观察与表达',
      en: 'Template example: demonstrate observation and communication with sample assets',
    },
  },
  contact: {
    label: { zh: '交流', en: 'Keep in touch' },
    text: {
      zh: '模板示例：请替换为自己的合作意向与公开联系方式',
      en: 'Template example: replace with your own collaboration interests and public contact details',
    },
  },
}
