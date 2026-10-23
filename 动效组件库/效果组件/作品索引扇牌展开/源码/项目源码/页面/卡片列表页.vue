<template>
  <div class="list-page">
    <!-- 卡片列表自身不挂加载幕；路由进入与离开统一由 App 的 PageCurtain 接管。 -->

    <!-- 整屏首屏：标题 + 3D 扇开的牌堆 -->
    <section class="hero">
      <header class="hero__head">
        <h1>作品索引</h1>
        <p>从六个方向了解我的创作与实践，选择一张卡片继续浏览。</p>
        <RouterLink class="hero__link" to="/">← 返回作品集</RouterLink>
      </header>

      <div class="stage">
        <div class="stack">
          <!--
            注意：这里刻意没有用 `ref="cardEls"` 收集 DOM。
            Vue 3 里 v-for 上的模板 ref 数组不保证与源数组同序，
            按下标取元素会取错卡；直接用事件自带的 currentTarget 最稳。
          -->
          <div
            v-for="(cfg, i) in cardAnimations"
            :key="cfg.id"
            class="card"
            :class="{ 'card--expanding': expandingId === cfg.id }"
            :data-index="cfg.id"
            :style="{ '--i': String(i) }"
            role="button"
            tabindex="0"
            data-cursor="Explore"
            data-cursor-zh="探索"
            data-cursor-en="Explore"
            data-cursor-action="explore"
            :aria-label="`打开第 ${cfg.id} 张卡片：${cfg.title}`"
            @click="onCardClick(cfg, $event)"
            @keydown.enter.prevent="onCardClick(cfg, $event)"
            @keydown.space.prevent="onCardClick(cfg, $event)"
          >
            <span class="card__num">{{ cfg.id }}</span>
            <span class="card__label">{{ cfg.title }}</span>
            <span class="card__meta" lang="en">{{ cfg.label }}</span>
          </div>
        </div>
      </div>
    </section>

    <!-- 作品方向导览与卡片入口保持相同顺序。 -->
    <div class="list-page__tail">
      <p>关于我 · 剪辑 · 调色 · 新闻影像 · 海报设计 · 摄影</p>
    </div>
  </div>
</template>

