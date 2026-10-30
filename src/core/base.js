// Outlaw, shared namespace, seeded RNG and small math helpers.
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

// a tiny event bus, for one part of the game to tell another that something happened
(function () { const h = {}; O.Bus = { on: (k, f) => { (h[k] = h[k] || []).push(f); }, emit: (k, d) => { for (const f of h[k] || []) { try { f(d); } catch (e) { console.error(e); } } } }; })();

// when something breaks, say so on screen rather than leave it dark: what went wrong, and a way to begin again
(function () {
  if (typeof window === 'undefined') return;
  let shown = false;
  O.showCrash = (msg) => {
    if (shown || !document.body) return; shown = true;
    const el = document.createElement('div');
    el.style.cssText = 'position:fixed;inset:0;z-index:10000;display:grid;place-items:center;background:rgba(21,17,28,.92);color:#e8dcc0;font:15px ui-monospace,monospace;padding:16px';
    el.innerHTML = '<div style="max-width:560px;display:grid;gap:12px;text-align:center"><b style="font-size:22px;color:#f0b45c">Something went wrong</b><div>Your saved life may not fit this version of the game.</div><code style="font-size:12px;opacity:.75;word-break:break-word"></code><div style="display:flex;gap:8px;justify-content:center"><button data-new style="padding:8px 14px;background:#d9893a;border:2px solid #000;cursor:pointer">Start a new life</button><button data-on style="padding:8px 14px;background:#1f1a29;color:#e8dcc0;border:2px solid #3d3349;cursor:pointer">Carry on anyway</button></div></div>';
    el.querySelector('code').textContent = String(msg || '').slice(0, 300);
    el.querySelector('[data-new]').onclick = () => { try { const k = 'outlaw.save.v1', v = localStorage.getItem(k); if (v) localStorage.setItem(k + '.broken', v); localStorage.removeItem(k); } catch (e) { /* no storage */ } location.reload(); };
    el.querySelector('[data-on]').onclick = () => { el.remove(); };
    document.body.appendChild(el);
  };
  let n = 0;
  window.addEventListener('error', (e) => { if (++n >= 1 && (!O.game || !O.game.running || n > 20)) O.showCrash(e.message); });
})();

// how many storeys a building gets: a shop or workshop where a family lives has its rooms upstairs,
// over the trade, so nobody's bed stands among the wares; better town houses sleep upstairs too.
// Estates, castles, halls of state and churches keep their own plans.
O.LIVE_OVER = new Set(['bakery', 'store', 'butcher', 'smithy', 'armourer', 'tailor', 'cobbler', 'chandler', 'cooper', 'weaver', 'carpenter', 'apothecary', 'jeweller', 'potter', 'tanner', 'moneylender', 'barber', 'saddler', 'glazier', 'fletcher', 'dyer', 'posthouse', 'laundry', 'scriptorium', 'brewery', 'tavern', 'doctor', 'wainwright', 'ropewalk', 'builder', 'agency', 'carrier']);
O.storeys = (b) => {
  if (b.estate || b.manor || b.royal || b.lordly || b.outskirts || (b.floors || 1) >= 2) return b.floors || 1;
  if (O.LIVE_OVER.has(b.type)) return 2;
  if (b.type === 'house' && (b.wealth || 0) >= 0.5 && (b.w || 0) >= 4) return 2;
  return b.floors || 1;
};
