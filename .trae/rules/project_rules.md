# 聆音 Lingyin 项目规则

## 项目概述

这是一个基于 **Electron + React + Vite** 的桌面端 ASMR 音声播放器。采用 **Claude 暖橙风格** UI 设计，允许用户扫描本地音声文件夹、播放音频、显示字幕/歌词、自动刮削 DLsite 元数据，在线浏览/播放/下载 asmr.one 音声资源，以及查看年度/月度/日度播放时长统计。

## 技术栈与版本

- Electron 33.x（主进程，无边框自定义标题栏 `frame: false`）
- React 18.x（渲染进程，函数组件 + Hooks）
- Vite 5.x（前端构建，HMR 开发）
- wavesurfer.js 7.x（音频波形可视化）
- axios + cheerio（DLsite 元数据刮削）
- asmr.one API（在线音声库搜索与播放）
- 本地 JSON 文件存储（`userData/db.json`）
- electron-builder（Windows 便携版打包）
- sharp（图标生成与处理）

## 架构模式

### 进程通信

```
渲染进程 (React) ──preload.js (contextBridge)──▶ 主进程 (Electron)
                         ▲
                  IPC invoke/handle
```

- 渲染进程 **不能** 直接访问 Node.js API（`nodeIntegration: false`）
- 所有系统操作（文件读写、对话框、数据库、网络请求）通过 `electronAPI` 对象调用
- `electronAPI` 在 `electron/preload.js` 中通过 `contextBridge.exposeInMainWorld` 暴露
- 每个 API 对应一个 `ipcMain.handle` 在 `electron/main.js` 中注册

### 整体布局

采用卡片化设计，每个功能区域都是独立的圆角卡片，通过间距和阴影分隔。

```
┌─────────────────────────────────────────────────────────────────────┐
│  自定义标题栏 (title-bar) — 透明背景，与应用融为一体                  │
├─────────────────────────────────────────────────────────────────────┤
│  ┌────┐ ┌──────────┐ ┌──────────────────────┐ ┌────────────┐       │
│  │ 左 │ │  侧边栏  │ │   主内容区            │ │ 右侧标签栏 │       │
│  │ 侧 │ │ (卡片)   │ │  （作品详情卡片）     │ │ （卡片）   │       │
│  │ 航 │ │          │ │  （曲目列表卡片）     │ │            │       │
│  │ 栏 │ │          │ │                      │ │            │       │
│  │(卡│ │          │ │                      │ │            │       │
│  │片)│ │          │ │                      │ │            │       │
│  └────┘ └──────────┘ └──────────────────────┘ └────────────┘       │
│  ┌──────────────────────────────────────────────────────────┐      │
│  │  底部播放栏 (player-bar / AudioPlayer) — 卡片           │      │
│  └──────────────────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────────────────┘
```

- 左侧导航栏（64px，卡片）：我的库 / 发现 / 下载 / 统计 / 播放列表 / 设置
- 侧边栏（280px，卡片）：作品列表、搜索、筛选、添加文件夹
- 主内容区：作品详情卡片 + 曲目列表卡片
- 右侧标签栏（卡片）：Details / Subtitles / Related / Playlists
- 底部播放栏（卡片）：波形、播放控制、快进快退、音量、沉浸式
- 所有面板间距：`--spacing-card: 16px`
- 背景有渐变叠加层营造纸张质感

### 视图模式

- **library（我的库）**：本地作品管理，左右分栏布局（library-layout），左侧作品列表卡片 + 右侧详情区
- **discover（发现）**：在线 asmr.one 浏览，左右分栏布局（discover-layout），左侧搜索列表 + 右侧详情播放器
- **download（下载管理）**：后台下载任务列表，实时进度、速度、状态展示
- **usage-report（使用统计）**：年度/月度/日度播放时长、标签/CV/社团排行
- **playlist（播放列表）**：用户自建播放列表管理，左侧列表栏 + 右侧曲目列表，支持拖拽排序

#### 分栏布局特性
- library / discover 视图采用 flex 左右分栏
- 有选中作品时（`.has-detail`）：左侧约 32%，右侧约 60%
- 无选中作品时：左侧占满 100%
- 支持最小宽度约束，防止过度挤压
- 整个视图区域有 16px padding，卡片之间有 gap

