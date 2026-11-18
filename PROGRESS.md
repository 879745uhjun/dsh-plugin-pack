# dsh-plugin-pack · 进度与断点

> 断点续做的唯一依据。停下前更新；下次先读本文件 + git log。

## 状态：已发布到 GitHub

- 仓库：https://github.com/879745uhjun/dsh-plugin-pack （public，默认分支 master）
- 本地分支 master 跟踪 origin/master

| 项 | 状态 |
|---|---|
| 扫描 / 兼容性（6 规则）/ 打包 / 安装 / 回滚 | 完成 |
| 三 tab 页面 + 深浅色 + en/zh 字典 | 完成 |
| Agent 工具 plugin_pack | 完成 |
| pnpm 落锁（install + restore） | 完成 |
| 安装前校验 / 配置备份 / 降级保护 | 完成 |
| 备份保留策略 prune --keep N | 完成 |
| 对齐最新 tag（align / --upgrade） | 完成 |
| CI（ubuntu+windows × node22/24） | 完成 |
| 真机：装 selftest → ping 200 → restore 清理 | 完成 |
| 远端仓库 | **已完成** |
| npm / dshmarket 发布 | 未做 |

## 环境注意（重要）

在这个沙箱里跑 git/gh **必须把 stdin 关掉**（`</dev/null`）并设 `GH_PROMPT_DISABLED=1`，
否则命令会静默挂住——之前 4 次"推不上去"都是这个原因，不是权限问题。

## 已知限制

- 对齐只做 checkout 到最新 tag，不做 rebase；有未提交改动会拒绝
- install 需要可达的 pnpm（应用内自动定位，应用外要 --pnpm）
- 页面依赖 DSH 主题 token，token 改名会退化到 fallback 颜色
