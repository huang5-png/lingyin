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
├──────┬──────────────────────────────────────────────────────────────┤
│      │  右侧内容区 (right-content-area)                             │
│  左  │  ┌──────────────────────────────────────────────────────┐   │
│  侧  │  │  library / discover / download 等视图区域            │   │
│  导  │  │  （侧边栏卡片 + 详情卡片 + 右侧标签栏卡片）          │   │
│  航  │  └──────────────────────────────────────────────────────┘   │
│  栏  │  ┌──────────────────────────────────────────────────────┐   │
│  (卡 │  │  底部播放栏 (AudioPlayer) — 卡片                    │   │
│  片) │  └──────────────────────────────────────────────────────┘   │
│  64px│                                                             │
└──────┴──────────────────────────────────────────────────────────────┘
```

- **左侧导航栏**（64px，卡片，`left-nav-bar`）：贯穿整个窗口高度，我的库 / 发现 / 最近播放 / 使用报告 / 下载管理 / 播放列表 / 设置
- **右侧内容区**（`right-content-area`，flex 垂直布局）：
  - **视图区域**（flex: 1）：根据当前视图切换不同内容
    - **侧边栏**（卡片，`library-main` / `discover-main`）：作品列表、搜索、筛选、添加文件夹
    - **作品详情区**（卡片，`work-detail-wrapper`）：作品详情 + 曲目列表
    - **可拖拽分割线**（`content-splitter`）：8px 宽，可拖动调整右侧面板宽度（240-600px）
    - **右侧标签栏**（卡片，`right-tab-bar`）：Details / Subtitles / Related / Playlists
  - **底部播放栏**（卡片，`global-player-bar`）：波形、播放控制、快进快退、音量、沉浸式、睡眠定时器、队列
    - 默认高度 96px（可在设置中调整）
    - 仅占右侧内容区宽度，不延伸到左侧导航栏下方
- 所有面板间距：`--spacing-card: 16px`
- 背景有渐变叠加层营造纸张质感

### 视图模式

- **library（我的库）**：本地作品管理，左右分栏布局（library-layout），左侧作品列表卡片 + 右侧详情区
- **discover（发现）**：在线 asmr.one 浏览，左右分栏布局（discover-layout），左侧搜索列表 + 右侧详情播放器
- **recent-plays（最近播放）**：最近播放过的作品列表，按时间倒序排列
- **annual-report（使用报告）**：年度/月度/日度播放时长、标签/CV/社团/作品排行
- **download（下载管理）**：后台下载任务列表，实时进度、速度、状态展示
- **playlist（播放列表）**：用户自建播放列表管理，左侧列表栏 + 右侧曲目列表，支持拖拽排序

#### 分栏布局特性
- library / discover 视图采用 flex 左右分栏
- 有选中作品时（`.has-detail`）：左侧约 38%（360-460px），右侧约 56%
- 无选中作品时：左侧占满 100%，右侧隐藏
- 支持最小宽度约束，防止过度挤压（左侧 360px，右侧 520px）
- 整个视图区域有 16px padding，卡片之间有 gap
- **自动隐藏侧边栏**（`autoHideSidebar`，默认开启）：选中作品时左侧列表自动收起，展开详情区；可在设置中关闭
- **可拖拽分割线**（`content-splitter`）：详情区内作品详情与右侧标签栏之间有 8px 宽的拖拽条，可拖动调整右侧面板宽度（240-600px）

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
| `App.jsx` | 根组件，集成所有自定义 Hooks，组合状态与 UI 渲染 |
| `hooks/useTranslate.js` | 翻译功能 Hook：翻译缓存、批量翻译、字幕翻译切换、自动翻译 |
| `hooks/usePlayQueue.js` | 播放队列 Hook：队列管理、循环模式、随机播放、跨作品播放、队列操作 |
| `hooks/useKeyboardShortcuts.js` | 全局快捷键 Hook：快捷键解析匹配、按键事件处理、ESC 弹窗优先级 |
| `hooks/useSleepTimer.js` | 睡眠定时器 Hook：倒计时管理、自动暂停播放、剩余时间格式化 |
| `hooks/usePlaybackHistory.js` | 播放历史记录 Hook：定时记录播放历史（每 60 秒），用于使用统计 |
| `hooks/useMediaLibrary.js` | 媒体库管理 Hook：作品状态（works/audioFiles/allSubtitleFiles）、加载/添加/删除/刷新、DLsite 自动刮削 |
| `hooks/useOnlineWork.js` | 在线作品 Hook：在线作品加载/刷新、tracks 解析为音频列表 |
| `hooks/useSubtitle.js` | 字幕管理 Hook：字幕选项/索引状态、语言异步检测、字幕选择/添加/刷新、自动翻译 |
| `hooks/usePlayer.js` | 核心播放控制 Hook：音频选择、上一曲/下一曲、播放完成、进度保存、历史记录、时间更新 |
| `hooks/useFilters.js` | 筛选状态 Hook：CV/社团/标签筛选状态、筛选结果计算 |
| `hooks/useTheme.js` | 主题与缩放 Hook：窗口响应式缩放（0.6x-1.2x）、主题切换与过渡动画、CSS 变量同步、数据库设置加载 |
| `hooks/useWorkMetadata.js` | 元数据编辑与刷新 Hook：handleEditMetadata（更新作品信息）、handleRefreshMetadata（从 DLsite 重新刮削） |
| `hooks/useToast.js` | Toast 通知 Hook：Toast 状态（toasts/showToast/removeToast） |
| `hooks/useImmersive.js` | 沉浸式模式 Hook：沉浸式 state、开关控制、refs 管理 |
| `hooks/useSplitter.js` | 可拖拽分割线 Hook：分割线拖拽 state 和逻辑，支持宽度约束 |
| `hooks/useAppSettings.js` | 设置管理 Hook：设置加载/保存、默认值、视图模式切换、showLyric 同步 |
| `hooks/useViewNavigation.js` | 视图导航 Hook：视图切换、作品选择、模态框状态管理、最近播放自动播放 |
| `hooks/usePlaylistPlayback.js` | 播放列表播放 Hook：播放列表曲目播放、跳转到作品、加入播放列表弹窗 |
| `hooks/useSubtitleRefresh.js` | 字幕刷新 Hook：重新扫描文件夹、更新音频和字幕列表、保持当前字幕选择 |
| `hooks/useFavorites.js` | 收藏功能 Hook：收藏状态管理、收藏筛选、切换收藏、本地持久化 |
| `hooks/useFolderGroups.js` | 文件夹分组 Hook：分组管理、分组筛选、作品分组设置、本地持久化 |
| `components/ImmersiveView.jsx` | 沉浸式播放视图组件（全屏封面、背景模糊、字幕滚动、自动居中、点击跳转） |
| `components/AudioPlayer.jsx` | 音频播放器（wavesurfer.js 波形、播放控制、上一曲/下一曲、快进快退、进度保存、沉浸式切换、队列控制按钮、睡眠定时器、集成 QueuePanel 浮层） |
| `components/Sidebar.jsx` | 作品列表（卡片/列表双视图）、媒体库扫描、CV/社团筛选、视图切换 |
| `components/WorkDetail.jsx` | 作品详情展示（封面、标签、CV、曲目列表、元数据编辑、曲目行 hover 显示「下一首播放/加入队列/加入播放列表」按钮组、文件夹导航） |
| `components/LyricView.jsx` | 歌词本视图（字幕滚动展示、点击跳转、字幕选择器、双语翻译） |
| `components/RightTabBar.jsx` | 右侧标签栏（Details/Subtitles/Related/Playlists 四个 Tab） |
| `components/DiscoverView.jsx` | 在线发现视图（asmr.one 搜索、高级筛选、标签选择器、作品列表、重试机制） |
| `components/RecentPlaysView.jsx` | 最近播放视图（按时间倒序展示最近播放过的作品） |
| `components/UsageReport.jsx` | 使用报告视图（年度/月度/日度切换、标签/CV/社团/作品排行） |
| `components/DownloadView.jsx` | 下载管理视图（任务列表、进度、速度、状态控制、后台下载） |
| `components/DownloadModal.jsx` | 下载配置弹窗（选择文件、音质、添加到队列） |
| `components/PlaylistView.jsx` | 播放列表视图（多列表、拖拽排序、加入弹窗） |
| `components/QueuePanel.jsx` | 播放队列浮层（拖拽排序、循环/随机切换、当前项高亮、ESC 关闭） |
| `components/SubtitleSelector.jsx` | 字幕切换、外部字幕导入、语言标签、翻译切换 |
| `components/SettingsModal.jsx` | 设置弹窗（基本/外观/主界面/播放界面/快捷键/关于，六个 Tab） |
| `components/KeyboardShortcutsPanel.jsx` | 快捷键配置面板（自定义快捷键、冲突检测） |
| `components/GlobalSearchModal.jsx` | 全局搜索弹窗（搜索历史、作品、收藏、播放列表分类展示，关键词高亮，快捷键唤起，方向键选择+回车跳转） |
| `components/ErrorBoundary.jsx` | React 错误边界 |
| `components/StateView.jsx` | 统一空态/加载态/错误状态组件（13+ 预置图标、sm/md/lg 尺寸、紧凑/行内模式） |
| `components/LeftNavBar.jsx` | 左侧导航栏（64px 宽，卡片样式，包含我的库/发现/最近播放/使用报告/下载/播放列表/设置入口） |
| `components/Toast.jsx` | Toast 通知组件（success/error/info/warning 四种类型，自动消失，带动画） |
| `components/AddToPlaylistModal.jsx` | 加入播放列表弹窗（选择已有列表或新建列表并加入） |
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

### 3.1 统一空态/加载态/错误态（StateView）

所有组件的空态、加载态、错误态必须使用统一的 `StateView` 组件，禁止自定义实现。

#### 组件特性
- **三种状态类型**：`empty`（空态）/ `loading`（加载中）/ `error`（错误）
- **三种尺寸**：`sm` / `md`（默认）/ `lg`
- **两种模式**：紧凑模式（`compact`）、行内模式（`inline`）
- **13+ 预置图标**：empty / loading / error / playlist / download / folder / music / search / clock / chart / subtitle / queue / settings / warn / info

#### 使用规范
- 列表/网格为空时：`type="empty"`，配合对应的 iconType（音乐列表用 `music`，下载用 `download`，搜索用 `search` 等）
- 数据加载中：`type="loading"`
- 加载失败：`type="error"`，配合重试按钮（`action` 属性）
- 卡片内小区域空态：`size="sm"` 或 `compact`
- 页面级空态：默认尺寸或 `size="lg"`

#### 骨架屏加载模式

对于列表型视图（如 DiscoverView、RecentPlaysView、PlaylistView），优先使用**骨架屏**替代 `StateView type="loading"`，提供更流畅的加载体验。

**共享骨架样式**（定义在 `StateView.css`）：
```css
@keyframes skeleton-shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

