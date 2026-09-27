// 개발용 도구 (npm run dev 에서만 로드됨). 브라우저 콘솔에서 사용:
//   simLab(연구소레벨, 판수, 'smart')  → 봇으로 여러 판 돌려 도달 웨이브 통계
//   pump(프레임수)                      → 탭이 숨겨져 있어도 게임을 강제로 진행
import Phaser from 'phaser';
import { music } from './music';
import { sfx } from './audio';
import * as art from './art';
import { L, lang } from './i18n';

export function installDevTools(game: Phaser.Game) {
  const w = window as any;
  w.__game = game;
  w.__music = music;
  w.__sfx = sfx;
  w.art = art;

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

  // 스토어 스크린샷 5장 자동 생성 (뷰포트를 440x956 으로 맞춘 뒤 실행)
  // 예) await makeStoreShots()  → store/ios(-en)/, store/google(-en)/
  w.makeStoreShots = async () => {
    const sfx2 = lang === 'ko' ? '' : '-en';
    const shot = async (name: string, cap: string, accent: string) => {
      const img = await art.snapshot(game);
      await art.saveCanvas(art.compose(img, cap, 1320, 2868, accent), `store/ios${sfx2}/${name}.png`);
      await art.saveCanvas(art.compose(img, cap, 1080, 1920, accent), `store/google${sfx2}/${name}.png`);
    };
    const start = (key: string) => { game.scene.getScenes(true).forEach(sc => sc.scene.start(key)); w.pump(5); return game.scene.getScene(key) as any; };
    const clear = (sc: any) => { for (const e of sc.enemies) { e.dead = true; sc.free(e.s); } sc.enemies.length = 0; sc.queue = []; };
    await document.fonts.ready;

    // 5. 메뉴
    start('Menu'); w.pump(150);
    await shot('5-menu', L('광고 없이\n오직 게임만', 'No ads.\nJust the game.'), '#ff2e88');

    // 1. 전투
    let sc = start('Game');
    sc.time.removeAllEvents(); sc.closeOverlay();
    Object.assign(sc.stats.lv, { blades: 3, frost: 2, chain: 3, missiles: 2, splash: 2 });
    Object.assign(sc.stats, { multishot: 4, dmgPct: 3.5, ratePct: 1.2, maxHp: 420, critChance: 0.25 }); sc.hp = 388; sc.onStatsChanged();
    sc.wave = 13; sc.startWave(); w.pump(60 * 5);
    const kinds = ['grunt', 'runner', 'brute', 'swarm', 'shooter', 'splitter', 'healer', 'grunt', 'runner', 'swarm'];
    for (let i = 0; i < 28; i++) { const a = Math.random() * Math.PI * 2, r = 280 + Math.random() * 320; sc.spawnEnemy(kinds[i % kinds.length], 360 + Math.cos(a) * r * 0.95, sc.core.y + Math.sin(a) * r); }
    w.pump(50);
    await shot('1-combat', L('쏟아지는 적을\n막아라!', 'Hold the line\nagainst the swarm!'), '#00f5ff');

    // 2. 카드 선택
    const rar = () => sc.overlay.list.filter((o: any) => o.type === 'Container').map((c: any) => c.list.find((x: any) => x.type === 'Text' && x.style.color === '#ffd166' || x.type === 'Text' && x.style.color === '#b388ff' || x.type === 'Text' && x.style.color === '#4cc9f0')?.style.color);
    sc.mod = { rarityBoost: 12 };
    for (let i = 0; i < 300; i++) {
      sc.closeOverlay();
      sc.showCards(undefined, L('웨이브 14 클리어!', 'Wave 14 cleared!'), L('업그레이드를 하나 고르세요', 'Choose an upgrade'));
      const r = rar();
      if (r[0] === '#4cc9f0' && r.includes('#b388ff') && r.includes('#ffd166')) break;
    }
    sc.mod = null; w.pump(90);
    await shot('2-cards', L('매 판 달라지는\n나만의 빌드', 'A new build\nevery run'), '#b388ff');

    // 3. 보스
    sc = start('Game');
    sc.time.removeAllEvents(); sc.closeOverlay();
    Object.assign(sc.stats.lv, { blades: 2, chain: 2, splash: 2, frost: 1 });
    Object.assign(sc.stats, { multishot: 3, dmgPct: 0.5, ratePct: 1.0, maxHp: 260, critChance: 0.2 }); sc.hp = 231; sc.onStatsChanged();
    sc.wave = 9; sc.startWave(); sc.queue = [];
    const b = sc.spawnEnemy('queen', 360, sc.core.y - 480); b.maxHp *= 4; b.hp = b.maxHp * 0.64; b.speed = 0;
    w.pump(320); // 보스 등장 배너가 사라질 때까지
    b.y = sc.core.y - 340; b.x = 360;
    for (let i = 0; i < 14; i++) { const a = Math.random() * Math.PI * 2, r = 300 + Math.random() * 120; sc.spawnEnemy(['swarm', 'grunt', 'runner', 'brute'][i % 4], 360 + Math.cos(a) * r * 0.9, sc.core.y + Math.sin(a) * r); }
    sc.summon(b); sc.summon(b); w.pump(22);
    await shot('3-boss', L('5웨이브마다\n강력한 보스 등장', 'A mighty boss\nevery 5 waves'), '#b5ff3b');
    clear(sc);

    // 4. 연구소
    start('Lab'); w.pump(40);
    await shot('4-lab', L('보석을 모아\n영구 강화', 'Collect gems,\nupgrade forever'), '#b388ff');
    start('Menu');
    return 'done';
  };
}
