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
  bg: 0x191822,
  grid: 0x392c29,
  cyan: 0xefc586,
  pink: 0xd37662,
  red: 0xd45f42,
  yellow: 0xf1c568,
  green: 0x91b695,
  purple: 0xb595c3,
  orange: 0xff9f1c,
  blue: 0x86b6bd,
  white: 0xf6e7ca,
  gray: 0xc1ac96,
};

export const hex = (c: number) => '#' + c.toString(16).padStart(6, '0');

// 모든 씬 공통: 카메라를 RES배 확대해서 논리 좌표 0..W, 0..H 가 화면 전체에 오도록 한다.
export function setupCamera(scene: Phaser.Scene) {
  const cam = scene.cameras.main;
  cam.setZoom(RES);
  cam.centerOn(W / 2, H / 2);
  cam.setBackgroundColor(COLOR.bg);
}
