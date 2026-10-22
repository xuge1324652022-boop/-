<template>
  <!--
    旧百分比加载屏，保留作兼容组件；当前路由统一使用 PageCurtain，不再引用它。
    视觉参考 brand.squarespace.com 的 Foundations 站点：
    顶角两个小标签（左：品牌 / 右：功能），底左是 0→100 的大字号计数器，
    计数器下方一排进度颗粒随计数逐格点亮，底右压一个很淡的「装载」大字做背景肌理。

    以下是独立使用时的默认时序（约 1.8s）：
      0ms        入场（淡入由 CSS transition 负责）
      80ms       开始计数（留一拍，避免 0 闪现在颗粒之前）
      80→1180ms  计数 0→100，同时 16 颗格子依次点亮
      1180ms     停在 100%，停顿 220ms
      1400ms     开始 400ms 淡出
      1800ms     组件从 DOM 移除，卡片露出并可点击

    ⚠️ 「计数到 100%」不等于「可以揭幕」（2026-10-10 修）。
       上面那条时序是**默认**行为（`canReveal` 默认 true），
       适合幕布底下不需要等待异步工作的独立场景。

       若由调用方在幕布下面发起 `router.push`，目标页可能仍在懒加载。
       幕布按写死的 1.4s 撤掉时，只要目标 chunk 更慢，就会出现
       「幕布没了、页面还是旧的」的空窗 —— 实测（C:/tmp/_timeline-jump.cjs，
       chunk 延迟 3s）：**1936ms 幕布已撤，路由到 7574ms 才落地**，
       中间 5.6 秒屏幕上就是那张铺满全屏的 03 卡（近黑底），地址还停在 `/`。
       那就是用户报的「装载后黑屏」。

       所以跳转幕传 `can-reveal="false"`：计数到 100% 只报 `ready`，
       幕布**留在原地**，直到父级确认路由真的落地再把 `canReveal` 翻成 true。
  -->
  <transition name="loader-fade" @after-leave="emit('done')">
    <div
      v-if="visible"
      class="page-loader"
      role="status"
      aria-live="polite"
      aria-label="页面加载中"
    >
      <header class="page-loader__head">
        <span class="page-loader__corner page-loader__corner--tl">{{ cornerLeft }}</span>
        <span class="page-loader__corner page-loader__corner--tr">{{ cornerRight }}</span>
      </header>

      <footer class="page-loader__foot">
        <div class="page-loader__stack">
          <div class="page-loader__counter">
            <span class="page-loader__pct">{{ displayPct }}</span><span class="page-loader__sign">%</span>
          </div>
          <div class="page-loader__bar" aria-hidden="true">
            <span
              v-for="i in cellCount"
              :key="i"
              class="page-loader__cell"
              :style="{ '--cell-delay': ((i - 1) * cellStep) + 'ms' }"
            />
          </div>
        </div>
        <div class="page-loader__label">{{ bigWord }}</div>
      </footer>
    </div>
  </transition>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

interface Props {
  /** 左上角小标签 */
  cornerLeft?: string
  /** 右上角小标签 */
  cornerRight?: string
  /** 右下角灰色大字 */
  bigWord?: string
  /** 计数 0→100 的时长（ms） */
  tickMs?: number
  /** 到 100% 后停留多久再淡出（ms） */
  holdMs?: number
  /**
   * 计数到 100% 之后是否**立刻**揭幕。
   *
   * 默认 true，计数和停顿结束后自动揭幕。
   * 需要等待异步工作时可传 false，收到 ready 后由调用方确认就绪再放行；
   * 当前 App.vue 已改用 PageCurtain，本兼容组件不持有路由等待逻辑。
   */
  canReveal?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  cornerLeft: 'CARD DEMO',
  cornerRight: 'LOADING',
  bigWord: '装载',
  tickMs: 1100,
  holdMs: 220,
  canReveal: true,
})

/**
 * ready —— 计数刚到 100%，幕布还完全不透明。父级可以在这时切换路由，
 *          切换发生在幕布底下，用户看不见。
 * done  —— 淡出结束、组件即将从 DOM 移除。
 */
const emit = defineEmits<{ (e: 'ready'): void; (e: 'done'): void }>()

const visible = ref(true)
const displayPct = ref(0)
const cellCount = 16
// 让最后一格亮起的时刻正好对齐计数器到 100%
const cellStep = Math.round(props.tickMs / (cellCount - 1))

/**
 * 计数是否已经到过 100%。
 *
 * ⚠️ 用普通变量而不是 ref：它只在 `watch` 回调和计数循环里读，不参与渲染。
 *    作用是把「`canReveal` 变成 true」和「计数已经结束」这两件事对上 ——
 *    父级可能在计数还没跑完时就把它翻成 true（比如它自己先失败了），
 *    那种情况下**不能**揭幕，否则会露出一个 3% 的幕布闪一下。
 */
let readySent = false

/*
 * ⚠️ 这道 watch 就是「等路由」本身：幕布从「计数结束」这个**时间点**解耦，
 *    改由父级用 `canReveal` 说「可以了」。
 *    没有它，幕布永远按 tickMs + holdMs 撤，与 router.push 何时落地无关。
 */
watch(
  () => props.canReveal,
  (allowed) => {
    if (allowed && readySent) visible.value = false
  },
)

let raf = 0
let holdTimer: number | null = null
let startTimer: number | null = null

