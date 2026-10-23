# 素材与研究脚本

这些工具不参与浏览器运行。Python 工具按任务使用 Pillow、pypdf、pdfplumber、Poppler 或 FFmpeg；先阅读脚本顶部参数，不要将生成脚本当作只读检查运行。公开版本只使用程序生成的虚构示例，私人原件放在被忽略的本机目录，公开构建、素材服务与交付包均不能回读它们。

| 脚本 | 输入 → 输出与作用 |
| --- | --- |
| `生成动效组件库.mjs` | `src/` 与 `动效组件库/效果定义/` → 中文命名的每效果独立源码包、解析 JSON 与组件索引；`--write` 更新，`--check` 只读校验 Schema、依赖闭包、GSAP覆盖、源码哈希及目录一致性 |
| `打包源码资料包.mjs` | 包配置与中文动效组件库 → `tmp/源码资料包/` 内可安装的 npm 源码资料包；只复制白名单内容，并校验实际 `.tgz` 文件 |
| `发布源码资料包.mjs` | 仅在本仓库 main 分支的 GitHub Actions 中发布已核验 `.tgz` 到 GitHub Packages；相同版本内容一致时跳过，不同内容要求增加版本号 |
| `打包发布版本.mjs` | 指定 Git 提交 → 网站源码 ZIP、中文动效组件库 ZIP 与 SHA-256 校验清单；仅打包已提交内容，默认写入 `tmp/发布/<版本>/`，不上传或覆盖已有文件 |
| `生成模板示例素材.py` | 生成不含真实人物、履历和音轨的几何图片、静音视频与空白简历；原件先保存到本机私有目录，公开素材以审核清单登记；`--static-images-only` 仅刷新已登记静态合成图，不改 PDF 或视频 |
| `检查公开隐私.mjs` | 检查 Git/index/工作区、所有文本及公开素材；拒绝私人目录、联系方式、凭据、符号链接、未审核二进制与暂存差异 |
| `verify-public-privacy.mjs` / `verify-public-media-isolation.mjs` | 无网络 Git 夹具与素材夹具，覆盖漏扫扩展、忽略资源、暂存差异及私人原片隔离 |
| `build-portfolio-images.py` | 默认与 `--verify` 只读核验公开 manifest 登记的摄影、海报三档图片；`--probe` 加印尺寸与字节数；按 `sample-photo-编号` / `sample-poster-编号` 动态分组，不读取私人目录或转换原片 |
| `_contact-sheet.py` | 已审核公开示例 → 仓库 `tmp/contact-sheets/` 内的摄影、海报联系表；复用动态 manifest 映射，先核验哈希、尺寸、元数据，不改公开图片 |
| `build-color-previews.py` | 历史本机原片转换工具，可写入 public；公开模板不得直接采用其私人原片输出 |
| `build-color-media.py` | 历史本机原片 → 被忽略的 media/color；公开服务和发布助手不读取该目录 |
| `build-internship-posters.py` | 默认与 `--verify` 只读核验公开 manifest 登记的 `public/internship-clean/` 合成海报三档图片；`--probe` 加印信息；旧 PDF 转换功能已移除，不读取任何 PDF 原件 |
| `build-logo-free-internship.py` | 兼容旧命令名，现为 `build-internship-posters.py` 的只读核验入口；不转换原件、不移除标志；去除标志本身不能保证资料已经脱敏 |
| `verify-photo-story.mjs` | 摄影章节行程的纯数学边界与停留检查 |
| `verify-internship-motion.mjs` | 海报入场、收拢、逐页观看、回退及箭头定位的纯数学检查 |
| `verify-runtime-navigation.mjs` | 真实源码的路由/触摸/开场清理回归，含真实 GSAP 上下文交接测试 |
| `verify-mobile-overlays.mjs` | 弹层内部滚动、边缘防透滚、缩放与触屏索引入口回归 |
| `verify-wechat-color-media.mjs` | 实际视频函数的拒播手动重试、异步取消、离屏释放与多指边界 |
| `verify-about-mobile-runtime.mjs` | 短屏人物段分支、联系球窄屏横移边界 |
| `verify-mobile-artwork.mjs` | 擦入/倒滚可见层与旧内核完整原稿回退；实际触摸命中另见浏览器报告 |
| `media-http.mjs` / `verify-media-http.mjs` | 本机调色视频静态服务的Range/HEAD/416与中断释放，以及实际HTTP回归 |
| `build-release.py` | 隐私门禁、新鲜构建和审核快照 → 纯模板部署 ZIP 与仅含 Git 文件的源码 ZIP；不收原件或 Git 历史，Python 3.12+ |
| `verify-release.py` | Git 文件归档、私人目录拒绝、ZIP边界回归；`--delivery <交付目录>`核对 sourceArchive、素材审核摘要和动态媒体清单 |
| `cloudflare-assets.mjs` | 只从审核后的 dist/public 示例准备素材；清单和上传前再次核对字节，绝不回退本机原件 |
| `cloudflare-ci.mjs` | Workers Builds 发布入口；使用 dist 与已提交的合成示例清单，默认仅离线准备，`--deploy` 才显式发布 |
| `verify-cloudflare-ci.mjs` | CI 素材协议、metadata 保留、提交门禁与失败链路的 mock 回归；不访问网络、不使用真实凭据或部署，临时夹具位于 `tmp/cloudflare-ci/` |
| `archive-reference-research.py` | 既有分析 → 中文本机档案；逐字节复制并登记SHA256，不覆盖不同内容 |
| `extract-reference-supplement.py` | 已保存的REA记录 → 截图、DOM、可访问文本、运行时索引；保留失败状态 |
| `reference-contact-sheets.py` | 已保存稳定帧 → 对照联系表；不代表连续滚动测量 |
| `build-reference-archive.py` | 原始研究、摘要和参数 → 章节报告、索引、阅读器及来源清单 |
| `reference-archive-viewer.html` | 阅读器模板，由上一脚本嵌入索引；不直接抓取参考站 |
| `verify-reference-archive.py` | 核对原件/副本哈希、引用字节、截图和索引的完整性，输出校验记录 |

