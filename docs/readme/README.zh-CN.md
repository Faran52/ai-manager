# AI Chat Manager

[English](../../README.md) ·
[العربية](README.ar.md) ·
[日本語](README.ja.md) ·
[한국어](README.ko.md) ·
**简体中文** ·
[繁體中文](README.zh-TW.md)

一个快速、本地优先的 AI 编程会话历史查看器，基于
[Astro](https://astro.build) 岛屿架构构建，并通过
[Deno Desktop](https://docs.deno.com/runtime/desktop/)（Deno ≥ 2.9）发布为桌面应用。

直接从磁盘读取记录。没有后台进程，没有账号，没有遥测。

![带可展开工具卡片的会话记录](../screenshots/sessions.jpg)

## 支持的智能体

| 智能体 | 读取来源 | 工具调用 |
|---|---|---|
| Claude Code | `~/.claude/projects` 中的 JSONL | 支持 |
| Codex CLI | `~/.codex` 中的 JSONL | 支持 |
| GitHub Copilot | VS Code 的 `chatSessions` 日志 | 支持 |
| OpenCode | SQLite 存储 | 支持 |
| Cursor | `state.vscdb`（`cursorDiskKV`） | 支持 |
| Goose、Zed、Amazon Q、Kiro、ForgeCode | SQLite | 部分 |
| Gemini CLI、Cline、Aider、Continue、Qwen 等 | 文件 | 仅文本 |

所有智能体都会归一化为同一个时间线模型，因此无论会话来自哪个工具，查看器的
呈现都是一致的。

## 截图

| 分析 | 智能体健康度 |
|---|---|
| ![令牌与工具分析](../screenshots/analytics.jpg) | ![各智能体的配置与花费](../screenshots/health.jpg) |

支持六种语言，其中阿拉伯语为从右到左且布局完全镜像：

![阿拉伯语从右到左界面](../screenshots/rtl-arabic.jpg)

## 快速开始

```bash
pnpm install

pnpm dev            # Web 开发服务器
pnpm check          # lint + stylelint + 类型检查 + 测试(100%) + 构建
```

### 桌面端 (Deno)

```bash
pnpm desktop        # 先构建一次，然后编译并启动桌面应用
pnpm desktop:dev    # 包裹开发服务器的桌面外壳（热重载）
pnpm desktop:build  # 生成 dist/AIChatManager.app
```

Deno 会自动识别 Astro，内嵌 `dist/`，并在 Deno 运行时中运行 Node 适配器服务器；
界面渲染在系统 WebView 中。

## 功能

- 浏览项目与会话，支持筛选、预览和自定义标题
- 丰富的记录渲染：Markdown、语法高亮代码、可折叠思考、带统一差异的工具卡片、
  待办列表、图片、stdout/stderr
- 子智能体显示开关，增量“加载更多”
- 跨项目全文搜索并可跳转到具体消息
- 令牌与成本分析：模型、工具、活动热力图、热门会话
- 将会话导出为 Markdown 或 JSON
- 六种界面语言，支持 RTL 以及各语言正确的复数规则
- 通过签名的发布源检查更新
- 深色 / 浅色 / 跟随系统主题，键盘搜索（`/`、⌘K）

## 国际化

语言文件位于 `src/i18n/locales/<lang>/<namespace>.json`。新增语言只需一个文件夹
加上 `src/i18n/config.ts` 中的一条记录；设置 `dir: 'rtl'` 后布局会自动镜像，因为
样式使用的是逻辑属性（`ms`/`me`、`ps`/`pe`、`text-start`）而非物理属性。

测试会验证每种语言都提供相同的键、没有空翻译，且任何翻译都不会引入英文中不存在
的占位符。相对时间由 `Intl.RelativeTimeFormat` 生成，完全不需要键。

## 更新

`Deno.autoUpdate()` 会就地修补二进制文件，这会破坏已签名的 macOS 包
（[denoland/deno#36574](https://github.com/denoland/deno/pull/36574)），而 Windows
根本无法应用补丁。因此更新以**完整产物**的形式发布：应用读取一个 `latest.json`，
校验 Ed25519 签名与 SHA-256，然后交给安装程序并退出。

| 平台 | 安装方式 |
|---|---|
| macOS | 辅助脚本等待退出，用 `ditto` 解包并重新启动 |
| Linux | 辅助脚本替换 AppImage 并重新启动 |
| Windows | 由 `msiexec` 处理 `.msi` |

设置 `UPDATE_FEED_URL`（如需强制签名则设置 `UPDATE_PUBLIC_KEY`）。若没有发布源，
应用就不会提示任何更新。

## 许可证

[MIT](../../LICENSE)
