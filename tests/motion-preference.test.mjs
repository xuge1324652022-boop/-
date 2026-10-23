import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import test from 'node:test'
import ts from 'typescript'
import { parse } from '@vue/compiler-sfc'
import { gsap } from 'gsap'

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const setup = path => parse(read(path)).descriptor.scriptSetup.content
const compile = source => ts.transpileModule(source, { compilerOptions: {
  target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS,
} }).outputText
function functions(source, names) {
  const file = ts.createSourceFile('actual.ts', source, ts.ScriptTarget.Latest, true)
  return file.statements.filter(node => ts.isFunctionDeclaration(node) && names.includes(node.name?.text))
    .map(node => node.getText(file)).join('\n')
}

test('卡内减少动态完成显影，重复play/restart不能恢复环境循环，重挂载保留已完成状态', () => {
  let reduced = false
  const base = {}
  vm.runInNewContext(compile(read('src/cardAnimations/base.ts')), {
    exports: base,
    require: () => ({ __esModule: true, default: gsap }),
    window: { matchMedia: () => ({ matches: reduced }) },
  })
  class Probe extends base.BaseAnimation {
    name = 'probe'
    ambient = { x: 0 }
    entrance = { opacity: 0 }
    build(timeline) { timeline.to(this.ambient, { x: 10, duration: 10 }) }
    introDelay() { return 0 }
    buildIntro(timeline) { timeline.fromTo(this.entrance, { opacity: 0 }, { opacity: 1, duration: 1 }) }
  }
  const animation = new Probe()
  animation.mount({})
  animation.restart()
  animation.intro.progress(.35).pause()
  assert.ok(animation.entrance.opacity > 0 && animation.entrance.opacity < 1)
  animation.destroy()
  animation.mount({})
  assert.equal(animation.entrance.opacity, 1, 'resize复用实例不会留下暂停在初态的显影')
  animation.restart()
  animation.intro.progress(.35).pause()
  reduced = true
  animation.pause()
  assert.equal(animation.entrance.opacity, 1)
  assert.equal(animation.intro.paused(), true)
  animation.play()
  animation.restart()
  assert.equal(animation.tl.paused(), true, 'renderer再次play以及重新聚焦仍保持静态')
  assert.equal(animation.intro.progress(), 1)
  animation.destroy()
  animation.mount({})
  assert.equal(animation.entrance.opacity, 1)
  reduced = false
  animation.play()
  assert.equal(animation.tl.paused(), false)
  assert.equal(animation.intro.progress(), 1, '恢复偏好不重新隐藏已看过的文字')
  animation.destroy()
})

test('CardVisual实际生命周期重建指针绑定，保留实例，卸载后移除媒体监听', () => {
  let mount, unmount, listener, exposed, created = 0, removed = false
  const calls = []
  const child = { closest: () => null }
  const independentlyOwned = { closest: () => ({}) }
  const host = { clientWidth: 200, clientHeight: 100,
    querySelectorAll: () => [child, independentlyOwned], closest: () => null }
  const media = { matches: false, addEventListener(_event, fn) { listener = fn },
    removeEventListener(_event, fn) { assert.equal(fn, listener); removed = true } }
  const animation = Object.fromEntries(['mount', 'destroy', 'setActive', 'play', 'pause']
    .map(name => [name, () => { calls.push(name) }]))
  const scope = {
    exports: {}, defineProps: () => ({ index: 1, active: true }), defineExpose(value) { exposed = value },
    window: { matchMedia: () => media },
    require(name) {
      if (name === 'vue') return { ref: () => ({ value: host }), watch() {},
        onMounted: fn => { mount = fn }, onUnmounted: fn => { unmount = fn } }
      if (name === 'gsap') return { __esModule: true, default: {
        killTweensOf(nodes) {
          assert.equal(nodes.length, 2); assert.equal(nodes[0], host); assert.equal(nodes[1], child)
          calls.push('kill')
        },
        set() { calls.push('clear') },
      } }
      if (name.endsWith('cardAnimations')) return { createCardAnimation: () => { created++; return animation } }
      return {}
    },
  }
  vm.runInNewContext(compile(setup('src/components/CardVisual.vue')), scope)
  mount()
  calls.length = 0
  media.matches = true
  listener()
  assert.deepEqual(calls, ['pause', 'destroy', 'kill', 'clear', 'mount', 'setActive', 'play'])
  host.clientWidth = 300
  exposed.remount()
  assert.equal(created, 1, 'resize与偏好切换都必须复用持有显影状态的章节实例')
  unmount()
  assert.equal(removed, true)
  assert.equal(calls.at(-1), 'destroy')
})

