<template>
  <section id="ai-workflow" class="aiw" aria-labelledby="ai-workflow-title">
    <header class="aiw__header">
      <h2 id="ai-workflow-title">创作过程<span lang="en">Inside the creative process</span></h2>
      <p>工具参与过程，判断留在自己手里<span lang="en">Tools support the process; judgment stays with me</span></p>
    </header>
    <p class="aiw__hint">选择阶段，探索制作过程<span lang="en">Select a stage to explore the process</span></p>
    <div class="aiw__tabs" role="tablist" :aria-label="lang === 'zh' ? '探索创作阶段' : 'Explore the creative process'">
      <button v-for="(step, i) in CREATIVE_STAGES" :id="`process-tab-${step.id}`" :key="step.id" type="button" role="tab"
        :aria-selected="index === i" :tabindex="index === i ? 0 : -1" aria-controls="process-panel"
        @click="select(i)" @keydown="onKey($event, i)">
        <span class="aiw__step-no">{{ String(i + 1).padStart(2, '0') }}</span>
        <span>{{ step.title.zh }}<small lang="en">{{ step.title.en }}</small></span>
        <span class="aiw__step-arrow" aria-hidden="true">{{ i === 4 ? '↗' : '→' }}</span>
      </button>
    </div>

    <div id="process-panel" class="aiw__panel" role="tabpanel" :aria-labelledby="`process-tab-${stage.id}`" tabindex="0">
      <div class="aiw__workspace">
        <p class="aiw__study">创作方法示意<span lang="en">Process study</span></p>
        <Transition name="process-stage" mode="out-in">
          <div :key="stage.id" class="aiw__preview">
            <div v-if="index === 0" class="brief-study">
              <p class="aiw__preview-title">把问题问清楚<span lang="en">Ask the useful questions</span></p>
              <dl><div><dt>给谁看<span lang="en">Audience</span></dt><dd>先理解观看的人<span lang="en">Understand who is watching</span></dd></div>
                <div><dt>讲什么<span lang="en">Message</span></dt><dd>只留下核心信息<span lang="en">Keep the central message</span></dd></div>
                <div><dt>如何交付<span lang="en">Format</span></dt><dd>让表达适合场景<span lang="en">Match the story to its setting</span></dd></div></dl>
            </div>
            <div v-else-if="index === 1" class="script-study">
              <p class="aiw__preview-title">信息，按节奏发生<span lang="en">Information unfolds in sequence</span></p>
              <div v-for="(shot, i) in shots" :key="shot.zh" class="script-study__shot"><span>{{ String(i + 1).padStart(2, '0') }}</span><p>{{ shot.zh }}<small lang="en">{{ shot.en }}</small></p></div>
              <p class="aiw__material-note">结构示意，不代表具体项目脚本<span lang="en">A structural illustration, not a project script</span></p>
            </div>
            <div v-else-if="index === 2" class="frame-study">
              <img :src="photography[frameIndex]!.src" :srcset="visualImageSources(photography[frameIndex]!)" sizes="(max-width: 760px) 40vw, 25vw" :width="photography[frameIndex]!.width" :height="photography[frameIndex]!.height" :alt="pick(photography[frameIndex]!.alt, lang)" />
              <div class="frame-study__choices" role="group" aria-label="画面观察 / Read the frame"><button v-for="(label, i) in frameLabels" :key="label.zh" type="button" :aria-pressed="frameIndex === i" @click="frameIndex = i">{{ label.zh }}<span lang="en">{{ label.en }}</span></button></div>
              <p class="aiw__material-note">个人摄影，用于画面观察示意<span lang="en">Personal photographs used as visual references</span></p>
            </div>
            <div v-else-if="index === 3" class="image-study">
              <div class="image-study__frame"><img :src="editorial[layoutIndex]!.src" :srcset="visualImageSources(editorial[layoutIndex]!)" sizes="(max-width: 760px) 40vw, 25vw" :width="editorial[layoutIndex]!.width" :height="editorial[layoutIndex]!.height" :alt="pick(editorial[layoutIndex]!.alt, lang)" /></div>
              <div class="image-study__choices" role="group" aria-label="原片与排版 / Photograph and layout"><button type="button" :aria-pressed="layoutIndex === 0" @click="layoutIndex = 0">原片<span lang="en">Photograph</span></button><button type="button" :aria-pressed="layoutIndex === 1" @click="layoutIndex = 1">排版练习<span lang="en">Cover study</span></button></div>
              <p class="aiw__material-note">滕王阁 / 个人摄影与封面练习<span lang="en">Pavilion / Personal photograph & cover study</span></p>
            </div>
            <div v-else class="delivery-study">
              <p class="aiw__preview-title">交付前，我会检查<span lang="en">Before handing it over</span></p>
              <label v-for="(check, i) in checks" :key="check.zh"><input v-model="checked" :value="i" type="checkbox" /><span>{{ check.zh }}<small lang="en">{{ check.en }}</small></span></label>
              <p class="delivery-study__progress" role="status">{{ checked.length }} / 3<span>检查清单示意<span lang="en">Interactive checklist study</span></span></p>
            </div>
          </div>
        </Transition>
      </div>
      <div id="ai-tool-detail" class="aiw__detail" aria-live="polite" aria-atomic="true">
        <p class="aiw__position">{{ String(index + 1).padStart(2, '0') }} / 05</p>
        <h3>{{ stage.heading.zh }}<span lang="en">{{ stage.heading.en }}</span></h3>
        <p class="aiw__copy">{{ stage.judgment.zh }}<span lang="en">{{ stage.judgment.en }}</span></p>
        <div class="aiw__assistance"><h4>AI 在这一步<span lang="en">Where AI helps</span></h4><p>{{ stage.assistance.zh }}<span lang="en">{{ stage.assistance.en }}</span></p></div>
        <div class="aiw__tools" role="group" aria-label="工具与用法 / Tools and use">
          <button v-for="tool in tools" :key="tool.id" type="button" :aria-pressed="selectedTool.id === tool.id" @click="selectTool(tool.id)">
            <img :src="tool.src" :class="{ 'is-light-logo': tool.logoTone === 'light' }" alt="" width="28" height="28" loading="lazy" /><span>{{ tool.name }}</span>
          </button>
        </div>
        <p class="aiw__tool-role">{{ selectedTool.roleZh }}<span lang="en">{{ selectedTool.roleEn }}</span></p>
        <p class="aiw__output">留下什么<span lang="en">What I take forward</span><strong>{{ stage.output.zh }}<span lang="en">{{ stage.output.en }}</span></strong></p>
      </div>
    </div>
    <p class="aiw__provenance">以上是工作方法说明，画面示例来自个人练习<a href="#work-aigc-drama">实习中的 AIGC 实践 ↗</a><span lang="en">A working-method study with personal visual examples <a href="#work-aigc-drama">Read my AIGC experience ↗</a></span></p>
  </section>
