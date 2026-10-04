// Outlaw — shared namespace, seeded RNG and small math helpers.
'use strict';
var O = (typeof window !== 'undefined' ? (window.O = window.O || {}) : {});

O.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
O.lerp = (a, b, t) => a + (b - a) * t;

// Mulberry32: tiny deterministic PRNG so every NPC/building regenerates identically from its seed.
O.RNG = function (seed) {
  let s = (seed >>> 0) || 1;
  const next = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    float: (a = 0, b = 1) => a + next() * (b - a),
    int: (a, b) => a + Math.floor(next() * (b - a + 1)),
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    chance: (p) => next() < p,
    weighted: (pairs) => { // [[item, weight], ...]
      let tot = 0; for (const p of pairs) tot += p[1];
      let r = next() * tot;
      for (const p of pairs) { if ((r -= p[1]) <= 0) return p[0]; }
      return pairs[pairs.length - 1][0];
    },
    seed: () => s,
  };
};

// String/number hash for stable sub-seeds.
O.hash = function (...parts) {
  let h = 2166136261 >>> 0;
  const str = parts.join('|');
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
};

// Integer-lattice value noise (deterministic, used for ground textures & variation).
function nh(ix, iy, seed) {
  let n = (ix * 374761393 + iy * 668265263 + seed * 1442695041) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}
O.noise2 = function (x, y, seed = 0) {
  const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const a = nh(x0, y0, seed), b = nh(x0 + 1, y0, seed), c = nh(x0, y0 + 1, seed), d = nh(x0 + 1, y0 + 1, seed);
  const top = a + (b - a) * sx, bot = c + (d - c) * sx;
  return top + (bot - top) * sy;
};
O.fbm = function (x, y, seed = 0, oct = 3) {
  let v = 0, amp = 0.5, f = 1, tot = 0;
  for (let i = 0; i < oct; i++) { v += O.noise2(x * f, y * f, seed + i * 17) * amp; tot += amp; amp *= 0.5; f *= 2; }
  return v / tot;
};
