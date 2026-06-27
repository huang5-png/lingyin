# 聆音 - Trae 项目配置

本项目使用 Trae IDE 开发，此目录包含 Trae 的项目配置和开发文档。

## 目录结构

```
.trae/
├── README.md              # 本文件
├── rules/
│   └── project_rules.md   # 项目规则（技术栈、架构、编码规范）
└── specs/                 # 功能规格说明
    ├── cover-animation-and-immersive-lyric/     # 封面动画与沉浸式歌词
    ├── media-library-and-fixes/                 # 媒体库与修复
    ├── performance-optimization/                # 性能优化
    ├── subtitle-ui-upgrade/                     # 字幕 UI 升级
    ├── ui-fixes-and-enhancements/               # UI 修复与增强
    ├── ui-redesign/                             # UI 重新设计
    └── ui-redesign-v2/                          # UI 重新设计 v2
```

## 用途

- **rules/project_rules.md** — 定义项目的技术栈、架构模式、编码约定和开发命令，Trae IDE 的 AI 助手会参考该文件生成符合规范的代码
- **specs/** — 每个功能迭代的规格文档，包含 checklist、spec 和 tasks

## 约束规则

- 缩进 2 空格，无分号
- 函数组件 + React Hooks
- CSS 与 JSX 分离
- IPC 通信需同时修改 `electron/main.js`、`electron/preload.js` 和业务模块