.skeleton-line {
  background: linear-gradient(90deg, var(--bg-tertiary) 25%, var(--bg-hover) 50%, var(--bg-tertiary) 75%);
  background-size: 200% 100%;
  animation: skeleton-shimmer 1.5s ease-in-out infinite;
  border-radius: var(--radius-xs);
}

.skeleton-cover {
  /* 同 skeleton-line，但无 border-radius 或根据容器设置 */
}
```

**实现模式**：
1. 在组件中创建 `SkeletonItem` / `SkeletonCard` 等骨架组件
2. 骨架元素使用 `.skeleton-line` / `.skeleton-cover` 等类名
3. 组件特定样式在各自 CSS 文件中定义（如 `.rp-skeleton-cover`）
4. 加载状态替换示例：
```jsx
{loading ? (
  <div className="rp-list">
    {Array.from({ length: 8 }).map((_, i) => (
      <SkeletonItem key={i} />
    ))}
  </div>
) : (
  // 实际内容
)}
```

**骨架屏 CSS 规范**：
- 骨架容器添加 `.skeleton-item` 类，禁止 hover 效果：`pointer-events: none; animation: none;`
- 骨架行/封面等使用共享 `.skeleton-line` / `.skeleton-cover`
- 组件特定尺寸/位置覆盖在各自 CSS 文件中定义
- 高 DPI 适配：在 `@media (min-resolution)` 中调整骨架尺寸

**已使用骨架屏的视图**：
- DiscoverView（作品卡片骨架）
- RecentPlaysView（最近播放条目骨架）
- PlaylistView（播放列表条目 + 曲目行骨架）

#### 已使用 StateView 的组件
- WorkDetail（曲目加载/错误态）
- Sidebar（作品列表空态）
- DownloadView（下载任务空态）
- UsageReport（统计数据空态 + 排行榜空态）
- DiscoverView（标签加载/空态）
- RecentPlaysView（最近播放空态）
- QueuePanel（队列为空）
- PlaylistView（播放列表为空）
- GlobalSearchModal（搜索结果为空）

### 4. 数据持久化

- 所有数据保存在 `userData/db.json`（Electron 的 `app.getPath('userData')`）
- 数据结构见 `electron/db.js` 的 `defaultData`
- 每次写入调用 `saveDB()` 同步到磁盘
- 数据库文件路径：`C:\Users\{用户}\AppData\Roaming\lingyin\db.json`
- 设置同时存储在 localStorage 和 db 中（localStorage 优先加载）
- 播放历史（`progressHistory`）用于统计，每 30 秒记录一次

#### 数据结构一览
```json
{
  "works": [],           // 本地作品列表
  "progress": {},        // 播放进度 { workId::audioPath: seconds }
  "progressHistory": [], // 播放历史记录（用于统计）
  "subtitles": {},       // 字幕选择 { workId::audioPath: subtitleData }
  "settings": {},        // 用户设置
  "playlists": [],       // 播放列表
  "translateCache": {},  // 翻译缓存 { workId::audioPath: { text, timestamp } }
  "favorites": [],        // 收藏列表 [{ workId, title, cover, circle, isOnline, addedAt }]
  "folderGroups": []      // 文件夹分组 [{ id, name, color, order, createdAt, updatedAt }]
}
```

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

### 8. 字幕翻译

#### 功能概述
- 支持将字幕文本实时翻译为中文，双语显示（原文 + 译文）
- 翻译结果本地缓存（数据库 + 内存），30 天过期
- 支持翻译引擎选择（Google/Baidu/Microsoft），在设置中配置

#### 核心状态（App.jsx）
- `translateCacheRef` — 内存翻译缓存（Map，key=原文，value=译文）
- `translateVersion` — 翻译状态触发器，每次翻译完成后递增，触发组件重渲染
- `translating` — 正在翻译中的文本集合（Set）
- `hasTranslation` — 是否有翻译内容（用于双语显示模式判断）

#### 翻译流程
1. 用户点击字幕选择器中的翻译按钮（小地球图标）
2. `handleToggleTranslate` 检查当前是否已有翻译
3. 如有翻译：清除所有翻译，恢复原文显示，清除数据库和内存缓存
4. 如无翻译：
   - 先从数据库读取缓存（`translateGetCache`）
   - 有缓存：加载缓存的翻译结果
   - 无缓存：调用批量翻译 API（`translateBatch`），翻译完成后保存到缓存

#### 翻译缓存
- **数据库缓存**：存储在 `db.json.translateCache`，key 为 `${workId}::${audioPath}`
- **内存缓存**：存储在 `translateCacheRef`（Map），关闭软件后清空
- **过期策略**：30 天自动过期

#### IPC API
| 接口 | 说明 |
|------|------|
| `translate:text` | 单条文本翻译 |
| `translate:batch` | 批量文本翻译 |
| `translate:getCache` | 获取翻译缓存 |
| `translate:saveCache` | 保存翻译缓存 |
| `translate:clearCache` | 清空所有翻译缓存 |

#### 组件集成
- **SubtitleSelector.jsx**：添加翻译按钮，显示翻译状态（翻译中/已有翻译）
- **LyricView.jsx**：支持双语显示模式，原文在上，译文在下（斜体）
- **RightTabBar.jsx**：传递翻译相关 props 到 LyricView

#### 字幕全局设置
- **语言优先级**：`settings.subtitleLangPriority` — 切换作品时自动选择对应语言的字幕
  - 可选值：`auto`（自动，默认）/ `zh`（中文）/ `ja`（日文）/ `en`（英文）/ `dual`（双语）
  - 逻辑：切换作品时，如果用户没有保存过该作品的字幕选择，则按优先级自动选择
- **字体大小**：`settings.subtitleFontSize` — 全局字幕字体大小（12-28px）
  - 同时影响右侧字幕面板和沉浸式模式
  - 沉浸式模式：普通行 = 字号 × 1.2，激活行 = 字号 × 1.8
  - LyricView 组件：优先使用全局设置，未设置时回退到本地设置
- **自动翻译**：`settings.autoTranslateSubtitle` — 开启后非中文字幕自动翻译为中文
  - 切换音频时自动触发，不阻塞播放
  - 优先使用缓存翻译，无缓存时异步翻译
  - 中文/双语字幕不触发自动翻译

### 9. 视图模式

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

### 10. 在线 ASMR 发现（asmr.one）

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

### 11. 自定义标题栏与窗口控制

- 使用 `frame: false` 完全移除系统标题栏
- 自定义标题栏位于 `.title-bar`，透明背景，无分隔线
- 窗口控制按钮（最小化/最大化/关闭）通过 IPC 调用：
  - `windowMinimize()`
  - `windowMaximize()`
  - `windowClose()`
  - `windowIsMaximized()`

### 12. 沉浸式播放模式

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

### 13. 封面翻转动画

- 触发：切换作品时
- 状态：`flipState`（idle/ready/invert/play）
- 实现：从点击的封面位置过渡到详情封面位置
- 相关 ref：`flipRafRef`、`flipTimeoutRef`、`flipWorkIdRef`
- 动画时长：400ms

### 14. 设置面板

设置弹窗包含 6 个分类标签页：
- **基本** — 播放设置（自动播放下一首、记住进度、启动时自动播放、默认音量、快进快退秒数、自动隐藏侧边栏）
- **外观** — 主题、是否显示评分、波形高度、视图模式（网格/列表）
- **主界面** — 侧边栏宽度、歌词宽度、播放器高度
- **播放界面** — 显示歌词、自动滚动歌词、字幕语言优先级、字幕字体大小、自动翻译字幕
- **快捷键** — 自定义快捷键配置，支持组合键
- **关于** — 版本信息、应用图标

设置同时保存到 localStorage 和数据库。

### 15. 快捷键

#### 默认快捷键
| 快捷键 | 功能 | 作用域 |
|--------|------|--------|
| 空格 | 播放/暂停 | 全局（非输入框） |
| ← | 上一曲 | 全局（非输入框） |
| → | 下一曲 | 全局（非输入框） |
| ↑ | 音量增加（+5%） | 全局（非输入框） |
| ↓ | 音量减少（-5%） | 全局（非输入框） |
| ESC | 关闭弹窗/退出沉浸式 | 全局（弹窗优先级高于沉浸式） |
| Ctrl+K | 全局搜索 | 全局（非输入框） |

#### 快捷键配置
- 用户可在「设置 → 快捷键」中自定义快捷键
- 支持组合键（如 Ctrl+Shift+P）
- 支持清除单个快捷键绑定（点击「×」按钮）
- 支持按 ESC 取消录制
- 可配置的快捷键：
  - `playPause` — 播放/暂停
  - `prevTrack` — 上一曲
  - `nextTrack` — 下一曲
  - `volumeUp` — 音量增加（默认 ↑）
  - `volumeDown` — 音量减少（默认 ↓）
  - `seekBackward` — 快退（默认未设置）
  - `seekForward` — 快进（默认未设置）
  - `toggleImmersive` — 切换沉浸式（默认未设置）
  - `exitImmersive` — 退出沉浸式（默认 ESC）
  - `toggleQueue` — 显示/隐藏队列（默认未设置）
  - `openSettings` — 打开设置（默认未设置）
  - `globalSearch` — 全局搜索（默认 Ctrl+K）
- 配置存储在 `settings.shortcuts` 中，持久化到 db.json + localStorage
- 快捷键冲突检测：检测同一组合键被多个动作使用
- ESC 键处理优先级：弹窗（全局搜索/设置/下载/队列）→ 沉浸式模式

#### 实现
- `KeyboardShortcutsPanel.jsx` — 快捷键配置面板组件
- `KeyboardShortcutsPanel.css` — 样式文件
- `DEFAULT_SHORTCUTS` — 默认快捷键常量（包含 12 个可配置项）
- `matchShortcut(e, shortcutStr)` — 匹配按键事件与快捷键字符串
- `parseShortcut(shortcutStr)` — 解析快捷键字符串
- AudioPlayer 通过 `useImperativeHandle` 暴露 `setVolume/getVolume/skipBackward/skipForward` 供快捷键调用

### 16. 下载管理

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

### 17. 使用统计

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
- **日期导航**：支持上一周期 / 下一周期 / 回到当前的日期切换
  - 日度：切换具体日期
  - 月度：切换月份
  - 年度：切换年份
  - 不能查看未来日期的数据（下一周期按钮在当前日期时禁用）
- **刷新按钮**：手动刷新统计数据
- `getUsageStats` 支持 `date` 参数指定统计的基准日期

### 18. 播放列表

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

### 19. 播放队列

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

### 20. 睡眠定时器

#### 功能概述
- 用户可设置播放一段时间后自动停止播放
- 适合睡前听 ASMR 的使用场景
- 不持久化到设置，每次启动重置

#### 核心状态（App.jsx）
- `sleepTimerMinutes` — 设置的分钟数，0 表示关闭
- `sleepTimerRemaining` — 剩余秒数

#### 定时器选项
```js
export const SLEEP_TIMER_OPTIONS = [
  { label: '关闭', value: 0 },
  { label: '5 分钟', value: 5 },
  { label: '10 分钟', value: 10 },
  { label: '15 分钟', value: 15 },
  { label: '30 分钟', value: 30 },
  { label: '45 分钟', value: 45 },
  { label: '60 分钟', value: 60 },
  { label: '90 分钟', value: 90 },
]
```

#### 倒计时逻辑
- `useEffect` 监听 `sleepTimerMinutes` 变化，启动/停止倒计时
- 每秒减少 `sleepTimerRemaining`
- 倒计时到 0 时：
  - 调用 `playerRef.current.playPause()` 暂停播放
  - 重置 `sleepTimerMinutes` 为 0
  - 显示 Toast 通知

#### UI 入口
- `AudioPlayer.jsx` 播放器右侧区域
- 位于队列控制按钮旁边
- 月亮图标按钮，点击展开下拉菜单
- 激活时按钮高亮 + 显示剩余时间徽标

#### 格式化函数
```js
function formatSleepTimerRemaining(seconds) {
  // 小于60分钟：M:SS 格式
  // 大于等于60分钟：H:MM:SS 格式
}
```

### 21. 收藏功能

#### 功能概述
- 用户可以收藏喜欢的作品，支持本地作品和在线作品
- 收藏数据持久化存储到 db.json，重启后自动恢复
- 支持一键筛选只显示收藏的作品
- 作品卡片和详情页均可快速收藏/取消收藏

#### 数据结构
- 存储位置：`db.json.favorites`（数组）
- 每个收藏项：`{ workId, title, cover, circle, isOnline, addedAt }`
- `workId`：本地作品 id 或在线作品 id
- `isOnline`：是否为在线作品

#### IPC API
| 接口 | 说明 |
|------|------|
| `favorites:getAll` | 获取全部收藏列表 |
| `favorites:isFavorite` | 检查指定作品是否已收藏 |
| `favorites:add` | 添加收藏 |
| `favorites:remove` | 移除收藏 |
| `favorites:toggle` | 切换收藏状态，返回当前状态 |

#### 前端 Hook
- `useFavorites` Hook 管理收藏状态与操作
- 状态：`favorites`（收藏列表）、`favoriteIds`（收藏 id 集合 Set）、`showOnlyFavorites`（是否只显示收藏）
- 操作：`toggleFavorite`、`addFavorite`、`removeFavorite`、`isFavorite`、`filterFavorites`

#### UI 入口
- **Sidebar 筛选区**：收藏筛选按钮，点击切换只显示收藏作品
- **作品卡片**：hover 显示爱心图标，点击切换收藏，已收藏时常亮显示
- **作品详情页**：操作按钮区第一个按钮为收藏按钮，已收藏时显示渐变填充样式

#### 收藏筛选逻辑
- 收藏筛选与 CV/社团/标签筛选叠加生效
- 收藏筛选开启时，空态显示对应提示
- 切换收藏状态后即时更新列表显示

### 22. 文件夹分组功能

#### 功能概述
- 用户可以创建自定义文件夹分组，将本地作品按类别组织管理
- 支持创建/重命名/删除分组，分组带颜色标识
- 侧边栏分组面板可折叠/展开，显示各分组作品数量
- 作品详情页可快速移动作品到不同分组
- 分组筛选与 CV/社团/标签/收藏筛选叠加生效
- 分组数据持久化存储到 db.json，重启后自动恢复
- 仅适用于本地作品，在线作品不支持分组

#### 数据结构
- 存储位置：`db.json.folderGroups`（数组）
- 每个分组：`{ id, name, color, order, createdAt, updatedAt }`
  - `id`：分组唯一标识，`fg_<base36时间戳>_<6位随机>`
  - `name`：分组名称
  - `color`：分组颜色（CSS 颜色值）
  - `order`：排序序号
- 作品关联：`work.folderGroupId` — 作品所属分组 ID，null 表示未分组

#### IPC API
| 接口 | 说明 |
|------|------|
| `folderGroup:getAll` | 获取全部分组列表 |
| `folderGroup:create` | 创建新分组，返回新对象 |
| `folderGroup:rename` | 重命名分组 |
| `folderGroup:setColor` | 设置分组颜色 |
| `folderGroup:delete` | 删除分组（组内作品变为未分组） |
| `folderGroup:reorder` | 按 id 数组重新排序 |
| `folderGroup:setWorkGroup` | 设置作品所属分组（null 表示取消分组） |
| `folderGroup:getWorks` | 获取指定分组下的所有作品 |

#### 前端 Hook
- `useFolderGroups` Hook 管理分组状态与操作
- 状态：`folderGroups`（分组列表）、`activeFolderGroupId`（当前选中分组 ID）
- 操作：`loadFolderGroups`、`createGroup`、`renameGroup`、`setGroupColor`、`deleteGroup`、`reorderGroups`、`setWorkGroup`
- 筛选逻辑：`filterWorksByFolderGroup(works, groupId)`

#### UI 入口
- **Sidebar 分组面板**：可折叠/展开，包含「全部作品」「未分组」+ 各自定义分组
- **作品详情页**：操作按钮区「移动到分组」下拉按钮，快速切换分组
- **筛选逻辑**：文件夹分组 → CV/社团/标签 → 收藏（筛选优先级从高到低

#### 分组筛选规则
- 全部作品：显示所有作品（不筛选）
- 未分组：显示 `folderGroupId` 为 null 的作品
- 指定分组：显示 `folderGroupId` 等于该分组 ID 的作品
- 分组筛选与 CV/社团/标签/收藏筛选叠加生效
- 删除分组时，组内所有作品的 folderGroupId 自动设为 null（变为未分组）

### 23. 全局搜索

#### 功能概述
- 全局搜索支持搜索作品、收藏、播放列表，按分类展示结果
- 搜索历史记录，最多保存 10 条，支持快速重新搜索
- 搜索关键词高亮显示，匹配字段标签（作品/RJ号/CV/社团/标签）
- 空输入时显示正在播放的曲目和搜索历史
- 支持键盘导航（↑↓选择，Enter跳转，ESC关闭/清除）
- 支持删除单条历史记录和清除全部历史

#### 触发方式
- 快捷键：`Ctrl+K`（默认）
- 可在设置中自定义快捷键

#### 搜索范围与优先级
1. **搜索历史** — 匹配历史记录中的关键词，点击重新搜索
2. **作品** — 搜索本地作品（标题、RJ号、CV、社团、标签），最多 10 条
3. **收藏** — 在收藏作品中搜索，最多 5 条
4. **播放列表** — 搜索播放列表名称，最多 5 条

#### 数据存储
- 搜索历史存储在 `localStorage` 的 `lingyin_search_history` 键中
- 最多保存 10 条，新搜索的关键词添加到最前面
- 重复搜索会移动到最前面（去重）
- 支持单条删除和全部清除

#### 交互特性
- **分类展示**：搜索结果按「搜索历史 / 作品 / 收藏 / 播放列表」分类，每组带标题和数量徽标
- **关键词高亮**：匹配的文本使用暖橙色高亮背景
- **清除按钮**：输入框右侧有清除按钮，一键清空搜索内容
- **ESC 两级退出**：有输入时按 ESC 先清除输入，无输入时关闭弹窗
- **历史记录管理**：hover 显示删除按钮，支持单条删除和顶部「清除全部」
- **正在播放**：空输入时显示当前正在播放的曲目，点击快速定位

#### UI 设计
- 毛玻璃背景 + 大圆角卡片，居中显示（距顶部 15vh）
- 最大宽度 620px，最大高度 480px，超出滚动
- 深色模式完整适配
- 高 DPI 屏幕自动放大（1.5dppx / 2dppx）

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