</template>

<script setup lang="ts">
import { visualImageSources } from '../../utils/responsiveImage'
/**
 * 创作过程交互：阶段、示例画面和检查清单是本地演示状态，不调用 AI 服务。
 * activeTool 与人物照片上的 Logo 双向联动；外部选中工具时，定位到包含它的阶段。
 * 两种语言始终同时展示，lang 只决定辅助说明和图片替代文本的优先语言。
 */
import { computed, ref, watch } from 'vue'
import { AI_TOOLS } from '../../data/aiTools'
import { CREATIVE_STAGES } from '../../data/creativeProcess'
import { photography, editorial } from '../../data/visualPortfolio'
import { pick, type Lang } from '../../data/aboutProfile'
const props = defineProps<{ lang: Lang; activeTool?: string }>()
const emit = defineEmits<{ 'update:activeTool': [id: string] }>()
const index = ref(0)
const stage = computed(() => CREATIVE_STAGES[index.value]!)
const tools = computed(() => AI_TOOLS.filter(tool => stage.value.tools.includes(tool.id)))
const toolId = ref(props.activeTool ?? 'kimi')
const selectedTool = computed(() => tools.value.find(tool => tool.id === toolId.value) ?? tools.value[0]!)
const frameIndex = ref(0)
const layoutIndex = ref(0)
const checked = ref<number[]>([])
const shots = [{ zh: '建立情境，让人愿意看下去', en: 'Open — establish the setting' }, { zh: '展开信息，让镜头有承接', en: 'Develop — connect each piece of information' }, { zh: '收束表达，留下一个重点', en: 'Close — leave one clear idea' }]
const frameLabels = [{ zh: '层次', en: 'Layers' }, { zh: '留白', en: 'Space' }, { zh: '纵深', en: 'Depth' }]
const checks = [{ zh: '信息与字幕是否准确', en: 'Information and subtitle accuracy' }, { zh: '画面、声音与节奏是否连贯', en: 'Visual, sound and narrative continuity' }, { zh: '尺寸、链接与交付规格是否正确', en: 'Dimensions, links and delivery specifications' }]
function selectTool(id: string) { toolId.value = id; emit('update:activeTool', id) }
function select(next: number) { index.value = next; selectTool(CREATIVE_STAGES[next]!.tools[0]!) }
// 外部同步只更新本地状态，不再 emit，避免父子组件互相回写形成循环。
watch(() => props.activeTool, id => {
  if (!id || id === toolId.value) return
  const targetStage = stage.value.tools.includes(id) ? index.value : CREATIVE_STAGES.findIndex(step => step.tools.includes(id))
  if (targetStage >= 0) { index.value = targetStage; toolId.value = id }
})
function onKey(event: KeyboardEvent, current: number) {
  // roving tabindex：只有激活标签进入 Tab 序列，方向键切换后将焦点留在标签组。
  let next: number
  if (event.key === 'ArrowRight') next = (current + 1) % CREATIVE_STAGES.length
  else if (event.key === 'ArrowLeft') next = (current - 1 + CREATIVE_STAGES.length) % CREATIVE_STAGES.length
  else if (event.key === 'Home') next = 0
  else if (event.key === 'End') next = CREATIVE_STAGES.length - 1
  else return
  event.preventDefault()
  select(next)
  document.getElementById(`process-tab-${stage.value.id}`)?.focus({ preventScroll: true })
}
</script>

