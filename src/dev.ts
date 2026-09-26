// 개발용 도구 (npm run dev 에서만 로드됨). 브라우저 콘솔에서 사용:
//   simLab(연구소레벨, 판수, 'smart')  → 봇으로 여러 판 돌려 도달 웨이브 통계
//   pump(프레임수)                      → 탭이 숨겨져 있어도 게임을 강제로 진행
import Phaser from 'phaser';
import { music } from './music';
import { sfx } from './audio';

export function installDevTools(game: Phaser.Game) {
  const w = window as any;
  w.__game = game;
  w.__music = music;
  w.__sfx = sfx;

  w.pump = (n: number) => {
    let t = performance.now();
    for (let i = 0; i < n; i++) { t += 16.7; game.step(t, 16.7); }
  };

  w.simLab = (lab: number, n: number, pick?: string, extra = '') => {
    history.replaceState(null, '', `?bot&lab=${lab}${pick ? '&pick=' + pick : ''}${extra}`);
    if (!game.scene.isActive('Game')) { game.scene.getScenes(true).forEach(s => s.scene.start('Game')); w.pump(5); }
    const sc = game.scene.getScene('Game') as any;
    w.__runs = [];
    for (let r = 0; r < n; r++) {
      sc.children.removeAll(true); sc.tweens.killAll(); sc.time.removeAllEvents(); sc.create(); sc.time.removeAllEvents();
      if (sc.wave === 0 && sc.state !== 'cards') sc.startWave();
      let steps = 0;
      while (sc.state !== 'over' && steps < 60 * 60 * 120) { sc.step(1 / 60); steps++; }
      if (sc.state !== 'over') w.__runs.push({ wave: sc.wave, timeout: true });
    }
    const waves = w.__runs.map((r: any) => r.wave).sort((a: number, b: number) => a - b);
    return {
      lab, pick, waves: waves.join(','),
      avg: +(waves.reduce((a: number, b: number) => a + b, 0) / waves.length).toFixed(1),
      gems: Math.round(w.__runs.reduce((a: number, r: any) => a + (r.gems || 0), 0) / w.__runs.length),
    };
  };

}
