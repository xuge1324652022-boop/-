/**
 * 关于我、海报和摄影等页面共用的 data 属性滚动揭示控制器。
 * ReferenceIntroduction 的双语真实分行、人物照片与海报空间构图由各自组件管理，
 * 本模块只接管带有明确标记的通用元素、数字及保留的聊天分支。
 *
 * 为什么集中在一个文件：多处内容都要「进视口时揭示」，如果各组件
 * 各挂一份 ScrollTrigger，必然出现三种后果 —— 有的屏忘了挂、`start` 位置各写
 * 一套、销毁时漏掉几个。所以约定：
 *   · 组件只在 DOM 上打标记（`data-reveal` / `data-reveal-stagger` / `[data-count]`），
 *   · 动画只在这里创建，由调用页面一次性建立、按支销毁。
 *
 * 标记语义：
 *   `data-reveal`          单个元素淡入上移
 *   `data-reveal-stagger`  容器：它**内部**的 `[data-reveal]` 合成一组错峰出现
 *                          （没被任何容器收编的 `data-reveal` 各自单独触发）
 *   `[data-count]`         数字滚动：文本按 `/^(\d+(\.\d+)?)(.*)$/` 拆成
 *                          「数值 + 后缀」，数值从 0 补间到目标，后缀原样保留
 *
 * ⚠️ 隐藏起点一律**在 JS 里写**（`fromTo` 的 from），CSS 保持「可读的终态」：
 *    脚本挂了 / reduced-motion 时页面是一张完整的静态版式，而不是一片空白。
 *    唯一例外是聊天气泡（收拢态是它的**视觉语义**，写在 CSS 里），
 *    由 `.chat--reduced` 在减少动态时摆平。
 *
 * ⚠️ **两支 context，不是一个**（2026-10-10 修）。
 *
 *    曾经这里只有一个 `gsap.context`，切语言时整份 `revert()`。后果实测：
 *    作品区的成果数字**全部变成 0 且不再恢复**（用户复现：中文看作品 → 回顶部
 *    → 切 EN → 再看作品 → `630万+` 变成 `0万+`）。
 *
 *    两个原因叠在一起：
 *      ① 数字 tween 的 target 是普通对象 `proxy`，`onUpdate` 里手写
 *         `el.textContent`。GSAP **不记录** textContent，所以 `revert()` 既还原
 *         不了它，还会把 tween 拨回起点 —— 顺手把 `0` 写进 DOM。
 *      ② 切语言后只重建聊天那一支（通用揭示不能重建，否则滚过去的屏会被按隐藏
 *         起点重摆一遍），于是数字 tween 再也没有人来创建它 —— 0 就永久留在那里。
 *
 *    现在拆开：`ctxReveal`（通用揭示 + 数字）**只建一次、切语言绝不碰**；
 *    `ctxChat`（聊天）随语言重建。再补一条兜底：销毁时把数字原文写回去。
 *
 * ⚠️ **编辑对照的固定舞台是第三支、且不在这里**（2026-10-10 第四轮）。
 *    它由 `setupEditorialScroll.ts` 用 `gsap.matchMedia` 自己管建立 / 撤销 ——
 *    它要按媒体条件反复建了又拆，塞进任何一个 context 都会被别人的 `revert()`
 *    牵连。本文件只负责在 `dispose()` 里把它一起收掉。
 */

import gsap from 'gsap'
import ScrollTrigger from 'gsap/ScrollTrigger'
import { setupEditorialScroll } from './编辑版面滚动控制'
import { requestMotionLayoutRefresh } from '../工具/动效布局调度'
import { createViewportEntrance } from '../工具/视口入场控制'

gsap.registerPlugin(ScrollTrigger)

/* ---------------- 通用揭示 ---------------- */
const REVEAL_Y = 26
const REVEAL_DUR = 1
const REVEAL_EASE = 'power3.out'
/** 单个元素：进视口 88% 就出现（元素比较矮，可以晚一点） */
const SINGLE_START = 'top 88%'
/** 成组：容器进视口 84% 整组开始错峰 */
const GROUP_START = 'top 84%'
const STAGGER = 0.08

