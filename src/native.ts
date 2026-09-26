import Phaser from 'phaser';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { StatusBar } from '@capacitor/status-bar';

// 앱(iOS/Android)으로 실행될 때만 동작하는 부분. 웹 브라우저에서는 아무것도 하지 않는다.
export function setupNative(game: Phaser.Game) {
  if (!Capacitor.isNativePlatform()) return;

  StatusBar.hide().catch(() => { /* 무시 */ });

  // 안드로이드 뒤로가기 버튼: 게임 중이면 일시정지, 연구소면 메인으로, 메인이면 앱 종료
  App.addListener('backButton', () => {
    const active = game.scene.getScenes(true).map(s => s.scene.key);
    if (active.includes('Game')) (game.scene.getScene('Game') as any).pause();
    else if (active.includes('Stages')) game.scene.getScene('Stages').scene.start('Menu');
    else if (active.includes('Lab')) game.scene.getScene('Lab').scene.start('Menu');
    else App.exitApp();
  });
}
