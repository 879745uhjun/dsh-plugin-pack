# dsh-plugin-pack · 进度与断点

> 断点续做的唯一依据。停下前更新；下次先读本文件 + git log。

## 状态：M11 完成（安装器会同步 pnpm 锁）

| 里程碑 | 内容 | 状态 |
|---|---|---|
| M0-M8 | 扫描 / 兼容性 / 打包 / 安装 / CLI / 页面 | 完成 |
| M9 | 真机 UI 修复（白底白字、自列、默认全选、列宽） | 完成 |
| M10 | 版本检查（本地 tag 优先）+ 冲突/降级三选一 | 完成 |
| M11 | pnpm 落锁：安装后 `pnpm install --lockfile-only` | 完成（真机 profile 已同步） |
| M12 | restore / 卸载命令 | 待做 |
| M13 | locale.key、runtime.platform 两条规则 | 待做 |
| M14 | i18n、CI、远端仓库 | 待做 |

## 真机状态（重要）

- desktop profile 的 pnpm-lock.yaml 已包含 `dsh-plugin-pack: link:D:/…`（备份在 `.dsh/backups/lock-20261118-121035`）
- 安装器每次实际写入后都会调用 `syncLockfile`；失败只警告，不回滚（lock 不影响已写文件）
- 克隆 profile 上的完整演练：12 动作 / 3 写入 / bundles 21 / deps 17 / patch 14 / 二次 no-op

## 下一步

1. restore 命令：从 .dsh/backups/<ts> 还原 package.json / cordis.patch.yml / 删除本次写入的 plugins
2. 两条规则：locale.key（locale/zh.json 键重叠）、runtime.platform
3. i18n + CI + 建远端
