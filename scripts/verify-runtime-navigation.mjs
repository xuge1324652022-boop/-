/** 定向运行实际源码：导航恢复、旧链接、开场中断及移动端触摸边界。无需浏览器。 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import { parse } from '@vue/compiler-sfc'
import { gsap } from 'gsap'

const read = path => fs.readFileSync(path, 'utf8')
const script = path => parse(read(path)).descriptor.scriptSetup.content
const compile = source => ts.transpileModule(source, { compilerOptions: {
  target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS,
} }).outputText
const cases = []
const pass = name => cases.push(name)
function functions(source, names) {
  const file = ts.createSourceFile('actual.ts', source, ts.ScriptTarget.Latest, true)
  return file.statements.filter(node => ts.isFunctionDeclaration(node) && names.includes(node.name?.text)).map(node => node.getText(file)).join('\n')
}

// 异常旧面包屑不能变成 NaN/越界卡号；合法六卡与旧格式照常恢复。
const transition = {}
let crumb
vm.runInNewContext(compile(read('src/composables/useTransition.ts')), {
  exports: transition, require: () => ({ ref: value => ({ value }) }), window: { history: { state: {} } },
  sessionStorage: { getItem: () => crumb, removeItem: () => { crumb = null } },
})
for (const value of ['bad', '00', '07', '{"id":"x"}', '{"id":"01","position":"wrong"}', 'null', '{']) {
  crumb = value
  const actual = transition.consumeSubpageVisit()
  if (value.includes('wrong')) assert.equal(actual.position, null)
  else assert.equal(actual, null, value)
}
for (let n = 1; n <= 6; n++) {
  const id = `0${n}`
  crumb = id; assert.equal(transition.consumeSubpageVisit().id, id)
  crumb = JSON.stringify({ id, position: n }); assert.equal(transition.consumeSubpageVisit().position, n)
}
pass('六卡面包屑、旧格式与损坏输入均安全处理')

// 实际 router 配置：beforeResolve 先在遮罩下归零，视图就绪后恢复 hash/历史位置。
let config, beforeResolve
const target = { id: 'work-campus-media' }
let scrollCalls = 0
vm.runInNewContext(compile(read('src/router/index.ts')), {
  exports: {}, window: { scrollX: 0, scrollY: 600, scrollTo() { scrollCalls++ } },
  document: { getElementById: id => id === target.id ? target : null },
  require(name) {
    if (name === 'vue-router') return { createWebHistory: () => ({}), createRouter(options) {
      config = options; return { beforeResolve: fn => { beforeResolve = fn } }
    } }
    if (name.endsWith('usePageCurtain')) return { routeCurtainBlocked: { value: true } }
    if (name.endsWith('useTransition')) return transition
    throw Error(name)
  },
})
const legacy = config.routes.find(route => route.path.startsWith('/card/:id'))
for (let n = 1; n <= 6; n++) {
  const id = `0${n}`, query = { from: 'gallery' }
  const result = legacy.redirect({ params: { id }, query, hash: '#intro' })
  assert.equal(result.path, ['/about', '/edit', '/color', '/news', '/poster', '/photo'][n - 1])
  assert.equal(result.query, query); assert.equal(result.hash, '#intro')
}
const from = { name: 'gallery', path: '/' }
const to = { path: '/about', fullPath: '/about#work-campus-media', hash: '#work-campus-media' }
beforeResolve(to, from)
assert.equal(scrollCalls, 1)
assert.equal(config.scrollBehavior(to, from, null).el, target)
assert.equal(config.scrollBehavior(to, from, { top: 950 }).top, 950)
assert.equal(config.scrollBehavior({ path: '/photo', fullPath: '/photo', hash: '' }, from, { top: 420 }).top, 420)
assert.equal(config.scrollBehavior({ ...to, hash: '#%E0%A4' }, from, null).top, 0)
beforeResolve({ path: '/photo', fullPath: '/photo' }, from)
assert.equal(config.scrollBehavior({ path: '/photo', fullPath: '/photo', hash: '' }, from, null), false)
assert.equal(config.scrollBehavior({ path: '/photo', fullPath: '/photo', hash: '' }, from, null).top, 0)
pass('六个旧链接保留 query/hash；遮罩归零与深链/后退恢复相容，准备标记只消费一次')

// 实际 Preloader lifecycle：提前卸载不可晚发 complete，也不可遗留 overflow 锁。
async function preloaderCase(completeNormally) {
  let mount, unmount, completion, killed = 0, reverted = 0, emitted = 0, dispatched = 0, i = 0
  const root = { querySelectorAll: () => [] }
  const split = { querySelector: () => ({ textContent: '' }) }
  const refs = [root, {}, split, {}, {}]
  const doc = { documentElement: { style: { overflow: 'clip' } }, body: { style: { overflow: '' } } }
  const tl = { to(_target, vars) { if (vars.onComplete) completion = vars.onComplete; return tl }, add() { return tl }, kill() { killed++ } }
  const exports = {}
  vm.runInNewContext(compile(script('src/components/Preloader.vue')), {
    exports, defineEmits: () => () => { emitted++ }, document: doc, CustomEvent: class {},
    window: { innerWidth: 390, matchMedia: () => ({ matches: false }), dispatchEvent() { dispatched++ } },
    require(name) {
      if (name === 'vue') return { ref: () => ({ value: refs[i++] }), nextTick: () => Promise.resolve(), onMounted: fn => { mount = fn }, onBeforeUnmount: fn => { unmount = fn } }
      if (name === 'gsap') return { __esModule: true, default: { context(fn, scope) { assert.equal(scope, root); fn(); return { ignore(work) { work() }, revert() { reverted++ } } }, set() {}, timeline: () => tl } }
      throw Error(name)
    },
  })
  await mount()
  assert.equal(doc.documentElement.style.overflow, 'hidden')
  if (completeNormally) completion()
  unmount()
  completion()
  assert.equal(doc.documentElement.style.overflow, 'clip')
  assert.equal(doc.body.style.overflow, '')
  assert.equal(emitted, completeNormally ? 1 : 0)
  assert.equal(dispatched, completeNormally ? 1 : 0)
  assert.equal(killed, 1); assert.equal(reverted, 1)
}
await preloaderCase(false)
await preloaderCase(true)
pass('开场正常完成与中途卸载均释放 timeline/context/滚动锁，迟到回调不重复交接')

// 必须使用真实 GSAP：其 onComplete 会恢复父 context，普通 mock 无法发现
// 同步交接创建的 ThreeHome 动画被 Preloader context.revert 连带回收的问题。
assert.match(script('src/components/Preloader.vue'), /if \(context\) context\.ignore\(finish\)/)
function contextHandoff(ignored) {
  let timeline, child
  const state = { progress: 0 }
  const parent = gsap.context(() => {})
  try {
    parent.add(() => {
      timeline = gsap.timeline({ paused: true }).to({}, { duration: .1, onComplete() {
        const finish = () => { child = gsap.to(state, { progress: 1, duration: 1, paused: true, ease: 'none' }) }
        if (ignored) parent.ignore(finish)
        else finish()
      } })
    })
    timeline.totalProgress(1)
    assert.ok(child, '完成回调必须同步创建下一段动画')
    const collected = parent.getTweens().includes(child)
    parent.revert()
    const survived = child.parent !== null
    if (survived) child.totalTime(.5)
    return { collected, survived, progress: state.progress }
  } finally {
    parent.revert()
    timeline?.kill()
    child?.kill()
    gsap.ticker.sleep()
  }
}
assert.deepEqual(contextHandoff(false), { collected: true, survived: false, progress: 0 })
assert.deepEqual(contextHandoff(true), { collected: false, survived: true, progress: .5 })
pass('真实 GSAP onComplete 同步交接通过 context.ignore 脱离父级，父级 revert 后子动画继续推进')

// 运行调色页的真实手势函数，覆盖横滑、缩放、控件、遮罩与 native-scroll 绕过。
const color = script('src/views/ColorView.vue')
const exports = {}
let inside = true, control = false
class Element { closest() { return control } }
const html = { classList: { contains: () => false } }
const colorWindow = { scrollY: 0 }
vm.runInNewContext(compile(`
  let touchX = 0, touchY = 0, touchId = null, reduceMotion = false
  const introRef = { value: { contains: () => inside(), offsetHeight: 800 } }
  const gateFed = { value: 0 }, gateOpen = { value: false }, gateTravel = { value: 800 }, scrollP = { value: 0 }
  const covered = { value: false }, overlayActive = { value: false }, isTransitioning = { value: false }, routeCurtainActive = { value: false }
  ${functions(color, ['feedGate', 'updateProgress', 'onTouchStart', 'onTouchMove'])}
  export { onTouchStart, onTouchMove, updateProgress, gateFed, gateOpen, routeCurtainActive }
`), { exports, Element, inside: () => inside, document: { documentElement: html }, window: colorWindow })
let prevented = 0
const touch = (x, y, identifier = 1) => ({ clientX: x, clientY: y, identifier })
const event = touches => ({ target: new Element(), touches, cancelable: true, preventDefault() { prevented++ } })
exports.onTouchStart(event([touch(100, 700)])); exports.onTouchMove(event([touch(100, 600)]))
assert.equal(exports.gateFed.value, 100); assert.equal(prevented, 1)
exports.onTouchMove(event([touch(0, 590)])); assert.equal(exports.gateFed.value, 100)
exports.onTouchMove(event([touch(0, 500), touch(20, 500, 2)])); assert.equal(exports.gateFed.value, 100)
inside = false; exports.onTouchStart(event([touch(0, 700)])); exports.onTouchMove(event([touch(0, 400)])); assert.equal(exports.gateFed.value, 100)
inside = true; control = true; exports.onTouchStart(event([touch(0, 700)])); exports.onTouchMove(event([touch(0, 400)])); assert.equal(exports.gateFed.value, 100)
control = false; exports.routeCurtainActive.value = true; exports.onTouchStart(event([touch(0, 700)])); exports.onTouchMove(event([touch(0, 400)])); assert.equal(exports.gateFed.value, 100)
colorWindow.scrollY = 300; exports.updateProgress(); assert.equal(exports.gateOpen.value, true)
pass('调色首屏只消费单指纵滑，不抢横滑、双指、正文、控件或揭幕期间输入')

const home = script('src/components/ThreeHome.vue')
const resizeExports = {}
let rect = { width: 390, height: 844 }, rebuilt = 0, sensitivities = 0, pending = 0
vm.runInNewContext(compile(`
  let viewport = {}, lastViewportWidth = 0, lastViewportHeight = 0, pendingResize = null
  const HEIGHT_DEBOUNCE_MS = 160, HEIGHT_BAR_THRESHOLD_PX = 80
  const rootRef = { value: { getBoundingClientRect: () => measure() } }
  ${functions(home, ['resize', 'scheduleResize', 'flushPendingResize'])}
  export { resize, scheduleResize, flushPendingResize }
`), { exports: resizeExports, measure: () => rect, updateDragSensitivity: () => sensitivities++, render() {}, refreshProximity() {}, remountVisuals: () => rebuilt++,
  setTimeout() { pending++; return 1 }, clearTimeout() { pending-- } })
resizeExports.resize(); resizeExports.scheduleResize()
assert.equal(rebuilt, 1); assert.equal(pending, 0)
rect = { width: 844, height: 390 }; resizeExports.scheduleResize()
assert.equal(rebuilt, 2); assert.equal(sensitivities, 2)
rect = { width: 844, height: 380 }; resizeExports.scheduleResize(); resizeExports.scheduleResize()
assert.equal(pending, 1)
resizeExports.flushPendingResize(); assert.equal(rebuilt, 3); assert.equal(pending, 0)
resizeExports.scheduleResize(); assert.equal(pending, 0)
pass('首页转屏同步卡片测量与拖动尺度；小高度变化合并，不在相同尺寸反复重建')

console.log(JSON.stringify({ status: 'PASS', cases }, null, 2))
