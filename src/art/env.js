// Environment art: buildings, trees and props built with the same material raster as characters,
// so the whole world shares one light direction, palette logic and outline treatment.
//
// Projection: top-down oblique (3/4). Ground is seen from above; vertical surfaces face the viewer.
// A building occupies footprint w x d tiles. Its sprite's bottom row is the base of the front wall;
// walls rise from there and the roof recedes "up the screen" across the footprint depth.
'use strict';
(function () {
  const P = O.Pal, C = P.cloth;
  const T = 16;
  const MB = O.MatBuffer;
  const M = {
    plaster: () => P.mat('#e2d6b8', 'cloth'), plasterOchre: () => P.mat('#d8b878', 'cloth'), plasterPink: () => P.mat('#dcb2a0', 'cloth'), plasterWhite: () => P.mat('#ece6d6', 'cloth'),
    beam: () => P.mat('#5a3d26', 'wood'), plank: () => P.mat('#8a6239', 'wood'), plankRed: () => P.mat('#8a4632', 'wood'), log: () => P.mat('#7c5a38', 'wood'),
    stone: () => P.mat('#9a948a', 'cloth'), stoneWarm: () => P.mat('#a89a82', 'cloth'), stoneDark: () => P.mat('#6e6a66', 'cloth'), stoneNorth: () => P.mat('#7d8088', 'cloth'),
    brick: () => P.mat('#a0503a', 'cloth'),
    thatch: () => P.mat('#c9a456', 'hair'), shingle: () => P.mat('#7a5a40', 'wood'), tile: () => P.mat('#b45a38', 'cloth'), slate: () => P.mat('#5d6676', 'cloth'),
    glass: () => P.mat('#3e4a5e', 'metal'), frame: () => P.mat('#5a3d26', 'wood'), door: () => P.mat('#6e4a2c', 'wood'), iron: () => P.mat(P.metal.darkIron, 'metal'),
    moss: () => P.mat('#5e7a3a', 'cloth'), shutter: (rng) => P.mat(rng.pick(['#4f6e5a', '#6e4a3a', '#3f5a7a', '#7a6a3a', '#5a3d26']), 'wood'),
  };

  const flatN = [0, 0, 1];

  function building(spec) {
    const rng = O.RNG(spec.seed || 1);
    const w = spec.w, d = spec.d, floors = spec.floors || 1, OV = 4, FW = w * T, W = FW + OV * 2;
    const wallH = spec.wallH || floors * 22 + 9;
    const gable = spec.roofType === 'gable';
    const roofH = Math.round(d * T * 0.58) + 4;
    const gableH = Math.round(FW * 0.34), depthH = Math.round(d * T * 0.52);
    const extraTop = 12;
    const H = wallH + (gable ? gableH + depthH + 2 : roofH) + extraTop;
    const B = new MB(W, H);
    const wallTop = H - wallH, x0 = OV, x1 = OV + FW - 1;
    const wealth = spec.wealth ?? 0.5, cond = spec.condition ?? 1;
    const meta = { w, d, W, H, OV, windows: [], door: null, chimney: null, sign: null, wallTop };

    // ---- walls ----
    const wallKind = spec.wall || 'timber';
    const plasterM = spec.plaster ? M[spec.plaster]() : M.plaster();
    const wallMat = wallKind === 'stone' ? (spec.stoneMat ? M[spec.stoneMat]() : M.stone()) : wallKind === 'log' ? M.log() : wallKind === 'brick' ? M.brick() : wallKind === 'plank' ? (spec.plankMat ? M[spec.plankMat]() : M.plank()) : plasterM;
    B.part(1);
    B.rect(x0, wallTop, FW, wallH, wallMat, 2);
    // gentle vertical light falloff: left lit, right a touch darker, base darker (ground bounce)
    for (let y = wallTop; y < H; y++) for (let x = x0; x <= x1; x++) {
      let s = 2;
      if (x < x0 + 3) s = 3; if (x > x1 - 3) s = 1;
      B.shadeAt(x, y, s);
    }
    texWall(B, wallKind, wallMat, x0, wallTop, x1, H - 1, rng, cond);
    // stone plinth
    const plinth = M.stoneDark();
    for (let x = x0; x <= x1; x++) for (let y = H - 3; y < H; y++) B.plot(x, y, plinth, y === H - 3 ? 3 : 1 + ((x + (y === H - 1 ? 2 : 0)) % 5 === 0 ? 0 : 1));

    if (wallKind === 'timber') { // timber framing
      const bm = M.beam();
      const hb = (y) => { for (let x = x0; x <= x1; x++) { B.plot(x, y, bm, 2); B.plot(x, y + 1, bm, 1); } };
      hb(wallTop); for (let f = 1; f < floors; f++) hb(H - 3 - f * 22);
      hb(H - 5);
      const posts = Math.max(2, Math.round(FW / 18) + 1);
      for (let i = 0; i < posts; i++) {
        const px = Math.round(x0 + (i * (FW - 2)) / (posts - 1));
        for (let y = wallTop; y < H - 3; y++) { B.plot(px, y, bm, 2); B.plot(px + 1, y, bm, 1); }
      }
      meta.posts = posts;
      // diagonal braces in end panels
      const pw = (FW - 2) / (posts - 1);
      for (let f = 0; f < floors; f++) {
        const yb = H - 5 - f * 22, yt = Math.max(wallTop + 1, yb - 20);
        for (const [pa, dirn] of [[x0 + 2, 1], [x1 - 2, -1]]) {
          if (rng.chance(0.7)) {
            const lw = Math.min(pw - 3, 12), lh = yb - yt - 1, n = Math.max(lw, lh);
            for (let k = 0; k <= n; k++) { const bx = pa + dirn * Math.round((k * lw) / n), by = yb - 1 - Math.round((k * lh) / n); if (B.matAt(bx, by) === plasterM) B.plot(bx, by, bm, 1); }
          }
        }
      }
    }
    // ---- door & windows ----
    const doorTile = spec.doorTile ?? Math.floor(w / 2);
    const dw = spec.bigDoor ? 22 : wealth > 0.7 ? 12 : 11, dh = spec.bigDoor ? 24 : 17;
    const dx = Math.round(x0 + doorTile * T + T / 2 - dw / 2 + (spec.bigDoor ? 0 : 0)), dy = H - 2 - dh;
    drawDoor(B, dx, dy, dw, dh, wealth, rng, spec.bigDoor);
    meta.door = { x: dx, y: dy, w: dw, h: dh, tile: doorTile };
    const shutterM = M.shutter(rng);
    for (let f = 0; f < floors; f++) {
      const wy = H - 3 - f * 22 - 17 + (f ? 1 : 0);
      const slots = Math.max(1, Math.floor(FW / 22));
      for (let i = 0; i < slots; i++) {
        const cxw = Math.round(x0 + ((i + 0.5) * FW) / slots);
        const ww = wealth > 0.7 ? 9 : 8, wh = wealth > 0.7 ? 11 : 9;
        const wx = cxw - Math.floor(ww / 2);
        if (f === 0 && wx + ww + 3 > dx && wx - 3 < dx + dw) continue;
        if (wx < x0 + 3 || wx + ww > x1 - 2) continue;
        drawWindow(B, wx, wy, ww, wh, shutterM, wealth, rng, spec.shopWindow && f === 0);
        meta.windows.push({ x: wx + 1, y: wy + 1, w: ww - 2, h: wh - 2 });
      }
    }

    // ---- roof ----
    const roofKind = spec.roof || 'thatch';
    const RM = M[roofKind]();
    B.part(2);
    if (!gable) {
      const ey = wallTop + 3, ry = wallTop - roofH;
      B.poly([[0, ey], [W, ey], [W - 2, ry], [2, ry]], [0, -0.45, 0.89], RM);
      texRoof(B, roofKind, RM, 0, ry, W, ey, rng, cond, null);
      // eave line + ridge cap
      for (let x = 1; x < W - 1; x++) { B.shadeAt(x, ey - 1, 1); if (roofKind === 'thatch') { B.shadeAt(x, ey - 2, (x % 3 === 0) ? 1 : 2); } }
      for (let x = 2; x < W - 2; x++) { B.shadeAt(x, ry, 4); B.shadeAt(x, ry + 1, 3); }
      // ends: darken left/right 2px to suggest the roof thickness
      for (let y = ry; y < ey; y++) { B.shadeAt(W - 2 - Math.round((ey - y) / (ey - ry) * 2), y, 1); }
      meta.roofTop = ry;
      // eave shadow on the wall
      B.part(1);
      for (let x = x0; x <= x1; x++) for (let y = ey; y < ey + 3; y++) if (B.matAt(x, y) >= 0 && B.matAt(x, y) !== RM) B.tweak(x, y, y === ey ? -2 : -1);
    } else {
      const apexX = W / 2, eY = wallTop + 3, aY = wallTop - gableH - 1;
      B.poly([[0, eY], [apexX, aY], [apexX, aY - depthH], [0, eY - depthH]], [-0.55, -0.35, 0.76], RM);
      B.poly([[apexX, aY], [W, eY], [W, eY - depthH], [apexX, aY - depthH]], [0.62, -0.35, 0.7], RM);
      texRoof(B, roofKind, RM, 0, aY - depthH, W, eY, rng, cond, { apexX, eY, aY, depthH });
      // ridge line
      for (let y = Math.floor(aY - depthH); y <= aY; y++) { B.shadeAt(Math.floor(apexX) - 1, y, 4); B.shadeAt(Math.floor(apexX), y, 2); }
      // gable wall (triangle) — same wall material
      B.part(1);
      const gm = wallKind === 'timber' ? plasterM : wallMat;
      B.poly([[x0 + 1, wallTop + 1], [apexX, aY + 4], [x1, wallTop + 1]], flatN, gm);
      for (let y = Math.floor(aY + 4); y <= wallTop; y++) for (let x = x0; x <= x1; x++) if (B.matAt(x, y) === gm) B.shadeAt(x, y, x < apexX ? 3 : 2);
      if (wallKind !== 'timber') texWall(B, wallKind, gm, x0, Math.floor(aY + 4), x1, wallTop + 1, rng, cond, true);
      else { const bm = M.beam(); for (let y = Math.floor(aY + 6); y <= wallTop; y++) { B.plot(Math.floor(apexX) - 1, y, bm, 2); B.plot(Math.floor(apexX), y, bm, 1); } }
      // bargeboards along the gable edges
      const bb = M.beam();
      B.part(2);
      for (let x = 0; x <= W; x++) {
        const t = x <= apexX ? x / apexX : (W - x) / (W - apexX);
        const y = Math.round(eY - t * (eY - aY));
        B.plot(x, y, bb, x < apexX ? 3 : 1); B.plot(x, y + 1, bb, x < apexX ? 2 : 1); B.plot(x, y - 1, RM, 3);
      }
      // small gable vent/window in the triangle
      if (gableH > 14) drawWindow(B, Math.round(apexX - 3), Math.round(wallTop - gableH * 0.55), 6, 6, shutterM, wealth, rng, false, true);
      meta.roofTop = aY - depthH;
      // eave shadow under bargeboard on wall
      B.part(1);
      for (let x = x0; x <= x1; x++) for (let y = wallTop; y < wallTop + 2; y++) if (B.matAt(x, y) === wallMat || B.matAt(x, y) === gm) B.tweak(x, y, -1);
    }
    // ---- chimney ----
    if (spec.chimney) {
      B.part(3);
      const cxp = spec.chimneyX != null ? Math.round(OV + spec.chimneyX * FW) : Math.round(W * (rng.chance(0.5) ? 0.25 : 0.72));
      const roofY = (() => { for (let y = 0; y < H; y++) if (B.matAt(cxp, y) === RM) return y; return wallTop; })();
      const cTop = Math.max(1, roofY - 9), cBot = roofY + 7;
      const sm = spec.wall === 'brick' ? M.brick() : M.stoneDark();
      for (let y = cTop; y <= cBot; y++) for (let x = cxp - 3; x <= cxp + 2; x++) B.plot(x, y, sm, x === cxp - 3 ? 3 : x === cxp + 2 ? 1 : 2);
      for (let y = cTop + 2; y <= cBot; y += 3) for (let x = cxp - 3; x <= cxp + 2; x++) B.shadeAt(x, y, 1);
      for (let x = cxp - 4; x <= cxp + 3; x++) { B.plot(x, cTop - 1, sm, 3); B.plot(x, cTop, sm, 2); }
      B.plot(cxp - 1, cTop - 1, P.mat('#1e1820', 'cloth'), 1); B.plot(cxp, cTop - 1, P.mat('#1e1820', 'cloth'), 1);
      meta.chimney = { x: cxp, y: cTop - 2 };
    }
    // ---- sign ----
    if (spec.sign) {
      B.part(4);
      const sx = Math.min(x1 - 6, dx + dw + 4), sy = Math.max(wallTop + 4, dy - 4);
      const br = M.iron();
      for (let x = sx - 2; x <= sx + 9; x++) B.plot(x, sy, br, 2);
      B.plot(sx, sy + 1, br, 1); B.plot(sx + 7, sy + 1, br, 1);
      drawSignBoard(B, sx - 1, sy + 2, spec.sign);
      meta.sign = { x: sx, y: sy };
    }
    // ---- weathering & decoration ----
    B.part(5);
    if (cond < 0.6) { // cracks and grime
      for (let i = 0; i < Math.round((1 - cond) * 14); i++) { const cx = rng.int(x0 + 2, x1 - 2), cy = rng.int(wallTop + 4, H - 6); B.tweak(cx, cy, -1); B.tweak(cx + 1, cy + 1, -1); }
    }
    if (wealth > 0.55 && !spec.noFlowers) { // window boxes with flowers
      for (const wdw of meta.windows) if (wdw.y > H - 30) {
        const by = wdw.y + wdw.h + 2; const bx = wdw.x - 1;
        const bxm = M.plank(), fl = P.mat(rng.pick(['#c84a4a', '#d8b040', '#b060b0', '#e6e0d0'])), lf = P.mat('#4f7a34', 'cloth');
        for (let x = bx; x < bx + wdw.w + 2; x++) { B.plot(x, by, bxm, 2); B.plot(x, by + 1, bxm, 1); B.plot(x, by - 1, lf, (x % 2) + 2); if (x % 2 === 0) B.plot(x, by - 2, fl, 3); }
      }
    }
    if (spec.extras) for (const e of spec.extras) e(B, meta, rng);
    const canvas = B.toCanvas();
    // roof mask (for snow cover / wet sheen), kept as a white silhouette of roof pixels
    const rm = document.createElement('canvas'); rm.width = W; rm.height = H;
    const rc = rm.getContext('2d'), rid = rc.createImageData(W, H);
    for (let i = 0; i < W * H; i++) if (B.mat[i] >= 0 && B.group[i] === 2) { const y = (i / W) | 0; const s = B.shade[i]; const v = s >= 3 ? 250 : s === 2 ? 232 : 206; rid.data[i * 4] = v; rid.data[i * 4 + 1] = v + 3; rid.data[i * 4 + 2] = Math.min(255, v + 12); rid.data[i * 4 + 3] = (y + (i % W)) % 7 === 0 ? 150 : 255; }
    rc.putImageData(rid, 0, 0);
    return Object.assign(meta, { canvas, roofMask: rm, buf: B, wallH, x0, x1 });
  }

  // Construction stages 0-10: the finished building is revealed part by part — stakes and string,
  // cleared ground, foundation, timber frame, walls rising, floors, rafters, roof covering laid from
  // the eaves up, doors and windows, fitting out — with scaffolding until the end.
  function staged(spec, stage, prog) {
    const fin = spec._fin || (spec._fin = building(spec)), FB = fin.buf, W = fin.W, H = fin.H;
    if (stage >= 10) return fin;
    const B = new MB(W, H);
    const x0 = fin.x0, x1 = fin.x1, wallTop = fin.wallTop, foot = spec.d * T;
    const dirt = P.mat('#8a6a44', 'cloth'), beam = M.beam(), stake = P.mat('#c8a070', 'wood'), stringM = P.mat('#e8e0d0', 'cloth');
    const copy = (fn) => { for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x; if (FB.mat[i] < 0) continue; if (fn(x, y, FB.group[i])) { B.part(FB.group[i]); B.plot(x, y, FB.mat[i], FB.shade[i]); } } };
    // cleared, trodden ground over the footprint
    if (stage >= 1) { B.part(0); for (let y = H - foot; y < H; y++) for (let x = x0 - 1; x <= x1 + 1; x++) B.plot(x, y, dirt, O.noise2(x * 0.7, y * 0.7, 5) > 0.6 ? 3 : O.noise2(x, y, 9) > 0.85 ? 1 : 2); }
    else { // stakes and string
      B.part(9);
      for (const [sx, sy] of [[x0, H - foot], [x1, H - foot], [x0, H - 1], [x1, H - 1]]) { B.plot(sx, sy, stake, 3); B.plot(sx, sy - 1, stake, 3); B.plot(sx, sy - 2, stake, 2); }
      for (let x = x0; x <= x1; x += 2) { B.plot(x, H - foot - 1, stringM, 3); B.plot(x, H - 2, stringM, 3); }
      for (let y = H - foot; y < H; y += 2) { B.plot(x0, y - 1, stringM, 3); B.plot(x1, y - 1, stringM, 3); }
    }
    if (stage >= 2) copy((x, y, g) => g === 1 && y >= H - 3); // foundation plinth
    const wallRise = stage === 4 ? Math.round(H - 3 - prog * (fin.wallH - 3)) : stage > 4 ? -1 : H;
    if (stage >= 4) copy((x, y, g) => (g === 1 && y >= Math.max(wallRise, wallTop) && y < H - 2) || (g === 6 && stage >= 8 && (stage > 8 || prog > 0.5)));
    if (stage >= 4 && stage < 8) { // openings left dark where windows and doors will go
      B.part(6); const dk = P.mat('#2a2024', 'cloth');
      for (let y = Math.max(wallRise, wallTop); y < H - 3; y++) for (let x = x0; x <= x1; x++) if (FB.group[y * W + x] === 6 && FB.mat[y * W + x] >= 0) B.plot(x, y, dk, 1);
    }
    if (stage >= 5) copy((x, y, g) => g === 1 && y < wallTop); // gable walls / upper floor
    if (stage >= 3 && stage < 6) { // timber frame
      B.part(7);
      const posts = Math.max(2, Math.round((x1 - x0) / 16) + 1);
      for (let k = 0; k < posts; k++) { const px = Math.round(x0 + (k * (x1 - x0 - 1)) / (posts - 1)); for (let y = wallTop; y < H - 3; y++) { if (B.matAt(px, y) < 0 || stage === 3) { B.plot(px, y, beam, 2); B.plot(px + 1, y, beam, 1); } } }
      for (let x = x0; x <= x1; x++) { B.plot(x, wallTop, beam, 3); B.plot(x, wallTop + 1, beam, 1); }
    }
    if (stage >= 6) { // rafters across the roof shape, covering laid from the eaves upward
      const roofPix = []; let top = H, bot = 0;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x; if (FB.mat[i] >= 0 && FB.group[i] === 2) { roofPix.push(i); top = Math.min(top, y); bot = Math.max(bot, y); } }
      const cover = stage === 6 ? bot + 1 : stage === 7 ? Math.round(bot - prog * (bot - top)) : top;
      B.part(2);
      for (const i of roofPix) { const x = i % W, y = (i / W) | 0; if (y >= cover) B.plot(x, y, FB.mat[i], FB.shade[i]); else if (x % 6 === 0 || y % 9 === 0) B.plot(x, y, beam, x % 6 === 0 ? 2 : 3); }
    }
    if (stage >= 8) copy((x, y, g) => g === 3 || g === 4 || g === 5);
    if (stage >= 3 && stage <= 9) { // scaffolding: poles and planks in front of the walls
      B.part(8); const pole = P.mat('#b08a5a', 'wood');
      const topY = Math.max(2, (stage >= 6 ? wallTop - 4 : wallTop));
      for (const px of [x0 - 2, Math.round((x0 + x1) / 2) + 6, x1 + 2]) for (let y = topY; y < H; y++) B.plot(px, y, pole, px < W / 2 ? 3 : 2);
      for (let y = H - 12; y > topY; y -= 12) for (let x = x0 - 3; x <= x1 + 3; x++) { B.plot(x, y, pole, 3); B.plot(x, y + 1, pole, 1); }
    }
    const canvas = B.toCanvas();
    return Object.assign({}, fin, { canvas, windows: stage >= 9 ? fin.windows : [], chimney: stage >= 8 ? fin.chimney : null, roofMask: stage >= 7 ? fin.roofMask : null });
  }

  function texWall(B, kind, m, x0, y0, x1, y1, rng, cond, gableOnly) {
    if (kind === 'stone') {
      let y = y0 + 1; let row = 0;
      while (y < y1 - 3) {
        const h = 4 + (row % 3 === 0 ? 1 : 0); let x = x0 + (row % 2 ? -3 : 0);
        while (x <= x1) {
          const bw = rng.int(5, 9);
          for (let yy = y; yy < y + h; yy++) for (let xx = Math.max(x0, x); xx < Math.min(x1 + 1, x + bw); xx++) {
            if (B.matAt(xx, yy) !== m) continue;
            const edgeT = yy === y, edgeL = xx === x, edgeB = yy === y + h - 1, edgeR = xx === x + bw - 1;
            let s = 2; if (edgeT || edgeL) s = 3; if (edgeB || edgeR) s = 1;
            if (yy === y + h - 1 && xx >= x) s = 0; // mortar line
            if (xx === x + bw - 1) s = 0;
            if (O.noise2(xx * 0.7, yy * 0.7, 3) > 0.8 && s === 2) s = 1;
            B.shadeAt(xx, yy, s);
          }
          x += bw;
        }
        y += h; row++;
      }
      if (cond < 0.8) for (let i = 0; i < 8; i++) { const mx = rng.int(x0, x1), my = rng.int(y1 - 8, y1 - 3); if (B.matAt(mx, my) === m) B.plot(mx, my, P.mat('#5e7a3a', 'cloth'), 2); }
    } else if (kind === 'log') {
      for (let y = y0; y < y1 - 2; y++) for (let x = x0; x <= x1; x++) { if (B.matAt(x, y) !== m) continue; const r = (y - y0) % 5; B.shadeAt(x, y, r === 0 ? 3 : r === 4 ? 0 : r === 3 ? 1 : 2); }
      // log ends at corners
      for (let y = y0; y < y1 - 3; y += 5) for (const ex of [x0, x1 - 2]) { B.plot(ex, y + 1, m, 3); B.plot(ex + 1, y + 1, m, 4); B.plot(ex, y + 2, m, 2); B.plot(ex + 1, y + 2, m, 3); }
    } else if (kind === 'brick') {
      for (let y = y0; y < y1 - 2; y++) for (let x = x0; x <= x1; x++) { if (B.matAt(x, y) !== m) continue; const r = (y - y0) % 3, off = Math.floor((y - y0) / 3) % 2 ? 3 : 0; if (r === 2 || (x + off) % 6 === 0) B.shadeAt(x, y, 0); else if (r === 0) B.shadeAt(x, y, 3); }
    } else if (kind === 'plank') {
      for (let y = y0; y < y1 - 2; y++) for (let x = x0; x <= x1; x++) { if (B.matAt(x, y) !== m) continue; const c = (x - x0) % 5; B.shadeAt(x, y, c === 0 ? 0 : c === 1 ? 3 : 2); if (O.noise2(x * 0.5, y * 0.15, 7) > 0.78 && c > 1) B.shadeAt(x, y, 1); }
    } else { // plaster: soft mottling + patches when poor
      for (let y = y0; y < y1; y++) for (let x = x0; x <= x1; x++) { if (B.matAt(x, y) !== m) continue; const n = O.fbm(x / 5, y / 5, 13, 2); if (n > 0.66) B.tweak(x, y, 1); if (n < 0.3) B.tweak(x, y, -1); if (cond < 0.5 && O.noise2(x / 3, y / 3, 99) > 0.82) B.tweak(x, y, -1); }
    }
    void gableOnly;
  }

  function texRoof(B, kind, m, x0, y0, x1, y1, rng, cond, g) {
    for (let y = Math.floor(y0); y <= y1; y++) for (let x = Math.floor(x0); x <= x1; x++) {
      if (B.matAt(x, y) !== m) continue;
      let rowY = y; // for gable planes, rows follow the slope
      if (g) { const t = x <= g.apexX ? x / g.apexX : (B.w - x) / (B.w - g.apexX); rowY = y - Math.round(-t * (g.eY - g.aY)); }
      const base = O.clamp(B.shade[y * B.w + x], 1, 3);
      let s = base;
      if (kind === 'thatch') {
        const strand = O.noise2(x * 0.9, rowY * 0.18, 11);
        s = strand > 0.66 ? base + 1 : strand < 0.3 ? base - 1 : base;
        if ((rowY + 200) % 7 === 0) s = Math.max(0, base - 1);
        if (O.noise2(x * 2.3, y * 2.3, 5) > 0.92) s = 4;
      } else if (kind === 'shingle') {
        const r = (rowY + 400) % 4, off = Math.floor((rowY + 400) / 4) % 2 ? 3 : 0;
        s = r === 3 ? 0 : r === 0 ? base + 1 : base; if ((x + off) % 6 === 0 && r !== 3) s = Math.max(0, base - 1);
        if (O.noise2(x * 0.6, Math.floor(rowY / 4), 21) > 0.85 && r !== 3) s = base - 1;
      } else if (kind === 'tile') {
        const r = (rowY + 400) % 4, c = (x + 400) % 4;
        s = r === 3 ? 0 : c === 0 ? base + 1 : c === 3 ? base - 1 : base;
        if (r === 0 && c !== 3) s = Math.min(4, s + 1);
      } else if (kind === 'slate') {
        const r = (rowY + 300) % 3, off = Math.floor((rowY + 300) / 3) % 2 ? 2 : 0;
        s = r === 2 ? 0 : (x + off) % 5 === 0 ? base - 1 : base; if (O.noise2(x * 0.8, rowY, 31) > 0.85) s = base + 1;
      }
      B.shadeAt(x, y, O.clamp(s, 0, 4));
      if (cond < 0.7 && O.noise2(x / 4, y / 4, 77) > 0.78 - (0.7 - cond) * 0.3) B.plot(x, y, M.moss(), O.clamp(s, 1, 3));
    }
    void rng;
  }

  function drawDoor(B, x, y, w, h, wealth, rng, big) {
    const fm = M.frame(), dm = big ? M.plankRed() : M.door();
    B.part(6);
    // frame
    for (let yy = y - 1; yy < y + h; yy++) { B.plot(x - 1, yy, fm, 2); B.plot(x + w, yy, fm, 1); }
    for (let xx = x - 1; xx <= x + w; xx++) B.plot(xx, y - 1, fm, 3);
    // planks
    const arch = wealth > 0.7 && !big;
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) {
      if (arch && yy < y + 3) { const dxc = Math.abs(xx - (x + w / 2 - 0.5)); if (dxc > w / 2 - (y + 3 - yy)) { continue; } }
      const c = (xx - x) % (big ? 4 : 3);
      B.plot(xx, yy, dm, c === 0 ? 1 : xx < x + 2 ? 3 : 2);
    }
    // iron bands & handle
    const im = M.iron();
    for (const by of [y + 3, y + h - 4]) for (let xx = x; xx < x + w - (big ? 0 : 3); xx++) B.plot(xx, by, im, 2);
    if (big) { for (let k = 0; k < Math.min(w / 2, h); k++) { B.plot(x + k, y + 4 + k, dm, 1); B.plot(x + w - 1 - k, y + 4 + k, dm, 1); } for (let yy = y; yy < y + h; yy++) B.plot(x + w / 2, yy, dm, 0); }
    else { B.plot(x + w - 3, y + h / 2, M.iron(), 4); B.plot(x + w - 3, y + h / 2 + 1, M.iron(), 1); }
    // shadow at the top inside the frame (recessed door)
    for (let xx = x; xx < x + w; xx++) B.tweak(xx, y, -1);
    for (let yy = y; yy < y + h; yy++) B.tweak(x, yy, -1);
    // step stone
    const st = M.stoneWarm(); for (let xx = x - 2; xx <= x + w + 1; xx++) { B.plot(xx, y + h, st, 3); B.plot(xx, y + h + 1, st, 1); }
    void rng;
  }

  function drawWindow(B, x, y, w, h, shutterM, wealth, rng, shop, small) {
    B.part(6);
    const fm = M.frame(), gm = M.glass();
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) {
      const edge = xx === x || yy === y || xx === x + w - 1 || yy === y + h - 1;
      if (edge) B.plot(xx, yy, fm, yy === y ? 3 : xx === x ? 2 : 1);
      else {
        // glass: dark with a diagonal reflection streak, upper-left lit
        let s = 1; if ((xx - x) + (yy - y) === 3 || (xx - x) + (yy - y) === 4) s = 3; if (yy === y + 1) s = 0;
        B.plot(xx, yy, gm, s);
      }
    }
    // mullions
    if (!small) { const mx = x + Math.floor(w / 2); for (let yy = y; yy < y + h; yy++) B.plot(mx, yy, fm, 2); const my = y + Math.floor(h / 2); for (let xx = x; xx < x + w; xx++) B.plot(xx, my, fm, 2); }
    // shutters (open, flanking)
    if (!shop && !small) for (const [sx, s] of [[x - 3, 3], [x + w, 1]]) for (let yy = y; yy < y + h; yy++) for (let xx = sx; xx < sx + 3; xx++) B.plot(xx, yy, shutterM, (yy - y) % 3 === 0 ? 0 : s);
    // sill
    if (!small) for (let xx = x - 1; xx <= x + w; xx++) { B.plot(xx, y + h, M.stoneWarm(), 3); }
    void wealth; void rng;
  }

  // Hanging trade signs: little pixel icons on a board.
  function drawSignBoard(B, x, y, kind) {
    const bm = P.mat('#8a6a44', 'wood');
    for (let yy = y; yy < y + 8; yy++) for (let xx = x; xx < x + 10; xx++) B.plot(xx, yy, bm, yy === y ? 3 : xx === x ? 3 : yy === y + 7 || xx === x + 9 ? 1 : 2);
    const icon = {
      bread: ['..####..', '.#####.#', '##.#.###', '########'],
      anvil: ['#######.', '.######.', '..##....', '.####...'],
      mug: ['.####.', '.####.#', '.####.#', '.####.', '.####.'],
      cross: ['..##..', '######', '######', '..##..', '..##..'],
      scales: ['...#...', '#######', '#..#..#', '##.#.##', '..###..'],
      sword: ['......#', '.....#.', '#..##..', '.##....', '#.#....'],
      herb: ['.#.#.', '##.##', '.###.', '..#..', '..#..'],
      shield: ['######', '#.##.#', '######', '.####.', '..##..'],
    }[kind] || [];
    const col = { bread: '#d8a050', anvil: '#3a3a44', mug: '#e8d8a0', cross: '#c83a3a', scales: '#d8b040', sword: '#c8ccd4', herb: '#5aa040', shield: '#a8382f' }[kind] || '#fff';
    const im = P.mat(col, 'metal');
    icon.forEach((row, r) => [...row].forEach((ch, c) => { if (ch === '#') B.plot(x + 1 + c, y + 1 + r + (icon.length < 5 ? 1 : 0), im, 2 + ((r + c) % 3 === 0 ? 1 : 0)); }));
  }

  // ---------------- Trees & vegetation ----------------
  function tree(seed, kind = 'oak', season = 'summer') {
    const rng = O.RNG(seed);
    const W = kind === 'pine' ? 34 : 48, H = kind === 'pine' ? 62 : 60;
    const B = new MB(W, H);
    const trunk = P.mat(kind === 'birch' ? '#d8d2c4' : '#6a4a30', 'wood');
    const leafHex = { summer: kind === 'pine' ? '#2f5a3a' : kind === 'birch' ? '#7a9a3a' : '#4a7a32', autumn: kind === 'pine' ? '#2f5a3a' : rng.pick(['#c07a2a', '#b0502a', '#c8a03a']), spring: kind === 'pine' ? '#3a6a44' : '#6a9a3a', winter: kind === 'pine' ? '#2a4a38' : null }[season];
    const cx = W / 2, base = H - 2;
    B.part(1);
    if (kind === 'pine') {
      B.capsule(cx, base, cx, base - 14, 2.2, 1.6, trunk);
      const lm = P.mat(leafHex, 'cloth');
      B.part(2);
      for (let k = 0; k < 4; k++) {
        const ty = base - 10 - k * 11, hw = 15 - k * 3.2;
        B.poly([[cx - hw, ty], [cx + hw, ty], [cx, ty - 17]], (px, py) => [O.clamp((px - cx) / hw, -1, 1) * 0.8, -0.4, 0.6], lm);
        for (let x = Math.floor(cx - hw); x <= cx + hw; x++) { if (B.matAt(x, Math.floor(ty) - 1) === lm) B.shadeAt(x, ty - 1, 0); if ((x + k) % 3 === 0) B.shadeAt(x, ty - 2, 1); }
      }
      if (season === 'winter') snowCap(B, lm);
    } else {
      // trunk with roots and a branch fork
      B.capsule(cx, base, cx + 0.5, base - 18, 3, 2, trunk);
      B.capsule(cx - 3.5, base, cx, base - 3, 1.4, 1.4, trunk); B.capsule(cx + 4, base, cx + 1, base - 3, 1.3, 1.3, trunk);
      B.capsule(cx, base - 14, cx - 7, base - 24, 1.5, 1, trunk); B.capsule(cx + 1, base - 15, cx + 8, base - 26, 1.4, 0.9, trunk);
      if (kind === 'birch') for (let y = base - 18; y < base; y += 3) B.shadeAt(Math.round(cx) + (y % 2), y, 0);
      if (leafHex) {
        const lm = P.mat(leafHex, 'cloth');
        B.part(2);
        // canopy built from overlapping clumps; each clump shaded as a sphere -> leafy volume
        const clumps = [];
        const n = 9;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2 + rng.float(-0.3, 0.3);
          clumps.push([cx + Math.cos(a) * rng.float(8, 13), base - 32 + Math.sin(a) * rng.float(6, 9), rng.float(6, 8.5)]);
        }
        clumps.push([cx, base - 34, 11]); clumps.push([cx - 4, base - 40, 8]); clumps.push([cx + 5, base - 39, 7]);
        clumps.sort((p, q) => p[1] - q[1]);
        for (const [x, y, r] of clumps) {
          // sphere normals per clump but overall canopy darkened toward the bottom-right
          B.shape(x - r - 1, y - r - 1, x + r + 1, y + r + 1,
            (px, py) => (px - x) ** 2 + (py - y) ** 2 <= r * r,
            (px, py) => { const nx = (px - x) / r * 0.7 + (px - cx) / 22 * 0.5, ny = (py - y) / r * 0.7 + (py - (base - 34)) / 18 * 0.5; return [nx, ny, Math.sqrt(Math.max(0.05, 1 - nx * nx - ny * ny))]; }, lm);
        }
        // leaf texture: scattered darker/lighter pixel pairs
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (B.matAt(x, y) === lm) {
          const nn = O.noise2(x * 0.9, y * 0.9, seed & 255);
          if (nn > 0.8) B.tweak(x, y, 1); else if (nn < 0.18) B.tweak(x, y, -1);
        }
        // fruit/blossom accents
        if (season === 'spring' && kind === 'oak') for (let i = 0; i < 10; i++) { const x = rng.int(6, W - 6), y = rng.int(8, base - 26); if (B.matAt(x, y) === lm) B.plot(x, y, P.mat('#f0d0e0'), 3); }
      } else { // winter: bare branches
        for (let i = 0; i < 6; i++) { const a = -Math.PI / 2 + rng.float(-1.2, 1.2); B.capsule(cx, base - 18, cx + Math.cos(a) * 14, base - 18 + Math.sin(a) * 18, 1, 0.5, trunk); }
      }
    }
    return { canvas: B.toCanvas(), W, H, ox: Math.floor(W / 2), oy: base + 1 };
  }

  function snowCap(B, m) {
    const sm = P.mat('#eef2f6', 'cloth');
    for (let x = 0; x < B.w; x++) for (let y = 0; y < B.h - 1; y++) if (B.matAt(x, y) === m && B.matAt(x, y - 1) < 0) { B.plot(x, y, sm, 3); B.plot(x, y + 1, sm, 2); break; }
  }

  // ---------------- Props ----------------
  const propCache = new Map();
  function prop(kind, seed = 1, v = 0) {
    const key = kind + ':' + seed + ':' + v;
    if (propCache.has(key)) return propCache.get(key);
    const rng = O.RNG(seed);
    let B, ox, oy;
    const wood = P.mat(P.wood.oak, 'wood'), pine = P.mat(P.wood.pine, 'wood'), iron = P.mat(P.metal.darkIron, 'metal'), stone = M.stone();
    switch (kind) {
      case 'barrel': {
        B = new MB(14, 18); B.part(1);
        B.shape(1, 1, 13, 17, (px, py) => Math.abs(px - 7) <= 5.2 + Math.sin(((py - 1) / 16) * Math.PI) * 0.8 && py > 1.5 && py < 16.5, (px) => { const nx = (px - 7) / 6.5; return [nx, -0.1, Math.sqrt(Math.max(0.05, 1 - nx * nx))]; }, wood);
        for (const y of [4, 13]) for (let x = 0; x < 14; x++) if (B.matAt(x, y) === wood) B.plot(x, y, iron, x < 7 ? 3 : 1);
        for (let x = 0; x < 14; x++) for (let y = 2; y < 17; y++) if (B.matAt(x, y) === wood && x % 3 === 0) B.tweak(x, y, -1);
        B.part(2); B.shape(2, 0, 12, 4, (px, py) => ((px - 7) / 5.2) ** 2 + ((py - 2.2) / 1.6) ** 2 <= 1, () => [0, -0.9, 0.4], pine);
        ox = 7; oy = 17; break;
      }
      case 'crate': {
        B = new MB(16, 16); B.part(1);
        B.rect(1, 5, 14, 10, pine, 2); for (let x = 1; x < 15; x++) { B.shadeAt(x, 5, 3); B.shadeAt(x, 14, 1); }
        for (let y = 5; y < 15; y++) { B.shadeAt(1, y, 3); B.shadeAt(14, y, 1); B.shadeAt(Math.round(1 + (y - 5) * 1.3), y, 1); }
        B.part(2); B.rect(1, 1, 14, 4, pine, 4); for (let x = 1; x < 15; x++) B.shadeAt(x, 4, 2); for (let x = 1; x < 15; x += 4) for (let y = 1; y < 4; y++) B.shadeAt(x, y, 3);
        ox = 8; oy = 15; break;
      }
      case 'sack': {
        B = new MB(12, 12); B.part(1); const sm = P.mat(C.linen);
        B.blob(6, 7, 4.6, 4, sm, { power: 2.2 }); B.capsule(6, 3, 6, 2, 1.6, 1.2, sm); B.plot(5, 3, P.mat(C.brown), 1); B.plot(6, 3, P.mat(C.brown), 1);
        ox = 6; oy = 11; break;
      }
      case 'well': {
        B = new MB(30, 40); B.part(1);
        // posts and roof
        B.capsule(4, 36, 4, 10, 1.3, 1.3, wood); B.capsule(25, 36, 25, 10, 1.3, 1.3, wood);
        B.part(3);
        const rm = M.shingle();
        B.poly([[0, 13], [15, 3], [29, 13], [29, 10], [15, 0], [0, 10]], [0, -0.6, 0.8], rm);
        B.poly([[0, 13], [15, 3], [15, 1], [0, 10]], [-0.6, -0.4, 0.7], rm);
        B.poly([[15, 3], [29, 13], [29, 10], [15, 1]], [0.6, -0.4, 0.6], rm);
        // crank beam & bucket rope
        B.part(2); for (let x = 5; x < 25; x++) B.plot(x, 16, wood, 2); for (let y = 17; y < 24; y++) B.plot(15, y, P.mat(C.linen), 1);
        B.blob(15, 25, 2, 1.8, wood, { power: 3 });
        // stone ring (front face + rim)
        B.part(4);
        B.shape(1, 26, 29, 39, (px, py) => py > 28 && py < 38.5 && px > 1.5 && px < 28.5, (px) => { const nx = (px - 15) / 15; return [nx, 0, Math.sqrt(1 - nx * nx)]; }, stone);
        for (let y = 29; y < 39; y++) for (let x = 2; x < 29; x++) { const r = (y - 29) % 4, off = Math.floor((y - 29) / 4) % 2 ? 3 : 0; if (r === 3 || (x + off) % 6 === 0) B.tweak(x, y, -1); }
        B.shape(1, 24, 29, 31, (px, py) => ((px - 15) / 13.8) ** 2 + ((py - 28) / 3.4) ** 2 <= 1, () => [0, -0.8, 0.6], stone);
        B.shape(1, 24, 29, 31, (px, py) => ((px - 15) / 11) ** 2 + ((py - 28) / 2.2) ** 2 <= 1, () => [0, 0, 1], P.mat('#1c2430', 'cloth'), { maxShade: 1 });
        ox = 15; oy = 38; break;
      }
      case 'stall': { // market stall: striped awning, counter, goods
        const awn = P.mat(rng.pick([C.madder, C.woad, C.forest, C.mustard, C.plum])), aw2 = P.mat(C.white);
        B = new MB(40, 36); B.part(1);
        B.capsule(3, 34, 3, 8, 1.1, 1.1, wood); B.capsule(36, 34, 36, 8, 1.1, 1.1, wood);
        B.part(2); B.rect(2, 22, 36, 12, pine, 2);
        for (let x = 2; x < 38; x++) { B.shadeAt(x, 22, 4); B.shadeAt(x, 23, 3); B.shadeAt(x, 33, 1); } for (let x = 2; x < 38; x += 6) for (let y = 24; y < 33; y++) B.shadeAt(x, y, 1);
        // goods on counter (by type)
        B.part(3);
        const goods = v === 1 ? ['#d8a050', '#c88a40'] : v === 2 ? ['#c84a3a', '#5a8a3a', '#e0c040'] : v === 3 ? ['#8a8f98', '#6d4a2c'] : ['#5a8a3a', '#c84a3a', '#d8a050'];
        for (let i = 0; i < 9; i++) { const g = P.mat(goods[i % goods.length], 'cloth'); B.blob(6 + i * 3.4, 20.5, 1.7, 1.5, g, { power: 2 }); }
        // awning: sloped striped cloth with scalloped edge
        B.part(4);
        B.poly([[0, 12], [40, 12], [38, 2], [2, 2]], [0, -0.5, 0.85], (px) => (Math.floor(px / 5) % 2 ? awn : aw2));
        for (let x = 0; x < 40; x++) { const m = Math.floor(x / 5) % 2 ? awn : aw2; B.plot(x, 12, m, 1); if (x % 5 !== 0) B.plot(x, 13, m, 1); if (x % 5 === 2) B.plot(x, 14, m, 1); }
        ox = 20; oy = 34; break;
      }
      case 'fenceH': case 'fenceV': {
        if (kind === 'fenceH') {
          B = new MB(16, 16); B.part(1);
          B.capsule(2, 15, 2, 5, 1, 1, wood); B.capsule(14, 15, 14, 5, 1, 1, wood);
          B.part(2); for (let x = 0; x < 16; x++) { B.plot(x, 7, wood, 3); B.plot(x, 8, wood, 1); B.plot(x, 11, wood, 3); B.plot(x, 12, wood, 1); }
          ox = 8; oy = 15;
        } else {
          B = new MB(6, 24); B.part(1); B.capsule(3, 23, 3, 9, 1, 1, wood);
          for (let y = 2; y < 23; y++) { B.plot(2, y, wood, 3); B.plot(3, y, wood, 2); }
          ox = 3; oy = 23;
        }
        break;
      }
      case 'hay': {
        B = new MB(22, 18); B.part(1); const hm = P.mat('#d0aa50', 'hair');
        B.blob(11, 10, 10, 7, hm, { power: 2.1 });
        for (let y = 0; y < 18; y++) for (let x = 0; x < 22; x++) if (B.matAt(x, y) === hm && O.noise2(x * 1.3, y * 0.4, 4) > 0.65) B.tweak(x, y, -1);
        ox = 11; oy = 17; break;
      }
      case 'woodpile': {
        B = new MB(24, 16); B.part(1); const lm = M.log();
        for (let r = 0; r < 3; r++) for (let i = 0; i < 4 - r; i++) { const x = 4 + i * 5 + r * 2.5, y = 13 - r * 4; B.blob(x, y, 2.4, 2.2, lm, { power: 2 }); B.plot(x - 0.5, y - 0.5, P.mat('#c8a070', 'wood'), 3); B.plot(x + 0.5, y, P.mat('#c8a070', 'wood'), 2); }
        ox = 12; oy = 15; break;
      }
      case 'bush': {
        B = new MB(22, 16); B.part(1); const bm = P.mat(rng.pick(['#4a7a32', '#3f6a30', '#5a8a3a']), 'cloth');
        for (const [x, y, r] of [[7, 10, 5.5], [14, 9, 6], [11, 6, 5]]) B.shape(x - r, y - r, x + r, y + r, (px, py) => (px - x) ** 2 + (py - y) ** 2 <= r * r, (px, py) => { const nx = (px - 11) / 11, ny = (py - 7) / 9; return [nx, ny, Math.sqrt(Math.max(0.05, 1 - nx * nx - ny * ny))]; }, bm);
        for (let y = 0; y < 16; y++) for (let x = 0; x < 22; x++) if (B.matAt(x, y) === bm && O.noise2(x, y, seed & 63) > 0.78) B.tweak(x, y, 1);
        if (rng.chance(0.4)) for (let i = 0; i < 5; i++) { const x = rng.int(4, 18), y = rng.int(4, 12); if (B.matAt(x, y) === bm) B.plot(x, y, P.mat(rng.pick(['#d84a4a', '#e8e0f0', '#e0c040'])), 3); }
        ox = 11; oy = 15; break;
      }
      case 'rock': {
        B = new MB(16, 12); B.part(1);
        B.blob(8, 7, 6.5, 4.5, stone, { power: 2.4 }); B.tweak(6, 5, 1); B.tweak(10, 9, -1);
        ox = 8; oy = 11; break;
      }
      case 'stump': {
        B = new MB(14, 12); B.part(1); const lm = M.log();
        B.shape(1, 3, 13, 11, (px, py) => Math.abs(px - 7) < 5 && py > 4 && py < 11, (px) => { const nx = (px - 7) / 6; return [nx, 0, Math.sqrt(1 - nx * nx)]; }, lm);
        B.shape(1, 1, 13, 7, (px, py) => ((px - 7) / 5) ** 2 + ((py - 4.5) / 2) ** 2 <= 1, () => [0, -0.8, 0.5], P.mat('#c8a070', 'wood')); B.plot(7, 4, lm, 1);
        ox = 7; oy = 11; break;
      }
      case 'sapling': { // a young tree staked against the wind; v = 0..2 growth
        const h = 10 + v * 6;
        B = new MB(16, h + 6); B.part(1);
        const bark = P.mat('#6a4a30', 'wood'), stake = P.mat('#c8a070', 'wood'), leaf = P.mat(v ? '#4e7a34' : '#6a9a44', 'cloth');
        B.capsule(8, h + 4, 8, 5, 0.7, 0.5, bark); B.capsule(5, h + 5, 5, h - 2, 0.5, 0.5, stake); B.plot(6, h - 1, P.mat('#e8e0d0', 'cloth'), 3);
        B.part(2); B.blob(8, 5 + (2 - v), 3 + v * 1.5, 2.5 + v, leaf, { power: 2 }); for (let k = 0; k < 4 + v * 3; k++) B.tweak(4 + (k * 5) % 9, 3 + (k * 3) % (4 + v * 2), (k % 2) ? 1 : -1);
        ox = 8; oy = h + 5; break;
      }
      case 'flowers': {
        B = new MB(8, 6); B.part(1); const fl = P.mat(rng.pick(['#d84a4a', '#e8e0f0', '#e0c040', '#9a6ad0'])), st = P.mat('#4a7a32', 'cloth');
        for (let i = 0; i < 4; i++) { const x = rng.int(1, 6), y = rng.int(1, 3); B.plot(x, y + 1, st, 2); B.plot(x, y, fl, 3); }
        B.part(0); ox = 4; oy = 5; propCache.set(key, { canvas: B.toCanvas({ outline: false }), ox, oy, W: B.w, H: B.h }); return propCache.get(key);
      }
      case 'grass': { // grass tufts, no outline
        B = new MB(8, 6); B.part(1); const gm = P.mat('#5d8a3e', 'cloth');
        for (let i = 0; i < 4; i++) { const x = 1 + i * 2; for (let y = 2 + (i % 2); y < 6; y++) B.plot(x, y, gm, y < 4 ? 4 : 3); }
        ox = 4; oy = 5; propCache.set(key, { canvas: B.toCanvas({ outline: false, ao: false }), ox, oy, W: B.w, H: B.h }); return propCache.get(key);
      }
      case 'cart': {
        B = new MB(34, 26); B.part(1);
        B.rect(3, 9, 26, 9, pine, 2); for (let x = 3; x < 29; x++) { B.shadeAt(x, 9, 4); B.shadeAt(x, 17, 1); if (x % 6 === 3) for (let y = 10; y < 17; y++) B.shadeAt(x, y, 1); }
        B.capsule(29, 15, 33, 18, 0.8, 0.8, wood);
        B.part(2); // wheel
        B.shape(5, 13, 19, 25, (px, py) => { const r = Math.hypot(px - 12, py - 19); return r <= 6 && (r >= 4.6 || Math.abs(px - 12) < 0.9 || Math.abs(py - 19) < 0.9); }, (px, py) => [(px - 12) / 7, (py - 19) / 7, 0.7], M.beam());
        if (v === 1) { B.part(3); for (let i = 0; i < 4; i++) B.blob(8 + i * 5.5, 7, 2.6, 2.6, P.mat(C.linen), { power: 2 }); }
        ox = 16; oy = 25; break;
      }
      case 'lamp': {
        B = new MB(10, 32); B.part(1); B.capsule(5, 31, 5, 8, 1, 1, iron);
        B.part(2); B.rect(2, 3, 6, 6, iron, 2); B.rect(3, 4, 4, 4, P.mat('#f0c060', 'metal'), 3); B.rect(2, 2, 6, 1, iron, 3);
        ox = 5; oy = 31; break;
      }
      case 'signpost': {
        B = new MB(20, 28); B.part(1); B.capsule(10, 27, 10, 4, 1.2, 1.2, wood);
        B.part(2); B.poly([[2, 6], [16, 6], [19, 8.5], [16, 11], [2, 11]], [0, 0, 1], pine); for (let x = 3; x < 16; x++) if (x % 3) B.plot(x, 8, P.mat('#3a2a1a', 'wood'), 1);
        ox = 10; oy = 27; break;
      }
      case 'bench': {
        B = new MB(24, 12); B.part(1); B.capsule(4, 11, 4, 6, 0.9, 0.9, wood); B.capsule(20, 11, 20, 6, 0.9, 0.9, wood);
        B.part(2); B.rect(1, 4, 22, 3, wood, 3); for (let x = 1; x < 23; x++) B.shadeAt(x, 6, 1);
        ox = 12; oy = 11; break;
      }
      case 'trough': {
        B = new MB(22, 10); B.part(1); B.rect(1, 3, 20, 6, wood, 2); for (let x = 1; x < 21; x++) B.shadeAt(x, 8, 1);
        B.part(2); B.rect(2, 2, 18, 2, P.mat('#4a6a8a', 'metal'), 3); ox = 11; oy = 9; break;
      }
      case 'anvil': {
        B = new MB(16, 12); B.part(1); B.rect(5, 6, 6, 5, M.log(), 2);
        B.part(2); const am = P.mat('#4a4c54', 'metal'); B.poly([[1, 2], [15, 2], [15, 5], [11, 6], [5, 6], [3, 4], [0, 3]], [0, -0.5, 0.86], am); for (let x = 1; x < 15; x++) B.shadeAt(x, 2, 4);
        ox = 8; oy = 11; break;
      }
      case 'wheat': case 'cabbage': case 'sprout': case 'soilrow': {
        B = new MB(16, 16); B.part(1);
        if (kind === 'wheat') {
          const wm = P.mat(v >= 3 ? '#d8b048' : '#7a9a3a', 'hair');
          for (let i = 0; i < 6; i++) { const x = 1 + i * 2.6, h = 9 + (i % 2) * 2; for (let y = 15 - h; y < 15; y++) B.plot(x, y, wm, y < 15 - h + 3 ? 3 : 2); if (v >= 3) { B.plot(x - 1, 15 - h + 1, wm, 4); B.plot(x + 1, 15 - h + 2, wm, 3); } }
        } else if (kind === 'cabbage') {
          const cm = P.mat('#6a9a44', 'cloth'); for (const [x, y] of [[4, 11], [12, 11]]) { B.blob(x, y, 3.4, 2.8, cm, { power: 2 }); B.plot(x, y - 1, cm, 4); }
        } else if (kind === 'sprout') {
          const sm = P.mat('#6a9a3a', 'cloth'); for (const x of [3, 8, 13]) { B.plot(x, 12, sm, 3); B.plot(x - 1, 11, sm, 4); B.plot(x + 1, 11, sm, 3); }
        }
        ox = 8; oy = 15; propCache.set(key, { canvas: B.toCanvas({ ao: false }), ox, oy, W: 16, H: 16 }); return propCache.get(key);
      }
      case 'banner': {
        B = new MB(10, 30); B.part(1); B.capsule(2, 29, 2, 2, 0.9, 0.9, wood);
        B.part(2); const bm = P.mat(C.madder); B.poly([[3, 3], [9, 3], [9, 16], [6, 13], [3, 16]], [0, 0, 1], bm); for (let y = 3; y < 15; y++) B.shadeAt(8, y, 1); B.plot(5, 7, P.mat(P.metal.gold, 'metal'), 3); B.plot(6, 8, P.mat(P.metal.gold, 'metal'), 3); B.plot(5, 9, P.mat(P.metal.gold, 'metal'), 3);
        ox = 2; oy = 29; break;
      }
      case 'boat': {
        B = new MB(40, 18); B.part(1); const hull = P.mat('#6a4a30', 'wood');
        B.poly([[1, 6], [39, 6], [34, 15], [6, 15]], (px, py) => [0, (py - 10) / 6, 0.9], hull);
        for (let x = 2; x < 38; x++) { B.shadeAt(x, 6, 4); B.shadeAt(x, 7, 3); if (B.matAt(x, 11) === hull) B.shadeAt(x, 11, 1); }
        B.part(2); B.rect(6, 4, 28, 3, P.mat('#4a3424', 'wood'), 1); for (let x = 9; x < 32; x += 7) B.rect(x, 5, 2, 2, P.mat(P.wood.pine, 'wood'), 3);
        B.part(3); B.capsule(14, 9, 28, 3, 0.6, 0.6, P.mat(P.wood.pine, 'wood'));
        ox = 20; oy = 16; break;
      }
      case 'wallH': { // curtain wall running east-west: face below, walkway and merlons on top
        const sm = v === 1 ? M.stoneNorth() : M.stoneWarm();
        B = new MB(16, 44); B.part(1);
        B.rect(0, 14, 16, 30, sm, 2);
        for (let y = 14; y < 44; y++) for (let x = 0; x < 16; x++) { const r = (y - 14) % 6, off = Math.floor((y - 14) / 6) % 2 ? 4 : 0; B.shadeAt(x, y, r === 5 || (x + off) % 8 === 0 ? 0 : r === 0 ? 3 : y > 38 ? 1 : 2); }
        B.part(2); B.rect(0, 4, 16, 10, sm, 3); for (let x = 0; x < 16; x++) { B.shadeAt(x, 4, 4); B.shadeAt(x, 13, 1); if ((x >> 2) % 2 === 0) { B.plot(x, 2, sm, 4); B.plot(x, 3, sm, 3); } }
        for (let x = 0; x < 16; x++) if ((x >> 2) % 2 === 0) { B.plot(x, 12, sm, 3); B.plot(x, 11, sm, 4); }
        if (seed % 5 === 0) { B.part(3); B.rect(6, 24, 3, 6, P.mat('#1c1418', 'cloth'), 0); } // arrow slit
        ox = 8; oy = 43; break;
      }
      case 'wallV': { // wall running north-south: seen from above as its walkway and merlons
        const sm = v === 1 ? M.stoneNorth() : M.stoneWarm();
        B = new MB(16, 30); B.part(1);
        B.rect(2, 0, 12, 30, sm, 3); for (let y = 0; y < 30; y++) { B.shadeAt(2, y, 4); B.shadeAt(13, y, 1); if ((y >> 2) % 2 === 0) { B.plot(1, y, sm, 4); B.plot(14, y, sm, 1); } }
        for (let y = 0; y < 30; y += 6) for (let x = 3; x < 13; x++) B.shadeAt(x, y, 2);
        ox = 8; oy = 29; break;
      }
      case 'tower': { // round tower with crenellated top
        const sm = v === 1 ? M.stoneNorth() : M.stoneWarm();
        B = new MB(36, 64); B.part(1);
        B.shape(2, 14, 34, 63, (px, py) => Math.abs(px - 18) <= 15 && py > 14, (px) => { const nx = (px - 18) / 16; return [nx, 0, Math.sqrt(Math.max(0.05, 1 - nx * nx))]; }, sm);
        for (let y = 15; y < 64; y++) for (let x = 3; x < 34; x++) if (B.matAt(x, y) === sm) { const r = (y - 15) % 6, off = Math.floor((y - 15) / 6) % 2 ? 3 : 0; if (r === 5 || (x + off) % 7 === 0) B.tweak(x, y, -1); }
        B.part(2); B.blob(18, 13, 16, 6, sm, { power: 2 }); B.blob(18, 12, 12, 4, P.mat('#5a5048', 'cloth'), { power: 2 });
        for (let a = 0; a < 12; a++) { const x = 18 + Math.cos((a / 12) * Math.PI * 2) * 15, y = 12 + Math.sin((a / 12) * Math.PI * 2) * 5.5; if (a % 2 === 0) B.rect(Math.round(x) - 1, Math.round(y) - 4, 3, 4, sm, y > 12 ? 2 : 4); }
        B.part(3); for (const yy of [26, 42]) B.rect(17, yy, 2, 6, P.mat('#1c1418', 'cloth'), 0);
        if (v === 2) { B.part(4); B.capsule(18, 6, 18, -8, 0.6, 0.6, M.beam()); B.poly([[19, -8], [29, -5], [19, -2]], [0, 0, 1], P.mat(C.madder)); }
        ox = 18; oy = 63; break;
      }
      case 'gatearch': { // gateway arch over the road, portcullis raised; tall enough for a rider
        const sm = v === 1 ? M.stoneNorth() : M.stoneWarm();
        B = new MB(48, 76); B.part(1);
        B.rect(0, 12, 48, 64, sm, 2);
        for (let y = 12; y < 76; y++) for (let x = 0; x < 48; x++) { const r = (y - 12) % 6, off = Math.floor((y - 12) / 6) % 2 ? 4 : 0; B.shadeAt(x, y, r === 5 || (x + off) % 8 === 0 ? 0 : r === 0 ? 3 : 2); }
        // the arch opening (cleared) — the road runs through it
        for (let y = 18; y < 76; y++) for (let x = 0; x < 48; x++) { const dx = Math.abs(x - 23.5); if (dx < 15 && (y > 32 || Math.hypot(dx, (y - 32) * 1.2) < 15)) B.clear(x, y); }
        // voussoirs: darker stones ringing the arch
        for (let y = 12; y < 40; y++) for (let x = 0; x < 48; x++) { const dx = Math.abs(x - 23.5), r = Math.hypot(dx, (y - 32) * 1.2); if (r >= 15 && r < 18 && B.matAt(x, y) >= 0 && y < 33) B.shadeAt(x, y, (Math.round(Math.atan2(y - 32, x - 23.5) * 4) & 1) ? 1 : 2); }
        for (let x = 9; x < 39; x += 3) for (let y = 18; y < 23; y++) if (B.matAt(x, y) < 0) B.plot(x, y, P.mat(P.metal.darkIron, 'metal'), 1);
        B.part(2); B.rect(0, 6, 48, 6, sm, 3); for (let x = 0; x < 48; x++) { B.shadeAt(x, 6, 4); if ((x >> 2) % 2 === 0) { B.plot(x, 4, sm, 4); B.plot(x, 5, sm, 3); } }
        B.plot(23, 9, P.mat(P.metal.gold, 'metal'), 4); B.plot(24, 9, P.mat(P.metal.gold, 'metal'), 3); B.plot(23, 10, P.mat(C.madder), 2); B.plot(24, 10, P.mat(C.madder), 2);
        ox = 24; oy = 75; break;
      }
      case 'noticeboard': {
        B = new MB(24, 30); B.part(1); B.capsule(3, 29, 3, 6, 1, 1, wood); B.capsule(21, 29, 21, 6, 1, 1, wood);
        B.part(2); B.rect(1, 4, 22, 16, P.mat('#7a5a3a', 'wood'), 2); for (let x = 1; x < 23; x++) { B.shadeAt(x, 4, 3); B.shadeAt(x, 19, 1); }
        B.rect(0, 2, 24, 2, P.mat(P.wood.dark, 'wood'), 3);
        B.part(3); const paper = P.mat('#ece2c8', 'cloth');
        for (const [x, y, w, h] of [[3, 6, 6, 7], [10, 7, 5, 6], [16, 6, 5, 8], [5, 14, 7, 4]]) { B.rect(x, y, w, h, paper, 3); for (let yy = y + 1; yy < y + h - 1; yy += 2) for (let xx = x + 1; xx < x + w - 1; xx++) if ((xx + yy) % 3) B.shadeAt(xx, yy, 1); }
        B.plot(12, 7, P.mat('#a8382f', 'cloth'), 3);
        ox = 12; oy = 29; break;
      }
      case 'gravestone': {
        B = new MB(10, 14); B.part(1); B.shape(1, 1, 9, 13, (px, py) => py > 4 ? Math.abs(px - 5) < 3.6 : (px - 5) ** 2 + (py - 4.5) ** 2 < 13, (px) => [(px - 5) / 4, 0, 0.8], stone);
        B.plot(5, 5, stone, 0); B.plot(4, 6, stone, 0); B.plot(5, 6, stone, 0); B.plot(6, 6, stone, 0); B.plot(5, 7, stone, 0);
        ox = 5; oy = 13; break;
      }
      case 'memorial': { // a raised cross on a stepped plinth with a carved plaque, for the notable dead
        const sw = M.stoneWarm();
        B = new MB(18, 34); B.part(1);
        B.rect(0, 28, 18, 6, sw, 2); for (let x = 0; x < 18; x++) { B.shadeAt(x, 28, 4); B.shadeAt(x, 33, 1); }
        B.rect(2, 23, 14, 5, sw, 2); for (let x = 2; x < 16; x++) B.shadeAt(x, 23, 4); B.shadeAt(2, 25, 3); B.shadeAt(15, 25, 1);
        B.part(2); B.rect(7, 4, 4, 19, sw, 2); for (let y = 4; y < 23; y++) { B.shadeAt(7, y, 3); B.shadeAt(10, y, 1); }
        B.rect(3, 8, 12, 4, sw, 2); for (let x = 3; x < 15; x++) { B.shadeAt(x, 8, 4); B.shadeAt(x, 11, 1); }
        B.rect(7, 3, 4, 1, sw, 4);
        B.part(3); const brass = P.mat(P.metal.brass, 'metal'); B.rect(5, 24, 8, 3, brass, 3); for (let x = 6; x < 12; x += 2) B.plot(x, 25, brass, 1);
        if (v === 1) { const fl = P.mat(C.madder); B.plot(3, 27, fl, 3); B.plot(4, 26, P.mat('#5a8a3a', 'cloth'), 2); B.plot(14, 27, P.mat('#e8d860', 'cloth'), 3); }
        ox = 9; oy = 33; break;
      }
      default: B = new MB(4, 4); ox = 2; oy = 3;
    }
    const out = { canvas: B.toCanvas(), ox, oy, W: B.w, H: B.h };
    propCache.set(key, out);
    return out;
  }

  // Gang hideouts grow in place: a hidden camp, a lean-to hideout, a log safehouse, a timber hall.
  function hideout(level, spec) {
    if (level >= 1) {
      const sp = Object.assign({}, spec, level === 1 ? { wall: 'plank', plankMat: 'plank', roof: 'thatch', roofType: 'side', chimney: false, wallH: 22, condition: 0.5 } : level === 2 ? { wall: 'log', roof: 'shingle', roofType: 'gable', chimney: true, condition: 0.75 } : { wall: 'log', roof: 'shingle', roofType: 'gable', chimney: true, floors: 2, condition: 0.9, sign: 'sword' });
      return building(sp);
    }
    // level 0: a canvas tent, a campfire ring, a bedroll and a stash chest
    const w = spec.w, OV = 4, FW = w * T, W = FW + OV * 2, H = spec.d * T + 30;
    const B = new MB(W, H);
    const canvasM = P.mat('#b0a078', 'cloth'), pole = M.beam(), stone = M.stoneDark();
    B.part(2);
    const base = H - 6, apexY = base - 24, cx = 18;
    B.poly([[cx - 16, base], [cx, apexY], [cx + 1, apexY], [cx + 1, base]], [-0.6, -0.3, 0.7], canvasM);
    B.poly([[cx + 1, apexY], [cx + 16, base], [cx + 1, base]], [0.5, -0.3, 0.75], canvasM);
    for (let y = apexY; y < base; y++) { B.plot(cx, y, pole, 2); if ((y - apexY) % 5 === 0) for (let x = cx - 14; x < cx + 15; x++) if (B.matAt(x, y) === canvasM) B.tweak(x, y, -1); }
    B.part(6); B.poly([[cx - 4, base], [cx + 1, base - 13], [cx + 5, base]], [0, 0, 1], P.mat('#2a2024', 'cloth'), { maxShade: 0 });
    B.part(3); // fire ring
    const fx = W - 14, fy = base - 2;
    for (let a = 0; a < 10; a++) B.blob(fx + Math.cos(a / 10 * 6.28) * 5, fy + Math.sin(a / 10 * 6.28) * 2.2, 1.3, 1, stone, { power: 2 });
    B.capsule(fx - 3, fy, fx + 3, fy - 1, 0.9, 0.9, M.log()); B.capsule(fx - 2, fy - 1, fx + 3, fy + 1, 0.9, 0.9, M.log());
    B.part(4); B.rect(2, base + 1, 10, 3, P.mat('#6a5a3a', 'cloth'), 2); // bedroll
    const out = { canvas: B.toCanvas(), W, H, OV, windows: [], door: null, chimney: { x: fx - OV + OV, y: fy - 4 - (H - (H)) }, sign: null, wallTop: H, roofMask: null, campfire: { x: fx, y: fy } };
    out.chimney = { x: fx, y: fy - 3 };
    return out;
  }

  // A burned-out shell: the walls stand to a ragged, blackened edge, the openings gape, a few charred
  // rafters lean against the sky, and the floor is a heap of ash and fallen timber.
  function ruin(spec) {
    const fin = spec._fin || (spec._fin = building(spec)), FB = fin.buf, W = fin.W, H = fin.H;
    const B = new MB(W, H), x0 = fin.x0, x1 = fin.x1, wallTop = fin.wallTop, foot = spec.d * T;
    const char = P.mat('#2a2226', 'cloth'), soot = P.mat('#4a3e3c', 'cloth'), ash = P.mat('#6e6460', 'cloth'), ember = P.mat('#c8642a', 'metal'), beam = P.mat('#2e2420', 'wood');
    // ash and rubble over the footprint
    const dirt = P.mat('#7a6a56', 'cloth'), ashL = P.mat('#9a928a', 'cloth');
    B.part(0); for (let y = H - foot; y < H; y++) for (let x = x0 - 1; x <= x1 + 1; x++) { const n = O.noise2(x * 0.35, y * 0.35, spec.seed % 97), f = O.noise2(x * 1.3, y * 1.3, 5); B.plot(x, y, n > 0.78 ? char : n > 0.55 ? soot : n > 0.3 ? ashL : dirt, f > 0.8 ? 3 : f < 0.2 ? 1 : 2); }
    // the back and side walls still stand around the burnt floor, ragged and sooty
    let wallMat = null; for (let i = FB.mat.length - 1; i >= 0 && wallMat == null; i--) if (FB.mat[i] >= 0 && FB.group[i] === 1) wallMat = FB.mat[i];
    if (wallMat != null) {
      B.part(1);
      const fy = H - foot;
      for (let x = x0; x <= x1; x++) {
        const h = Math.round(5 + 14 * O.noise2(x * 0.15, 9.1, spec.seed % 53));
        for (let y = fy - h; y <= fy + 1; y++) { const sootY = y - (fy - h); B.plot(x, y, sootY < 3 || O.noise2(x * 0.7, y * 0.7, 21) > 0.75 ? soot : wallMat, y === fy - h ? 3 : y >= fy ? 1 : 2); }
      }
      for (let y = fy; y < H - 2; y++) for (const sx of [x0, x0 + 1, x1 - 1, x1]) B.plot(sx, y, O.noise2(sx, y * 0.5, 4) > 0.7 ? soot : wallMat, sx <= x0 + 1 ? 3 : 1);
    }
    // fallen timbers lying across the floor
    { const r2 = O.RNG(spec.seed + 11); B.part(0); for (let k = 0; k < 4; k++) { const y = H - foot + 4 + r2.int(0, Math.max(1, foot - 10)), xa = r2.int(x0, x1 - 10), len = r2.int(10, 26); for (let x = xa; x < Math.min(x1, xa + len); x++) { const yy = y + Math.round((x - xa) * r2.float(-0.15, 0.15)); B.plot(x, yy, beam, 3); B.plot(x, yy + 1, char, 1); } } }
    // walls: everything below a ragged burn line survives, scorched toward the top
    const span = Math.max(4, (H - 3) - wallTop);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x; if (FB.mat[i] < 0) continue; const g = FB.group[i];
      if (g === 2 || g === 3 || g === 5) continue; // roof, chimney top, sign: gone
      const edge = wallTop + span * (0.25 + 0.45 * O.noise2(x * 0.18, 3.7, spec.seed % 31)) + (O.noise2(x * 0.9, 1.1, 7) > 0.75 ? 4 : 0);
      if (y < edge) continue;
      const scorch = (y - edge) / Math.max(1, H - edge);
      B.part(g === 6 ? 6 : 1);
      if (g === 6) B.plot(x, y, char, 0); // windows and door burnt out to black holes
      else if (scorch < 0.1 || O.noise2(x * 0.6, y * 0.6, 13) > 0.3 + scorch * 0.9) B.plot(x, y, scorch < 0.05 ? char : soot, Math.max(0, FB.shade[i] - 2)); // soot thickest near the burnt edge
      else B.plot(x, y, FB.mat[i], Math.max(0, FB.shade[i] - 1));
    }
    // charred rafters leaning in
    B.part(7);
    const r = O.RNG(spec.seed + 5);
    for (let k = 0; k < 3; k++) { const bx = r.int(x0 + 4, x1 - 4), by = H - 4 - r.int(0, foot / 2), tx = bx + r.int(-14, 14), ty = Math.max(2, wallTop - r.int(0, 10)); B.capsule(bx, by, tx, ty, 1, 0.8, beam); }
    // a few embers still glowing in the ash
    B.part(9); for (let k = 0; k < 6; k++) B.plot(r.int(x0, x1), H - 2 - r.int(0, foot - 3), ember, 4);
    return Object.assign({}, fin, { canvas: B.toCanvas(), windows: [], chimney: null, roofMask: null, sign: null, ruined: true });
  }

  O.Env = { building, staged, hideout, tree, prop, ruin, T, M };
})();
