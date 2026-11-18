# dsh-plugin-pack · 进度与断点

> 断点续做的唯一依据。停下前更新；下次先读本文件 + git log。

## 状态：M7/M8 代码完成，已 link 进 desktop profile，等重启验证

| 里程碑 | 内容 | 状态 |
|---|---|---|
| M0-M6 | 扫描 / 兼容性 / 打包 / CLI / 安装器 | 完成 |
| M7 | client 三 tab 页面（打包台 / 兼容性 / 导入） | 代码完成，未在真实 GUI 里看过 |
| M8 | host 路由（state/create/inspect/install） | 代码完成，collectState 冒烟通过（15 插件 / 1 诊断） |
| M9 | 重启 DSH 验证页面、截图、修样式 | 待做 |

## 已接入

- link 到 desktop profile：node_modules/dsh-plugin-pack → 仓库（junction）
- package.json：dependencies "link:D:/Deepseek work/workplace/dsh-plugin-pack" + bundles 追加
- cordis.patch.yml：第 95 行追加 - id: dsh-plugin-pack
- 备份：~/.dsh/backups/link-2026-11-18-00-28-44/
- 包目录：~/.dsh/plugin-packs/dsh-toolkit-1.0.0.dshpack（页面「导入」tab 读这里）

## 下一步

1. 重启 DSH → 侧边栏出现「插件包」→ 截图核对三 tab
2. 修样式/高度问题（页面用 height:100%，若容器无高度会塌）
3. 补：版本对齐（GitHub tag）按钮、locale.key 规则、agent 工具

## 回滚

node tools/link-self.mjs --unlink
（或从 ~/.dsh/backups/link-... 还原 package.json 和 cordis.patch.yml）