<style scoped>
.aiw { scroll-margin-top:72px; }
.aiw__header { display:grid; grid-template-columns:minmax(170px,.28fr) minmax(0,1fr); gap:clamp(44px,7vw,100px); margin-bottom:48px; }
.aiw__header h2 { font-size:clamp(28px,3vw,42px); font-weight:400; letter-spacing:-.045em; line-height:1.2; }
.aiw__header h2 span { display:block; margin-top:12px; font-size:15px; letter-spacing:0; color:var(--ab-soft); }
.aiw__header > p { font-size:clamp(20px,2.2vw,29px); line-height:1.5; letter-spacing:-.025em; }
.aiw__header > p span { display:block; margin-top:14px; font-size:14px; color:var(--ab-soft); letter-spacing:0; }
.aiw__tabs { display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); border-bottom:1px solid var(--ab-line); }
.aiw__hint { display:flex; flex-wrap:wrap; gap:6px 20px; margin-bottom:12px; font-size:11px; color:var(--ab-soft); }
.aiw__hint span { font-size:10px; }
.aiw__tabs > button:hover { color:var(--ab-ink); }
.aiw__tabs > button:hover .aiw__step-arrow { transform:translateX(5px); }
.aiw__tabs > button { display:flex; position:relative; align-items:center; gap:18px; min-width:0; padding:20px 14px 22px 0; color:var(--ab-soft); text-align:left; border:0; background:none; font:inherit; font-size:20px; line-height:1.2; cursor:pointer; }
.aiw__tabs > button > span { min-width:0; }
.aiw__tabs > button::after { content:''; position:absolute; inset:auto 0 -1px; height:2px; background:var(--ab-ink); transform:scaleX(0); transform-origin:left; transition:transform .4s ease; }
.aiw__tabs > button[aria-selected=true] { color:var(--ab-ink); }
.aiw__tabs > button[aria-selected=true]::after { transform:scaleX(1); }
.aiw__tabs small { display:block; margin-top:8px; font-size:11px; overflow-wrap:anywhere; }
.aiw__step-no { font-size:10px; align-self:flex-start; padding-top:3px; }
.aiw__step-arrow { margin-left:auto; font-size:22px; transition:transform .35s ease; }
.aiw__panel { display:grid; grid-template-columns:minmax(0,1.35fr) minmax(0,1fr); gap:clamp(40px,6vw,88px); margin-top:40px; }
.aiw__panel:focus-visible,.aiw button:focus-visible { outline:2px solid var(--ab-ink); outline-offset:5px; }
.aiw__workspace { background:#eeefec; padding:clamp(24px,3.1vw,44px); min-width:0; }
.aiw__study { display:flex; flex-wrap:wrap; justify-content:space-between; gap:8px; margin:0 0 28px; color:var(--ab-soft); font-size:10px; }
.aiw__preview { min-height:480px; }
.aiw__preview-title { font-size:clamp(25px,2.5vw,36px); letter-spacing:-.035em; line-height:1.25; }
.aiw__preview-title > span { display:block; margin-top:12px; font-size:16px; letter-spacing:0; }
.brief-study dl { margin-top:46px; }
.brief-study dl > div { display:grid; grid-template-columns:95px minmax(0,1fr); gap:20px; padding:24px 0; border-top:1px solid var(--ab-line); }
.brief-study dt { font-size:13px; }.brief-study dt span { display:block; margin-top:5px; font-size:10px; color:var(--ab-soft); }
.brief-study dd { font-size:20px; line-height:1.4; }.brief-study dd span { display:block; margin-top:8px; font-size:12px; color:var(--ab-soft); }
.script-study__shot { display:flex; gap:24px; padding:24px 0; border-top:1px solid var(--ab-line); }.script-study__shot:first-of-type { margin-top:40px; }
.script-study__shot > span { font-size:11px; color:var(--ab-soft); padding-top:6px; }.script-study__shot p { font-size:20px; }.script-study__shot small { display:block; margin-top:8px; font-size:12px; color:var(--ab-soft); }
.frame-study > img,.image-study__frame { display:block; width:100%; height:340px; object-fit:contain; }.image-study__frame img { display:block; width:100%; height:100%; object-fit:contain; }
.frame-study__choices,.image-study__choices { display:flex; gap:28px; margin-top:20px; }.frame-study__choices button,.image-study__choices button { min-height:44px; padding:5px 0; border:0; border-bottom:1px solid transparent; background:none; color:var(--ab-soft); font:inherit; font-size:14px; cursor:pointer; }
.frame-study__choices button span,.image-study__choices button span { display:block; margin-top:4px; font-size:10px; }.frame-study__choices button[aria-pressed=true],.image-study__choices button[aria-pressed=true] { color:var(--ab-ink); border-bottom-color:currentColor; }
.aiw__material-note { margin-top:24px; font-size:10px; color:var(--ab-soft); line-height:1.6; }.aiw__material-note span { display:block; margin-top:4px; }
.delivery-study label { display:flex; gap:20px; align-items:center; padding:24px 0; border-top:1px solid var(--ab-line); font-size:18px; cursor:pointer; }.delivery-study label:first-of-type { margin-top:40px; }.delivery-study label small { display:block; margin-top:8px; font-size:12px; color:var(--ab-soft); }.delivery-study input { width:18px; height:18px; flex:0 0 18px; accent-color:var(--ab-ink); border-radius:0; }
.delivery-study__progress { display:flex; justify-content:space-between; align-items:center; margin-top:28px; font-size:36px; letter-spacing:-.04em; }.delivery-study__progress > span { font-size:11px; letter-spacing:0; }.delivery-study__progress [lang=en] { display:block; font-size:10px; color:var(--ab-soft); }
.aiw__position { font-size:11px; color:var(--ab-soft); }
.aiw__detail h3 { margin-top:20px; font-size:clamp(26px,2.6vw,36px); font-weight:400; line-height:1.3; letter-spacing:-.035em; }
.aiw__detail h3 > span { display:block; margin-top:12px; font-size:17px; letter-spacing:0; }
.aiw__copy { margin-top:24px; font-size:15px; line-height:1.75; }.aiw__copy > span { display:block; margin-top:12px; color:var(--ab-soft); font-size:13px; line-height:1.65; }
.aiw__assistance { margin-top:26px; padding-top:22px; border-top:1px solid var(--ab-line); }.aiw__assistance h4 { display:flex; align-items:baseline; gap:12px; font-size:12px; font-weight:400; }.aiw__assistance h4 span { color:var(--ab-soft); font-size:10px; }.aiw__assistance p { margin-top:12px; font-size:13px; line-height:1.75; }.aiw__assistance p > span { display:block; margin-top:8px; font-size:12px; line-height:1.6; color:var(--ab-soft); }
.aiw__tools { display:flex; flex-wrap:wrap; gap:24px; margin-top:24px; }.aiw__tools button { display:flex; gap:10px; align-items:center; min-height:44px; padding:5px 0; border:0; border-bottom:1px solid transparent; border-radius:0; background:none; color:var(--ab-soft); font:inherit; font-size:12px; cursor:pointer; }.aiw__tools button[aria-pressed=true] { color:var(--ab-ink); border-bottom-color:currentColor; }.aiw__tools img { object-fit:contain; }.aiw__tools .is-light-logo { filter:invert(1); }
.aiw__tool-role { min-height:48px; margin-top:14px; font-size:12px; line-height:1.6; color:var(--ab-soft); }.aiw__tool-role span { display:block; font-size:11px; margin-top:4px; }
.aiw__output { margin-top:24px; padding-top:20px; border-top:1px solid var(--ab-line); font-size:11px; color:var(--ab-soft); }.aiw__output > span { margin-left:10px; font-size:10px; }.aiw__output strong { display:block; margin-top:10px; color:var(--ab-ink); font-weight:400; font-size:15px; }.aiw__output strong span { display:block; margin-top:4px; font-size:12px; color:var(--ab-soft); }
.aiw__provenance { margin-top:26px; font-size:11px; color:var(--ab-soft); line-height:1.7; }.aiw__provenance > span { display:block; margin-top:5px; font-size:10px; }.aiw__provenance a { color:inherit; margin-left:16px; text-underline-offset:4px; }
.process-stage-enter-active,.process-stage-leave-active { transition:opacity .22s ease,transform .3s ease; }.process-stage-enter-from { opacity:0; transform:translateY(12px); }.process-stage-leave-to { opacity:0; transform:translateY(-8px); }
@media(max-width:980px) { .aiw__header { grid-template-columns:1fr; gap:24px; }.aiw__panel { gap:32px; }.aiw__tabs > button { gap:10px; }.aiw__step-no { display:none; }.aiw__preview { min-height:520px; }.brief-study dl > div { grid-template-columns:1fr; gap:10px; }.brief-study dt span { display:inline; margin-left:10px; } }
@media(max-width:760px) { .aiw__header { margin-bottom:28px; }.aiw__header > p { font-size:20px; }.aiw__tabs > button { font-size:16px; padding:16px 8px 18px 0; }.aiw__tabs small { font-size:9px; }.aiw__step-arrow { display:none; }.aiw__panel { grid-template-columns:1fr; margin-top:26px; }.aiw__preview { min-height:420px; }.brief-study dl > div { grid-template-columns:82px minmax(0,1fr); gap:16px; }.brief-study dt span { display:block; margin-left:0; }.brief-study dd,.script-study__shot p { font-size:18px; }.frame-study > img,.image-study__frame { height:290px; }.aiw__detail h3 { font-size:30px; }.aiw__provenance a { display:block; margin:8px 0 0; }.aiw__provenance > span { margin-top:12px; } }
@media(max-width:380px) { .aiw__workspace { padding:20px; }.brief-study dl > div { grid-template-columns:1fr; }.aiw__preview { min-height:450px; }.frame-study > img,.image-study__frame { height:270px; }.delivery-study label { gap:12px; font-size:16px; } }
@media(prefers-reduced-motion:reduce) { .process-stage-enter-active,.process-stage-leave-active,.aiw__tabs > button::after,.aiw__step-arrow { transition:none; }.process-stage-enter-from,.process-stage-leave-to,.aiw__tabs > button:hover .aiw__step-arrow { transform:none; } }
</style>
