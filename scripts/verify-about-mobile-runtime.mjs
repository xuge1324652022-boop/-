/** Execute the actual About component functions; no browser or device emulation. */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import { parse } from '@vue/compiler-sfc'

function source(path, name) {
  const script = parse(fs.readFileSync(path, 'utf8')).descriptor.scriptSetup.content
  const file = ts.createSourceFile('component.ts', script, ts.ScriptTarget.Latest, true)
  return file.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === name).getText(file)
}
function compile(code) {
  return ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
}

// A fixed 70px starting offset cropped the mail button at narrow viewport widths.
const position = { offsetLeft: 141, offsetWidth: 128, offsetParent: { clientWidth: 280 } }
const travel = { contactPosition: { value: position } }
vm.createContext(travel)
vm.runInContext(compile(`${source('src/components/about/ContactEnd.vue', 'contactTravel')}; this.travel = contactTravel`), travel)
for (const [width, left, size] of [[280, 141, 128], [335, 167, 128], [1312, 997, 184], [200, 10, 180]]) {
  position.offsetParent.clientWidth = width
  position.offsetLeft = left
  position.offsetWidth = size
  assert.ok(left + travel.travel(-1) >= 0)
  assert.ok(left + size + travel.travel(1) <= width)
  assert.ok(Math.abs(travel.travel(1)) <= 70)
  assert.ok(Math.abs(travel.travel(-1)) <= 70)
}
travel.contactPosition.value = null
assert.equal(travel.travel(1), 0)
console.log('PASS: contact orb remains inside its rail at narrow and desktop widths')

const initialize = source('src/components/about/ProfileIntro.vue', 'initializeProfile')
for (const condition of ['compactPortrait', 'shortLandscape', 'reduced', 'motion']) {
  let cleanup, config, timelines = 0
  const el = { clientWidth: 390, clientHeight: 600, querySelectorAll: () => [],
    getBoundingClientRect: () => ({ width: 350, height: 262.5, left: 20, top: 0, bottom: 600 }) }
  const chain = { fromTo() { return chain }, to() { return chain }, play() {} }
  const state = {
    dead: false, cancelPreparation: undefined, cancelRefresh: undefined, media: undefined, played: false,
    props: { active: true }, root: { value: el }, sequence: { value: el }, stage: { value: el }, target: { value: el },
    canvas: { value: el }, portrait: { value: el }, identityContent: { value: el }, interactive: { value: false },
    identityReady: { value: false }, updateState() {}, window: { innerHeight: 600 },
    document: { fonts: { ready: Promise.resolve() } }, requestMotionLayoutRefresh: () => () => {},
    requestAnimationFrame: () => 1, cancelAnimationFrame() {},
    ResizeObserver: class { observe() {} disconnect() {} },
    gsap: {
      matchMedia: () => ({ add(queries, run) {
        assert.ok(queries.compactPortrait.includes('min-aspect-ratio: 3/5'))
        cleanup = run({ conditions: { [condition]: true } })
      } }),
      set() {}, timeline() { timelines++; return chain },
    },
    ScrollTrigger: { create(options) { config = options; return { progress: .7, refresh() {} } } },
  }
  vm.createContext(state)
  vm.runInContext(compile(`${initialize}; initializeProfile()`), state)
  assert.equal(state.interactive.value, true, condition)
  assert.equal(state.identityReady.value, true, condition)
  assert.equal(timelines, condition === 'motion' ? 2 : 0)
  if (condition === 'motion') assert.equal(config.scrub, true)
  state.props.active = false
  state.updateState()
  assert.equal(state.interactive.value, false)
  assert.equal(state.identityReady.value, false)
  cleanup()
  await Promise.resolve()
}
console.log('PASS: compact portrait uses readable flow; normal portrait retains the scroll animation and active gate')
