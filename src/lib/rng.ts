// Deterministic, seedable RNG so every batch run produces identical, reproducible
// metrics. We hash a string key (seed + caseId + attempt + action) into a 32-bit
// state, then draw from mulberry32. Keying by string means results are independent
// of evaluation order — critical for a trustworthy, replayable audit trail.

function xmur3(str: string): () => number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function () {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}

function mulberry32(a: number): () => number {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A fresh RNG function seeded by an arbitrary string key. */
export function makeRng(seedKey: string): () => number {
  const seed = xmur3(seedKey);
  return mulberry32(seed());
}

/** A single deterministic draw in [0, 1) from a string key. */
export function rand01(seedKey: string): number {
  return makeRng(seedKey)();
}

/** Deterministic integer in [min, max] from a string key. */
export function randInt(seedKey: string, min: number, max: number): number {
  return min + Math.floor(rand01(seedKey) * (max - min + 1));
}

/** Deterministic pick from a weighted list. */
export function weightedPick<T>(
  seedKey: string,
  items: { value: T; weight: number }[],
): T {
  const total = items.reduce((s, i) => s + i.weight, 0);
  let r = rand01(seedKey) * total;
  for (const item of items) {
    r -= item.weight;
    if (r <= 0) return item.value;
  }
  return items[items.length - 1].value;
}
