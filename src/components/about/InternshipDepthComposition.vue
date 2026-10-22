<template>
  <section id="v10l-depth-composition" ref="root" class="idc" :class="{ 'idc--fallback': !supportsContainerUnits }" :aria-label="t.label">
    <div ref="scrollRegion" class="idc__sequence"><div ref="stage" class="idc__stage">
      <!-- 收整屏色域的边界，终点与主海报完全重合；不是把四张图片同时缩小 -->
      <div class="idc__field" aria-hidden="true"></div>
      <header class="idc__heading">
        <span>V10L / {{ lang === 'zh' ? '原稿' : 'ORIGINALS' }} 12—15</span>
        <h4>排布 · 感知 · 连接 <span lang="en">Layout · Sensing · Connection</span></h4>
      </header>
      <div class="idc__space"><div class="idc__departure"><div class="idc__scene">
        <div v-for="(item, i) in items" :key="item.id" class="idc__layer"
          :style="{ aspectRatio: i || !supportsContainerUnits ? `${item.width} / ${item.height}` : '0.787 / 1' }">
          <button class="idc__perspective" type="button" :aria-label="`${t.open}: ${pick(item.title, lang)}`"
            :data-cursor="lang === 'zh' ? '查看' : 'Explore'" data-cursor-action="view"
            @click="emit('open', item, $event.currentTarget as HTMLElement)">
            <div class="idc__sheet" :class="{ 'is-highlighted': highlighted === i }">
              <!-- 首稿产品文案成为可动双语排版，去Logo后的完整海报保留在右下图和查看器 -->
              <div v-if="!i && supportsContainerUnits" class="idc__main-poster">
                <div class="idc__main-title">
                  <span class="idc__brand">V10L / LASER RTK</span>
                  <span class="idc__headline" lang="en">SELL SMART<br>LAYOUT</span>
                  <span class="idc__headline-zh" lang="zh">智绘放样</span>
                </div>
                <div class="idc__main-description">
                  <span lang="zh">AR 引导<br>让放样清晰可见</span>
                  <span lang="en">Boost project accuracy<br>with AR guidance</span>
                </div>
              </div>
              <!-- 图像与色域用同一条曲线收拢。放在纸面外，收拢前不会被小海报边界截断 -->
              <img v-if="!i" class="idc__main-image" :src="item.src" :srcset="visualImageSources(item)"
                sizes="(max-width: 760px) 90vw, 46vw" :width="item.width" :height="item.height"
                :alt="pick(item.alt, lang)" loading="lazy" decoding="async" />
              <InternshipAnimatedArtwork v-if="i" :item="item" :lang="lang" :revealed="!supportsContainerUnits || introduced.has(item.id)" :completed="!supportsContainerUnits || settled.has(item.id)" />
              <span class="idc__static-title">{{ pick(item.title, lang) }}</span>
            </div>
          </button>
        </div>
      </div></div></div>
      <footer class="idc__footer">
        <span>{{ t.hint }}</span>
        <nav class="idc__nav" :aria-label="t.choose">
          <button v-for="(item, i) in items" :key="item.id" type="button" :class="{ 'is-highlighted': highlighted === i }"
            :aria-label="`${t.open}: ${pick(item.title, lang)}`"
            @click="emit('open', item, $event.currentTarget as HTMLElement)">{{ 12 + i }} ↗</button>
        </nav>
      </footer>
    </div></div>
    <ReferenceIntroduction class="idc__outro" :text="OUTRO" :label="OUTRO_LABEL" variant="section" />
  </section>
</template>

<script setup lang="ts">
import { visualImageSources } from '../../utils/responsiveImage'
/**
 * 四张 V10L 的连续场景：满屏色域与实字收为首稿，随后三稿入场，阅读后再侧转离场。
 * wrapper 负责滚动锚点，perspective 负责侧转，sheet 负责悬停；分层防止 transform 冲突。
 * 只有空间位置可随倒滚回溯，内部标题用 introduced 记忆首次展示，不重复弹出。
 * 外部介绍留在正常文档流中，不能跟舞台一起 scrub，否则释放 sticky 时会反向拉扯。
 */
