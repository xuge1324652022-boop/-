/** 执行真实组件函数，覆盖内置浏览器拒播、异步播放取消及跨触摸轨迹边界。 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import { parse } from '@vue/compiler-sfc'

const source = path => parse(fs.readFileSync(path, 'utf8')).descriptor.scriptSetup.content
const functions = (text, names) => {
  const file = ts.createSourceFile('actual.ts', text, ts.ScriptTarget.Latest, true)
  return file.statements.filter(node => ts.isFunctionDeclaration(node) && names.includes(node.name?.text)).map(node => node.getText(file)).join('\n')
}
const run = (code, globals = {}) => {
  const exports = {}
  vm.runInNewContext(ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText,
    { exports, Symbol, Promise, ...globals })
  return exports
}
const flush = async () => { await Promise.resolve(); await Promise.resolve() }
const names = ['pauseVideo', 'mediaAvailable', 'playVideo', 'retryVideo', 'releaseVideo', 'syncBodyMedia']
const overlays = new Set()
const doc = { visibilityState: 'visible', documentElement: { classList: { contains: name => overlays.has(name) } } }
const media = run(`
  let disposed = false, reduceMotion = false
  const covered = { value: false }, routeCurtainActive = { value: false }
  const blockedVideos = { value: new Set() }, pendingPlays = new Map()
  const visibleVideos = new Set(), nearbyVideos = new Set(), loopFadeOffs = new Map()
  let bodyVideos = []
  ${functions(source('src/views/ColorView.vue'), names)}
  exports.state = { covered, routeCurtainActive, blockedVideos, pendingPlays, visibleVideos, nearbyVideos, loopFadeOffs }
  exports.setVideos = value => { bodyVideos = value }
  exports.reduce = value => { reduceMotion = value }
  ${names.map(name => `exports.${name} = ${name}`).join('\n')}
`, {
  document: doc,
  warmVideo() {}, attachLoopFade: () => () => {},
})
const video = () => {
  const attrs = new Set(['src'])
  const classes = new Set()
  return { dataset: { clip: '1' }, paused: true, muted: false, readyState: 2, currentTime: 3, pauses: 0, loads: 0,
    play() { this.paused = false; return Promise.resolve() },
    pause() { this.paused = true; this.pauses++ },
    hasAttribute: key => attrs.has(key), removeAttribute: key => attrs.delete(key),
    load() { this.loads++ }, closest: () => ({ classList: { add: key => classes.add(key), remove: key => classes.delete(key) } }),
  }
}
const v = video()
media.setVideos([v]); media.state.visibleVideos.add(v); media.state.nearbyVideos.add(v)
let calls = 0
v.play = () => { calls++; return Promise.reject({ name: 'NotAllowedError' }) }
media.syncBodyMedia(); await flush()
assert.equal(calls, 1); assert.equal(media.state.blockedVideos.value.has(1), true)
media.syncBodyMedia(); await flush(); assert.equal(calls, 1, '拒播后不在每次观察器更新时重复请求')
let gestureStack = false
v.play = () => { assert.equal(gestureStack, true); v.paused = false; return Promise.resolve() }
gestureStack = true
media.retryVideo({ currentTarget: { closest: () => ({ querySelector: () => v }) } })
gestureStack = false
await flush()
assert.equal(v.muted, true); assert.equal(media.state.blockedVideos.value.size, 0)
console.log('PASS 拒播显示手动入口；手势处理栈内调用 play，成功后消除入口')

let resolvePending
v.paused = true
v.play = () => { v.paused = false; return new Promise(resolve => { resolvePending = resolve }) }
media.playVideo(v)
doc.visibilityState = 'hidden'; media.syncBodyMedia()
assert.equal(v.paused, true)
resolvePending(); await flush()
assert.equal(v.paused, true); assert.equal(media.state.blockedVideos.value.size, 0)
doc.visibilityState = 'visible'
overlays.add('has-subpage-index'); media.syncBodyMedia()
assert.equal(media.state.pendingPlays.size, 0)
overlays.clear()
console.log('PASS 播放请求中切后台及打开索引均暂停，迟到成功不恢复隐藏媒体')

// 新旧请求交错：离屏取消后的迟到拒绝不能覆盖后一次成功。
let rejectOld
v.paused = true; v.play = () => new Promise((_, reject) => { rejectOld = reject })
media.playVideo(v)
media.pauseVideo(v)
v.play = () => Promise.resolve()
media.playVideo(v); await flush()
rejectOld({ name: 'NotAllowedError' }); await flush()
assert.equal(media.state.blockedVideos.value.size, 0)
media.state.covered.value = true
media.syncBodyMedia(); assert.equal(v.paused, true)
media.state.covered.value = false
media.state.visibleVideos.delete(v); media.state.nearbyVideos.delete(v)
let detached = 0
media.state.loopFadeOffs.set(v, () => { detached++ })
media.syncBodyMedia()
assert.equal(v.hasAttribute('src'), false); assert.equal(v.loads, 1); assert.equal(detached, 1)
assert.equal(media.state.loopFadeOffs.size, 0)
console.log('PASS 覆盖暂停、迟到拒绝隔离、离开预热范围释放视频源及循环动画')

const fieldNames = ['resetTrail', 'onPointerDown', 'onPointerEnd', 'insideField', 'onMove']
const field = run(`
  let pointerActive = true, hasLast = false, acc = 0, touchPointerId = null, lastX = 0, lastY = 0, lastSpawnAt = 0
  const rootEl = { value: { getBoundingClientRect: () => ({ left: 0, top: -100, right: 390, bottom: 600 }) } }
  const SPAWN_DIST = 100, SPAWN_DIST_TOUCH = 30, MIN_SPAWN_INTERVAL = 10, MOBILE_AMP = .5, TITLE_AX = 110, TITLE_AY = 70
  let setters = null, spawned = 0, left = 0
  const isMobile = () => true
  const spawn = () => { spawned++ }
  function onLeave() { left++; resetTrail() }
  ${functions(source('src/components/color/ColorWave.vue'), fieldNames)}
  ${fieldNames.map(name => `exports.${name} = ${name}`).join('\n')}
  exports.state = () => ({ hasLast, acc, touchPointerId, spawned, left })
`, { window: { innerWidth: 390, innerHeight: 844 }, performance: { now: () => 1000 }, Element: class {} })
const pointer = (id, x, y = 300, isPrimary = true) => ({ pointerId: id, pointerType: 'touch', clientX: x, clientY: y, isPrimary })
field.onPointerDown(pointer(1, 10)); field.onMove(pointer(1, 60))
assert.equal(field.state().spawned, 1)
field.onPointerEnd(pointer(1, 60)); field.onMove(pointer(1, 300))
assert.equal(field.state().spawned, 1, '抬手之后的位置不能拼入上一条轨迹')
field.onPointerDown(pointer(2, 300)); assert.equal(field.state().acc, 0)
field.onPointerDown(pointer(3, 310, 300, false)); field.onMove(pointer(2, 20))
assert.equal(field.state().spawned, 1, '第二根手指取消预览轨迹，保留缩放')
field.onPointerDown(pointer(4, 20, 700)); assert.equal(field.state().touchPointerId, null)
field.onPointerDown(pointer(5, 20)); field.onMove(pointer(5, 20, 700))
assert.equal(field.state().left, 1); assert.equal(field.state().hasLast, false)
console.log('PASS 单指轨迹、抬手/取消复位、双指缩放与舞台外坐标边界')

const home = run(`
  let cancelled = 0
  function onPointerCancel() { cancelled++ }
  ${functions(source('src/components/ThreeHome.vue'), ['onPointerDown'])}
  exports.onPointerDown = onPointerDown
  exports.cancelled = () => cancelled
`)
home.onPointerDown(pointer(2, 100, 300, false))
assert.equal(home.cancelled(), 1)
console.log('PASS 首页第二根手指取消旧拖拽，不以新坐标重建圆环起点')
