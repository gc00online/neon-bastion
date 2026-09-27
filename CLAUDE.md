# 심야분식 — 마지막 떡볶이를 지켜라 (저장소 이름: neon-bastion)

광고 없는 세로형 로그라이크 디펜스. Phaser 3 + TypeScript + Vite, 앱은 Capacitor 8 (iOS/Android).
구조와 명령은 README.md, 그림체와 에셋 규칙은 docs/art-direction.md, 출시 절차는 RELEASE.md.

## 이미지 생성 (OpenAI)
그래픽이 필요하면 코드로 그리기 전에 OpenAI 이미지 API를 쓸 수 있다.

```bash
npm run img -- "프롬프트" [--n 4] [--size 1024x1024] [--quality medium] [--bg transparent] [--ref 참고.png] [--trim --resize 256] [--out 경로]
```
- 키는 `.env` 의 `OPENAI_API_KEY` (사용자가 직접 넣음). 키를 읽거나 출력하거나 채팅에 요구하지 말 것.
- 기본 모델 `gpt-image-2.5-flare`(빠름). 중요한 에셋은 `--model gpt-image-2.5-sunburst`.
- `art/style.txt` 가 있으면 모든 프롬프트 뒤에 공통 스타일로 붙는다(`--no-style`로 제외). 그림체 통일용.
- 새 그림은 docs/art-direction.md 의 그림체(남색 밤 골목, 호박색 등불, 구아슈 동화풍)와 기존 에셋(`public/art/`)을 `--ref`로 맞춘다.
- 같은 캐릭터/그림체를 이어가려면 기존 이미지를 `--ref`로 넘긴다(edits 엔드포인트).
- 결과는 `art/generated/`, 기록은 `art/generated/log.jsonl`. 게임에 쓸 확정본은 `public/` 아래로 옮겨 로드한다.
- 유료 API라 한 번에 많이 뽑기 전에 `--dry`로 요청을 확인하고, 시안은 `--quality low`로 먼저 뽑는다.

## 작업 규칙
- 저장소는 공개(GitHub Pages 배포)라 비밀 값·서명 키는 절대 커밋하지 않는다 (`.gitignore` 에 등록됨).
- 개발용 도구(`src/dev.ts`, `src/art.ts`, vite 저장 엔드포인트)는 dev 서버에서만 동작하고 배포 빌드에는 포함되지 않는다.
