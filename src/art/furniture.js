// Interior art: rooms (back wall, side walls, floor, the front wall with its doorway) and furniture,
// in the same material raster as everything else. Furniture is drawn to the scale of the people who
// use it: a bed is long enough to lie in, a table high enough to sit at, a door wide enough to walk
// through. Each piece stands on a floor footprint of whole tiles (16px) and rises above it in the
// 3/4 view; it is anchored at the bottom-centre of that footprint.
//
// Some pieces come in layers so people can be inside them: a bed has a `cover` (the blanket and the
// foot of the bed) drawn over the sleeper, a chair or pew facing away from us has a `back` drawn over
// whoever sits in it.
'use strict';
(function () {
  const P = O.Pal, C = P.cloth, MB = O.MatBuffer, E = O.Env;
  const T = 16;
  const cache = new Map();
  const wood = () => P.mat(P.wood.oak, 'wood'), dark = () => P.mat(P.wood.dark, 'wood'), pine = () => P.mat(P.wood.pine, 'wood'), walnut = () => P.mat(P.wood.walnut, 'wood');
  const stone = () => P.mat('#8e8880', 'cloth'), iron = () => P.mat(P.metal.darkIron, 'metal'), brass = () => P.mat(P.metal.brass, 'metal'), white = () => P.mat('#ece6d8', 'cloth');
  const GOOD_COL = { bread: '#c88a45', cabbage: '#6a9a44', flour: '#e6dcc4', wheat: '#d8b048', ale: '#8a5a30', meal: '#a0603a', logs: '#7c5a38', planks: '#b08a5a', firewood: '#8a6239', iron: '#7a7e88', tools: '#9aa0aa', medicine: '#6a9ad0', herbs: '#5a9a40', stone: '#9a948a', meat: '#a8443a', ring: '#e0c050', brooch: '#c8a040', helm: '#9aa0aa', sword: '#b8bcc4', furniture: '#8a6239' };
  const woodFor = (v) => (v >= 2 ? walnut() : v === 1 ? wood() : pine());

  // A sprite with room for a footprint of fw x fh tiles and `up` pixels of height above it.
  function canvasFor(fw, fh, up, extraW = 0) {
    const W = fw * T + 4 + extraW * 2, H = fh * T + up + 4;
    const B = new MB(W, H);
    const fx = 2 + extraW, fy = up + 2; // top-left of the footprint on the floor
    return { B, W, H, fx, fy, fx1: fx + fw * T - 1, fy1: fy + fh * T - 1 };
  }
  function finish(S, opts) { return { canvas: S.B.toCanvas(opts), ox: S.fx + (S.fx1 - S.fx + 1) / 2, oy: S.fy1, W: S.W, H: S.H }; }
  function layer(S, draw) { const L = new MB(S.W, S.H); draw(L); return L.toCanvas(); }

  // a box in 3/4 view: top face (seen from above) and front face, x0..x1 across, the top face from
  // yTop to yTop+depth, the front face below it down to yBottom
  function box(B, x0, x1, yTop, depth, yBottom, mat, opts = {}) {
    const top = opts.topMat || mat;
    for (let y = yTop; y < yTop + depth; y++) for (let x = x0; x <= x1; x++) B.plot(x, y, top, y === yTop ? 4 : x === x0 ? 3 : 3);
    for (let y = yTop + depth; y <= yBottom; y++) for (let x = x0; x <= x1; x++) B.plot(x, y, mat, y === yTop + depth ? 2 : x === x0 ? 2 : x === x1 ? 1 : 2);
    if (opts.grain) for (let y = yTop + 1; y < yTop + depth; y++) for (let x = x0 + 1; x < x1; x++) if ((x * 7 + y * 3 + (opts.grain | 0)) % 11 === 0) B.tweak(x, y, -1);
  }
  const leg = (B, x, y0, y1, m, w = 2) => { for (let y = y0; y <= y1; y++) for (let k = 0; k < w; k++) B.plot(x + k, y, m, k === 0 ? 3 : 1); };

  // ---- beds ----
  function quiltMat(v, rng) { return P.mat(v >= 2 ? rng.pick([C.crimson, C.navy, C.forest, C.plum, C.teal]) : v === 1 ? rng.pick([C.woad, C.russet, C.ochre, C.sage, C.madder]) : rng.pick([C.undyed, C.wool, C.greyWool])); }
  function quiltPattern(L, x0, x1, y0, y1, qm, v, rng) {
    const alt = P.mat(v >= 2 ? C.mustard : v === 1 ? C.linen : C.brown);
    const cell = v >= 1 ? 6 : 0;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      let m = qm, s = 2;
      if (cell && (Math.floor((x - x0) / cell) + Math.floor((y - y0) / cell)) % 2 === 0 && v === 1) m = qm, s = 3;
      if (v >= 2 && ((x - x0) === 2 || (x1 - x) === 2)) m = alt, s = 3; // a border band
      if (y === y0) s = 4; else if (y === y0 + 1) s = 3; else if (y >= y1 - 1) s = 1;
      if (x === x0 || x === x1) s = Math.max(0, s - 1);
      L.plot(x, y, m, s);
    }
    if (v === 0) for (let i = 0; i < 6; i++) L.tweak(rng.int(x0 + 1, x1 - 1), rng.int(y0 + 3, y1 - 2), -1);
    // the fold of the turned-down sheet
    const sh = white(); for (let x = x0; x <= x1; x++) { L.plot(x, y0, sh, 4); L.plot(x, y0 + 1, sh, 3); L.plot(x, y0 + 2, sh, 2); }
  }
  function bed(kind, v, seed, rot) {
    const rng = O.RNG(seed), fr = woodFor(v), qm = quiltMat(v, rng);
    if (rot === 0) { // head against the back wall
      const fw = kind === 'double' ? 3 : 2, S = canvasFor(fw, 3, 16), { B, fx, fx1, fy, fy1 } = S;
      // headboard and posts
      B.part(1); box(B, fx, fx1, fy - 14, 2, fy + 4, fr); for (let x = fx + 3; x < fx1 - 2; x += 4) for (let y = fy - 10; y < fy + 2; y++) B.tweak(x, y, -1);
      if (v >= 2) { for (let x = fx; x <= fx1; x++) B.plot(x, fy - 15 - Math.round(Math.sin(((x - fx) / (fx1 - fx)) * Math.PI) * 3), fr, 4); }
      leg(B, fx, fy - 16, fy + 6, fr, 2); leg(B, fx1 - 1, fy - 16, fy + 6, fr, 2);
      // frame and mattress
      B.part(2); box(B, fx + 1, fx1 - 1, fy + 3, 2, fy1 - 2, fr);
      B.part(3); for (let y = fy + 5; y < fy1 - 6; y++) for (let x = fx + 2; x <= fx1 - 2; x++) B.plot(x, y, white(), y === fy + 5 ? 4 : 3);
      // pillows
      const pillows = kind === 'double' ? [fx + (fx1 - fx) * 0.28, fx + (fx1 - fx) * 0.72] : [(fx + fx1) / 2];
      B.part(4); for (const px of pillows) { B.blob(px, fy + 9, kind === 'double' ? 8 : 9, 3.6, white(), { power: 3 }); B.tweak(px, fy + 11, -1); }
      const out = finish(S);
      const coverTop = fy + 18;
      out.cover = layer(S, (L) => {
        L.part(5); quiltPattern(L, fx + 1, fx1 - 1, coverTop, fy1 - 3, qm, v, rng);
        // footboard
        L.part(6); box(L, fx, fx1, fy1 - 6, 2, fy1 + 1, fr); leg(L, fx, fy1 - 8, fy1 + 1, fr, 2); leg(L, fx1 - 1, fy1 - 8, fy1 + 1, fr, 2);
      });
      out.pillows = pillows.map((px) => [px - (S.fx + (S.fx1 - S.fx + 1) / 2), fy + 9 - S.fy1]); // relative to the anchor
      out.rot = 0; out.coverTop = coverTop - S.fy1;
      return out;
    }
    // head against a side wall (rot 1 = left wall; rot 2 is the same piece mirrored by the caller)
    const S = canvasFor(3, 2, 14), { B, fx, fx1, fy, fy1 } = S;
    B.part(1); for (let y = fy - 12; y <= fy1; y++) for (let x = fx; x < fx + 3; x++) B.plot(x, y, fr, x === fx ? 3 : x === fx + 1 ? 2 : 1);
    for (let y = fy - 13; y <= fy - 11; y++) for (let x = fx - 1; x < fx + 4; x++) B.plot(x, y, fr, 4);
    B.part(2); box(B, fx + 3, fx1 - 1, fy + 2, 22, fy1, fr, { topMat: white() });
    B.part(4); B.blob(fx + 9, fy + 12, 4, 7, white(), { power: 3 }); B.tweak(fx + 10, fy + 13, -1);
    const out = finish(S);
    out.cover = layer(S, (L) => {
      L.part(5); for (let y = fy + 2; y <= fy + 25; y++) for (let x = fx + 16; x <= fx1 - 1; x++) L.plot(x, y, qm, x === fx + 16 ? 4 : y === fy + 2 ? 3 : y > fy + 22 ? 1 : 2);
      const sh = white(); for (let y = fy + 2; y <= fy + 25; y++) { L.plot(fx + 16, y, sh, 4); L.plot(fx + 17, y, sh, 3); }
      if (v >= 1) for (let y = fy + 4; y < fy + 24; y += 5) for (let x = fx + 19; x < fx1 - 1; x++) L.tweak(x, y, -1);
      L.part(6); for (let y = fy - 2; y <= fy1; y++) for (let x = fx1 - 1; x <= fx1; x++) L.plot(x, y, fr, x === fx1 ? 1 : 2);
    });
    out.pillows = [[fx + 9 - (S.fx + (S.fx1 - S.fx + 1) / 2), fy + 12 - S.fy1]];
    out.rot = 1; out.coverTop = 0;
    return out;
  }

  function furniture(kind, v = 0, seed = 1, rot = 0) {
    const key = kind + ':' + v + ':' + seed + ':' + rot;
    if (cache.has(key)) return cache.get(key);
    const rng = O.RNG(seed);
    let out, S;
    switch (kind) {
      case 'bed': out = bed('single', v, seed, rot); break;
      case 'double': out = bed('double', v, seed, rot ? 0 : 0); break;
      case 'medbed': {
        out = bed('single', 0, seed, 0); // linen-white, iron frame
        S = canvasFor(2, 3, 16); const { B, fx, fx1, fy, fy1 } = S; const fr = iron();
        B.part(1); for (let x = fx; x <= fx1; x++) { B.plot(x, fy - 12, fr, 3); B.plot(x, fy - 6, fr, 2); } leg(B, fx, fy - 13, fy + 6, fr, 1); leg(B, fx1, fy - 13, fy + 6, fr, 1);
        B.part(2); box(B, fx + 1, fx1 - 1, fy + 3, 2, fy1 - 2, fr);
        B.part(3); for (let y = fy + 5; y < fy1 - 6; y++) for (let x = fx + 2; x <= fx1 - 2; x++) B.plot(x, y, white(), 3);
        B.part(4); B.blob((fx + fx1) / 2, fy + 9, 9, 3.6, white(), { power: 3 });
        const o2 = finish(S); o2.pillows = out.pillows; o2.coverTop = out.coverTop; o2.rot = 0;
        o2.cover = layer(S, (L) => { L.part(5); for (let y = fy + 18; y <= fy1 - 3; y++) for (let x = fx + 1; x <= fx1 - 1; x++) L.plot(x, y, white(), y === fy + 18 ? 4 : y > fy1 - 5 ? 1 : 2); for (let x = fx + 1; x <= fx1 - 1; x++) L.plot(x, fy + 20, P.mat(C.sky), 3); L.part(6); for (let x = fx; x <= fx1; x++) L.plot(x, fy1 - 2, fr, 2); });
        out = o2; break;
      }
      case 'cradle': {
        S = canvasFor(2, 2, 6); const { B, fx, fx1, fy, fy1 } = S; const m = woodFor(v);
        B.part(1); box(B, fx + 3, fx1 - 3, fy + 2, 18, fy1 - 3, m, { topMat: white() });
        for (let y = fy + 4; y < fy + 19; y++) for (let x = fx + 5; x <= fx1 - 5; x++) B.plot(x, y, white(), 3);
        B.part(2); for (let x = fx + 1; x <= fx1 - 1; x++) { B.plot(x, fy1 - 1 - Math.round(Math.sin(((x - fx) / (fx1 - fx)) * Math.PI) * 2), m, 2); }
        out = finish(S); out.pillows = [[0, fy + 8 - S.fy1]]; out.coverTop = fy + 12 - S.fy1;
        out.cover = layer(S, (L) => { L.part(5); const q = quiltMat(v, rng); for (let y = fy + 12; y < fy + 19; y++) for (let x = fx + 5; x <= fx1 - 5; x++) L.plot(x, y, q, y === fy + 12 ? 4 : 2); L.part(6); for (let x = fx + 3; x <= fx1 - 3; x++) for (let y = fy + 19; y <= fy1 - 3; y++) L.plot(x, y, m, y === fy + 19 ? 3 : 1); });
        break;
      }
      case 'table': case 'longtable': {
        const fw = kind === 'longtable' ? 5 : 3; S = canvasFor(fw, 2, 14); const { B, fx, fx1, fy, fy1 } = S; const m = woodFor(v);
        const top = fy - 12, bot = fy1 - 14;
        B.part(1); leg(B, fx + 2, bot, fy1, m); leg(B, fx1 - 3, bot, fy1, m);
        B.part(2); box(B, fx, fx1, top, bot - top, bot + 3, m, { grain: seed });
        for (let x = fx; x <= fx1; x += 9) for (let y = top + 1; y < bot; y++) B.shadeAt(x, y, 2); // planks
        // the table is laid: trenchers, mugs, bread, a candle
        B.part(3);
        const n = Math.max(2, Math.floor((fx1 - fx) / 14));
        for (let i = 0; i < n; i++) { const px = fx + 7 + (i * (fx1 - fx - 14)) / Math.max(1, n - 1); B.blob(px, top + 6, 3, 1.8, P.mat(v >= 2 ? '#d8d4cc' : '#b8a888', v >= 2 ? 'metal' : 'wood'), { power: 2 }); B.blob(px + 4, top + 4, 1.2, 1.8, walnut(), { power: 3 }); }
        if (rng.chance(0.7)) B.blob((fx + fx1) / 2, top + 11, 3.4, 2, P.mat(GOOD_COL.bread, 'wood'), { power: 2 });
        if (v >= 1) { const cx = Math.round((fx + fx1) / 2) + 6; B.rect(cx, top + 6, 2, 5, P.mat('#efe6cc', 'cloth'), 3); B.plot(cx, top + 11, brass(), 3); B.plot(cx + 1, top + 11, brass(), 2); }
        out = finish(S); if (v >= 1) out.candles = [[Math.round((fx + fx1) / 2) + 6 - out.ox, top + 5 - out.oy]];
        break;
      }
      case 'chair': case 'stool': {
        // rot = which way the sitter faces: 0 toward us, 1 left, 2 right, 3 away. Four legs, a seat
        // seen from above with its front edge, and a back rising from the rear edge of the seat
        S = canvasFor(1, 1, 26); const { B, fx, fx1, fy1 } = S; const m = woodFor(v), dk = dark();
        const seatTop = fy1 - 17, seatD = 6, seatF = seatTop + seatD; // top face, then the front edge
        const velvet = v >= 2 && kind === 'chair' ? P.mat(C.crimson) : null;
        // the far legs (behind the seat) and the near legs
        B.part(1); for (const x of [fx + 2, fx1 - 3]) leg(B, x, seatF, fy1 - seatD + 1, dk, 2);
        const backPanel = (L, y0, y1, xa, xb) => { L.part(3); for (let y = y0; y <= y1; y++) for (let x = xa; x <= xb; x++) { const rail = y <= y0 + 1 || y === y0 + 6, post = x <= xa + 1 || x >= xb - 1, slat = (x - xa) % 4 === 2 && y > y0 + 6; if (rail || post) L.plot(x, y, m, y === y0 ? 4 : x === xa ? 3 : 2); else if (velvet && y > y0 + 1) L.plot(x, y, velvet, 2); else if (slat) L.plot(x, y, m, 1); } };
        if (kind === 'chair' && rot === 0) backPanel(B, seatTop - 15, seatTop + 1, fx + 1, fx1 - 1);
        B.part(2); box(B, fx + 1, fx1 - 1, seatTop, seatD, seatF + 2, m);
        if (velvet) for (let y = seatTop + 1; y < seatF - 1; y++) for (let x = fx + 2; x < fx1 - 1; x++) B.plot(x, y, velvet, (y === seatTop + 1) ? 3 : 2);
        B.part(1); for (const x of [fx + 1, fx1 - 2]) leg(B, x, seatF + 2, fy1, m, 2);
        if (kind === 'chair' && (rot === 1 || rot === 2)) {
          // seen from the side: the back is an upright along the rear edge with a top rail
          B.part(3); const right = rot === 1, x = right ? fx1 - 2 : fx + 1;
          for (let y = seatTop - 15; y <= fy1; y++) for (let k = 0; k < 2; k++) B.plot(x + k, y, y > seatF + 2 ? dk : m, k ? 1 : 3);
          for (let y = seatTop - 15; y <= seatTop - 13; y++) for (let k = -1; k < 3; k++) B.plot(x + k, y, m, y === seatTop - 15 ? 4 : 2);
          if (velvet) for (let y = seatTop - 12; y < seatTop; y++) B.plot(right ? x - 1 : x + 2, y, velvet, 2);
        }
        out = finish(S);
        if (kind === 'chair' && rot === 3) out.back = layer(S, (L) => backPanel(L, seatTop - 8, seatF + 1, fx + 1, fx1 - 1));
        out.seatY = seatTop + 3 - S.fy1;
        break;
      }
      case 'bench': {
        S = canvasFor(3, 1, 12); const { B, fx, fx1, fy1 } = S; const m = woodFor(v);
        const seatY = fy1 - 9;
        B.part(1); leg(B, fx + 2, seatY, fy1, m); leg(B, fx1 - 3, seatY, fy1, m);
        B.part(2); box(B, fx, fx1, seatY - 7, 7, seatY + 2, m, { grain: seed });
        out = finish(S); out.seatY = seatY - 4 - S.fy1; break;
      }
      case 'pew': { // worshippers face the altar (away from us): the backrest is on our side
        S = canvasFor(rot || 5, 1, 24); const { B, fx, fx1, fy1 } = S; const m = dark();
        const seatY = fy1 - 9;
        B.part(1); leg(B, fx + 1, seatY, fy1, m); leg(B, fx1 - 2, seatY, fy1, m);
        B.part(2); box(B, fx, fx1, seatY - 8, 8, seatY + 2, m, { grain: seed });
        out = finish(S); out.seatY = seatY - 4 - S.fy1;
        out.back = layer(S, (L) => { L.part(3); box(L, fx, fx1, seatY - 20, 2, seatY + 4, m); for (let x = fx + 4; x < fx1 - 2; x += 8) for (let y = seatY - 16; y < seatY + 3; y++) L.tweak(x, y, -1); L.part(4); for (const x of [fx, fx1 - 2]) for (let y = seatY - 23; y <= fy1; y++) { L.plot(x, y, m, 3); L.plot(x + 1, y, m, 1); } });
        break;
      }
      case 'fireplace': { // stone hearth against the back wall
        S = canvasFor(3, 1, 52); const { B, fx, fx1, fy, fy1 } = S; const s = stone();
        B.part(1);
        for (let y = fy - 50; y <= fy1; y++) for (let x = fx; x <= fx1; x++) { const r = (y - fy) % 6, off = Math.floor((y - fy + 60) / 6) % 2 ? 4 : 0; B.plot(x, y, s, r === 5 || (x + off) % 9 === 0 ? 0 : r === 0 ? 3 : 2); }
        B.part(2); for (let y = fy - 24; y <= fy1 - 3; y++) for (let x = fx + 7; x <= fx1 - 7; x++) { const top = y < fy - 21 && Math.abs(x - (fx + fx1) / 2) > (fx1 - fx) / 2 - 7 - (fy - 21 - y) * 2; if (!top) B.plot(x, y, P.mat('#1c1418', 'cloth'), y > fy1 - 6 ? 1 : 0); }
        B.part(3); box(B, fx - 1, fx1 + 1, fy - 30, 3, fy - 27, dark()); // mantel
        for (let i = 0; i < 4; i++) B.blob(fx + 14 + i * 5, fy1 - 4, 2.4, 1.6, P.mat('#5a3d26', 'wood'), { power: 2 });
        // a pot on its hook, and things on the mantel
        B.part(4); B.capsule((fx + fx1) / 2, fy - 22, (fx + fx1) / 2, fy - 14, 0.4, 0.4, iron()); B.blob((fx + fx1) / 2, fy - 10, 4, 3.5, iron(), { power: 2 });
        if (v) { B.blob(fx + 6, fy - 34, 1.6, 2.4, P.mat('#c8b8a0', 'cloth'), { power: 3 }); B.blob(fx1 - 7, fy - 34, 2, 2, P.mat(P.metal.copper, 'metal'), { power: 2 }); }
        if (v >= 2) { B.rect(fx + 18, fy - 38, 2, 6, P.mat('#efe6cc', 'cloth'), 3); B.rect(fx1 - 20, fy - 38, 2, 6, P.mat('#efe6cc', 'cloth'), 3); }
        B.part(5); for (let x = fx - 2; x <= fx1 + 2; x++) { B.plot(x, fy1 - 1, s, 3); B.plot(x, fy1, s, 1); } // hearthstone
        out = finish(S); out.fire = { x: (fx + fx1) / 2 - out.ox, y: fy1 - 5 - out.oy, w: 18 };
        if (v >= 2) out.candles = [[fx + 18 - out.ox, fy - 39 - out.oy], [fx1 - 20 - out.ox, fy - 39 - out.oy]];
        break;
      }
      case 'oven': { // the baker's domed oven
        S = canvasFor(3, 2, 26); const { B, fx, fx1, fy1 } = S; const s = P.mat('#b8826a', 'cloth');
        B.part(1); B.blob((fx + fx1) / 2, fy1 - 22, 23, 22, s, { power: 2.1 }); B.rect(fx + 1, fy1 - 22, fx1 - fx - 1, 22, s, 2);
        for (let y = 0; y < S.H; y++) for (let x = 0; x < S.W; x++) if (B.matAt(x, y) === s && ((y % 5 === 0) || ((x + (Math.floor(y / 5) % 2) * 3) % 7 === 0))) B.tweak(x, y, -1);
        B.part(2); B.blob((fx + fx1) / 2, fy1 - 12, 9, 8, P.mat('#1c1418', 'cloth'), { power: 2.2 }); B.rect(Math.round((fx + fx1) / 2) - 9, fy1 - 12, 18, 9, P.mat('#1c1418', 'cloth'), 0);
        B.part(3); B.capsule(fx1 - 2, fy1, fx1 + 1, fy1 - 30, 0.8, 0.8, pine()); B.blob(fx1 + 1, fy1 - 32, 2.6, 3, pine(), { power: 3 }); // the peel
        out = finish(S); out.fire = { x: (fx + fx1) / 2 - out.ox, y: fy1 - 5 - out.oy, w: 14 }; break;
      }
      case 'forge': {
        S = canvasFor(3, 2, 44); const { B, fx, fx1, fy, fy1 } = S; const s = stone();
        B.part(1); // hood up to the ceiling
        B.poly([[fx + 8, fy - 42], [fx1 - 8, fy - 42], [fx1 - 2, fy - 18], [fx + 2, fy - 18]], [0, -0.2, 0.9], s);
        for (let y = fy - 42; y < fy - 18; y++) for (let x = fx; x <= fx1; x++) if (B.matAt(x, y) === s && ((y % 5 === 0) || (x + Math.floor(y / 5) * 3) % 8 === 0)) B.tweak(x, y, -1);
        B.part(2); box(B, fx, fx1, fy - 6, 16, fy1, s, { topMat: P.mat('#2a2024', 'cloth') });
        for (let y = fy + 10; y <= fy1; y++) for (let x = fx; x <= fx1; x++) if ((y - fy) % 5 === 4 || (x + (Math.floor((y - fy) / 5) % 2) * 4) % 8 === 0) B.tweak(x, y, -1);
        B.part(3); B.blob(fx1 + 1, fy + 4, 5, 3.5, P.mat(C.leather), { power: 2 }); B.capsule(fx1 - 2, fy + 4, fx1 - 7, fy + 2, 0.7, 0.5, dark()); // bellows
        B.capsule(fx + 6, fy - 4, fx + 14, fy - 8, 0.5, 0.5, iron()); // tongs
        out = finish(S); out.fire = { x: (fx + fx1) / 2 - out.ox, y: fy + 5 - out.oy, w: 26, coals: true }; break;
      }
      case 'anvil': {
        S = canvasFor(1, 1, 14); const { B, fx, fx1, fy1 } = S; const m = iron();
        B.part(1); box(B, fx + 3, fx1 - 3, fy1 - 10, 4, fy1, P.mat('#7c5a38', 'wood')); // stump
        B.part(2); box(B, fx, fx1 - 1, fy1 - 18, 3, fy1 - 11, m); B.capsule(fx - 1, fy1 - 16, fx + 2, fy1 - 16, 1.2, 0.5, m);
        out = finish(S); break;
      }
      case 'cupboard': case 'dresser': case 'wardrobe': case 'bookcase': {
        const tall = kind === 'wardrobe' ? 46 : kind === 'bookcase' ? 44 : 40;
        S = canvasFor(2, 1, tall); const { B, fx, fx1, fy, fy1 } = S; const m = kind === 'wardrobe' && v >= 2 ? walnut() : woodFor(v);
        B.part(1); box(B, fx, fx1, fy - tall + 10, 4, fy1, m);
        const midX = Math.round((fx + fx1) / 2);
        if (kind === 'dresser' || kind === 'bookcase') {
          const rows = kind === 'bookcase' ? [fy - 26, fy - 16, fy - 6, fy + 4] : [fy - 22, fy - 13];
          for (const ry of rows) { for (let x = fx + 2; x <= fx1 - 2; x++) B.plot(x, ry, m, 1); for (let y = ry - 8; y < ry; y++) for (let x = fx + 2; x <= fx1 - 2; x++) B.plot(x, y, P.mat('#3a2818', 'wood'), 0); }
          B.part(2);
          for (const ry of rows) {
            if (kind === 'dresser') for (let i = 0; i < 4; i++) { const cx = fx + 5 + i * 6.5; B.blob(cx, ry - 4, 2.6, 3.4, P.mat(i % 2 ? '#d8d0bc' : '#b8a888', 'cloth'), { power: 2 }); B.plot(cx, ry - 4, P.mat('#8a7a5a', 'cloth'), 1); }
            else for (let x = fx + 2; x <= fx1 - 2; x += 2) { const bm = P.mat(rng.pick([C.crimson, C.navy, C.forest, C.mustard, C.brown, C.plum]), 'cloth'); const h = rng.int(5, 8); for (let y = ry - h; y < ry; y++) { B.plot(x, y, bm, 3); B.plot(x + 1, y, bm, 1); } }
          }
          if (kind === 'dresser') { B.part(3); for (let y = fy - 4; y <= fy1 - 1; y++) for (let x = fx + 1; x <= fx1 - 1; x++) B.plot(x, y, m, x === midX ? 1 : 2); B.plot(midX - 2, fy + 5, brass(), 4); B.plot(midX + 2, fy + 5, brass(), 4); }
        } else {
          B.part(2); for (let y = fy - tall + 15; y <= fy1 - 2; y++) { B.plot(midX, y, m, 0); B.plot(fx + 2, y, m, 3); }
          for (const yy of [fy - tall + 18, fy1 - 8]) for (let x = fx + 3; x < fx1 - 2; x++) if (x !== midX) B.tweak(x, yy, -1);
          B.plot(midX - 2, fy - 4, brass(), 4); B.plot(midX + 2, fy - 4, brass(), 4);
          if (v >= 2 && kind === 'wardrobe') for (let x = fx; x <= fx1; x++) B.plot(x, fy - tall + 9, P.mat(P.metal.gold, 'metal'), 3);
        }
        out = finish(S); break;
      }
      case 'chest': {
        S = canvasFor(2, 1, 8); const { B, fx, fx1, fy, fy1 } = S; const m = woodFor(v);
        B.part(1); box(B, fx + 1, fx1 - 1, fy - 2, 6, fy1, m);
        B.part(2); for (let x = fx + 1; x <= fx1 - 1; x++) { B.plot(x, fy - 4, m, 4); B.plot(x, fy - 3, m, 3); }
        for (const xx of [fx + 4, fx1 - 4]) for (let y = fy - 4; y <= fy1; y++) B.plot(xx, y, iron(), 2);
        for (let x = fx + 1; x <= fx1 - 1; x++) B.plot(x, fy + 4, iron(), 1);
        B.plot((fx + fx1) / 2, fy + 6, brass(), 4); B.plot((fx + fx1) / 2 + 1, fy + 6, brass(), 2); B.plot((fx + fx1) / 2, fy + 7, brass(), 2);
        out = finish(S); break;
      }
      case 'shelf': { // open shelving showing the goods for sale; v = fill 0..3
        S = canvasFor(3, 1, 44); const { B, fx, fx1, fy, fy1 } = S; const m = wood();
        B.part(1); for (let y = fy - 42; y <= fy1; y++) for (let x = fx; x <= fx1; x++) B.plot(x, y, P.mat('#4a3424', 'wood'), x === fx || x === fx1 ? 2 : 1);
        const rows = [fy - 28, fy - 14, fy];
        for (const sy of rows) { B.part(2); for (let x = fx; x <= fx1; x++) { B.plot(x, sy, m, 3); B.plot(x, sy + 1, m, 1); } }
        const goods = (cache.goodsFor && cache.goodsFor[seed]) || ['bread'];
        let n = 0;
        for (const sy of rows) for (let i = 0; i < 7; i++) {
          if (n++ >= v * 7) break;
          const g = goods[(i + sy) % goods.length]; const gm = P.mat(GOOD_COL[g] || '#a0a0a0', ['tools', 'iron', 'helm', 'sword', 'ring', 'brooch'].includes(g) ? 'metal' : 'cloth');
          B.part(3); const gx = fx + 4 + i * 6.3;
          if (g === 'bread') B.blob(gx, sy - 3, 2.6, 2, gm, { power: 2 });
          else if (g === 'medicine' || g === 'ale') { B.rect(Math.round(gx) - 1, sy - 7, 3, 7, gm, 2); B.plot(Math.round(gx), sy - 8, P.mat('#c8b8a0', 'cloth'), 3); }
          else if (g === 'tools' || g === 'sword') { B.capsule(gx, sy - 1, gx, sy - 10, 0.5, 0.5, P.mat(P.wood.oak, 'wood')); B.rect(Math.round(gx) - 1, sy - 11, 3, 2, gm, 3); }
          else if (g === 'ring' || g === 'brooch') { B.plot(gx, sy - 2, gm, 4); B.plot(gx + 1, sy - 2, gm, 2); }
          else B.blob(gx, sy - 3, 2.4, 2.4, gm, { power: 2.2 });
        }
        out = finish(S); break;
      }
      case 'counter': {
        S = canvasFor(4, 1, 14); const { B, fx, fx1, fy, fy1 } = S; const m = woodFor(v);
        B.part(1); box(B, fx, fx1, fy - 12, 8, fy1, m, { grain: seed });
        for (let x = fx + 6; x < fx1; x += 10) for (let y = fy - 3; y < fy1; y++) B.shadeAt(x, y, 1);
        B.part(2); B.blob(fx + 10, fy - 9, 3, 1.8, brass(), { power: 2 }); B.capsule(fx + 10, fy - 12, fx + 10, fy - 16, 0.4, 0.4, brass()); // scales
        B.blob(fx1 - 12, fy - 8, 2, 1.4, P.mat('#c8b070', 'metal'), { power: 2 }); // coin dish
        out = finish(S); break;
      }
      case 'bar': { // the tavern bar, with taps and mugs
        S = canvasFor(rot || 6, 1, 18); const { B, fx, fx1, fy, fy1 } = S; const m = dark();
        B.part(1); box(B, fx, fx1, fy - 16, 9, fy1, m, { grain: seed });
        for (let x = fx + 8; x < fx1; x += 12) for (let y = fy - 6; y < fy1; y++) B.shadeAt(x, y, 1);
        B.part(2); for (let i = 0; i * 14 + 10 < fx1 - fx; i++) { const x = fx + 10 + i * 14; B.capsule(x, fy - 13, x, fy - 19, 0.6, 0.6, brass()); B.blob(x + 5, fy - 12, 1.6, 2.2, walnut(), { power: 3 }); B.plot(x + 5, fy - 14, white(), 4); }
        out = finish(S); break;
      }
      case 'workbench': case 'doughtable': case 'butcherblock': {
        S = canvasFor(3, 1, 14); const { B, fx, fx1, fy, fy1 } = S; const m = kind === 'doughtable' ? pine() : wood();
        B.part(1); leg(B, fx + 2, fy - 2, fy1, m); leg(B, fx1 - 3, fy - 2, fy1, m); for (let x = fx + 2; x < fx1 - 2; x++) B.plot(x, fy1 - 4, m, 1);
        B.part(2); box(B, fx, fx1, fy - 12, 9, fy - 1, kind === 'butcherblock' ? P.mat('#c8a070', 'wood') : m, { grain: seed });
        B.part(3);
        if (kind === 'doughtable') { B.rect(fx + 4, fy - 11, 18, 6, P.mat('#f0e8d8', 'cloth'), 3); for (let i = 0; i < 3; i++) B.blob(fx + 8 + i * 6, fy - 9, 2.4, 1.8, P.mat('#e8d0a0', 'cloth'), { power: 2 }); B.capsule(fx1 - 12, fy - 8, fx1 - 3, fy - 8, 1, 1, pine()); }
        else if (kind === 'butcherblock') { B.blob(fx + 14, fy - 8, 5, 2.5, P.mat(GOOD_COL.meat, 'skin'), { power: 2 }); B.capsule(fx + 26, fy - 10, fx + 34, fy - 7, 0.6, 0.4, P.mat(P.metal.steel, 'metal')); }
        else { B.capsule(fx + 8, fy - 9, fx + 16, fy - 11, 0.7, 0.7, wood()); B.rect(fx + 15, fy - 12, 3, 2, iron(), 3); B.capsule(fx + 24, fy - 8, fx + 32, fy - 8, 0.6, 0.6, iron()); B.blob(fx1 - 5, fy - 9, 2.4, 1.6, P.mat(C.linen), { power: 2 }); B.rect(fx + 2, fy - 5, 4, 5, iron(), 2); }
        out = finish(S); break;
      }
      case 'partH': case 'partV': { // an inner wall, one tile of it: v 0 plaster, 1 stone, 2 panelled
        const WH = kind === 'partH' ? 40 : 60, wm = v === 1 ? P.mat('#8e8880', 'cloth') : v === 2 ? P.mat('#6e4a2c', 'wood') : P.mat('#e0d4b8', 'cloth'), cap = P.mat(v === 1 ? '#6a645c' : '#4a3a2c', 'wood');
        S = canvasFor(1, 1, WH); const { B, fx, fx1, fy, fy1 } = S;
        if (kind === 'partH') {
          // the face of the wall, seen from the room in front, and its top
          B.part(1);
          for (let y = fy1 - WH; y <= fy1; y++) for (let x = fx; x <= fx1; x++) {
            let sh = 2; const ly = y - (fy1 - WH);
            if (v === 1) { const r = ly % 7, off = Math.floor(ly / 7) % 2 ? 5 : 0; sh = r === 6 || (x + off) % 11 === 0 ? 1 : r === 0 ? 3 : 2; }
            else if (v === 2) { sh = (x - fx) % 8 === 0 ? 1 : ly % 20 === 0 ? 3 : 2; }
            if (ly > WH - 4) sh = 1;
            B.plot(x, y, wm, sh);
          }
          for (let x = fx; x <= fx1; x++) for (let y = fy1 - WH - 10; y < fy1 - WH; y++) B.plot(x, y, cap, y === fy1 - WH - 10 ? 4 : 3);
        } else {
          // a wall running away from us: we see its top, and its edge face on the way down
          B.part(1);
          const cx0 = fx + 5, cx1 = fx1 - 5;
          for (let y = fy - WH - 10; y <= fy1; y++) for (let x = cx0; x <= cx1; x++) {
            const top = y < fy1 - WH; B.plot(x, y, top ? cap : wm, top ? (x === cx0 ? 4 : 3) : x === cx0 ? 3 : x === cx1 ? 1 : 2);
          }
        }
        out = finish(S, { outline: false }); break;
      }
      case 'throne': { // a great carved chair on a dais, gilded, with a cushion
        S = canvasFor(2, 2, 34); const { B, fx, fx1, fy, fy1 } = S; const g = P.mat(P.metal.gold, 'metal'), red = P.mat('#9a2a2a', 'cloth'), st = P.mat('#8a847c', 'cloth');
        B.part(1); box(B, fx, fx1, fy + 10, 12, fy1, st, { grain: seed });
        B.part(2);
        const cx = (fx + fx1) / 2;
        B.rect(Math.round(cx - 9), fy - 26, 18, 30, walnut(), 2); for (let y = fy - 26; y < fy + 4; y++) { B.shadeAt(Math.round(cx - 9), y, 3); B.shadeAt(Math.round(cx + 8), y, 1); }
        B.rect(Math.round(cx - 7), fy - 22, 14, 22, red, 2);
        for (let x = Math.round(cx - 9); x <= Math.round(cx + 8); x++) B.plot(x, fy - 27, g, 3);
        for (const k of [-9, -3, 3, 8]) B.plot(Math.round(cx + k), fy - 29, g, 4);
        B.rect(Math.round(cx - 11), fy + 2, 22, 8, walnut(), 2); B.rect(Math.round(cx - 8), fy + 1, 16, 4, red, 3);
        for (const k of [-11, 9]) B.rect(Math.round(cx + k), fy - 6, 3, 14, walnut(), 3);
        out = finish(S); break;
      }
      case 'rack': { // tools or arms on the wall
        S = canvasFor(2, 1, 40); const { B, fx, fx1, fy, fy1 } = S; const m = dark();
        B.part(1); for (let x = fx; x <= fx1; x++) { B.plot(x, fy - 30, m, 3); B.plot(x, fy - 29, m, 1); B.plot(x, fy - 4, m, 2); B.plot(x, fy - 3, m, 1); }
        B.part(2); for (let i = 0; i < 4; i++) { const x = fx + 4 + i * 7; B.capsule(x, fy1 - 2, x, fy - 34, 0.6, 0.6, wood()); if (i % 2) B.capsule(x, fy - 34, x, fy - 40, 1.4, 0.3, P.mat(P.metal.steel, 'metal')); else B.rect(x - 2, fy - 37, 5, 3, P.mat(P.metal.steel, 'metal'), 3); }
        out = finish(S); break;
      }
      case 'desk': {
        S = canvasFor(2, 1, 14); const { B, fx, fx1, fy, fy1 } = S; const m = dark();
        B.part(1); box(B, fx, fx1, fy - 12, 7, fy1, m); for (let y = fy - 3; y < fy1; y++) B.plot(fx + 10, y, m, 0);
        B.part(2); B.rect(fx + 12, fy - 11, 9, 5, white(), 3); B.capsule(fx1 - 4, fy - 9, fx1 - 1, fy - 15, 0.4, 0.3, white()); B.blob(fx + 6, fy - 9, 1.5, 1.8, P.mat('#1a1418', 'cloth'), { power: 3 }); B.blob(fx + 4, fy - 9, 2.6, 1.6, P.mat(C.crimson), { power: 4 });
        out = finish(S); break;
      }
      case 'altar': {
        S = canvasFor(4, 1, 34); const { B, fx, fx1, fy, fy1 } = S; const s = P.mat('#c8bca8', 'cloth');
        B.part(1); box(B, fx + 1, fx1 - 1, fy - 12, 6, fy1, s);
        B.part(2); for (let y = fy - 6; y < fy1 - 2; y++) for (let x = fx + 5; x <= fx1 - 5; x++) B.plot(x, y, P.mat(C.crimson), y === fy - 6 ? 3 : 2); for (let x = fx + 5; x <= fx1 - 5; x++) B.plot(x, fy1 - 3, P.mat(P.metal.gold, 'metal'), 3);
        // the cross stands exactly on the middle line of the altar, two pixels wide, with the candles mirrored either side
        B.part(3); const g = P.mat(P.metal.gold, 'metal'), cl = Math.floor((fx + fx1) / 2);
        for (let y = fy - 34; y < fy - 12; y++) { B.plot(cl, y, g, 4); B.plot(cl + 1, y, g, 2); }
        for (let x = cl - 5; x <= cl + 6; x++) { B.plot(x, fy - 28, g, 4); B.plot(x, fy - 27, g, 2); }
        for (const x of [fx + 8, fx1 - 7]) { B.rect(x - 1, fy - 20, 2, 8, white(), 3); }
        out = finish(S); out.candles = [[fx + 7 - out.ox, fy - 21 - out.oy], [fx1 - 8 - out.ox, fy - 21 - out.oy]]; break;
      }
      case 'millstone': {
        S = canvasFor(3, 2, 14); const { B, fx, fx1, fy1 } = S; const s = stone();
        B.part(1); box(B, fx + 2, fx1 - 2, fy1 - 22, 14, fy1, wood());
        B.part(2); B.blob((fx + fx1) / 2, fy1 - 22, 18, 9, s, { power: 2 }); B.blob((fx + fx1) / 2, fy1 - 25, 15, 7, s, { power: 2 }); B.blob((fx + fx1) / 2, fy1 - 26, 3, 1.6, P.mat('#2a2024', 'cloth'), { power: 2 });
        for (let a = 0; a < 8; a++) B.tweak((fx + fx1) / 2 + Math.cos(a) * 11, fy1 - 25 + Math.sin(a) * 5, -1);
        B.capsule((fx + fx1) / 2, fy1 - 26, fx1 + 1, fy1 - 32, 0.8, 0.8, wood());
        out = finish(S); break;
      }
      case 'loom': {
        S = canvasFor(3, 2, 30); const { B, fx, fx1, fy, fy1 } = S; const m = wood();
        B.part(1); for (const x of [fx + 2, fx1 - 3]) { leg(B, x, fy - 26, fy1, m); }
        for (let x = fx + 2; x <= fx1 - 2; x++) { B.plot(x, fy - 26, m, 3); B.plot(x, fy - 8, m, 2); B.plot(x, fy1 - 8, m, 2); }
        B.part(2); const cl = P.mat(rng.pick([C.woad, C.madder, C.ochre, C.forest])); for (let y = fy - 24; y < fy - 9; y++) for (let x = fx + 5; x <= fx1 - 5; x++) B.plot(x, y, cl, (x + y) % 3 ? 2 : 3);
        for (let y = fy - 8; y < fy1 - 8; y++) for (let x = fx + 5; x <= fx1 - 5; x += 2) B.plot(x, y, white(), 3);
        out = finish(S); break;
      }
      case 'spinning': {
        S = canvasFor(2, 1, 24); const { B, fx, fx1, fy, fy1 } = S; const m = wood();
        B.part(1); box(B, fx + 2, fx1 - 4, fy - 2, 4, fy1 - 4, m); leg(B, fx + 3, fy + 2, fy1, m, 1); leg(B, fx1 - 5, fy + 2, fy1, m, 1);
        B.part(2); for (let a = 0; a < 40; a++) B.plot(fx + 18 + Math.cos(a / 40 * Math.PI * 2) * 8, fy - 12 + Math.sin(a / 40 * Math.PI * 2) * 8, m, 2);
        for (let k = 0; k < 6; k++) B.capsule(fx + 18, fy - 12, fx + 18 + Math.cos(k) * 7, fy - 12 + Math.sin(k) * 7, 0.3, 0.3, m);
        B.blob(fx + 5, fy - 8, 2, 3, P.mat('#e8e0cc', 'hair'), { power: 2 });
        out = finish(S); break;
      }
      case 'stairs': { // v 0: going up toward the back wall; v 1: the stairwell down from the upper floor
        S = canvasFor(2, 3, 30); const { B, fx, fx1, fy, fy1 } = S; const m = wood();
        if (!v) {
          B.part(1); for (let k = 0; k < 9; k++) { const y = fy1 - 4 - k * 8, rise = k * 3.5; box(B, fx + 2, fx1 - 2, Math.round(y - rise - 3), 4, Math.round(y - rise + 3), m); }
          B.part(2); for (let k = 0; k <= 9; k++) { const y = fy1 - k * 8 - k * 3.5; B.plot(fx1, y, dark(), 3); B.plot(fx1, y - 1, dark(), 2); } B.capsule(fx1, fy1, fx1, fy - 30, 0.6, 0.6, dark());
          B.capsule(fx + 1, fy1, fx + 1, fy - 30, 0.6, 0.6, dark());
        } else {
          B.part(1); for (let y = fy; y <= fy1; y++) for (let x = fx; x <= fx1; x++) B.plot(x, y, P.mat('#1a1410', 'cloth'), 0);
          for (let k = 0; k < 5; k++) { const y = fy + 4 + k * 9; box(B, fx + 3, fx1 - 3, y, 3, y + 2, m); for (let yy = y; yy < y + 6; yy++) for (let x = fx + 3; x <= fx1 - 3; x++) B.tweak(x, yy, -Math.floor(k / 2)); }
          B.part(2); for (let x = fx; x <= fx1; x++) { B.plot(x, fy - 1, dark(), 3); } for (let y = fy - 18; y <= fy1; y++) { B.plot(fx, y, dark(), 3); B.plot(fx1, y, dark(), 1); } for (let x = fx; x <= fx1; x++) B.plot(x, fy - 18, dark(), 4);
        }
        out = finish(S); break;
      }
      case 'roomdoor': { // a door set in the wall to a room beyond: oak in a stone arch; locked ones banded with iron and padlocked
        S = canvasFor(2, 1, 44); const { B, fx, fx1, fy1 } = S; const oak = P.mat('#6a4428', 'wood'), stone = P.mat('#8e8880', 'cloth'), ir = P.mat('#3a3a42', 'metal');
        const x0 = fx + 3, x1 = fx1 - 3, top = fy1 - 46, bot = fy1 - 14;
        B.part(1);
        for (let y = top - 3; y <= bot; y++) for (let x = x0 - 3; x <= x1 + 3; x++) { const ty = y - (top - 3), cx = (x0 + x1) / 2, r = (x1 - x0) / 2 + 3; if (ty < r && Math.hypot(x - cx, (top - 3 + r) - y) > r) continue; B.plot(x, y, stone, (x + y) % 4 === 0 ? 1 : 2); }
        for (let y = top; y <= bot; y++) for (let x = x0; x <= x1; x++) { const ty = y - top, cx = (x0 + x1) / 2, r = (x1 - x0) / 2; if (ty < r && Math.hypot(x - cx, top + r - y) > r) continue; B.plot(x, y, oak, (x - x0) % 4 === 0 ? 1 : x === x1 ? 1 : 2); }
        for (const yy of [top + 8, bot - 6]) for (let x = x0; x <= x1; x++) if (v === 1 || x < x0 + 6) B.plot(x, yy, ir, 2);
        B.plot(x1 - 4, Math.round((top + bot) / 2), P.mat('#c8a040', 'metal'), 3); // the ring
        if (v === 1) { for (let y = Math.round((top + bot) / 2) - 2; y <= Math.round((top + bot) / 2) + 3; y++) for (let x = x1 - 7; x <= x1 - 3; x++) B.plot(x, y, ir, y === Math.round((top + bot) / 2) - 2 ? 3 : 1); }
        for (let x = x0 - 3; x <= x1 + 3; x++) B.plot(x, bot + 1, stone, 0);
        out = finish(S); break;
      }
      case 'rug': {
        const fw = rot || 3, fh = 2; S = canvasFor(fw, fh, 0); const { B, fx, fx1, fy, fy1 } = S;
        const m = P.mat(v === 3 ? C.crimson : rng.pick([C.crimson, C.navy, C.madder, C.teal, C.plum])), t = P.mat(C.mustard); // v 3: the castle's red carpet
        B.part(1); B.rect(fx + 1, fy + 2, fx1 - fx - 1, fy1 - fy - 3, m, 2);
        for (let x = fx + 1; x < fx1; x++) { B.plot(x, fy + 3, t, 3); B.plot(x, fy1 - 3, t, 2); } for (let y = fy + 3; y < fy1 - 2; y++) { B.plot(fx + 2, y, t, 3); B.plot(fx1 - 2, y, t, 2); }
        for (let y = fy + 7; y < fy1 - 6; y += 4) for (let x = fx + 8; x < fx1 - 7; x += 6) { B.plot(x + (y % 2), y, t, 3); B.plot(x + 1 + (y % 2), y + 1, t, 2); }
        for (let x = fx + 1; x < fx1; x += 2) { B.plot(x, fy + 1, t, 2); B.plot(x, fy1 - 1, t, 2); }
        out = finish(S, { outline: false }); out.flat = true; break;
      }
      case 'cauldron': {
        S = canvasFor(1, 1, 16); const { B, fx, fx1, fy1 } = S; const m = iron();
        B.part(1); for (const x of [fx + 1, fx1 - 1]) B.capsule(x, fy1, (fx + fx1) / 2, fy1 - 22, 0.5, 0.5, m);
        B.part(2); B.blob((fx + fx1) / 2, fy1 - 8, 7, 6, m, { power: 2 }); B.blob((fx + fx1) / 2, fy1 - 13, 6.5, 2, P.mat('#7a5a3a', 'cloth'), { power: 2 });
        out = finish(S); out.fire = { x: 0, y: -1, w: 8 }; break;
      }
      case 'washtub': { S = canvasFor(1, 1, 8); const { B, fx, fx1, fy1 } = S; B.part(1); B.blob((fx + fx1) / 2, fy1 - 6, 7, 5, wood(), { power: 2.5 }); B.blob((fx + fx1) / 2, fy1 - 8, 5.5, 2.2, P.mat('#7a98b0', 'metal'), { power: 2 }); out = finish(S); break; }
      case 'plant': { S = canvasFor(1, 1, 16); const { B, fx, fx1, fy1 } = S; B.part(1); box(B, fx + 3, fx1 - 3, fy1 - 8, 3, fy1, P.mat('#b8704a', 'cloth')); B.part(2); for (let i = 0; i < 7; i++) B.blob((fx + fx1) / 2 + rng.int(-4, 4), fy1 - 12 - rng.int(0, 8), 2.4, 2, P.mat(rng.pick(['#4a7a32', '#5a8a3a', '#3f6a30']), 'cloth'), { power: 2 }); out = finish(S); break; }
      case 'candlestand': { S = canvasFor(1, 1, 30); const { B, fx, fx1, fy1 } = S; const cx = (fx + fx1) / 2; B.part(1); B.capsule(cx, fy1, cx, fy1 - 26, 0.7, 0.6, iron()); B.blob(cx, fy1 - 1, 4, 1.6, iron(), { power: 2 }); B.rect(Math.round(cx) - 1, fy1 - 32, 3, 6, P.mat('#efe6cc', 'cloth'), 3); out = finish(S); out.candles = [[0, fy1 - 33 - out.oy]]; break; }
      case 'cell': { // iron bars round a straw floor
        S = canvasFor(4, 4, 30); const { B, fx, fx1, fy, fy1 } = S; const m = iron();
        B.part(0); for (let y = fy; y <= fy1; y++) for (let x = fx; x <= fx1; x++) if (O.noise2(x * 0.8, y * 0.8, 3) > 0.45) B.plot(x, y, P.mat('#c8a050', 'hair'), O.noise2(x, y, 7) > 0.7 ? 3 : 2);
        // the back and sides of the cage go with the floor; the front bars are a layer drawn over whoever is inside
        B.part(1); for (let x = fx; x <= fx1; x += 4) for (let y = fy - 30; y <= fy; y++) B.plot(x, y, m, 1);
        for (let x = fx; x <= fx1; x++) B.plot(x, fy - 30, m, 2);
        for (let y = fy - 30; y <= fy1; y++) { B.plot(fx, y - (y > fy ? 0 : 0), m, 2); B.plot(fx1, y, m, 2); }
        out = finish(S); out.flat = true;
        out.back = layer(S, (L) => { L.part(1); for (let x = fx; x <= fx1; x += 4) for (let y = fy1 - 30; y <= fy1; y++) L.plot(x, y, m, x < (fx + fx1) / 2 ? 3 : 2); for (let x = fx; x <= fx1; x++) { L.plot(x, fy1 - 30, m, 3); L.plot(x, fy1 - 14, m, 2); } for (let y = fy - 30; y <= fy1 - 30; y++) { L.plot(fx, y, m, 2); L.plot(fx1, y, m, 2); } });
        break;
      }
      case 'vat': { // a great oak brewing vat, iron-hooped, steaming
        S = canvasFor(2, 2, 18); const { B, fx, fx1, fy1 } = S; const wd = P.mat('#8a6239', 'wood'), hoop = P.mat('#4a4a52', 'metal'), cx = (fx + fx1) / 2;
        B.part(1); B.rect(fx + 2, fy1 - 24, fx1 - fx - 4, 24, wd, 2); B.blob(cx, fy1 - 24, (fx1 - fx) / 2 - 2, 4, P.mat('#a07848', 'wood'), { power: 2 });
        for (let x = fx + 2; x < fx1 - 2; x += 4) for (let y = fy1 - 24; y < fy1; y++) B.tweak(x, y, -1);
        for (const yy of [fy1 - 20, fy1 - 8]) for (let x = fx + 2; x < fx1 - 2; x++) B.plot(x, yy, hoop, 1);
        B.part(2); B.blob(cx, fy1 - 24, (fx1 - fx) / 2 - 5, 2.4, P.mat('#c89a50', 'cloth'), { power: 2 });
        out = finish(S); break;
      }
      case 'kiln': { // a brick kiln: a beehive dome with a stoke-hole
        S = canvasFor(3, 2, 30); const { B, fx, fx1, fy1 } = S; const br = P.mat('#a85a3a', 'cloth'), cx = (fx + fx1) / 2;
        B.part(1); B.blob(cx, fy1 - 18, 22, 22, br, { power: 2 }); B.rect(fx + 2, fy1 - 18, fx1 - fx - 4, 18, br, 2);
        for (let y = 0; y < S.H; y++) for (let x = 0; x < S.W; x++) if (B.matAt(x, y) === br && (y % 4 === 0 || (x + (Math.floor(y / 4) % 2) * 3) % 6 === 0)) B.tweak(x, y, -1);
        B.part(2); B.blob(cx, fy1 - 7, 6, 5, P.mat('#1c1418', 'cloth'), { power: 2 }); B.rect(Math.round(cx) - 6, fy1 - 7, 12, 6, P.mat('#1c1418', 'cloth'), 0);
        B.blob(cx, fy1 - 36, 3, 2, P.mat('#6a3a2a', 'cloth'), { power: 2 });
        out = finish(S); out.fire = { x: cx - out.ox, y: fy1 - 4 - out.oy, w: 10 }; break;
      }
      case 'ballotbox': { // a locked oak box on a stand, with a slot in the lid
        S = canvasFor(1, 1, 10); const { B, fx, fx1, fy1 } = S; const wd = P.mat('#6a4a2c', 'wood'), cx = (fx + fx1) / 2;
        B.part(1); B.rect(cx - 2, fy1 - 8, 1, 8, wd, 1); B.rect(cx + 2, fy1 - 8, 1, 8, wd, 1);
        B.part(2); B.rect(fx + 2, fy1 - 18, fx1 - fx - 4, 10, P.mat('#8a6239', 'wood'), 2); B.rect(cx - 3, fy1 - 18, 6, 1, P.mat('#1c1418', 'cloth'), 0); B.plot(cx, fy1 - 13, P.mat('#c8a040', 'metal'), 3);
        out = finish(S); break;
      }
      case 'barrel': case 'crate': case 'sack': case 'hay': case 'woodpile': {
        const pr = E.prop(kind, seed);
        out = pr; break;
      }
      default: { S = canvasFor(1, 1, 2); out = finish(S); }
    }
    cache.set(key, out);
    return out;
  }

  // A horizontally mirrored copy of a furniture sprite (beds against the right-hand wall).
  function mirrored(sp) {
    if (sp._mir) return sp._mir;
    const flip = (c) => { if (!c) return c; const m = document.createElement('canvas'); m.width = c.width; m.height = c.height; const x = m.getContext('2d'); x.translate(c.width, 0); x.scale(-1, 1); x.drawImage(c, 0, 0); return m; };
    sp._mir = Object.assign({}, sp, { canvas: flip(sp.canvas), cover: flip(sp.cover), back: flip(sp.back), ox: sp.W - sp.ox, pillows: sp.pillows && sp.pillows.map(([x, y]) => [-x, y]), mirrored: true });
    return sp._mir;
  }

  // Room shell: back wall (with windows), side walls, floor and the front wall with its doorway.
  function room(spec) {
    const { w, d, wall, floor, wealth, seed, windows = 1, dark: isDark } = spec;
    const SW = 6, WH = 60, FW = w * T, FH = d * T, FWALL = 8;
    const B = new MB(FW + SW * 2, WH + FH + FWALL);
    const rng = O.RNG(seed);
    const wm = wall === 'stone' ? P.mat('#8e8880', 'cloth') : wall === 'log' ? P.mat('#7c5a38', 'wood') : wall === 'plank' ? P.mat('#8a6239', 'wood') : P.mat(wealth > 0.6 ? '#e4d8bc' : '#d6c8a8', 'cloth');
    B.part(1); B.rect(SW, 0, FW, WH, wm, 2);
    for (let y = 0; y < WH; y++) for (let x = SW; x < SW + FW; x++) {
      let s = 2;
      if (wall === 'stone') { const r = y % 7, off = Math.floor(y / 7) % 2 ? 5 : 0; s = r === 6 || (x + off) % 11 === 0 ? 0 : r === 0 ? 3 : 2; }
      else if (wall === 'log') { const r = y % 8; s = r === 0 ? 3 : r === 7 ? 0 : r === 6 ? 1 : 2; }
      else if (wall === 'plank') { const c = (x - SW) % 7; s = c === 0 ? 0 : c === 1 ? 3 : 2; }
      else { const n = O.fbm(x / 6, y / 6, 3, 2); s = n > 0.62 ? 3 : n < 0.32 ? 1 : 2; }
      if (y > WH - 5) s = Math.max(0, s - 1); if (y < 4) s = Math.max(0, s - 1);
      B.shadeAt(x, y, s);
    }
    if (wall === 'timber' || !wall) { const bm = P.mat(P.wood.dark, 'wood'); for (let x = SW; x < SW + FW; x += 48) for (let y = 0; y < WH; y++) { B.plot(x, y, bm, 2); B.plot(x + 1, y, bm, 1); B.plot(x + 2, y, bm, 1); } for (let x = SW; x < SW + FW; x++) { B.plot(x, 0, bm, 1); B.plot(x, 1, bm, 2); B.plot(x, 2, bm, 1); } }
    // ceiling beams' shadow line and skirting
    const sk = P.mat(P.wood.dark, 'wood'); for (let x = SW; x < SW + FW; x++) { B.plot(x, WH - 3, sk, 3); B.plot(x, WH - 2, sk, 2); B.plot(x, WH - 1, sk, 1); }
    // windows in the back wall, kept clear of tall furniture by the layout
    const winSpots = [];
    const nW = Math.min(windows, Math.max(1, Math.floor(w / 4)));
    for (let i = 0; i < nW; i++) {
      const cx = Math.round(SW + ((i + 0.5) * FW) / nW), ww = 16, wh = 22, wx = cx - ww / 2, wy = 12;
      B.part(2);
      const fm = P.mat(P.wood.dark, 'wood'), gm = P.mat(isDark ? '#1c2438' : '#a8c8e0', 'metal');
      for (let y = wy; y < wy + wh; y++) for (let x = wx; x < wx + ww; x++) {
        const edge = x === wx || y === wy || x === wx + ww - 1 || y === wy + wh - 1 || x === wx + ww / 2 || y === wy + Math.floor(wh / 2);
        const lead = !edge && ((x - wx) + (y - wy)) % 4 === 0;
        B.plot(x, y, edge ? fm : gm, edge ? 2 : lead ? 2 : (x - wx + y - wy) % 9 === 4 ? 4 : 3);
      }
      for (let x = wx - 2; x <= wx + ww + 1; x++) { B.plot(x, wy + wh, P.mat('#b8a888', 'cloth'), 3); B.plot(x, wy + wh + 1, P.mat('#b8a888', 'cloth'), 1); }
      winSpots.push({ x: wx + 1, y: wy + 1, w: ww - 2, h: wh - 2, tx0: Math.floor((wx - SW) / T), tx1: Math.floor((wx + ww - SW) / T) });
    }
    // floor
    const fmat = floor === 'stone' ? P.mat('#8a847c', 'cloth') : floor === 'dirt' ? P.mat('#8a6e4c', 'cloth') : P.mat(wealth > 0.6 ? '#7a5434' : '#9a7448', 'wood');
    B.part(3); B.rect(SW, WH, FW, FH, fmat, 2);
    for (let y = WH; y < WH + FH; y++) for (let x = SW; x < SW + FW; x++) {
      let s = 2; const ly = y - WH, lx = x - SW;
      if (floor === 'stone') { const r = ly % 10, off = Math.floor(ly / 10) % 2 ? 8 : 0; s = r === 9 || (lx + off) % 16 === 0 ? 0 : r === 0 || (lx + off) % 16 === 1 ? 3 : 2; if (O.noise2(x / 3, y / 3, 5) > 0.8) s = Math.max(1, s - 1); }
      else if (floor === 'dirt') { const n = O.fbm(x / 5, y / 5, 9, 2); s = n > 0.6 ? 3 : n < 0.35 ? 1 : 2; if (O.noise2(x * 2, y * 2, 4) > 0.9) B.plot(x, y, P.mat('#d0aa50', 'hair'), 3); }
      else { const r = ly % 6, row = Math.floor(ly / 6), seam = (lx + row * 13) % 29 === 0; s = r === 5 || seam ? 0 : r === 0 ? 3 : 2; if (O.noise2(x * 0.4, row, 7) > 0.75 && s === 2) s = 1; if (seam && r === 2) B.plot(x + 3, y, P.mat('#3a2818', 'wood'), 1); }
      if (ly < 4) s = Math.max(0, s - 1);
      B.shadeAt(x, y, s);
    }
    // fitted carpets laid over the floor (the castle's red): crimson, a gold border, a small woven diamond
    if (spec.carpets) {
      const cm = P.mat(C.crimson, 'cloth'), gm = P.mat(C.mustard, 'cloth');
      for (const c of spec.carpets) {
        const x0 = SW + c.x * T + 2, y0 = WH + c.y * T + 2, x1 = SW + (c.x + c.w) * T - 2, y1 = WH + (c.y + c.h) * T - 2;
        for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
          const ex = Math.min(x - x0, x1 - 1 - x), ey = Math.min(y - y0, y1 - 1 - y), e = Math.min(ex, ey);
          if (e === 0) { B.plot(x, y, cm, 1); continue; }
          if (e === 2 || e === 3) { B.plot(x, y, gm, e === 2 ? 3 : 2); continue; }
          const dx = (x - x0) % 12 - 6, dy = (y - y0) % 12 - 6, dia = Math.abs(dx) + Math.abs(dy);
          B.plot(x, y, dia === 3 && e > 5 ? gm : cm, dia === 3 && e > 5 ? 3 : (x + y) % 2 ? 2 : 3);
        }
      }
    }
    // side walls seen edge-on
    const wt = P.mat('#3a2e28', 'wood');
    B.part(4);
    for (let y = 0; y < WH + FH + FWALL; y++) for (let x = 0; x < SW; x++) { B.plot(x, y, wt, x === SW - 1 ? 3 : 1); B.plot(FW + SW * 2 - 1 - x, y, wt, x === SW - 1 ? 1 : 0); }
    // the front wall, cut away low, with the doorway: a threshold of daylight and the door swung open
    const doorX0 = SW + spec.doorTile * T, doorX1 = doorX0 + 2 * T;
    const hasDoor = spec.doorTile >= 0;
    for (let x = 0; x < FW + SW * 2; x++) { if (hasDoor && x >= doorX0 && x < doorX1) continue; for (let y = WH + FH; y < WH + FH + FWALL; y++) B.plot(x, y, wt, y === WH + FH ? 4 : y === WH + FH + 1 ? 3 : 1); }
    if (hasDoor) {
      B.part(5);
      const lit = P.mat('#e8d8a8', 'cloth');
      for (let y = WH + FH; y < WH + FH + FWALL; y++) for (let x = doorX0; x < doorX1; x++) B.plot(x, y, lit, y === WH + FH ? 3 : 4);
      // door posts and the open leaf against the inside wall
      const dm = P.mat('#6e4a2c', 'wood');
      for (let y = WH + FH - 6; y < WH + FH + FWALL; y++) { B.plot(doorX0 - 1, y, P.mat(P.wood.dark, 'wood'), 3); B.plot(doorX1, y, P.mat(P.wood.dark, 'wood'), 1); }
      for (let y = WH + FH - 12; y < WH + FH; y++) for (let x = doorX0 - 5; x < doorX0 - 1; x++) B.plot(x, y, dm, x === doorX0 - 5 ? 3 : 2);
      // a rush mat inside the door
      const mm = P.mat('#b89a5a', 'hair');
      for (let y = WH + FH - 12; y < WH + FH - 1; y++) for (let x = doorX0 + 3; x < doorX1 - 3; x++) B.plot(x, y, mm, (x + y) % 3 === 0 ? 1 : y === WH + FH - 12 ? 3 : 2);
    }
    void rng;
    return { canvas: B.toCanvas({ outline: false }), W: B.w, H: B.h, SW, WH, FW, FH, windows: winSpots, doorX0, doorX1 };
  }

  O.Furn = { furniture, mirrored, room, GOOD_COL, setGoods: (seed, goods) => { cache.goodsFor = cache.goodsFor || {}; cache.goodsFor[seed] = goods; } };
})();
