import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'

// 不启动浏览器、不生成 dist；直接验证滚动编排的观看顺序与离场边界。
const source = await readFile(new URL('../src/components/about/internshipStackMotion.ts', import.meta.url), 'utf8')
// 只转译纯数学模块：此用例不依赖 DOM，也不能替代实际图片清晰度/滚动帧率验收。
const { outputText } = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } })
const { stackState, stackTravel, stackPagePosition, stackLastPagePosition,
  STACK_ENTER_END, STACK_FOLD_START, STACK_FOLD_END, STACK_GALLERY_START, STACK_PAGE_STEP,
  STACK_WIPE_LENGTH } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`)

// 检查可观察的编排边界，不能只把动画总长拉大而打乱作品顺序或阅读位置。
const start = stackState(0, 3)
assert.equal(start.entry, 0)
assert.equal(start.fold, 0)
assert.equal(start.active, 0)
assert.deepEqual(start.reveals, [1, 0, 0], '第一张先出现，其他稿件不能在覆盖开始前泄露')
assert.equal(stackState(STACK_FOLD_END, 3).fold, 1)
assert.equal(stackState(STACK_FOLD_END, 3).entry, 1)
assert.deepEqual(stackState(STACK_GALLERY_START - .01, 3).reveals, [1, 0, 0], '收拢后仍给首张独立阅读位置')
const halfway = stackState(STACK_GALLERY_START + STACK_WIPE_LENGTH / 2, 5)
assert.ok(Math.abs(halfway.reveals[1] - .5) < 1e-9, '第二张擦入中点应覆盖前一张的一半')
assert.deepEqual(halfway.reveals.slice(2), [0, 0, 0], '后一稿不能抢到当前稿之前')

for (const count of [1, 3, 5]) {
  const end = stackTravel(count)
  const lastHold = end - stackLastPagePosition(count)
  assert.ok(lastHold >= .5 && lastHold <= .7, '末张保留有效阅读，但不能通过加长末尾空等满足旧中点要求')
  const seen = new Set()
  let overlapObserved = false
  let previous = stackState(0, count)
  for (let p = 0; p <= end; p += .01) {
    const state = stackState(p, count)
    seen.add(state.active)
    assert.ok(state.active >= previous.active && state.active - previous.active <= 1)
    assert.ok(state.entry >= previous.entry && state.fold >= previous.fold)
    overlapObserved ||= state.entry > 0 && state.entry < 1 && state.fold > 0 && state.fold < 1
    state.reveals.forEach((reveal, i) => {
      assert.ok(reveal >= 0 && reveal <= 1 && reveal >= previous.reveals[i])
    })
    previous = state
  }
  assert.equal(seen.size, count, '每张都要经过观看阶段')
  assert.ok(overlapObserved, '入场尚在进行时应接上收拢，不能在两个独立缓动接缝处停住')
  assert.ok(stackState(end, count).reveals.every(p => p === 1))
  assert.equal(stackState(end, count).active, count - 1)
  // 正向、反向选择项目名，都必须落到目标稿完整静止区的正中。
  for (const order of [Array.from({ length: count }, (_, i) => i), Array.from({ length: count }, (_, i) => count - 1 - i)]) {
    for (const i of order) {
      const position = stackPagePosition(i, count)
      const state = stackState(position, count)
      assert.equal(state.active, i, '两个方向的项目名选择都必须定位到同一条滚动行程')
      assert.equal(state.reveals[i], 1, '项目名定位应完整展示目标稿，不能停在半张遮罩上')
      assert.ok(state.reveals.slice(i + 1).every(value => value === 0), '后续稿件不能覆盖目标稿')
      assert.equal(state.entry, 1)
      assert.equal(state.fold, 1)
      const stillStart = i === 0 ? STACK_FOLD_END
        : STACK_GALLERY_START + (i - 1) * STACK_PAGE_STEP + STACK_WIPE_LENGTH
      const stillEnd = i === count - 1 ? end : STACK_GALLERY_START + i * STACK_PAGE_STEP
      assert.ok(Math.abs(position - (stillStart + stillEnd) / 2) < 1e-9, '按钮必须落在目标页完整静止区的正中')
      for (const offset of [-.12, .12]) {
        const around = stackState(position + offset, count)
        assert.deepEqual(around.reveals, state.reveals, '按钮应落在稳定停留区，不能紧贴上下张切换边界')
        assert.equal(around.fold, 1, '静止阅读时收拢已经完成')
      }
    }
  }
  for (let p = end; p >= 0; p -= .01) {
    const state = stackState(p, count)
    assert.ok(state.active <= previous.active, '反向滚动按原页序回退')
    previous = state
  }
}

// 验收实际运动距离，而非靠扩大末张空等、让几何中点看似提前结束。
const previousPace = 1.3
for (const [length, previousLength] of [
  [STACK_ENTER_END, .42 * previousPace],
  [STACK_FOLD_END - STACK_FOLD_START, (.65 - .18) * previousPace],
  [STACK_WIPE_LENGTH, .35 * previousPace],
]) {
  const ratio = length / previousLength
  assert.ok(ratio >= 1.4 && ratio <= 1.5, '入场、收拢和实际擦入行程都应比上一版延长40–50%')
}
assert.ok(STACK_GALLERY_START - STACK_FOLD_END >= .3, '首张完整落位后应有独立的有效阅读距离')
assert.ok(STACK_PAGE_STEP - STACK_WIPE_LENGTH >= .25, '中间稿件必须有完整静止阅读区')
assert.ok(1 + stackTravel(3) < 5, '三稿整体行程应控制在五屏以内')
console.log('PASS: 1/3/5稿顺序与倒放、逐页完整阅读、项目名双向定位静止区；实际运动行程延长约46%，末张停留0.56屏')
