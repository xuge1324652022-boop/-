/** 导航与语言的无浏览器单元测试：运行实际 TS 模块，替代路由/时钟/视觉端口。 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import test from 'node:test'
import ts from 'typescript'

function loadModule(
  path,
  require = () => {
    throw Error('unexpected dependency')
  },
  globals = {},
) {
  const source = fs.readFileSync(path, 'utf8')
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
    },
  })
  const exports = {}
  vm.runInNewContext(outputText, { exports, require, ...globals }, { filename: path })
  return exports
}
const ownership = loadModule('src/utils/navigationOwnership.ts', undefined, { Error })
const flush = async () => {
  for (let i = 0; i < 24; i++) await Promise.resolve()
}
const deferred = () => {
  let resolve, reject
  const promise = new Promise((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}

function reactiveHarness() {
  const subscriptions = new Map()
  const getters = []
  const ref = (initial) => {
    let current = initial
    const result = {}
    Object.defineProperty(result, 'value', {
      get: () => current,
      set(value) {
        if (current === value) return
        const previous = current
        current = value
        for (const handler of subscriptions.get(result) ?? []) handler(value, previous)
      },
    })
    return result
  }
  const watch = (source, handler, options = {}) => {
    if (typeof source === 'function') getters.push({ source, handler, value: source() })
    else {
      if (!subscriptions.has(source)) subscriptions.set(source, new Set())
      subscriptions.get(source).add(handler)
    }
    if (options.immediate) handler(typeof source === 'function' ? source() : source.value)
    return () => subscriptions.get(source)?.delete(handler)
  }
  return {
    ref,
    watch,
    updateGetters() {
      for (const item of getters) {
        const value = item.source()
        if (value !== item.value) {
          const previous = item.value
          item.value = value
          item.handler(value, previous)
        }
      }
    },
  }
}

function navigationHarness({ reduced = true, storageBlocked = false } = {}) {
  const reactivity = reactiveHarness()
  const mounts = [],
    unmounts = [],
    routeHooks = {},
    timers = new Map(),
    assigned = [],
    classes = new Set(),
    storage = new Map()
  const motionListeners = new Set()
  let clock = 0,
    timerId = 0,
    stopped = 0,
    reset = 0,
    covers = 0,
    reveals = 0
  let nextCover, nextReveal
  const resolve = (value) => {
    const fullPath =
      typeof value === 'string'
        ? value
        : (value.fullPath ??
          value.path + (value.query ? '?' + new URLSearchParams(value.query) : ''))
    return {
      path: fullPath.split(/[?#]/u)[0],
      fullPath,
      href: fullPath,
      name: fullPath === '/' ? 'gallery' : 'subpage',
    }
  }
  const currentRoute = reactivity.ref(resolve('/'))
  const router = {
    currentRoute,
    resolve,
    isReady: () => Promise.resolve(),
    push: async () => undefined,
    onError(fn) {
      routeHooks.error = fn
      return () => stopped++
    },
    beforeEach(fn) {
      routeHooks.before = fn
      return () => stopped++
    },
    afterEach(fn) {
      routeHooks.after = fn
      return () => stopped++
    },
  }
  const state = {
    routeCurtainActive: reactivity.ref(false),
    routeCurtainBlocked: reactivity.ref(false),
  }
  const transition = {
    jumpTarget: reactivity.ref(null),
    overlayActive: reactivity.ref(false),
    isTransitioning: reactivity.ref(false),
    jumpPathFor: (id) =>
      ['/about', '/edit', '/color', '/news', '/poster', '/photo'][Number(id) - 1],
    endJump() {
      transition.jumpTarget.value = null
    },
  }
  const curtain = reactivity.ref({
    cover() {
      covers++
      return nextCover?.promise ?? Promise.resolve()
    },
    reveal() {
      reveals++
      return nextReveal?.promise ?? Promise.resolve()
    },
    reset() {
      reset++
      nextCover?.resolve()
      nextReveal?.resolve()
    },
  })
  const media = {
    matches: reduced,
    addEventListener(type, fn) {
      assert.equal(type, 'change')
      motionListeners.add(fn)
    },
    removeEventListener(type, fn) {
      assert.equal(type, 'change')
      motionListeners.delete(fn)
    },
  }
  const browser = {
    location: {
      pathname: '/',
      search: '',
      hash: '',
      assign: (href) => assigned.push(href),
      reload: () => assigned.push('reload'),
    },
    matchMedia: () => media,
    setTimeout(fn, delay) {
      const id = ++timerId
      timers.set(id, { fn, at: clock + delay })
      return id
    },
    clearTimeout: (id) => timers.delete(id),
  }
  const api = loadModule(
    'src/composables/useRouteCurtainNavigation.ts',
    (name) => {
      if (name === 'vue')
        return {
          ...reactivity,
          nextTick: () => Promise.resolve(),
          onMounted: (fn) => mounts.push(fn),
          onUnmounted: (fn) => unmounts.push(fn),
        }
      if (name === 'vue-router')
        return {
          NavigationFailureType: { duplicated: 16 },
          isNavigationFailure: (failure, kind) =>
            Boolean(failure?.type && (!kind || failure.type === kind)),
        }
      if (name.endsWith('usePageCurtain'))
        return {
          ...state,
          needsInitialCurtain: () => false,
          curtainTitleFor: (path) => ({ zh: path, en: path }),
        }
      if (name.endsWith('useTransition')) return transition
      if (name.endsWith('navigationOwnership')) return ownership
      throw Error(name)
    },
    {
      Error,
      window: browser,
      performance: { now: () => clock },
      requestAnimationFrame: (fn) => queueMicrotask(fn),
      sessionStorage: {
        getItem(key) {
          if (storageBlocked) throw Error('blocked')
          return storage.get(key) ?? null
        },
        setItem(key, value) {
          if (storageBlocked) throw Error('blocked')
          storage.set(key, value)
        },
        removeItem(key) {
          if (storageBlocked) throw Error('blocked')
          storage.delete(key)
        },
      },
      document: {
        documentElement: {
          classList: {
            add: (...names) => names.forEach((name) => classes.add(name)),
            remove: (...names) => names.forEach((name) => classes.delete(name)),
          },
        },
      },
      console: { error() {} },
    },
  )
  const view = api.useRouteCurtainNavigation({ router, curtain })
  return {
    ...state,
    ...transition,
    view,
    routeHooks,
    router,
    assigned,
    timers,
    classes,
    motionListeners,
    holdCover() {
      nextCover = deferred()
      return nextCover
    },
    holdReveal() {
      nextReveal = deferred()
      return nextReveal
    },
    async navigate(path) {
      const to = resolve(path),
        from = currentRoute.value
      const allowed = await routeHooks.before(to, from)
      if (allowed) {
        currentRoute.value = to
        reactivity.updateGetters()
        routeHooks.after(to, from)
      }
      return allowed
    },
    async elapse(ms) {
      clock += ms
      for (const [id, timer] of [...timers])
        if (timer.at <= clock) {
          timers.delete(id)
          timer.fn()
        }
      await flush()
    },
    async setReduced(value) {
      media.matches = value
      for (const fn of motionListeners) fn()
      await flush()
    },
    unmount() {
      for (const fn of unmounts) fn()
    },
    get stats() {
      return { covers, reveals, reset, stopped }
    },
  }
}

test('版本凭据与完整 query/hash 区分替代导航，纯决策不修改输入', () => {
  const original = ownership.createNavigationOwnership('/')
  const first = ownership.beginNavigation(
    ownership.observeNavigation(original, '/photo?q=1#one'),
    '/photo?q=1#one',
  )
  const second = ownership.beginNavigation(
    ownership.observeNavigation(first, '/photo?q=2#two'),
    '/photo?q=2#two',
  )
  assert.equal(original.version, 0)
  assert.equal(first.version, 1)
  assert.equal(second.version, 2)
  assert.equal(second.latestTarget, '/photo?q=2#two')
  assert.equal(
    ownership.focusedNavigationOutcome(second, '/photo?q=1#one', '/photo', '/', '/photo'),
    'superseded',
  )
  assert.equal(
    ownership.focusedNavigationOutcome(second, '/photo?q=2#two', '/photo', '/', '/photo'),
    'arrived',
  )
  assert.equal(ownership.invalidateNavigation(second).version, 3)
})

test('纯导航落点区分成功、被接管和失败；业务错误不触发模块重试', () => {
  const state = ownership.beginNavigation(ownership.createNavigationOwnership('/'), '/color')
  assert.equal(
    ownership.focusedNavigationOutcome(state, '/color', '/color', '/', '/color'),
    'arrived',
  )
  assert.equal(
    ownership.focusedNavigationOutcome(state, '/color', '/color', '/', '/about'),
    'cancelled',
  )
  assert.equal(ownership.focusedNavigationOutcome(state, '/color', '/color', '/', '/'), 'failed')
  for (const error of [
    'Failed to fetch dynamically imported module: /assets/color.js',
    'error loading dynamically imported module',
    'Importing a module script failed',
    'Loading chunk 4 failed',
    'Unable to preload CSS',
  ])
    assert.equal(ownership.isModuleNavigationError(new Error(error)), true)
  for (const error of [new Error('permission denied'), '网络不可用', null])
    assert.equal(ownership.isModuleNavigationError(error), false)
})

test('目标已落地才揭幕，视觉退出完成前仍锁输入', async () => {
  const h = navigationHarness()
  const reveal = h.holdReveal()
  await h.navigate('/color')
  await flush()
  assert.equal(h.stats.covers, 1)
  assert.equal(h.stats.reveals, 1)
  assert.equal(h.routeCurtainBlocked.value, false)
  assert.equal(h.routeCurtainActive.value, true)
  assert.equal(h.classes.has('page-turn-lock'), true)
  reveal.resolve()
  await flush()
  assert.equal(h.routeCurtainActive.value, false)
  assert.equal(h.classes.has('page-turn-lock'), false)
  h.unmount()
})

test('同页 query/hash 和重复点击均取消挂起旧导航，迟到错误不能覆盖新目标', async () => {
  for (const duplicated of [false, true]) {
    const h = navigationHarness()
    const cover = h.holdCover()
    const first = h.routeHooks.before(h.router.resolve('/color?old=1'), h.router.currentRoute.value)
    await flush()
    const replacement = h.router.resolve(duplicated ? '/' : '/?next=1#work')
    if (duplicated) h.routeHooks.after(replacement, h.router.currentRoute.value, { type: 16 })
    else await h.routeHooks.before(replacement, h.router.currentRoute.value)
    h.routeHooks.error(
      new Error('Failed to fetch dynamically imported module'),
      h.router.resolve('/color?old=1'),
    )
    cover.resolve()
    assert.equal(await first, false)
    assert.equal(h.routeCurtainActive.value, false)
    assert.equal(h.assigned.length, 0)
    assert.equal(h.view.jumpError.value, '')
    h.unmount()
  }
})

test('超时只给出口，慢路由后来成功仍可自动恢复', async () => {
  const h = navigationHarness()
  await h.routeHooks.before(h.router.resolve('/photo'), h.router.currentRoute.value)
  await h.elapse(8000)
  assert.match(h.view.jumpError.value, /仍在等待/)
  assert.equal(h.routeCurtainActive.value, true)
  h.router.currentRoute.value = h.router.resolve('/photo')
  h.routeHooks.after(h.router.currentRoute.value, h.router.resolve('/'))
  await flush()
  assert.equal(h.view.jumpError.value, '')
  assert.equal(h.routeCurtainActive.value, false)
  h.unmount()
})

test('揭幕被下一次导航替代时，旧视觉完成不得解除新目标输入锁', async () => {
  const h = navigationHarness()
  const oldReveal = h.holdReveal()
  await h.navigate('/color')
  await flush()
  const nextNavigation = h.navigate('/about')
  await flush()
  const newReveal = h.holdReveal()
  oldReveal.resolve()
  await nextNavigation
  await flush()
  assert.equal(h.stats.covers, 2)
  assert.equal(h.stats.reveals, 2)
  assert.equal(h.routeCurtainActive.value, true)
  assert.equal(h.classes.has('page-turn-lock'), true)
  newReveal.resolve()
  await flush()
  assert.equal(h.routeCurtainActive.value, false)
  h.unmount()
})

test('画廊的挂起 push 被别页接管后，迟到 reject 不恢复旧错误或自动重载', async () => {
  const h = navigationHarness()
  const pendingPush = deferred()
  h.router.push = async (destination) => {
    await h.routeHooks.before(h.router.resolve(destination), h.router.currentRoute.value)
    return pendingPush.promise
  }
  h.jumpTarget.value = '03'
  await flush()
  await h.navigate('/about')
  await flush()
  assert.equal(h.jumpTarget.value, null)
  pendingPush.reject(new Error('Failed to fetch dynamically imported module'))
  await flush()
  assert.equal(h.assigned.length, 0)
  assert.equal(h.view.jumpError.value, '')
  assert.equal(h.routeCurtainActive.value, false)
  assert.equal(h.timers.size, 0)
  h.unmount()
})

test('模块故障只自动重试目标一次，禁用 storage 时保留手动出口', async () => {
  for (const storageBlocked of [false, true]) {
    const h = navigationHarness({ storageBlocked })
    const to = h.router.resolve('/color?from=cards#reel')
    await h.routeHooks.before(to, h.router.currentRoute.value)
    h.routeHooks.error(new Error('Failed to fetch dynamically imported module'), to)
    assert.equal(h.assigned.length, storageBlocked ? 0 : 1)
    h.routeHooks.error(new Error('Failed to fetch dynamically imported module'), to)
    assert.equal(h.assigned.length, storageBlocked ? 0 : 1)
    assert.match(h.view.jumpError.value, /页面加载失败/)
    h.view.reloadPage()
    assert.equal(h.assigned.at(-1), to.fullPath)
    assert.equal(h.routeCurtainActive.value, false)
    h.unmount()
  }
})

test('减少动态偏好中途启用立即结束停留等待；卸载清理监听和定时器', async () => {
  const h = navigationHarness({ reduced: false })
  await h.navigate('/about')
  await flush()
  assert.equal(h.stats.reveals, 0)
  assert.equal(h.routeCurtainBlocked.value, true)
  await h.setReduced(true)
  assert.equal(h.stats.reveals, 1)
  assert.equal(h.routeCurtainActive.value, false)
  h.unmount()
  assert.equal(h.timers.size, 0)
  assert.equal(h.motionListeners.size, 0)
  assert.equal(h.stats.stopped, 3)
})

test('语言从 localStorage 恢复、同步 html.lang，并容忍读写失败', () => {
  for (const initial of ['en', 'zh', 'bad', null]) {
    const reactivity = reactiveHarness()
    const document = { documentElement: { lang: 'zh-CN' } }
    const values = new Map([['portfolio:language', initial]])
    const module = loadModule('src/composables/useSubpageLanguage.ts', () => reactivity, {
      window: {
        localStorage: {
          getItem: (key) => values.get(key),
          setItem: (key, value) => values.set(key, value),
        },
      },
      document,
    })
    assert.equal(module.subpageLanguage.value, initial === 'en' ? 'en' : 'zh')
    assert.equal(document.documentElement.lang, initial === 'en' ? 'en' : 'zh-CN')
    module.subpageLanguage.value = 'en'
    assert.equal(document.documentElement.lang, 'en')
    assert.equal(values.get('portfolio:language'), 'en')
  }
  const document = { documentElement: { lang: 'en' } }
  const module = loadModule('src/composables/useSubpageLanguage.ts', () => reactiveHarness(), {
    window: {
      localStorage: {
        getItem() {
          throw Error('blocked')
        },
        setItem() {
          throw Error('blocked')
        },
      },
    },
    document,
  })
  assert.equal(module.subpageLanguage.value, 'zh')
  module.subpageLanguage.value = 'en'
  assert.equal(document.documentElement.lang, 'en')
})
