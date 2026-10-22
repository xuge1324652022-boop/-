<template>
  <section id="profile" ref="root" class="pi" aria-labelledby="profile-name">
    <div ref="sequence" class="pi__sequence">
      <div ref="stage" class="pi__stage">
        <header class="pi__identity" :inert="!identityReady" :aria-hidden="!identityReady"><div ref="identityContent">
          <p class="pi__eyebrow">关于我 <span lang="en">/ About me</span></p>
          <h2 id="profile-name">{{ IDENTITY.nameZh }}<span lang="en">{{ IDENTITY.nameEn }}</span></h2>
          <p class="pi__role">{{ pick(ROLE_LINE, 'zh') }}<span lang="en">{{ pick(ROLE_LINE, 'en') }}</span></p>
          <p class="pi__tagline">{{ pick(TAGLINE, 'zh') }}<span lang="en">{{ pick(TAGLINE, 'en') }}</span></p>
          <a class="pi__explore" href="#ai-workflow" :tabindex="identityReady ? 0 : -1"><span>探索我的创作过程<span lang="en">Explore my creative process</span></span><span aria-hidden="true">↓</span></a>
        </div></header>
        <div class="pi__visual">
          <div ref="canvas" class="pi__canvas">
            <img ref="portrait" class="pi__portrait" :src="portraitSources.src" :srcset="visualImageSources(portraitSources)" sizes="(max-width: 760px) calc(100vw - 40px), min(90vw, 1080px)" width="1448" height="1086"
              :alt="lang === 'zh' ? '用于演示收框动画的几何占位图' : 'Geometric placeholder for the frame animation'" decoding="async" fetchpriority="high" />
          </div>
          <div ref="target" class="pi__target" role="group" :aria-label="lang === 'zh' ? '探索 AI 工具协作方式' : 'Explore my AI tools'" :inert="!interactive" :aria-hidden="!interactive">
            <div v-for="(tool, i) in AI_TOOLS" :key="tool.id" class="pi__tool-slot" :style="toolPosition(i)">
              <div class="pi__tool-pop">
                <button class="pi__tool" :class="{ 'is-selected': activeTool === tool.id, 'is-chatgpt': tool.id === 'chatgpt' }"
                  type="button" :disabled="!interactive" :aria-pressed="activeTool === tool.id"
                  :aria-label="`${tool.name}：${lang === 'zh' ? tool.roleZh : tool.roleEn}`"
                  aria-controls="ai-tool-detail" :data-cursor="interactive ? (lang === 'zh' ? '了解' : 'Explore') : undefined"
                  @click="selectTool(tool.id)" @pointerenter="hoverTool($event, tool.id)" @focus="selectTool(tool.id)">
                  <img :src="tool.src" alt="" width="44" height="44" /><span>{{ tool.name }}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <dl class="pi__facts">
      <div v-for="(fact, i) in FACTS" :key="i" class="pi__fact">
        <dt>{{ fact.k.zh }}<span lang="en">{{ fact.k.en }}</span></dt>
        <dd><template v-for="(part, partIndex) in resumeFactParts(pick(fact.v, 'zh'), i, 'zh')" :key="partIndex"><strong v-if="part.strong">{{ part.text }}</strong><template v-else>{{ part.text }}</template></template><span lang="en"><template v-for="(part, partIndex) in resumeFactParts(pick(fact.v, 'en'), i, 'en')" :key="partIndex"><strong v-if="part.strong">{{ part.text }}</strong><template v-else>{{ part.text }}</template></template></span></dd>
      </div>
    </dl>
    <section class="pi__skills" aria-labelledby="profile-skills">
      <h3 id="profile-skills">制作与工具<span lang="en">Production & tools</span></h3>
      <dl class="pi__skill-list">
        <div v-for="skill in RESUME_SKILLS" :key="skill.id" :data-skill="skill.id">
          <dt>{{ skill.title.zh }}<span lang="en">{{ skill.title.en }}</span></dt>
          <dd><p v-for="copyLang in (['zh', 'en'] as const)" :key="copyLang" :lang="copyLang"><template v-for="(part, partIndex) in resumeSkillParts(skill.body[copyLang], skill.id, copyLang)" :key="partIndex"><strong v-if="part.strong">{{ part.text }}</strong><template v-else>{{ part.text }}</template></template></p></dd>
        </div>
      </dl>
    </section>
  </section>
