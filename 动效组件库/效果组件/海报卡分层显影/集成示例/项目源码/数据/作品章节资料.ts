// 章节元数据的唯一来源。
//
// 六章顺序、显示文字（编号 / 标题 / 副标题）、以及相位偏移（决定
// 每张卡片环境循环首次启动的时刻）。改这里即可同时影响：
//   · ThreeHome 的章节索引面板（侧边与全屏）
//   · cardAnimations/index.ts 的 CARD_ANIMATION_REGISTRY（构造器 delay）
// 验证脚本另外校验「01 ABOUT / 02 EDIT / ...」对应关系；新增或改序需同步检查断言。
//
// ⚠️ 长度是 6 —— 改这个数字会影响校验脚本（gallery-layout 6 卡 + 主测试
// 4 视口 × 6 卡 × 241 帧扫描），以及 index.ts 的注册表行数。
export interface Chapter {
  key: 'about' | 'edit' | 'color' | 'news' | 'poster' | 'photo'
  number: string
  title: string
  subtitle: string
  delay: number
}

export const CHAPTERS: readonly Chapter[] = [
  { key: 'about',  number: '01', title: 'ABOUT',   subtitle: '关于我',     delay: 0.0 },
  { key: 'edit',   number: '02', title: 'EDIT',    subtitle: '剪辑',       delay: 1.2 },
  { key: 'color',  number: '03', title: 'COLOR',   subtitle: '调色',       delay: 2.8 },
  { key: 'news',   number: '04', title: 'NEWS',    subtitle: '新闻影像',   delay: 0.7 },
  { key: 'poster', number: '05', title: 'POSTER',  subtitle: '海报',       delay: 3.4 },
  { key: 'photo',  number: '06', title: 'PHOTO',   subtitle: '摄影',       delay: 1.8 },
]
