export interface DailyRecord {
  day: string;
  best: number;
  runs: number;
}

export interface SaveData {
  gems: number;
  best: number;
  runs: number;
  lab: Record<string, number>;
  sound: boolean;
  music: boolean;
  vibrate: boolean;
  tips: Record<string, boolean>;
  daily: DailyRecord;
  xp: number;
  stages: Record<string, number>;
}

export const fresh = (): SaveData => ({
  gems: 0, best: 0, runs: 0, lab: {},
  sound: true, music: true, vibrate: true,
  tips: {},
  daily: { day: '', best: 0, runs: 0 },
  xp: 0, stages: {},
});

export function parseSave(raw: string | null): SaveData {
  try {
    const data = JSON.parse(raw ?? 'null');
    if (!data || typeof data !== 'object' || Array.isArray(data)) return fresh();
    const result = fresh();
    const count = (n: unknown) => typeof n === 'number' && Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
    for (const key of ['gems', 'best', 'runs', 'xp'] as const) result[key] = count(data[key]);
    for (const key of ['sound', 'music', 'vibrate'] as const) if (typeof data[key] === 'boolean') result[key] = data[key];
    for (const key of ['lab', 'stages'] as const) {
      if (data[key] && typeof data[key] === 'object' && !Array.isArray(data[key]))
        result[key] = Object.fromEntries(Object.entries(data[key]).map(([k, v]) => [k, key === 'stages' ? Math.min(3, count(v)) : count(v)]));
    }
    if (data.tips && typeof data.tips === 'object' && !Array.isArray(data.tips))
      result.tips = Object.fromEntries(Object.entries(data.tips).filter(([, v]) => typeof v === 'boolean')) as Record<string, boolean>;
    if (data.daily && typeof data.daily === 'object') result.daily = { day: typeof data.daily.day === 'string' ? data.daily.day : '', best: count(data.daily.best), runs: count(data.daily.runs) };
    return result;
  } catch { return fresh(); }
}
