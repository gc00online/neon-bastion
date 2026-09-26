import { L } from '../i18n';

export const STAGES = [
  { id: 1, name: L('첫 불을 켠 골목', 'The First Lantern'), subtitle: L('작은 냄비의 첫 번째 밤', 'A little pot, a brand new night'), waves: 5, offset: 0, reward: 20, x: 25, y: 73 },
  { id: 2, name: L('은행나무 아래', 'Under the Ginkgo'), subtitle: L('바스락, 새로운 손님이 와요', 'New guests rustle through the leaves'), waves: 5, offset: 0, reward: 30, x: 67, y: 57 },
  { id: 3, name: L('비 오는 분식골목', 'The Rainy Alley'), subtitle: L('빗소리와 함께 깊어지는 밤', 'A warm bowl for a rainy night'), waves: 10, offset: 5, reward: 45, x: 30, y: 40 },
  { id: 4, name: L('도깨비 야시장', 'Goblin Night Market'), subtitle: L('어디서 이렇게 많이 왔을까요?', 'There is always room for one more'), waves: 10, offset: 5, reward: 60, x: 68, y: 25 },
  { id: 5, name: L('달빛 시장의 대장', 'The Midnight Feast'), subtitle: L('가장 배고픈 손님을 맞이하세요', 'Our hungriest guest awaits'), waves: 15, offset: 10, reward: 100, x: 38, y: 10 },
];
export type Stage = typeof STAGES[number];
export { stageUnlocked, potLevel, completionStars, stageCompletion } from '../game/progression';
