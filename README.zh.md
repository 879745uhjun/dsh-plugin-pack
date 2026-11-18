# dsh-plugin-pack（中文说明）

把一组 DSH 插件连同配置和版本锁打成一个可离线安装的 `.dshpack`，换台电脑导入、预检、原子安装、失败回滚。

英文说明见 [README.md](README.md)，设计稿见 `../plugin-pack-mockup/v2/`，进度见 [PROGRESS.md](PROGRESS.md)。

## 命令行

~~~bash
node bin/dsh-pack.mjs scan
node bin/dsh-pack.mjs create dsh-toolkit --select dsh-session-stars,dsh-session-todos --out out/dsh-toolkit-1.0.0.dshpack
node bin/dsh-pack.mjs inspect out/dsh-toolkit-1.0.0.dshpack
node bin/dsh-pack.mjs verify  out/dsh-toolkit-1.0.0.dshpack
node bin/dsh-pack.mjs install out/dsh-toolkit-1.0.0.dshpack          # 默认 dry-run
node bin/dsh-pack.mjs install out/dsh-toolkit-1.0.0.dshpack --yes    # 真正写入
~~~

## 页面

侧边栏「插件包」：打包台 / 兼容性 / 导入 三个 tab。数据来自 `/plugin-pack/{state,create,install,latest}`。

## 安装语义

- 插件实体写 `profile/plugins/<name>`，`node_modules/<name>` 建 junction
- 改 `package.json`：`dependencies` 加 `file:./plugins/<name>`，`dsh.profile.bundles` 追加
- 追加 `cordis.patch.yml` 的 `- id:` 条目
- 安装前备份到 `.dsh/backups/<时间戳>`，失败自动回滚
- **降级保护**：包里的版本比本机旧时标为「降级」，默认不写入，除非显式选「覆盖」
