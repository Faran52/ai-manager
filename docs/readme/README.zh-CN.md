# AI Manager

[English](../../README.md) ·
[العربية](README.ar.md) ·
[日本語](README.ja.md) ·
[한국어](README.ko.md) ·
**简体中文** ·
[繁體中文](README.zh-TW.md)

一个快速、本地优先的 AI 编程会话历史查看器。直接从磁盘读取记录：没有后台进程，
没有账号，没有遥测。

基于 [Astro](https://astro.build) 岛屿架构，并通过
[Deno Desktop](https://docs.deno.com/runtime/desktop/)（Deno ≥ 2.9）发布为桌面应用。

![带可展开工具卡片的会话记录](../screenshots/sessions.jpg)

## 支持的智能体

| 智能体 | 读取来源 | 工具调用 |
|---|---|---|
| Claude Code | `~/.claude/projects` 中的 JSONL | 支持 |
| Codex CLI | `~/.codex` 中的 JSONL | 支持 |
| GitHub Copilot | VS Code 的 `chatSessions` 日志 | 支持 |
| OpenCode | SQLite 存储 | 支持 |
| Cursor | `state.vscdb`（`cursorDiskKV`） | 支持 |
| Gemini CLI | `~/.gemini/tmp/*/chats` 日志 | 支持 |
| Antigravity CLI | `~/.gemini/antigravity-cli` 的 brain 转录 | 步骤标记 |
| Goose、Zed、Amazon Q、Kiro、ForgeCode | SQLite | 部分 |
| Cline、Aider、Continue、Qwen 等约 15 种 | 文件 | 仅文本 |

所有智能体都会归一化为同一个时间线模型，因此无论会话来自哪个工具，查看器的
呈现都是一致的。

## 截图

| 分析 | 智能体健康度 |
|---|---|
| ![令牌与工具分析](../screenshots/analytics.jpg) | ![各智能体的配置与花费](../screenshots/health.jpg) |

![阿拉伯语从右到左界面](../screenshots/rtl-arabic.jpg)

## 安装

从[最新发布](https://github.com/Faran52/ai-manager/releases/latest)下载对应平台的构建。

由于没有用付费的 Developer ID 签名，系统会先隔离下载文件，需要你手动解除一次。
文件本身没有问题，只是系统不信任未付费购买证书的发行者。

- **macOS.** 先清除隔离标记，再照常打开应用：
  ```bash
  xattr -dr com.apple.quarantine "/Applications/AI Manager.app"
  ```
  如果应用在 `/Applications` 且你不是管理员账户，请加上 `sudo`，或先移动到
  `~/Applications`。图形界面的做法是：首次启动被拦截后，在出现的提示下方选择
  **系统设置 → 隐私与安全性 → 仍要打开**。
- **Windows.** SmartScreen 会显示 *Windows 已保护你的电脑*。选择 *更多信息* →
  *仍要运行*。
- **Linux.** 执行 `chmod +x AIManager-linux.AppImage` 后运行。

自己编译的构建不会带隔离标记，因此无需这些步骤。

## 开发

```bash
pnpm install

pnpm dev            # Web 开发服务器
pnpm check          # lint、stylelint、类型检查、测试(100%)、构建
pnpm desktop        # 先构建一次，然后编译并启动桌面应用
pnpm desktop:dev    # 包裹开发服务器的桌面外壳，热重载
```

Node 适配器服务器也可单独运行：`node dist/server/entry.mjs`。

结构采用 LintelJS 布局，`plugins/linteljs/skills/linteljs/SKILL.md` 是其约定：

```
src/
  pages/index.astro    唯一的客户端岛屿
  pages/api/*.ts        POST 端点，短横线命名的文件名 = URL 片段
  components/ui/        基础组件
  components/features/  app-shell、sidebar、session-viewer、analytics 等
  lib/services/         磁盘读取器，每个文件夹一个 <domain>Service.ts
  lib/apis/             传输契约、端点处理器、带类型的 fetch 客户端
  i18n/                 运行时、配置、语言命名空间
```

数据流向为 `岛屿 → apiClient → /api 路由 → 服务 → 磁盘上的历史`。服务不触碰
HTTP，访问某个领域只能通过它的 `@services/<domain>` 门面，这一点由 lint 强制。

## 功能

- 浏览项目与会话，支持筛选、预览和自定义标题
- 丰富的记录渲染：Markdown、语法高亮代码、可折叠思考、带统一差异的工具卡片、
  待办列表、图片、stdout/stderr
- 子智能体显示开关，增量分页
- 跨项目全文搜索并可跳转到具体消息
- 令牌与成本分析：模型、工具、活动热力图、热门会话
- 智能体健康度：钩子、插件、MCP 服务器，以及各项目的花费
- 带保留策略的归档管理器，会在智能体清理之前先运行
- 将会话导出为 Markdown 或 JSON
- 六种界面语言，包含布局镜像的阿拉伯语
- 深色 / 浅色 / 跟随系统主题，键盘搜索（`/`、⌘K）
- 通过签名的发布源检查更新（[RELEASE.md](../../RELEASE.md)）

## 国际化

一种语言就是 `src/i18n/locales/<lang>/` 下的一个文件夹，加上 `src/i18n/config.ts`
中的一行。设置 `dir: 'rtl'` 后布局会自动镜像，因为样式使用的是逻辑属性
（`ms`/`me`、`ps`/`pe`、`text-start`）而非物理属性。测试会验证每种语言都提供
相同的键且没有空翻译。

## 许可证

[MIT](../../LICENSE)