/* ---------------- 揭示机制（按章节区分，2026-10-10 加） ----------------
 *
 * 验收记录点名：「摄影、海报和个人页大量内容都依赖同一个通用揭示（透明度 0→1、
 * 上移 26px、固定时长）……按章节安排不同的运动机制，不再给所有节点统一套淡入」。
 *
 * 于是把「怎么出现」抽成一个可选项，由**章节**（`data-motion`）决定，
 * 默认仍是 `rise`（老行为），所以没标 `data-motion` 的屏一行都不用改。
 *
 *   rise  — 上移 26px（默认，文字段落最稳）
 *   slide — 从左侧滑入（横向并列的内容：左图右说明、左右对照）
 *   wipe  — 沿 x 轴擦出（`clip-path` 横向展开；给标题、列表行这类"写上去"的内容）
 *   scale — 由 0.94 放大落位（画面型内容：画廊、大图舞台）
 *   fade  — 只改透明度（给已经有自己位移/裁切动画的容器让位）
 *
 * ⚠️ `wipe` 只写 `clip-path`、不写 `opacity`：擦出的过程本身就是「出现」，
 *    再叠一层淡入会显得糊。
 * ⚠️ `wipe` 的 `clip-path` 会**裁掉**溢出自身盒子的一切（拖动中的照片、
 *    焦点环、阴影）。所以它只给「不会把自己拖出盒子」的元素用；
 *    可拖动的照片槽位用 `scale`（transform 不裁切）。
 * ⚠️ `clip-path` 还会给绝对/固定定位的后代建包含块。标 `wipe` 的元素里
 *    不得放 `position: sticky` / `fixed` 的内容。
 * ⚠️ 三处字符串必须**结构一致**（都是 4 个数值），GSAP 是按位置对齐插值的。
 */
type RevealMotion = 'rise' | 'slide' | 'wipe' | 'scale' | 'fade'

const MOTIONS: Record<RevealMotion, { from: gsap.TweenVars; to: gsap.TweenVars }> = {
  rise: { from: { opacity: 0, y: REVEAL_Y }, to: { opacity: 1, y: 0 } },
  slide: { from: { opacity: 0, x: -46 }, to: { opacity: 1, x: 0 } },
  wipe: {
    from: { opacity: 1, clipPath: 'inset(0% 100% 0% 0%)' },
    to: { opacity: 1, clipPath: 'inset(0% 0% 0% 0%)' },
  },
  scale: { from: { opacity: 0, scale: 0.94 }, to: { opacity: 1, scale: 1 } },
  fade: { from: { opacity: 0 }, to: { opacity: 1 } },
}

/**
 * 取一个元素该用哪种机制：看它最近的 `[data-motion]` 祖先（`AboutSection` 的
 * `motion` prop 会把它写在 `<section>` 上）。没标 / 标了不认识的值 → `rise`。
 */
function motionOf(el: HTMLElement): RevealMotion {
  const key = el.closest('[data-motion]')?.getAttribute('data-motion') ?? ''
  return key in MOTIONS ? (key as RevealMotion) : 'rise'
}

/* ---------------- 聊天序列 ---------------- */
/**
 * 气泡三态（`clip-path: inset()` 的四个参数 = 上 / 右 / 下 / 左各裁掉多少）：
 *   collapsed —— 四边各裁 38%，只剩中心一小块，正好是三个打字点那么大；
 *   hBand     —— 上下仍裁 38%、左右归零 ⇒ 先长出一条横带；
 *   expanded  —— 四边归零，完整圆角矩形。
 * 从 collapsed → hBand → expanded 就是方案要的「先横向展开、再向下展开」。
 * ⚠️ 三态的 `round 20px` 必须写全且一致：GSAP 靠字符串结构对齐来插值，
 *    少一个参数就会退化成逐帧跳变。
 */
