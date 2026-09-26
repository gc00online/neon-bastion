# Neon Bastion — 로그라이크 디펜스

광고 없는 세로형 모바일 디펜스 게임. Phaser 3 + TypeScript + Vite, 앱 포장은 Capacitor 8.
한국어/영어 지원(기기 언어 자동 선택, 메뉴 › 설정에서 변경).

## 게임 구조
- 기지가 자동으로 공격하고, **웨이브가 끝날 때마다 카드 3장 중 1장**을 골라 빌드를 만든다. (카드 24종)
- 5웨이브마다 보스: 헥스 타이탄 → 하이브 퀸(졸개 소환) → 아틸러리(원거리 탄막) 순환.
- 일반 적 9종(기본·돌격·탱커·무리·사수·분열·힐러·순간이동 등) + 보스 3종. 웨이브가 오를수록 새 적 등장.
- 판이 끝나면 보석 → **연구소**에서 영구 강화.
- **일일 도전**: 날짜별 고정 시드 + 특수 규칙 7종 중 하나. 그날 첫 판은 보석 2배.
- 첫 플레이 도움말, 설정(효과음/배경음악/진동/언어), 2배속, 일시정지.
- 그래픽·효과음·배경음악 모두 코드로 생성 → 에셋 파일·저작권 걱정 없음.
- 저장: 웹은 localStorage, 앱에서는 Capacitor Preferences(OS가 지우지 않는 저장소).

## 실행 (웹 브라우저)
```bash
npm install
npm run dev
```
폰으로 보려면 같은 와이파이에서 터미널에 나오는 `Network:` 주소로 접속.

## 주요 파일
| 파일 | 내용 |
|---|---|
| `src/data/cards.ts` | 업그레이드 카드, 등급 확률 |
| `src/data/enemies.ts` | 적·보스 능력치, 웨이브 구성, 난이도 곡선 |
| `src/data/lab.ts` | 연구소(영구 강화) 항목과 비용 |
| `src/data/daily.ts` | 일일 도전 규칙, 시드 |
| `src/game/stats.ts` | 기지 능력치와 능력별 수치 공식 |
| `src/scenes/GameScene.ts` | 전투 로직 전부 |
| `src/audio.ts`, `src/music.ts` | 효과음, 배경음악 합성 |
| `src/i18n.ts` | 언어 선택 (`L('한국어', 'English')`) |

## 개발용 도구 (npm run dev 에서만, 브라우저 콘솔)
| 명령 | 설명 |
|---|---|
| `simLab(3, 10, 'smart')` | 봇이 연구소 Lv3 상태로 10판 플레이 → 도달 웨이브 통계 |
| `simLab(3, 6, 'smart', '&mod=giants')` | 일일 도전 규칙별 난이도 측정 |
| `await art.makeStoreArt()` | 앱 아이콘·스플래시·구글 그래픽 이미지 다시 그리기 → `assets/`, `store/` |
| `await makeStoreShots()` | 스토어 스크린샷 5장 생성 (뷰포트 440×956에서 실행, 언어별 폴더) |

아이콘을 바꾼 뒤에는 `npx @capacitor/assets generate --iconBackgroundColor '#070912' --splashBackgroundColor '#070912'` 로 네이티브 아이콘을 다시 만든다.

## 앱 빌드
```bash
npm run ios       # 빌드 → iOS 프로젝트 동기화 → Xcode 열기
npm run android   # 빌드 → Android 프로젝트 동기화 → Android Studio 열기
```
출시 절차는 [RELEASE.md](RELEASE.md) 참고.