test('ABOUT实际入场补间在中途resize后清除自身样式，保留父级几何与子层视差', () => {
  const base = {}, about = {}, cleared = []
  const cssDefaults = { scale: 1, y: 0, opacity: 1 }
  const host = Object.create(cssDefaults)
  const plane = { x: 240, rotation: -30 }, layer = { x: 18, y: 9 }
  // Node没有CSSStyleDeclaration：仅适配clearProps的CSS回退语义，补间与时间线仍跑真实GSAP。
  const animationGsap = {
    timeline: (...args) => gsap.timeline(...args),
    fromTo: (...args) => gsap.fromTo(...args),
    killTweensOf: (...args) => gsap.killTweensOf(...args),
    set(target, values) {
      assert.equal(target, host, '只允许清理本实例的.card-visual宿主')
      assert.equal(values.clearProps, 'transform,opacity')
      cleared.push(target)
      for (const property of ['scale', 'y', 'opacity']) delete target[property]
    },
  }
  const gsapModule = { __esModule: true, default: animationGsap }
  vm.runInNewContext(compile(read('src/cardAnimations/base.ts')), {
    exports: base, require: () => gsapModule,
    window: { matchMedia: () => ({ matches: false }) },
  })
  vm.runInNewContext(compile(read('src/cardAnimations/about.ts')), {
    exports: about, require: name => name === 'gsap' ? gsapModule : base,
  })
  const animation = new about.AboutAnimation()
  try {
    animation.mount(host)
    animation.restart()
    const entrance = gsap.getTweensOf(host)[0]
    assert.ok(entrance, '聚焦建立的宿主入场补间必须真实存在')
    entrance.progress(.3).pause()
    assert.ok(host.opacity > 0 && host.opacity < 1)
    assert.ok(host.scale < 1 && host.y > 0)
    animation.destroy()
    animation.mount(host)
    animation.play()
    assert.equal(cleared.length, 1)
    assert.equal(host.opacity, 1, '重建后不能永久停在半透明中间帧')
    assert.equal(host.scale, 1)
    assert.equal(host.y, 0)
    assert.equal(gsap.getTweensOf(host).length, 0, '旧入场补间不再持有宿主')
    assert.deepEqual(plane, { x: 240, rotation: -30 })
    assert.deepEqual(layer, { x: 18, y: 9 })
  } finally {
    animation.destroy()
  }
})

test('首页切换减少动态会完成入场/展开/返回/索引收尾，不遗留中间相位或触碰路由锁', () => {
  for (const initialPhase of ['intro', 'focusing', 'returning']) {
    const entering = initialPhase !== 'returning'
    const phase = { value: initialPhase }
    const state = { orbit: 0, entrance: initialPhase === 'intro' ? .3 : 1, focus: entering ? .3 : .7 }
    let paused = 0, rendered = 0, indexFinished = 0, tickerRemoved = 0
    const timeline = gsap.timeline({ paused: true, onComplete() { phase.value = entering ? 'detail' : 'gallery' } })
      .to(state, { focus: entering ? 1 : 0, duration: 1 })
    const indexAnimation = gsap.timeline({ paused: true, onComplete() { indexFinished++ } })
      .to({}, { duration: 1 })
    const introTimeline = initialPhase === 'intro'
      ? gsap.timeline({ paused: true, onComplete() { phase.value = 'focusing' } }).to(state, { entrance: 1, duration: 1 }) : null
    const scope = {
      destroyed: false, reducedMotion: false, motionMedia: { matches: true },
      pointerStart: null, dragTarget: null, dragging: { value: true }, suppressClick: true,
      dragSamples: [1], orbitTarget: 0, activeIndex: { value: 0 }, state,
      orbitTween: null, introTimeline, chapterInstance: { timeline }, indexAnimation,
      pointerAt: { inside: true }, hoverIndex: { value: 3 },
      drift: { x: 1, y: 1 }, driftTarget: { x: 1, y: 1 }, driftRendered: { x: 1, y: 1 },
      prox: [1, 1], proxTarget: [1, 1], parallaxTick() {}, parallaxAttached: true,
      gsap: { ticker: { remove() { tickerRemoved++ } } }, render() { rendered++ },
      visuals: [{ pause() { paused++ } }], refreshProximity() {},
      document: { documentElement: { classList: { remove() { throw Error('route lock has another owner') } } } },
    }
    vm.createContext(scope)
    vm.runInContext(compile(functions(setup('src/components/ThreeHome.vue'), ['onMotionChange'])), scope)
    scope.onMotionChange()
    assert.equal(phase.value, entering ? 'detail' : 'gallery')
    assert.equal(state.focus, entering ? 1 : 0)
    assert.equal(state.entrance, 1)
    assert.equal(indexFinished, 1)
    assert.equal(paused, 0, '宿主不覆盖卡内可见性播放状态，恢复偏好后才能继续环境循环')
    assert.equal(rendered, 1)
    assert.equal(tickerRemoved, 1)
    assert.equal(scope.dragging.value, false)
    assert.equal(scope.drift.x, 0)
    assert.deepEqual(scope.prox, [0, 0])
    timeline.kill(); indexAnimation.kill(); introTimeline?.kill()
  }
})

