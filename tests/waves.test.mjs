import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';

test('chapter difficulty never moves the announced boss wave', async () => {
  globalThis.window = { innerWidth: 390, innerHeight: 844 };
  const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' });
  try {
    const { buildWave } = await server.ssrLoadModule('/src/data/enemies.ts');
    const bosses = new Set(['boss', 'queen', 'artillery']);
    const countBosses = entries => entries.filter(entry => bosses.has(entry.kind)).length;

    // Chapter two adds two difficulty waves. Only the fifth local wave may
    // introduce the boss announced by the HUD and followed by a rare card.
    assert.equal(countBosses(buildWave(7, () => 0.5, 1, 3).entries), 0);
    assert.equal(countBosses(buildWave(7, () => 0.5, 1, 5).entries), 1);
  } finally {
    await server.close();
  }
});
