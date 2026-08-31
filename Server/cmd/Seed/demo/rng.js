/**
 * Small seeded PRNG + generation helpers so a demo-seed run is reproducible.
 * Not cryptographic — this is fixture data.
 */

const DEFAULT_SEED = 20260830;

let state = DEFAULT_SEED >>> 0;

/** mulberry32 */
function next() {
  state |= 0;
  state = (state + 0x6d2b79f5) | 0;
  let t = Math.imul(state ^ (state >>> 15), 1 | state);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function reseed(seed = DEFAULT_SEED) {
  state = seed >>> 0;
}

/** float in [0, 1) */
export const rand = () => next();

/** integer in [min, max] inclusive */
export const int = (min, max) => Math.floor(next() * (max - min + 1)) + min;

/** true with probability p (0..1) */
export const chance = (p) => next() < p;

/** one random element */
export const pick = (arr) => arr[Math.floor(next() * arr.length)];

/** n distinct random elements (or fewer if arr is short); order shuffled */
export function pickN(arr, n) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(next() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, Math.min(n, copy.length));
}

/**
 * Weighted pick. `entries` is an array of [value, weight] tuples.
 */
export function weighted(entries) {
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = next() * total;
  for (const [value, w] of entries) {
    r -= w;
    if (r <= 0) return value;
  }
  return entries[entries.length - 1][0];
}

/** money amount rounded to 2dp, in [min, max], optionally snapped to `step` */
export function money(min, max, step = 1) {
  const raw = min + next() * (max - min);
  const snapped = Math.round(raw / step) * step;
  return Math.round(snapped * 100) / 100;
}

const DAY = 86_400_000;

/** a Date `daysAgoMax`..`daysAgoMin` days before `now` */
export function daysAgo(daysAgoMax, daysAgoMin = 0, now = Date.now()) {
  const d = daysAgoMin + next() * (daysAgoMax - daysAgoMin);
  return new Date(now - d * DAY);
}

/** a Date uniformly between two Dates */
export function between(start, end) {
  const a = start.getTime();
  const b = end.getTime();
  return new Date(a + next() * (b - a));
}

/** add days to a Date */
export const addDays = (date, days) => new Date(date.getTime() + days * DAY);

/** add whole months to a Date (calendar) */
export function addMonths(date, months) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

/** clamp a Date to not exceed `max` */
export const notAfter = (date, max) => (date.getTime() > max.getTime() ? new Date(max) : date);
