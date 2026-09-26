# 심야분식 — 마지막 떡볶이를 지켜라

서울의 작은 심야 분식집을 지키는 세로형 로그라이크 디펜스. 기존 Neon Bastion의 전투 시스템을 따뜻한 밤 골목과 음식 캐릭터로 재구성했습니다. Phaser 3 + TypeScript + Vite 8, 네이티브 포장은 Capacitor 8입니다.

## 플레이 흐름

- 움직이는 가게 배경 → 밤마실 지도 → 5개 골목을 차례로 개방합니다.
- 냄비가 자동으로 공격하고 웨이브를 마칠 때마다 3개 레시피 중 하나를 선택합니다. 기존 24종 카드와 12종 적 행동을 유지합니다.
- 첫 스테이지는 5웨이브, 뒤로 갈수록 5~15웨이브. 완료 시 남은 체력에 따라 별 1~3개와 최초 1회 보상을 받습니다.
- 영업 종료 후 엽전으로 비밀 레시피 10종을 영구 강화합니다. 경험치 200마다 냄비 표시 레벨이 오릅니다. 표시 레벨 자체의 능력치 보너스는 없고 능력치 강화는 레시피 구매로 적용됩니다.
- 매일 규칙이 바뀌는 무한 도전, 첫 일일 영업 보상 2배, 일시정지와 2배속을 지원합니다.
- 한국어/영어는 앱에서 렌더링합니다. 배경 이미지와 영상에는 제목이나 UI 문자를 넣지 않았습니다.
- 메뉴 영상은 무음 재생되며 자동 재생이 막히거나 동작 줄이기 설정을 사용하면 정지 이미지가 표시됩니다.

## 개발

Node.js 22.18 이상(24 권장)이 필요합니다.

```sh
npm ci
npm run dev
npm test
npm run build
```

웹 미리보기는 개발 서버 주소로 접속합니다. `main`에 푸시하면 기존 GitHub Pages 워크플로가 배포하므로 작업 브랜치에서 검토하세요. 저장소 주소와 네이티브 앱 ID는 기존 설치 호환을 위해 유지했습니다.

## 저장 호환성

기존 `neon-bastion-save-v1` 키를 유지합니다. 기존 보석 잔액은 엽전으로, 연구소 강화는 비밀 레시피로 이어지며 최고 기록·설정·일일 기록도 보존합니다. 새 필드 `xp`, `stages`는 기본값으로 채웁니다. 웹은 localStorage, 앱은 Capacitor Preferences를 사용합니다.

## 주요 파일

| 파일 | 역할 |
| --- | --- |
| `src/scenes/MenuScene.ts` | 배경 영상, 메인 메뉴, 설정 |
| `src/scenes/StageScene.ts`, `src/data/stages.ts` | 스테이지 선택과 구성 |
| `src/scenes/LabScene.ts` | 냄비 성장, 영구 레시피 |
| `src/scenes/GameScene.ts` | 전투, 레시피 선택, 결과 |
| `src/game/progression.ts`, `src/game/saveSchema.ts` | 보상·진행도와 저장 마이그레이션 |
| `src/style.css`, `src/style-polish.css`, `src/ui/dom.ts` | 반응형 UI, 손그림 질감, 화면 수명 관리 |
| `public/art/` | 적용된 컨셉 이미지·스프라이트·영상 |
| `tests/progression.test.mjs` | 저장 호환·보상·해금·레벨 검사 |

## 네이티브 앱

```sh
npm run ios
npm run android
```

웹 빌드와 별도로 Xcode/Android Studio에서 기기 빌드·서명·실기기 확인이 필요합니다. 앱 이름, 아이콘, 스플래시를 심야분식으로 교체했습니다. 기존 `RELEASE.md`와 `store/` 자료에는 이전 이름·스크린샷이 남아 있으므로 출시 전에 갱신해야 합니다. 개인정보처리방침의 개발자 이름과 연락처 자리표시자도 실제 정보로 채워야 합니다.

개발용 `simLab(level, runs, 'smart')` 콘솔 도구는 유지했습니다. 예전 Canvas 전용 스토어 자동 촬영 도구는 새 DOM UI를 담지 못해 노출을 제거했습니다. 새 스크린샷은 전체 페이지를 캡처해야 합니다.

아트 제작 기준과 출처는 [docs/art-direction.md](docs/art-direction.md)를 참고하세요.
