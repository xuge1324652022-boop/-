# 求职应聘模板与动效源码包

Vue 3、TypeScript 与 GSAP 实现的求职展示模板，配套 38 个中文动效目录、源码副本、集成说明和 agent 可读 JSON。网站只使用明确虚构的人物、经历、保留示例邮箱和程序生成的几何素材，不包含发布者的私人简历或肖像。

## 使用

支持 Node 22.16+ 的 22.x 与 Node 24.x。

```sh
npm ci
npm run dev
npm run build:cloudflare
```

开发服务默认只监听本机。`build:cloudflare` 运行隐私、代码、类型、单元测试、部署 mock、动效同步、图片和生产构建检查，仅准备部署，不上传。

## 中文组件与源码包

先读取 [组件索引](./动效组件库/组件索引.json)，再读取每个效果文件夹中的介绍与解析 JSON。修改原始源码后运行 `npm run build:motion` 与 `npm run check:motion`，确保所有副本一致。

GitHub Packages 的 `@xuge1324652022-boop/animation-source-package` 是供复制和 agent 读取的源码资料包，不是开箱运行的组件依赖。安装方式见 [源码资料包说明](./发布配置/源码资料包/安装与读取说明.md)。0.2.2 已发布；已核验的网站源码、中文动效组件源码、发布元数据及校验表见 [Release v0.2.2](https://github.com/xuge1324652022-boop/job-application-template/releases/tag/v0.2.2)。

## 结构与部署

八个正式路由为 /、/cards、/about、/edit、/color、/news、/poster、/photo；每页有独立静态 head，坏链返回独立 404。

导航时序由 `useRouteCurtainNavigation()` 管理；`PageCurtain` 负责视觉。五类卡片子组件、画廊渲染器和页面数据分别维护。身份、履历数据均为虚构模板，位于 `src/data/aboutProfile.ts`；原始源码位于 `src/`，中文导出位于 `动效组件库/`。

公开图片、简历和视频均为合成示例，`public/模板素材清单.json` 登记其审核摘要。替换资源前须自行确认公开范围，并更新清单及隐私检查。开发预览只读取公开模板视频，绝不自动读取本机作品目录。站点根网址见 `deploy/site-config.json`，默认 example.com，部署账号通过环境变量提供。仓库不会自动发布私人作品。

本机私有资料、旧截图、历史输出及原件不属于源码，不能强行加入 Git 或发行附件。旧版本的隐私清理状态见 [公开内容与隐私检查](./docs/公开内容与隐私检查.md)。

相关说明：[质量与测试](./docs/代码质量与测试.md)、[整改记录](./docs/代码审计整改记录.md)、[许可](./LICENSE)、[第三方来源](./NOTICE.md)。
