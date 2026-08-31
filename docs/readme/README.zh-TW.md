# AI Manager

[English](../../README.md) ·
[العربية](README.ar.md) ·
[日本語](README.ja.md) ·
[한국어](README.ko.md) ·
[简体中文](README.zh-CN.md) ·
**繁體中文**

一個快速、以本機為主的 AI 程式設計工作階段紀錄檢視器。直接從磁碟讀取紀錄：
沒有背景服務、沒有帳號、沒有遙測。

以 [Astro](https://astro.build) 島嶼架構建構，並透過
[Deno Desktop](https://docs.deno.com/runtime/desktop/)（Deno ≥ 2.9）發佈為桌面應用程式。

![具有可展開工具卡片的工作階段紀錄](../screenshots/sessions.jpg)

## 支援的代理

| 代理 | 讀取來源 | 工具呼叫 |
|---|---|---|
| Claude Code | `~/.claude/projects` 的 JSONL | 支援 |
| Codex CLI | `~/.codex` 的 JSONL | 支援 |
| GitHub Copilot | VS Code 的 `chatSessions` 日誌 | 支援 |
| OpenCode | SQLite 儲存區 | 支援 |
| Cursor | `state.vscdb`（`cursorDiskKV`） | 支援 |
| Gemini CLI | `~/.gemini/tmp/*/chats` 日誌 | 支援 |
| Antigravity CLI | `~/.gemini/antigravity-cli` 的 brain 轉錄 | 步驟標記 |
| Goose、Zed、Amazon Q、Kiro、ForgeCode | SQLite | 部分 |
| Cline、Aider、Continue、Qwen 等約 15 種 | 檔案 | 僅文字 |

所有代理都會正規化為同一個時間軸模型，因此無論工作階段由哪個工具產生，檢視器
的呈現都一致。

## 螢幕擷圖

| 分析 | 代理健康度 |
|---|---|
| ![權杖與工具分析](../screenshots/analytics.jpg) | ![各代理的設定與花費](../screenshots/health.jpg) |

![阿拉伯文由右至左介面](../screenshots/rtl-arabic.jpg)

## 安裝

從[最新發佈](https://github.com/Faran52/ai-manager/releases/latest)下載對應平台的建置。

由於沒有以付費的 Developer ID 簽署，系統會先隔離下載檔案，需要你手動解除一次。
檔案本身沒有問題，只是系統不信任未付費購買憑證的發行者。

- **macOS.** 先清除隔離標記，再照常開啟應用程式：
  ```bash
  xattr -dr com.apple.quarantine "/Applications/AI Manager.app"
  ```
  如果應用程式在 `/Applications` 且你不是管理者帳號，請加上 `sudo`，或先移到
  `~/Applications`。圖形介面的做法是：首次啟動被攔截後，在出現的通知下方選擇
  **系統設定 → 隱私權與安全性 → 仍要打開**。
- **Windows.** SmartScreen 會顯示 *Windows 已保護您的電腦*。選擇 *其他資訊* →
  *仍要執行*。
- **Linux.** 執行 `chmod +x AIManager-linux.AppImage` 後執行。

自己編譯的建置不會帶隔離標記，因此不需要這些步驟。

## 開發

```bash
pnpm install

pnpm dev            # Web 開發伺服器
pnpm check          # lint、stylelint、型別檢查、測試(100%)、建置
pnpm desktop        # 先建置一次，接著編譯並啟動桌面應用程式
pnpm desktop:dev    # 包住開發伺服器的桌面外殼，熱重載
```

Node 轉接器伺服器也可單獨執行：`node dist/server/entry.mjs`。

結構採用 LintelJS 佈局，`plugins/linteljs/skills/linteljs/SKILL.md` 是其規約：

```
src/
  pages/index.astro    唯一的用戶端島嶼
  pages/api/*.ts        POST 端點，短橫線命名的檔名 = URL 區段
  components/ui/        基礎元件
  components/features/  app-shell、sidebar、session-viewer、analytics 等
  lib/services/         磁碟讀取器，每個資料夾一個 <domain>Service.ts
  lib/apis/             傳輸契約、端點處理器、具型別的 fetch 用戶端
  i18n/                 執行環境、設定、語系命名空間
```

資料流向為 `島嶼 → apiClient → /api 路由 → 服務 → 磁碟上的紀錄`。服務不觸碰
HTTP，存取某個領域只能透過它的 `@services/<domain>` 門面，這一點由 lint 強制。

## 功能

- 瀏覽專案與工作階段，支援篩選、預覽與自訂標題
- 豐富的紀錄呈現：Markdown、語法高亮程式碼、可摺疊思考、含統一差異的工具卡片、
  待辦清單、圖片、stdout/stderr
- 子代理顯示切換，漸進式分頁
- 跨專案全文搜尋並可跳至特定訊息
- 權杖與成本分析：模型、工具、活動熱圖、熱門工作階段
- 代理健康度：掛鉤、外掛、MCP 伺服器，以及各專案的花費
- 帶保留策略的封存管理器，會在代理清理之前先執行
- 將工作階段匯出為 Markdown 或 JSON
- 六種介面語言，包含版面鏡像的阿拉伯文
- 深色 / 淺色 / 跟隨系統佈景主題，鍵盤搜尋（`/`、⌘K）
- 透過已簽署的發佈來源檢查更新（[RELEASE.md](../../RELEASE.md)）

## 國際化

一種語言就是 `src/i18n/locales/<lang>/` 下的一個資料夾，加上 `src/i18n/config.ts`
中的一行。設定 `dir: 'rtl'` 後版面會自動鏡像，因為樣式使用的是邏輯屬性
（`ms`/`me`、`ps`/`pe`、`text-start`）而非實體屬性。測試會驗證每種語言都提供
相同的鍵且沒有空白翻譯。

## 授權

[MIT](../../LICENSE)
