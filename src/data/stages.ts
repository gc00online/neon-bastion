import { L } from '../i18n';

export const CHAPTERS = [
  { id: 1, name: L('달빛 골목', 'Moonlit Alley'), tagline: L('첫 불이 켜지는 밤', 'The first lantern lights up'), mapArt: 'chapters/map-01.webp', arenaArt: 'chapters/arena-01.webp' },
  { id: 2, name: L('비 내리는 시장', 'Rainfall Market'), tagline: L('빗소리 사이로 찾아오는 손님', 'Guests arrive through the rain'), mapArt: 'chapters/map-02.webp', arenaArt: 'chapters/arena-02.webp' },
  { id: 3, name: L('단풍 강변길', 'Autumn Riverside'), tagline: L('노란 잎이 쌓인 늦은 밤', 'Golden leaves after dark'), mapArt: 'chapters/map-03.webp', arenaArt: 'chapters/arena-03.webp' },
  { id: 4, name: L('눈꽃 분식거리', 'Snow Lantern Lane'), tagline: L('눈 오는 밤엔 더 따뜻하게', 'A warmer bowl on a snowy night'), mapArt: 'chapters/map-04.webp', arenaArt: 'chapters/arena-04.webp' },
  { id: 5, name: L('도깨비 자정 축제', 'Goblin Midnight Fair'), tagline: L('마지막 영업의 불을 밝혀요', 'Keep the final night glowing'), mapArt: 'chapters/map-05.webp', arenaArt: 'chapters/arena-05.webp' },
] as const;

const NAMES = [
  [
    [L('첫 불을 켠 골목', 'The First Lantern'), L('작은 냄비의 첫 번째 밤', 'A little pot, a brand new night')],
    [L('은행나무 아래', 'Under the Ginkgo'), L('바스락, 새로운 손님이 와요', 'New guests rustle through the leaves')],
    [L('분식집 뒷골목', 'Behind the Snack Shop'), L('노란 등불 끝에서 기다려요', 'Waiting beyond the lanterns')],
    [L('한밤의 횡단길', 'Midnight Crossing'), L('골목을 가득 채운 발소리', 'Footsteps fill the lane')],
    [L('달빛 광장', 'Moonlit Square'), L('첫 골목의 마지막 한 그릇', 'The last bowl of the first alley')],
  ],
  [
    [L('빗방울 차양 아래', 'Beneath the Rain Awning'), L('따뜻한 국물 냄새가 퍼져요', 'The scent of broth travels far')],
    [L('우산을 든 손님', 'Guests with Umbrellas'), L('젖은 돌길 위의 작은 행렬', 'A little parade on wet stones')],
    [L('빗속의 포장마차', 'The Rainy Food Cart'), L('비가 세질수록 더 바빠져요', 'Busier as the rain grows')],
    [L('종이등 터널', 'Paper Lantern Tunnel'), L('저편에서 누군가 달려와요', 'Someone rushes from the other side')],
    [L('폭우의 야시장', 'Stormy Night Market'), L('비바람에도 영업은 계속돼요', 'Open even through the storm')],
  ],
  [
    [L('낙엽 계단', 'Fallen-Leaf Steps'), L('강바람이 냄비를 감싸요', 'Riverside wind circles the pot')],
    [L('황금빛 다리', 'Golden Bridge'), L('다리 위로 손님이 몰려와요', 'Guests pour across the bridge')],
    [L('갈대밭 샛길', 'Reedbed Shortcut'), L('발자국이 점점 가까워져요', 'Footsteps draw closer')],
    [L('단풍 아래 분식', 'Snack Stall Under Maples'), L('붉은 잎 사이의 따뜻한 불빛', 'Warm light among red leaves')],
    [L('강변의 마지막 주문', 'Last Order by the River'), L('가을밤의 가장 큰 손님', 'The hungriest autumn guest')],
  ],
  [
    [L('첫눈 골목', 'First Snow Alley'), L('하얀 밤에 피어나는 김', 'Steam rises into the white night')],
    [L('눈사람 가판대', 'Snowman Stall'), L('차가운 바람, 뜨거운 국물', 'Cold wind, hot broth')],
    [L('얼어붙은 광장', 'Frozen Square'), L('미끄러운 돌길을 지켜요', 'Guard the icy cobblestones')],
    [L('등불 눈보라', 'Lantern Snowstorm'), L('흔들리는 불빛을 놓치지 마요', 'Keep the lanterns alight')],
    [L('한겨울의 완판', 'Winter Sellout'), L('마지막 그릇까지 따뜻하게', 'Keep every last bowl warm')],
  ],
  [
    [L('도깨비 첫 손님', 'First Goblin Guest'), L('이상한 손님이 문을 두드려요', 'A strange guest knocks')],
    [L('보랏빛 먹자골목', 'Violet Food Alley'), L('보랏빛 불꽃이 따라와요', 'Violet flames follow along')],
    [L('뒤집힌 등불길', 'Upside-Down Lanterns'), L('길이 밤하늘로 이어져요', 'The road bends into the sky')],
    [L('자정의 긴 행렬', 'Midnight Procession'), L('가장 긴 줄을 맞이하세요', 'The longest line has arrived')],
    [L('마지막 떡볶이', 'The Last Tteokbokki'), L('심야분식의 마지막 영업', 'The final night at the stall')],
  ],
] as const;

const POSITIONS = [
  { x: 25, y: 76 },
  { x: 63, y: 62 },
  { x: 44, y: 47 },
  { x: 69, y: 32 },
  { x: 52, y: 16 },
];
const WAVES = [5, 5, 10, 10, 15];
const OFFSETS = [0, 0, 5, 5, 10];
const FIRST_REWARDS = [20, 30, 45, 60, 100];

export const STAGES = NAMES.flatMap((chapterStages, chapterIndex) => chapterStages.map(([name, subtitle], index) => ({
  id: chapterIndex * 5 + index + 1,
  chapter: chapterIndex + 1,
  chapterStage: index + 1,
  name,
  subtitle,
  waves: WAVES[index],
  offset: Math.min(10, OFFSETS[index] + chapterIndex * 2),
  reward: FIRST_REWARDS[index] + chapterIndex * 25,
  ...POSITIONS[index],
})));

export type Stage = typeof STAGES[number];
export { stageUnlocked, potLevel, completionStars, stageCompletion } from '../game/progression';