### 数据流

1. **扫描媒体库**：`src/utils/scanner.js` → `scanMediaLibrary(rootPath)` → 递归收集音频和字幕
2. **作品管理**：`electron/db.js` → JSON 文件存储 → `addWork/updateWork/deleteWork`
3. **播放进度**：`dbSaveProgress(workId, audioPath, progress)` — 每 5 秒自动保存（仅本地音频）
4. **播放历史**：`dbSaveProgressHistory(workId, workTitle, duration, tags, vas, circle)` — 每 30 秒记录一次播放历史，用于统计
5. **字幕选择**：`dbSaveSubtitle(workId, audioPath, subtitleData)` — 切换/导入时保存
6. **在线作品**：`asmrOneGetWorks` → 搜索列表 → `asmrOneGetWorkInfo` + `asmrOneGetTracks` → 播放
7. **下载队列**：`download:addTask` → 排队下载 → 广播状态 → `processDownloadQueue` 串行处理文件

## 关键文件职责

### 主进程 (electron/)

| 文件 | 职责 |
|------|------|
| `main.js` | 窗口创建（frame: false）、所有 IPC handler 注册（dialog/fs/path/db/dlsite/log/asmrOne/window/download/usageReport） |
| `preload.js` | contextBridge 暴露安全 API，映射到 `window.electronAPI.*` |
| `db.js` | 本地 JSON 数据库 CRUD（works/progress/progressHistory/subtitles/settings） |
| `dlsite.js` | DLsite 搜索、详情抓取、RJ 码提取 |
| `logger.js` | 文件日志模块 |

### 渲染进程 (src/)

| 文件 | 职责 |
|------|------|
| `App.jsx` | 根组件，核心状态管理（selectedWork/currentAudio/subtitleOptions/currentTime/currentView/isImmersive/flipState） |
| `components/AudioPlayer.jsx` | 音频播放器（wavesurfer.js 波形、播放控制、上一曲/下一曲、快进快退、进度保存、沉浸式切换、队列控制按钮、集成 QueuePanel 浮层） |
| `components/Sidebar.jsx` | 作品列表（卡片/列表双视图）、媒体库扫描、CV/社团筛选、视图切换 |
| `components/WorkDetail.jsx` | 作品详情展示（封面、标签、CV、曲目列表、元数据编辑、曲目行 hover 显示「下一首播放/加入队列/加入播放列表」按钮组） |
| `components/LyricView.jsx` | 歌词本视图（字幕滚动展示、点击跳转、字幕选择器） |
| `components/RightTabBar.jsx` | 右侧标签栏（Details/Subtitles/Related/Playlists 四个 Tab） |
| `components/DiscoverView.jsx` | 在线发现视图（asmr.one 搜索、高级筛选、标签选择器、作品列表） |
| `components/DownloadView.jsx` | 下载管理视图（任务列表、进度、速度、状态控制） |
| `components/DownloadModal.jsx` | 下载配置弹窗（选择文件、音质、添加到队列） |
| `components/UsageReport.jsx` | 使用统计视图（年度/月度/日度切换、标签/CV/社团排行） |
| `components/PlaylistView.jsx` | 播放列表视图（多列表、拖拽排序、加入弹窗） |
| `components/QueuePanel.jsx` | 播放队列浮层（拖拽排序、循环/随机切换、当前项高亮、ESC 关闭） |
| `components/SubtitleSelector.jsx` | 字幕切换、外部字幕导入、语言标签 |
| `components/SettingsModal.jsx` | 设置弹窗（基本/外观/主界面/播放界面/关于，五个 Tab） |
| `components/ErrorBoundary.jsx` | React 错误边界 |
| `components/StateView.jsx` | 统一空态/加载态/错误状态组件（支持预置图标、紧凑模式、行内模式） |
| `utils/scanner.js` | 媒体库扫描、文件类型识别、字幕匹配算法、语言检测 |
| `utils/subtitleParser.js` | 字幕解析（lrc/srt/vtt/ass/ssa） |
| `styles/global.css` | 全局样式、CSS 变量、主题 |