<script setup lang="ts">
/** /cards 作品索引：卡片保留独立 CSS 放大，再交给全局幕布完成导航。 */
import { onBeforeUnmount, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { routeCurtainActive } from '../组合函数/页面幕布控制'
import {
  isTransitioning,
  jumpPathFor,
} from '../组合函数/应用转场状态'

/** 单张卡片的独立动画参数 */
interface CardAnimation {
  /**
   * 编号，同时也是 `jumpPathFor` 的分流键。
   * 六张卡均有专属页；不要直接拼 `/card/NN`，路径统一从 CHAPTER_PATHS 读取。
   */
  id: string
  title: string
  label: string
  /** 放大倍数 */
  scale: number
  /** 放大时的旋转角度（度） */
  rotate: number
  /** 放大动画时长（秒） */
  duration: number
  /** 缓动曲线 */
  easing: string
  /** transform-origin */
  origin: string
}

/**
 * ★★ 卡片独立动画配置 —— 每张卡一套参数 ★★
 *
 * 约束 4：所有动画参数只能从这里读取，再经 CSS 变量注入；
 * CSS 里一律用 var(--card-*)，不得出现任何写死的数值。
 */
const cardAnimations: CardAnimation[] = [
  { id: '01', title: '关于我', label: 'About',  scale: 1.4,  rotate: -8,  duration: 0.5,  easing: 'cubic-bezier(0.16, 1, 0.3, 1)',    origin: 'left center' },
  { id: '02', title: '剪辑', label: 'Editing',   scale: 1.2,  rotate: 6,   duration: 0.6,  easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)', origin: 'center' },
  { id: '03', title: '调色', label: 'Colour grading',  scale: 1.6,  rotate: -12, duration: 0.45, easing: 'cubic-bezier(0.22, 1, 0.36, 1)',   origin: 'right center' },
  { id: '04', title: '新闻影像', label: 'News',   scale: 1.35, rotate: 10,  duration: 0.55, easing: 'cubic-bezier(0.16, 1, 0.3, 1)',    origin: 'center left' },
  { id: '05', title: '海报设计', label: 'Poster design', scale: 1.5,  rotate: -5,  duration: 0.5,  easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)', origin: 'center right' },
  { id: '06', title: '摄影', label: 'Photography',  scale: 1.25, rotate: 14,  duration: 0.65, easing: 'cubic-bezier(0.22, 1, 0.36, 1)',   origin: 'center' },
]

const expandingId = ref<string | null>(null)
const router = useRouter()
let expansionTimer = 0

/**
 * 点击卡片：完整的转场时序。
 *
 * 1) 忽略转场中的新点击（约束 7）
 * 2) 读该卡配置 → 注入 CSS 变量 → 加 .card--expanding 触发放大
 * 3) 放大结束 → 遮罩覆盖
 * 4) router.push 触发 App 守卫；守卫等遮罩铺满后才确认导航，再统一揭幕。
 */
function onCardClick(cfg: CardAnimation, event: Event): void {
  // 约束 7：转场进行中，直接吞掉这次点击
  if (isTransitioning.value || routeCurtainActive.value) return

  // currentTarget 就是被点的那张卡，不依赖任何下标
  const el = event.currentTarget as HTMLElement | null
  if (!el) return

  isTransitioning.value = true
  expandingId.value = cfg.id

  // ★★ 卡片动画参数注入位置 ★★
  // 每张卡在这里读取自己的配置，写进 CSS 自定义属性，
  // 供 .card--expanding 的 transform / transition 使用。
  el.style.setProperty('--card-scale', String(cfg.scale))
  el.style.setProperty('--card-rotate', `${cfg.rotate}deg`)
  el.style.setProperty('--card-duration', `${cfg.duration}s`)
  el.style.setProperty('--card-easing', cfg.easing)
  el.style.setProperty('--card-origin', cfg.origin)

  // 约束 5：转场期间锁掉滚动
  document.documentElement.classList.add('no-scroll')

  // 时序 2 → 3：放大动画跑完（时长取该卡自己的配置）后，遮罩开始覆盖
  const duration = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : cfg.duration
  expansionTimer = window.setTimeout(() => {
      if (routeCurtainActive.value) return // 更新的返回 / 历史导航已接管幕布，旧定时器不能再跳页。
      /*
       * ⚠️ 必须走 `jumpPathFor` 分流，**不能**自己拼 `/card/${id}`：
       *    六张卡的专属页与兼容路径在同一处登记，避免两个入口指向不同页面。
       * ⚠️ `from=cards` 让子页的返回按钮指回卡片列表而不是作品集；
       *    全局 App 守卫负责遮罩与失败恢复；子页不再维护自己的页面装载幕。
       */
      void router.push({ path: jumpPathFor(cfg.id), query: { from: 'cards' } }).catch(() => { /* 可见错误提示与重试出口由 App 持有。 */ })
  }, duration * 1000)
}

// 路由在放大结束前被历史导航打断时，不允许已卸载页面的定时器再次触发导航。
onBeforeUnmount(() => window.clearTimeout(expansionTimer))
</script>

<style scoped>
.list-page {
  min-height: 100vh;
  background: #0a0a0a;
  color: #fff;
}

.hero {
  position: relative;
  height: 100vh;
  display: flex;
  flex-direction: column;
}

.hero__head {
  padding: 9vh 6vw 0;
}
.hero__head h1 {
  font-size: clamp(26px, 5vw, 56px);
  letter-spacing: 0.08em;
  margin: 0 0 10px;
}
.hero__head p {
  margin: 0;
  color: rgba(255, 255, 255, 0.55);
  font-size: 14px;
}
.hero__link {
  display: inline-block;
  margin-top: 16px;
  color: #ffd700;
  font-size: 13px;
  text-decoration: none;
  /* 触控 ≥44px：手机端用手指点 13px 字会很难命中。
     用 padding 撑高度而不是改 font-size，免得视觉密度突变。 */
  padding: 12px 4px;
  min-height: 44px;
}
.hero__link:hover {
  text-decoration: underline;
}

/* 牌堆的舞台：吃掉首屏剩下的高度，把牌堆放在正中 */
.stage {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

/*
  3D 舞台。
  尺寸由三个量算出来：单卡高度 + 5 段扇形偏移，
  所以整摞牌的视觉高度刚好等于容器高度，不会被裁掉。
*/
.stack {
  --fan-x: clamp(20px, 4vw, 44px);   /* 每往后一张，横向偏移 */
  --fan-y: clamp(40px, 8vh, 72px);   /* 每往后一张，纵向偏移 */
  --card-h: clamp(190px, 31vh, 260px);

  position: relative;
  width: min(560px, 86vw);
  height: calc(var(--card-h) + 5 * var(--fan-y));
  perspective: 1200px;
  perspective-origin: 50% 30%;
  transform-style: preserve-3d;
  /* 牌堆实际包围盒还包含五次横移，整体居中不能只按第一张卡的宽度算。 */
  transform: translateX(calc(-2.5 * var(--fan-x)));
}

.card {
  /*
    兜底默认值：真正的动画参数一律由 JS 从配置数组注入，
    这里只保证 var() 在注入前不会取到无效值。
  */
  --card-scale: 1;
  --card-rotate: 0deg;
  --card-duration: 0.5s;
  --card-easing: cubic-bezier(0.16, 1, 0.3, 1);
  --card-origin: center;

  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  height: var(--card-h);
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 0 28px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 14px;
  background: linear-gradient(150deg, #1b1b1b 0%, #101010 100%);
  box-shadow: 0 18px 40px rgba(0, 0, 0, 0.45);
  cursor: pointer;

  /* 约束 3：只动 transform，绝不碰 width / height / top / left */
  /*
    注意：z 用 0 而非负值。
    一旦给后面的卡往负 z 推，perspective 会把它们缩小一点，
    露出区域的边界就和下一张卡的边界几乎重合，
    Chromium 在 preserve-3d 下的命中测试在边界附近不稳定，
    会出现「看到卡 03 但点中了卡 04」。
    保留 rotateX(6deg) 的倾斜，扇开位移做深度暗示，避免这个坑。
  */
  transform: translate3d(
      calc(var(--i) * var(--fan-x)),
      calc(var(--i) * var(--fan-y)),
      0
    )
    rotateX(6deg);
  /* 越靠前的卡层级越高，保证「看到哪张点哪张」 */
  z-index: calc(10 - var(--i));

  transform-origin: var(--card-origin);
  transition: transform var(--card-duration) var(--card-easing),
    box-shadow 0.3s ease, border-color 0.3s ease;
  will-change: transform;
}

.card:hover {
  border-color: rgba(255, 255, 255, 0.45);
  box-shadow: 0 26px 60px rgba(0, 0, 0, 0.6);
}

/* 展开态：参数全部来自 CSS 变量（由配置数组注入） */
.card--expanding {
  /* z 抬到 +60px，确保在任何一张卡前面 */
  transform: translate3d(0, 0, 60px) rotate(var(--card-rotate)) scale(var(--card-scale));
  transition-duration: var(--card-duration);
  transition-timing-function: var(--card-easing);
  z-index: 60;
  border-color: rgba(255, 255, 255, 0.7);
}

.card__num {
  font-size: clamp(38px, 7vw, 68px);
  font-weight: 700;
  line-height: 1;
  letter-spacing: 0.04em;
}
.card__label {
  margin-top: 10px;
  font-size: 13px;
  letter-spacing: 0.24em;
  color: rgba(255, 255, 255, 0.7);
}
.card__meta {
  margin-top: 4px;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.35);
}

/* 撑出滚动行程 */
.list-page__tail {
  height: 50vh;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.35);
  font-size: 13px;
}

/* 扇牌至少需要约880px高的桌面首屏；不足时让六个入口按文档流完整呈现。 */
@media (max-width: 1024px), (max-height: 880px) {
  .hero { height:auto; min-height:100vh; min-height:100svh; }
  .hero__head { padding:90px 20px 0; }
  .stage { flex:none; overflow:visible; padding:30px 20px 52px; }
  .stack { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; width:100%; height:auto; perspective:none; transform:none; }
  .card { position:relative; left:auto; top:auto; width:100%; height:170px; padding:20px; transform:none; }
  .card--expanding { transform:rotate(var(--card-rotate)) scale(var(--card-scale)); }
  .card__label { font-size:11px; letter-spacing:.14em; }
  .card__meta { font-size:10px; }
  .list-page__tail { height:auto; min-height:120px; padding:24px 20px; text-align:center; }
}
@media (prefers-reduced-motion: reduce) {
  .card { transition:none; }
  .card--expanding { transform:none; }
}
</style>