/** 计数主循环：用 rAF 逐帧推进百分比，到 100 后停顿再触发淡出 */
function run(): void {
  const t0 = performance.now()
  const tick = (now: number): void => {
    const t = Math.min(1, (now - t0) / props.tickMs)
    displayPct.value = Math.round(t * 100)
    if (t < 1) {
      raf = requestAnimationFrame(tick)
    } else {
      displayPct.value = 100
      holdTimer = window.setTimeout(() => {
        // 先报 ready（父级切路由），再开始淡出 —— 顺序反了会让用户看见旧页面
        readySent = true
        emit('ready')
        /*
         * 默认 true → 老时序：报完 ready 立刻淡出。
         * false → 幕布**留在原地**（100% 定格），等父级把 canReveal 翻成 true。
         *         父级一直不翻（路由失败/超时）时，由它自己在幕布上/下
         *         给出「刷新重试」的出口 —— 这里不做超时兜底，避免两处各判一次。
         */
        if (props.canReveal) visible.value = false
      }, props.holdMs)
    }
  }
  raf = requestAnimationFrame(tick)
}

onMounted(() => {
  startTimer = window.setTimeout(run, 80)
})

onBeforeUnmount(() => {
  if (raf) cancelAnimationFrame(raf)
  if (holdTimer) clearTimeout(holdTimer)
  if (startTimer) clearTimeout(startTimer)
})
</script>

<style scoped>
.page-loader {
  position: fixed;
  /* 兼容组件高于普通内容与画廊 Preloader（9999）；
     当前全站 PageCurtain（10005）仍拥有更高的路由覆盖层级。 */
  inset: 0;
  z-index: 10001;
  background: #0a0a0a;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 5vh 5vw;
  color: #fff;
  font-family: 'Helvetica Neue', Helvetica, Arial, 'PingFang SC', 'Microsoft YaHei', sans-serif;
  user-select: none;
}

/* ---- 顶角两个小标签 ---- */
.page-loader__head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}
.page-loader__corner {
  font-size: 13px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.7);
}

/* ---- 底栏：左 计数器 + 进度条，右 装载大字 ---- */
.page-loader__foot {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 24px;
}

/*
  窄屏（≤400px）下「100%」和「装载」两个 72px+ 的大字并排放不下，
  右边会溢出视口。改成竖排：计数器在上、装载在下、左对齐。
  断点 400：390 / 360 / 320 的窄屏都会改成纵向排布。
*/
@media (max-width: 400px) {
  .page-loader__foot {
    flex-direction: column;
    align-items: flex-start;
    gap: 14px;
  }
}
.page-loader__stack {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.page-loader__counter {
  display: flex;
  align-items: baseline;
  font-size: clamp(72px, 12vw, 160px);
  font-weight: 700;
  line-height: 0.85;
  letter-spacing: -0.04em;
  color: rgba(255, 255, 255, 0.92);
  /* 数字等宽：从 7% 跳到 8% 时字宽不变，不会左右抖 */
  font-variant-numeric: tabular-nums;
  font-feature-settings: 'tnum' on;
  /* 进入动画：从下方 20px 被推出 + 渐显（power3.out）。
     ⚠️ 动画必须挂在**容器**上，不能挂到里面那个数字 span 上 ——
     计数每帧都在变，挂到数字上会导致每次数值更新都重放一次位移，抖得很明显。
     fill-mode 用 backwards：延迟期间保持起始态不闪现，结束后回到自然样式，
     这样后面的 400ms 淡出（.loader-fade-leave-to）才不会被锁死的 opacity 挡住。 */
  animation: pct-rise 0.7s cubic-bezier(0.165, 0.84, 0.44, 1) 0.05s backwards;
}
.page-loader__sign {
  font-size: 0.55em;
  color: rgba(255, 255, 255, 0.5);
  margin-left: 0.06em;
  font-weight: 600;
}

.page-loader__bar {
  display: flex;
  gap: 7px;
  align-items: center;
}
.page-loader__cell {
  width: 9px;
  height: 9px;
  background: rgba(255, 255, 255, 0.16);
  transform: scale(0.6);
  animation: cell-on 280ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
  animation-delay: var(--cell-delay, 0ms);
}
@keyframes cell-on {
  0%   { background: rgba(255, 255, 255, 0.16); transform: scale(0.6); }
  100% { background: rgba(255, 255, 255, 0.85); transform: scale(1); }
}

.page-loader__label {
  font-size: clamp(72px, 12vw, 160px);
  font-weight: 700;
  line-height: 0.85;
  letter-spacing: -0.04em;
  /* 比计数器淡得多：参考站用它当背景肌理，不抢镜 */
  color: rgba(255, 255, 255, 0.18);
  /* 与计数器同一套 Loading 系统：位移略小（18px）、延后 0.07s，
     两者像一起浮上来，而不是各弹各的。不 elasticity / bounce。 */
  animation: label-rise 0.62s cubic-bezier(0.165, 0.84, 0.44, 1) 0.12s backwards;
}

/* 百分比与「装载」的进入：只做上推 + 渐显，power3.out 的长尾收住 */
@keyframes pct-rise {
  from { opacity: 0; transform: translateY(20px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes label-rise {
  from { opacity: 0; transform: translateY(18px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* ---- 离开：400ms 淡出，与卡片转场的揭幕节奏对齐 ---- */
.loader-fade-leave-active {
  transition: opacity 400ms ease;
}
.loader-fade-leave-to {
  opacity: 0;
}

/* ---- reduced-motion：跳过进度动画，颗粒直接到亮态 ---- */
@media (prefers-reduced-motion: reduce) {
  .page-loader__cell {
    animation: none;
    background: rgba(255, 255, 255, 0.85);
    transform: scale(1);
  }
  /* 上浮渐显也一并跳过：backwards 取消后元素回到自然样式（opacity 1），不会消失 */
  .page-loader__counter,
  .page-loader__label {
    animation: none;
  }
  .loader-fade-leave-active {
    transition: none;
  }
}
</style>
