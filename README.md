# dsh-plugin-pack

把一组 DSH 插件（含配置、版本锁定）打成一个可离线安装的 dshpack 文件，在另一台电脑上导入、预检、原子安装、失败回滚。

- 设计稿：../plugin-pack-mockup/v2/
- 进度与断点：PROGRESS.md

## 命令行（开发中）

~~~
node bin/dsh-pack.mjs scan
node bin/dsh-pack.mjs create dsh-toolkit --out ./dsh-toolkit-1.0.0.dshpack
node bin/dsh-pack.mjs inspect ./dsh-toolkit-1.0.0.dshpack
node bin/dsh-pack.mjs install ./dsh-toolkit-1.0.0.dshpack
~~~

## 事故记录：一个没 await 的 async 调用把宿主打挂了

2026-11-18，打开插件页就崩：

```
GET /plugin-pack/state -> collectState -> listPacks -> readPack
TypeError [ERR_INVALID_ARG_VALUE]: The argument 'path' must be a string ...
Received <Buffer 50 4b 03 04 ...>
  at readPack (lib/pack.mjs)   <- readFile 收到 Buffer
  at listPacks (index.js)      <- 而且这一行没有 await
```

两件事叠加才致命：参数类型错（Buffer 当路径传）+ 没 await（rejection 变成 unhandled，Node 24 直接退出进程）。

修复与规则：

- `readPack(input)` 同时接受路径或 Buffer（`Buffer.isBuffer` 分支，只读一次）；
- `listPacks` 每个包独立 try/catch，错误带 errno code 和文件名，坏包只显示一行错误，页面仍 200；
- **任何返回 Promise 的调用都必须 await（或显式 void + catch）**，宿主进程里一个 unhandled rejection 就够退出；
- 回归测试 4 条：真实包 / 坏文件 / 空目录 / Buffer 形态。

## 安全边界

- **安装前校验**：`verifyPack` 对整包逐文件重算 SHA-256；不一致直接拒绝安装（除非显式 `allowUnverified`）。
- **配置备份**：包内 `config/*.json` 覆盖已有文件前，先复制到 `.dsh/backups/<时间戳>/config/`；安装失败回滚时一并还原。
- **降级保护**：包版本低于本机时标为「降级」，默认不写，需显式「覆盖」。
- **锁同步**：写入后调用 `pnpm install --lockfile-only`，失败只警告。

## 命令一览

~~~bash
node bin/dsh-pack.mjs scan
node bin/dsh-pack.mjs create dsh-toolkit --select a,b --out out/x.dshpack
node bin/dsh-pack.mjs inspect out/x.dshpack
node bin/dsh-pack.mjs verify  out/x.dshpack
node bin/dsh-pack.mjs install out/x.dshpack            # dry run
node bin/dsh-pack.mjs install out/x.dshpack --yes      # write
node bin/dsh-pack.mjs backups
node bin/dsh-pack.mjs restore latest|20261118-124713
node bin/dsh-pack.mjs prune --keep 10
node bin/dsh-pack.mjs align [--upgrade] [--fetch]
~~~

在应用之外跑时，lock 同步需要显式指定 pnpm：

~~~bash
node bin/dsh-pack.mjs restore latest --pnpm "D:/Tools/Deepseek DSH/resources/runtime/primary-runtime/dependencies/pnpm/bin/pnpm.cjs"
~~~

## Agent 工具

宿主注册了 plugin_pack：state / create / inspect / install（需 confirm）/ restore。
页面上能做的事，对话里也能做。

## 对齐到最新 tag

align 默认只报告（当前 tag vs 最新 tag）；--upgrade 才会 git checkout <tag>，
遇到未提交改动会拒绝（dirty work tree），不会 reset 任何东西。
