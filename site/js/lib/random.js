/** Random helpers shared by the games. */

export const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

export const randomRange = (min, max) => Math.random() * (max - min) + min;

export const pick = (list) => list[Math.floor(Math.random() * list.length)];

export const chance = (p) => Math.random() < p;

/** Fisher-Yates shuffle, returns the same (mutated) array. */
export function shuffle(list, rng = Math.random) {
  for (let i = list.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

/** Small seedable PRNG (mulberry32), handy for tests. */
export function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export const lerp = (a, b, t) => a + (b - a) * t;
