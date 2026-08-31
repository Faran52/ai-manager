# AI Manager

[English](../../README.md) ·
[العربية](README.ar.md) ·
**日本語** ·
[한국어](README.ko.md) ·
[简体中文](README.zh-CN.md) ·
[繁體中文](README.zh-TW.md)

AI コーディングセッション履歴を、ローカル優先で高速に閲覧するビューアーです。
トランスクリプトはディスクから直接読み取ります。常駐プロセスも、アカウントも、
テレメトリーもありません。

[Astro](https://astro.build) のアイランドアプリで、
[Deno Desktop](https://docs.deno.com/runtime/desktop/)（Deno 2.9 以上）で
デスクトップアプリとして配布します。

![展開可能なツールカードを備えたセッション表示](../screenshots/sessions.jpg)

## 対応エージェント

| エージェント | 読み取り元 | ツール呼び出し |
|---|---|---|
| Claude Code | `~/.claude/projects` の JSONL | あり |
| Codex CLI | `~/.codex` の JSONL | あり |
| GitHub Copilot | VS Code の `chatSessions` ジャーナル | あり |
| OpenCode | SQLite ストア | あり |
| Cursor | `state.vscdb`（`cursorDiskKV`） | あり |
| Gemini CLI | `~/.gemini/tmp/*/chats` ログ | あり |
| Antigravity CLI | `~/.gemini/antigravity-cli` の brain トランスクリプト | ステップマーカー |
| Goose、Zed、Amazon Q、Kiro、ForgeCode | SQLite | 一部 |
| Cline、Aider、Continue、Qwen ほか約 15 種 | ファイル | テキストのみ |

すべてのエージェントは単一のタイムラインモデルに正規化されるため、どのツールが
生成したセッションでも同じ見た目で表示されます。

## スクリーンショット

| 分析 | エージェントの状態 |
|---|---|
| ![トークンとツールの分析](../screenshots/analytics.jpg) | ![エージェントごとの設定とコスト](../screenshots/health.jpg) |

![アラビア語の右から左のインターフェース](../screenshots/rtl-arabic.jpg)

## インストール

[最新リリース](https://github.com/Faran52/ai-manager/releases/latest)から
プラットフォーム向けのビルドを入手します。

有料の Developer ID で署名していないため、OS はダウンロードを隔離し、一度だけ
解除操作が必要です。ファイルに問題はありません。OS が、証明書に費用を払って
いない発行元を信頼しないだけです。

- **macOS.** 隔離フラグを外してから、通常どおりアプリを開きます:
  ```bash
  xattr -dr com.apple.quarantine "/Applications/AI Manager.app"
  ```
  アプリが `/Applications` にあり管理者アカウントでない場合は `sudo` を付けるか、
  先に `~/Applications` へ移動します。GUI で行うには、最初の起動がブロックされた
  あとに表示される通知の下で **システム設定 → プライバシーとセキュリティ →
  このまま開く** を選びます。
- **Windows.** SmartScreen に *Windows によって PC が保護されました* と表示され
  ます。*詳細情報* → *実行* を選びます。
- **Linux.** `chmod +x AIManager-linux.AppImage` を実行してから起動します。

自分でコンパイルしたビルドには隔離フラグが付かないため、この操作は不要です。

## 開発

```bash
pnpm install

pnpm dev            # Web 開発サーバー
pnpm check          # lint、stylelint、型チェック、テスト(100%)、ビルド
pnpm desktop        # 一度ビルドしてからデスクトップアプリをコンパイルして起動
pnpm desktop:dev    # 開発サーバーを包むデスクトップシェル、ホットリロード
```

Node アダプターのサーバーは単体でも動きます: `node dist/server/entry.mjs`。

構成は LintelJS レイアウトで、`plugins/linteljs/skills/linteljs/SKILL.md` が
その規約です:

```
src/
  pages/index.astro    単一のクライアントアイランド
  pages/api/*.ts        POST エンドポイント。ケバブケースのファイル名 = URL セグメント
  components/ui/        プリミティブ
  components/features/  app-shell、sidebar、session-viewer、analytics ほか
  lib/services/         ディスク上のリーダー。フォルダーごとに 1 つの <domain>Service.ts
  lib/apis/             ワイヤー契約、エンドポイントハンドラー、型付き fetch クライアント
  i18n/                 ランタイム、設定、ロケール名前空間
```

データは `アイランド → apiClient → /api ルート → サービス → ディスク上の履歴`
と流れます。サービスは HTTP に触れず、ドメインへは `@services/<domain>` の
ファサード経由でのみアクセスします。これは lint で強制されます。

## 機能

- フィルター、プレビュー、カスタムタイトル付きのプロジェクトとセッション閲覧
- 充実したトランスクリプト表示: Markdown、シンタックスハイライト、折りたたみ
  可能な思考、統合差分付きのツールカード、TODO リスト、画像、標準出力と標準エラー
- サブエージェント表示の切り替え、段階的なページング
- プロジェクト横断の全文検索とメッセージへのジャンプ
- トークンとコストの分析: モデル、ツール、アクティビティヒートマップ、上位セッション
- エージェントの状態: フック、プラグイン、MCP サーバー、プロジェクトごとのコスト
- エージェントがプルーニングする前に実行される保持ポリシー付きのアーカイブマネージャー
- セッションを Markdown または JSON で書き出し
- 6 言語の UI。右から左に反転するアラビア語を含む
- ダーク / ライト / システムのテーマ、キーボード検索（`/`、⌘K）
- 署名付きリリースフィードによる更新確認（[RELEASE.md](../../RELEASE.md)）

## 国際化

言語は `src/i18n/locales/<lang>/` 配下のフォルダーと、`src/i18n/config.ts` への
1 行です。`dir: 'rtl'` を設定すればレイアウトは自動的に反転します。スタイルが
物理プロパティではなく論理プロパティ（`ms`/`me`、`ps`/`pe`、`text-start`）を
使っているためです。すべての言語が同じキーを空欄なく持つことをテストが検証します。

## ライセンス

[MIT](../../LICENSE)
