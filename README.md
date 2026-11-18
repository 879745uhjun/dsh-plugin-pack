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
