# dsh-plugin-pack · 进度与断点

> 断点续做的唯一依据。每次停下前更新；下次先读本文件 + git log。

## 状态：M5 完成（打包 + 安装器，命令行可用）

| 里程碑 | 内容 | 状态 |
|---|---|---|
| M0 | 脚手架、zip 读写 | 完成 |
| M1 | profile 扫描（插件 / 版本 / engines / 槽位 / 配置） | 完成 |
| M2 | 兼容性引擎 4 条规则（slot.unique / engine.range / dep.version / version.latest） | 完成 |
| M3 | 打包 manifest + checksums + zip | 完成 |
| M4 | CLI scan / create / inspect / verify | 完成 |
| M5 | 安装器：预检 / 备份 / 落盘 / 改 package.json+bundles+patch / 回滚 | 完成 |
| M6 | CLI install + 真机演练（复制 profile 上先跑） | 进行中 |
| M7 | client 页面三 tab + 深浅色 | 待做 |
| M8 | host 路由 + 工具 + 联调 | 待做 |

## 已完成能力

- 26 个测试全绿（zip / scan / semver / compat / pack / install）
- 真包：out/dsh-mini-1.0.0.dshpack（3 插件 53 文件 0.2 MB，verify OK）
- 安装语义：实体目录写 profile/plugins/<name>，node_modules 下建 junction，
  dependencies 写 file:./plugins/<name>，bundles 追加，cordis.patch.yml 追加条目
- 备份：.dsh/backups/<时间戳>/{package.json, cordis.patch.yml, plan.json}

## 下一步

1. M6：把 desktop profile 复制一份到临时目录，对它跑 install --yes，再启动一次 DSH 验证加载
2. 回滚路径目前只有失败分支，补一个「强制失败」的测试
3. M7：client.js 三 tab（照 ../plugin-pack-mockup/v2/）+ host 路由

## 已知问题 / 待确认

- 真实槽位里 row.trailing 是多插件共用的列表槽，不是独占槽（已修 SINGLE_SEAT 只保留 .action/.leading）
- 版本对齐（GitHub tag）只在 create --align 时触发，尚未在真机验证网络路径
- locale.key 与 runtime.platform 两条规则还没写
