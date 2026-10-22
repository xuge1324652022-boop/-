<template>
  <section ref="root" class="ps" :class="{ 'is-static': staticMode }" :aria-label="lang === 'zh' ? '颜色的章节' : 'Stories in colour'">
    <div ref="stage" class="ps__stage">
      <article v-for="(set, group) in sets" :key="set.id" class="ps__chapter"
        :style="{ background: set.palette.background, color: set.palette.foreground, '--chapter-base': set.palette.background, '--chapter-accent': set.palette.accent }">
        <!-- 同色系渐变只作用于背景；横竖展示窗等高拼接，点击查看器看完整照片。 -->
        <div class="ps__backdrop" aria-hidden="true" />
        <div class="ps__heading">
          <p>COLOUR STUDY / {{ String(group + 1).padStart(2, '0') }}</p>
          <h2>{{ pick(set.name, lang) }}</h2>
          <p>{{ pick(set.description, lang) }}</p>
        </div>
        <!-- `--lane-sum`（两列比例之和）与 `--lane-ratio`（单列比例）都来自 JS，见 script 里 `laneRatios`。 -->
        <div class="ps__window" :style="{ '--lane-sum': laneSums[group] }">
          <div v-for="(lane, column) in lanes[group]" v-show="lane.length" :key="column"
            class="ps__column" :class="column === 0 ? 'is-wide' : 'is-tall'"
            :style="{ '--lane-ratio': laneRatios[group]![column] }">
            <div class="ps__lane">
            <div v-for="(item, i) in lane" :key="item.id" class="ps__slot">
              <!-- 照片原位叠放，只移动裁切边界；新图覆盖旧图，不移动整条图片轨道。 -->
              <figure class="ps__card">
                <button class="ps__photo" :class="{ 'ps__photo--collage': item.id === 'annual-review-2025' }" type="button" :data-cursor="lang === 'zh' ? '查看' : 'Explore'" data-cursor-action="view" :tabindex="staticMode || (group === active && i === Math.min(photoIndices[group] ?? 0, lane.length - 1)) ? 0 : -1"
                  :aria-label="`${lang === 'zh' ? '查看完整照片' : 'View photograph'}: ${pick(item.title, lang)}`"
                  @click="emit('open', item, $event.currentTarget as HTMLElement)">
                  <!--
                    高清：三档都给，浏览器按「框的实际宽度 × 屏幕像素比」自己挑。
                    横列的框在宽屏上能到 ~1000px，只给 1600 档会被放大发虚。
                  -->
                  <img :src="item.src" :srcset="visualImageSources(item)" :sizes="IMAGE_SIZES" :width="item.width" :height="item.height" :alt="pick(item.alt, lang)" :loading="group < 2 ? 'eager' : 'lazy'" decoding="async" draggable="false" />
                </button>
                <figcaption v-if="staticMode">{{ pick(item.title, lang) }}</figcaption>
              </figure>
            </div>
            </div>
            <!-- 名称位于裁切窗口之外，换图时跟随当前照片，不参与遮罩覆盖。 -->
            <p v-if="!staticMode && lane.length" class="ps__caption">{{ pick(lane[Math.min(photoIndices[group] ?? 0, lane.length - 1)]!.title, lang) }}</p>
          </div>
        </div>
        <footer class="ps__footer" :inert="!staticMode && group !== active" :aria-hidden="!staticMode && group !== active">
          <span>{{ lang === 'zh' ? '向下滚动，循色而行' : 'Scroll to follow the colour' }} ↓</span>
          <div class="ps__controls">
            <button v-if="dirty" type="button" @click="reset">{{ lang === 'zh' ? '恢复排布' : 'Restore layout' }}</button>
            <button v-if="!staticMode" class="ps__direction" type="button" :disabled="group === 0 && photoIndices[group] === 0" :aria-label="lang === 'zh' ? '上一张' : 'Previous photograph'" @click="move(-1)">↑</button>
            <span>{{ String(staticMode ? steps[group] : (photoIndices[group] ?? 0) + 1).padStart(2, '0') }} / {{ String(steps[group]).padStart(2, '0') }}</span>
            <button v-if="!staticMode" class="ps__direction" type="button" :aria-label="lang === 'zh' ? '下一张' : 'Next photograph'" @click="move(1)">↓</button>
          </div>
        </footer>
        <div class="ps__progress" aria-hidden="true"><i /></div>
      </article>
    </div>
  </section>
</template>

