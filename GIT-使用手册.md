# Git 使用手册

当前仓库：[xuge1324652022-boop/job-application-template](https://github.com/xuge1324652022-boop/job-application-template)，主分支为 `main`。日常使用标准 Git，同步前先检查并提交当前成果。

## 存档和同步

```sh
git status --short
git diff
npm run typecheck
npm run build
git add -A
git diff --cached --stat
git commit -m "说明本次完成的内容"
git fetch origin
git log --oneline --left-right HEAD...origin/main
git push origin main
```

暂存前核对 `.gitignore`：原始作品、完整视频、本机工具、账号环境变量、临时目录和运行采样仅保留本地。`git add -A` 会包含删除操作，务必检查暂存清单；它不会备份被忽略的素材。

推送后验证 `git ls-remote origin refs/heads/main` 的提交号与 `git rev-parse HEAD` 一致。代码同步不代表网站已经部署；完整调色视频需要另外提供，详见 README。

## 遇到分叉

先保留本地提交，再查看远程变更。正常协作时使用 `git merge origin/main`，解决冲突并复查构建后推送。不要为了省事使用强制推送，不要把工作目录 `reset --hard` 到远程覆盖未保存成果。

2026-10-16 核对发现两份早期重建历史没有共同祖先。远程独有的代码为已经退役的 About 组件，本机包含后续页面与动画成果。本次同步以审核过的当前树为准，将远程历史作为合并父提交保留，避免复活旧版组件。此处理只适用于本次已核对的历史，日常分叉不可直接套用。

## 试验与恢复

```sh
git switch -c codex/animation-experiment
# 完成改动后检查、提交；需要合并时回到 main。
git switch main
git merge codex/animation-experiment
```

需要撤销已同步的改动时，优先 `git revert <提交号>` 生成反向提交，保留协作历史。只恢复一个未提交文件之前，先用 `git diff -- <路径>` 核实并另存需要的修改，再使用 `git restore -- <路径>`。恢复操作会覆盖对应文件的未提交改动。

旧版手册保存在 `docs/历史说明/`，其中的 `master`、底层对象搬运和 API 重建流程不是当前日常操作方式。
