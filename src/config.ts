import type Phaser from 'phaser';

// 논리 해상도(좌표계)는 720x1280, 실제 렌더링은 RES배로 해서 고해상도 폰에서도 선명하게 보이게 한다.
export const W = 720;
// 세로 길이는 기기 화면비에 맞춰 늘린다(요즘 폰은 16:9보다 길다). 1280 기준으로 배치한 UI는 OY 만큼 내려서 가운데 정렬.
const aspect = window.innerHeight / Math.max(1, window.innerWidth);
export const H = Math.round(Math.min(1700, Math.max(1280, W * aspect)));
export const OY = Math.round((H - 1280) / 2);
export const RES = 2;

// 디자인 시안은 390pt 폭 기준. 시안 수치(pt) → 게임 좌표(px) 변환.
export const S = W / 390;
export const px = (n: number) => Math.round(n * S);

export const CORE_X = W / 2;
export const CORE_Y = Math.round(H * 0.54);
export const CORE_R = 38;

// 숫자·영문 라벨은 Chakra Petch, 한글 본문은 IBM Plex Sans KR (public/fonts 에 동봉, 오프라인 동작)
export const FONT_NUM = '"Chakra Petch", "IBM Plex Sans KR", "Apple SD Gothic Neo", system-ui, sans-serif';
export const FONT_KR = '"IBM Plex Sans KR", "Apple SD Gothic Neo", "Noto Sans KR", "Malgun Gothic", system-ui, sans-serif';
export const FONT = FONT_KR;

// 택티컬 홀로그램 디자인 시스템 v2 — 색 하나에 의미 하나
export const COLOR = {
  // 표면
  bg: 0x04070b,
  surf1: 0x0a1118,
  surf2: 0x0f1922,
  line: 0x1a2c38,
  lineP: 0x2a4a5c,
  grid: 0x3be3ff, // 배경 격자(투명도 0.035 로 사용)
  // 글자
  text: 0xe6f7fc,
  body: 0xb7cdd6,
  dim: 0x6e8896,
  mute: 0x4a5f6a,
  onPrimary: 0x03141a,
  // 신호
  cyan: 0x3be3ff,   // 아군 · 조작 · 선택
  amber: 0xffb224,  // 주의 · 치명타 · 일일 작전
  red: 0xff4d5e,    // 적 · 피해 · 위험 · 보스
  green: 0x3dff9a,  // 회복 · 증가 · 구매 가능
  frost: 0x7fdbff,  // 냉기 전용
  // 등급 / 능력
  rare: 0x5b9bff,
  epic: 0xb18cff,
  legend: 0xffd36b,
  // 보스 분위기
  bossBg: 0x06050a,
  bossPanel: 0x120609,
  bossText: 0xffd0d5,
  bossText2: 0xff8a95,
  // 이전 코드 호환용 별칭
  pink: 0xff4d5e,
  yellow: 0xffb224,
  purple: 0xb18cff,
  blue: 0x5b9bff,
  orange: 0xb18cff,
  white: 0xe6f7fc,
  gray: 0x6e8896,
};

export const hex = (c: number) => '#' + c.toString(16).padStart(6, '0');

// 모든 씬 공통: 카메라를 RES배 확대해서 논리 좌표 0..W, 0..H 가 화면 전체에 오도록 한다.
export function setupCamera(scene: Phaser.Scene) {
  const cam = scene.cameras.main;
  cam.setZoom(RES);
  cam.centerOn(W / 2, H / 2);
  cam.setBackgroundColor(COLOR.bg);
}
