// Seeded random numbers for Ember Court: one small generator and the two helpers
// every shuffle and AI wobble in the game goes through, so a seed replays exactly.

/** Mulberry32: a tiny deterministic generator. `seed` is any 32-bit integer. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher-Yates shuffle in place, driven by `rng`. Returns the same array. */
export function shuffleInPlace(list, rng) {
  for (let i = list.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = list[i];
    list[i] = list[j];
    list[j] = tmp;
  }
  return list;
}

/** An integer from 0 to `max - 1`, driven by `rng`. */
export function rollInt(rng, max) {
  return Math.floor(rng() * max);
}
