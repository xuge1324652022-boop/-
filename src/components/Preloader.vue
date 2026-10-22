<template>
  <div ref="rootRef">
    <!-- 上半层：撕裂时会向上移出画面 -->
    <div class="preloader" ref="preloaderRef">
      <div class="visual-story">VISUALSTORY</div>
      <div class="motion-design">MOTIONDESIGN</div>
      <div class="intro-title"><h1>WELCOME TO MY</h1></div>
      <div class="outro-title"><h1>PORTFOLIO</h1></div>
      <!-- 百分比加载 -->
      <div class="loader-percent" ref="percentRef">
        <span class="percent-num" ref="percentNumRef">0</span>
        <span class="percent-sign">%</span>
      </div>
    </div>
    <!-- 下半层：内容与上半层完全相同的副本，撕裂时向下移出。
         两者叠在一起时看起来是一整块黄色，只有裁切后才分得开。 -->
    <div class="split-overlay" ref="splitRef">
      <div class="visual-story">VISUALSTORY</div>
      <div class="motion-design">MOTIONDESIGN</div>
      <div class="intro-title"><h1>WELCOME TO MY</h1></div>
      <div class="outro-title"><h1>PORTFOLIO</h1></div>
      <div class="loader-percent">
        <span class="percent-num">100</span>
        <span class="percent-sign">%</span>
      </div>
    </div>
  </div>
</template>

<script setup>
/**
 * 仅首页使用的黄色开场：两层相同版面先重叠，再裁成上下两半撕开。
 * 完成时同步通知 GalleryView/ThreeHome；main.js 也监听同名窗口事件交接静态首屏。
 * 百分比是开场视觉节奏，不代表网络资源实际下载进度；减少动态模式直接放行。
 */
import { onBeforeUnmount, onMounted, ref, nextTick } from 'vue'
import gsap from 'gsap'

const emit = defineEmits(['complete'])
const rootRef = ref(null)
const preloaderRef = ref(null)
const splitRef = ref(null)
const percentRef = ref(null)
const percentNumRef = ref(null)
let timeline = null
let context = null
let disposed = false
let completed = false
let savedOverflow = null

/** 仅撤销本实例写入的滚动锁，保留可能接管页面的菜单或路由遮罩。 */
function releaseScroll() {
  if (!savedOverflow) return
  const { html, body } = savedOverflow
  if (document.documentElement.style.overflow === 'hidden') document.documentElement.style.overflow = html
  if (document.body.style.overflow === 'hidden') document.body.style.overflow = body
  savedOverflow = null
}

function finish() {
  if (disposed || completed) return
  completed = true
  releaseScroll()
  emit('complete')
  window.dispatchEvent(new CustomEvent('preloader-complete'))
}

