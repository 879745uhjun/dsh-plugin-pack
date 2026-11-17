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
