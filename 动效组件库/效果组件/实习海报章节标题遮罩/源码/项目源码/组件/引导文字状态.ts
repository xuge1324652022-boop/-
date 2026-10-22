import type { InjectionKey, Ref } from 'vue'

/** 页面统一提供可见门禁，深层章节也不会在加载幕下消耗一次性入场。 */
export const referenceIntroductionGate: InjectionKey<Readonly<Ref<boolean>>> = Symbol('referenceIntroductionGate')

/** 海报页可限定一次性介绍的收尾位置；其它页面保留原有独立时序。数值为视口高度比例。 */
export const referenceIntroductionFinishAt: InjectionKey<number> = Symbol('referenceIntroductionFinishAt')

/** 页面可统一放慢双语介绍，默认倍率不影响其它子页。 */
export const referenceIntroductionPace: InjectionKey<number> = Symbol('referenceIntroductionPace')