onMounted(async () => {
  await nextTick()
  if (disposed) return

  // 兜底：ref 没拿到就立刻放行，绝不能把用户永久卡在加载页
  if (!preloaderRef.value || !splitRef.value) {
    console.error('Preloader: refs not found, emitting complete')
    finish()
    return
  }

  /*
   * 减少动态效果：整套开场**完全不播**。
   *
   * 下面那段是约 5 秒的 GSAP 时间线 —— 逐字下落、PORTFOLIO 放大到 4 倍、
   * 整块黄幕被撕成上下两半移出。这些恰恰就是 `prefers-reduced-motion`
   * 要消除的那类运动（大幅位移 + 缩放），对明确表达过「别给我加动效」的
   * 用户强制播放 5 秒是不合适的。
   *
   * ⚠️ 这里**必须**也派发 'preloader-complete'：main.js 靠它摘除
   *    index.html 里那层静态黄幕（#boot-splash）。只 emit('complete') 的话
   *    黄幕会一直盖到 8s 硬兜底才撤 —— 那 8 秒里用户看到的是一片纯黄。
   */
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    finish()
    return
  }

  // 1. 锁滚动
  savedOverflow = { html: document.documentElement.style.overflow, body: document.body.style.overflow }
  document.documentElement.style.overflow = 'hidden'
  document.body.style.overflow = 'hidden'

  // 限定动态字符与补间到本层，离开首页或热更新时整体释放；迟到的完成事件
  // 不能启动下一次首页的画廊。DOM 由 Vue 卸载，不直接 remove 模板节点。
  const select = (selector) => rootRef.value.querySelectorAll(selector)
  context = gsap.context(() => {

  const isMobile = window.innerWidth <= 1000

  // 2. 把 "WELCOME TO MY" 拆成逐字符的 span，才能做逐字下落。
  //
  // ⚠️ 必须写 inline style，不能依赖 <style scoped> 里的 .char / .char span：
  //   Vue scoped CSS 会给模板元素加 [data-v-xxx]，但这里是用
  //   document.createElement 在 onMounted 里动态创建的，Vue 不会给它打
  //   作用域属性，于是带作用域的 .char[data-v-xxx] / .char span[data-v-xxx]
  //   选择器全部匹配不上（_probe-clip.cjs 实测 overflow: visible，
  //   display: inline）。结果是字符从来没被 overflow:hidden 裁过，
  //   也从来没被 CSS 的 translateY(-100%) 藏过 —— 之前的「动画看起来正常」
  //   是假象，字符露在中央被 PORTFOLIO 放大框住时就叠在了一起。
  //   把 display / overflow 直接写进 style，绕过作用域问题。
  select('.intro-title h1').forEach((el) => {
    const text = el.textContent
    el.innerHTML = ''
    ;[...text].forEach((char) => {
      const span = document.createElement('span')
      span.className = 'char'
      span.style.display = 'inline-block'
      span.style.overflow = 'hidden'
      // 空格换成不换行空格，否则会被 HTML 折叠掉。
      // inner span 也写 inline display：它要靠 gsap 改 transform 做位移。
      span.innerHTML = `<span style="display:inline-block">${char === ' ' ? '\u00A0' : char}</span>`
      el.appendChild(span)
    })
  })

  // 3. 初始状态：字符先藏在容器上方（配合 .char 的 overflow: hidden）
  // 注：src 里没有任何元素带 data-delay，过去这里有一行
  // `gsap.set('[data-delay]', ...)` 实际是 no-op，已删除。
  //
  // ⚠️ 必须用**像素** y，不能用 yPercent / y: '-100%'：
  //   .char span 是 `display: inline-block` 且没有显式 height（auto），
  //   Chromium 对这种元素做 transform 百分比解析时，`translate(0%, -100%)`
  //   里的 % 解析为 0（auto 高度 → percent → 0），于是字符从一开始就露在
  //   .char 框里，再也藏不住；后续 Phase 2「上升消失」回到 -100% 同样落到
  //   0，于是这批字一动不动地停在中间，PORTFOLIO 一放大就叠在上面
  //   （_probe-preloader.cjs 实测 C0 的 computed transform 全程为
  //    matrix(1,0,0,1,0,0)，没有任何垂直位移）。
  //   改用像素：先读出 span 的 offsetHeight 作为隐藏量，再用像素 y，
  //   像素永远按字面解析，不依赖元素的 height 是否 definite。
  const charSpans = select('.intro-title h1 .char span')
  // offsetHeight 自动强制一次布局，这里能拿到真实的像素行高（约 80px）。
  // 兜底 80 是 font-size 4.5rem 在 line-height 默认 1.2 下的大致值。
  const charH = charSpans[0]?.offsetHeight || 80
  gsap.set('.char span', { y: -charH })
  gsap.set('.outro-title h1', {
    opacity: 0,
    yPercent: 100,
    fontSize: isMobile ? '2.5rem' : 'clamp(2rem, 8vw, 3rem)',
  })
  gsap.set('.loader-percent', { opacity: 1 })

  // 4. 主时间线
  const tl = timeline = gsap.timeline({ defaults: { ease: 'power3.inOut' } })
  const splitNum = splitRef.value.querySelector('.percent-num')

  // --- Phase 0: 百分比加载 0→100 ---
  const percentObj = { val: 0 }
  tl.to(percentObj, {
    val: 100,
    duration: 1.8,
    ease: 'power2.inOut',
    // 每帧把计数写进两处 DOM（主层 + split-overlay），两层读数才一致
    onUpdate: () => {
      const v = Math.round(percentObj.val)
      if (percentNumRef.value) percentNumRef.value.textContent = v
      // 同步更新 split-overlay 中的百分比，两层看起来才一致
      if (splitNum) splitNum.textContent = v
    },
  })

  // 百分比淡出
  tl.to('.loader-percent', {
    opacity: 0,
    duration: 0.3,
  })

  // --- Phase 1: "WELCOME TO MY" 字符逐一下落 ---
  // 从 -charH 回到 0 = 字符落进 .char 框里。
  tl.to('.char span', {
    y: 0,
    duration: 0.4,
    stagger: 0.02,
  })

  // --- Phase 2: 字符逐个上升消失 ---
  // 回到 -charH，被 .char 的 overflow: hidden 裁掉。
  tl.to(
    '.char span',
    {
      y: -charH,
      duration: 0.35,
      stagger: 0.02,
    },
    '+=0.1',
  )

  // --- Phase 3: "PORTFOLIO" 淡入上滑 ---
  tl.to(
    '.outro-title h1',
    {
      opacity: 1,
      yPercent: 0,
      duration: 0.5,
    },
    '-=0.1',
  )

  // --- Phase 4: "PORTFOLIO" 放大 ---
  tl.to('.outro-title', {
    scale: 4,
    duration: 0.8,
    ease: 'power2.out',
  })

  // --- Phase 5: clipPath 裁切，把一整块黄幕切成上下两半 ---
  tl.add(() => {
    // 上半层保留上半部分
    gsap.set('.preloader', {
      clipPath: 'polygon(0 0, 100% 0, 100% 50%, 0 50%)',
    })
    // 下半层保留下半部分
    gsap.set('.split-overlay', {
      clipPath: 'polygon(0 50%, 100% 50%, 100% 100%, 0 100%)',
    })
  })

  // --- Phase 6: 上下分离，黄色幕布被撕开 ---
  tl.to(
    ['.preloader', '.split-overlay'],
    {
      // 索引 0 是 .preloader 向上，索引 1 是 .split-overlay 向下
      y: (i) => (i === 0 ? '-100%' : '100%'),
      duration: 0.9,
      ease: 'expo.inOut',
      // 撕裂结束后由 Vue 卸载；画廊本身固定全屏，不向 body 注入额外 padding。
      onComplete: () => {
        // ⚠️ 这里的同步 emit 是有意为之，别改成 setTimeout。
        // src 里根本不存在 [data-delay] 元素 —— 之前那 200ms 的延迟
        // 纯粹是死时间，它会在 ThreeHome 挂载前露出一段 #0a0a0a 的黑闪。
        // 同步 emit 让 GalleryView 立即完成开场交接，
        // ThreeHome 于是在滚动条/overflow 恢复**期间**启动，而不是等它结束。
        // GSAP 会在本 timeline 的回调中恢复父 context。同步交接会创建下一段
        // ThreeHome 动画，必须让它脱离本 context，避免卸载本层时一并 revert。
        if (context) context.ignore(finish)
        else finish()
      },
    },
    '+=0.1',
  )
  }, rootRef.value)
})

