/** 定向执行真实组件源码：擦入可见层、倒滚隐藏恢复，以及旧内核原图回退生命周期。 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import { parse } from '@vue/compiler-sfc'

const component = path => parse(fs.readFileSync(path, 'utf8')).descriptor
const compile = source => ts.transpileModule(source, { compilerOptions: {
  target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS,
} }).outputText

// 执行实际render，而非复制其算法；验证切换两端与倒滚时可见层的真实样式输出。
const photo = component('src/components/about/PhotoSets.vue')
const file = ts.createSourceFile('actual.ts', photo.scriptSetup.content, ts.ScriptTarget.Latest, true)
const render = file.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'render').getText(file)
const scene = {
  raf: 0, dead: false, staticMode: { value: false },
  schedule: [
    { enter: 0, start: 30, end: 130, finish: 160, wipe: 0 },
    { enter: 160, start: 270, end: 370, finish: 400, wipe: 80 },
    { enter: 400, start: 510, end: 610, finish: 640, wipe: 80 },
  ],
  steps: { value: [2, 2, 2] }, stride: 100, origin: 0, window: { scrollY: 0 },
  lastCurtain: [], lastPosition: [], lastVisible: [], photoIndices: { value: [0, 0, 0] }, active: { value: 0 },
  chapters: Array.from({ length: 3 }, () => ({ style: {} })),
  bars: Array.from({ length: 3 }, () => ({ style: {} })),
  slots: Array.from({ length: 3 }, () => [[{ style: {} }, { style: {} }], [{ style: {} }, { style: {} }]]),
  unit: value => Math.max(0, Math.min(1, value)),
}
vm.createContext(scene)
vm.runInContext(compile(render), scene)
const observe = y => {
  scene.window.scrollY = y
  scene.render()
  return scene.chapters.map(chapter => chapter.style.visibility)
}
assert.deepEqual(observe(0), ['visible', 'hidden', 'hidden'])
assert.deepEqual(observe(180), ['visible', 'visible', 'hidden'], 'quarter wipe retains both clipped hit surfaces')
assert.deepEqual(observe(220), ['visible', 'visible', 'hidden'], 'old visible pixels survive the active midpoint')
assert.equal(scene.active.value, 1)
assert.deepEqual(observe(240), ['hidden', 'visible', 'hidden'], 'fully covered chapter leaves rendering and accessibility')
assert.ok(scene.slots[0].flat().every(slot => slot.style.visibility === 'hidden'), 'child visibility cannot expose a hidden chapter')
assert.deepEqual(observe(480), ['hidden', 'hidden', 'visible'])
assert.deepEqual(observe(220), ['visible', 'visible', 'hidden'], 'reverse scrolling restores both surfaces')
assert.ok(scene.slots[0].flat().some(slot => slot.style.visibility === 'visible'), 'reverse scrolling restores old remaining photo pixels')
assert.deepEqual(observe(0), ['visible', 'hidden', 'hidden'])

// 不模拟浏览器命中测试：模板只负责当前键盘入口，浏览器由clip-path命中可见像素。
assert.doesNotMatch(photo.template.content, /class="ps__(?:chapter|slot)"[^>]*:inert=/)
assert.match(photo.template.content, /:tabindex="staticMode \|\| \(group === active/)

// 执行实际setup的能力与生命周期分支；无CSS API也必须保留原图，且不安装空间时间线。
const depth = component('src/components/about/InternshipDepthComposition.vue')
const depthSetup = compile(`${depth.scriptSetup.content}\nexports.supportsContainerUnits = supportsContainerUnits;`)
for (const capability of [undefined, false, true]) {
  let mount, unmount, build, branch, refs = 0, registered = 0, reverted = 0, queried = 0
  const host = { querySelectorAll() { queried++; throw Error('static branch must not inspect animation nodes') } }
  const setup = {
    exports: {}, defineProps: () => ({ items: [{ width: 1, height: 1 }], lang: 'zh' }), defineEmits: () => () => {},
    window: {}, CSS: capability === undefined ? undefined : { supports(property, value) {
      assert.equal(property, 'font-size'); assert.equal(value, '1cqw'); return capability
    } },
    require(name) {
      if (name === 'vue') return {
        computed: fn => ({ get value() { return fn() } }), inject: (_key, fallback) => fallback,
        nextTick: () => Promise.resolve(), onBeforeUnmount: fn => { unmount = fn }, onMounted: fn => { mount = fn },
        reactive: value => value, ref: value => ({ value: value === null ? [host, host, host][refs++] : value }), watch() {},
      }
      if (name === 'gsap') return { __esModule: true, default: {
        registerPlugin() {}, matchMedia: () => ({
          add(_query, fn) { registered++; branch = fn }, revert() { reverted++ },
        }),
      } }
      if (name === 'gsap/ScrollTrigger') return { ScrollTrigger: {} }
      if (name.endsWith('/motionLayout')) return {
        prepareMotionLayout(_root, fn) { build = fn; return () => {} }, requestMotionLayoutRefresh: () => () => {},
      }
      return {}
    },
  }
  vm.runInNewContext(depthSetup, setup)
  assert.equal(setup.exports.supportsContainerUnits, capability === true)
  await mount(); build()
  assert.equal(registered, 1)
  branch({ conditions: { motion: capability !== true } })
  assert.equal(queried, 0, 'legacy capability and modern static branches skip space animation')
  unmount()
  assert.equal(reverted, 1)
}
assert.match(depth.template.content, /v-if="!i && supportsContainerUnits"/)
assert.match(depth.template.content, /class="idc__main-image" :src="item.src"/)
assert.match(depth.template.content, /:revealed="!supportsContainerUnits \|\| introduced.has\(item.id\)"/)
console.log('PASS: actual photo wipe visibility/reverse restoration and legacy cqw original-image fallback/lifecycle; browser touch hit testing remains a separate check')
