# dsh-plugin-pack · 进度与断点

> 这是断点续做的唯一依据。每次停下前更新它；下次从「下一步」接着做，git log 看改动。

## 状态：M2 完成（兼容性引擎 4/6 规则）

| 里程碑 | 内容 | 状态 |
|---|---|---|
| M0 | 脚手架、zip 读写、测试 | 完成 |
| M1 | 扫描 profile（插件 / 版本 / engines / 槽位 / 配置） | 完成 |
| M2 | 兼容性引擎：slot.unique / engine.range / dep.version / version.latest | 完成（缺 locale.key、runtime.platform） |
| M3 | 打包 dshpack（manifest + checksums） | 待做 |
| M4 | CLI create / inspect / verify | 待做 |
| M5 | 安装器（备份 / 改 package.json / bundles / 回滚） | 待做 |
| M6 | CLI install + 真机演练 | 待做 |
| M7 | client 页面三 tab + 深浅色 | 待做 |
| M8 | host 路由 + 工具 + 联调 | 待做 |

## 实测数据（2026-11-17，desktop profile）

- bundles 22 个，其中第三方 15 个（13 个自制 + dsh-whale-widget / dshmarket / dsh-ops）
- 版本与本机实测：stars 1.2.0、todos 0.2.0、boxes 0.6.0、notify 0.3.1、quickbar 0.1.1、
  broadcast 0.3.2、transfer 1.0.2、token-usage 1.4.1、notepad-card 4.3.1、sidebar-pin 0.1.2、
  approval-zh 0.2.1、running-sessions 0.1.2
- 自制插件 engines 基本是 >=0.2.2-rc.1 <0.3.0（stars 是 <0.2.3-0）
- 槽位（真实）：quickbar 有 sidebar.workspaces.session.row.action；sidebar-pin 是 sidebar.footer.action
  → mockup 里「quickbar ↔ sidebar-pin 抢 row.action」不成立，真实冲突要按扫描结果重算

## 下一步

1. lib/pack.mjs：manifest + checksums + 目录打包（用 lib/zip.mjs）
2. bin：create / inspect / verify 三命令跑通
3. 用真实 profile 打一个包，解压核对文件树

## 断点续做规则

- 每个里程碑结束：更新本文件 → git commit（消息里写 M 编号）
- 新会话恢复：先读 PROGRESS.md + git log，再看 mockup（../plugin-pack-mockup/v2/）
- 设计决策改动必须同步 mockup 与 README，避免图和代码分叉
