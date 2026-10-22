/** 执行真实触摸守卫，验证旧微信滚动链、内部滚动、缩放及索引入口。 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import { parse } from '@vue/compiler-sfc'

const compile = source => ts.transpileModule(source, { compilerOptions: {
  target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS,
} }).outputText
const read = file => fs.readFileSync(file, 'utf8')
class Element {
  constructor(parentElement = null, style = {}) {
    this.parentElement = parentElement
    this.style = { overflowX: 'visible', overflowY: 'visible', ...style }
    this.scrollTop = this.scrollLeft = 0
    this.clientWidth = this.clientHeight = this.scrollWidth = this.scrollHeight = 100
  }
  contains(node) { for (; node; node = node.parentElement) if (node === this) return true; return false }
}
const listeners = new Map()
const events = {
  addEventListener(type, listener, options) {
    assert.equal(options.capture, true)
    if (type === 'touchmove') assert.equal(options.passive, false)
    listeners.set(type, listener)
  },
  removeEventListener(type, listener, capture) {
    assert.equal(capture, true)
    assert.equal(listeners.get(type), listener)
    listeners.delete(type)
  },
}
const api = {}
const viewport = { scale: 1 }
vm.runInNewContext(compile(read('src/utils/overlayTouchGuard.ts')), {
  exports: api, Element, document: events, window: { visualViewport: viewport }, getComputedStyle: node => node.style,
})
const host = new Element(), content = new Element(host), outside = new Element()
let active = true
const dispose = api.guardOverlayTouchScroll(() => host, () => active, events)
function touch(type, target = content, x = 80, y = 80, count = 1) {
  let prevented = false
  const event = { target, cancelable: true, touches: Array.from({ length: count }, () => ({ clientX: x, clientY: y })), preventDefault() { prevented = true } }
  listeners.get(type)(event)
  return prevented
}
function drag(target, dx, dy) { touch('touchstart', target); return touch('touchmove', target, 80 + dx, 80 + dy) }
assert.equal(drag(content, 0, -20), true, '不能滚动的作品区不得带动背后正文')
assert.equal(drag(outside, 0, 20), true, '弹层外的拖动不能透传')
content.style.overflowY = 'auto'; content.scrollHeight = 400; content.scrollTop = 30
assert.equal(drag(content, 0, 20), false, '内部列表还能向上滚动')
content.scrollTop = 0
assert.equal(drag(content, 0, 20), true, '顶部回弹不能带动背景')
assert.equal(drag(content, 0, -20), false, '顶部向下浏览继续放行')
content.scrollTop = 300
assert.equal(drag(content, 0, -20), true, '底部滚动链不得穿透')
host.style.overflowY = 'auto'; host.scrollHeight = 400; host.scrollTop = 30
assert.equal(drag(content, 0, -20), false, '内层抵达边界时允许外层弹窗继续滚动')
host.scrollHeight = 100; host.scrollTop = 0
content.style.overflowX = 'auto'; content.scrollWidth = 400; content.scrollLeft = 20
assert.equal(drag(content, -20, 0), false, '缩略条横向浏览不受影响')
content.scrollLeft = 0
assert.equal(drag(content, 20, 0), true, '缩略条边缘不带动背景')
touch('touchstart', content, 80, 80, 2)
assert.equal(touch('touchmove', content, 80, 40, 2), false, '保留双指缩放')
assert.equal(touch('touchmove', content, 80, 10, 1), false, '缩放退回单指不误接管旧轨迹')
viewport.scale = 2
assert.equal(drag(outside, 0, 20), false, '放大后的视口保留原生单指平移')
viewport.scale = 1
touch('touchstart'); touch('touchcancel')
assert.equal(touch('touchmove', outside, 80, 10), false, '取消手势后不复用坐标')
active = false
assert.equal(drag(content, 0, 20), false, '弹窗关闭后恢复正文原生触摸')
dispose()
assert.equal(listeners.size, 0, '卸载不遗留全局非passive监听')

// 运行真实索引 wake：触屏保持导航可发现，桌面仍按原设计在静置后收起。
const source = parse(read('src/components/SubpageIndex.vue')).descriptor.scriptSetup.content
const ast = ts.createSourceFile('SubpageIndex.ts', source, ts.ScriptTarget.Latest, true)
const wake = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'wake').getText(ast)
const visible = { value: false }, open = { value: false }, touchQuery = { matches: true }
let callback, scheduled = 0
const context = {
  document: { hidden: false }, visible, open, touchQuery, idleTimer: 0, hold: false,
  trigger: { value: { matches: () => false } },
  window: { clearTimeout() { callback = undefined }, setTimeout(fn) { scheduled++; callback = fn; return scheduled } },
}
vm.createContext(context)
vm.runInContext(compile(wake), context)
context.wake()
assert.equal(visible.value, true); assert.equal(scheduled, 0)
touchQuery.matches = false
context.wake(); callback()
assert.equal(visible.value, false); assert.equal(scheduled, 1)
touchQuery.matches = true
context.wake()
assert.equal(visible.value, true); assert.equal(callback, undefined)
console.log(JSON.stringify({ status: 'PASS', checks: 19, scope: '触屏索引、弹层滚动链、缩略条、缩放、取消与卸载' }, null, 2))
