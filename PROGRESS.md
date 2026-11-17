# dsh-plugin-pack · 进度与断点

> 断点续做的唯一依据。每次停下前更新；下次先读本文件 + git log。

## 状态：M6 完成（命令行闭环：打包 → 校验 → 安装，含回滚）

| 里程碑 | 内容 | 状态 |
|---|---|---|
| M0 | 脚手架、zip 读写 | 完成 |
| M1 | profile 扫描 | 完成 |
| M2 | 兼容性引擎 4 条规则 | 完成 |
| M3 | manifest + checksums + zip 打包 | 完成 |
| M4 | CLI scan / create / inspect / verify | 完成 |
| M5 | 安装器（预检/备份/落盘/bundles/patch/回滚） | 完成 |
| M6 | CLI install + 端到端测试（空 profile 装成功后结构正确） | 完成 |
| M7 | client 页面三 tab + 深浅色 | 待做 |
| M8 | host 路由 + 工具 + 联调 | 待做 |

## 已完成能力

- 28 个测试全绿（zip / scan / semver / compat / pack / install / CLI e2e）
- 真包：out/dsh-mini-1.0.0.dshpack（3 插件，0.2 MB，verify OK）
- 真包：out/dsh-toolkit-1.0.0.dshpack（12 个自制插件）
- 安装语义：profile/plugins/<name> 实体目录 + node_modules junction +
  dependencies file:./plugins/<name> + bundles 追加 + cordis.patch.yml 追加
- 备份：.dsh/backups/<时间戳>/{package.json, cordis.patch.yml, plan.json}
- 失败自动回滚（删除已写目录、还原 package.json 与 patch）

## 下一步

1. M7：client.js 三 tab（打包台 / 兼容性 / 导入），照 ../plugin-pack-mockup/v2/
2. M8：host 路由 /plugin-pack/{scan,create,install,verify} + 工具
3. 补强：locale.key、runtime.platform 两条规则；对齐 GitHub tag 的真机验证

## 已知问题 / 待确认

- row.trailing 是多插件共用的列表槽（已修：SINGLE_SEAT 只看 .action/.leading）
- 尚未在真实 desktop profile 上跑 install（只跑过 dry-run 和空 profile）
- 安装后是否需要重启 DSH 才生效，待验证
