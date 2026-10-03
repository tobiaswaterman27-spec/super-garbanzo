// Interior art: rooms (back wall, side walls, floors) and furniture, in the same material raster.
// Furniture is anchored at the bottom-centre of its footprint like world props.
'use strict';
(function () {
  const P = O.Pal, C = P.cloth, MB = O.MatBuffer, E = O.Env;
  const cache = new Map();
  const wood = () => P.mat(P.wood.oak, 'wood'), dark = () => P.mat(P.wood.dark, 'wood'), pine = () => P.mat(P.wood.pine, 'wood');
  const stone = () => P.mat('#8e8880', 'cloth'), iron = () => P.mat(P.metal.darkIron, 'metal');
  const GOOD_COL = { bread: '#c88a45', cabbage: '#6a9a44', flour: '#e6dcc4', wheat: '#d8b048', ale: '#8a5a30', meal: '#a0603a', logs: '#7c5a38', firewood: '#8a6239', iron: '#7a7e88', tools: '#9aa0aa', medicine: '#6a9ad0', herbs: '#5a9a40' };

  function finish(B, ox, oy, opts) { return { canvas: B.toCanvas(opts), ox, oy, W: B.w, H: B.h }; }

  function furniture(kind, v = 0, seed = 1) {
    const key = kind + ':' + v + ':' + seed;
    if (cache.has(key)) return cache.get(key);
    const rng = O.RNG(seed);
    let out;
    switch (kind) {
      case 'bed': { // 16 x 28 footprint, head against the wall (top)
        const B = new MB(18, 30); const fr = v >= 2 ? dark() : wood();
        const blanket = P.mat(v >= 2 ? rng.pick([C.crimson, C.navy, C.forest, C.plum]) : v === 1 ? rng.pick([C.woad, C.russet, C.ochre, C.sage]) : C.undyed);
        B.part(1); B.rect(1, 1, 16, 7, fr, 2); for (let x = 1; x < 17; x++) { B.shadeAt(x, 1, 3); B.shadeAt(x, 7, 1); } // headboard
        B.part(2); B.rect(2, 8, 14, 20, fr, 1);
        B.part(3); B.blob(9, 10, 5.5, 2.2, P.mat(C.white), { power: 2.5 }); // pillow
        B.part(4); B.poly([[2, 13], [16, 13], [16, 27], [2, 27]], (px, py) => [(px - 9) / 9, 0.1, 0.9], blanket);
        for (let x = 2; x < 16; x++) B.shadeAt(x, 13, 3);
        for (let y = 15; y < 27; y += 4) for (let x = 3; x < 16; x++) if ((x + y) % 7 === 0) B.tweak(x, y, -1);
        if (v === 0) for (let i = 0; i < 4; i++) B.tweak(rng.int(3, 15), rng.int(15, 26), -1); // worn patches
        B.part(5); B.rect(1, 27, 16, 2, fr, 1);
        out = finish(B, 9, 29); break;
      }
      case 'table': {
        const B = new MB(30, 20); const m = v >= 2 ? dark() : wood();
        B.part(1); B.capsule(4, 19, 4, 10, 1, 1, m); B.capsule(26, 19, 26, 10, 1, 1, m);
        B.part(2); B.rect(1, 3, 28, 8, m, 3); for (let x = 1; x < 29; x++) { B.shadeAt(x, 3, 4); B.shadeAt(x, 10, 1); } for (let x = 1; x < 29; x += 7) for (let y = 4; y < 10; y++) B.shadeAt(x, y, 2);
        B.part(3); // things on the table
        if (v !== 9) { B.blob(9, 6, 2.4, 1.5, P.mat('#c8b89a', 'cloth'), { power: 2 }); B.blob(20, 6, 1.4, 1.8, P.mat(P.wood.walnut, 'wood'), { power: 3 }); if (rng.chance(0.6)) B.blob(15, 5, 2.4, 1.4, P.mat(GOOD_COL.bread, 'wood'), { power: 2 }); }
        out = finish(B, 15, 19); break;
      }
      case 'chair': case 'stool': {
        const B = new MB(10, 16); const m = wood();
        B.part(1); B.capsule(2, 15, 2, 9, 0.8, 0.8, m); B.capsule(8, 15, 8, 9, 0.8, 0.8, m);
        B.part(2); B.rect(1, 7, 8, 3, m, 3); for (let x = 1; x < 9; x++) B.shadeAt(x, 9, 1);
        if (kind === 'chair') { B.part(0); B.rect(1, 1, 8, 6, m, 2); for (let x = 1; x < 9; x++) B.shadeAt(x, 1, 3); for (let y = 2; y < 6; y++) B.shadeAt(4, y, 1); }
        out = finish(B, 5, 15); break;
      }
      case 'fireplace': { // against the back wall: 24 wide
        const B = new MB(28, 34); const s = stone();
        B.part(1); B.rect(1, 1, 26, 32, s, 2);
        for (let y = 1; y < 33; y++) for (let x = 1; x < 27; x++) { const r = (y - 1) % 5, off = Math.floor((y - 1) / 5) % 2 ? 3 : 0; if (r === 4 || (x + off) % 7 === 0) B.shadeAt(x, y, 0); else if (r === 0) B.shadeAt(x, y, 3); }
        B.part(2); B.rect(5, 14, 18, 19, P.mat('#1c1418', 'cloth'), 0); // firebox
        B.rect(0, 10, 28, 3, dark(), 3); for (let x = 0; x < 28; x++) B.shadeAt(x, 12, 1); // mantel
        B.part(3); for (let i = 0; i < 4; i++) B.blob(9 + i * 3.5, 30, 1.8, 1.2, P.mat('#5a3d26', 'wood'), { power: 2 }); // logs
        if (v) { B.part(4); B.blob(8, 8, 1.4, 1.8, P.mat('#c8b8a0', 'cloth'), { power: 3 }); B.blob(20, 8, 1.6, 1.6, P.mat(P.metal.copper, 'metal'), { power: 2 }); }
        out = finish(B, 14, 33); out.fire = { x: 14, y: 26, w: 14 }; break;
      }
      case 'oven': { // baker's dome oven
        const B = new MB(30, 32); const s = P.mat('#b8826a', 'cloth');
        B.part(1); B.blob(15, 16, 13, 14, s, { power: 2.1 }); B.rect(2, 16, 26, 15, s, 2);
        for (let y = 2; y < 31; y++) for (let x = 2; x < 29; x++) if (B.matAt(x, y) === s && ((y % 4 === 0) || ((x + (Math.floor(y / 4) % 2) * 2) % 5 === 0))) B.tweak(x, y, -1);
        B.part(2); B.blob(15, 22, 6, 5, P.mat('#1c1418', 'cloth'), { power: 2.2 }, ); B.rect(9, 22, 12, 6, P.mat('#1c1418', 'cloth'), 0);
        out = finish(B, 15, 31); out.fire = { x: 15, y: 25, w: 9 }; break;
      }
      case 'forge': {
        const B = new MB(30, 26); const s = stone();
        B.part(1); B.rect(1, 8, 28, 17, s, 2); for (let x = 1; x < 29; x++) { B.shadeAt(x, 8, 3); B.shadeAt(x, 24, 1); }
        for (let y = 9; y < 24; y++) for (let x = 1; x < 29; x++) if ((y - 9) % 5 === 4 || (x + ((Math.floor((y - 9) / 5) % 2) * 3)) % 7 === 0) B.shadeAt(x, y, 0);
        B.part(2); B.rect(4, 5, 22, 5, P.mat('#2a2024', 'cloth'), 1); // coal bed
        B.part(3); B.rect(25, 0, 4, 9, P.mat(C.leather), 2); // bellows
        out = finish(B, 15, 25); out.fire = { x: 15, y: 7, w: 20, coals: true }; break;
      }
      case 'anvil': out = E.prop('anvil', 1); break;
      case 'barrel': out = E.prop('barrel', seed); break;
      case 'crate': out = E.prop('crate', seed); break;
      case 'sack': out = E.prop('sack', seed); break;
      case 'hay': out = E.prop('hay', seed); break;
      case 'woodpile': out = E.prop('woodpile', seed); break;
      case 'cupboard': case 'wardrobe': {
        const B = new MB(18, 30); const m = v >= 2 ? dark() : wood();
        B.part(1); B.rect(1, 1, 16, 28, m, 2); for (let y = 1; y < 29; y++) { B.shadeAt(1, y, 3); B.shadeAt(16, y, 1); B.shadeAt(8, y, 1); } for (let x = 1; x < 17; x++) { B.shadeAt(x, 1, 4); B.shadeAt(x, 28, 0); }
        B.plot(7, 15, P.mat(P.metal.brass, 'metal'), 4); B.plot(10, 15, P.mat(P.metal.brass, 'metal'), 4);
        out = finish(B, 9, 29); break;
      }
      case 'chest': {
        const B = new MB(18, 14); const m = v >= 2 ? dark() : wood();
        B.part(1); B.rect(1, 5, 16, 8, m, 2); for (let x = 1; x < 17; x++) B.shadeAt(x, 12, 1);
        B.part(2); B.blob(9, 4, 8, 3.5, m, { power: 3 }); for (let x = 1; x < 17; x++) B.plot(x, 6, iron(), 2);
        B.plot(8, 8, P.mat(P.metal.brass, 'metal'), 4); B.plot(9, 8, P.mat(P.metal.brass, 'metal'), 3); B.plot(3, 3, iron(), 2); B.plot(14, 3, iron(), 2);
        out = finish(B, 9, 13); break;
      }
      case 'shelf': { // wall shelf showing goods: v = fill level 0..3, seed picks good colour
        const B = new MB(30, 30); const m = wood();
        B.part(1); B.rect(1, 1, 28, 28, P.mat('#4a3424', 'wood'), 1); for (let y = 1; y < 29; y++) { B.shadeAt(1, y, 2); B.shadeAt(28, y, 0); }
        for (const sy of [9, 18, 27]) { B.part(2); B.rect(1, sy, 28, 2, m, 3); B.shadeAt(1, sy + 1, 1); }
        const goods = (cache.goodsFor && cache.goodsFor[seed]) || ['bread'];
        let n = 0;
        for (const sy of [9, 18, 27]) for (let i = 0; i < 6; i++) {
          if (n++ >= v * 6) break;
          const g = goods[(i + sy) % goods.length]; const gm = P.mat(GOOD_COL[g] || '#a0a0a0', g === 'tools' || g === 'iron' ? 'metal' : 'cloth');
          B.part(3); const gx = 4 + i * 4.3;
          if (g === 'bread') B.blob(gx, sy - 2, 1.9, 1.5, gm, { power: 2 });
          else if (g === 'medicine' || g === 'ale') { B.rect(Math.round(gx) - 1, sy - 5, 3, 5, gm, 2); B.plot(Math.round(gx), sy - 6, P.mat('#c8b8a0', 'cloth'), 3); }
          else if (g === 'tools') { B.capsule(gx, sy - 1, gx, sy - 6, 0.5, 0.5, P.mat(P.wood.oak, 'wood')); B.rect(Math.round(gx) - 1, sy - 7, 3, 2, gm, 3); }
          else B.blob(gx, sy - 2, 1.8, 1.8, gm, { power: 2.2 });
        }
        out = finish(B, 15, 29); break;
      }
      case 'counter': {
        const B = new MB(42, 20); const m = v >= 2 ? dark() : wood();
        B.part(1); B.rect(1, 6, 40, 13, m, 2); for (let x = 1; x < 41; x += 6) for (let y = 7; y < 18; y++) B.shadeAt(x, y, 1);
        B.part(2); B.rect(0, 3, 42, 4, m, 4); for (let x = 0; x < 42; x++) B.shadeAt(x, 6, 1);
        if (seed === 7) { B.part(3); B.blob(8, 2, 2, 1.6, P.mat(P.metal.brass, 'metal'), { power: 2 }); } // scales/coin dish
        out = finish(B, 21, 19); break;
      }
      case 'bar': { // tavern bar with taps
        const B = new MB(58, 24); const m = dark();
        B.part(1); B.rect(1, 9, 56, 14, m, 2); for (let x = 1; x < 57; x += 8) for (let y = 10; y < 22; y++) B.shadeAt(x, y, 1);
        B.part(2); B.rect(0, 6, 58, 4, m, 4); for (let x = 0; x < 58; x++) B.shadeAt(x, 9, 1);
        B.part(3); for (let i = 0; i < 4; i++) { B.blob(10 + i * 12, 3, 1.4, 1.9, P.mat(P.wood.walnut, 'wood'), { power: 3 }); }
        out = finish(B, 29, 23); break;
      }
      case 'workbench': {
        const B = new MB(30, 22); const m = wood();
        B.part(1); B.capsule(3, 21, 3, 11, 1, 1, m); B.capsule(27, 21, 27, 11, 1, 1, m);
        B.part(2); B.rect(1, 6, 28, 6, m, 3); for (let x = 1; x < 29; x++) { B.shadeAt(x, 6, 4); B.shadeAt(x, 11, 1); }
        B.part(3); B.capsule(8, 4, 13, 2, 0.7, 0.7, m); B.rect(12, 1, 3, 2, iron(), 3); B.capsule(18, 5, 22, 5, 0.6, 0.6, iron()); B.blob(25, 4, 1.8, 1.2, P.mat(C.linen), { power: 2 });
        out = finish(B, 15, 21); break;
      }
      case 'rack': { // weapon/tool rack against the wall
        const B = new MB(26, 30); const m = dark();
        B.part(1); B.rect(1, 4, 24, 3, m, 3); B.rect(1, 22, 24, 3, m, 2);
        B.part(2); for (let i = 0; i < 4; i++) { const x = 4 + i * 6; B.capsule(x, 28, x, 2, 0.6, 0.6, P.mat(P.wood.oak, 'wood')); if (i % 2) B.capsule(x, 2, x, -2, 1.2, 0.3, P.mat(P.metal.steel, 'metal')); else B.rect(x - 2, 1, 5, 2, P.mat(P.metal.steel, 'metal'), 3); }
        out = finish(B, 13, 29); break;
      }
      case 'desk': {
        const B = new MB(30, 22); const m = dark();
        B.part(1); B.rect(1, 7, 28, 14, m, 2); B.rect(4, 11, 9, 8, m, 1);
        B.part(2); B.rect(0, 5, 30, 3, m, 4);
        B.part(3); B.rect(15, 2, 7, 4, P.mat(C.white), 3); B.capsule(24, 4, 26, 0, 0.4, 0.3, P.mat(C.white)); B.blob(7, 3, 1.4, 2, P.mat('#e8d8a0', 'cloth'), { power: 3 });
        out = finish(B, 15, 21); break;
      }
      case 'medbed': {
        const B = new MB(18, 28); B.part(1); B.rect(1, 2, 16, 25, wood(), 1);
        B.part(2); B.rect(2, 3, 14, 22, P.mat(C.white), 3); B.blob(9, 5, 5, 2, P.mat(C.linen), { power: 2.5 }); for (let y = 6; y < 25; y += 3) B.tweak(4, y, -1);
        out = finish(B, 9, 27); break;
      }
      case 'pew': {
        const B = new MB(46, 16); const m = dark();
        B.part(1); B.rect(1, 1, 44, 8, m, 2); for (let x = 1; x < 45; x++) B.shadeAt(x, 1, 3);
        B.part(2); B.rect(1, 9, 44, 3, m, 3); B.capsule(3, 15, 3, 11, 0.8, 0.8, m); B.capsule(43, 15, 43, 11, 0.8, 0.8, m);
        out = finish(B, 23, 15); break;
      }
      case 'altar': {
        const B = new MB(34, 30); const s = P.mat('#c8bca8', 'cloth');
        B.part(1); B.rect(2, 12, 30, 17, s, 2); for (let x = 2; x < 32; x++) B.shadeAt(x, 12, 4);
        B.part(2); B.rect(5, 13, 24, 10, P.mat(C.crimson), 2); for (let x = 5; x < 29; x++) B.plot(x, 22, P.mat(P.metal.gold, 'metal'), 3);
        B.part(3); for (const cx of [7, 27]) { B.rect(cx - 1, 4, 2, 8, P.mat(C.white), 3); B.plot(cx - 1, 2, P.mat('#ffd060', 'metal'), 4); B.plot(cx - 1, 3, P.mat('#ff9a30', 'metal'), 3); }
        const g = P.mat(P.metal.gold, 'metal'); for (let y = 2; y < 11; y++) B.plot(17, y, g, 3); for (let x = 14; x < 21; x++) B.plot(x, 5, g, 4);
        out = finish(B, 17, 29); out.candles = [[6, 3], [26, 3]]; break;
      }
      case 'millstone': {
        const B = new MB(30, 22); const s = stone();
        B.part(1); B.rect(2, 10, 26, 11, wood(), 2);
        B.part(2); B.blob(15, 9, 12, 5.5, s, { power: 2 }); B.blob(15, 7, 10, 4.5, s, { power: 2 }); B.blob(15, 6, 2, 1.2, P.mat('#2a2024', 'cloth'), { power: 2 });
        for (let a = 0; a < 6; a++) B.tweak(15 + Math.cos(a) * 7, 7 + Math.sin(a) * 3, -1);
        out = finish(B, 15, 21); break;
      }
      case 'stairs': {
        const B = new MB(18, 34); const m = wood();
        B.part(1); for (let k = 0; k < 8; k++) { const y = 2 + k * 4; B.rect(1, y, 16, 4, m, k % 2 ? 2 : 3); for (let x = 1; x < 17; x++) B.shadeAt(x, y + 3, 1); }
        B.part(2); B.capsule(1, 33, 1, 1, 0.8, 0.8, dark()); B.capsule(17, 33, 17, 1, 0.8, 0.8, dark());
        out = finish(B, 9, 33); break;
      }
      case 'rug': {
        const B = new MB(34, 22); const m = P.mat(rng.pick([C.crimson, C.navy, C.madder, C.teal])); const t = P.mat(C.mustard);
        B.part(1); B.rect(1, 1, 32, 20, m, 2); for (let x = 1; x < 33; x++) { B.plot(x, 2, t, 3); B.plot(x, 19, t, 2); } for (let y = 2; y < 20; y++) { B.plot(2, y, t, 3); B.plot(31, y, t, 2); }
        for (let y = 6; y < 16; y += 3) for (let x = 8; x < 26; x += 4) B.plot(x + (y % 2), y, t, 3);
        out = finish(B, 17, 21, { outline: false }); out.flat = true; break;
      }
      case 'cauldron': {
        const B = new MB(16, 16); B.part(1); B.blob(8, 10, 6, 5, iron(), { power: 2 }); B.blob(8, 6, 5.5, 1.6, P.mat('#7a5a3a', 'cloth'), { power: 2 });
        out = finish(B, 8, 15); break;
      }
      case 'doughtable': {
        const B = new MB(30, 20); const m = pine();
        B.part(1); B.capsule(4, 19, 4, 10, 1, 1, m); B.capsule(26, 19, 26, 10, 1, 1, m);
        B.part(2); B.rect(1, 4, 28, 7, m, 3); for (let x = 1; x < 29; x++) B.shadeAt(x, 10, 1);
        B.part(3); B.rect(4, 4, 14, 4, P.mat('#f0e8d8', 'cloth'), 3); for (let i = 0; i < 3; i++) B.blob(8 + i * 4, 4, 1.7, 1.3, P.mat('#e8d0a0', 'cloth'), { power: 2 }); B.capsule(21, 5, 27, 5, 0.8, 0.8, P.mat(P.wood.pine, 'wood'));
        out = finish(B, 15, 19); break;
      }
      case 'bunk': out = furniture('bed', 0, seed); break;
      case 'cell': { // iron bars
        const B = new MB(34, 34); const m = iron();
        B.part(1); for (let x = 1; x < 34; x += 4) for (let y = 1; y < 33; y++) B.plot(x, y, m, x < 17 ? 3 : 2);
        for (let x = 1; x < 34; x++) { B.plot(x, 1, m, 3); B.plot(x, 16, m, 2); B.plot(x, 32, m, 1); }
        out = finish(B, 17, 33); break;
      }
      default: { const B = new MB(4, 4); out = finish(B, 2, 3); }
    }
    cache.set(key, out);
    return out;
  }

  // Room shell: back wall (with windows), side wall tops, floor. Size matches the building footprint.
  function room(spec) {
    const { w, d, wall, floor, wealth, seed, windows = 1, dark: isDark } = spec;
    const T = 16, SW = 4, WH = 40, FW = w * T, FH = d * T;
    const B = new MB(FW + SW * 2, WH + FH + SW);
    const rng = O.RNG(seed);
    const wm = wall === 'stone' ? P.mat('#8e8880', 'cloth') : wall === 'log' ? P.mat('#7c5a38', 'wood') : wall === 'plank' ? P.mat('#8a6239', 'wood') : P.mat(wealth > 0.6 ? '#e4d8bc' : '#d6c8a8', 'cloth');
    B.part(1); B.rect(SW, 0, FW, WH, wm, 2);
    for (let y = 0; y < WH; y++) for (let x = SW; x < SW + FW; x++) {
      let s = 2;
      if (wall === 'stone') { const r = y % 6, off = Math.floor(y / 6) % 2 ? 4 : 0; s = r === 5 || (x + off) % 9 === 0 ? 0 : r === 0 ? 3 : 2; }
      else if (wall === 'log') { const r = y % 6; s = r === 0 ? 3 : r === 5 ? 0 : r === 4 ? 1 : 2; }
      else if (wall === 'plank') { const c = (x - SW) % 6; s = c === 0 ? 0 : c === 1 ? 3 : 2; }
      else { const n = O.fbm(x / 6, y / 6, 3, 2); s = n > 0.62 ? 3 : n < 0.32 ? 1 : 2; }
      // lower wall darker (ambient occlusion near the floor), top darker under the ceiling
      if (y > WH - 4) s = Math.max(0, s - 1); if (y < 3) s = Math.max(0, s - 1);
      B.shadeAt(x, y, s);
    }
    if (wall === 'timber' || !wall) { const bm = P.mat(P.wood.dark, 'wood'); for (let x = SW; x < SW + FW; x += 32) for (let y = 0; y < WH; y++) { B.plot(x, y, bm, 2); B.plot(x + 1, y, bm, 1); } for (let x = SW; x < SW + FW; x++) { B.plot(x, 0, bm, 1); B.plot(x, 1, bm, 2); } }
    // skirting
    const sk = P.mat(P.wood.dark, 'wood'); for (let x = SW; x < SW + FW; x++) { B.plot(x, WH - 2, sk, 2); B.plot(x, WH - 1, sk, 1); }
    // windows in the back wall
    const winSpots = [];
    const nW = Math.min(windows, Math.max(1, Math.floor(w / 2)));
    for (let i = 0; i < nW; i++) {
      const cx = Math.round(SW + ((i + 0.5) * FW) / nW), wx = cx - 5, wy = 9;
      B.part(2);
      const fm = P.mat(P.wood.dark, 'wood'), gm = P.mat(isDark ? '#1c2438' : '#a8c8e0', 'metal');
      for (let y = wy; y < wy + 14; y++) for (let x = wx; x < wx + 10; x++) {
        const edge = x === wx || y === wy || x === wx + 9 || y === wy + 13 || x === wx + 5 || y === wy + 6;
        B.plot(x, y, edge ? fm : gm, edge ? 2 : (x - wx + y - wy) % 7 === 3 ? 4 : 3);
      }
      for (let x = wx - 1; x <= wx + 10; x++) B.plot(x, wy + 14, P.mat('#b8a888', 'cloth'), 3);
      winSpots.push({ x: wx + 1, y: wy + 1, w: 8, h: 12 });
    }
    // floor
    const fmat = floor === 'stone' ? P.mat('#8a847c', 'cloth') : floor === 'dirt' ? P.mat('#8a6e4c', 'cloth') : P.mat(wealth > 0.6 ? '#7a5434' : '#9a7448', 'wood');
    B.part(3); B.rect(SW, WH, FW, FH, fmat, 2);
    for (let y = WH; y < WH + FH; y++) for (let x = SW; x < SW + FW; x++) {
      let s = 2; const ly = y - WH, lx = x - SW;
      if (floor === 'stone') { const r = ly % 8, off = Math.floor(ly / 8) % 2 ? 6 : 0; s = r === 7 || (lx + off) % 12 === 0 ? 0 : r === 0 || (lx + off) % 12 === 1 ? 3 : 2; if (O.noise2(x / 3, y / 3, 5) > 0.8) s = Math.max(1, s - 1); }
      else if (floor === 'dirt') { const n = O.fbm(x / 5, y / 5, 9, 2); s = n > 0.6 ? 3 : n < 0.35 ? 1 : 2; if (O.noise2(x * 2, y * 2, 4) > 0.9) B.plot(x, y, P.mat('#d0aa50', 'hair'), 3); }
      else { const r = ly % 5, row = Math.floor(ly / 5), seam = (lx + row * 11) % 23 === 0; s = r === 4 || seam ? 0 : r === 0 ? 3 : 2; if (O.noise2(x * 0.4, row, 7) > 0.75 && s === 2) s = 1; }
      if (ly < 3) s = Math.max(0, s - 1); // contact shadow under the back wall
      B.shadeAt(x, y, s);
    }
    // side walls (tops) and front wall top with door gap
    const wt = P.mat('#3a2e28', 'wood');
    B.part(4);
    for (let y = 0; y < WH + FH + SW; y++) for (let x = 0; x < SW; x++) { B.plot(x, y, wt, x === SW - 1 ? 3 : 1); B.plot(FW + SW * 2 - 1 - x, y, wt, x === SW - 1 ? 1 : 0); }
    const doorX0 = SW + spec.doorTile * T, doorX1 = doorX0 + T;
    for (let x = 0; x < FW + SW * 2; x++) { if (x >= doorX0 && x < doorX1) continue; for (let y = WH + FH; y < WH + FH + SW; y++) B.plot(x, y, wt, y === WH + FH ? 3 : 1); }
    void rng;
    return { canvas: B.toCanvas({ outline: false }), W: B.w, H: B.h, SW, WH, FW, FH, windows: winSpots, doorX0, doorX1 };
  }

  O.Furn = { furniture, room, GOOD_COL, setGoods: (seed, goods) => { cache.goodsFor = cache.goodsFor || {}; cache.goodsFor[seed] = goods; } };
})();
