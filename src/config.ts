import type Phaser from 'phaser';

// 논리 해상도(좌표계)는 720x1280, 실제 렌더링은 RES배로 해서 고해상도 폰에서도 선명하게 보이게 한다.
export const W = 720;
// 세로 길이는 기기 화면비에 맞춰 늘린다(요즘 폰은 16:9보다 길다). 1280 기준으로 배치한 UI는 OY 만큼 내려서 가운데 정렬.
const aspect = window.innerHeight / Math.max(1, window.innerWidth);
export const H = Math.round(Math.min(1700, Math.max(1280, W * aspect)));
export const OY = Math.round((H - 1280) / 2);
export const RES = 2;

export const CORE_X = W / 2;
export const CORE_Y = Math.round(H * 0.54);
export const CORE_R = 38;

export const FONT = '"Pretendard", "Apple SD Gothic Neo", "Noto Sans KR", "Malgun Gothic", system-ui, sans-serif';

export const COLOR = {
  bg: 0x070912,
  grid: 0x111735,
  cyan: 0x00f5ff,
  pink: 0xff2e88,
  red: 0xff4d6d,
  yellow: 0xffd166,
  green: 0x06d6a0,
  purple: 0xb388ff,
  orange: 0xff9f1c,
  blue: 0x4cc9f0,
  white: 0xe8ecf5,
  gray: 0x8a93a8,
};

export const hex = (c: number) => '#' + c.toString(16).padStart(6, '0');

// 모든 씬 공통: 카메라를 RES배 확대해서 논리 좌표 0..W, 0..H 가 화면 전체에 오도록 한다.
export function setupCamera(scene: Phaser.Scene) {
  const cam = scene.cameras.main;
  cam.setZoom(RES);
  cam.centerOn(W / 2, H / 2);
  cam.setBackgroundColor(COLOR.bg);
}
