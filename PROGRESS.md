# dsh-plugin-pack · 进度与断点

> 断点续做的唯一依据。停下前更新；下次先读本文件 + git log。

## 状态：UI 已上真机，补齐「版本提示 + 冲突处置」

| 里程碑 | 内容 | 状态 |
|---|---|---|
| M0-M6 | 扫描 / 兼容性 / 打包 / 安装 / CLI | 完成 |
| M7-M8 | 页面三 tab + host 路由 | 完成并在真实 GUI 上跑通 |
| M9 | 真机问题修复：按钮白底白字、自列、默认全选、列宽 | 完成（e389d14） |
| M10 | 版本检查（/plugin-pack/latest）+ 冲突逐项处置（跳过/覆盖/中止） | 代码完成，待重启验证 |
| M11 | 安装器改走 pnpm add 落锁 | 待做 |
| M12 | 工程化：LICENSE / icon / README.zh / locale / CI | 待做 |

## 本轮新增

- host：GET 之外新增 POST /plugin-pack/latest（并发 git ls-remote，8s 超时，逐个 repo 报错不阻断）
- host：install 接受 abort=true；dryRun 返回 conflicts（包内插件 vs 本机已装，按 slot.unique 判定）
- client：包设置里「检查更新」→ 版本列显示 ↑ 最新版；create 带上 align+latest 写进 manifest
- client：预检结果里冲突插件显示 跳过/覆盖/中止 三选一，安装时转成 skip/abort
- 测试 34 条：highestTag 解析、manifest.align.latest、listPacks/readPack 契约

## 下一步

1. 重启验证 /latest 与冲突 UI（GitHub 不可达时页面应显示"N 个失败"而不是卡住）
2. 安装器改走 pnpm add（避免用户以后 pnpm install 冲掉 junction）
3. 工程化收尾
