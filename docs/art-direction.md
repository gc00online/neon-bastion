# 심야분식 아트 적용

사용자가 승인한 ‘심야분식 — 마지막 떡볶이를 지켜라’ 컨셉 및 배경 영상에 기반합니다.

- 남색 밤 골목, 호박색 등불, 버건디 냄비, 크림색 종이 UI.
- 냄비 / 주먹밥 유령 / 군만두 도깨비 / 보라색 허기 정령.
- 승인된 텍스트 없는 배경 시안을 `title.webp`로 적용했습니다.
- 승인된 Higgsfield 배경 영상(약 8초, 1080×1916)을 `background.mp4`로 적용했습니다. 메뉴에서 무음 반복 재생합니다. 제목과 버튼은 별도 DOM으로 한국어/영어를 표시합니다.
- 전장과 지도는 승인 컨셉 이미지를 참조해 OpenAI 이미지 생성 도구로 제작했습니다. 전장은 중앙이 비어 있는 탑다운 골목, 지도는 스테이지 노드를 앱에서 얹을 수 있는 동네 조감도입니다.
- 네 캐릭터는 같은 도구로 투명 배경 2×2 아틀라스로 생성했습니다. 원본은 `assets/midnight-sprites-source.png`, 게임용 추출본은 `public/art/*.png`입니다.
- 웹/네이티브 아이콘과 스플래시는 냄비 추출본을 해당 플랫폼 크기에 배치한 것입니다.
- 음악은 골목의 빗소리와 8마디 멜로디를 바탕으로 메뉴·영업·보스 상황에 맞춰 편곡합니다. 발사, 소스 피격, 손님 처치, 보상 등 효과음은 타악·짧은 공간 잔향·종소리를 겹쳐 각 동작을 구분합니다. 오디오는 브라우저의 첫 사용자 입력 후 시작합니다.

이미지에 UI 텍스트를 굽지 않습니다. 새로운 지역 아트도 중앙 전투 가독성과 위아래 UI 영역을 우선합니다. 현재 5개 스테이지는 같은 전장 아트를 공유하며 차이는 웨이브 수·난이도·보상입니다. 지역별 전장 변형과 적 행동별 고유 스프라이트는 후속 확장 항목입니다.

아이콘·스플래시 재패키징: Pillow가 설치된 Python으로 `python3 scripts/package-art.py`를 실행합니다. 게임 이미지는 재생성하지 않습니다.

## UI 일러스트 2차 작업

컨셉 이미지의 붓질과 종이·칠기 질감을 앱에서 다시 쓸 수 있도록 OpenAI 내장 이미지 생성 도구로 텍스트 없는 소재를 만들었습니다. 원본 컨셉의 글자는 참고하지 않았고, 모든 제목·설명·가격·버튼 문구는 앱의 현지화 문자열로 올립니다.

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