</template>

<script setup lang="ts">
import { visualImageSources } from '../../utils/responsiveImage'
/**
 * 彩色人物照片与身份信息：同一张原图由居中的自然比例框迁移到右侧终点框，
 * clip-path 管视窗、image transform 管原图，两者使用同一次测量，避免边界错位。
 * Logo 的弹出只发生一次；active 仍可关闭交互，activeTool 由页面共享给 AiWorkflow。
 * 布局准备进入统一队列，matchMedia、ResizeObserver 与刷新任务在卸载时成对收回。
 */
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { AI_TOOLS } from '../../data/aiTools'
import { FACTS, IDENTITY, RESUME_SKILLS, ROLE_LINE, TAGLINE, pick, type Lang } from '../../data/aboutProfile'
import { resumeFactParts, resumeSkillParts } from '../../data/resumeEmphasis'
import { prepareMotionLayout, requestMotionLayoutRefresh } from '../../utils/motionLayout'

const props = defineProps<{ lang: Lang; active: boolean; activeTool: string }>()
const portraitSources = { thumb: '/about/portrait-400.webp', src: '/about/portrait-900.webp', large: '/about/portrait-1448.webp' }
const emit = defineEmits<{ 'update:activeTool': [id: string] }>()
const root = ref<HTMLElement | null>(null)
const sequence = ref<HTMLElement | null>(null)
const stage = ref<HTMLElement | null>(null)
const target = ref<HTMLElement | null>(null)
const canvas = ref<HTMLElement | null>(null)
const portrait = ref<HTMLImageElement | null>(null)
const identityContent = ref<HTMLElement | null>(null)
const interactive = ref(false)
const identityReady = ref(false)
const positions = [[12, 12, -7], [85, 12, 7], [9, 50, -5], [91, 50, 5], [15, 86, 6], [85, 86, -6]]
const toolPosition = (index: number) => { const p = positions[index]!; return { left: `${p[0]}%`, top: `${p[1]}%`, '--angle': `${p[2]}deg` } }
function selectTool(id: string) { if (interactive.value) emit('update:activeTool', id) }
function hoverTool(event: PointerEvent, id: string) { if (event.pointerType === 'mouse') selectTool(id) }
let media: gsap.MatchMedia | undefined
let played = false
let dead = false
let updateState = () => {}
let cancelPreparation: (() => void) | undefined
let cancelRefresh: (() => void) | undefined
gsap.registerPlugin(ScrollTrigger)

