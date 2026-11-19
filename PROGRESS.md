# dsh-plugin-pack · 进度与断点

> 断点续做的唯一依据。停下前更新；下次先读本文件 + git log。

## 状态：1.0.0 已就绪，等网络恢复后推送

| 项 | 状态 |
|---|---|
| 改名 `@879745uhjun/dsh-plugin-pack`（npm 上 dsh-plugin-pack 已被他人占用） | 完成 |
| 版本 1.0.0 + publishConfig.access=public | 完成 |
| profile 迁移（依赖键 / bundles / junction） | 完成，备份 `.dsh/backups/scope-2026-11-19-02-16-43` |
| profile 的 pnpm-lock 重新同步（scoped 1 处，旧名 0 处） | 完成 |
| 本地提交 + tag `v1.0.0` | 完成（`9d082e7`） |
| `git push --follow-tags` | **阻塞**：github.com:443 连不上（4 次尝试，21s 超时） |
| GitHub Release | 待推送后执行 |
| `npm publish` | 待 npm 登录（本机 `npm whoami` 无输出） |

## 网络恢复后一条命令

```bash
bash tools/release.sh     # push → gh release create → npm publish（未登录会跳过）
```

## 环境注意

沙箱里跑 git/gh **必须** `</dev/null` + `GH_PROMPT_DISABLED=1`，否则会静默等在 stdin 上。
