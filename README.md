# Desktop Notepad

基于 **Tauri 2 + Vue 3 + TypeScript + Vite** 构建的桌面记事本应用，安装包仅 ~10MB。

## ✨ 功能特性

### 📊 仪表盘
- 今日/待办/已完成/进行中/本周 任务统计
- 上下班倒计时进度条（可自定义时间）
- 本周产出柱状图
- 年度产出热力图（GitHub 风格）
- 每日激励语（一言 API）
- 数据备份与恢复（JSON 导入/导出）

### 📋 工作任务
- 日历视图（月/周切换）
- 农历日期显示
- 中国法定节假日 + 农历节日标注
- 任务搜索与多维过滤（状态/标签/优先级）
- 四级优先级（低/中/高/紧急）
- 任务提醒时间设置
- 自定义标签

### ✏️ 公众号编辑器
- 左写 Markdown 右实时预览
- 12 种快捷插入工具栏
- 撤销/重做（Ctrl+Z / Ctrl+Y）
- 6 套内置主题（默认/暗夜/清新绿/暖橙/极简/科技蓝）
- 实时字数统计 + 阅读时间估算
- 30 秒自动保存草稿
- 一键复制到微信后台（CSS 内联方案）
- 代码块 Mac 风格红黄绿圆点 + 语言标签
- 导入 Markdown / 导出 PDF

### 🤖 AI 搜问
- 支持 MiMo / DeepSeek / 硅基流动 / OpenRouter
- 流式输出 + 自动重试（网络断连时）
- 代码语法高亮（20+ 语言）
- 系统提示词自定义
- Token 用量显示
- 对话导出（Markdown / JSON）
- 会话持久化存储（SQLite）
- 本地数据搜索 + 联网搜索
- XSS 安全过滤（DOMPurify）

### 🌙 暗色模式
- 全局适配暗色模式，Apple 风格深色主题
- 一键切换，偏好持久化

### ☁️ WebDAV 同步
- 跨设备数据同步
- 支持测试连接、立即同步、恢复备份
- 兼容主流 WebDAV 服务（Nextcloud / 坚果云 等）

---

## 📦 技术栈

| 技术 | 版本 |
|------|------|
| Tauri | 2.x |
| Vue | 3.5 |
| TypeScript | 5.6 |
| Vite | 6.x |
| Pinia | 3.x |
| SQLite | (Tauri plugin) |

## 🚀 快速开始

### 前置条件

- Node.js >= 18
- pnpm >= 9
- Rust >= 1.77

### 安装依赖

```bash
pnpm install
```

### 开发模式

```bash
pnpm tauri dev
```

### 构建安装包

```bash
pnpm tauri build
```

### Linux 额外依赖

```bash
sudo apt install libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf
```

## 📁 项目结构

```
desktop-notepad/
├── src/                          # 前端源码（Vue 3）
│   ├── pages/
│   │   ├── Dashboard/            # 仪表盘
│   │   ├── WorkTask/             # 工作任务
│   │   ├── WechatEditor/         # 公众号编辑器
│   │   ├── AiSearch/             # AI 搜问
│   │   ├── My/                   # 我的
│   │   ├── Settings/             # 设置
│   │   └── Widget/               # 桌面小组件
│   ├── components/
│   │   ├── LockScreen.vue        # 口令锁屏
│   │   └── YearHeatmap.vue       # 年度热力图
│   ├── stores/                   # Pinia 状态管理
│   ├── utils/
│   │   ├── ai.ts                 # AI 对话（流式+重试）
│   │   ├── db.ts                 # SQLite 数据库
│   │   ├── editor.ts             # Markdown 渲染 + 微信样式
│   │   ├── task.ts               # 任务管理
│   │   └── webdav.ts             # WebDAV 同步
│   ├── data/
│   │   └── holidays.ts           # 节假日 + 农历
│   ├── router/                   # 路由
│   ├── styles/                   # 全局样式 + 主题
│   ├── App.vue                   # 主布局
│   └── main.ts                   # 入口
├── src-tauri/                    # Rust 后端
│   ├── src/lib.rs                # 系统托盘、插件注册
│   ├── Cargo.toml                # Rust 依赖
│   └── tauri.conf.json           # Tauri 配置
└── .github/workflows/build.yml   # CI/CD 自动打包
```

## 📝 License

MIT