<script setup lang="ts">
import { visualImageSources } from '../../utils/responsiveImage'
/**
 * 摄影章节：每章按横/竖构图分为等高窗口，同一滚动位置同时推进两列和章节遮罩。
 * 槽位负责裁切，照片卡片的 transform 留给 usePhotoDrag；查看时上报真实素材。
 * 非当前章与图使用 inert/aria-hidden，减少动态则回退到全量可读的普通照片流。
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { pick, type Lang } from '../../data/aboutProfile'
import type { PhotoSet } from '../../data/photoPage'
import type { VisualAsset } from '../../data/visualPortfolio'
import { usePhotoDrag } from '../../composables/usePhotoDrag'
import { chapterSchedule, unit } from '../../utils/photoStory'
const props = defineProps<{ sets: readonly PhotoSet[]; lang: Lang }>()
const emit = defineEmits<{ open: [item: VisualAsset, trigger: HTMLElement] }>()
/**
 * `sizes` 必须描述**框的真实宽度**，否则浏览器挑档会挑错（挑小了发虚、挑大了白下载）。
 * 横列的框最宽（宽屏约 1000px ≈ 55vw），`sizes` 取它；竖列框窄，多下载一点不影响清晰。
 * 手机：两列上下叠放，框接近满屏宽。
 */
const IMAGE_SIZES = '(max-width: 760px) 92vw, 55vw'
// 先保留色彩分组，再按真实宽高分列；横竖图各占一列，列内原位叠放，不复制照片填空。
const lanes = computed(() => props.sets.map(set => [set.items.filter(item => item.width >= item.height), set.items.filter(item => item.width < item.height)]))
const steps = computed(() => lanes.value.map(pair => Math.max(...pair.map(lane => lane.length))))
/**
 * 固定画幅 `[横图 3:2, 竖图 2:3]`，各章和各张切换都使用相同窗口。
 * 原图比例不同的横图等比铺满窗口，避免 contain 留边造成拼接处露出底色。
 * 完整构图保留在查看器与普通画廊里；空列记 0，不占拼接宽度。
 */
const laneRatios = computed(() =>
  lanes.value.map(([wide, tall]) => [wide!.length ? 3 / 2 : 0, tall!.length ? 2 / 3 : 0]),
)
/**
 * 该章两列比例之和。把「两列并排、总宽不溢出」换算成**同一个**框高上限：
 * `--frame-h` 的横向约束 = (可用宽 − gap) / `--lane-sum`，两列因此得到相同框高，版面才齐。
 * 两列都空不可能（`assertPhotoSets()` 保证每章非空），兜底给 1 防止除零。
 */
const laneSums = computed(() => laneRatios.value.map(([wide, tall]) => ((wide || 0) + (tall || 0)) || 1))
const root = ref<HTMLElement | null>(null)
const stage = ref<HTMLElement | null>(null)
const active = ref(0)
const photoIndices = ref(props.sets.map(() => 0))
const media = window.matchMedia('(prefers-reduced-motion: reduce)')
const staticMode = ref(media.matches)
const { dirty, reset, attach, detach } = usePhotoDrag(() => root.value, '.ps__card')
/** 文档滚动已有统一阻尼，此处只合并同帧更新，不再叠加独立的追赶时间常数。 */
let raf = 0, origin = 0, stride = 1
let dead = false
let observer: ResizeObserver | undefined
let schedule: ReturnType<typeof chapterSchedule> = []
let chapters: HTMLElement[] = []
let bars: HTMLElement[] = []
let slots: HTMLElement[][][] = []
/** 上一帧各章写过的读数，用来跳过「这一帧没变」的章（见 `render()`）。 */
let lastCurtain: number[] = []
let lastPosition: number[] = []
let lastVisible: boolean[] = []
function measure() {
  if (dead || !root.value || !stage.value || staticMode.value) return
  const height = stage.value.clientHeight
  stride = Math.max(260, height * .48) // 原先每张至少 600px；现在同一次滚动推进两列。
  origin = root.value.getBoundingClientRect().top + window.scrollY
  chapters = [...root.value.querySelectorAll<HTMLElement>('.ps__chapter')]
  bars = chapters.map(chapter => chapter.querySelector<HTMLElement>('.ps__progress i')!)
  slots = chapters.map(chapter => [...chapter.querySelectorAll<HTMLElement>('.ps__lane')].map(lane => [...lane.querySelectorAll<HTMLElement>('.ps__slot')]))
  schedule = chapterSchedule(steps.value.map(count => Math.max(0, count - 1) * stride), height * .65)
  root.value.style.height = `${height + (schedule[schedule.length - 1]?.finish ?? 0)}px`
  // 布局变了 ⇒ 上一帧的读数全部作废，否则「这一帧没变」的判断会把新布局的第一帧吞掉。
  lastCurtain = []; lastPosition = []; lastVisible = []
  cancelAnimationFrame(raf); render()
}
/**
 * 逐帧推进。只读 `scrollY`，只写各章的 `clip-path` / `visibility` 与进度条。
 *
 * ⚠️ 每帧只写**读数真的变了**的那一章（比对 `lastCurtain` / `lastPosition`）：
 *    5 章 × 二十几个槽位全写一遍是每帧上百次样式写入，而绝大多数帧里只有当前章在动
 *    —— 其余章要么已经揭完、要么还压在下面，读数一模一样。跳过它们画面完全不变。
 * ⚠️ 筛的是「值有没有变」而**不是**「是不是当前章」：滚动推进时当前章每帧都在变，
 *    换章那一刻新旧两章也会同时变，按「当前章」筛会漏掉正在收尾的那一章。
 */
