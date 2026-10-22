import { ref, watch } from 'vue'
import type { Lang } from '../数据/人物资料'

export const SUBPAGE_LANGUAGE_KEY = 'portfolio:language'

function readLanguage(): Lang {
  try {
    return window.localStorage.getItem(SUBPAGE_LANGUAGE_KEY) === 'en' ? 'en' : 'zh'
  } catch {
    // 隐私模式、禁用存储与服务端预处理仍可正常使用默认语言。
    return 'zh'
  }
}

/** 子页与共享 Index 使用同一持久状态；整页刷新和页间导航沿用用户的选择。 */
export const subpageLanguage = ref<Lang>(readLanguage())

watch(
  subpageLanguage,
  (language) => {
    if (typeof document !== 'undefined')
      document.documentElement.lang = language === 'en' ? 'en' : 'zh-CN'
    try {
      window.localStorage.setItem(SUBPAGE_LANGUAGE_KEY, language)
    } catch {
      /* 存储不可用不能阻止切换语言或更新读屏语义。 */
    }
  },
  { immediate: true, flush: 'sync' },
)