```sh
npm run check:privacy
npm run check:motion
python scripts/build-portfolio-images.py --verify
python scripts/build-internship-posters.py --verify
python scripts/_contact-sheet.py
node scripts/verify-public-privacy.mjs
node scripts/verify-public-media-isolation.mjs
python scripts/verify-release.py
node scripts/verify-photo-story.mjs
node scripts/verify-internship-motion.mjs
```

资源生成是显式操作，不应在每次 build 时重跑。历史原件转换和研究脚本仅用于本机维护；输出经过替换、授权及隐私审核后才能进入新的公开清单。不能仅凭改名、去标志或加入 gitignore 宣称文件已经脱敏。

Cloudflare 自动部署使用 `npm run build:cloudflare` 依次完成动效源码包一致性检查、类型检查、部署回归、网页构建和离线准备，再由 `npm run deploy:cloudflare` 显式发布。CI 不读取 dotenv、本机账号配置或完整成片目录；部署所需的 `CLOUDFLARE_ACCOUNT_ID`、`CLOUDFLARE_API_TOKEN` 由构建环境提供。私有仓库提交校验复用隔离构建环境的 Git 授权，不提取或回显凭据。部署入口要求原生 Workers Builds 的 `main` 构建上下文，并核对检出提交及最新分支提交，不能将其当作跨构建锁，生产发布需保持串行。

`deploy/media-manifest.json` 登记的是公开合成视频的路径、hash 和大小，当前文件直接来自 public/color。不能从旧站恢复私人媒体。添加或替换示例需同步素材审核清单与媒体清单；本地字节与清单不符时停止发布。

实际远程发布与验收状态以对应提交的工作流结果为准。源码中的 example.com 与账户占位符须由使用者在自己的部署环境配置，不能把历史上线记录当作当前模板已完成部署的证据。

`outputs/` 和本机私有资料仅保留在本地，不属于源码包或公开交付。同步时按 Git 文件清单操作，不能枚举整个工作目录上传；旧 Release、旧包和 Git 历史的清理状态见[公开内容与隐私检查](../docs/公开内容与隐私检查.md)。
