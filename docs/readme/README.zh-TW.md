# AI Manager

[English](../../README.md) ·
[العربية](README.ar.md) ·
[日本語](README.ja.md) ·
[한국어](README.ko.md) ·
[简体中文](README.zh-CN.md) ·
**繁體中文**

一個快速、以本機為主的 AI 程式設計工作階段紀錄檢視器，以
[Astro](https://astro.build) 島嶼架構建構，並透過
[Deno Desktop](https://docs.deno.com/runtime/desktop/)（Deno ≥ 2.9）發佈為桌面應用程式。

直接從磁碟讀取紀錄。沒有背景服務、沒有帳號、沒有遙測。

![具有可展開工具卡片的工作階段紀錄](../screenshots/sessions.jpg)

## 支援的代理

| 代理 | 讀取來源 | 工具呼叫 |
|---|---|---|
| Claude Code | `~/.claude/projects` 的 JSONL | 支援 |
| Codex CLI | `~/.codex` 的 JSONL | 支援 |
| GitHub Copilot | VS Code 的 `chatSessions` 日誌 | 支援 |
| OpenCode | SQLite 儲存區 | 支援 |
| Cursor | `state.vscdb`（`cursorDiskKV`） | 支援 |
| Goose、Zed、Amazon Q、Kiro、ForgeCode | SQLite | 部分 |
| Gemini CLI、Cline、Aider、Continue、Qwen 等 | 檔案 | 僅文字 |

所有代理都會正規化為同一個時間軸模型，因此無論工作階段由哪個工具產生，檢視器
的呈現都一致。

## 螢幕擷圖

| 分析 | 代理健康度 |
|---|---|
| ![權杖與工具分析](../screenshots/analytics.jpg) | ![各代理的設定與花費](../screenshots/health.jpg) |

支援六種語言，其中阿拉伯文為由右至左且版面完全鏡像：

![阿拉伯文由右至左介面](../screenshots/rtl-arabic.jpg)

## 快速開始

```bash
pnpm install

pnpm dev            # Web 開發伺服器
pnpm check          # lint + stylelint + 型別檢查 + 測試(100%) + 建置
```

### 桌面版 (Deno)

```bash
pnpm desktop        # 先建置一次，接著編譯並啟動桌面應用程式
pnpm desktop:dev    # 包住開發伺服器的桌面外殼（熱重載）
pnpm desktop:build  # 產生 dist/AIManager.app
```

Deno 會自動偵測 Astro，內嵌 `dist/`，並在 Deno 執行環境中執行 Node 轉接器伺服器；
介面則在系統 WebView 中呈現。

## 功能

- 瀏覽專案與工作階段，支援篩選、預覽與自訂標題
- 豐富的紀錄呈現：Markdown、語法高亮程式碼、可摺疊思考、含統一差異的工具卡片、
  待辦清單、圖片、stdout/stderr
- 子代理顯示切換，漸進式「載入更多」
- 跨專案全文搜尋並可跳至特定訊息
- 權杖與成本分析：模型、工具、活動熱圖、熱門工作階段
- 將工作階段匯出為 Markdown 或 JSON
- 六種介面語言，支援 RTL 以及各語言正確的複數規則
- 透過已簽署的發佈來源檢查更新
- 深色 / 淺色 / 跟隨系統佈景主題，鍵盤搜尋（`/`、⌘K）

## 國際化

語言檔案位於 `src/i18n/locales/<lang>/<namespace>.json`。新增語言只需要一個資料夾
加上 `src/i18n/config.ts` 中的一筆設定；設定 `dir: 'rtl'` 後版面會自動鏡像，因為
樣式使用的是邏輯屬性（`ms`/`me`、`ps`/`pe`、`text-start`）而非實體屬性。

測試會驗證每種語言都提供相同的鍵、沒有空白翻譯，且任何翻譯都不會引入英文未定義
的佔位符。相對時間由 `Intl.RelativeTimeFormat` 產生，完全不需要鍵。

## 更新

`Deno.autoUpdate()` 會就地修補二進位檔，這會破壞已簽署的 macOS 套件
（[denoland/deno#36574](https://github.com/denoland/deno/pull/36574)），而 Windows
根本無法套用修補檔。因此更新以**完整產物**發佈：應用程式讀取單一 `latest.json`，
驗證 Ed25519 簽章與 SHA-256，接著交給安裝程式並結束。

| 平台 | 安裝方式 |
|---|---|
| macOS | 輔助程式等待結束，以 `ditto` 解開並重新啟動 |
| Linux | 輔助程式替換 AppImage 並重新啟動 |
| Windows | 由 `msiexec` 處理 `.msi` |

設定 `UPDATE_FEED_URL`（若要強制簽章則設定 `UPDATE_PUBLIC_KEY`）。若沒有發佈來源，
應用程式就不會提示任何更新。

## 授權

[MIT](../../LICENSE)