import { computed, inject, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { pick, type Lang } from '../../data/aboutProfile'
import type { VisualAsset } from '../../data/visualPortfolio'
import InternshipAnimatedArtwork from './InternshipAnimatedArtwork.vue'
import ReferenceIntroduction from '../ReferenceIntroduction.vue'
import { referenceIntroductionGate } from '../ReferenceIntroduction'
import { prepareMotionLayout, requestMotionLayoutRefresh } from '../../utils/motionLayout'

const props = defineProps<{ items: readonly VisualAsset[]; lang: Lang }>()
const emit = defineEmits<{ open: [item: VisualAsset, trigger: HTMLElement] }>()
const root = ref<HTMLElement | null>(null)
const scrollRegion = ref<HTMLElement | null>(null)
const stage = ref<HTMLElement | null>(null)
// 旧微信内核不认识cqw时，重建文字无法保持原稿比例，直接展示现有完整原图。
const supportsContainerUnits = typeof CSS !== 'undefined' && typeof CSS.supports === 'function' && CSS.supports('font-size', '1cqw')
const highlighted = ref(-1)
const introduced = reactive(new Set<string>())
// 纸张落位后内部文案也须读全；已完成状态不随倒滚清空，避免反复弹出。
const settled = reactive(new Set<string>())
const pageGate = inject(referenceIntroductionGate, ref(true))
const OUTRO_LABEL = { zh: '应用', en: 'In use' }
const OUTRO = { zh: '把技术主题拆成清晰的信息层级，再以文字、色彩和画面连接不同的产品场景', en: 'Technical themes become clear information hierarchies, connected through type, colour and imagery across product scenes' }
const t = computed(() => props.lang === 'zh'
  ? { label: 'V10L 第12至15张海报空间叠层', hint: '滚动展开 · 点击查看完整作品', open: '查看完整作品', choose: '四张完整海报' }
  : { label: 'V10L posters 12 to 15 in depth', hint: 'Scroll to unfold · Click to view the full poster', open: 'View full poster', choose: 'Four complete posters' })
let media: gsap.MatchMedia | undefined
let dead = false
let refreshPresentation = () => {}
let cancelBuild: (() => void) | undefined
let cancelLayoutRefresh: (() => void) | undefined
gsap.registerPlugin(ScrollTrigger)

// 时间线使用相对时标，不是实际秒数或 0–1 进度；整体按可滚行程换算，不用定时器切阶段。
// 有效运动与阅读行程整体延长约四成；侧转在 sticky 释放前轻微启动，末段仍随页面离场。
const shrinkEnd = .90
const entryDuration = .60
const entryStart = (index: number) => .80 + (index - 1) * .30
const readingStart = 2.00
const turnStart = 3.40
const turnDuration = .80
const releaseTime = 3.58
const timelineEnd = 4.20
const finalAngle = -65
const perspectivePx = 2000
const layers = [
  { x: 0, y: 0, scale: 1, order: 1 },
  { x: .229, y: .120, scale: .85, order: 2 },
  { x: -.267, y: .298, scale: .85, order: 3 },
  { x: .06, y: .425, scale: .85, order: 4 },
]
const ratioAt = (i: number) => i ? props.items[i]!.height / props.items[i]!.width : 1 / .787

function compositionBounds() {
  let left = Infinity, right = -Infinity, top = Infinity, bottom = -Infinity
  // 拟合正面阅读构图；退出时的侧转不应反过来压小整个展示。
  props.items.forEach((_item, i) => {
    const layer = layers[i]!
    const hw = layer.scale * 1.02 / 2, hh = hw * ratioAt(i)
    left = Math.min(left, layer.x - hw); right = Math.max(right, layer.x + hw)
    top = Math.min(top, layer.y - hh); bottom = Math.max(bottom, layer.y + hh)
  })
  return { width: right - left, height: bottom - top, x: (left + right) / 2, y: (top + bottom) / 2 }
}

onMounted(async () => {
  await nextTick()
  if (dead || !root.value || !stage.value) return
  cancelBuild = prepareMotionLayout(root.value, () => {
  cancelBuild = undefined
  if (dead || !root.value || !stage.value) return
  media = gsap.matchMedia()
  // 横屏短视口留给完整原稿阅读；条件退出由matchMedia撤销全部空间变换。
  media.add({ motion: '(prefers-reduced-motion: no-preference) and (min-height: 501px)', pointer: '(hover: hover) and (pointer: fine)' }, context => {
    if (!context.conditions!.motion || !supportsContainerUnits) return
    const host = stage.value!
    const wrappers = [...root.value!.querySelectorAll<HTMLElement>('.idc__layer')]
    const planes = [...root.value!.querySelectorAll<HTMLElement>('.idc__perspective')]
    const sheets = [...root.value!.querySelectorAll<HTMLElement>('.idc__sheet')]
    const field = root.value!.querySelector<HTMLElement>('.idc__field')!
    const space = root.value!.querySelector<HTMLElement>('.idc__space')!
    const scene = root.value!.querySelector<HTMLElement>('.idc__scene')!
    const mainImage = root.value!.querySelector<HTMLImageElement>('.idc__main-image')!
    const heading = root.value!.querySelector<HTMLElement>('.idc__heading')!
    const footer = root.value!.querySelector<HTMLElement>('.idc__footer')!
    const mainTitle = root.value!.querySelector<HTMLElement>('.idc__main-title')!
    const mainDescription = root.value!.querySelector<HTMLElement>('.idc__main-description')!
    let warmedArtwork = false, disposed = false
    const warmArtwork = () => {
      if (disposed || warmedArtwork || !host.isConnected) return
      warmedArtwork = true
      // 叠层在屏外时会被浏览器延迟解码；提前准备完整底图，快速滚到阅读态也不能留下空纸面。
      host.querySelectorAll<HTMLImageElement>('.idc__main-image, .iaa img').forEach(image => {
        image.loading = 'eager'
        void image.decode().catch(() => {})
      })
    }
    const artworkWarmObserver = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return
      warmArtwork()
      artworkWarmObserver.disconnect()
    }, { rootMargin: '500px' })
    artworkWarmObserver.observe(host)
    let sheetWidth = 1, centerX = 0, centerY = 0, spaceTop = 0, spaceLeft = 0, releaseScroll = 0
    let hostWidth = 1, hostHeight = 1, sequenceHeight = 1
    let measuredDimensions = ''
    let imageOrigin = { x: 0, y: 0, scale: 1 }
    const typeOrigins = new Map<HTMLElement, { x: number; y: number; scale: number }>()
    function measure() {
      // Snapshot the outer layout before writing the paper widths. GSAP can
      // evaluate x/y/scale separately; those callbacks must use these caches.
      hostWidth = host.clientWidth
      hostHeight = host.clientHeight
      measuredDimensions = `${root.value!.clientWidth}/${root.value!.clientHeight}/${hostHeight}`
      const spaceWidth = space.clientWidth
      const spaceHeight = space.clientHeight
      spaceLeft = space.offsetLeft
      spaceTop = space.offsetTop
      const regionTop = scrollRegion.value!.getBoundingClientRect().top + window.scrollY
      sequenceHeight = scrollRegion.value!.offsetHeight
      const narrow = hostWidth <= 760
      // 源站使用上缘锚点。本项目三张附属稿都是正方形，中心位置按原稿比例换算。
      const anchors = narrow ? [[0, 0], [.135, .11], [-.135, .15], [.03, .21]]
        : [[0, 0], [.229, .120], [-.267, .298], [.06, .425]]
      layers.forEach((layer, i) => { layer.x = anchors[i]![0]!; layer.y = anchors[i]![1]! })
      const bounds = compositionBounds()
      const referenceWidth = hostWidth * (narrow ? .8 : 52 / 144)
      sheetWidth = Math.max(1, Math.min(referenceWidth, (spaceWidth - 40) / bounds.width, (spaceHeight - 28) / bounds.height))
      centerX = spaceWidth / 2 - bounds.x * sheetWidth
      centerY = spaceHeight / 2 - bounds.y * sheetWidth
      releaseScroll = regionTop + sequenceHeight - hostHeight
      const nextLeft = `${centerX}px`, nextTop = `${centerY}px`
      if (scene.style.left !== nextLeft) scene.style.left = nextLeft
      if (scene.style.top !== nextTop) scene.style.top = nextTop
      wrappers.forEach((wrapper, i) => {
        const nextWidth = `${sheetWidth * layers[i]!.scale}px`
        if (wrapper.style.width !== nextWidth) wrapper.style.width = nextWidth
        const nextOrder = String(layers[i]!.order)
        if (wrapper.style.zIndex !== nextOrder) wrapper.style.zIndex = nextOrder
      })
      // Container-relative type needs the new paper width. Read its metrics in
      // one batch here, once per refresh, never between timeline transform writes.
      imageOrigin = imageStart()
      typeOrigins.set(mainTitle, typeStart(mainTitle))
      typeOrigins.set(mainDescription, typeStart(mainDescription, true))
    }
    // 色域只有纯色矩形：用合成变换收拢到主稿边界，避免每帧重绘整屏 clip-path。
    const fieldBounds = () => {
      const layer = layers[0]!
      const x = spaceLeft + centerX + layer.x * sheetWidth
      const y = spaceTop + centerY + layer.y * sheetWidth
      return { x: x - sheetWidth / 2, y: y - sheetWidth * ratioAt(0) / 2,
        scaleX: sheetWidth / hostWidth, scaleY: sheetWidth * ratioAt(0) / hostHeight }
    }
    // 等价于原站的图像 FLIP：起点是色域里的大画面，终点是主海报右下完整原稿
    const imageStart = () => {
      const finalWidth = sheetWidth * .66
      const width = hostWidth <= 760
        ? Math.min(hostWidth - 40, hostHeight * .43)
        : Math.min(hostWidth * .46, hostHeight - 64)
      const first = layers[0]!
      const finalX = spaceLeft + centerX + first.x * sheetWidth - sheetWidth / 2 + sheetWidth * .34
      const finalY = spaceTop + centerY + first.y * sheetWidth + sheetWidth * ratioAt(0) / 2 - finalWidth
      const x = hostWidth <= 760 ? (hostWidth - width) / 2 : hostWidth - 32 - width
      const y = hostWidth <= 760 ? Math.min(hostHeight - width - 24, hostHeight * .51) : 32
      return { x: x - finalX, y: y - finalY, scale: width / finalWidth }
    }
    // 保留同一组产品文字：先在整屏色域中阅读，再迁移到首张的最终排版。
    // 坐标只在测量/刷新时读取，滚动更新不混合布局读取和 transform 写入。
    const typeStart = (node: HTMLElement, description = false) => {
      const first = layers[0]!
      const paperX = spaceLeft + centerX + first.x * sheetWidth - sheetWidth / 2
      const paperY = spaceTop + centerY + first.y * sheetWidth - sheetWidth * ratioAt(0) / 2
      const narrow = hostWidth <= 760
      const availableWidth = narrow ? hostWidth - 40 : hostWidth * .43
      const scale = description ? (narrow ? 1.15 : 1.4)
        : Math.min(availableWidth / Math.max(1, node.offsetWidth), hostHeight * (narrow ? .28 : .44) / Math.max(1, node.offsetHeight))
      const x = narrow ? 20 : hostWidth * .044
      const y = description ? hostHeight * (narrow ? .37 : .68) : hostHeight * (narrow ? .10 : .16)
      return { x: x - paperX - node.offsetLeft, y: y - paperY - node.offsetTop, scale }
    }
    measure()
    let trigger: ScrollTrigger | undefined
    let resetInteraction = () => {}
    let resetImmediately = () => {}
    let previousPointerPhase = 0
    const updatePresentation = () => {
      if (!trigger) return
      if (trigger.isActive) warmArtwork()
      const pointerPhase = timeline.time() < shrinkEnd ? 0 : timeline.time() < readingStart ? 1 : timeline.time() < turnStart ? 2 : 3
      // 保持指针在舞台里倒滚也要归位，相机微移/悬停不能污染色域收缩的边界
      if (pointerPhase < previousPointerPhase || (pointerPhase === 3 && previousPointerPhase !== 3)) resetImmediately()
      previousPointerPhase = pointerPhase
      // 必须先归位交互再退出：快速倒滚越过起点时，不能把悬停位移留在满屏色域里。
      if (!trigger.isActive && trigger.progress === 0) return
      // 根据已知舞台与纸面尺寸计算上缘，不在写入transform后逐张读取布局。
      // 加载幕结束后，每张海报首次进入视口才播放内部标题，回滚只回溯空间位置。
      if (!pageGate.value || settled.size >= props.items.length - 1) return
      const stageTop = Math.min(0, releaseScroll - window.scrollY)
      wrappers.forEach((wrapper, i) => {
        if (!i || settled.has(props.items[i]!.id) || timeline.time() <= entryStart(i)) return
        if (timeline.time() >= entryStart(i) + entryDuration) {
          introduced.add(props.items[i]!.id)
          settled.add(props.items[i]!.id)
          return
        }
        if (introduced.has(props.items[i]!.id)) return
        const center = stageTop + spaceTop + centerY + Number(gsap.getProperty(wrapper, 'y'))
        const halfHeight = sheetWidth * layers[i]!.scale * ratioAt(i) / 2
        if (center - halfHeight < window.innerHeight * .90 && center + halfHeight > 0) introduced.add(props.items[i]!.id)
      })
    }
    refreshPresentation = updatePresentation
    const timeline = gsap.timeline({ paused: true, onUpdate: updatePresentation })
    timeline.addLabel('contract', 0).addLabel('poster', shrinkEnd).addLabel('reading', readingStart)
      .addLabel('release', releaseTime).addLabel('turn', turnStart)
    timeline.fromTo(field, { x: 0, y: 0, scaleX: 1, scaleY: 1, transformOrigin: 'top left' },
      { x: () => fieldBounds().x, y: () => fieldBounds().y, scaleX: () => fieldBounds().scaleX,
        scaleY: () => fieldBounds().scaleY, duration: shrinkEnd, ease: 'power2.inOut' }, 'contract')
    timeline.fromTo(mainImage, { x: () => imageOrigin.x, y: () => imageOrigin.y, scale: () => imageOrigin.scale, transformOrigin: 'top left' },
      { x: 0, y: 0, scale: 1, duration: shrinkEnd, ease: 'power2.inOut' }, 'contract')
    timeline.set(field, { visibility: 'hidden', immediateRender: false }, shrinkEnd)
    for (const node of [mainTitle, mainDescription]) {
      timeline.fromTo(node, { x: () => typeOrigins.get(node)!.x, y: () => typeOrigins.get(node)!.y,
        scale: () => typeOrigins.get(node)!.scale, transformOrigin: 'top left' },
      { x: 0, y: 0, scale: 1, duration: shrinkEnd, ease: 'power2.inOut' }, 'contract')
    }
    timeline.fromTo(heading, { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: .25, ease: 'power3.out' }, shrinkEnd - .15)
    timeline.fromTo(footer, { color: '#ffffff' }, { color: '#29251f', duration: .12, ease: 'none' }, .04)
    wrappers.forEach((wrapper, i) => {
      const layer = layers[i]!
      timeline.set(wrapper, { xPercent: -50, yPercent: -50, x: () => layer.x * sheetWidth,
        y: () => layer.y * sheetWidth + (i ? hostHeight + sheetWidth * layer.scale * ratioAt(i) / 2 : 0), immediateRender: true }, 0)
      if (i) timeline.to(wrapper, { y: () => layer.y * sheetWidth, duration: entryDuration, ease: 'sine.inOut' }, entryStart(i))
      // 原站只旋转纸面，保持叠层锚点。额外横向散开会把海报分离成几条窄板。
      timeline.fromTo(planes[i]!, { transformPerspective: perspectivePx, rotationY: 0 },
        { transformPerspective: perspectivePx, rotationY: finalAngle, duration: turnDuration, ease: 'power1.inOut' }, 'turn')
    })
    // 海报使用平滑离场；舞台外的介绍只跟随文档滚动，不叠加会反向追赶的scrub位移。
    // 介绍按自己的真实位置揭示一次，舞台释放前后保持相同的滚动速度。
    // 原站的侧转发生在离场：阅读时保持正面；65°不能作为居中停留的展示角度。
    trigger = ScrollTrigger.create({ trigger: scrollRegion.value!, animation: timeline, start: 'top top',
      end: () => `+=${(sequenceHeight - hostHeight) * timelineEnd / releaseTime}`, scrub: true,
      invalidateOnRefresh: true, onRefreshInit: measure, onToggle: self => { if (!self.isActive) resetInteraction() } })
    // 刷新恢复在段落末尾时，create可能已把进度放到1；不能依赖之后还有一次滚动回调
    updatePresentation()
    const listeners: Array<() => void> = []
    const pointerTweens: gsap.core.Tween[] = []
    if (context.conditions!.pointer) {
      const cameraX = gsap.quickTo(scene, 'x', { duration: .32, ease: 'power2.out' })
      const cameraY = gsap.quickTo(scene, 'y', { duration: .32, ease: 'power2.out' })
      const lift = sheets.map(sheet => ({ y: gsap.quickTo(sheet, 'y', { duration: .28, ease: 'power2.out' }),
        scaleX: gsap.quickTo(sheet, 'scaleX', { duration: .28, ease: 'power2.out' }), scaleY: gsap.quickTo(sheet, 'scaleY', { duration: .28, ease: 'power2.out' }) }))
      pointerTweens.push(cameraX.tween, cameraY.tween, ...lift.flatMap(value => [value.y.tween, value.scaleX.tween, value.scaleY.tween]))
      const highlight = (index: number) => {
        if (index >= 0 && (!trigger?.isActive || timeline.time() < shrinkEnd || timeline.time() >= turnStart)) return
        highlighted.value = index
        lift.forEach((value, i) => { value.y(i === index ? -6 : 0); value.scaleX(i === index ? 1.02 : 1); value.scaleY(i === index ? 1.02 : 1) })
      }
      resetImmediately = () => {
        // 不调用 quickTo：它会从缓存的旧起点重启，即使刚 set(0) 也会写回几帧偏移。
        // onUpdate、onToggle、pointerleave 的触发顺序不固定，同步归位必须可重复调用。
        pointerTweens.forEach(tween => tween.pause())
        highlighted.value = -1
        gsap.set(scene, { x: 0, y: 0 })
        gsap.set(sheets, { y: 0, scaleX: 1, scaleY: 1 })
      }
      resetInteraction = () => {
        if (!trigger?.isActive || timeline.time() < readingStart || timeline.time() >= turnStart) {
          resetImmediately()
          return
        }
        cameraX(0); cameraY(0); highlight(-1)
      }
      const move = (event: PointerEvent) => {
        // 收色域时不能移动主画，否则裁切边界和主海报不重合
        if (!trigger?.isActive || event.pointerType === 'touch' || timeline.time() < readingStart || timeline.time() >= turnStart) return
        cameraX(gsap.utils.clamp(-1, 1, event.clientX / hostWidth * 2 - 1) * 6)
        cameraY(gsap.utils.clamp(-1, 1, event.clientY / hostHeight * 2 - 1) * 4)
      }
      host.addEventListener('pointermove', move, { passive: true }); host.addEventListener('pointerleave', resetInteraction)
      listeners.push(() => { host.removeEventListener('pointermove', move); host.removeEventListener('pointerleave', resetInteraction) })
      const nav = [...root.value!.querySelectorAll<HTMLButtonElement>('.idc__nav button')]
      planes.forEach((plane, i) => {
        for (const target of [plane, nav[i]!]) {
          const enter = () => highlight(i), leave = () => highlight(-1)
          target.addEventListener('pointerenter', enter); target.addEventListener('pointerleave', leave); target.addEventListener('focus', enter); target.addEventListener('blur', leave)
          listeners.push(() => { target.removeEventListener('pointerenter', enter); target.removeEventListener('pointerleave', leave); target.removeEventListener('focus', enter); target.removeEventListener('blur', leave) })
        }
      })
    }
    let cancelResize: (() => void) | undefined
    const dimensions = () => `${root.value!.clientWidth}/${root.value!.clientHeight}/${host.clientHeight}`
    let previousDimensions = measuredDimensions
    const resize = new ResizeObserver(() => {
      if (cancelResize || !root.value) return
      cancelResize = prepareMotionLayout(root.value, () => {
        cancelResize = undefined
        if (dead || !root.value) return
        const nextDimensions = dimensions()
        if (nextDimensions === previousDimensions) return
        previousDimensions = nextDimensions
        trigger?.refresh()
      })
    })
    resize.observe(root.value!); resize.observe(host)
    return () => {
      disposed = true
      trigger = undefined
      refreshPresentation = () => {}
      listeners.forEach(remove => remove()); pointerTweens.forEach(tween => tween.kill()); highlighted.value = -1
      artworkWarmObserver.disconnect(); resize.disconnect(); cancelResize?.(); scene.style.removeProperty('left'); scene.style.removeProperty('top')
      wrappers.forEach(wrapper => { wrapper.style.removeProperty('width'); wrapper.style.removeProperty('z-index') })
    }
  }, root.value)
  })
})
watch(() => props.lang, async () => {
  await nextTick()
  if (dead) return
  cancelLayoutRefresh?.()
  cancelLayoutRefresh = requestMotionLayoutRefresh()
})
watch(pageGate, active => { if (active) refreshPresentation() }, { flush: 'post' })
onBeforeUnmount(() => { dead = true; cancelBuild?.(); cancelLayoutRefresh?.(); media?.revert() })
</script>

