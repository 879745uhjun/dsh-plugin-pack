# dsh-plugin-pack · 进度与断点

> 断点续做的唯一依据。停下前更新；下次先读本文件 + git log。

## 状态：1.0.0 已发布并在真机验证通过

- 仓库：https://github.com/879745uhjun/dsh-plugin-pack
- 发布：https://github.com/879745uhjun/dsh-plugin-pack/releases/tag/v1.0.0
- 包名：`@879745uhjun/dsh-plugin-pack`（npm 上 `dsh-plugin-pack` 被他人占用）
- 真机：重启后 `GET /plugin-pack/state` → 200（scoped bundle 正常加载）

| 项 | 状态 |
|---|---|
| 改名 + profile 迁移（deps / bundles / junction）+ lock 重同步 | 完成 |
| 本地 tag v1.0.0 + 远端 tag + Release | 完成 |
| 页面三 tab + 深浅色 + en/zh | 完成 |
| Agent 工具 plugin_pack | 完成 |
| 6 条兼容规则 / 原子安装 / 回滚 / 降级保护 / pnpm 落锁 | 完成 |
| npm publish | **待登录**：`npm login` 后 `npm publish --access public` |
| dshmarket 上架 / 市场元数据 | 未做 |

## 网络与沙箱注意

- git/gh 必须 `</dev/null` + `GH_PROMPT_DISABLED=1`，否则静默挂在 stdin
- github.com:443 偶发连不上，重试即可

## 备份

- profile 迁移前：`.dsh/backups/scope-2026-11-19-02-16-43/`
- 每次安装：`.dsh/backups/<时间戳>/`（可用 `dsh-pack restore` 回滚）
