// Animal sprites in the same material raster: horses (4 directions, idle/walk/gallop, coats and
// markings, optional saddle and bridle) and village animals (chickens, sheep, cows, pigs, dogs,
// cats). Legs are capsules posed per frame, so gaits read clearly at small sizes.
'use strict';
(function () {
  const P = O.Pal, MB = O.MatBuffer;
  const COATS = {
    bay: { body: '#8a4a26', mane: '#2a1c18', legs: '#2a1c18' }, chestnut: { body: '#a0582c', mane: '#7a3a1c', legs: '#8a4a26' },
    black: { body: '#2e2828', mane: '#1c1818', legs: '#1c1818' }, grey: { body: '#a8a8a4', mane: '#e0ddd4', legs: '#6e6c6a' },
    dun: { body: '#b8965e', mane: '#3a2a1c', legs: '#3a2a1c' }, palomino: { body: '#d2a856', mane: '#f0e6c8', legs: '#c89a4a' },
    white: { body: '#e6e2d8', mane: '#f4f0e6', legs: '#d4cfc2' }, piebald: { body: '#2e2828', mane: '#1c1818', legs: '#e6e2d8', patches: '#e6e2d8' },
  };
  const HANIMS = { idle: { frames: 2, fps: 1.5 }, walk: { frames: 4, fps: 7 }, gallop: { frames: 4, fps: 11 } };
  const HW = 60, HH = 52, HG = 49;

  function horseFrame(h, dir, anim, f) {
    const c = COATS[h.coat] || COATS.bay;
    const body = P.mat(c.body, 'hair'), mane = P.mat(c.mane, 'hair'), legs = P.mat(c.legs, 'hair'), hoof = P.mat('#2a2420', 'cloth');
    const white = P.mat('#ece8de', 'hair'), leather = P.mat(P.cloth.darkLeather), blanket = P.mat(h.blanket || P.cloth.madder);
    const B = new MB(HW, HH);
    B.mirror = dir === 1;
    const n = HANIMS[anim]?.frames || 1, t = (f / n) * Math.PI * 2;
    const gal = anim === 'gallop', walk = anim === 'walk';
    const bob = gal ? Math.round(Math.sin(t * 2) * 1.5) : walk ? (f % 2) : 0;
    const swing = (ph) => (gal ? Math.sin(t + ph) * 0.75 : walk ? Math.sin(t + ph) * 0.4 : 0);
    if (dir === 1 || dir === 2) {
      // side view, facing right: barrel body, neck up to the head at the right
      const by = HG - 24 + bob, bx = 27;
      const leg = (x, ph, far) => {
        const sw = swing(ph), kneeX = x + Math.sin(sw) * 4, kneeY = by + 9 + Math.cos(sw) * 5;
        const fx = kneeX + Math.sin(sw * 0.6) * 3, fy = Math.min(HG - 1, kneeY + 10 - (gal && Math.cos(t + ph) > 0.4 ? 3 : 0));
        B.part(far ? 1 : 3);
        B.capsule(x, by + 2, kneeX, kneeY, 2.1, 1.5, legs, { shadeBias: far ? -1 : 0 });
        B.capsule(kneeX, kneeY, fx, fy - 1, 1.4, 1.2, (u) => (h.socks && !far && u > 0.4 ? white : legs), { shadeBias: far ? -1 : 0 });
        B.rect(Math.round(fx) - 1, Math.round(fy) - 1, 3, 2, hoof, far ? 0 : 1);
      };
      leg(bx - 10, Math.PI, true); leg(bx + 9, 0, true);
      B.part(2);
      B.blob(bx, by, 16, 8.5, body, { power: 2.3 });
      if (c.patches) for (let y = by - 6; y < by + 7; y++) for (let x = bx - 14; x < bx + 14; x++) if (B.matAt(x, y) === body && O.noise2(x / 5, y / 4, h.seed % 97) > 0.6) B.plot(x, y, P.mat(c.patches, 'hair'), 3);
      // neck and head
      const nx = bx + 13, ny = by - 4, hx = bx + 22 + (gal ? 2 : 0), hy = by - 15 + (gal ? 4 : 0) + (anim === 'idle' && f === 1 ? 1 : 0);
      B.capsule(nx, ny, hx - 3, hy + 2, 5, 3.4, body);
      B.blob(hx + 1, hy + 2, 4.6, 3.2, body, { power: 2.2 }); B.blob(hx + 4, hy + 4, 2.8, 2.2, body, { power: 2 });
      if (h.blaze) for (let y = hy; y < hy + 6; y++) B.plot(hx + 3 + (y > hy + 3 ? 1 : 0), y, white, 3);
      B.plot(hx + 1, hy + 1, P.mat('#141014', 'cloth'), 0); B.plot(hx + 6, hy + 5, P.mat('#141014', 'cloth'), 1); // eye, nostril
      B.part(4); B.plot(hx - 2, hy - 3, body, 2); B.plot(hx - 1, hy - 4, body, 3); B.plot(hx - 2, hy - 2, body, 2); // ears
      // mane along the neck, tail behind
      for (let k = 0; k < 9; k++) { const mx = nx - 3 + k * 1.1, my = ny - 5 + k * -0.9 + (k > 6 ? 2 : 0); B.plot(mx, my, mane, 2 + (k % 2)); B.plot(mx - 1, my + 1, mane, 1); }
      const tw = gal ? -2 : walk ? Math.sin(t) : 0;
      B.capsule(bx - 14, by - 3, bx - 18 + tw, by + 9 + (gal ? -5 : 0), 1.6, 2.1, mane);
      leg(bx - 9, 0, false); leg(bx + 10, Math.PI, false);
      if (h.saddled) {
        B.part(5);
        B.poly([[bx - 6, by - 8], [bx + 6, by - 8], [bx + 7, by - 3], [bx - 7, by - 3]], [0, -0.6, 0.8], blanket);
        B.blob(bx, by - 8, 5, 2, leather, { power: 2.5 }); B.capsule(bx + 1, by - 5, bx + 1, by + 6, 0.6, 0.6, leather);
        B.capsule(hx - 1, hy + 2, hx + 4, hy + 5, 0.5, 0.5, leather); B.capsule(hx + 2, hy + 4, bx + 6, by - 7, 0.4, 0.4, leather);
      }
    } else {
      // front (down) or back (up) view: chest, head, two legs either side
      const front = dir === 0, cx = HW / 2, by = HG - 22 + bob;
      const leg = (x, ph) => { const sw = swing(ph), lift = Math.max(0, Math.sin(sw)) * (gal ? 4 : 2); B.capsule(x, by + 2, x, HG - 2 - lift, 1.9, 1.4, (u) => (h.socks && u > 0.6 ? white : legs)); B.rect(Math.round(x) - 1, HG - 3 - Math.round(lift), 3, 2, hoof, 1); };
      B.part(1); leg(cx - 4, Math.PI); leg(cx + 4, 0);
      B.part(2); B.blob(cx, by - 2, 8, 10, body, { power: 2.2 });
      if (front) {
        B.part(3); B.capsule(cx, by - 10, cx, by - 18, 3.6, 3, body); B.blob(cx, by - 20, 3.6, 5, body, { power: 2.2 });
        if (h.blaze) for (let y = by - 24; y < by - 16; y++) B.plot(cx, y, white, 3);
        B.plot(cx - 3, by - 22, P.mat('#141014', 'cloth'), 0); B.plot(cx + 2, by - 22, P.mat('#141014', 'cloth'), 0);
        B.plot(cx - 3, by - 26, body, 3); B.plot(cx + 2, by - 26, body, 2);
        for (let y = by - 24; y < by - 12; y++) B.plot(cx - 1 + (y % 2), y - 1, mane, 2);
      } else {
        B.part(3); B.capsule(cx, by - 8, cx, by - 16, 3.6, 3, body); B.plot(cx - 3, by - 20, body, 3); B.plot(cx + 2, by - 20, body, 2);
        for (let y = by - 18; y < by - 6; y++) B.plot(cx, y, mane, 2);
        B.capsule(cx, by + 2, cx + (gal ? 2 : 0), by + 12, 1.6, 2, mane);
      }
      B.part(1); leg(cx - 5, 0); leg(cx + 5, Math.PI);
      if (h.saddled) { B.part(5); B.rect(cx - 7, by - 6, 14, 5, blanket, 2); B.blob(cx, by - 7, 5, 2, leather, { power: 2.5 }); }
    }
    const cv = B.toCanvas(); cv.ox = HW / 2; cv.gy = HG; return cv;
  }

  const SMALL = { chicken: { frames: 2 }, sheep: { frames: 2 }, cow: { frames: 2 }, pig: { frames: 2 }, dog: { frames: 2 }, cat: { frames: 2 } };
  function smallFrame(kind, seed, dir, moving, f) {
    const r = O.RNG(seed);
    const W = kind === 'cow' ? 40 : kind === 'chicken' ? 14 : 28, H = kind === 'cow' ? 32 : kind === 'chicken' ? 16 : 24;
    const B = new MB(W, H); B.mirror = dir === 1;
    const g = H - 2, step = moving ? (f % 2 ? 1 : -1) : 0;
    const side = dir === 1 || dir === 2;
    const coat = {
      chicken: P.mat(r.pick(['#e8e2d4', '#8a5a34', '#2e2828', '#c8a060']), 'hair'), sheep: P.mat('#e6e0d0', 'hair'), cow: P.mat(r.pick(['#8a5a34', '#2e2828', '#c8a882']), 'hair'),
      pig: P.mat('#e0a49a', 'skin'), dog: P.mat(r.pick(['#8a6a44', '#2e2828', '#c8a060', '#e6e0d0']), 'hair'), cat: P.mat(r.pick(['#e08a3a', '#2e2828', '#8a8a86', '#e6e0d0']), 'hair'),
    }[kind];
    const dark = P.mat('#2a2024', 'cloth');
    const legsAt = (xs, len, rr, m) => xs.forEach((x, i) => B.capsule(x + (i % 2 ? step : -step) * 0.6, g - len, x + (i % 2 ? step : -step), g - 1, rr, rr, m));
    B.part(1);
    if (kind === 'chicken') {
      legsAt([6, 8], 3, 0.5, P.mat('#d8a040', 'cloth'));
      B.part(2); B.blob(7, 8, 4.2, 3.6, coat, { power: 2 }); B.blob(side ? 10 : 7, 5, 2.2, 2.2, coat, { power: 2 });
      B.plot(side ? 12 : 7, 5, P.mat('#e0b040', 'cloth'), 3); B.plot(side ? 10 : 6, 2, P.mat('#c83a2a', 'cloth'), 3); B.plot(side ? 10 : 6, 4, dark, 0);
      if (side) B.plot(3, 6, coat, 1);
    } else if (kind === 'cow' || kind === 'sheep' || kind === 'pig') {
      const bw = kind === 'cow' ? 13 : kind === 'sheep' ? 9 : 8, bh = kind === 'cow' ? 7 : 5.5;
      const cx = W / 2 - (side ? 2 : 0), cy = g - (kind === 'cow' ? 12 : 8);
      const lm = kind === 'sheep' ? P.mat('#3a3030', 'cloth') : kind === 'pig' ? coat : coat;
      if (side) legsAt([cx - bw + 3, cx - bw + 5, cx + bw - 5, cx + bw - 3], kind === 'cow' ? 9 : 6, kind === 'cow' ? 1.4 : 1, lm);
      else legsAt([cx - 3, cx + 3], kind === 'cow' ? 9 : 6, 1.3, lm);
      B.part(2); B.blob(cx, cy, side ? bw : bw * 0.6, bh, coat, { power: 2.2 });
      if (kind === 'sheep') for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (B.matAt(x, y) === coat && (x * 3 + y * 5) % 7 === 0) B.tweak(x, y, -1);
      if (kind === 'cow' && r.chance(0.6)) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (B.matAt(x, y) === coat && O.noise2(x / 4, y / 4, seed % 50) > 0.62) B.plot(x, y, P.mat('#ece8de', 'hair'), 3);
      const hx = side ? cx + bw + 1 : cx, hy = cy - (kind === 'pig' ? 0 : 3);
      B.part(3); B.blob(hx, hy, kind === 'cow' ? 4 : 3, kind === 'cow' ? 3.6 : 3, kind === 'sheep' ? P.mat('#3a3030', 'cloth') : coat, { power: 2 });
      if (dir !== 3) B.plot(hx + (side ? 1 : -2), hy - 1, dark, 0);
      if (kind === 'pig' && side) B.plot(hx + 3, hy + 1, P.mat('#c8807a', 'skin'), 2);
      if (kind === 'cow') { B.plot(hx - 2, hy - 4, P.mat('#e8e0c8', 'cloth'), 3); B.plot(hx + 2, hy - 4, P.mat('#e8e0c8', 'cloth'), 3); }
    } else { // dog, cat
      const cx = W / 2, cy = g - 6;
      if (side) legsAt([cx - 6, cx - 4, cx + 4, cx + 6], 5, 0.9, coat); else legsAt([cx - 2, cx + 2], 5, 1, coat);
      B.part(2); B.blob(cx, cy, side ? 7.5 : 4, 3.4, coat, { power: 2.2 });
      const hx = side ? cx + 8 : cx, hy = cy - 4;
      B.part(3); B.blob(hx, hy, 3, 2.8, coat, { power: 2 });
      if (kind === 'dog' && side) B.capsule(hx + 2, hy + 1, hx + 4, hy + 1, 1, 0.8, coat);
      B.plot(hx - 2, hy - 3, coat, 3); B.plot(hx + 1, hy - 3, coat, 2);
      if (dir !== 3) B.plot(hx + (side ? 1 : -1), hy - 1, dark, 0);
      B.capsule(side ? cx - 7 : cx, cy - 1, side ? cx - 10 : cx + 1, cy - (kind === 'cat' ? 7 : 4) + (moving ? step : 0), 0.8, 0.7, coat);
    }
    const cv = B.toCanvas(); cv.ox = Math.floor(W / 2); cv.gy = g; return cv;
  }

  const cache = new Map();
  function horse(h, dir, anim, f) {
    const key = 'h' + h.id + ':' + (h.saddled ? 1 : 0) + ':' + dir + anim + f;
    let c = cache.get(key); if (!c) { c = horseFrame(h, dir, anim, f); cache.set(key, c); if (cache.size > 3000) cache.delete(cache.keys().next().value); }
    return c;
  }
  function animal(kind, seed, dir, moving, f) {
    const key = kind + seed + ':' + dir + (moving ? 1 : 0) + f;
    let c = cache.get(key); if (!c) { c = smallFrame(kind, seed, dir, moving, f); cache.set(key, c); }
    return c;
  }
  O.Animals = { horse, animal, COATS, HANIMS, HW, HH, HG };
})();