## 开发命令

```bash
npm run dev              # 开发模式（Vite + Electron 并行启动）
npm run build            # 生产构建（vite build + electron-builder）
npm run build:vite       # 仅构建前端
npm run build:electron   # 仅打包 Electron
```

Vite 开发服务器：`http://localhost:5173`，Electron 通过 `wait-on` 等待就绪后加载。

Windows 用户可双击 `启动开发版.bat` 一键启动开发模式。

## 重要规则与模式

### 1. 添加新的 IPC API

需要三步修改：
1. `electron/db.js`（或其他模块）— 添加业务逻辑函数
2. `electron/main.js` — 添加 `ipcMain.handle('namespace:action', ...)`
3. `electron/preload.js` — 在 `contextBridge.exposeInMainWorld('electronAPI', {...})` 中添加映射

### 2. 修改前端组件

- 所有组件使用函数组件 + Hooks
- CSS 与 JSX 分离（每个组件一个 `.css` 文件）
- 全局样式变量在 `src/styles/global.css` 中
- 使用 `@` 别名引用 `src/` 目录（`import X from '@/utils/scanner'`）
- 回调函数用 `useCallback` 包裹

### 3. CSS 约定

#### 主题风格（Claude 暖橙风格）
- 浅色为主的温暖纸张色调，搭配暖橙色主色调
- 浅色背景：`#faf9f5`（米白暖纸色），整体渐变叠加层营造质感
- 深色背景：`#262624`（深棕灰），低对比度护眼
- 主色调：暖橙/赤陶色（`--accent-primary: #c96442`，`--accent-secondary: #b0562f`）
- 深色模式主色：`--accent-primary: #d97757`，`--accent-secondary: #e08d6f`
- 使用 CSS 变量定义所有颜色（在 `global.css` 的 `:root` 和 `[data-theme="dark"]` 中）

#### 字体系统
- 标题字体：Poppins（无衬线，现代感，font-weight: 600）
  - 应用于 h1-h6、app-title、work-title、按钮、tab 文本等
  - `--font-heading: 'Poppins', 'Lora', 'PingFang SC', ...`
- 正文字体：Lora（衬线体，优雅阅读）
  - 应用于段落、描述、输入框文本等
  - `--font-family: 'Lora', 'PingFang SC', 'Hiragino Sans GB', ...`
- 等宽字体：Geist Mono
  - 应用于时间显示、代码、进度数值等
  - `--font-mono: 'Geist Mono', 'SF Mono', Monaco, ...`
- 字体分类规则：
  - 标题/按钮/标签用 Poppins（`font-heading`）
  - 正文/描述/输入用 Lora（`font-family`）
  - 数字/代码用 Geist Mono（`font-mono`）

#### 布局与卡片化设计
- 整体采用卡片化布局：每个面板都是独立的圆角卡片
- 左侧导航栏、侧边栏、主内容区、右侧标签栏、播放器均为独立卡片
- 卡片间距：`--spacing-card: 16px`
- 主内容区 `app-main` 使用 `padding: 0 16px 16px 16px` + `gap: 16px`
- 背景有渐变叠加层（`body::before`）营造纸张质感
- 圆角 4-16px（`--radius-xs` 到 `--radius-xl`），精致克制

#### 阴影系统
- 六级阴影：xs / sm / md / lg / xl / glow
- `--shadow-xs` 到 `--shadow-xl`：自然柔和的投影
- `--shadow-glow` / `--shadow-glow-strong`：主色调发光效果
- 卡片默认阴影：`--card-shadow`（轻量投影）

#### 过渡动画
- 三级过渡速度：fast (120ms) / normal (200ms) / slow (300ms)
- 统一缓动函数：`cubic-bezier(0.4, 0, 0.2, 1)`
- 所有交互元素均有过渡效果

#### 毛玻璃效果
- 使用 `backdrop-filter: blur(8px)` + 半透明背景
- 导航栏、侧边栏、标签栏、播放栏均使用毛玻璃卡片效果

#### 标题栏
- 透明背景，无边框分隔线，与应用背景融为一体
- 高度 32px，文字颜色 `--text-secondary`

