export const stageUnlocked = (id: number, stars: Record<string, number>) => id === 1 || (stars[String(id - 1)] ?? 0) > 0;
export const potLevel = (xp: number) => 1 + Math.floor(Math.max(0, xp) / 200);
export const completionStars = (hp: number, maxHp: number) => hp / maxHp >= 0.75 ? 3 : hp / maxHp >= 0.35 ? 2 : 1;

/** First-clear coins are one-time; replaying can improve, never lower, stars. */
export function stageCompletion(previousStars: number, hp: number, maxHp: number, firstReward: number) {
  return { stars: Math.max(previousStars, completionStars(hp, maxHp)), reward: previousStars > 0 ? 0 : firstReward };
}
