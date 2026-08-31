# AI Manager

[English](../../README.md) ·
[العربية](README.ar.md) ·
[日本語](README.ja.md) ·
**한국어** ·
[简体中文](README.zh-CN.md) ·
[繁體中文](README.zh-TW.md)

AI 코딩 세션 기록을 로컬 우선으로 빠르게 보는 뷰어입니다. 기록은 디스크에서
바로 읽습니다. 데몬도, 계정도, 텔레메트리도 없습니다.

[Astro](https://astro.build) 아일랜드 앱이며
[Deno Desktop](https://docs.deno.com/runtime/desktop/)(Deno 2.9 이상)으로
데스크톱에 배포합니다.

![펼칠 수 있는 도구 카드가 있는 세션 기록](../screenshots/sessions.jpg)

## 지원 에이전트

| 에이전트 | 읽는 위치 | 도구 호출 |
|---|---|---|
| Claude Code | `~/.claude/projects`의 JSONL | 지원 |
| Codex CLI | `~/.codex`의 JSONL | 지원 |
| GitHub Copilot | VS Code `chatSessions` 저널 | 지원 |
| OpenCode | SQLite 저장소 | 지원 |
| Cursor | `state.vscdb`(`cursorDiskKV`) | 지원 |
| Gemini CLI | `~/.gemini/tmp/*/chats` 로그 | 지원 |
| Antigravity CLI | `~/.gemini/antigravity-cli` brain 기록 | 단계 표시 |
| Goose, Zed, Amazon Q, Kiro, ForgeCode | SQLite | 일부 |
| Cline, Aider, Continue, Qwen 외 약 15종 | 파일 | 텍스트만 |

모든 에이전트가 하나의 타임라인 모델로 정규화되므로, 어떤 도구가 만든
세션이든 동일한 모습으로 보입니다.

## 스크린샷

| 분석 | 에이전트 상태 |
|---|---|
| ![토큰 및 도구 분석](../screenshots/analytics.jpg) | ![에이전트별 설정과 비용](../screenshots/health.jpg) |

![아랍어 오른쪽에서 왼쪽 인터페이스](../screenshots/rtl-arabic.jpg)

## 설치

[최신 릴리스](https://github.com/Faran52/ai-manager/releases/latest)에서
플랫폼에 맞는 빌드를 받으세요.

유료 Developer ID로 서명하지 않았기 때문에 OS가 다운로드를 격리하며, 한 번만
해제하면 됩니다. 파일에는 문제가 없습니다. OS가 인증서 비용을 내지 않은
게시자를 신뢰하지 않을 뿐입니다.

- **macOS.** 격리 플래그를 제거한 뒤 평소처럼 앱을 엽니다:
  ```bash
  xattr -dr com.apple.quarantine "/Applications/AI Manager.app"
  ```
  앱이 `/Applications`에 있고 관리자 계정이 아니라면 `sudo`를 붙이거나 먼저
  `~/Applications`로 옮기세요. GUI로 하려면 첫 실행이 차단된 뒤 나타나는 알림
  아래에서 **시스템 설정 → 개인정보 보호 및 보안 → 확인 없이 열기**를 선택합니다.
- **Windows.** SmartScreen이 *Windows의 PC 보호*를 표시합니다. *추가 정보* →
  *실행*을 선택합니다.
- **Linux.** `chmod +x AIManager-linux.AppImage` 후 실행합니다.

직접 컴파일한 빌드에는 격리 플래그가 없으므로 이 과정이 필요 없습니다.

## 개발

```bash
pnpm install

pnpm dev            # 웹 개발 서버
pnpm check          # lint, stylelint, 타입 검사, 테스트(100%), 빌드
pnpm desktop        # 한 번 빌드한 뒤 데스크톱 앱을 컴파일하고 실행
pnpm desktop:dev    # 개발 서버를 감싸는 데스크톱 셸, 핫 리로드
```

Node 어댑터 서버는 단독으로도 실행됩니다: `node dist/server/entry.mjs`.

구조는 LintelJS 레이아웃이며 `plugins/linteljs/skills/linteljs/SKILL.md`가
그 규약입니다:

```
src/
  pages/index.astro    단일 클라이언트 아일랜드
  pages/api/*.ts        POST 엔드포인트. 케밥케이스 파일명 = URL 세그먼트
  components/ui/        프리미티브
  components/features/  app-shell, sidebar, session-viewer, analytics 등
  lib/services/         디스크 리더. 폴더마다 하나의 <domain>Service.ts
  lib/apis/             와이어 계약, 엔드포인트 핸들러, 타입이 있는 fetch 클라이언트
  i18n/                 런타임, 설정, 로케일 네임스페이스
```

데이터는 `아일랜드 → apiClient → /api 라우트 → 서비스 → 디스크의 기록` 순으로
흐릅니다. 서비스는 HTTP를 건드리지 않으며, 도메인에는 `@services/<domain>`
파사드로만 접근합니다. 이는 lint가 강제합니다.

## 기능

- 필터, 미리보기, 사용자 지정 제목이 있는 프로젝트 및 세션 탐색
- 풍부한 기록 렌더링: 마크다운, 구문 강조 코드, 접을 수 있는 사고 과정,
  통합 diff가 포함된 도구 카드, 할 일 목록, 이미지, stdout/stderr
- 하위 에이전트 표시 전환, 점진적 페이징
- 프로젝트 전체 전문 검색과 메시지로 바로 이동
- 토큰/비용 분석: 모델, 도구, 활동 히트맵, 주요 세션
- 에이전트 상태: 훅, 플러그인, MCP 서버, 프로젝트별 비용
- 에이전트가 정리하기 전에 실행되는 보존 정책이 있는 아카이브 관리자
- 세션을 Markdown 또는 JSON으로 내보내기
- 6개 UI 언어. 레이아웃이 반전되는 아랍어 포함
- 다크 / 라이트 / 시스템 테마, 키보드 검색(`/`, ⌘K)
- 서명된 릴리스 피드를 통한 업데이트 확인([RELEASE.md](../../RELEASE.md))

## 국제화

언어는 `src/i18n/locales/<lang>/` 아래 폴더 하나와 `src/i18n/config.ts`의 한
줄입니다. `dir: 'rtl'`을 설정하면 레이아웃이 스스로 반전되는데, 스타일이 물리
속성이 아니라 논리 속성(`ms`/`me`, `ps`/`pe`, `text-start`)을 쓰기 때문입니다.
모든 언어가 같은 키를 빈 값 없이 갖는지 테스트가 검증합니다.

## 라이선스

[MIT](../../LICENSE)