onBeforeUnmount(() => {
  disposed = true
  timeline?.kill()
  context?.revert()
  releaseScroll()
})
</script>

<style scoped>
/* 两层黄幕：叠在一起时看不出分层，靠 clipPath 裁开后才分离 */
.preloader,
.split-overlay {
  position: fixed;
  width: 100vw;
  height: 100vh;
  height: 100dvh;
  top: 0;
  left: 0;
  background-color: #ffd700;
  z-index: 9999;
  pointer-events: none;
}
.split-overlay {
  z-index: 9998;
}
.intro-title {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
}
.intro-title h1 {
  font-size: 4.5rem;
  letter-spacing: 10px;
  color: #fff;
  white-space: nowrap;
  font-weight: 700;
}
.outro-title {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
  white-space: nowrap;
}
.outro-title h1 {
  font-size: clamp(2rem, 8vw, 3rem);
  color: #fff;
  line-height: 1;
}
/* 左上 / 右下的两个角标 */
.visual-story {
  position: absolute;
  top: 35px;
  left: 45px;
  font-size: 1rem;
  color: #000;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 1.5px;
}
.motion-design {
  position: absolute;
  bottom: 35px;
  right: 45px;
  font-size: 1rem;
  color: #000;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 1.5px;
}
/* 字符容器：display / overflow 必须在 JS 里写 inline style —— .char 和
   .char span 是 onMounted 里 document.createElement 动态创建的，Vue
   scoped CSS 不会给它们打 [data-v-xxx]，写在下面的规则匹配不上。
   初始位移交给 gsap.set 用像素 y 完成（auto 高度下 transform 百分比
   会解析为 0，所以不能用 percent / yPercent / y: '-100%'）。 */

/* ========== 百分比加载 ========== */
.loader-percent {
  position: absolute;
  bottom: 80px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: baseline;
  gap: 2px;
}

.percent-num {
  font-size: 2.5rem;
  font-weight: 700;
  color: #000;
  line-height: 1;
  /* 等宽数字，避免 0→100 跳动时宽度抖动 */
  font-variant-numeric: tabular-nums;
}

.percent-sign {
  font-size: 1rem;
  font-weight: 500;
  color: rgba(0, 0, 0, 0.5);
}

@media (max-width: 750px) {
  .intro-title h1 {
    font-size: clamp(18px, 4.8vw, 36px);
    letter-spacing: 3px;
  }
  .percent-num {
    font-size: 1.8rem;
  }
  .loader-percent {
    bottom: 60px;
  }
}
</style>
