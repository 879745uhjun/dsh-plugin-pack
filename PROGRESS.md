# dsh-plugin-pack · 进度与断点

> 断点续做的唯一依据。停下前更新；下次先读本文件 + git log。

## 状态：1.0.0 已发布，页面在真机正常显示

- 仓库：https://github.com/879745uhjun/dsh-plugin-pack
- Release：https://github.com/879745uhjun/dsh-plugin-pack/releases/tag/v1.0.0
- 包名：`@879745uhjun/dsh-plugin-pack`（npm 上 `dsh-plugin-pack` 被他人占用）
- 真机：`GET /plugin-pack/state` 200；侧边栏「插件包」正常出现（无需重启，刷新页面即生效）

| 项 | 状态 |
|---|---|
| 改名 + profile 迁移 + lock 重同步 | 完成 |
| tag v1.0.0 + 远端 + Release | 完成 |
| 页面三 tab / 深浅色 / en-zh | 完成（真机可见） |
| Agent 工具 plugin_pack | 完成 |
| 6 条兼容规则 / 原子安装 / 回滚 / 降级保护 / pnpm 落锁 | 完成 |
| npm publish | 待登录：`npm login` 后 `npm publish --access public` |
| dshmarket 上架 | 未做 |

## 踩坑记录（重要）

1. **client 模块 id 必须等于包名**：改 scoped 名后 `window.__ModuleLoader__.load({ id })` 仍是旧名，
   浏览器半边被静默丢弃，宿主路由却正常（`/plugin-pack/state` 200），很容易误判成"插件没加载"。
2. **`apply()` 里任何一行抛错都会让整个注册中断**：i18n 的 `ctx.locale.bind` 曾直接写在开头，
   服务未就绪时会让 `main` 和 `sidebar.panellist` 都注册不上。现在 t 有内置字典兜底，register 也包了 try/catch。
3. **浏览器半边不需要重启宿主**：刷新页面就会重新拉取 client 包；只有 host（路由/工具）改动才需要重启。
4. 沙箱里跑 git/gh 必须 `</dev/null` + `GH_PROMPT_DISABLED=1`，否则静默挂在 stdin。
