// 让 TypeScript 认识 .vue 单文件组件的导入。
// 没有这份声明，每一个 `import Xxx from './Xxx.vue'` 都会报「找不到模块」。
// 这里只提供模块级兜底；模板与具体 props 类型仍由 vue-tsc 对单文件组件检查。
declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, unknown>
  export default component
}
