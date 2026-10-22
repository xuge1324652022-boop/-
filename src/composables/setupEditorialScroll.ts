/**
 * `/poster` 03「编辑设计」的**居中固定舞台**：原片 → 版面，一次擦除，可回滚。
 *
 * 用途
 *   把两张同源作品（摄影原片 + 基于它做的封面排版）放进同一个取景框：
 *   滚到这一屏时画面先停在预留上方呼吸空间后的视口中央，继续下滑只推进擦除边界，
 *   封面从左往右盖住原片；完全覆盖之后才释放舞台，页面继续下滑。
 *   往上滚按相反顺序原路退回 —— 这是「照片成为版面」的过程本身，不是自动轮播。
 *
 * 触发条件（媒体查询，`gsap.matchMedia`）
 *   `(min-width: 761px) and (min-height: 500px) and (prefers-reduced-motion: no-preference)`
 *   三条缺一不可：窄屏是上下排列、没有「叠」可谈；矮屏塞不下 16:9 图版 + 图注 + 控制；
 *   减少动态必须是一张完整静态对照。条件不满足时**不建立任何 tween**，
 *   CSS 里的两列并排就是终态（`is-pinned` 由本文件负责加、也由本文件负责摘）。
 *
 * 阶段顺序（`scrub: true` ⇒ 进度 = 滚动位置，没有 setTimeout，也不接管滚轮/body）
 *   wipe → read 封面从左往右擦满；图注交叉淡入，进度线 `scaleX` 0 → 1。
 *   read → end  完整版面保留阅读时间，之后才解除 pin。
 *   `/poster` 的实际擦除行程延长约四成；其他页面沿用默认节奏。
 *   ⚠️ 停留段是**滚动距离**，不是秒数 —— 用户为「看完擦除」付出的额外滚动量。
 *
 * 属性归属（一个属性只有一个写入者）
 *   `[data-morph-after]`   `clip-path`      —— 本文件
 *   `[data-morph-rule]`    `transform: scaleX` —— 本文件
 *   `.ep__cap`             `opacity`        —— 本文件
 *   `.editorial-scene`     `position/width/…`（pin 写入）—— ScrollTrigger
 *   通用揭示（`useAboutReveal`）**不参与** morph 图版：图版上没有 `data-reveal`，
 *   否则 `y` / `opacity` 会和固定舞台同时改构图。
 *
 * 回滚策略
 *   `scrub: true` 天生可逆；`gsap.matchMedia` 的条件退出与组件卸载都会
 *   `revert()` —— 补间被 kill、内联样式被还原、pin-spacer 被移除、
 *   `is-pinned` 被摘掉，页面回到「两张完整并排」的静态对照。
 *
 * 初始化时机
 *   必须在开场遮罩撤掉、页面解除滚动锁**之后**调用（与通用揭示同一约束）：
 *   否则 ScrollTrigger 会在错误的文档高度上量出 pin 区间。
 *
 * 验收方法
 *   `outputs/verify-motion-design.cjs` D 段：擦除 0% / 50% / 100% 三档采样
 *   —— 舞台 `top` 稳定、两张 rect 严格重合、`clip-path` 单调、滚到底为 0%、
 *   回滚复原；窄屏与减少动态断言 `clip-path === 'none'`、上下排列、无 pin-spacer。
 */

import gsap from 'gsap'
import ScrollTrigger from 'gsap/ScrollTrigger'
import { requestMotionLayoutRefresh } from '../utils/motionLayout'

gsap.registerPlugin(ScrollTrigger)

/**
 * 舞台顶部预留高度（px），沿用旧变量名 NAV_HEIGHT/--ep-nav-h。
 * 当前子页没有固定导航栏；此值只为画面上方保留呼吸空间。
 * 调大它会缩小图版可用纵向空间，须同时检查图注与控制条是否仍能完整显示。
 */
const NAV_HEIGHT = 56

/**
 * 用户为「看完这次擦除」付出的滚动量，单位是**视口高**。
 * 调大 = 擦除更慢、更从容；调小 = 更快划过去（太小会让 0% / 50% / 100% 三档
 * 挤在几十像素里，看起来像「一下就翻过去了」）。
 * 它只决定滚动距离，不决定时长 —— 这里没有自动播放。
 */
const EDITORIAL_SCROLL_SCREENS = 1.35

/**
 * 默认平分转换与阅读；海报页把更多行程分给转换，不以补长末尾停留来放慢视觉。
 * 图注和进度线始终随擦除使用同一比例。
 */
const WIPE_RATIO = 0.5
const HOLD_RATIO = 1 - WIPE_RATIO

export interface EditorialScrollHandle {
  /** 卸载 / 离开路由时撤销 pin、补间与内联样式。 */
  dispose: () => void
}

/**
 * 在 `root` 子树里找出所有 `[data-morph]` 图版并建立居中固定舞台。
 *
 * @param root `/poster` 的页面根（`ref` 指向的元素）。用 `matchMedia` 的 scope，
 *             条件退出时 GSAP 只 revert 本子树里建的补间，不碰别处。
 * @returns      句柄：`dispose()` 撤销 pin 与全部内联样式（路由离开 / 组件卸载时调）
 *
 * ⚠️ 调用方**不需要**先判断媒体查询：`gsap.matchMedia` 自己会在条件成立 / 失效时
 *    建立或撤销。提前 return 掉的话，用户后来把窗口拉宽就再也等不到舞台。
 * ⚠️ 一个 `[data-morph]` 下没有 `[data-morph-after]`（没有「版面」那张）时整块跳过 ——
 *    不留一个钉住了却无可擦内容的空舞台。
 */
