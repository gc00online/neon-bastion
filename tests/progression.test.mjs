import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSave } from '../src/game/saveSchema.ts';
import { stageUnlocked, stageCompletion, completionStars, potLevel } from '../src/game/progression.ts';

test('legacy saves keep coins, recipes, records and settings while new progress starts empty', () => {
  const old = { gems: 47, best: 12, runs: 9, lab: { damage: 3 }, sound: false, daily: { day: '2026-09-26', best: 5, runs: 1 } };
  const migrated = parseSave(JSON.stringify(old));
  for (const [key, value] of Object.entries(old)) assert.deepEqual(migrated[key], value);
  assert.equal(migrated.xp, 0);
  assert.deepEqual(migrated.stages, {});
});
test('corrupt or invalid progress cannot break star rendering or currency arithmetic', () => {
  assert.equal(parseSave('{').gems, 0);
  assert.equal(parseSave('null').xp, 0);
  const save = parseSave(JSON.stringify({ gems: '12', xp: -30, stages: { 1: 99, 2: -1 }, lab: [], daily: null }));
  assert.equal(save.gems, 0);
  assert.equal(save.xp, 0);
  assert.deepEqual(save.stages, { 1: 3, 2: 0 });
  assert.deepEqual(save.lab, {});
});
test('clearing an alley unlocks only the next one and replay never repeats first reward', () => {
  assert.equal(stageUnlocked(1, {}), true);
  assert.equal(stageUnlocked(2, {}), false);
  const first = stageCompletion(0, 80, 100, 20);
  assert.deepEqual(first, { stars: 3, reward: 20 });
  assert.equal(stageUnlocked(2, { 1: first.stars }), true);
  assert.equal(stageUnlocked(3, { 1: first.stars }), false);
  assert.deepEqual(stageCompletion(3, 20, 100, 20), { stars: 3, reward: 0 });
  assert.deepEqual(stageCompletion(1, 90, 100, 20), { stars: 3, reward: 0 });
});
test('star thresholds and experience levels handle exact boundaries', () => {
  assert.equal(completionStars(75, 100), 3);
  assert.equal(completionStars(74, 100), 2);
  assert.equal(completionStars(35, 100), 2);
  assert.equal(completionStars(34, 100), 1);
  assert.deepEqual([0, 199, 200, 600].map(potLevel), [1, 1, 2, 4]);
});
