# Cloudflare 公开模板上线指南

此文档说明当前脱敏模板的部署流程。https://portfolio.example.com 是保留示例地址，不能当作实际已上线站点。旧个人网站的版本、交付目录和私人媒体不能用来恢复公开模板。

## 部署配置

- deploy/cloudflare-assets.json：静态资源、路径、缓存和媒体 Worker 配置模板。
- deploy/site-config.json：站点根网址；构建环境可通过 SITE_ORIGIN 覆盖。
- deploy/media-manifest.json：当前合成示例视频的路径、hash 和大小，不登记私人原片。
- deploy/media-range.mjs：媒体及简历的 HEAD、Range/206/416，以及未知页面的 404。
- deploy/cloudflare-builds.json：构建连接示例；账户、仓库和 Worker 配置由使用者在自己的环境完成。

实际部署前配置自己的站点、Worker 与构建环境。账户 ID 和 API token 通过构建环境提供，不写入源码、组件 JSON、安装包或日志。默认 example.com 配置会阻止真实发布。

## 构建与检查

审阅并暂存公开修改后执行：

```sh
npm ci
npm run build:cloudflare
```

该命令执行隐私门禁、源码质量及组件一致性检查、单元和部署 mock、生产构建与路由 head/404 核验，最后只生成离线发布快照，不上传或修改线上版本。

正式发布由已配置的 Workers Builds main 构建执行 npm run deploy:cloudflare，并核对构建上下文、检出提交和分支状态。失败时不能宣称发布成功；具体状态以本次提交的远程执行结果为准。

## 媒体来源

公开图片、两页空白简历和静音视频由程序生成，并登记在 public/模板素材清单.json。视频直接来自 public/color；本机作品/、media/color、真实简历和旧站成片均不作为公开模板的兜底来源。

手动准备素材时也必须使用同一审核入口，并提供不存在的新目录：

```sh
node scripts/cloudflare-assets.mjs prepare 网站部署文件/公开模板下一版
node scripts/cloudflare-assets.mjs manifest 网站部署文件/公开模板下一版
```

准备、manifest 检查和显式上传前均验证公开字节。未知二进制、过期快照、素材与审核摘要不一致会被拒绝。上传只使用本次临时上传会话，不把上传令牌保存成项目文件；不能直接复用历史私人素材快照。

媒体大小绑定必须依据本次清单生成，不能沿用旧 PDF 或视频大小。增加素材后同步审核清单、媒体清单和相关组件，再重新构建。

## 上线验收

配置实际站点并完成发布后，用对应审核快照进行只读验证：

```sh
node scripts/verify-cloudflare-live.mjs https://portfolio.example.com 网站部署文件/公开模板下一版
```

命令中的示例域名应替换为自己的已发布地址。确认各路由独立 head、旧链接跳转、未知路径和缺失资源真实 404、全部清单媒体的 HEAD/Range、简历下载，以及文件与本次发布摘要一致。

本地 mock、构建成功和 HTTP 检查不等于真实手机交互、微信分享卡片或中国大陆各网络连通性验收；这些项目需要对应客户端和网络的实测。旧 Release、旧包及 Git 历史的隐私处理另见[公开内容与隐私检查](./公开内容与隐私检查.md)。