#### 作品卡片
- 悬停时顶部有径向渐变光效（暖橙色）
- 选中时有柔和暖橙色发光边框
- 网格视图封面 `object-fit: cover`，列表视图封面 `object-fit: contain`

#### 标签样式
- CV/标签：灰色低调风格（`--tag-bg` / `--tag-border` / `--tag-text`）
- 激活态：暖橙色渐变背景

#### 高DPI适配
- 使用 `@media (min-resolution: 1.5dppx/2dppx/2.5dppx)` 自动缩放字号和间距
- 字号、侧边栏宽度、播放器高度随 DPI 自动调整

### 4. 数据持久化

- 所有数据保存在 `userData/db.json`（Electron 的 `app.getPath('userData')`）
- 数据结构见 `electron/db.js` 的 `defaultData`
- 每次写入调用 `saveDB()` 同步到磁盘
- 数据库文件路径：`C:\Users\{用户}\AppData\Roaming\lingyin\db.json`
- 设置同时存储在 localStorage 和 db 中（localStorage 优先加载）
- 播放历史（`progressHistory`）用于统计，每 30 秒记录一次

### 5. 媒体库扫描规则

- `scanMediaLibrary(rootPath)` 只识别根目录下的 **第一层子目录** 作为作品
- 子目录递归检查是否包含音频文件，如果有就作为整体作品扫描
- `scanFolder()` 递归收集所有音频和字幕文件
- 音频扩展名：`mp3/wav/flac/ogg/m4a/aac/wma/opus`
- 字幕扩展名：`lrc/srt/vtt/ass/ssa`

### 6. 字幕匹配算法

- 文件名完全匹配（100分）
- 去前缀匹配（95分）
- 清洁名称包含匹配（80分）
- 部分名称匹配（70分）
- 同目录加分（+10分）
- 格式优先级：vtt > srt > lrc > ass > ssa

### 7. 字幕语言检测

两层检测机制：
1. **文件名关键词**（快速，第一层）：zh/jp/en/dual 关键词匹配
2. **内容字符分析**（准确，第二层）：Unicode 字符比例分析，异步自动修正

支持语言：`zh`（中文）/ `ja`（日文）/ `en`（英文）/ `dual`（双语）

相关函数：
- `detectLanguage(basename)` — 文件名关键词检测
- `detectLanguageFromContent(content)` — 内容字符分析
- 异步检测在 App.jsx 的 `detectSubtitleLanguagesAsync` 中实现

### 8. 视图模式

侧边栏支持两种视图，状态保存在 `settings.viewMode`：
- `grid` — 卡片网格视图（默认，封面墙展示）
- `list` — 列表视图（紧凑高效）

切换按钮位于侧边栏顶部设置按钮左侧。

**网格视图特性：**
- 显示所有标签，不限制数量
- 同一行卡片高度一致（`grid-auto-rows: 1fr`），由该行最高卡片决定
- CV 显示前 2 个，用顿号分隔
- 卡片悬停时顶部有径向渐变光效（暖橙色）
- 选中状态有柔和暖橙色发光边框
- 卡片悬停时整体上移 2px + 阴影加深
- 封面 `object-fit: cover`，悬停时轻微放大

### 9. 在线 ASMR 发现（asmr.one）

#### API 端点
- `asmrOneGetWorks(params)` — 获取作品列表/搜索
  - 搜索接口：`/api/search/{keyword}?includeTranslationWorks=true`
  - 列表接口：`/api/works`
- `asmrOneGetWorkInfo(workId)` — 获取作品详情
- `asmrOneGetTracks(workId)` — 获取曲目列表（`?v=2`）
- `asmrOneGetTags()` — 获取所有标签
- `asmrOneGetDownloadInfo(workId)` — 获取下载信息（文件列表、音质选项）
- `asmrOneGetPresignedUrl(fileId)` — 获取文件下载直链

#### 请求头
必须携带浏览器请求头避免拦截：
- User-Agent: Chrome 120
- Referer: https://asmr.one/
- Origin: https://asmr.one