test('摄影页切换减少动态释放揭示，异步nextTick不能在偏好变化后重建旧动画', async () => {
  let disposed = 0, killed = 0, built = 0
  const scope = {
    reduceMotion: false, motionMedia: { matches: true }, disposed: false,
    introGone: { value: true }, covered: { value: false }, rootRef: { value: {} }, titleRef: { value: {} },
    introTimeline: { kill() { killed++ } }, reveal: { dispose() { disposed++ } },
    gsap: { set(_target, values) { assert.equal(values.clearProps, 'transform,opacity') } },
    nextTick: () => Promise.resolve(), setupAboutReveal() { built++; return { dispose() { disposed++ } } },
  }
  vm.createContext(scope)
  vm.runInContext(compile(functions(setup('src/views/PhotoView.vue'), ['buildReveal', 'onMotionChange'])), scope)
  scope.onMotionChange()
  assert.equal(killed, 1)
  assert.equal(disposed, 1)
  assert.equal(scope.reveal, null)
  scope.motionMedia.matches = false
  scope.onMotionChange()
  scope.motionMedia.matches = true
  scope.onMotionChange()
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(built, 0, '先前排队的buildReveal不能在减少动态分支重建动画')
  scope.motionMedia.matches = false
  scope.onMotionChange()
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(built, 1)
  scope.motionMedia.matches = true
  scope.onMotionChange()
})

test('ABOUT独立三层指针视差实时回到基线，恢复偏好可重用，卸载清理quickTo', () => {
  const pointerListeners = new Map(), documentListeners = new Map()
  let mediaListener, killed = 0
  const media = { matches: false,
    addEventListener(_event, fn) { mediaListener = fn },
    removeEventListener(_event, fn) { assert.equal(fn, mediaListener); mediaListener = undefined },
  }
  const nodes = Array.from({ length: 3 }, () => ({ x: 0, y: 0 }))
  let queried = 0
  const module = {}
  vm.runInNewContext(compile(read('src/components/about/aboutExperienceAnimation.ts')), {
    exports: module,
    window: { innerWidth: 1000, innerHeight: 800, matchMedia: () => media,
      addEventListener: (name, fn) => pointerListeners.set(name, fn),
      removeEventListener: name => pointerListeners.delete(name),
    },
    document: {
      addEventListener: (name, fn) => documentListeners.set(name, fn),
      removeEventListener: name => documentListeners.delete(name),
    },
    require: () => ({ __esModule: true, default: { quickTo(node, property) {
      const update = value => { node[property] = value }
      update.tween = { progress() { return this }, pause() { return this }, kill() { killed++ } }
      return update
    } } }),
  })
  const handle = module.createAboutExperience({ querySelector: () => nodes[queried++] })
  pointerListeners.get('pointermove')({ clientX: 1000, clientY: 800 })
  assert.ok(nodes.every(node => node.x > 0 && node.y > 0))
  media.matches = true
  mediaListener()
  assert.equal(pointerListeners.size, 0)
  assert.equal(documentListeners.size, 0)
  assert.ok(nodes.every(node => node.x === 0 && node.y === 0))
  media.matches = false
  mediaListener()
  assert.equal(pointerListeners.size, 1)
  pointerListeners.get('pointermove')({ clientX: 0, clientY: 0 })
  assert.ok(nodes.every(node => node.x < 0 && node.y < 0))
  handle.destroy()
  assert.equal(killed, 6)
  assert.equal(mediaListener, undefined)
  assert.equal(pointerListeners.size, 0)
  assert.equal(documentListeners.size, 0)
})
