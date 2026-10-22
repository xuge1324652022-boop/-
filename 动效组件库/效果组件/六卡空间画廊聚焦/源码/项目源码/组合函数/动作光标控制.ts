import { ref } from 'vue'

/**
 * 画廊共享的指针交互状态。
 *
 * 普通内容、输入控件和触屏保留原生指针。CustomCursor 仅在声明了真实动作的
 * 作品命中区域显示参考站的实心点与动作文字，不绘制全站圆环。
 * 可用 data-cursor="Explore"（或 data-cursor-label）声明动作，附
 * data-cursor-zh / data-cursor-en 提供双语；data-cursor="native" 放行原生控件。
 * 默认白色 difference 自动与素材反相；纯色舞台可用 data-cursor-blend="normal"
 * 搭配 data-cursor-color 指定该舞台的对比色。滚动、inert、查看器与幕布改变时，
 * CustomCursor 按最后坐标重新命中；只在场景变化后短时检查，不常驻逐帧读全页。
 * 画廊在拖拽 / 锁定（detail / focusing / returning）阶段继续写入原有状态；
 * drag 显示原生 grabbing，locked 暂停动作光标，null 允许局部提示。
 *
 * 为什么放模块级 ref 而不是走 props/emit：画廊（`ThreeHome`）与 `CustomCursor`
 * 没有父子关系（状态管理组件挂在 App.vue），props/emit 反而绕。
 */
/** 只在**本文件内**用（给 `cursorLockState` 定型），外部靠字面量写入即可 ——
 *  导出它会被 `_audit-dead-exports.cjs` 判成没人 import 的死导出。 */
type CursorLock = 'drag' | 'locked' | null

export const cursorLockState = ref<CursorLock>(null)
