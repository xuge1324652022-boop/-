import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizeWheelDelta } from '../src/utils/wheel.ts'

// 使用真正的无状态函数；无需 DOM、Vue、开发服务器或本机浏览器。
const wheel = (deltaY, deltaMode = 0) => ({ deltaY, deltaMode })

test('滚轮按像素保留触控板小数和滚动方向', () => {
  assert.equal(normalizeWheelDelta(wheel(2.25), 800), 2.25)
  assert.equal(normalizeWheelDelta(wheel(-2.25), 800), -2.25)
  assert.equal(normalizeWheelDelta(wheel(0), 800), 0)
})

test('Firefox 行单位与页单位折算为像素', () => {
  assert.equal(normalizeWheelDelta(wheel(3, 1), 800), 48)
  assert.equal(normalizeWheelDelta(wheel(-3, 1), 800), -48)
  assert.equal(normalizeWheelDelta(wheel(0.5, 2), 900), 450)
  assert.equal(normalizeWheelDelta(wheel(-1, 2), 900), -900)
})

test('驱动异常大位移被限制为单次 1000px，并保留边界和符号', () => {
  assert.equal(normalizeWheelDelta(wheel(100000), 800), 1000)
  assert.equal(normalizeWheelDelta(wheel(-100000), 800), -1000)
  assert.equal(normalizeWheelDelta(wheel(1000), 800), 1000)
  assert.equal(normalizeWheelDelta(wheel(-1000), 800), -1000)
  assert.equal(normalizeWheelDelta(wheel(2, 2), 800), 1000)
})
