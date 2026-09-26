# 심야분식 아트 적용

사용자가 승인한 ‘심야분식 — 마지막 떡볶이를 지켜라’ 컨셉 이미지와 2026-09-26에 제공한 6번 메뉴 이미지를 기준으로 제작했습니다.

## 5개 지도와 전장

`public/art/chapters/map-01.webp`부터 `map-05.webp`까지 각 장의 길과 조명을 달리한 삽화입니다. 선택 화면은 장 단위 버튼·좌우 넘김으로 전환하며 각 그림 위에 5개 비트맵 표식을 얹습니다. 총 25개 스테이지입니다. 같은 장의 전투에는 `arena-01.webp`부터 `arena-05.webp`까지 각각 다른 하향 시점 골목 배경을 씁니다. 손님은 위쪽 다섯 진입로에서 내려오고, 아래쪽 냄비에서 국물 방울을 발사합니다. 지도·전장 배경은 현재 정지 이미지이며 영상 반복은 나중에 적용합니다.

이미지 생성 프롬프트는 공통으로 “vertical painterly Korean midnight snack street, handcrafted storybook gouache, wet cobblestone, amber lanterns, food-stall props, cozy indigo night, empty central path for gameplay, no text or interface”를 사용하고, 장마다 달빛 골목·비 내리는 시장·단풍 강변길·눈꽃 분식거리·도깨비 자정 축제의 날씨와 소품을 달리했습니다. 결과를 WebP 비트맵으로 저장했습니다. 투명 PNG로 만든 `sauce-projectile.png`는 붉은 떡볶이 국물 방울, `ui/combat-card.png`는 하단 레시피 선택 카드, `ui/map-node-*.png`는 지도 표식, `ui/hud-plank.png`는 전투 상단 나무 표지판입니다.

## 한국어 메뉴 반복 소스

`public/art/menu-reference.png`는 사용자 제공 6번 이미지의 픽셀을 그대로 담습니다. `scripts/make-menu-loop.py`로 만든 `public/art/menu-loop.webp`는 글자의 모양을 바꾸지 않고 주기적인 미세 카메라 움직임과 밝기 변화만 넣은 6초 무한 반복 비트맵 소스입니다. 간판과 제목, 두 메뉴 버튼 글자는 이 이미지 안에 포함됩니다. 번역이 필요한 게임 정보는 기존 앱 텍스트를 사용하고, 영어 메뉴는 기존 텍스트 없는 `background.mp4`를 사용합니다.

- 남색 밤 골목, 호박색 등불, 버건디 냄비, 크림색 종이 UI.
- 냄비 / 주먹밥 유령 / 군만두 도깨비 / 보라색 허기 정령.
- 기존 텍스트 없는 `title.webp`와 Higgsfield 영상 `background.mp4`는 영어 메뉴에서 사용합니다. 영어 제목과 버튼은 DOM으로 번역해 표시합니다.
- 전장과 지도는 승인 컨셉 이미지를 참조해 OpenAI 이미지 생성 도구로 제작했습니다. 전장은 중앙이 비어 있는 탑다운 골목, 지도는 스테이지 노드를 앱에서 얹을 수 있는 동네 조감도입니다.
- 네 캐릭터는 같은 도구로 투명 배경 2×2 아틀라스로 생성했습니다. 원본은 `assets/midnight-sprites-source.png`, 게임용 추출본은 `public/art/*.png`입니다.
- 웹/네이티브 아이콘과 스플래시는 냄비 추출본을 해당 플랫폼 크기에 배치한 것입니다.
- 음악은 골목의 빗소리와 8마디 멜로디를 바탕으로 메뉴·영업·보스 상황에 맞춰 편곡합니다. 발사, 소스 피격, 손님 처치, 보상 등 효과음은 타악·짧은 공간 잔향·종소리를 겹쳐 각 동작을 구분합니다. 오디오는 브라우저의 첫 사용자 입력 후 시작합니다.

지도와 전투 배경에는 UI 텍스트를 굽지 않고 중앙 전투 가독성과 위아래 UI 영역을 우선합니다. 한국어 메뉴만 사용자가 지정한 시안의 글자를 그대로 보존합니다. 적 행동별 고유 스프라이트는 후속 확장 항목입니다.

아이콘·스플래시 재패키징: Pillow가 설치된 Python으로 `python3 scripts/package-art.py`를 실행합니다. 게임 이미지는 재생성하지 않습니다.

## UI 일러스트 2차 작업

컨셉 이미지의 붓질과 종이·칠기 질감을 앱에서 다시 쓸 수 있도록 OpenAI 내장 이미지 생성 도구로 텍스트 없는 소재를 만들었습니다. 게임 중 달라지는 제목·설명·가격·버튼 문구는 앱의 현지화 문자열로 올립니다. 한국어 메뉴의 고정 글자만 6번 이미지의 비트맵을 그대로 사용합니다.

| 파일 | 크기 | 용도 |
| --- | --- | --- |
| `public/art/ui/lab.webp` | 941 × 1672 | 큰 냄비와 손님이 보이는 연구소 전용 배경 |
| `public/art/ui/parchment.webp` | 941 × 1672 | 투명 외곽의 빈 세로 종이 패널 |
| `public/art/ui/card.webp` | 2095 × 534 | 빈 가로 선택 카드 |
| `public/art/ui/button.webp` | 1818 × 534 | 빈 버건디 칠기 버튼 |
| `public/art/ui/map.webp` | 941 × 1672 | 밝은 골목과 가게가 보이는 스테이지 지도 배경 |
| `public/art/ui/icons/*.png` | 각 512 × 512 | 고추·꼬치·냄비뚜껑·육수·국자·레시피 책 강화 아이콘 |

생성 프롬프트의 핵심: “polished hand-painted storybook gouache Korean midnight snack stall, glossy red tteokbokki pot upper middle, friendly rice ghost and dumpling, purple hunger spirit, amber lanterns, carved dark wood, indigo night; no text, letters, numerals or interface.” 종이·카드·버튼에는 각각 “blank cream handmade parchment with subtle fibers and burgundy hand-inked border”, “empty horizontal pale parchment selection card”, “empty glossy burgundy lacquer over carved wood CTA plate”를 더했습니다. UI용 3개 소재는 투명 외곽을 유지하며 WebP로 포장했습니다.

지도 배경은 “elevated oblique winding wet cobblestone Korean night market, warm lanterns, ginkgo leaves, pot stall, river bridge, small food creatures at margins, clear street for app map markers; no text or built-in UI”로 생성했습니다.

아이콘 원본은 `assets/ui/upgrade-icons-source.png`(2열 × 3행 투명 아틀라스)에 보관하고, 게임은 `public/art/ui/icons/`의 분리한 투명 PNG를 사용합니다. 제목과 가격은 이미지에 포함하지 않고 UI에서 그립니다.