function initializeProfile(): void {
  cancelPreparation = undefined
  if (dead || !root.value || !sequence.value || !stage.value || !target.value || !canvas.value || !portrait.value) return
  media = gsap.matchMedia()
  media.add({ motion: '(prefers-reduced-motion: no-preference)', reduced: '(prefers-reduced-motion: reduce)', shortLandscape: '(max-height: 560px) and (orientation: landscape)', compactPortrait: '(max-width: 760px) and (max-height: 700px) and (min-aspect-ratio: 3/5) and (orientation: portrait)' }, context => {
    // 微信工具栏压缩后的竖屏与短横屏放不下正文和照片，复用自然流避免照片盖住链接。
    if (context.conditions!.reduced || context.conditions!.shortLandscape || context.conditions!.compactPortrait) {
      updateState = () => { interactive.value = props.active; identityReady.value = props.active }
      updateState()
      return () => { updateState = () => {}; interactive.value = false; identityReady.value = false }
    }
    const host = stage.value!, image = portrait.value!, frame = canvas.value!, destination = target.value!
    const pops = [...root.value!.querySelectorAll<HTMLElement>('.pi__tool-pop')]
    let bounds = { width: 1, height: 1, x: 0, y: 0, stageWidth: 1, stageHeight: 1 }
    function measure() {
      const h = host.getBoundingClientRect(), d = destination.getBoundingClientRect()
      bounds = { width: d.width, height: d.height, x: d.left - h.left, y: d.top - h.top, stageWidth: host.clientWidth, stageHeight: host.clientHeight }
    }
    measure()
    // 固定为肖像源图的原始像素比例；限制起始框，避免把原图强拉成满屏。
    const sourceWidth = 1448, sourceHeight = 1086
    const startingBox = () => {
      const width = Math.min(bounds.stageWidth - 40, 1080, bounds.stageHeight * .82 * sourceWidth / sourceHeight)
      const height = width * sourceHeight / sourceWidth
      return { width, height, x: (bounds.stageWidth - width) / 2, y: (bounds.stageHeight - height) / 2 }
    }
    const clipBox = (box: { x: number; y: number; width: number; height: number }) =>
      `inset(${box.y}px ${bounds.stageWidth - box.x - box.width}px ${bounds.stageHeight - box.y - box.height}px ${box.x}px)`
    gsap.set(image, { width: sourceWidth, height: sourceHeight, transformOrigin: 'top left' })
    let trigger: ScrollTrigger | undefined
    const pop = gsap.timeline({ paused: true })
    if (played) gsap.set(pops, { autoAlpha: 1, scale: 1, y: 0, rotation: 0 })
    else pop.fromTo(pops, { autoAlpha: 0, scale: .3, y: 42, rotation: -6 },
      { autoAlpha: 1, scale: 1, y: 0, rotation: 0, duration: .7, stagger: .065, ease: 'back.out(1.35)' })
    // 空间行程到 66% 才开放图标命中区，防止图标尚未落位就被点击或悬停选中。
    const sync = () => {
      interactive.value = !!trigger && trigger.progress >= .66 && props.active
      identityReady.value = interactive.value
      if (interactive.value && !played) {
        const visible = host.getBoundingClientRect()
        if (visible.bottom > 0 && visible.top < window.innerHeight) { played = true; pop.play(0) }
      }
    }
    updateState = sync
    const timeline = gsap.timeline({ paused: true })
      .fromTo(frame, { clipPath: () => clipBox(startingBox()) }, { clipPath: () => clipBox(bounds), duration: 1, ease: 'power3.inOut' }, 0)
      .fromTo(image, { x: () => startingBox().x, y: () => startingBox().y, scale: () => startingBox().width / sourceWidth },
        { x: () => bounds.x, y: () => bounds.y, scale: () => bounds.width / sourceWidth, duration: 1, ease: 'power3.inOut' }, 0)
      .fromTo(identityContent.value, { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: .55, ease: 'power3.out' }, .6)
      .fromTo(destination, { autoAlpha: 0 }, { autoAlpha: 1, duration: .15 }, 1)
      .to({}, { duration: .4 }, 1.4)
    trigger = ScrollTrigger.create({ trigger: sequence.value!, animation: timeline, start: 'top top', end: 'bottom bottom', scrub: true,
      invalidateOnRefresh: true, onRefreshInit: measure, onUpdate: sync, onRefresh: sync })
    sync()
    let refreshFrame = 0
    const resize = new ResizeObserver(() => {
      if (refreshFrame) return
      refreshFrame = requestAnimationFrame(() => { refreshFrame = 0; trigger?.refresh() })
    })
    resize.observe(host)
    return () => { resize.disconnect(); cancelAnimationFrame(refreshFrame); trigger = undefined; updateState = () => {}; interactive.value = false; identityReady.value = false }
  }, root.value)
  void document.fonts.ready.then(() => {
    if (dead) return
    cancelRefresh?.()
    cancelRefresh = requestMotionLayoutRefresh()
  })
}
onMounted(async () => {
  await nextTick()
  if (dead || !root.value) return
  cancelPreparation = prepareMotionLayout(root.value, initializeProfile)
})
watch(() => props.active, () => updateState(), { flush: 'post' })
onBeforeUnmount(() => { dead = true; cancelPreparation?.(); cancelRefresh?.(); media?.revert() })
</script>

