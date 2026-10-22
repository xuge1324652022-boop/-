import { ref } from 'vue'
import type { Bi } from '../data/aboutProfile'

/** 全局幕布单例：首访初始化也先锁定，避免深层组件在幕布下面抢播入场。 */
export const needsInitialCurtain = (path: string): boolean => /^\/(about|edit|news|color|poster|photo|cards)(?:\/|$)/u.test(path) || path.startsWith('/card/')
/** 覆盖、等待、揭幕全过程为 true：屏蔽页面输入及媒体启动。 */
export const routeCurtainActive = ref(needsInitialCurtain(window.location.pathname))
/** 揭幕开始即为 false：文字可随弧形边缘出现，输入仍等待 active 解锁。 */
export const routeCurtainBlocked = ref(routeCurtainActive.value)

const TITLES: Record<string, Bi> = {
  '/': { zh: '作品集', en: 'Selected work' },
  '/cards': { zh: '作品目录', en: 'Work index' },
  '/about': { zh: '关于我', en: 'About me' },
  '/edit': { zh: '视频剪辑', en: 'Film editing' },
  '/color': { zh: '影像调色', en: 'Colour grading' },
  '/news': { zh: '新闻影像', en: 'News & stories' },
  '/poster': { zh: '海报设计', en: 'Posters & design' },
  '/photo': { zh: '摄影', en: 'Photography' },
}
const LEGACY_PATHS = ['/about', '/edit', '/color', '/news', '/poster', '/photo']
/** 兼容旧卡号路径，保证直接输入旧网址时幕布仍能显示正确的双语章节名。 */
export function curtainTitleFor(path: string): Bi {
  const legacy = /^\/card\/(\d{2})$/u.exec(path)
  const key = legacy ? LEGACY_PATHS[Number(legacy[1]) - 1] ?? path : path
  return TITLES[key] ?? { zh: '作品', en: 'Work' }
}
