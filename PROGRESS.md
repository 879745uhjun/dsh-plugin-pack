# dsh-plugin-pack · 进度与断点

> 断点续做的唯一依据。停下前更新；下次先读本文件 + git log。

## 状态：真机闭环已验证（安装 → 宿主加载 → 回滚）

| 里程碑 | 内容 | 状态 |
|---|---|---|
| M0-M8 | 扫描 / 兼容性 / 打包 / 安装 / CLI / 页面 | 完成 |
| M9 | 真机 UI 修复 | 完成 |
| M10 | 版本检查（本地 tag 优先）+ 冲突/降级三选一 | 完成 |
| M11 | pnpm 落锁 | 完成 |
| M12 | 安装前校验 + 配置备份 | 完成 |
| M13 | restore / 卸载 | 完成 |
| M14 | 两条规则：locale 命名空间冲突、runtime.platform | 完成 |
| **真机验证** | 装 dsh-pack-selftest → GET /selftest-ping 200 → restore 清理 | **通过** |
| M15 | Agent 工具 plugin_pack | 待做 |
| M16 | i18n / CI / 远端仓库 | 待做 |
| M17 | 版本对齐真升级（git pull 到最新 tag） | 待做 |
| M18 | 备份保留策略（只留最近 N 次） | 待做 |

## 真机验证记录（2026-11-18）

1. `tools/make-pack-from-dir.mjs` 把 `D:\Deepseek work\workplace\dsh-pack-selftest` 打成包
   （该插件只暴露 GET /selftest-ping，不碰任何现有插件）
2. `dsh-pack install --yes`：写 plugins/、建 junction、package.json(file:)、bundles、patch、备份
3. 重启 DSH 后 `curl /selftest-ping` → **200 {"ok":true,"plugin":"dsh-pack-selftest"}**
4. `dsh-pack restore latest`：plugins 目录、junction、manifest、patch 全部归零；lock 用
   `--pnpm <runtime>/pnpm.cjs` 重新同步后也归零

注意：CLI 在应用之外跑时找不到内置 pnpm，restore/install 要带
`--pnpm "D:/Tools/Deepseek DSH/resources/runtime/primary-runtime/dependencies/pnpm/bin/pnpm.cjs"`
（宿主内运行时会自动定位）。

## 下一步

1. Agent 工具：把 scan/create/install 暴露成 `plugin_pack` 工具
2. i18n（页面中文硬编码）+ CI + 建远端
3. 版本对齐真正升级插件代码
