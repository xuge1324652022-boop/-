# Job application template and animation source package

A Vue 3, TypeScript and GSAP portfolio template with 38 separately documented effects. The maintained public template uses fictional candidate information, reserved example.com contacts and procedurally generated sample media. Private résumés, portraits, original artwork and local output archives are excluded.

See the [Chinese guide](./README.zh-CN.md), [effect index](./动效组件库/组件索引.json), [source package instructions](./发布配置/源码资料包/安装与读取说明.md) and [privacy checks](./docs/公开内容与隐私检查.md).

Use Node 22.16+ (22.x) or Node 24.x. Run `npm ci`, then `npm run dev`. Run `npm run build:cloudflare` for the privacy and quality checks plus an offline production preparation. Deployment is an explicit separate step using environment-provided credentials and a configured hostname.

The published package `@xuge1324652022-boop/animation-source-package@0.2.2` contains Chinese source snapshots and machine-readable effect metadata for copying or agent inspection. It is not a precompiled component dependency. Download the audited website and component source archives from [Release v0.2.2](https://github.com/xuge1324652022-boop/job-application-template/releases/tag/v0.2.2).

The repository uses [MIT](./LICENSE) for original code and documentation. Third-party tool marks retain their respective terms; see [NOTICE](./NOTICE.md).