const BUBBLE_COLLAPSED = 'inset(38% 38% 38% 38% round 20px)'
const BUBBLE_H_BAND = 'inset(38% 0% 38% 0% round 20px)'
const BUBBLE_EXPANDED = 'inset(0% 0% 0% 0% round 20px)'
/** 打字点让位（秒） */
const TYPING_OUT = 0.18
/** 第一段 · 横向展开 */
const OPEN_X_AT = 0.02
const OPEN_X_DUR = 0.4
/**
 * 第二段 · 纵向展开。
 * ⚠️ 起点**必须**等于第一段的终点（0.02 + 0.40），不能提前重叠：
 *    两段都写 `clipPath`，一旦时间上重叠就是两个 tween 抢同一个属性 ——
 *    实测重叠时后一段会把浏览器报的简写值 `inset(38% round 20px)` 当成起点，
 *    上下两条边插值出 2.7 倍的不对称量（f04 读到 top 18.07% / bottom 6.75%）。
 *    接力之后每段都在干净的终值上取起点。
 */
const OPEN_Y_AT = OPEN_X_AT + OPEN_X_DUR
const OPEN_Y_DUR = 0.46
/**
 * 整句显露。
 * ⚠️ 这里是**整段**淡入，不是逐字亮起（方案明确要求取消逐字）：`.bubble__tx`
 *    只有一个节点，一次补间就够；反向滚动也不会因为上百个子节点而卡顿。
 * ⚠️ 起点压在纵向展开的中段：气泡先成形、句子再落定，读起来才是「展开 → 出现」。
 */
const TEXT_AT = 0.56
const TEXT_DUR = 0.34

interface AboutRevealOptions {
  /** 减少动态效果：不建任何 ScrollTrigger，由 CSS 把内容摆到位。 */
  reduceMotion?: boolean
  /** 页面主标题（第 02 屏上方那个）：进场时从下方浮起。 */
  title?: HTMLElement | null
  /** 可选阅读收尾位置（视口高度比例）；海报页使用中线，其它页面保持原入场节奏。 */
  finishAt?: number
}

/**
 * `setupAboutReveal()` 返回的句柄。
 *
 * ⚠️ 刻意**不是**一个「销毁函数」：调用方需要区分的两件事 ——
 *    「换语言了，把聊天重建一下」和「离开页面了，全部拆掉」——
 *    混成一个函数就必然出现「为了换语言而把整页动画拆掉」。
 */
export interface AboutRevealHandle {
  /** 切语言用：只重建聊天那一支。通用揭示与数字滚动**完全不动**。 */
  rebuildChat: () => void
  /** 卸载用：先还原被动画改写的文本，再清掉全部 tween / ScrollTrigger。 */
  dispose: () => void
}

/**
 * 建立 `/about` 的全部滚动揭示。
 *
 * ⚠️ 必须在遮罩撤掉、页面解除滚动锁**之后**调用，否则 ScrollTrigger 会在
 *    错误的文档高度上量出 `start` 位置（首屏还没落定，后面所有屏的触发点都偏）。
 */
