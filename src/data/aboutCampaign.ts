/**
 * 公开模板示例的双语定位与六步工作流文案。当前工作流的五个交互页签由
 * creativeProcess.ts 驱动；这里只描述虚构演示流程，不对应发布者的真实经历。
 */
import type { Bi } from './aboutProfile'

export const ABOUT_INTRO: Bi = {
  zh: '模板示例：这里展示虚构求职者如何组织内容、影像与交互，供替换为自己的介绍',
  en: 'Template example: a fictional candidate demonstrates content, imagery and interaction. Replace this with your own introduction',
}
export const AI_INTRO: Bi = {
  zh: '模板示例：让工具协作，让想法落地',
  en: 'Template example: different tools, one creative process',
}
export const AI_APPROACH: Bi = {
  zh: '模板示例：先拆解问题，再选择工具。虚构求职者用 AI 扩展资料、语言、画面与代码的可能性，把最终的叙事、审美和核对交给人工检查',
  en: 'Template example: define the problem before choosing a tool. AI can help explore research, language, imagery and code; narrative, visual judgment and final checks remain subject to human review',
}
export const AI_STEPS: readonly { id: string; title: Bi; detail: Bi; output: Bi }[] = [
  {
    id: 'research',
    title: { zh: '资料与选题', en: 'Research & direction' },
    detail: {
      zh: '模板示例：梳理资料、比较不同叙事角度，把任务拆成受众、信息和表达目标。对关键事实回到原始来源核对，再确定内容方向',
      en: 'Template example: organise source material, compare narrative angles and separate audience, information and communication goals. Check key facts against original sources before deciding on a direction',
    },
    output: { zh: '选题结构 · 资料线索', en: 'Creative brief · Source notes' },
  },
  {
    id: 'script',
    title: { zh: '脚本与分镜', en: 'Scripts & storyboards' },
    detail: {
      zh: '模板示例：把一句想法写成能执行的脚本，明确镜头、景别、动作、台词和声音，再调整节奏与信息出现的顺序',
      en: 'Template example: turn an idea into an executable script with shots, framing, action, dialogue and sound, then refine the pacing and the order in which information is revealed',
    },
    output: { zh: '镜头脚本 · 分镜清单', en: 'Shot script · Storyboard' },
  },
  {
    id: 'prompt',
    title: { zh: '提示词与画面', en: 'Prompts & imagery' },
    detail: {
      zh: '模板示例：把主体、环境、构图、光线与风格写成可复用的提示词，比较不同版本，保持角色和场景在一组画面里的连续性',
      en: 'Template example: build reusable prompts around subject, setting, composition, light and style. Compare iterations and maintain continuity across characters and scenes',
    },
    output: { zh: '风格探索 · Prompt 模板', en: 'Visual studies · Prompt templates' },
  },
  {
    id: 'production',
    title: { zh: '生成与剪辑', en: 'Generation & editing' },
    detail: {
      zh: '模板示例：把分镜推进到图像和视频，筛选可用片段，再通过剪辑、字幕、音效与版式，把生成素材组织成有起承转合的表达',
      en: 'Template example: develop storyboards into image and video material, select usable shots and shape them through editing, subtitles, sound and layout into a coherent narrative',
    },
    output: { zh: '视频片段 · 成片版本', en: 'Shot selections · Finished cuts' },
  },
  {
    id: 'prototype',
    title: { zh: '原型与交互', en: 'Prototypes & interaction' },
    detail: {
      zh: '模板示例：与 ChatGPT、Codex 协作，把交互想法变成可浏览的页面，逐步调整布局、动效和响应式表现，再在浏览器里检查实际体验',
      en: 'Template example: work with ChatGPT and Codex to translate interaction ideas into browsable pages, refine layout, motion and responsive behaviour, and inspect the experience in the browser',
    },
    output: { zh: '页面原型 · 交互迭代', en: 'Working prototypes · Interaction studies' },
  },
  {
    id: 'review',
    title: { zh: '检查与沉淀', en: 'Review & reusable methods' },
    detail: {
      zh: '模板示例：从事实、画面一致性、字幕、尺寸与交付规格检查结果，把有效提示词和制作方法整理成模板与 SOP，减少下一次重复试错',
      en: 'Template example: review facts, visual consistency, subtitles, dimensions and delivery requirements. Keep effective prompts and production methods as templates and SOPs for the next project',
    },
    output: { zh: '质量检查 · 可复用流程', en: 'Quality review · Reusable workflow' },
  },
]