#### 高级搜索语法
使用 `$xxx:yyy$` 格式：
- `$tag:标签名$` / `$-tag:标签名$` — 包含/排除标签
- `$va:声优名$` / `$-va:声优名$` — 包含/排除声优
- `$circle:社团名$` / `$-circle:社团名$` — 包含/排除社团
- `$duration:分钟$` / `$-duration:分钟$` — 时长大于/小于
- `$rate:评分$` — 评分大于
- `$price:价格$` — 价格大于
- `$age:分级$` — 年龄分级
- `$lang:语言$` — 语言筛选
- `$tagw:标签名$` — 包含低愿力标签
- `$sell:销量$` — 销量大于

#### DiscoverView 组件
- 使用 `forwardRef` 暴露方法：`toggleTag`、`toggleVa`、`clearAllFilters`
- 搜索框三种建议模式：
  - 空输入：热门标签 TOP10
  - 文字输入：匹配的标签
  - `$` 开头：高级搜索命令
- 标签选择器：滚动加载（初始50个），按作品数量排序
- 高级筛选面板：5个分类标签页（标签/声优/社团/数值/其他）
- 作品卡片：最多显示3个可点击标签 + CV标签
- 返回顶部按钮：滚动时显示，点击回到顶部

#### 在线播放
- 点击作品 → 调用 `onSelectWork` 回调 → App.jsx 的 `handleSelectOnlineWork`
- 并行获取 workInfo 和 tracks → 转换为播放器格式 → 设置 selectedWork
- 在线音频标记 `isOnline: true`，不保存播放进度
- 支持手动添加在线字幕，保存到本地数据库

#### 在线下载
- 点击下载按钮 → `asmrOneGetDownloadInfo(workId)` → 选择文件/音质
- 添加到下载队列 → 后台处理，不阻塞 UI
- 下载的文件按 RJ 码命名文件夹保存，包含字幕文件

### 10. 自定义标题栏与窗口控制

- 使用 `frame: false` 完全移除系统标题栏
- 自定义标题栏位于 `.title-bar`，透明背景，无分隔线
- 窗口控制按钮（最小化/最大化/关闭）通过 IPC 调用：
  - `windowMinimize()`
  - `windowMaximize()`
  - `windowClose()`
  - `windowIsMaximized()`

### 11. 沉浸式播放模式

- 触发：点击播放器的封面图
- 状态：`isImmersive`
- 退出：点击右上角关闭按钮或按 ESC 键（点击空白区域**不**退出）

#### 布局结构
- 封面：绝对定位（top/left/right/bottom: 0），`object-fit: contain`，60px padding，按原始比例占满全屏
- 背景：封面图模糊放大（blur 60px + brightness 0.4 + saturate 0.9），营造沉浸氛围
- 底部信息区：绝对定位浮层，带渐变遮罩（`linear-gradient(to top, rgba(8,8,12,0.95) → transparent)`）
  - 作品标题：白色粗体，带黑色多层阴影
  - 社团名：半透明白色
  - 歌词/字幕区域：可滚动，最大高度 28vh

#### 字幕样式
- 非激活行：白色 30% 透明度，`scale(0.96)`，多层黑色阴影保证可读性
- 激活行：白色 100% 透明度，字号放大，暖橙色辉光效果，`scale(1)`
- 所有行均可点击跳转到对应播放位置
- 滚动区域带上下渐隐遮罩（mask-image）

### 12. 封面翻转动画

- 触发：切换作品时
- 状态：`flipState`（idle/ready/invert/play）
- 实现：从点击的封面位置过渡到详情封面位置
- 相关 ref：`flipRafRef`、`flipTimeoutRef`、`flipWorkIdRef`
- 动画时长：400ms

### 13. 设置面板

设置弹窗包含 5 个分类标签页：
- **基本** — 播放设置（自动播放下一首、记住进度、启动时自动播放、默认音量、快进快退秒数）
- **外观** — 主题、是否显示评分、波形高度
- **主界面** — 侧边栏宽度、歌词宽度、播放器高度
- **播放界面** — 显示歌词、自动滚动歌词
- **关于** — 版本信息、应用图标

设置同时保存到 localStorage 和数据库。

### 14. 快捷键