export function setupAboutReveal(
  root: HTMLElement,
  opts: AboutRevealOptions = {},
): AboutRevealHandle {
  const reduce = opts.reduceMotion === true
  let cancelRefresh: (() => void) | undefined
  const refreshLayout = () => {
    cancelRefresh?.()
    cancelRefresh = requestMotionLayoutRefresh()
  }

  /**
   * 挂了数字滚动的元素。
   * ⚠️ `dispose()` 靠它们自己的 `data-count-value` 把文本还原回去 ——
   *    GSAP 的 `revert()` 管不到 `textContent`，而它拨回起点时会顺手写一个 `0`。
   */
  const countEls: HTMLElement[] = []

  /** 通用揭示 + 数字滚动。**建一次就够，永不随语言重建。** */
  const buildReveal = (): void => {
    if (reduce) return

    if (opts.title) {
      gsap.from(opts.title, { y: 80, opacity: 0, duration: 1.5, ease: 'power3.out' })
    }

    /* ---------- 1. 通用揭示（先收编成组的，剩下的单独触发） ---------- */

    /**
     * 建一条揭示补间。
     * ⚠️ 同一批元素必须**同机制**才能合成一条 tween —— GSAP 的 `fromTo` 对一批
     *    元素只接受一份起点。所以调用方按机制分好桶再进来（见下面的分桶）。
     */
    const revealTween = (
      els: HTMLElement[],
      motion: RevealMotion,
      cfg: { stagger: number; trigger: HTMLElement; start: string },
    ): void => {
      const m = MOTIONS[motion]
      const animation = gsap.fromTo(els, { ...m.from }, {
        ...m.to,
        duration: REVEAL_DUR,
        stagger: cfg.stagger,
        ease: REVEAL_EASE,
        paused: opts.finishAt !== undefined,
        ...(opts.finishAt === undefined ? { scrollTrigger: {
          trigger: cfg.trigger,
          start: cfg.start,
          toggleActions: 'play none none none',
          once: true,
        } } : {}),
      })
      if (opts.finishAt !== undefined) createViewportEntrance({
        trigger: cfg.trigger,
        finishAt: opts.finishAt,
        play: () => { animation.play() },
        complete: () => { animation.progress(1).pause() },
      })
    }

    /** 按机制分桶：一个容器里允许混用不同机制（例如标题擦出、导语上移）。 */
    const bucket = (els: HTMLElement[]): Map<RevealMotion, HTMLElement[]> => {
      const map = new Map<RevealMotion, HTMLElement[]>()
      for (const el of els) {
        const m = motionOf(el)
        const arr = map.get(m)
        if (arr) arr.push(el)
        else map.set(m, [el])
      }
      return map
    }

    const grouped = new Set<HTMLElement>()
    root.querySelectorAll<HTMLElement>('[data-reveal-stagger]').forEach((g) => {
      const items = Array.from(g.querySelectorAll<HTMLElement>('[data-reveal]'))
      if (!items.length) return
      items.forEach((el) => grouped.add(el))
      for (const [motion, els] of bucket(items)) {
        revealTween(els, motion, { stagger: STAGGER, trigger: g, start: GROUP_START })
      }
    })

    root.querySelectorAll<HTMLElement>('[data-reveal]').forEach((el) => {
      if (grouped.has(el)) return
      for (const [motion, els] of bucket([el])) {
        revealTween(els, motion, { stagger: 0, trigger: el, start: SINGLE_START })
      }
    })

    /* ---------- 2. 章节标题右侧那条细线：横向抽出来 ---------- */

    root.querySelectorAll<HTMLElement>('.ab-sec__rule').forEach((el) => {
      const animation = gsap.fromTo(
        el,
        { scaleX: 0, transformOrigin: 'left center' },
        {
          scaleX: 1,
          transformOrigin: 'left center',
          duration: 0.9,
          ease: REVEAL_EASE,
          paused: opts.finishAt !== undefined,
          ...(opts.finishAt === undefined ? { scrollTrigger: {
            trigger: el,
            start: 'top 94%',
            toggleActions: 'play none none none',
            once: true,
          } } : {}),
        },
      )
      if (opts.finishAt !== undefined) createViewportEntrance({
        trigger: el,
        finishAt: opts.finishAt,
        play: () => { animation.play() },
        complete: () => { animation.progress(1).pause() },
      })
    })

    /* ---------- 3. 作品数据：数字滚动 ---------- */

    root.querySelectorAll<HTMLElement>('[data-count]').forEach((el) => {
      /*
       * ⚠️ 目标值**每帧从 `data-count-value` 读**，绝不在创建时捕获进闭包。
       *
       *    切语言会换掉这批文本（`630万+` ↔ `6.3M+`）。如果创建时把 `target` /
       *    `suffix` 定死，切到英文后再滚回作品区，tween 会把**中文格式**写回来
       *    （`6.3M+` 变回 `630万+`）—— 一个比「0万+」更隐蔽的错误。
       *
       *    Vue 绑定的这个属性始终是当前语言的原值，所以补间只要 0 → 1，
       *    真正的数值与后缀每帧现取现用。
       */
      const parse = (): RegExpExecArray | null =>
        /^(\d+(?:\.\d+)?)(.*)$/.exec(el.dataset.countValue ?? '')
      // 不是「数值 + 后缀」就原样不动，绝不猜（平台名一类本来就不该滚动）
      if (!parse()) return
      countEls.push(el)
      const proxy = { v: 0 }
      gsap.to(proxy, {
        v: 1,
        duration: 1.15,
        ease: 'power2.out',
        scrollTrigger: {
          trigger: el.closest('.work') ?? el,
          start: 'top 84%',
          /*
           * ⚠️ 数字**只播一次，绝不倒回** —— 和上面通用揭示的
           *    `play reverse play reverse` 刻意不同。
           *
           *    `play reverse play reverse` 在向上滚出触发线时会把数字从
           *    `630万+` 一路写回 `0万+`。实测（探针 v4）：滚到作品区让数字演完
           *    → 回顶部切语言 → 停在顶部读 DOM，前 6 个数字正好是
           *    `0万+ / 0万+ / 0+ / 0+ / 0+ / 0%+`。
           *    那一帧常常还在视口底边（`start: top 84%` 时行首已可见），
           *    读起来只有一种意思：「数字坏了」。
           *
           *    数字是**数据**，倒着滚回去没有语义；透明度 / 位移的揭示照旧可逆，
           *    不受这条影响。
           */
          toggleActions: 'play none none none',
        },
        // 每帧把 proxy 的当前值格式化成文本。位数从**当前**文本现取，
        // 所以 `6.3M+` 与 `630万+` 各按自己的精度补间（切语言后仍然对）。
        onUpdate: () => {
          const m = parse()
          if (!m) return
          // 小数位数从**当前**文本里现取，所以 `6.3M+` 与 `630万+` 各按自己的精度补间
          const decimals = (m[1].split('.')[1] ?? '').length
          el.textContent = (proxy.v * Number(m[1])).toFixed(decimals) + m[2]
        },
      })
    })

    /* ---------- 4. 照片 → 版面：滚动驱动的转换 ----------
     *
     * ⚠️ 2026-10-10 第四轮**从这里搬走了**（见 `setupEditorialScroll.ts`）。
     *
     *    旧实现只按初始宽度建一次擦除时间轴，`start: 'top 78%'` / `end: 'bottom 62%'`，
     *    没有 pin —— 实测元素顶边从 414px 变 90px 再变 -378px，画面**跟着页面滚走**，
     *    而擦除还没完成。验收记录点名了这件事。
     *
     *    现在的做法是给这一屏一个**居中固定舞台**：`pin + pinSpacing` 提供真实滚动
     *    行程，`scrub` 直接绑滚动，擦满之后才释放。它由 `gsap.matchMedia` 管理，
     *    有自己的建立 / 撤销生命周期，所以**不放在这个 context 里** ——
     *    放进来就会和通用揭示共用一个 `revert()`，切语言或条件变化时互相牵连。
     *
     *    ⚠️ 两套绝不能同时写 `clipPath`：本文件已经**不再**创建任何 morph 补间。

    */

    // 字体 / 图片落位后再量一次，避免 start 位置算早了。
    refreshLayout()
  }

  /**
   * 聊天序列（第 03 屏）。
   * ⚠️ 单独一支：`ChatFAQ` 的消息带 `:key="lang-i"`，换语言会把整条消息重建，
   *    新的 `.bubble` / `.bubble__tx` 上没有 GSAP 留下的内联样式 ——
   *    不重建就是「气泡没收拢、字是透明的、打字点还杵在中间」。
   */
  const buildChat = (): void => {
    if (reduce) return

    root.querySelectorAll<HTMLElement>('.chat-item').forEach((item) => {
      const bubble = item.querySelector<HTMLElement>('.bubble')
      if (!bubble) return
      const typing = item.querySelector<HTMLElement>('.typing')
      const text = bubble.querySelector<HTMLElement>('.bubble__tx')

      /*
       * 打字点跳动：独立无限 tween，**创建时暂停**。
       * ⚠️ 不能塞进 timeline：`repeat: -1` 会让 timeline 时长变成无限，
       *    `toggleActions` 的反向播放就永远回不到起点。
       * ⚠️ 也必须是暂停起步、而不是「一直转」：方案要求「打字点只在输入阶段运行」。
       *    开关挂在 timeline 的三个回调上 —— 正向开演（开始「输入」）时转起来，
       *    演完（回答已显露）停住，反向回到起点（又变回「还没输入」）再转。
       */
      let dots: gsap.core.Tween | null = null
      if (typing) {
        const i = typing.querySelectorAll<HTMLElement>('i')
        if (i.length) {
          dots = gsap.to(i, {
            y: -6,
            repeat: -1,
            yoyo: true,
            stagger: 0.15,
            duration: 0.3,
            ease: 'sine.inOut',
            paused: true,
          })
        }
      }

      /*
       * 分阶段双轴 + 位置判定协调回滚（2026-10-10 重写）：
       *   · tlItem（86%）—— 条目淡入：先「弹圆（消息出现）」
       *   · tlBubble（76%）—— 打字点让位 → 气泡横展 → 纵展 → 整句显露：后「撑开」
       *
       * 回滚顺序：向上滚先越过 76%（气泡先收）→ 气泡收完（onReverseComplete）
       *   才放行 86% 的条目反向。快速滚动时也由这个判定保证
       *   「气泡收完条目才淡出」，两条轴不会并发反向。
       *
       * ⚠️ **不能再靠历史布尔值**（旧实现是 `itemPendingReverse`）：实测折返
       *    上→下→上 时，那个标志在「向下重新进入」时没被清掉，于是气泡收完时
       *    仍执行旧的 `tlItem.reverse()` —— 条目在**本该保留的小圆阶段**提前淡出。
       *    现在改成**每次都读当前触发器的实时位置**：
       *      `self.scroll() >= self.start` ⇔ 条目线（86%）现在确实还在视口内。
       *    位置是唯一真相，不需要任何「待回滚请求」的状态。
       * ⚠️ `tlItem` 必须**先于** `tlBubble` 声明：气泡的 `onReverseComplete`
       *    要用到同一个实例（提到后面声明会踩 TDZ）。
       *
       * ⚠️ 起点写在这里而不是 CSS：切语言会重建整条消息（`:key="lang-i"`），
       *    CSS 起点会让新节点在没有补间时永久停在透明。
       * ⚠️ 气泡两条 clipPath 段从 0.02 接力（OPEN_X_AT / OPEN_Y_AT），与原来一致。
       */
      let bubbleClosed = true // 气泡是否已完全收拢（可放行条目回卷）
      let itemTrigger: ScrollTrigger | null = null

      // 先声明条目轴，确保回调使用的是同一个实例。
      const tlItem = gsap.timeline({ paused: true })
      tlItem.fromTo(item, { opacity: 0 }, { opacity: 1, duration: 0.4, ease: 'power2.out' }, 0)

      const tlBubble = gsap.timeline({
        paused: true,
        // 气泡展开 / 收完时同步「打字圆点」的跑停：
        // 展开中让它动，停下就冻住，避免静止的气泡里还有一串永动的点。
        onStart: () => dots?.play(),
        // 展开到位就冻住圆点（静止的气泡里不该有永动的省略号）
        onComplete: () => dots?.pause(),
        // 倒着收回跑完 → 记下「现在是收着的」，并按条目线此刻的位置决定要不要补播
        onReverseComplete: () => {
          bubbleClosed = true
          if (!itemTrigger) return
          // 气泡收完了，再看**条目线此刻**还在不在视口里 —— 而不是看历史标志。
          const shouldShow = itemTrigger.scroll() >= itemTrigger.start
          if (shouldShow) {
            tlItem.play()
            dots?.play()
          } else {
            dots?.pause()
            tlItem.reverse()
          }
        },
      })
      if (typing) {
        tlBubble.to(typing, { opacity: 0, duration: TYPING_OUT, ease: 'power1.out' }, 0.02)
      }
      // `fromTo` 的起点在创建时就渲染（immediateRender 默认开）⇒ 气泡从第一帧起
      // 就是收拢态，反向也能干净地回到收拢态。
      tlBubble.fromTo(
        bubble,
        { clipPath: BUBBLE_COLLAPSED },
        { clipPath: BUBBLE_H_BAND, duration: OPEN_X_DUR, ease: 'power3.out' },
        OPEN_X_AT,
      )
      /*
       * ⚠️ 第二段必须也是 `fromTo`，**不能**写成 `.to()`。
       *    `.to()` 会在自己开始渲染时回读浏览器的 computed 值 —— 而浏览器会把
       *    `inset(38% 0% 38% 0% round 20px)` 简写成 `inset(38% 0% round 20px)`
       *    （少两个数值）。GSAP 的复杂字符串插值是**按位置**对齐数值的，起点 3 个
       *    数、终点 5 个数就会整体错位：实测上下两条边插出 2.7 倍的不对称量，
       *    `round` 还从 0 涨回 20px。显式给出起点后，三态都是同样 5 个数值，插值干净。
       * ⚠️ `immediateRender: false`：否则这一段的起点会在**创建时**就渲染，
       *    把第一段的收拢起点顶掉（气泡一上来就是横带）。
       */
      tlBubble.fromTo(
        bubble,
        { clipPath: BUBBLE_H_BAND },
        {
          clipPath: BUBBLE_EXPANDED,
          duration: OPEN_Y_DUR,
          ease: 'power3.out',
          immediateRender: false,
        },
        OPEN_Y_AT,
      )
      if (text) {
        tlBubble.fromTo(
          text,
          { opacity: 0 },
          { opacity: 1, duration: TEXT_DUR, ease: 'power2.out' },
          TEXT_AT,
        )
      }

      /**
       * 条目轴的位置同步：**每次都用触发器当前的位置**判定，不用任何历史状态。
       *
       * · 进入（scroll ≥ start）→ 条目淡入；气泡已收拢的话，小圆转起来。
       * · 离开（scroll < start）→ 只有**气泡已经收完**才退条目；
       *   气泡还在演（或正在收）时什么都不做，等它的 `onReverseComplete` 再判一次。
       */
      function syncItem(self: ScrollTrigger): void {
        if (self.scroll() >= self.start) {
          tlItem.play()
          if (bubbleClosed) dots?.play()
        } else if (bubbleClosed) {
          dots?.pause()
          tlItem.reverse()
        }
        // 气泡尚未收完时等待它的 onReverseComplete，不并发退条目。
      }

      itemTrigger = ScrollTrigger.create({
        trigger: item,
        start: 'top 86%',
        onEnter: syncItem,
        onEnterBack: syncItem,
        onLeaveBack: syncItem,
        onRefresh: syncItem,
      })

      ScrollTrigger.create({
        trigger: item,
        start: 'top 76%',
        // 条目线进入视口 → 气泡展开；再滚回去 → 气泡收回。
        // `bubbleClosed` 是给 onReverseComplete 用的「当前是收着的」标记。
        onEnter: () => {
          bubbleClosed = false
          tlBubble.play()
        },
        // 又滚回条目线之上 → 把气泡倒着收回去
        onLeaveBack: () => {
          tlBubble.reverse()
        },
      })
    })
  }

  // 三支各自收口：revert 一支不会碰到另一支建的任何 tween。
  const ctxReveal = gsap.context(buildReveal, root)
  let ctxChat = gsap.context(buildChat, root)
  /*
   * 编辑对照的居中固定舞台（第三支）。
   * ⚠️ **始终登记**，不能在这里先判一次媒体查询：减少动态 / 宽窄屏是用户**可以
   *    随时改**的偏好，`gsap.matchMedia` 自己会在条件变化时建立或撤销。
   *    在这里提前 return 掉，用户后来把窗口拉宽就再也等不到舞台。
   */
  const editorial = setupEditorialScroll(root)

  return {
    /**
     * 切换语言后重建聊天那一支。
     * 条目高度随语言变化，所以重建完必须 `ScrollTrigger.refresh()` 重量触发点，
     * 否则后面各屏的进出时机全按旧高度算。
     */
    rebuildChat(): void {
      ctxChat.revert()
      ctxChat = gsap.context(buildChat, root)
      // 换语言会改条目高度 ⇒ 后面各屏的触发点要重量。
      refreshLayout()
    },

    /** 页面卸载时的总清理。顺序见函数内注释（先拆 pin，再拆 context）。 */
    dispose(): void {
      cancelRefresh?.()
      /*
       * ⚠️ 顺序：先拆 pin（它会改文档高度、并往 DOM 里插 pin-spacer），
       *    再拆两支 context —— 反过来的话，pin 撤销后文档高度突变，
       *    剩下还没拆的 ScrollTrigger 会按错的高度再量一次。
       */
      editorial.dispose()
      ctxChat.revert()
      ctxReveal.revert()
      /*
       * ⚠️ 顺序不能反：`ctxReveal.revert()` 会把数字 tween 拨回起点，
       *    顺手把 `0` 写进 `textContent`。必须**在它之后**再覆盖回原文。
       */
      for (const el of countEls) {
        const v = el.dataset.countValue
        if (v) el.textContent = v
      }
      countEls.length = 0
    },
  }
}