export function setupEditorialScroll(root: HTMLElement): EditorialScrollHandle {
  const media = gsap.matchMedia()
  let cancelRefresh: (() => void) | undefined
  const poster = root.classList.contains('pp')
  const scrollScreens = poster ? 1.75 : EDITORIAL_SCROLL_SCREENS
  const wipeRatio = poster ? .55 : WIPE_RATIO
  const holdRatio = poster ? 1 - wipeRatio : HOLD_RATIO

  media.add(
    '(min-width: 761px) and (min-height: 500px) and (prefers-reduced-motion: no-preference)',
    () => {
      const scenes = [...root.querySelectorAll<HTMLElement>('[data-morph]')]
      const pinned: HTMLElement[] = []

      for (const scene of scenes) {
        const after = scene.querySelector<HTMLElement>('[data-morph-after]')
        // 没有「版面」那一张就没有可擦的东西 —— 整块跳过，不留半个舞台。
        if (!after) continue

        const rule = scene.querySelector<HTMLElement>('[data-morph-rule]')
        const beforeCap = scene.querySelector<HTMLElement>('[data-morph-before] .ep__cap')
        const afterCap = scene.querySelector<HTMLElement>('[data-morph-after] .ep__cap')

        scene.classList.add('is-pinned')
        scene.style.setProperty('--ep-nav-h', `${NAV_HEIGHT}px`)
        pinned.push(scene)

        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: scene,
            pin: scene,
            // 为擦除保留真实滚动距离：pin 期间页面继续滚，只是画面不动。
            pinSpacing: true,
            start: 'top top',
            end: () => `+=${Math.round(window.innerHeight * scrollScreens)}`,
            /*
             * `scrub: true` 而不是阻尼值：阻尼会让快速越过结束点时补间还在追赶，
             * 结果「pin 已经解除、封面却只擦了一半」。这里优先保证
             * 「擦完才离开」这个明确顺序。
             */
            scrub: true,
            // 视口尺寸变了要重新量行程（end 是函数，每次 refresh 都会重算）
            invalidateOnRefresh: true,
            anticipatePin: 1,
          },
        })
        tl.addLabel('wipe', 0).addLabel('read', wipeRatio).addLabel('end', wipeRatio + holdRatio)

        // 保留既有的左 → 右擦除形态：只动 `clip-path` 的右边距。
        tl.fromTo(
          after,
          { clipPath: 'inset(0% 100% 0% 0%)' },
          { clipPath: 'inset(0% 0% 0% 0%)', duration: wipeRatio, ease: 'none' },
          'wipe',
        )
        if (rule) {
          tl.fromTo(
            rule,
            { scaleX: 0, transformOrigin: 'left center' },
            { scaleX: 1, transformOrigin: 'left center', duration: wipeRatio, ease: 'none' },
            'wipe',
          )
        }
        // 两张图注落在同一行上，交叉淡入才不会读成「两块字压在一起」。
        if (beforeCap) {
          tl.fromTo(beforeCap, { opacity: 1 }, { opacity: 0, duration: wipeRatio * 0.3, ease: 'none' }, 'wipe')
        }
        if (afterCap) {
          tl.fromTo(afterCap, { opacity: 0 }, { opacity: 1, duration: wipeRatio * 0.5, ease: 'none' }, `wipe+=${wipeRatio * 0.5}`)
        }

        // 完成真实擦除行程后才进入阅读段，随后释放舞台。
        tl.to({}, { duration: holdRatio }, 'read')
      }
      if (pinned.length) {
        cancelRefresh?.()
        cancelRefresh = requestMotionLayoutRefresh()
      }

      /*
       * 条件退出（窄屏 / 矮屏 / 用户改成减少动态）时的清理。
       * GSAP 会先 revert 本支建的补间与内联样式，这里再补两件事：
       *   ① 摘掉 `is-pinned`（否则会留下「叠图 + 两条图注重叠」的静态残影）；
       *   ② 主动清一次子树上的内联样式 —— 只在 pin 期间被写过的属性，
       *      不去碰通用揭示写的 `opacity` / `y`（那在别的节点上）。
       */
      return () => {
        for (const scene of pinned) {
          scene.classList.remove('is-pinned')
          scene.style.removeProperty('--ep-nav-h')
          const touched = scene.querySelectorAll<HTMLElement>(
            '[data-morph-after], [data-morph-rule], .ep__cap',
          )
          for (const el of touched) {
            el.style.removeProperty('clip-path')
            el.style.removeProperty('opacity')
            el.style.removeProperty('transform')
          }
        }
        pinned.length = 0
      }
    },
    root,
  )

  return {
    /** 撤销 `gsap.matchMedia` 建的一切（含所有 pin 与 pin-spacer），幂等。 */
    dispose(): void {
      cancelRefresh?.()
      media.revert()
    },
  }
}