| 快捷键 | 功能 | 作用域 |
|--------|------|--------|
| 空格 | 播放/暂停 | 全局（非输入框） |
| ← | 上一曲 | 全局（非输入框） |
| → | 下一曲 | 全局（非输入框） |
| ESC | 退出沉浸式模式 | 沉浸式界面 |

### 15. 下载管理

#### 架构
- 下载队列在 Electron 主进程管理（`electron/main.js`），不依赖渲染进程
- 状态通过 IPC `download:getState` + `download:update`（广播）同步到 UI
- 支持关闭下载弹窗后后台继续下载

#### 任务状态
- `queued` — 排队中
- `downloading` — 下载中
- `completed` — 已完成
- `failed` — 下载失败
- `cancelled` — 已取消

#### IPC API
| 接口 | 说明 |
|------|------|
| `download:addTask` | 添加下载任务（work + files + saveDir） |
| `download:getState` | 获取全部任务状态 |
| `download:cancelTask` | 取消指定任务 |
| `download:removeTask` | 删除指定任务 |
| `download:clearCompleted` | 清空所有已完成任务 |
| `download:update` | 主进程 → 渲染进程广播状态变更 |

#### 队列处理
- `processDownloadQueue()` — 空闲时自动处理下一个任务
- 同一时间只有一个文件在下载
- 文件下载顺序：API 获取 presigned URL → stream 下载 → 写入磁盘 → 播放下一个

### 16. 使用统计

#### 数据来源
- 每 30 秒记录一次播放历史到 `db.json.progressHistory`
- 每条记录包含：`workId`, `workTitle`, `duration`(秒), `tags`, `vas`(声优), `circle`(社团), `timestamp`

#### 统计维度
| 维度 | 说明 |
|------|------|
| 年度 | 按年统计总播放时长 |
| 月度 | 按月统计播放时长，显示12个月分布 |
| 日度 | 按日统计，显示选中月份的每日分布 |
| 标签 | 按作品标签汇总播放时长排行 |
| CV | 按声优汇总播放时长排行 |
| 社团 | 按社团汇总播放时长排行 |
| 作品 | 按作品汇总播放时长排行 |

#### UsageReport 组件
- `forwardRef` 暴露方法：无（直接通过 props 获取数据）
- 三种时间维度切换：年 / 月 / 日
- 两种统计视图切换：趋势图 / 排行榜
- 排行榜支持标签 / CV / 社团 / 作品分类切换
- 数据在主进程聚合后返回渲染进程

### 17. 播放列表

#### 数据结构
- 存储位置：`db.json.playlists`（数组）
- 每个播放列表：`{ id, name, createdAt, updatedAt, items: [PlaylistItem] }`
- 每个曲目项：`{ id, workId, workTitle, workCover, audioPath, audioName, isOnline, addedAt }`
- ID 生成规则：`pl_<base36时间戳>_<6位随机>` / `it_<base36时间戳>_<6位随机>`

#### IPC API
| 接口 | 说明 |
|------|------|
| `playlist:getAll` | 获取全部播放列表 |
| `playlist:create` | 创建新播放列表，返回新对象 |
| `playlist:rename` | 重命名播放列表 |
| `playlist:delete` | 删除播放列表 |
| `playlist:addItem` | 添加曲目（按 audioPath 自动去重） |
| `playlist:removeItem` | 移除指定曲目 |
| `playlist:reorderItems` | 按 itemId 数组重新排序，未列入的项目追加到末尾 |
| `playlist:clear` | 清空播放列表 |

#### 前端组件
- `PlaylistView.jsx`：左侧列表栏 + 右侧曲目列表
  - 新建播放列表（顶部 + 按钮）
  - 单击选中、双击重命名
  - 删除按钮 hover 显示
  - 曲目行支持 HTML5 拖拽排序（draggable），乐观更新
  - 双击曲目行触发 `onPlayItem`
  - 「跳转到作品」按钮触发 `onNavigateToWork`
- `WorkDetail.jsx`：曲目列表项 hover 时显示 `audio-action-btns` 按钮组，包含「下一首播放」「加入队列」「加入播放列表」三个按钮（详见第 18 节「播放队列」）
- `AddToPlaylistModal`（App.jsx 内联）：列出全部播放列表 + 一键新建并加入，提交后调用 `playlistAddItem`

