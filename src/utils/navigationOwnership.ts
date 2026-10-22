/** 无浏览器依赖的导航决策；fullPath 包含 query/hash，不能只比较页面路径。 */
export interface NavigationOwnership {
  readonly version: number
  readonly target: string
  readonly latestTarget: string
}

export function createNavigationOwnership(initialTarget: string): NavigationOwnership {
  return { version: 0, target: '', latestTarget: initialTarget }
}

/** beforeEach 和 duplicated 导航都必须登记最新目标，拦住旧 chunk 的迟到错误。 */
export function observeNavigation(
  state: NavigationOwnership,
  fullPath: string,
): NavigationOwnership {
  return { ...state, latestTarget: fullPath }
}

export function beginNavigation(state: NavigationOwnership, fullPath: string): NavigationOwnership {
  return { ...state, version: state.version + 1, target: fullPath }
}

/** 取消只使已发出的异步凭据失效；保留目标便于辨识迟到的画廊导航。 */
export function invalidateNavigation(state: NavigationOwnership): NavigationOwnership {
  return { ...state, version: state.version + 1 }
}

export function focusedNavigationOutcome(
  state: NavigationOwnership,
  intendedFullPath: string,
  intendedPath: string,
  fromPath: string,
  currentPath: string,
): 'superseded' | 'arrived' | 'cancelled' | 'failed' {
  if (state.target && state.target !== intendedFullPath) return 'superseded'
  if (currentPath === intendedPath) return 'arrived'
  if (currentPath !== fromPath) return 'cancelled'
  return 'failed'
}

/** 仅模块/样式预加载故障允许整页自动重试，业务错误保留页面上的手动出口。 */
export function isModuleNavigationError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Loading chunk .* failed|Unable to preload CSS/i.test(
    message,
  )
}
