<template>
  <!--
    保留的聊天问答组件；当前 AboutView 使用创作过程等章节，不挂载这一版问答。

    形式：一问一答交替的聊天流（左白问、右黑答），滚动到哪条就展开到哪条。
    ⚠️ 只负责结构与静止样式；若页面使用它，需由页面统一初始化滚动揭示，
       实现见 `useAboutReveal.ts` 里的 `.chat-item` 那一段。
    ⚠️ key 带上 lang：切语言时强制重建 DOM，展开动画才有干净的内联样式可写。
    ⚠️ 回答**整段**渲染在一个 `.bubble__tx` 里，**不是**逐字 `<span>`：
       方案要求「整句显露、取消逐字亮起」。逐字拆分还会把长回答拆成上百个
       节点，滚动反向时逐个补间、明显卡顿。
    ⚠️ 内容全部来自 `aboutProfile.ts` 的 CHAT，本组件不硬编码任何一句文案。
  -->
  <AboutSection :index="'07'" :label="'CHAT'" :title="t.title" :lead="SECTION_LEAD" motion="wipe">
    <div class="chat" :class="{ 'chat--reduced': reduceMotion }">
      <div
        v-for="(m, i) in messages"
        :key="`${lang}-${i}`"
        class="chat-item"
        :class="m.type"
      >
        <div class="msg">
          <span class="typing" aria-hidden="true"><i></i><i></i><i></i></span>
          <div class="bubble"><span class="bubble__tx">{{ m.text }}</span></div>
        </div>
      </div>
    </div>
  </AboutSection>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import AboutSection from './AboutSection.vue'
import { CHAT, pick, type Lang } from '../../data/aboutProfile'

const props = defineProps<{ lang: Lang; reduceMotion: boolean }>()
const SECTION_LEAD = {
  zh: '三个问题：我主要做什么、AI 在其中的作用、作品发布后我还做什么',
  en: 'Three questions — what I mainly do, where AI sits in it, and what I do after a piece goes live',
}

const t = computed(() =>
  props.lang === 'zh'
    ? {
        title: '一次关于我的对话',
      }
    : {
        title: 'A conversation about me',
      },
)

/** 一条聊天消息：问题在左，回答在右。由当前语言的问答对摊平而来。 */
interface ChatMsg {
  type: 'question' | 'answer'
  text: string
}
const messages = computed<ChatMsg[]>(() =>
  CHAT.flatMap((pair) => [
    { type: 'question' as const, text: pick(pair.q, props.lang) },
    { type: 'answer' as const, text: pick(pair.a, props.lang) },
  ]),
)
</script>

<style scoped>
.chat {
  max-width: 720px;
  margin: 0 auto;
}

/*
 * ⚠️ 这里**故意不写隐藏起点**（item 透明 / 气泡收拢 / 字透明都交给
 *    `useAboutReveal.ts` 的 `fromTo` 在 JS 里写）。原因是切语言时
 *    `:key="lang-i"` 会把整条消息重建一遍 —— 如果起点写在 CSS 里，
 *    新节点在没有 GSAP 补间的情况下会**永久**停在 opacity:0。
 *    写在 JS 里，最坏情况只是「直接显示终态」，永远不会白屏。
 */
.chat-item {
  display: flex;
}
/*
 * ⚠️ 间距分两级：问 → 答「紧」，答 → 下一条问「松」。
 *    一组问答在视觉上是一块（问是引子、答是主体），组与组之间才是真正的换气。
 *    统一给一个值会让 5 组问答摊成一条等距列表，读不出「配对」关系。
 */
.chat-item.question {
  justify-content: flex-start;
  margin-bottom: clamp(12px, 1.8vh, 22px);
}
.chat-item.answer {
  justify-content: flex-end;
  margin-bottom: clamp(56px, 8vh, 104px);
}

/*
 * 消息槽：尺寸由气泡撑开，打字点绝对居中在它上面。
 * ⚠️ `clip-path` 不改变布局尺寸，所以气泡被裁到只剩中心一点时 `.msg` 仍是完整大小。
 *    这同时解决两件事：① 打字点稳稳落在气泡正中心；② **长回答从一开始就占住
 *    最终高度**，展开过程不会把后面的问答顶下去（没有页面跳动）。
 */
.msg {
  position: relative;
  display: flex;
  max-width: min(520px, 88%);
}

.bubble {
  padding: 22px 26px;
  font-size: clamp(15px, 1.55vw, 18px);
  line-height: 1.75;
  /* 黑白编辑风：问题浅灰、回答深灰（原来深紫系，随整页转纸面） */
  background: #ececea;
  color: #252525;
  border-radius: 20px;
  white-space: pre-wrap;
}
.question .bubble {
  border-bottom-left-radius: 6px;
}
.answer .bubble {
  background: #3a3a38;
  color: #f7f7f5;
  border-bottom-right-radius: 6px;
}

.typing {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  gap: 5px;
  z-index: 2;
}
.typing i {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}
/* 打字点颜色随气泡底色：浅灰里用深点，深灰里用浅点 */
.question .typing i {
  background: #252525;
}
.answer .typing i {
  background: #f7f7f5;
}

/*
 * 减少动态效果：不建聊天时间线，打字点就没人负责淡出 —— 它们会静止停在
 * 展开后的气泡正中央，像三个脏点。所以这里必须显式收掉。
 * （其余各屏的隐藏起点都在 JS 里，不建动画就等于「内容本来就在」，不需要这条。）
 */
.chat--reduced .typing {
  display: none;
}
</style>
