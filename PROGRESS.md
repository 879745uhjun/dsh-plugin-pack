# dsh-plugin-pack · 进度与断点

> 断点续做的唯一依据。每次停下前更新；下次先读本文件 + git log。

## 状态：M6 完成（命令行闭环可用了）

| 里程碑 | 内容 | 状态 |
|---|---|---|
| M0-M2 | zip / 扫描 / 兼容性引擎 | 完成 |
| M3-M4 | manifest + checksums + create/inspect/verify | 完成 |
| M5 | 安装器（预检/备份/落盘/bundles/patch/回滚） | 完成 |
| M6 | CLI install + 端到端测试 | 完成 |
| M7 | client 页面三 tab + 深浅色 | 待做 |
| M8 | host 路由 + 工具 + 联调 | 待做 |

## 真机产物

- out/dsh-toolkit-1.0.0.dshpack：12 插件 / 198 文件 / 1.5 MB，verify OK
- 诊断：0 blocker / 1 warn
  - C-01 WARN slot.unique slot:sidebar.footer.action → transfer@1.0.2 + sidebar-pin@0.1.2
    （footer 只有一个按钮位，两个插件都往里塞）
- install 在空 profile 上端到端通过（e2e 测试），对真实 profile 只跑过 dry-run（全部 skip）

## 下一步

1. M7：client.js 三 tab（打包台 / 兼容性 / 导入），照 ../plugin-pack-mockup/v2/
2. M8：host 路由 /plugin-pack/{scan,create,inspect,install,verify} + 两个工具
3. 补强：locale.key / runtime.platform 两条规则；真实 profile 上跑一次 install --yes（先备份）

## 已知问题

- takeover 现在按 slot 精确识别（register({...takeover:true})），不再整文件命中
- 安装后是否需要重启 DSH 才生效，未验证
