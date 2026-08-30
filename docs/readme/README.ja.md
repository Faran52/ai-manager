# AI Manager

[English](../../README.md) ·
[العربية](README.ar.md) ·
**日本語** ·
[한국어](README.ko.md) ·
[简体中文](README.zh-CN.md) ·
[繁體中文](README.zh-TW.md)

AI コーディングセッション履歴を、ローカル優先で高速に閲覧するビューアーです。
[Astro](https://astro.build) のアイランドアプリとして構築し、
[Deno Desktop](https://docs.deno.com/runtime/desktop/)（Deno 2.9 以上）で
デスクトップアプリとして配布します。

トランスクリプトはディスクから直接読み取ります。常駐プロセスもアカウントも
テレメトリーもありません。

![展開可能なツールカードを備えたセッション表示](../screenshots/sessions.jpg)

## 対応エージェント

| エージェント | 読み取り元 | ツール呼び出し |
|---|---|---|
| Claude Code | `~/.claude/projects` の JSONL | あり |
| Codex CLI | `~/.codex` の JSONL | あり |
| GitHub Copilot | VS Code の `chatSessions` ジャーナル | あり |
| OpenCode | SQLite ストア | あり |
| Cursor | `state.vscdb`（`cursorDiskKV`） | あり |
| Goose、Zed、Amazon Q、Kiro、ForgeCode | SQLite | 一部 |
| Gemini CLI、Cline、Aider、Continue、Qwen ほか | ファイル | テキストのみ |

すべてのエージェントは単一のタイムラインモデルに正規化されるため、どのツールが
生成したセッションでも同じ見た目で表示されます。

## スクリーンショット

| 分析 | エージェントの状態 |
|---|---|
| ![トークンとツールの分析](../screenshots/analytics.jpg) | ![エージェントごとの設定とコスト](../screenshots/health.jpg) |

右から左に完全にミラーリングされるアラビア語を含む 6 言語に対応:

![アラビア語の右から左のインターフェース](../screenshots/rtl-arabic.jpg)

## クイックスタート

```bash
pnpm install

pnpm dev            # Web 開発サーバー
pnpm check          # lint + stylelint + 型チェック + テスト(100%) + ビルド
```

### デスクトップ (Deno)

```bash
pnpm desktop        # 一度ビルドしてからデスクトップアプリを起動
pnpm desktop:dev    # 開発サーバーを包むデスクトップシェル（ホットリロード）
pnpm desktop:build  # dist/AIManager.app を生成
```

Deno は Astro を自動検出して `dist/` を埋め込み、Node アダプターのサーバーを
Deno ランタイム内で実行します。UI は OS の WebView に描画されます。

## 機能

- フィルター、プレビュー、カスタムタイトル付きのプロジェクトとセッション閲覧
- 充実したトランスクリプト表示: Markdown、シンタックスハイライト、折りたたみ
  可能な思考、統合差分付きのツールカード、TODO リスト、画像、標準出力と標準エラー
- サブエージェント表示の切り替え、段階的な「さらに読み込む」
- プロジェクト横断の全文検索とメッセージへのジャンプ
- トークンとコストの分析: モデル、ツール、アクティビティヒートマップ、上位セッション
- セッションを Markdown または JSON で書き出し
- 6 言語の UI。RTL 対応と、言語ごとに正しい複数形規則
- 署名付きリリースフィードによる更新確認
- ダーク / ライト / システムのテーマ、キーボード検索（`/`、⌘K）

## 国際化

言語ファイルは `src/i18n/locales/<lang>/<namespace>.json` にあります。言語の
追加はフォルダー 1 つと `src/i18n/config.ts` への 1 行だけです。`dir: 'rtl'` を
設定すればレイアウトは自動的に反転します。スタイルが物理プロパティではなく論理
プロパティ（`ms`/`me`、`ps`/`pe`、`text-start`）を使っているためです。

すべての言語が同じキーを持つこと、空の翻訳がないこと、英語に存在しないプレース
ホルダーを翻訳が持ち込まないことをテストで検証しています。相対時刻は
`Intl.RelativeTimeFormat` が生成するため、キーは一切不要です。

## アップデート

`Deno.autoUpdate()` はバイナリをその場でパッチしますが、これは署名済み macOS
バンドルの署名を壊し（[denoland/deno#36574](https://github.com/denoland/deno/pull/36574)）、
Windows ではそもそもパッチを適用できません。そのため更新は**完全な成果物**として
配布します。アプリは 1 つの `latest.json` を読み、Ed25519 署名と SHA-256 を検証し、
インストーラーに引き渡して終了します。

| プラットフォーム | インストール経路 |
|---|---|
| macOS | ヘルパーが終了を待ち、`ditto` で展開して再起動 |
| Linux | ヘルパーが AppImage を差し替えて再起動 |
| Windows | `msiexec` が `.msi` を処理 |

`UPDATE_FEED_URL`（署名必須にする場合は `UPDATE_PUBLIC_KEY`）を設定します。
フィードがなければ更新は一切提示されません。

## ライセンス

[MIT](../../LICENSE)
