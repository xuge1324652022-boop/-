<template>
  <div
    ref="root"
    class="reference-introduction"
    :class="[`reference-introduction--${variant}`, `reference-introduction--${treatment}`, { 'is-pending': !prepared, 'has-label': !!label }]"
  >
    <span v-if="label" class="reference-introduction__label">
      <template v-if="typeof label === 'string'">( {{ cleanLabel(label) }} )</template>
      <template v-else>
        <span lang="zh">( {{ cleanLabel(label.zh) }} )</span>
        <span lang="en">( {{ cleanLabel(label.en) }} )</span>
      </template>
    </span>
    <p
      v-for="(paragraph, index) in paragraphs"
      :key="paragraph.lang ?? 'copy'"
      class="reference-introduction__copy"
      :class="{ 'reference-introduction__copy--first': index === 0, 'is-copy-pending': !prepared && !(hasPlayed || paragraphStarted[index] || finished[index]) }"
      :lang="paragraph.lang"
    >{{ paragraph.text }}</p>
  </div>
</template>

<script setup lang="ts">
/**
 * 各子页共用的双语介绍：按真实视觉行分组，标题用行遮罩，正文保留段落排版。
 * 页面门禁控制“何时可播”，临近视口预热控制“何时分行”；两者分开避免幕下抢播，
 * 也避免长页挂载时一次性测量所有文字。重排延续进度，已读文字不反复弹出。
 */
