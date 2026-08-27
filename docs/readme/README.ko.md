# AI Chat Manager

[English](../../README.md) ·
[العربية](README.ar.md) ·
[日本語](README.ja.md) ·
**한국어** ·
[简体中文](README.zh-CN.md) ·
[繁體中文](README.zh-TW.md)

AI 코딩 세션 기록을 로컬 우선으로 빠르게 보는 뷰어입니다.
[Astro](https://astro.build) 아일랜드 앱으로 만들고
[Deno Desktop](https://docs.deno.com/runtime/desktop/)(Deno 2.9 이상)으로
데스크톱에 배포합니다.

기록은 디스크에서 바로 읽습니다. 데몬도, 계정도, 텔레메트리도 없습니다.

![펼칠 수 있는 도구 카드가 있는 세션 기록](../screenshots/sessions.jpg)

## 지원 에이전트

| 에이전트 | 읽는 위치 | 도구 호출 |
|---|---|---|
| Claude Code | `~/.claude/projects`의 JSONL | 지원 |
| Codex CLI | `~/.codex`의 JSONL | 지원 |
| GitHub Copilot | VS Code `chatSessions` 저널 | 지원 |
| OpenCode | SQLite 저장소 | 지원 |
| Cursor | `state.vscdb`(`cursorDiskKV`) | 지원 |
| Goose, Zed, Amazon Q, Kiro, ForgeCode | SQLite | 일부 |
| Gemini CLI, Cline, Aider, Continue, Qwen 외 | 파일 | 텍스트만 |

모든 에이전트가 하나의 타임라인 모델로 정규화되므로, 어떤 도구가 만든
세션이든 동일한 모습으로 보입니다.

## 스크린샷

| 분석 | 에이전트 상태 |
|---|---|
| ![토큰 및 도구 분석](../screenshots/analytics.jpg) | ![에이전트별 설정과 비용](../screenshots/health.jpg) |

레이아웃이 완전히 반전되는 아랍어를 포함해 6개 언어를 지원합니다:

![아랍어 오른쪽에서 왼쪽 인터페이스](../screenshots/rtl-arabic.jpg)

## 빠른 시작

```bash
pnpm install

pnpm dev            # 웹 개발 서버
pnpm check          # lint + stylelint + 타입 검사 + 테스트(100%) + 빌드
```

### 데스크톱 (Deno)

```bash
pnpm desktop        # 한 번 빌드한 뒤 데스크톱 앱을 컴파일하고 실행
pnpm desktop:dev    # 개발 서버를 감싸는 데스크톱 셸(핫 리로드)
pnpm desktop:build  # dist/AIChatManager.app 생성
```

Deno가 Astro를 자동으로 감지해 `dist/`를 포함하고, Node 어댑터 서버를 Deno
런타임 안에서 실행합니다. UI는 OS 웹뷰에 렌더링됩니다.

## 기능

- 필터, 미리보기, 사용자 지정 제목이 있는 프로젝트 및 세션 탐색
- 풍부한 기록 렌더링: 마크다운, 구문 강조 코드, 접을 수 있는 사고 과정,
  통합 diff가 포함된 도구 카드, 할 일 목록, 이미지, stdout/stderr
- 하위 에이전트 표시 전환, 점진적 "더 보기" 페이징
- 프로젝트 전체 전문 검색과 메시지로 바로 이동
- 토큰/비용 분석: 모델, 도구, 활동 히트맵, 주요 세션
- 세션을 Markdown 또는 JSON으로 내보내기
- 6개 UI 언어, RTL 지원과 언어별 올바른 복수형 규칙
- 서명된 릴리스 피드를 통한 업데이트 확인
- 다크 / 라이트 / 시스템 테마, 키보드 검색(`/`, ⌘K)

## 국제화

언어 파일은 `src/i18n/locales/<lang>/<namespace>.json`에 있습니다. 언어 추가는
폴더 하나와 `src/i18n/config.ts`의 항목 하나면 됩니다. `dir: 'rtl'`을 설정하면
레이아웃이 스스로 반전되는데, 스타일이 물리 속성이 아니라 논리 속성
(`ms`/`me`, `ps`/`pe`, `text-start`)을 쓰기 때문입니다.

모든 언어가 같은 키를 갖는지, 빈 번역이 없는지, 영어에 없는 자리표시자를
번역이 만들어내지 않는지를 테스트가 검증합니다. 상대 시간은
`Intl.RelativeTimeFormat`이 생성하므로 키가 전혀 필요 없습니다.

## 업데이트

`Deno.autoUpdate()`는 바이너리를 제자리에서 패치하는데, 이는 서명된 macOS
번들의 서명을 깨뜨리고([denoland/deno#36574](https://github.com/denoland/deno/pull/36574)),
Windows는 패치를 아예 적용하지 못합니다. 그래서 업데이트는 **전체 아티팩트**로
배포합니다. 앱이 `latest.json` 하나를 읽고 Ed25519 서명과 SHA-256을 검증한 뒤
설치 프로그램에 넘기고 종료합니다.

| 플랫폼 | 설치 경로 |
|---|---|
| macOS | 헬퍼가 종료를 기다린 뒤 `ditto`로 풀고 다시 실행 |
| Linux | 헬퍼가 AppImage를 교체하고 다시 실행 |
| Windows | `msiexec`가 `.msi`를 처리 |

`UPDATE_FEED_URL`(서명을 필수로 하려면 `UPDATE_PUBLIC_KEY`)을 설정하세요.
피드가 없으면 앱은 업데이트를 제안하지 않습니다.

## 라이선스

[MIT](../../LICENSE)