<style scoped>
.idc { --idc-paper:#171717; --idc-type:#ffd22d; position:relative; margin-inline:calc(clamp(20px,4.4vw,80px) * -1); margin-bottom:clamp(80px,15vh,180px); background:var(--ab-bg); color:var(--ab-ink); }
.idc__sequence { position:relative; height:calc(var(--stable-viewport-height,100vh) * 6.6); }
.idc__stage { position:sticky; top:0; height:var(--stable-viewport-height,100vh); overflow:clip; }
.idc__field { position:absolute; inset:0; background:var(--idc-paper); }
.idc__heading { position:absolute; top:84px; left:4.4vw; right:4.4vw; z-index:6; pointer-events:none; }
.idc__heading > span { font-size:10px; letter-spacing:.14em; color:var(--ab-soft); }
.idc__heading h4 { margin:8px 0 0; font-size:clamp(18px,1.8vw,26px); font-weight:500; letter-spacing:-.025em; }
.idc__heading h4 span { display:block; margin-top:4px; font-size:.5em; letter-spacing:0; }
.idc__space { position:absolute; inset:24px 0 70px; pointer-events:none; }
.idc__departure { position:absolute; inset:0; will-change:transform; }
.idc__scene { position:absolute; left:50%; top:50%; width:0; height:0; }
.idc__layer { position:absolute; left:0; top:0; width:min(38vw,440px); will-change:transform; }
.idc__perspective { position:relative; display:block; width:100%; padding:0; border:0; background:transparent; color:inherit; cursor:pointer; pointer-events:auto; backface-visibility:hidden; will-change:transform; }
.idc__sheet { position:relative; display:block; width:100%; pointer-events:none; will-change:transform; }
.idc__main-poster { position:relative; width:100%; aspect-ratio:.787; background:var(--idc-paper); color:var(--idc-type); container-type:inline-size; text-align:left; }
.idc__main-title { position:absolute; left:6%; top:5%; right:6%; will-change:transform; }
.idc__brand { display:block; margin-bottom:3cqw; font-size:2.7cqw; font-weight:500; letter-spacing:.05em; color:#fff; }
.idc__headline { display:block; font-size:14.5cqw; font-weight:500; line-height:.95; letter-spacing:-.045em; }
.idc__headline-zh { display:block; margin-top:2cqw; font-size:8.5cqw; line-height:1; letter-spacing:-.03em; }
.idc__main-description { position:absolute; left:6%; bottom:5%; width:24%; display:grid; gap:3cqw; font-size:3.2cqw; line-height:1.3; color:#fff; will-change:transform; }
.idc__main-description span { display:block; }
.idc__main-image { position:absolute; bottom:0; right:0; display:block; width:66%; height:auto; aspect-ratio:1; object-fit:contain; }
.idc__static-title { display:none; }
.idc__footer { position:absolute; bottom:20px; left:4.4vw; right:4.4vw; display:flex; justify-content:space-between; gap:24px; align-items:center; z-index:6; color:var(--ab-ink); }
.idc__footer > span { font-size:10px; }
.idc__nav { display:flex; gap:8px; }
.idc__nav button { min-width:44px; min-height:44px; padding:4px; border:0; background:transparent; color:inherit; font-size:11px; cursor:pointer; text-underline-offset:6px; }
.idc__nav button:hover,.idc__nav button.is-highlighted { text-decoration:underline; }
.idc button:focus-visible { outline:2px solid currentColor; outline-offset:5px; }
.idc__outro { position:relative; width:auto; margin:clamp(36px,7vh,84px) 4.4vw 0 34%; }
@media(max-width:760px) {
 .idc__space { inset:100px 0 112px; }
 .idc__heading { top:72px; left:20px; right:20px; }
 .idc__footer { left:20px; right:20px; flex-wrap:wrap; gap:12px; }
 .idc__outro { margin:48px 20px 0; }
}
@media(prefers-reduced-motion:reduce),(max-height:500px) {
 .idc { height:auto; }
 .idc__sequence { height:auto; }
 .idc__stage { height:auto; position:relative; padding:24px clamp(20px,4.4vw,80px) 40px; overflow:visible; }
 .idc__field { display:none; }
 .idc__heading { position:static; margin-bottom:32px; }
 .idc__space { position:relative; inset:auto; }
 .idc__departure { position:relative; inset:auto; will-change:auto; }
 .idc__scene { position:relative; top:auto; left:auto; width:auto; height:auto; display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:32px; align-items:start; }
 .idc__layer { position:relative; top:auto; left:auto; width:100%; will-change:auto; }
 .idc__perspective,.idc__sheet,.idc__main-title,.idc__main-description { will-change:auto; }
 .idc__static-title { display:block; padding-top:14px; text-align:left; font-size:14px; }
 .idc__footer { display:none; }
 .idc__outro { position:relative; inset:auto; width:auto; margin:56px clamp(20px,4.4vw,80px) 0; }
}
@media(prefers-reduced-motion:reduce) and (max-width:760px),(max-height:500px) and (max-width:760px) { .idc__scene { grid-template-columns:1fr; } }
/* 这条能力回退不依赖媒体查询；横竖屏仍正常重排，且不会安装空间时间线。 */
.idc--fallback .idc__sequence { height:auto; }
.idc--fallback .idc__stage { height:auto; position:relative; padding:24px clamp(20px,4.4vw,80px) 40px; overflow:visible; }
.idc--fallback .idc__field { display:none; }
.idc--fallback .idc__heading { position:static; margin-bottom:32px; }
.idc--fallback .idc__space,.idc--fallback .idc__departure { position:relative; inset:auto; }
.idc--fallback .idc__departure { will-change:auto; }
.idc--fallback .idc__scene { position:relative; top:auto; left:auto; width:auto; height:auto; display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:32px; align-items:start; }
.idc--fallback .idc__layer { position:relative; top:auto; left:auto; width:100%; will-change:auto; }
.idc--fallback .idc__perspective,.idc--fallback .idc__sheet { will-change:auto; }
.idc--fallback .idc__main-image { position:static; width:100%; height:auto; aspect-ratio:auto; }
.idc--fallback .idc__static-title { display:block; padding-top:14px; text-align:left; font-size:14px; }
.idc--fallback .idc__footer { display:none; }
.idc--fallback .idc__outro { width:auto; margin:56px clamp(20px,4.4vw,80px) 0; }
@media(max-width:760px) { .idc--fallback .idc__scene { grid-template-columns:1fr; } }
</style>