function render() {
  raf = 0
  if (dead || staticMode.value || !schedule.length) return
  // 页面已统一平滑；章节使用实际位置，避免交接时再追赶一次。
  const y = window.scrollY - origin
  let selected = 0
  schedule.forEach((time, group) => {
    const curtain = group === 0 ? 1 : unit((y - time.enter) / time.wipe)
    if (curtain >= .5) selected = group
    const position = Math.max(0, Math.min(steps.value[group]! - 1, (y - time.start) / stride))
    const next = schedule[group + 1]
    const visible = curtain > 0 && (!next || y < next.enter + next.wipe)
    if (curtain === lastCurtain[group] && position === lastPosition[group] && visible === lastVisible[group]) return
    lastCurtain[group] = curtain
    lastPosition[group] = position
    lastVisible[group] = visible

    const chapter = chapters[group]!
    chapter.style.clipPath = `inset(${(1 - curtain) * 100}% 0 0)`
    // 完全压住（或还没轮到）的章不参与绘制：5 章 × 二十几张图同时绘制会掉帧。
    // 遮罩决定可见区域的触摸命中；不按中点inert，避免新图可见处穿透到旧图。
    // 已被下一章盖满的旧章同时离开无障碍树，键盘入口仍由active与tabindex管理。
    chapter.style.visibility = visible ? 'visible' : 'hidden'

    const index = Math.round(position)
    if (photoIndices.value[group] !== index) photoIndices.value[group] = index
    slots[group]!.forEach((lane, column) => {
      // 左列从底部向上揭开，右列从顶部向下揭开。旧图不退出，留在新图后面。
      // 较短一列停留在末张；同一进度反向滚动时自然还原，不启动独立的补间动画。
      // ⚠️ 这里**不**清 `transform`：拖动只写 `.ps__card`（见 `usePhotoDrag`），
      //    `.ps__slot` 从来没有人写过 transform，清它是空操作。
      const local = Math.min(position, Math.max(0, lane.length - 1))
      lane.forEach((slot, i) => {
        const reveal = i === 0 ? 1 : unit(local - i + 1)
        const hidden = (1 - reveal) * 100
        slot.style.clipPath = column === 0 ? `inset(${hidden}% 0 0)` : `inset(0 0 ${hidden}%)`
        // 只保留当前底图与正在揭开的新图，避免几十张大图同时参与绘制。
        // 子层显式visible会覆盖父级visibility:hidden，整章盖满时须同时隐藏照片槽。
        slot.style.visibility = visible && reveal > 0 && i >= Math.floor(local) ? 'visible' : 'hidden'
      })
    })
    bars[group]!.style.transform = `scaleX(${steps.value[group]! > 1 ? position / (steps.value[group]! - 1) : 1})`
  })
  if (active.value !== selected) active.value = selected
}
function scroll() { if (!raf && !staticMode.value) raf = requestAnimationFrame(render) }
function move(direction: number) {
  const group = active.value
  const next = (photoIndices.value[group] ?? 0) + direction
  const destination = next < 0 ? schedule[Math.max(0, group - 1)]!.end : next >= steps.value[group]! ? schedule[group + 1]?.start ?? schedule[group]!.finish + stage.value!.clientHeight : schedule[group]!.start + next * stride
  window.scrollTo({ top: origin + destination, behavior: 'smooth' })
}
async function configure() {
  detach(); cancelAnimationFrame(raf); raf = 0
  staticMode.value = media.matches
  await nextTick()
  if (dead || !root.value) return
  if (staticMode.value) {
    root.value.style.removeProperty('height')
    root.value.querySelectorAll<HTMLElement>('.ps__chapter,.ps__slot,.ps__progress i').forEach(el => { el.style.removeProperty('clip-path'); el.style.removeProperty('transform'); el.style.removeProperty('visibility') })
  } else measure()
  attach()
}
onMounted(() => {
  void configure(); observer = new ResizeObserver(measure)
  if (stage.value) observer.observe(stage.value)
  void document.fonts.ready.then(() => { if (!dead) measure() })
  window.addEventListener('scroll', scroll, { passive: true }); window.addEventListener('resize', measure); media.addEventListener('change', configure)
})
watch(() => props.lang, () => void nextTick(measure))
onBeforeUnmount(() => {
  dead = true; observer?.disconnect(); cancelAnimationFrame(raf); detach()
  window.removeEventListener('scroll', scroll); window.removeEventListener('resize', measure); media.removeEventListener('change', configure)
})
</script>
<style scoped>
.ps { position:relative; width:100%; }
/* 舞台与展示框使用同一高度口径，包含小屏幕的最小高度。 */
.ps__stage { --stage-h:max(var(--stable-viewport-height,100vh),480px); position:sticky; top:0; height:var(--stable-viewport-height,100vh); min-height:480px; isolation:isolate; }
.ps__chapter { position:absolute; inset:0; overflow:hidden; }
.ps__chapter:not(:first-child) { clip-path:inset(100% 0 0); }
.ps__backdrop { position:absolute; inset:0; pointer-events:none; background:radial-gradient(ellipse at 78% 28%,#ffffff15,transparent 70%),linear-gradient(145deg,var(--chapter-base) 12%,color-mix(in srgb,var(--chapter-base) 84%,var(--chapter-accent)) 100%); }
.ps__heading { position:absolute; top:80px; left:4.4vw; right:4.4vw; display:grid; grid-template-columns:1fr 1fr; align-items:end; gap:8px; }
.ps__heading p { margin:0; font-size:12px; }
.ps__heading p:first-child { grid-column:1/-1; font-size:10px; letter-spacing:.1em; }
.ps__heading p:last-child { text-align:right; }
.ps__heading h2 { margin:0; font-size:clamp(30px,4vw,58px); font-weight:500; }
/*
 * 展示窗：两列**并排**（左列横图 / 右列竖图），整体在窗口里水平垂直居中。
 *
 * 两列共用一个框高；列宽由固定横竖画幅决定，边缘无缝相接。
 * `--ps-pad` 只保留照片群外侧留白，`--ps-gap` 为 0。
 * ⚠️ `--ps-top` / `--ps-bottom` 也只在这里写一次，`--ps-inset` 由它们算出来。
 *    下面 `.ps__lane` 要靠 `--ps-inset` 反推框高 —— top/bottom 改了算式没跟着改，
 *    框高会算到屏幕外面去。
 */
.ps__window { --ps-top:185px; --ps-bottom:90px; --ps-inset:calc(var(--ps-top) + var(--ps-bottom));
  --ps-pad:clamp(28px,7vw,150px); --ps-gap:0px;
  position:absolute; inset:var(--ps-top) var(--ps-pad) var(--ps-bottom);
  display:flex; align-items:center; justify-content:center; gap:var(--ps-gap); }
/*
 * 单列框：宽 = 高 × `--lane-ratio`，高取两个约束里小的 ——
 *   ① 纵向：(舞台高 − 上下留白) × `--ps-shrink`，画幅整体再收一档（0.62 ⇒ 照片群偏小、留白多）；
 *   ② 横向：(可用宽 − gap) / `--lane-sum`，`--lane-sum` 是两列比例之和 ⇒ 两列框高一致。
 * ⚠️ 不能写成 `aspect-ratio`：宽被 flex 定死之后 `max-height` 一夹比例就破（实测 690×360）。
 */
.ps__column { --lane-ratio:1.5; --ps-shrink:.62;
  --frame-h:min(
    calc((var(--stage-h) - var(--ps-inset)) * var(--ps-shrink)),
    calc((100vw - 2 * var(--ps-pad) - var(--ps-gap)) / var(--lane-sum))
  );
  position:relative; flex:0 0 auto;
  height:var(--frame-h); width:calc(var(--frame-h) * var(--lane-ratio)); }
.ps__lane { position:relative; width:100%; height:100%; overflow:hidden; }
.ps__slot { position:absolute; inset:0; background:var(--chapter-base); }
.ps__slot:not(:first-child) { visibility:hidden; }
.ps__card { margin:0; width:100%; height:100%; touch-action:pan-y pinch-zoom; user-select:none; }
.ps__photo { display:block; height:100%; width:100%; padding:0; border:0; background:none; cursor:grab; color:inherit; }
/* 横图维持原有满幅裁切；只有年度拼图在原固定窗口内保留完整内容。 */
.ps__column.is-wide .ps__photo:not(.ps__photo--collage) img { object-fit:cover; }
.ps__photo img { width:100%; height:100%; object-fit:contain; object-position:center; display:block; pointer-events:none; }
/* 名称放在图片外，左列靠左、右列靠右；不加底色标签遮挡照片。 */
.ps__caption { position:absolute; top:100%; left:0; right:0; margin:0; padding-top:12px; font-size:11px; line-height:1.5; pointer-events:none; }
.ps__column.is-tall .ps__caption { text-align:right; }
.ps__card figcaption { margin-top:12px; font-size:11px; line-height:1.5; }
.ps__column.is-tall .ps__card figcaption { text-align:right; }
.ps__photo:focus-visible { outline:2px solid currentColor; outline-offset:-3px; }
.ps__footer { position:absolute; bottom:28px; left:4.4vw; right:4.4vw; display:flex; justify-content:space-between; align-items:center; gap:12px; font-size:11px; }
.ps__controls { display:flex; align-items:center; gap:16px; }
/* 用内边距补回旧边框占位，保留点击范围；裸箭头像全局光标一样随背景反差变色。 */
.ps__controls button { appearance:none; border:0; border-radius:0; background:transparent; color:inherit; padding:10px 14px; cursor:pointer; }
.ps__controls .ps__direction { color:#fff; mix-blend-mode:difference; }
.ps__controls button:focus-visible { outline:2px solid currentColor; outline-offset:3px; }
.ps__controls button:disabled { opacity:.3; cursor:default; }
.ps__progress { position:absolute; bottom:0; width:100%; height:3px; background:#8883; }
.ps__progress i { display:block; height:100%; background:currentColor; transform:scaleX(0); transform-origin:left; }
.is-static .ps__stage { position:static; height:auto; }
.is-static .ps__chapter { position:relative; padding:80px 5vw 40px; clip-path:none; }
.is-static .ps__heading,.is-static .ps__window,.is-static .ps__footer { position:relative; inset:auto; }
.is-static .ps__heading { margin-bottom:30px; }
/* 减少动态：两列改回普通文档流，照片按各自原比例完整显示。 */
.is-static .ps__window { flex-direction:column; align-items:stretch; gap:32px; }
.is-static .ps__column { height:auto; width:auto; }
.is-static .ps__lane { display:grid; gap:24px; height:auto; width:auto; overflow:visible; }
.is-static .ps__slot { position:relative; visibility:visible; }
.is-static .ps__card figcaption { position:static; }
.is-static .ps__photo { height:auto; }
.is-static .ps__photo img { height:auto; }
.is-static .ps__footer { margin-top:24px; }
.is-static .ps__progress { display:none; }
@media(max-width:760px) {
 .ps__heading { top:72px; }
 .ps__heading p:last-child { font-size:10px; }
 /* 手机上两列并排每框只剩 ~190px 宽 ⇒ 改成上下叠放；框仍按各自比例，边距留足。 */
 .ps__window { --ps-top:155px; --ps-bottom:100px; --ps-pad:clamp(24px,6vw,44px); flex-direction:column; }
 .ps__column { margin-bottom:32px; --frame-h:min(
    calc((var(--stage-h) - var(--ps-inset) - var(--ps-gap) - 64px) / 2),
    calc((100vw - 2 * var(--ps-pad)) / var(--lane-ratio))
  ); }
 .ps__controls { gap:8px; }
 .ps__footer { flex-wrap:wrap; }
}
@media(max-height:550px) {
 /* 手机横屏的可见高度可能小于480px；舞台不能把页脚固定在屏幕外。 */
 .ps__stage { --stage-h:var(--stable-viewport-height,100vh); min-height:0; }
 .ps__heading { top:60px; } .ps__heading h2 { font-size:28px; }
 .ps__window { --ps-top:125px; --ps-bottom:65px; } .ps__footer { bottom:12px; }
}
@media(max-height:550px) and (orientation:landscape) {
 /* 横屏保留等高的横竖双窗，避免套用窄屏上下排布后每幅只剩几十像素。 */
 .ps__window { flex-direction:row; }
 .ps__column { margin-bottom:0; --frame-h:min(
   calc((var(--stage-h) - var(--ps-inset)) * .85),
   calc((100vw - 2 * var(--ps-pad) - var(--ps-gap)) / var(--lane-sum))
 ); }
}
</style>