#### 视图切换
- `currentView === 'playlist'` 时渲染 PlaylistView
- 左侧导航栏「播放列表」项已绑定 `setCurrentView('playlist')`

#### 播放联动
- 从播放列表播放本地曲目时：根据 `workId` 在 `works` 中查找作品 → 切换到 library 视图 → 选中作品 → 轮询 `latestAudioFilesRef` 直到曲目加载完成 → 调用 `handleSelectAudio`
- 在线曲目：提示用户回到「发现」视图重新打开作品

### 18. 播放队列

#### 设计原则
- **纯内存版**：队列仅存在于 React state，不写入 `db.json`，重启清空，避免磁盘 IO
- **跨作品支持**：队列项携带轻量 work 快照（id/title/cover/folderPath/isOnline），支持跨作品自动切换
- **队列优先**：当 `queueIndex >= 0` 时，上一曲/下一曲/播放完毕均优先走队列调度；否则回退到当前作品 `audioFiles` 线性遍历

#### 核心状态（App.jsx）
- `playQueue: QueueItem[]` — 队列项数组
- `queueIndex: number` — 当前播放到队列的位置，`-1` 表示未在队列中播放
- `loopMode: 'none' | 'one' | 'list'` — 循环模式（顺序/单曲/列表），与 `settings.loopMode` 双向同步
- `shuffle: boolean` — 随机播放，与 `settings.shuffle` 双向同步
- `showQueuePanel: boolean` — 队列浮层开关
- `pendingQueuePlayRef` — 跨作品播放时的待播放项 `{ item, startedAt }`，配合 useEffect 等待 audioFiles 加载

#### 队列项结构
```js
{
  id: 'q_<base36时间戳>_<6位随机>',  // genQueueItemId() 生成
  audio: { path, name, isOnline, duration },  // 轻量音频快照
  work: { id, title, cover, folderPath, isOnline },  // 轻量作品快照
  source: 'library' | 'discover',
  audioName, workTitle, workCover,  // 冗余字段供 UI 直接渲染
  addedAt: number,
}
```

#### 调度逻辑
- `handlePlayFromQueue(item, index)` — 设置 `queueIndex` 并播放；若跨作品则切换视图/作品并设置 `pendingQueuePlayRef`，由 useEffect 在 `audioFiles` 加载完成后调用 `handleSelectAudio`
- `advanceQueue(direction, isAutoFinish)` — 推进到上/下一首；返回 `boolean` 表示是否已处理
  - `isAutoFinish && loopMode === 'one'` → seekTo(0) 重播当前
  - `shuffle && length > 1` → 随机选下一首（避免选到当前）
  - 边界处理：`loopMode === 'list'` 时循环；否则退出队列模式（`queueIndex = -1`）
- `handlePrevAudio / handleNextAudio / handleFinish` — 三处入口均先判断 `queueIndex >= 0`，队列优先

#### 队列操作
| 函数 | 说明 |
|------|------|
| `buildQueueItem(audio, work)` | 构造队列项（work 默认取 selectedWork） |
| `handleAddToQueue(audio, work)` | 加入队列末尾，按 `audio.path` 去重 |
| `handlePlayNext(audio, work)` | 插入到 `queueIndex + 1` 位置（下一首播放） |
| `handleRemoveFromQueue(itemId)` | 移除指定项并同步 queueIndex |
| `handleClearQueue()` | 清空队列并重置 queueIndex |
| `handleReorderQueue(itemIds)` | 按 itemId 数组重排，未列入的追加末尾，同步 queueIndex 指向当前播放项 |
| `handleToggleLoopMode()` | none → one → list → none，同步 localStorage + db |
| `handleToggleShuffle()` | 切换随机，同步 localStorage + db |
| `handleToggleQueuePanel()` | 切换浮层显示 |

#### 入口与 UI
- **WorkDetail.jsx** 曲目行 hover 时显示 `audio-action-btns` 容器，包含三个按钮：
  - `audio-play-next-btn` — 下一首播放（触发 `onPlayNext`）
  - `audio-add-to-queue-btn` — 加入队列（触发 `onAddToQueue`）
  - `audio-add-to-playlist-btn` — 加入播放列表（保留原行为）
