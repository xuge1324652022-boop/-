# AI 工具图标与内容来源

核对日期：2026-10-15

用于「关于我」页面的工具展示，素材保存在 `public/ai-tools/`，对应内容保存在 `src/data/aiTools.ts`

这批标识均来自工具官方网站公开静态资源、官方文档内的矢量标识或本机安装的官方应用包，没有使用第三方图标站，也没有重新绘制品牌形状

## 素材清单

| 工具 | 本地文件 | 来源页面 | 原始素材或获取方式 | 尺寸 / 大小 |
| --- | --- | --- | --- | --- |
| Kimi | `public/ai-tools/kimi.png` | [Kimi 官网](https://www.kimi.com/) | 官网 `apple-touch-icon` 声明指向的 [pwa-192.png](https://www.kimi.com/pwa-192.png)，原文件保存 | 192 × 192 / 21,645 bytes |
| 豆包 | `public/ai-tools/doubao.png` | [豆包官网](https://www.doubao.com/chat/) | 官网 `icon shortcut` 声明的 [192 × 192 图标](https://lf-flow-web-cdn.doubao.com/obj/flow-doubao/favicon/new-doubao/192x192.png)，原文件保存 | 192 × 192 / 34,367 bytes |
| 千问 | `public/ai-tools/qianwen.png` | [千问官网](https://www.qianwen.com/) | 官网浅色模式 `shortcut icon` 和 `og:image` 使用的 [官方 PNG](https://img.alicdn.com/imgextra/i2/O1CN01taBbMS1CfyJoOt0lB_!!6000000000109-2-tps-80-80.png)，原文件保存 | 80 × 80 / 1,658 bytes |
| 腾讯元宝 | `public/ai-tools/yuanbao.png` | [元宝官网](https://yuanbao.tencent.com/) | 官网 `twitter:image` / `og:image` 声明的 [logo_with_bg.png](https://static.yuanbao.tencent.com/m/yuanbao-web/logo_with_bg.png)，原文件保存 | 160 × 160 / 4,176 bytes |
| ChatGPT | `public/ai-tools/chatgpt.svg` | [OpenAI 官方文档](https://learn.chatgpt.com/docs/cli) | 提取官方文档顶栏 ChatGPT 标识的首个完整 SVG，保留原始 path；只补充独立文件所需的 XML 命名空间，设为 96 × 96 与黑色填充，去除页面 CSS class | SVG / 约 2 KB |
| Codex | `public/ai-tools/codex.png` | [Codex 官方文档](https://learn.chatgpt.com/docs/cli) | 复制本机官方应用包 `OpenAI.Codex_26.1007.9446.0_x64__2p2nqsd0c76g0/assets/Square44x44Logo.targetsize-256_altform-unplated.png`，保留原始 PNG | 256 × 256 / 9,264 bytes |

Codex 素材是白色透明标识，数据字段 `logoTone: 'light'`，需要放在深色表面上；其他素材使用 `logoTone: 'original'`

千问官方原文件为 80 × 80，浮动标识建议控制在 48–64 CSS px 范围，详细介绍中以工具名称排版补充，不将此位图放大成主视觉

## 能力文案的核对依据

文案以个人创作中的使用方式为中心，不写工具排名、付费权限、模型版本、保证性结论或未经证实的履历成绩

- **Kimi**：[官方新用户指南](https://www.kimi.com/en/help/new-user-guide/overview) 列出联网搜索、长文本、文件处理、写作等能力。页面介绍据此安排为资料阅读、主题梳理与方案比较
- **豆包**：[官方桌面端介绍](https://www.doubao.com/download/desktop) 列出截图理解、翻译、写作、搜索与图像生成。[官方功能介绍](https://www.doubao.com/legal/feature_intro) 说明创作与对话能力。页面介绍据此安排为创意发散、图像试验与文案变体
- **千问**：[官网](https://www.qianwen.com/) 的页面描述与结构化产品信息列出 AI 搜索、网页总结、AI PPT、图像生成、文档和表格处理。页面介绍据此安排为文档整理、演示提纲与双语表达
- **腾讯元宝**：[官网](https://yuanbao.tencent.com/) 提供搜索、对话问答与创作入口。页面介绍据此安排为背景检索、问题拆解与观点交叉阅读，不承诺特定检索覆盖范围或准确率
- **ChatGPT**：[OpenAI 官方网页使用说明](https://learn.chatgpt.com/docs/web) 说明研究、分析、创建文件与迭代任务；[官方图像输入说明](https://learn.chatgpt.com/docs/image-inputs) 说明通过图片与截图提供视觉上下文。页面介绍据此安排为研究整合、双语文案与视觉推敲
- **Codex**：[OpenAI 官方 CLI 文档](https://learn.chatgpt.com/docs/cli) 说明在代码库中处理任务、编辑与验证；[官方云端说明](https://learn.chatgpt.com/docs/cloud) 说明排查错误、实现功能与审查结果。页面介绍据此安排为页面实现、交互动效、调试与验证

产品功能会变化，以上记录用于留存这次页面内容的依据，不意味着品牌与作品集之间存在合作或背书关系

## 数据接口

`AI_TOOLS` 为 6 个 `AiTool` 对象，字段包括：

```ts
id: string
name: string
english: string
src: string
roleZh: string
roleEn: string
detailZh: string
detailEn: string
tasksZh: readonly string[]
tasksEn: readonly string[]
sourceUrl: string
accent: string
logoTone: 'light' | 'original'
```

短介绍用于照片上浮动标识的选中状态，长介绍与任务词组可用于下方展开区域。中文和英文均省略结尾句号，以保持当前网站的展示习惯

## 原文件校验

```text
kimi.png     SHA-256 6c14f9c3062e953b3ed57ae3e19db931c1c1bba38d4d8d55550544f31d55e469
doubao.png   SHA-256 dabb2abd94e3a6c11e7f1a42c9343839b6ef643c086751b71afbc68f615aec38
qianwen.png  SHA-256 cd9390bc4209c319121d111f3a1f535b3c7dd909b8f860d41acc9744138d58df
yuanbao.png  SHA-256 8f3ae0d03e06de5e3f3179d05045f0915e9548d3e74bd8bfe2969d2ddea902c5
```

网络读取时，国内四个站点通过直连成功获取，OpenAI 官方文档通过会话已有网络设置获取；本任务没有修改系统代理、浏览器配置或任何全局设置
