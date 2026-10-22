import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import type { Ref } from 'vue'
import { NavigationFailureType, isNavigationFailure } from 'vue-router'
import type { Router } from 'vue-router'
import {
  curtainTitleFor,
  needsInitialCurtain,
  routeCurtainActive,
  routeCurtainBlocked,
} from './页面幕布控制'
import { endJump, isTransitioning, jumpPathFor, jumpTarget, overlayActive } from './应用转场状态'
import {
  beginNavigation,
  createNavigationOwnership,
  focusedNavigationOutcome,
  invalidateNavigation,
  isModuleNavigationError,
  observeNavigation,
} from '../工具/导航所有权'

/** 视觉层的可等待接口；协调器不依赖 PageCurtain 的内部 GSAP 实现。 */
export interface RouteCurtainHandle {
  cover(entry?: boolean): Promise<void>
  reveal(): Promise<void>
  reset(): void
}

export interface RouteCurtainNavigationOptions {
  router: Router
  curtain: Readonly<Ref<RouteCurtainHandle | null>>
}

/**
 * 每个 App 实例持有一套导航生命周期。版本所有权防止迟到 chunk、取消和后退清理新幕布。
 * 输入为 Router 与视觉接口；输出仅包含渲染所需标题、错误和重试操作。
 */
export function useRouteCurtainNavigation({ router, curtain }: RouteCurtainNavigationOptions) {
  const curtainTitle = ref(curtainTitleFor(window.location.pathname))
  // 错误回调可能在旧 chunk 被取消很久之后才到达；单独保留最新完整目标，
  // 不能依赖幕布是否仍存在，也不能把不同 query/hash 当成同一次导航。
  let ownership = createNavigationOwnership(
    router.resolve(window.location.pathname + window.location.search + window.location.hash)
      .fullPath,
  )
  let coveredAt = 0
  let coverWork: Promise<void> | undefined
  let revealWork: Promise<void> | undefined
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
  let finishHold: (() => void) | undefined

  // MediaQueryList.matches 是实时值；监听 change 还可立刻结束已开始的停留等待。
  function onMotionChange(): void {
    if (reducedMotion.matches) finishHold?.()
  }
  reducedMotion.addEventListener('change', onMotionChange)

  function waitForCurtainHold(entry: boolean): Promise<void> {
    finishHold?.()
    const remaining = coveredAt + (entry ? 500 : 650) - performance.now()
    if (reducedMotion.matches || remaining <= 0) return Promise.resolve()
    return new Promise((resolve) => {
      const timer = window.setTimeout(finish, remaining)
      function finish(): void {
        window.clearTimeout(timer)
        if (finishHold === finish) finishHold = undefined
        resolve()
      }
      finishHold = finish
    })
  }

  /** 非空 = 跳转失败或超时，屏幕上必须有一个「刷新重试」的出口。 */
  const jumpError = ref('')
  /** 重试必须重新加载目标页，不能只刷新仍停留的首页。 */
  const jumpRetryHref = ref('')
  const CHUNK_RETRY_KEY = 'portfolio:chunk-navigation-retry'

  /**
   * 懒加载 chunk 拉取失败时，用**整页重载**再试一次目标地址。
   *
   * 为什么不是「重新 `router.push`」：失败的模块会被当前文档的模块缓存记住，
   * 在同一个文档里重试必然还是同一个失败结果 —— 只有新文档才有干净缓存。
   * `sessionStorage` 存一个「这个 href 已经自动重试过」的标记，保证目标模块
   * 持续 404 时不会陷入无限刷新；存储不可用（隐私模式）时直接放弃自动重试，
   * 交给页面上的手动入口。
   *
   * @returns 是否已经接管（`true` = 正在整页跳转，调用方不要再报错）
   */
  function retryModuleNavigation(error: unknown, href: string): boolean {
    if (!isModuleNavigationError(error)) {
      return false
    }

    // 失败的模块可能留在当前文档的模块缓存中。新文档重试一次，
    // sessionStorage 保证目标模块持续失败时不会无限刷新。
    try {
      if (sessionStorage.getItem(CHUNK_RETRY_KEY) === href) return false
      sessionStorage.setItem(CHUNK_RETRY_KEY, href)
      window.location.assign(href)
      return true
    } catch {
      // 存储不可用时保留手动重试，不能启用没有跨文档保护的自动刷新。
      return false
    }
  }

  // 完整页面重试时也可能失败；首次路由错误同样必须给出可操作的出口。
  const removeRouterError = router.onError((error, to) => {
    if (to.fullPath !== ownership.latestTarget) return
    if (jumpTarget.value) return // 卡片跳转由 navigateFocusedCard 的 catch 统一处理
    clearWatchdog()
    jumpRetryHref.value = router.resolve(to).href
    if (retryModuleNavigation(error, jumpRetryHref.value)) return
    jumpError.value = `页面加载失败（${to.path}）。请刷新后重试。`
    restoreCurrentPage()
  })

  /**
   * 等待上限（ms）。
   *
   * 超过它先把「刷新重试」露出来 —— 用户不该对着章节幕无限等。
   * ⚠️ 但**不判定失败**：慢网络下 chunk 可能还在路上，真落地了会自动清掉提示
   *    并自动揭开幕布。
   */
  const NAV_TIMEOUT_MS = 8000

  let watchdog = 0
  /** 发起跳转时所在的路由。用来区分「加载失败」和「导航被别人接管」。 */
  let jumpFrom = ''

  /** 撤掉等待超时。跳转成功、失败、被取消三条路都要走它，否则定时器会留在后台。 */
  function clearWatchdog(): void {
    if (watchdog) window.clearTimeout(watchdog)
    watchdog = 0
  }

  /** 同一轮只覆盖一次；保持全遮挡，直到目标路由和首轮布局都已就绪。 */
  async function coverRoute(fullPath: string, entry = false): Promise<number> {
    ownership = beginNavigation(ownership, fullPath)
    const version = ownership.version
    curtainTitle.value = curtainTitleFor(router.resolve(fullPath).path)
    routeCurtainActive.value = true
    routeCurtainBlocked.value = true
    isTransitioning.value = true
    overlayActive.value = false
    document.documentElement.classList.add('page-turn-lock')
    // 历史导航可能打断揭幕；先完成当前短退场，再开始覆盖，避免两条时间线争写同一幕。
    if (revealWork) {
      await revealWork
      if (version !== ownership.version) return version
      revealWork = undefined
      coverWork = undefined
    }
    await nextTick()
    if (version !== ownership.version) return version
    if (!coverWork)
      coverWork = (curtain.value?.cover(entry) ?? Promise.resolve()).then(() => {
        coveredAt = performance.now()
      })
    await coverWork
    return version
  }

  async function revealRoute(version: number, entry = false): Promise<void> {
    await nextTick()
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    )
    if (version !== ownership.version || !routeCurtainActive.value) return
    await waitForCurtainHold(entry)
    if (version !== ownership.version || !routeCurtainActive.value) return
    clearWatchdog()
    jumpError.value = ''
    // 弧形边缘移动时同步放行正文入场，输入仍由 active 锁住，避免文字在幕下播完。
    routeCurtainBlocked.value = false
    isTransitioning.value = false
    overlayActive.value = false
    endJump()
    document.documentElement.classList.remove('is-jumping', 'no-scroll')
    revealWork = curtain.value?.reveal() ?? Promise.resolve()
    await revealWork
    if (version !== ownership.version) return
    routeCurtainActive.value = false
    document.documentElement.classList.remove('page-turn-lock')
    coverWork = undefined
    revealWork = undefined
  }

  function cancelCurtain(): void {
    finishHold?.()
    ownership = invalidateNavigation(ownership)
    curtain.value?.reset()
    coverWork = undefined
    revealWork = undefined
    routeCurtainActive.value = false
    routeCurtainBlocked.value = false
    document.documentElement.classList.remove('page-turn-lock')
  }

  const removeBeforeNavigation = router.beforeEach(async (to, from) => {
    ownership = observeNavigation(ownership, to.fullPath)
    if (!from.name) return true
    if (to.path === from.path) {
      // 同页 hash/query 可取代尚未加载完成的跨页导航，但不需要额外播一次换页幕。
      if (routeCurtainBlocked.value && ownership.target !== to.fullPath) {
        clearWatchdog()
        cancelCurtain()
        endJump()
        overlayActive.value = false
        isTransitioning.value = false
        document.documentElement.classList.remove('is-jumping', 'no-scroll')
      }
      return true
    }
    clearWatchdog()
    jumpError.value = ''
    jumpRetryHref.value = router.resolve(to).href
    const pendingTarget = to.fullPath
    watchdog = window.setTimeout(() => {
      if (
        ownership.target === pendingTarget &&
        router.currentRoute.value.fullPath !== pendingTarget
      ) {
        jumpError.value = '页面加载时间过长，仍在等待。如果一直没有反应，请刷新重试。'
      }
    }, NAV_TIMEOUT_MS)
    const version = await coverRoute(to.fullPath)
    return version === ownership.version
  })

  const removeAfterNavigation = router.afterEach((to, from, failure) => {
    if (isNavigationFailure(failure, NavigationFailureType.duplicated)) {
      // 重复点击当前地址会直接跳过 beforeEach，但仍会取代旧懒加载导航。
      // 在这里登记新所有权，旧 chunk 随后的失败不能把用户强制带回旧目标。
      ownership = observeNavigation(ownership, to.fullPath)
      if (routeCurtainBlocked.value && ownership.target !== to.fullPath) {
        clearWatchdog()
        cancelCurtain()
        restoreCurrentPage()
      }
    }
    if (!from.name || to.path === from.path) return
    if (failure) {
      if (ownership.target === to.fullPath) {
        clearWatchdog()
        cancelCurtain()
        restoreCurrentPage()
      }
      return
    }
    if (ownership.target === to.fullPath) void revealRoute(ownership.version)
  })

  onMounted(async () => {
    // 直接访问子页也用同一幕布，从已覆盖状态起步，页面内部不再叠加加载器。
    if (!needsInitialCurtain(window.location.pathname) || ownership.version) return
    const initial = router.resolve(
      window.location.pathname + window.location.search + window.location.hash,
    ).fullPath
    const version = await coverRoute(initial, true)
    try {
      await router.isReady()
      if (version !== ownership.version) return
      // 初次访问旧卡号路径可能先重定向，使用最终规范路径更新章节名。
      ownership = { ...ownership, target: router.currentRoute.value.fullPath }
      curtainTitle.value = curtainTitleFor(router.currentRoute.value.path)
      await revealRoute(version, true)
    } catch {
      cancelCurtain()
    }
  })

  /*
   * 画廊卡片聚焦完成后通过 jumpTarget 发起导航。
   * 每次清理旧超时与错误信息；真正的覆盖/揭幕由上面的路由守卫统一执行。
   */
  watch(jumpTarget, (id) => {
    if (id) {
      clearWatchdog()
      jumpError.value = ''
      jumpRetryHref.value = router.resolve(jumpPathFor(id)).href
      jumpFrom = router.currentRoute.value.path
      void navigateFocusedCard()
    }
  })

  /** 跳转途中路由被**别人**带走了（浏览器前进/后退、别处的导航）⇒ 静默收拾。 */
  watch(
    () => router.currentRoute.value.path,
    (now) => {
      // 只有目标路由真正成功后才允许下次故障再次自动恢复。
      try {
        const href = router.resolve(router.currentRoute.value.fullPath).href
        if (sessionStorage.getItem(CHUNK_RETRY_KEY) === href) {
          sessionStorage.removeItem(CHUNK_RETRY_KEY)
        }
      } catch {
        /* 手动恢复不依赖 sessionStorage */
      }
      /*
       * 换页了，上一个页面上的提示一律作废。
       *
       * ⚠️ 这一句必须在 `jumpTarget` 判断**之前**：失败路径已经把它清成 null 了，
       *    放在后面就漏掉「跳转失败 → 用户导航去别的页」—— 实测提示条会跟着
       *    用户跑到新页面上（「页面加载失败（/color）」挂在 /about 上），
       *    而且没有任何东西会去清它。
       */
      jumpError.value = ''
      jumpRetryHref.value = ''

      const id = jumpTarget.value
      if (!id) return
      if (now === jumpPathFor(id)) return // 目标落地，交给 afterEach/revealRoute 放行幕布
      clearWatchdog()
      restoreCurrentPage()
    },
  )

  /** 从已聚焦的画廊卡片进入规范子页；路由守卫会先完成覆盖再提交导航。 */
  async function navigateFocusedCard(): Promise<void> {
    const id = jumpTarget.value
    if (!id) return

    const path = jumpPathFor(id)
    // /color 之外的专属子页都带上 from=gallery：子页据此把返回按钮指回作品集，
    // 而不是卡片列表（`/cards` 那条入口带的是 from=cards）。
    const to = path === '/color' ? path : { path, query: { from: 'gallery' } }
    const intendedFullPath = router.resolve(to).fullPath
    jumpRetryHref.value = router.resolve(to).href

    watchdog = window.setTimeout(() => {
      if (jumpTarget.value !== id) return
      if (router.currentRoute.value.path === path) return
      jumpError.value = '页面加载时间过长，仍在等待。如果一直没有反应，请刷新重试。'
    }, NAV_TIMEOUT_MS)

    try {
      const failure = await router.push(to)
      if (
        focusedNavigationOutcome(
          ownership,
          intendedFullPath,
          path,
          jumpFrom,
          router.currentRoute.value.path,
        ) === 'superseded'
      ) {
        if (jumpTarget.value === id) endJump()
        return
      }

      /*
       * ⚠️ 判据是**落点**，不是「有没有 failure」。
       *    重复导航到已经到达的目标页会返回一个 `duplicated` 失败 —— 那是正常的，
       *    不该当成错误；而导航被取消时 push 会带着 failure **resolve**，
       *    只有落点能把它和成功区分开。
       */
      if (router.currentRoute.value.path !== path) {
        throw new Error(
          isNavigationFailure(failure) ? `导航未落地（${path}）` : `未到达目标页面（${path}）`,
        )
      }

      await nextTick()
      // 只放行**本次**跳转的幕布：中途换成别的目标时不能把新幕布一起揭掉
      if (jumpTarget.value !== id) return

      clearWatchdog()
      jumpError.value = ''
    } catch (error) {
      if (
        focusedNavigationOutcome(
          ownership,
          intendedFullPath,
          path,
          jumpFrom,
          router.currentRoute.value.path,
        ) === 'superseded'
      ) {
        if (jumpTarget.value === id) endJump()
        return
      }
      clearWatchdog()
      // 完整异常留在控制台，不吞 —— 根因要靠它继续查
      console.error('[card navigation failed]', { id, path, to, error })

      if (jumpTarget.value !== id) return

      /*
       * 路由已经被另一次导航带走（用户按了后退 / 别处跳转）：
       * 我们这次导航是被取消的，不是「页面加载失败」，不弹提示。
       */
      if (router.currentRoute.value.path !== jumpFrom) {
        restoreCurrentPage()
        return
      }

      if (retryModuleNavigation(error, jumpRetryHref.value)) return

      jumpError.value = `页面加载失败（${path}）。请刷新后重试。`
      restoreCurrentPage()
    }
  }

  /**
   * 跳转失败后把页面恢复成**可用**的样子。
   *
   * 解除画廊的旧目标和输入锁；只有仍属于本次失败目标的幕布才被取消。
   */
  function restoreCurrentPage(): void {
    endJump()
    overlayActive.value = false
    isTransitioning.value = false
    document.documentElement.classList.remove('is-jumping', 'no-scroll')
    // 替代导航可能已经拥有幕布，不能因旧任务失败而取消新页面的成功退场。
    if (routeCurtainActive.value && ownership.target !== router.currentRoute.value.fullPath)
      cancelCurtain()
  }

  /**
   * 错误出口上的「刷新重试」。
   * ⚠️ 必须跳到**目标地址**而不是 `reload()`：路由错误时页面还停在首页，
   *    直接 reload 只会把首页再加载一遍，用户永远到不了想去的页面。
   */
  function reloadPage(): void {
    if (jumpRetryHref.value) window.location.assign(jumpRetryHref.value)
    else window.location.reload()
  }

  onUnmounted(() => {
    reducedMotion.removeEventListener('change', onMotionChange)
    clearWatchdog()
    removeRouterError()
    removeBeforeNavigation()
    removeAfterNavigation()
    cancelCurtain()
  })

  return { curtainTitle, jumpError, reloadPage }
}