- **AudioPlayer.jsx** 右侧 `queue-controls` 区：
  - 循环按钮（loop-btn，激活时显示"1"标记表示单曲循环）
  - 随机按钮（shuffle-btn）
  - 队列按钮（queue-btn，带数量徽标 `queue-badge`）
- **QueuePanel.jsx** 浮层组件：
  - 定位：`position: absolute; bottom: calc(100% + 8px); right: 0; width: 380px; max-height: 60vh`
  - 毛玻璃背景 + `--shadow-xl` + `--z-index-popover`
  - 头部：循环/随机/清空/关闭工具按钮 + 数量徽标
  - 列表项：拖拽手柄 + 序号/播放动画 + 封面 + 信息 + 移除按钮
  - 当前播放项高亮（暖橙色背景）+ 3 条柱形播放动画
  - HTML5 拖拽排序（复用 PlaylistView 模式）
  - ESC 关闭监听（capture 阶段，阻止冒泡）
  - 空态：图标 + 提示文字「在作品详情的曲目列表中点击「+」加入队列」
  - 完整暗色模式适配 + 高 DPI 适配（1.5dppx/2dppx）

#### 跨作品播放流程
1. 用户在 WorkDetail 点击「下一首播放」或「加入队列」→ 调用 `buildQueueItem` 构造队列项
2. 用户在 QueuePanel 点击某项 → `handlePlayFromQueue(item, index)`
3. 若目标作品 ≠ 当前后台作品：
   - `setCurrentView` 切换到 library/discover
   - `setSelectedWork(targetWork)` 触发 audioFiles 异步加载
   - 设置 `pendingQueuePlayRef = { item, startedAt: Date.now() }`
4. useEffect 监听 `audioFiles / selectedWork` 变化：
   - 8 秒超时 → 清空 ref + toast 警告
   - 在线作品 → 立即 `handleSelectAudio(item.audio)`
   - 本地作品 → 等待 `audioFiles.length > 0` 后 `handleSelectAudio(item.audio)`

#### 设置同步
- `loopMode` 和 `shuffle` 同时存储在 `localStorage.appSettings` 和 `db.json.settings`
- 启动时从 `settings.loopMode / settings.shuffle` 初始化 state
- 切换时同步写入两处（参考其他设置的持久化模式）

## 已知约定

- 代码注释用中文
- 缩进 2 空格
- 无分号结尾（JSX）
- 使用 `const`/`let`，禁止 `var`
- `useCallback` 包裹回调函数
- 异步操作使用 `async/await`
- 音频使用原生 `<audio>` 元素，不使用 Web Audio API（保护立体声效果）
- 组件命名使用 PascalCase
- CSS 类名使用 kebab-case

## 常见问题处理

### 启动开发服务器

```bash
npm run dev
```

或双击 `启动开发版.bat`

### 检查数据库内容

数据库文件位于 `C:\Users\{用户}\AppData\Roaming\lingyin\db.json`

### 日志文件

日志位于 `C:\Users\{用户}\AppData\Roaming\lingyin\logs\`

### 主进程修改需要重启

修改 `electron/` 下的文件后，需要重启应用才能生效（HMR 只对 `src/` 生效）

### 应用图标

- 图标源文件：项目根目录的 `IMG_20260625_215759.png`（可替换）
- 生成脚本：`scripts/generate-icons.js`
- 输出位置：`build/icon.ico`、`build/icon.png`、`build/icon-*.png`
- 运行命令：`node scripts/generate-icons.js`
- 支持尺寸：16/32/48/64/128/256/512px
- 设置页关于图标：`public/app-icon.png`

### 打包构建

```bash
# 完整构建
npm run build

# 仅构建前端
npm run build:vite

# 仅打包 Electron
npm run build:electron
```

输出目录：`release/`

### 发布到 GitHub

使用 GitHub CLI：
```bash
# 登录
gh auth login

# 创建 release
gh release create v1.0.0 --notes "Release notes"

# 上传资产
gh release upload v1.0.0 ./release/聆音*.exe
```