<style scoped>
.pi { position:relative; }
.pi__sequence { position:relative; width:100vw; height:calc(100vh * 2.25); height:calc(100svh * 2.25); margin-inline:calc(50% - 50vw); }
.pi__stage { --profile-edge:clamp(20px,4.4vw,80px); --profile-photo-width:min(59vw,840px,calc(72vh * 4 / 3)); --profile-copy-width:min(31vw,450px); --profile-copy-inset:max(var(--profile-edge),calc((100% - var(--profile-photo-width) - var(--profile-edge) - var(--profile-copy-width)) / 2)); position:sticky; top:0; height:100vh; height:100svh; overflow:clip; background:var(--ab-bg); }
/* 旧微信内核会接受自定义属性中的未知单位，只在使用时变成无效值；须在支持查询中升级。 */
@supports(height:100svh) { .pi__stage { --profile-photo-width:min(59vw,840px,calc(72svh * 4 / 3)); } }
.pi__visual,.pi__canvas { position:absolute; inset:0; }
.pi__canvas { overflow:clip; background:#252525; }
.pi__portrait { display:block; position:absolute; top:0; left:0; width:100%; height:100%; object-fit:contain; filter:none; }
.pi__target { position:absolute; top:50%; right:var(--profile-edge); width:var(--profile-photo-width); aspect-ratio:4/3; transform:translateY(-50%); pointer-events:none; }
/* 正文在照片左侧的留白中整体居中，内部仍左对齐；窄屏至少保留24px栏间距。 */
.pi__identity { position:absolute; z-index:2; top:50%; left:var(--profile-copy-inset); width:min(var(--profile-copy-width),calc(100% - var(--profile-copy-inset) - var(--profile-photo-width) - var(--profile-edge) - 24px)); transform:translateY(-50%); pointer-events:none; }
.pi__eyebrow { margin:0; font-size:11px; color:var(--ab-soft); }
.pi__identity h2 { margin:28px 0 0; font-size:clamp(48px,6.2vw,94px); font-weight:400; line-height:1; letter-spacing:-.05em; }
.pi__identity h2 span { display:block; margin-top:15px; font-size:clamp(12px,1.5vw,21px); letter-spacing:-.01em; }
.pi__role { margin-top:28px; font-size:12px; color:var(--ab-soft); line-height:1.6; }
.pi__tagline { margin-top:40px; max-width:15ch; font-size:clamp(22px,2.5vw,35px); line-height:1.25; letter-spacing:-.025em; }
.pi__tool-slot { position:absolute; width:78px; transform:translate(-50%,-50%) rotate(var(--angle)); pointer-events:auto; }
.pi__tool { display:block; width:78px; padding:14px 10px 10px; border:0; background:none; color:#fff; font:inherit; cursor:pointer; text-shadow:0 1px 5px #000b; transition:transform .5s cubic-bezier(.215,.61,.355,1); }
.pi__tool img { display:block; width:44px; height:44px; margin:auto; object-fit:contain; filter:drop-shadow(0 2px 3px #0006); }
.pi__tool.is-chatgpt img { filter:invert(1) drop-shadow(0 2px 3px #0006); }
.pi__tool span { display:block; margin-top:8px; font-size:10px; line-height:1.2; white-space:nowrap; text-decoration:underline; text-decoration-color:transparent; text-underline-offset:4px; text-decoration-thickness:1px; }
.pi__tool:hover,.pi__tool:focus-visible { transform:translateY(-5px) rotate(calc(var(--angle) * -1)); }
.pi__tool:focus-visible { outline:none; }
.pi__tool:focus-visible span { text-decoration-color:currentColor; text-decoration-thickness:2px; }
.pi__tool:disabled { cursor:default; }
.pi__tool.is-selected span { text-decoration-color:currentColor; }
.pi__facts { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); column-gap:40px; margin-top:clamp(52px,8vh,84px); }
.pi__fact { display:grid; grid-template-columns:80px minmax(0,1fr); align-content:start; gap:16px; padding:20px 0; border-top:1px solid var(--ab-line); }
.pi__fact dt { font-size:11px; line-height:1.5; color:var(--ab-soft); }
.pi__fact dt span { display:block; font-size:10px; }
.pi__fact dd { margin:0; font-size:13px; line-height:1.7; }
.pi__fact dd span { display:block; margin-top:5px; color:var(--ab-soft); font-size:11px; line-height:1.5; }
.pi__fact dd strong { font-weight:600; }
.pi__skills { display:grid; grid-template-columns:minmax(170px,.28fr) minmax(0,1fr); gap:clamp(44px,7vw,100px); margin-top:clamp(42px,6vw,72px); }
.pi__skills h3 { margin:0; padding-top:22px; border-top:1px solid var(--ab-line); font-size:20px; line-height:1.4; font-weight:400; letter-spacing:-.02em; }
.pi__skills h3 span { display:block; margin-top:6px; font-size:12px; letter-spacing:0; color:var(--ab-soft); }
.pi__skill-list { margin:0; }
.pi__skill-list > div { display:grid; grid-template-columns:135px minmax(0,1fr); gap:28px; padding:22px 0; border-top:1px solid var(--ab-line); }
.pi__skill-list dt { font-size:12px; line-height:1.6; }
.pi__skill-list dt span { display:block; margin-top:5px; font-size:10px; color:var(--ab-soft); }
.pi__skill-list dd { margin:0; min-width:0; }
.pi__skill-list p { margin:0; font-size:14px; line-height:1.8; overflow-wrap:break-word; }
.pi__skill-list p[lang=en] { margin-top:9px; font-size:12px; color:var(--ab-soft); }
.pi__skill-list strong { font-weight:600; }
@media(max-width:980px) { .pi__skills { grid-template-columns:minmax(0,1fr); gap:24px; } }
@media(max-width:600px) { .pi__skill-list > div { grid-template-columns:minmax(0,1fr); gap:12px; }.pi__skill-list dt span { display:inline; margin-left:10px; } }
@media(max-width:760px) and (orientation:portrait) {
 .pi__sequence { height:calc(100vh * 2.25); height:calc(100svh * 2.25); }
 .pi__target { top:55%; left:20px; right:20px; width:calc(100% - 40px); }
 .pi__identity { top:78px; left:20px; right:20px; width:auto; transform:none; }
 .pi__identity h2 { margin-top:16px; font-size:48px; }
 .pi__identity h2 span { display:inline-block; margin:0 0 0 18px; font-size:13px; }
 .pi__role { margin-top:14px; font-size:11px; }
 .pi__tagline { margin-top:18px; max-width:none; font-size:22px; }
 .pi__tool-slot,.pi__tool { width:56px; }
 .pi__tool { padding:9px 5px 7px; }
 .pi__tool img { width:30px; height:30px; }
 .pi__tool span { font-size:9px; margin-top:6px; }
}
@media(max-width:760px) and (max-height:700px) and (orientation:portrait) {
 .pi__identity { top:58px; }
 .pi__identity h2 { margin-top:12px; font-size:40px; }
 .pi__identity h2 span { margin-left:12px; font-size:11px; }
 .pi__role { margin-top:10px; font-size:10px; }
 .pi__tagline { margin-top:12px; font-size:18px; }
 .pi__target { top:58%; }
}
@media(max-height:560px) and (orientation:landscape) { .pi__identity h2 { margin-top:15px; font-size:48px; } .pi__role,.pi__tagline { margin-top:18px; } }

.pi__identity > div { visibility:hidden; }
.pi__role span { display:block; margin-top:5px; font-size:11px; }
.pi__tagline { margin-top:28px; }
.pi__tagline span { display:block; margin-top:12px; font-size:clamp(13px,1.25vw,18px); color:var(--ab-soft); letter-spacing:-.01em; line-height:1.4; }
.pi__explore { display:flex; justify-content:space-between; gap:24px; align-items:center; width:fit-content; min-width:min(180px,100%); max-width:100%; margin-top:26px; padding:10px 0; color:inherit; text-decoration:none; font-size:13px; pointer-events:auto; }
.pi__explore span[lang=en] { display:block; color:var(--ab-soft); font-size:10px; margin-top:3px; }
.pi__explore > span:last-child { font-size:24px; transition:transform .35s ease; }
.pi__explore:hover > span:last-child { transform:translateY(5px); }
.pi__explore:focus-visible { outline:2px solid currentColor; outline-offset:5px; }
.pi__target { visibility:hidden; }
.pi__tool { border-radius:0; }
@media(max-width:1100px) { .pi__facts { grid-template-columns:repeat(2,minmax(0,1fr)); gap:0 30px; } }
@media(max-width:760px) { .pi__facts { margin-top:38px; gap:0 24px; } .pi__fact { grid-template-columns:1fr; gap:10px; } }
@media(max-width:380px) { .pi__facts { grid-template-columns:1fr; } .pi__fact { grid-template-columns:80px minmax(0,1fr); gap:16px; } }
@media(max-width:760px) and (orientation:portrait) {
 .pi__target { top:64%; }
 .pi__role span { margin-top:2px; font-size:10px; }
 .pi__tagline span { margin-top:6px; font-size:12px; }
 .pi__explore { margin-top:16px; font-size:12px; padding:8px 0; }
}
@media(max-width:760px) and (max-height:700px) and (orientation:portrait) {
 .pi__target { top:67%; }
 .pi__role span { font-size:9px; }
 .pi__tagline span { font-size:11px; }
 .pi__explore { margin-top:12px; font-size:11px; }
}
@media(max-height:560px) and (orientation:landscape) {
 .pi__tagline { font-size:22px; }
 .pi__tagline span { font-size:12px; margin-top:7px; }
 .pi__explore { margin-top:14px; }
}

@media(max-width:380px) and (orientation:portrait) { .pi__target { top:74%; } }
@media(max-width:380px) and (max-height:700px) and (orientation:portrait) { .pi__target { top:78%; } }
@media(prefers-reduced-motion:reduce), (max-height:560px) and (orientation:landscape), (max-width:760px) and (max-height:700px) and (min-aspect-ratio:3/5) and (orientation:portrait) {
 .pi { padding-top:100px; }
 .pi__identity > div { visibility:visible; }
 .pi__target { visibility:visible; }
 .pi__explore > span:last-child { transition:none; }
 .pi__tool:hover,.pi__tool:focus-visible,.pi__explore:hover > span:last-child { transform:none; }
 .pi__sequence { height:auto; width:100%; margin-inline:0; }
 .pi__stage { position:relative; height:auto; overflow:visible; }
 .pi__identity { position:relative; top:auto; left:auto; right:auto; width:auto; transform:none; margin-bottom:40px; }
 .pi__visual { position:relative; width:min(100%,1080px); margin-inline:auto; aspect-ratio:4/3; }
 .pi__canvas { position:relative; inset:auto; overflow:visible; }
 /* Keep the static raster on its own paint layer inside the page's overflow clip. */
 .pi__portrait { position:relative; width:100%; height:auto; transform:translateZ(0); }
 .pi__target { inset:0; width:100%; height:100%; transform:none; }
 .pi__tool { transition:none; }
}
</style>
