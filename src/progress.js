export const SAVE_KEY = 'pixel-fishing-v1';

export function loadProgress(fishTypes, storage) {
  const empty = { score: 0, caught: Object.fromEntries(fishTypes.map(type => [type.name, 0])), bestCatch: null };
  try {
    const saved = JSON.parse((storage ?? globalThis.localStorage).getItem(SAVE_KEY));
    if (!saved || !Number.isSafeInteger(saved.score) || saved.score < 0 || !saved.caught) return empty;
    const caught = {};
    let expectedScore = 0, bestCatch = null;
    for (const type of fishTypes) {
      const count = saved.caught[type.name];
      if (!Number.isSafeInteger(count) || count < 0) return empty;
      caught[type.name] = count;
      expectedScore += count * type.points;
      if (count > 0 && (!bestCatch || type.points > bestCatch.points)) bestCatch = { name: type.name, points: type.points };
    }
    if (expectedScore !== saved.score) return empty;
    return { score: saved.score, caught, bestCatch };
  } catch { return empty; }
}

export function saveProgress(progress, storage) {
  try {
    (storage ?? globalThis.localStorage).setItem(SAVE_KEY, JSON.stringify(progress));
    return true;
  } catch { return false; }
}
