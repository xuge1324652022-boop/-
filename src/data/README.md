# 内容数据与素材清单

页面组件负责交互，数据文件负责内容、来源和编排。双语文本使用 `Bi = { zh, en }`；修改时同时维护两种语言，不在组件中另存一份相同事实。

| 文件 | 职责与修改边界 |
| --- | --- |
| `chapters.ts` | 六张首页卡片的编号、标题、顺序与环境动画相位。实际路径集中在 `useTransition.ts`。 |
| `aboutProfile.ts` | 简历身份、完整经历、技能、公开联系信息及既有组件的兼容案例接口。经历数字以原简历为准。 |
| `resumeEmphasis.ts` | 简历加粗片段到网页 `strong` 的映射；不会改写正文或自动把所有数字加粗。 |
| `aboutDividers.ts` | 关于我各区间之间的双语导语。 |
| `aboutCampaign.ts` | 人物定位及保留的早期 AI 方法文案；当前五个交互页签使用 `creativeProcess.ts`。 |
| `creativeProcess.ts` | 当前五步工作流的判断、工具辅助与交付形式。`tools` 使用 `aiTools.ts` 的稳定 id。 |
| `aiTools.ts` | 六个工具的图标路径、职责说明和资料来源；不是技能认证或业绩记录。 |
| `foundationPages.ts` | 剪辑、新闻基础页的主题研究。正式作品迁入前，不把这些示例当客户案例。 |
| `visualPortfolio.ts` | 个人摄影、军事海报和封面练习的素材登记、比例、替代文本与路径。 |
| `photoPage.ts` | 摄影分章、画廊顺序与文案；素材通过 `visualById` 引用。 |
| `posterPage.ts` | 个人海报与编辑设计的文案、排序；不混入实习产品版面。 |
| `internshipPosters.ts` | 连接两份 PDF JSON 清单、筛选公开展位并构造干净图片地址。 |
| `internshipPosterMotion.ts` | 实习版面的组别主题、标题裁片与归一化坐标。 |

## PDF JSON 契约

JSON 保持标准格式，不能直接加入 `//` 或块注释；字段含义在这里维护。

`internship-poster-plan.json` 是人工编排来源，每个组包含：

- `id`：稳定组别键，供素材文件名、筛选和动效主题连接使用。
- `file`：本地原 PDF 的文件名，不是公开网站 URL。
- `title`、`description`：双语展示内容。
- `pages`：原 PDF 页号与双语标题；`page` 从 1 开始。保留完整转换清单，网页选择另由 `posterPageSelection` 决定。

`internship-poster-assets.json` 由 `scripts/build-internship-posters.py` 生成，每条包含：

- `id`：`<group>-<两位页号>`，例如 `demo-measure-12`。
- `group`、`page`：连接 plan 的复合键；不能拿筛选后的显示序号代替原页号。
- `width`、`height`：PDF 页面点数乘 100 后取整，仅提供宽高比，**不是实际 WebP 像素数**。

这些历史内部 id 用于连接已生成文件，不代表网页必须显示对应品牌文字。网页与查看器统一读取 `public/internship-clean/`；原始转换预览留在本机 `参考资料/实习原始转换预览/`，不随 `public/` 上线。更换图片时同步 `previewVersion`，让开场、卡片和查看器同时更新缓存；重新生成图片后运行 `node scripts/生成响应式图片清单.mjs` 更新真实像素宽度。

## 素材与校验

个人作品输出由 `scripts/build-portfolio-images.py` 维护；PDF 原始转换由 `scripts/build-internship-posters.py` 维护；清理后的品牌图片由现有干净素材流程维护。不要用原始转换覆盖已清理的图片。

显示尺寸分三档：默认 1600、查看器 / 大屏 2560、缩略图 400，数值指最长边上限。图片加载前通过登记的比例预留空间，避免布局跳动。

开发期断言分别检查简历双语与关联、个人作品命名空间、完整素材覆盖，以及摄影分章是否恰好覆盖每张照片。它们验证数据结构与引用，不能代替人工核实内容事实。