import { computed, inject, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { SplitText } from 'gsap/SplitText'
import { withoutFinalStop, type Bi } from '../data/aboutProfile'
import { referenceIntroductionFinishAt, referenceIntroductionGate, referenceIntroductionPace } from './ReferenceIntroduction'
import { prepareMotionLayout, requestMotionLayoutRefresh } from '../utils/motionLayout'
import { createViewportEntrance } from '../utils/viewportEntrance'

gsap.registerPlugin(ScrollTrigger, SplitText)

const props = withDefaults(defineProps<{
  /** Bi 始终同时显示中英；string 兼容原有章节壳的文本接口 */
  text: Bi | string
  label?: Bi | string
  /** 页面加载幕结束后再放行，避免文字在遮罩后先播完 */
  active?: boolean
  /** 不传时按滚动触发；传false等待外部构图，true在准备完成和页面放行后播放一次 */
  reveal?: boolean
  start?: string
  /** 覆写页面的滚动收尾位置；false用于揭幕后才播放的首屏介绍，避免已在中线以上时被直接跳完 */
  finishAt?: number | false
  /** 短章节宣言可按段落分别入屏；原有整块或外部时间线触发保持默认行为 */
  revealBy?: 'block' | 'paragraph'
  variant?: 'hero' | 'section'
  /** 正文走逐行淡入；只有显示标题使用行遮罩 */
  treatment?: 'paragraph' | 'title'
}>(), { active: true, reveal: undefined, start: 'top 80%', revealBy: 'block', variant: 'hero', treatment: 'paragraph' })

const root = ref<HTMLElement | null>(null)
const prepared = ref(false)
const pageGate = inject(referenceIntroductionGate, ref(true))
const pageFinishAt = inject(referenceIntroductionFinishAt, undefined)
const finishAt = computed(() => props.finishAt === false ? undefined : props.finishAt ?? pageFinishAt)
const canReveal = computed(() => props.active && pageGate.value)
const paragraphs = computed(() => typeof props.text === 'string'
  ? [{ text: withoutFinalStop(props.text), lang: undefined }]
  : [
      { text: withoutFinalStop(props.text.zh), lang: 'zh' },
      { text: withoutFinalStop(props.text.en), lang: 'en' },
    ])
const cleanLabel = (value: string): string => value.replace(/^[（(]\s*|\s*[）)]$/gu, '')

const pace = inject(referenceIntroductionPace, 1)
const LINE_DURATION = .8 * pace
const LINE_STAGGER = .08 * pace
// 给无空格的中文提供原本允许的换行点；不插入可见空格，不按句子硬断行。
const chineseWordBoundary = /(?<=[\p{Script=Han}，。！？；：、）】》”’])(?=[\p{Script=Han}A-Za-z0-9（【《“‘])/gu
const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
let context: gsap.Context | undefined
let trigger: ScrollTrigger | undefined
let paragraphTriggers: ScrollTrigger[] = []
const paragraphStarted: boolean[] = []
let splits: SplitText[] = []
let animations: (gsap.core.Animation | undefined)[] = []
let finished: boolean[] = []
let resumeTimes: number[] | undefined
let hasPlayed = false
let dead = false
let resizeFrame = 0
let typographyKey = ''
let rebuildVersion = 0
let nearViewport = false
let preparationObserver: IntersectionObserver | undefined
let cancelPreparation: (() => void) | undefined
let cancelRefresh: (() => void) | undefined

function readTypographyKey(): string {
  const paragraph = root.value?.querySelector<HTMLElement>('.reference-introduction__copy')
  if (!paragraph) return ''
  const style = getComputedStyle(paragraph)
  return [style.fontSize, style.lineHeight, style.letterSpacing, style.textIndent, style.fontFamily, style.fontWeight].join('|')
}

function onResize(): void {
  if (resizeFrame || dead || !prepared.value) return
  resizeFrame = requestAnimationFrame(() => {
    resizeFrame = 0
    const nextKey = readTypographyKey()
    if (nextKey === typographyKey) return
    // autoSplit只检测段落宽度：容器封顶后vw字号/首行缩进仍会变化，需重新量真实行。
    typographyKey = nextKey
    void rebuild()
  })
}

function refreshLayout(): void {
  if (dead) return
  cancelRefresh?.()
  cancelRefresh = requestMotionLayoutRefresh()
}

function play(): void {
  if (dead || hasPlayed || !canReveal.value || props.reveal === false || !prepared.value || !context || !splits.length) return
  // 状态留在组件实例里；回滚、字体落位和响应式重排都不会重新隐藏已读文字。
  hasPlayed = true
  animations.forEach(animation => animation?.play())
}

function playParagraph(index: number): void {
  if (dead || paragraphStarted[index] || !canReveal.value || !prepared.value || props.reveal === false) return
  paragraphStarted[index] = true
  animations[index]?.play()
  hasPlayed = paragraphs.value.every((_, paragraphIndex) => paragraphStarted[paragraphIndex])
}

function completeParagraph(index: number): void {
  if (dead || !canReveal.value || !prepared.value || props.reveal === false) return
  paragraphStarted[index] = true
  finished[index] = true
  animations[index]?.progress(1).pause()
  hasPlayed = paragraphs.value.every((_, paragraphIndex) => paragraphStarted[paragraphIndex])
}

function complete(): void {
  paragraphs.value.forEach((_, index) => completeParagraph(index))
}

function disarm(): void {
  trigger?.kill()
  trigger = undefined
  paragraphTriggers.forEach(paragraphTrigger => paragraphTrigger.kill())
  paragraphTriggers = []
}

function arm(): void {
  if (!canReveal.value || !prepared.value || !context || !root.value || !splits.length) return
  if (hasPlayed && (finishAt.value === undefined || paragraphs.value.every((_, index) => finished[index]))) return
  if (props.reveal !== undefined) {
    // 运动构图的真实屏幕位置由父时间线判定，避免使用ScrollTrigger缓存的静态起点。
    disarm()
    if (props.reveal) play()
    return
  }
  if (props.revealBy === 'paragraph') {
    if (paragraphTriggers.length) return
    context.add(() => {
      root.value!.querySelectorAll<HTMLElement>('.reference-introduction__copy').forEach((paragraph, index) => {
        if (finished[index] || (paragraphStarted[index] && finishAt.value === undefined)) return
        paragraphTriggers.push(finishAt.value !== undefined ? createViewportEntrance({
          trigger: paragraph,
          finishAt: finishAt.value,
          play: () => playParagraph(index),
          complete: () => completeParagraph(index),
        }) : ScrollTrigger.create({
          trigger: paragraph,
          start: props.start,
          once: true,
          onEnter: () => playParagraph(index),
        }))
      })
    })
    return
  }
  if (trigger) return
  context.add(() => {
    trigger = finishAt.value !== undefined ? createViewportEntrance({
      trigger: root.value!,
      finishAt: finishAt.value,
      play,
      complete,
    }) : ScrollTrigger.create({
      trigger: root.value,
      start: props.start,
      once: true,
      onEnter: play,
    })
  })
}

function clear(): void {
  disarm()
  context?.revert()
  context = undefined
  // 除了补间，还要撤销 SplitText 的字体 / ResizeObserver 监听，并还原 Vue 原始文本。
  splits.forEach(split => { split.kill(); split.revert() })
  splits = []
  animations = []
}

function setup(): void {
  if (dead || !root.value) return
  typographyKey = readTypographyKey()
  if (motionQuery.matches) {
    hasPlayed = true
    finished = paragraphs.value.map(() => true)
    prepared.value = true
    return
  }

  context = gsap.context(() => {
    root.value!.querySelectorAll<HTMLElement>('.reference-introduction__copy').forEach((paragraph, index) => {
      const split = SplitText.create(paragraph, {
        type: 'lines',
        ...(props.treatment === 'title' ? { mask: 'lines' as const } : {}),
        linesClass: 'reference-line',
        wordsClass: 'reference-word',
        autoSplit: true,
        aria: 'auto',
        ...(paragraph.lang === 'zh' ? { wordDelimiter: { delimiter: chineseWordBoundary, replaceWith: '' } } : {}),
        onSplit(self) {
          if (finished[index]) {
            gsap.set(paragraph, { opacity: 1, y: 0 })
            animations[index] = gsap.set(self.lines, { opacity: 1, y: 0, yPercent: 0 })
          } else {
            const precedingLines = props.revealBy === 'paragraph' ? 0
              : splits.slice(0, index).reduce((total, preceding) => total + preceding.lines.length, 0)
            const animation = gsap.timeline({
              paused: !(hasPlayed || paragraphStarted[index]),
              onComplete: () => { finished[index] = true },
            })
            if (props.treatment === 'title') {
              animation.fromTo(self.lines, { yPercent: 100 },
                { yPercent: 0, duration: LINE_DURATION, stagger: LINE_STAGGER, ease: 'power3.out' },
                precedingLines * LINE_STAGGER)
            } else {
              // 与参考正文一致：段落和真实视觉行分开推进，保留段落排版而不套标题遮罩。
              const unit = window.innerWidth > 900 ? window.innerWidth / 144 : 10
              animation.fromTo(paragraph, { opacity: 0, y: 5 * unit },
                { opacity: 1, y: 0, duration: pace, ease: 'power3.out' }, 0)
                .fromTo(self.lines, { opacity: 0, y: 6 * unit },
                  { opacity: 1, y: 0, duration: LINE_DURATION, stagger: LINE_STAGGER, ease: 'power3.out' },
                  precedingLines * LINE_STAGGER)
            }
            // 手动重排保留已走过的秒数；autoSplit 自身也会迁移返回时间线的 totalTime。
            // hasPlayed 只禁止再次触发，不能被用来把尚在播放的文字瞬间推到终态。
            if (resumeTimes) animation.totalTime(resumeTimes[index] ?? 0)
            animations[index] = animation
          }
          refreshLayout()
          // 返回补间让 SplitText 在重分行时释放旧补间，避免继续驱动已被换掉的行节点。
          return animations[index]
        },
      })
      splits.push(split)
    })
  }, root.value)
  prepared.value = true
  resumeTimes = undefined
  arm()
}

async function rebuild(): Promise<void> {
  const version = ++rebuildVersion
  await nextTick()
  if (dead || version !== rebuildVersion) return
  queuePreparation(true)
}

function rememberProgress(): void {
  if (animations.length) resumeTimes = animations.map(animation => animation?.totalTime() ?? 0)
}

function queuePreparation(replace = false): void {
  if (dead || !root.value) return
  if (!replace && prepared.value) { arm(); return }
  // 固定/运动构图中的文字可能尚未进入普通预热区域，允许父时间线主动请求准备。
  if (!motionQuery.matches && !nearViewport && props.reveal !== true) return
  cancelPreparation?.()
  cancelPreparation = undefined
  const prepare = () => {
    cancelPreparation = undefined
    if (dead) return
    if (replace) { rememberProgress(); clear() }
    setup()
  }
  if (motionQuery.matches) prepare()
  else cancelPreparation = prepareMotionLayout(root.value, prepare)
}

watch([canReveal, () => props.reveal], ([active, reveal]) => {
  if (active && reveal !== false) { queuePreparation(); arm() }
  else if (!hasPlayed) {
    // 等待中的介绍遇到新遮罩时撤下触发器，恢复后再量；once不能被遮挡期间消耗。
    disarm()
  }
})
// Vue 更新文字前先还原分行 DOM；更新后再量新文本，避免 revert 写回上一种语言。
watch([() => props.text, () => props.treatment, () => props.revealBy], () => {
  // Vue 更新前撤销 SplitText 包装；新文本落位后继续此前进度，避免旧 DOM 抢写新文案。
  rememberProgress()
  prepared.value = false
  clear()
  void rebuild()
}, { deep: true, flush: 'pre' })
function onMotionChange(): void { void rebuild() }
onMounted(() => {
  // 静态偏好也保留预热观察：用户可能随后恢复动态、再切语言。
  // 若只在动态模式登记，尚未入屏的段落重建后会永远停在 pending。
  preparationObserver = new IntersectionObserver(entries => {
    if (!entries.some(entry => entry.isIntersecting)) return
    nearViewport = true
    preparationObserver?.disconnect()
    preparationObserver = undefined
    queuePreparation()
  }, { rootMargin: '500px 0px', threshold: 0 })
  if (root.value) preparationObserver.observe(root.value)
  if (motionQuery.matches) setup()
  else queuePreparation()
  motionQuery.addEventListener('change', onMotionChange)
  window.addEventListener('resize', onResize, { passive: true })
})
onBeforeUnmount(() => {
  dead = true
  rebuildVersion++
  preparationObserver?.disconnect()
  preparationObserver = undefined
  cancelPreparation?.()
  cancelRefresh?.()
  motionQuery.removeEventListener('change', onMotionChange)
  window.removeEventListener('resize', onResize)
  if (resizeFrame) cancelAnimationFrame(resizeFrame)
  clear()
})
</script>

<style scoped>
.reference-introduction {
  --reference-font-size: clamp(28px, 3.333333vw, 64px);
  --reference-line-height: 1.05;
  --reference-label-width: clamp(132px, 14.1vw, 260px);
  --reference-gap: clamp(20px, 3.2vw, 56px);
  position: relative;
  width: 100%;
  color: var(--reference-color, var(--ab-ink, currentColor));
}
.reference-introduction--section { --reference-font-size: clamp(26px, 3.333333vw, 64px); }
.reference-introduction__label {
  position: absolute;
  top: calc(var(--reference-font-size) * .02);
  left: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
  max-width: var(--reference-label-width);
  font-size: clamp(11px, 1.389vw, 20px);
  font-weight: 400;
  line-height: 1.1;
  letter-spacing: 0;
  color: var(--reference-label-color, currentColor);
}
/* 双语标签仍须落在第一条正文行内；英文缩为辅助字号，避免换行压住第二行正文 */
.reference-introduction__label [lang=zh] { white-space: nowrap; }
.reference-introduction__label [lang=en] { font-size: max(10px, .65em); white-space: nowrap; }
.reference-introduction__copy {
  margin: 0;
  font-size: var(--reference-font-size);
  font-weight: 400;
  line-height: var(--reference-line-height);
  letter-spacing: -.03em;
  overflow-wrap: break-word;
  text-wrap: pretty;
}
.reference-introduction__copy + .reference-introduction__copy { margin-top: var(--reference-gap); }
.has-label .reference-introduction__copy--first { text-indent: var(--reference-label-width); }
/* SplitText测行时先创建临时inline-block词节点，最终type:lines会移除它们。
   text-indent会被这些节点继承；中文逐字测量会因此每字多占一个标签宽度，必须清零。 */
.reference-introduction__copy :deep(.reference-word) { text-indent: 0; }
.reference-introduction__copy :deep(.reference-line) { text-indent: 0; }
/* 缩进只属于第一条真实排版行；后续行回到同一左边界，不变成整列缩进。 */
.has-label .reference-introduction__copy--first :deep(.reference-line-mask:first-child .reference-line) { text-indent: var(--reference-label-width); }
.has-label.reference-introduction--paragraph .reference-introduction__copy--first :deep(.reference-line:first-child) { text-indent: var(--reference-label-width); }
.reference-introduction__copy.is-copy-pending { visibility: hidden; }
@media (max-width: 760px) {
  .reference-introduction { --reference-font-size: clamp(26px, 6.7vw, 44px); --reference-label-width: clamp(120px, 34vw, 170px); --reference-line-height: 1.15; }
  .reference-introduction--section { --reference-font-size: clamp(24px, 6.1vw, 36px); }
  .reference-introduction__label { position: static; flex-direction: row; gap: 12px; max-width: none; margin-bottom: 16px; font-size: 10px; }
  /* 窄屏把双语标签置于段落上方，避免标签挤掉短中文介绍，留下一个字的孤行 */
  .has-label .reference-introduction__copy--first,
  .has-label.reference-introduction--paragraph .reference-introduction__copy--first :deep(.reference-line:first-child),
  .has-label .reference-introduction__copy--first :deep(.reference-line-mask:first-child .reference-line) { text-indent: 0; }
}
@media (prefers-reduced-motion: reduce) { .reference-introduction__copy.is-copy-pending { visibility: visible; } }
</style>
