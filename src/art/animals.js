// Animal sprites in the same material raster. Every animal is one rig, spine, neck, head, four
// legs (two for a hen), tail, posed in body space and projected to any of eight facings, the same
// way people are. Seen from the front you get the head and chest with the hindquarters behind; from
// the back, the rump and tail with the head beyond. Gaits are real: a four-beat walk and a gallop
// whose legs gather and stretch, with the body pitching over them.
'use strict';
(function () {
  const P = O.Pal, MB = O.MatBuffer;
  const COATS = {
    bay: { body: '#8a4a26', mane: '#2a1c18', legs: '#2a1c18' }, chestnut: { body: '#a0582c', mane: '#7a3a1c', legs: '#8a4a26' },
    black: { body: '#2e2828', mane: '#1c1818', legs: '#1c1818' }, grey: { body: '#a8a8a4', mane: '#e0ddd4', legs: '#6e6c6a' },
    dun: { body: '#b8965e', mane: '#3a2a1c', legs: '#3a2a1c' }, palomino: { body: '#d2a856', mane: '#f0e6c8', legs: '#c89a4a' },
    white: { body: '#e6e2d8', mane: '#f4f0e6', legs: '#d4cfc2' }, piebald: { body: '#2e2828', mane: '#1c1818', legs: '#e6e2d8', patches: '#e6e2d8' },
  };
  const HANIMS = { idle: { frames: 4, fps: 1.5 }, graze: { frames: 4, fps: 1.2 }, walk: { frames: 8, fps: 8 }, gallop: { frames: 8, fps: 14 } };
  const K = 0.38;
  const VIEW = { 0: [0, false], 1: [90, true], 2: [90, false], 3: [180, false], 4: [40, false], 5: [40, true], 6: [140, false], 7: [140, true] };

  // Proportions per species (pixels; y is up from the ground as negative numbers; z forward).
  const SPEC = {
    horse: { W: 64, H: 60, G: 52, spine: [[-11.5, -19.5, 6.9], [-1.5, -19, 7.8], [8.6, -20, 7.1]], hipX: 3.5, hipZ: -9.6, shZ: 8.4, hipY: -17, upper: 7, lower: 9.4, legR: [2.7, 1.6], hoof: 1.6,
      neck: [[0, -23, 10.5], [0, -33, 15.2]], neckR: [5, 3.4], head: [[0, -34.6, 15.4], [0, -28.2, 22]], headR: [3.7, 2.6], ears: [1.5, -39.2, 14.8, 'tall'], eye: [2.6, -34, 17], tail: [[0, -24, -12.6], [0, -11, -15.5]], tailR: [1.7, 2.3], mane: true },
    cow: { W: 56, H: 46, G: 39, spine: [[-11, -16.5, 6.6], [-1, -16, 7.4], [8.5, -16.5, 6.8]], hipX: 3.2, hipZ: -9, shZ: 8, hipY: -14.5, upper: 6, lower: 7.6, legR: [2.2, 1.4], hoof: 1.4,
      neck: [[0, -18, 10.5], [0, -20.5, 14]], neckR: [4.6, 3.6], head: [[0, -21.5, 14.5], [0, -16, 18.6]], headR: [3.6, 2.8], ears: [3.2, -21.6, 14, 'side'], horns: true, eye: [2.6, -20.5, 16], tail: [[0, -20.5, -12.5], [0, -8, -13.5]], tailR: [0.8, 1.1], udder: true },
    sheep: { W: 38, H: 34, G: 28, spine: [[-5.5, -10.5, 5], [0, -11, 5.6], [5, -11, 5]], hipX: 2.2, hipZ: -4.6, shZ: 4.4, hipY: -8, upper: 3.8, lower: 4.4, legR: [1.1, 0.9], hoof: 1,
      neck: [[0, -12, 6], [0, -14, 8]], neckR: [3, 2.4], head: [[0, -14.5, 8.2], [0, -11.5, 11]], headR: [2.4, 1.7], ears: [2.4, -14.6, 8, 'side'], eye: [1.6, -13.6, 9.4], tail: [[0, -11, -6.5], [0, -8, -7.4]], tailR: [1.1, 1], wool: true },
    pig: { W: 38, H: 30, G: 25, spine: [[-6, -8.5, 4.4], [0, -8.8, 5], [6, -8.6, 4.5]], hipX: 2, hipZ: -5, shZ: 5, hipY: -6.5, upper: 2.8, lower: 3.4, legR: [1.3, 1], hoof: 0.9,
      neck: [[0, -9.5, 7.5], [0, -9.5, 8.5]], neckR: [3.6, 3.2], head: [[0, -10, 8.8], [0, -8.6, 12.5]], headR: [3.2, 2.2], ears: [1.8, -13, 8.6, 'flop'], eye: [1.7, -11, 10.4], tail: [[0, -10, -10], [0, -11.5, -11]], tailR: [0.6, 0.6], snout: true },
    dog: { W: 34, H: 30, G: 25, spine: [[-5.5, -10, 3.2], [0, -10.2, 3.4], [5, -11, 3.6]], hipX: 1.6, hipZ: -5, shZ: 4.6, hipY: -9, upper: 4.6, lower: 4.6, legR: [1.1, 0.8], hoof: 0.8,
      neck: [[0, -12, 5.5], [0, -15, 7.5]], neckR: [2.4, 2], head: [[0, -16, 7.8], [0, -14.6, 11.2]], headR: [2.5, 1.5], ears: [1.5, -18, 7.2, 'drop'], eye: [1.4, -16.6, 9.2], tail: [[0, -11.5, -8.5], [0, -16, -11]], tailR: [0.9, 0.6] },
    cat: { W: 30, H: 26, G: 22, spine: [[-4.5, -7.5, 2.6], [0, -7.8, 2.8], [4, -8, 2.7]], hipX: 1.3, hipZ: -4, shZ: 3.8, hipY: -6.5, upper: 3.4, lower: 3.4, legR: [0.9, 0.7], hoof: 0.7,
      neck: [[0, -9, 4.6], [0, -11, 5.6]], neckR: [2, 1.8], head: [[0, -11.6, 6], [0, -11, 7.6]], headR: [2.4, 1.8], ears: [1.4, -14.4, 5.8, 'point'], eye: [1.1, -12, 7.2], tail: [[0, -8.5, -6.5], [0, -15, -9]], tailR: [0.8, 0.7] },
    chicken: { W: 20, H: 22, G: 18, biped: true, spine: [[-2.6, -6.6, 2.8], [0, -6.8, 3.4], [2.2, -7.4, 2.8]], hipX: 0.9, hipZ: 0, hipY: -4, upper: 2, lower: 2.2, legR: [0.5, 0.45], hoof: 0,
      neck: [[0, -8.5, 2.4], [0, -11, 3.3]], neckR: [1.7, 1.4], head: [[0, -11.6, 3.4], [0, -11.4, 4.2]], headR: [1.6, 1.3], eye: [1, -12, 4], tail: [[0, -8, -2.6], [0, -11, -4.4]], tailR: [1.4, 0.9], beak: true, comb: true },
  };

  function view(dir) {
    const [deg, mirror] = VIEW[dir] || VIEW[0];
    const a = (deg * Math.PI) / 180, Fx = Math.sin(a), Fz = -Math.cos(a);
    return { Fx, Fz, Rx: Fz, Rz: -Fx, mirror };
  }

  // Leg swing per gait: [phase offset, amplitude, knee bend] for LH, LF, RH, RF
  function legAngles(anim, t, kind) {
    const quick = kind === 'chicken' || kind === 'cat' || kind === 'dog';
    if (anim === 'walk') {
      const ph = { LH: 0, LF: 0.25, RH: 0.5, RF: 0.75 }, A = quick ? 0.5 : 0.34, Bk = quick ? 1 : 0.95;
      const o = {}; for (const k in ph) { const s = (t + ph[k]) * Math.PI * 2; o[k] = [A * Math.sin(s), Bk * Math.max(0, Math.cos(s)) ** 2]; } return o;
    }
    if (anim === 'gallop') {
      const ph = { LH: 0, RH: 0.1, LF: 0.45, RF: 0.55 }, A = 0.72, Bk = 1.4;
      const o = {}; for (const k in ph) { const s = (t + ph[k]) * Math.PI * 2; o[k] = [A * Math.sin(s), Bk * Math.max(0, Math.cos(s)) ** 1.5]; } return o;
    }
    return { LH: [0, 0.05], LF: [0, 0.05], RH: [0, 0.05], RF: [0, 0.05] };
  }

  // Build every part of the animal in body space, project, depth-sort, rasterise.
  function build(kind, look, dir, anim, f, layers) {
    const S = SPEC[kind], V = view(dir);
    const B = new MB(S.W, S.H); B.mirror = V.mirror;
    const n = HANIMS[anim]?.frames || 1, t = f / n;
    const cx = S.W / 2, G = S.G;
    const pj = (p) => { const wx = p[0] * V.Rx + p[2] * V.Fx, wz = p[0] * V.Rz + p[2] * V.Fz; return [cx + wx, G + p[1] - wz * K, wz]; };
    const parts = [];
    const cap = (a, b, ra, rb, mat, grp, opt) => parts.push({ kind: 'cap', a, b, ra, rb, mat, grp, opt, d: (pj(a)[2] + pj(b)[2]) / 2 + (opt?.dz || 0) });
    // pitch and bob
    const gal = anim === 'gallop', walk = anim === 'walk';
    const s2 = Math.sin(t * Math.PI * 2);
    const pitch = gal ? s2 * 1.2 : 0, bob = gal ? -Math.abs(Math.cos(t * Math.PI * 2)) * 1.5 : walk ? -(f % 2) * 0.5 : 0;
    const grazing = anim === 'graze';
    const sp = S.spine.map(([z, y, r]) => [0, y + bob + pitch * (z / 10), z, r]);
    for (let i = 0; i < sp.length - 1; i++) cap(sp[i].slice(0, 3), sp[i + 1].slice(0, 3), sp[i][3], sp[i + 1][3], look.body, 2, { body: true });
    // legs
    const ang = legAngles(anim, t, kind);
    const legsDef = S.biped ? [['LH', -1, S.hipZ], ['RH', 1, S.hipZ]] : [['LH', -1, S.hipZ], ['RH', 1, S.hipZ], ['LF', -1, S.shZ], ['RF', 1, S.shZ]];
    const feet = [];
    for (const [k, sx, z] of legsDef) {
      const [sw, bend] = ang[k];
      const yz = S.hipY + bob + pitch * (z / 10);
      const hip = [sx * S.hipX, yz, z];
      const knee = [hip[0], hip[1] + Math.cos(sw) * S.upper, hip[2] + Math.sin(sw) * S.upper];
      const la = sw - bend * (k.endsWith('F') ? 1 : 0.7);
      let foot = [knee[0], knee[1] + Math.cos(la) * S.lower, knee[2] + Math.sin(la) * S.lower];
      feet.push({ k, hip, knee, foot });
    }
    // the lowest hoof rests on the ground; the body rides above it
    const low = Math.max(...feet.map((q) => q.foot[1]));
    const lift = -0.6 - low; // y of the ground is 0 in body space
    const sh = (p) => [p[0], p[1] + lift, p[2]];
    for (const pt of parts) { pt.a = sh(pt.a); pt.b = sh(pt.b); }
    for (const q of feet) {
      const hip = sh(q.hip), knee = sh(q.knee), foot = sh(q.foot);
      const legMat = (u) => (look.socks && q.k.endsWith('F') === false && u > 0.45 ? look.white : look.legs);
      cap(hip, knee, S.legR[0], (S.legR[0] + S.legR[1]) / 2, look.upperLeg || look.body, 3, { leg: q.k });
      cap(knee, foot, (S.legR[0] + S.legR[1]) / 2 * 0.8, S.legR[1], (u) => (S.hoof && u > 0.86 ? look.hoof : legMat(u)), 3, { leg: q.k });
      if (S.biped) cap(foot, [foot[0], foot[1], foot[2] + 1.4], 0.45, 0.4, look.legs, 3, { leg: q.k });
    }
    // neck and head (grazing lowers the head to the grass)
    const nod = anim === 'idle' && f === 2 ? 0.8 : 0;
    const graze = grazing ? 1 : 0;
    const dropY = graze * (S.neck[1][1] * -0.75), fwdZ = graze * 2;
    const n0 = sh([0, S.neck[0][1] + bob + pitch, S.neck[0][2]]), n1 = sh([0, S.neck[1][1] + bob + nod + dropY + pitch * 1.4, S.neck[1][2] + fwdZ]);
    cap(n0, n1, S.neckR[0], S.neckR[1], look.body, 4, { neck: true });
    const hd = [S.head[0][1] + bob + nod + dropY + pitch * 1.4, S.head[1][1] + bob + nod + dropY + pitch * 1.4 + graze * 2.5];
    const h0 = sh([0, hd[0], S.head[0][2] + fwdZ]), h1 = sh([0, hd[1], S.head[1][2] + fwdZ - graze]);
    cap(h0, h1, S.headR[0], S.headR[1], look.head || look.body, 5, { head: true, dz: -0.3 });
    // tail
    const swish = anim === 'idle' || grazing ? (f % 2 ? 1.2 : -0.6) : walk ? s2 * 1.4 : gal ? 0 : 0;
    const tl0 = sh([0, S.tail[0][1] + bob - pitch, S.tail[0][2]]), tl1 = sh([swish, S.tail[1][1] + bob - pitch + (gal ? -6 : 0), S.tail[1][2] + (gal ? -4 : 0)]);
    cap(tl0, tl1, S.tailR[0], S.tailR[1], look.mane || look.body, 6, { tail: true });

    // sort far to near and draw
    const front = []; // near parts kept for the rider sandwich
    parts.sort((x, y) => y.d - x.d);
    const saddleD = 0.2;
    const drawPart = (pt, Bf) => {
      Bf.part(pt.grp + (pt.d > 1.5 && pt.opt?.leg ? 10 : 0));
      const a = pj(pt.a), b = pj(pt.b);
      Bf.capsule(a[0], a[1], b[0], b[1], pt.ra, pt.rb, pt.mat, { shadeBias: pt.opt?.leg && pt.d > 1.5 ? -1 : 0 });
    };
    for (const pt of parts) { if (layers && pt.d < saddleD - 2.5 && !pt.opt?.body) { front.push(pt); continue; } drawPart(pt, B); }

    // details: coat texture, patches, wool, mane, ears, eyes, muzzle
    const detailHead = (Bt) => {
      const headFacing = (sx) => { const nz = sx * V.Rz + 0.35 * V.Fz; return nz < 0.25; };
      // ears
      if (S.ears) {
        const [ex, ey, ez, style] = S.ears;
        for (const sx of [-1, 1]) {
          const e0 = pj(sh([sx * ex, ey + (hd[0] - S.head[0][1]), ez + fwdZ])); const tip = style === 'tall' ? [0, -2.4, -0.3] : style === 'point' ? [0, -2, 0] : style === 'flop' ? [sx * 0.8, 1, 1.4] : style === 'drop' ? [sx * 0.6, 2.4, 0.3] : [sx * 2, 0.6, -0.5];
          const e1 = pj(sh([sx * ex + tip[0], ey + tip[1] + (hd[0] - S.head[0][1]), ez + tip[2] + fwdZ]));
          Bt.part(7); Bt.capsule(e0[0], e0[1], e1[0], e1[1], kind === 'horse' ? 1 : 0.8, 0.5, look.ear || look.head || look.body);
        }
      }
      if (S.horns) for (const sx of [-1, 1]) { const a = pj(sh([sx * 1.6, hd[0] - 1.6, S.head[0][2] + 0.4])), b = pj(sh([sx * 3.4, hd[0] - 3.2, S.head[0][2] + 0.2])); Bt.part(7); Bt.capsule(a[0], a[1], b[0], b[1], 0.7, 0.4, look.horn); }
      // eyes on whichever side faces us
      if (S.eye) for (const sx of [-1, 1]) {
        if (!headFacing(sx)) continue;
        const e = pj(sh([sx * S.eye[0], S.eye[1] + (hd[0] - S.head[0][1]), S.eye[2] + fwdZ]));
        Bt.plot(e[0], e[1], look.eyeM, 0, 1); if (kind === 'horse' || kind === 'cow') Bt.plot(e[0], e[1] - 1, look.eyeM, 1, 1);
      }
      // muzzle: nostrils, snout, beak, blaze
      const m = pj(h1);
      if (S.snout) { Bt.part(8); Bt.blob(m[0], m[1], 1.5, 1.2, look.snout, { power: 2 }); if (V.Fz < 0) { Bt.plot(m[0] - 0.5, m[1], look.eyeM, 1, 1); Bt.plot(m[0] + 0.5, m[1], look.eyeM, 1, 1); } }
      if (S.beak) { const tip = pj(sh([0, hd[1] + 0.4, S.head[1][2] + 1.6])); Bt.part(8); Bt.capsule(m[0], m[1], tip[0], tip[1], 0.6, 0.35, look.beak); }
      if (S.comb) { const c0 = pj(sh([0, hd[0] - 1.6, S.head[0][2]])); Bt.part(8); Bt.capsule(c0[0], c0[1], c0[0], c0[1] - 0.8, 0.8, 0.6, look.comb); const w = pj(sh([0, hd[1] + 1.6, S.head[1][2]])); Bt.plot(w[0], w[1], look.comb, 2); }
      if ((kind === 'horse' || kind === 'cow') && V.Fz < 0.3) { const nn = pj(sh([0, hd[1] + 0.6, S.head[1][2] + 1.6 + fwdZ])); Bt.tweak(nn[0] - 1, nn[1], -2); Bt.tweak(nn[0] + 1, nn[1], -2); }
      if (look.blaze && V.Fz < 0.6) { for (let k = 0; k <= 6; k++) { const q = pj(sh([0, hd[0] - 1 + (hd[1] - hd[0] + 1) * (k / 6), S.head[0][2] + 1.6 + (S.head[1][2] - S.head[0][2]) * (k / 6) + fwdZ])); if (Bt.get(Math.floor(q[0]), Math.floor(q[1])) === (look.head || look.body)) Bt.plot(q[0], q[1], look.white, 3); } }
    };
    // mane: a crest of hair along the top of the neck, and a forelock
    const mane = (Bt) => {
      if (!S.mane) return;
      Bt.part(9);
      const dy = n1[1] - n0[1], dz = n1[2] - n0[2], dl = Math.hypot(dy, dz) || 1, cy = -dz / dl, cz = dy / dl; // the crest of the neck
      for (let k = 0; k <= 8; k++) { const u = k / 8, r = S.neckR[0] + (S.neckR[1] - S.neckR[0]) * u - 0.4; const q = pj([0, n0[1] + dy * u + cy * r, n0[2] + dz * u + cz * r]), q2 = pj([0, n0[1] + dy * u + cy * (r - 1.6), n0[2] + dz * u + cz * (r - 1.6)]); Bt.capsule(q[0], q[1], q2[0], q2[1], 1.1, 0.8, look.mane); }
      const fl = pj([0, h0[1] - S.headR[0] + 0.5, h0[2] + 0.8]); Bt.capsule(fl[0], fl[1], fl[0], fl[1] + 1.6, 0.9, 0.6, look.mane);
    };
    const coat = (Bt) => {
      for (let y = 0; y < S.H; y++) for (let x = 0; x < S.W; x++) {
        const mm = Bt.matAt(x, y); if (mm !== look.body) continue;
        if (S.wool && (x * 3 + y * 5) % 5 === 0) Bt.shadeAt(x, y, Math.max(1, Bt.shade[y * S.W + x] - 1));
        if (look.patches && O.noise2(x / 5, y / 4, look.seed % 97) > 0.58) Bt.mat[y * S.W + x] = look.patches;
      }
    };
    coat(B); mane(B);
    const headNear = parts.find((x) => x.opt?.head);
    if (!layers || !front.includes(headNear)) detailHead(B);
    if (S.udder && V.Fz > -0.95) { const u = pj(sh([0, -9 + lift * 0, -4])); void u; }
    // saddle and bridle
    let seat = null;
    if (look.saddled) {
      const topY = Math.min(...sp.map((q) => q[1] - q[3])) + lift;
      const s0 = pj([0, topY + 0.6, 1.5]);
      seat = s0;
      B.part(12);
      const blanketPts = [[-5.2, -1.6], [5.2, -1.6], [5.6, 4.2], [-5.6, 4.2]];
      for (const sx of [-1, 1]) { const q0 = pj([sx * 6.2, topY + 2.5, -3]), q1 = pj([sx * 6.4, topY + 7.8, -3]), q2 = pj([sx * 6.4, topY + 7.8, 6]), q3 = pj([sx * 6.2, topY + 2.5, 6]); if ((q0[2] + q2[2]) / 2 < 3) B.poly([q0, q1, q2, q3].map((q) => [q[0], q[1]]), [sx * V.Rx * 0.8, 0, 0.6], look.blanket); }
      void blanketPts;
      B.blob(s0[0], s0[1], Math.hypot(4.6 * V.Fx, 3.4 * V.Rx), 2, look.leather, { power: 2.4 });
      const st = pj([V.Rz < 0 ? 6.4 : -6.4, topY + 9, 1.5]); B.capsule(s0[0], s0[1] + 1, st[0], st[1], 0.4, 0.4, look.leather); B.plot(st[0], st[1] + 1, look.iron, 3);
      const bm = pj([0, hd[1] - 0.5, S.head[1][2] - 0.8]), bp = pj([0, hd[0], S.head[0][2]]); B.capsule(bm[0], bm[1], bp[0], bp[1], 0.45, 0.45, look.leather);
    }
    const cv = B.toCanvas(); cv.ox = Math.floor(S.W / 2); cv.gy = G;
    if (!layers) return cv;
    // the near parts (head and neck coming toward us, near legs) drawn on their own layer
    const Bf = new MB(S.W, S.H); Bf.mirror = V.mirror;
    for (const pt of front) drawPart(pt, Bf);
    mane(Bf); if (front.includes(headNear)) detailHead(Bf);
    const fc = Bf.toCanvas({ outline: true });
    cv.front = fc; cv.seat = seat; return cv;
  }

  function horseLook(h) {
    const c = COATS[h.coat] || COATS.bay;
    return {
      seed: h.seed || h.id || 1, body: P.mat(c.body, 'hair'), mane: P.mat(c.mane, 'hair'), legs: P.mat(c.legs, 'hair'), upperLeg: P.mat(c.body, 'hair'), hoof: P.mat('#2a2420', 'cloth'),
      white: P.mat('#ece8de', 'hair'), patches: c.patches ? P.mat(c.patches, 'hair') : null, eyeM: P.mat('#141014', 'cloth'), socks: h.socks, blaze: h.blaze,
      leather: P.mat(P.cloth.darkLeather), blanket: P.mat(h.blanket || P.cloth.madder), iron: P.mat(P.metal.iron, 'metal'), saddled: h.saddled,
    };
  }
  function smallLook(kind, seed) {
    const r = O.RNG(seed);
    const eyeM = P.mat('#1a1418', 'cloth');
    switch (kind) {
      case 'chicken': { const b = P.mat(r.pick(['#e8e2d4', '#8a5a34', '#2e2828', '#c8a060', '#b0603a']), 'hair'); return { seed, body: b, head: b, mane: P.mat(r.pick(['#2e2828', '#5a3a24', '#e8e2d4']), 'hair'), legs: P.mat('#d8a040', 'cloth'), hoof: P.mat('#d8a040', 'cloth'), eyeM, beak: P.mat('#e0b040', 'cloth'), comb: P.mat('#c83a2a', 'cloth') }; }
      case 'sheep': { const w = P.mat(r.pick(['#ece6d6', '#e6e0d0', '#d8d0bc', '#5a4a40']), 'hair'), d = P.mat('#3a3030', 'cloth'); return { seed, body: w, head: d, ear: d, legs: d, upperLeg: w, hoof: P.mat('#1e1818', 'cloth'), eyeM: P.mat('#d8c890', 'cloth'), mane: w }; }
      case 'cow': { const b = P.mat(r.pick(['#8a5a34', '#2e2828', '#c8a882', '#a0582c']), 'hair'); return { seed, body: b, head: b, legs: b, hoof: P.mat('#2a2420', 'cloth'), eyeM, mane: b, horn: P.mat('#e8e0c8', 'cloth'), patches: r.chance(0.6) ? P.mat('#ece8de', 'hair') : null, white: P.mat('#ece8de', 'hair'), blaze: r.chance(0.4) }; }
      case 'pig': { const b = P.mat(r.chance(0.8) ? '#e0a49a' : '#8a6a5a', 'skin'); return { seed, body: b, head: b, legs: b, hoof: P.mat('#6a4a40', 'cloth'), eyeM, mane: b, snout: P.mat('#c8807a', 'skin'), patches: r.chance(0.25) ? P.mat('#3a2e2a', 'skin') : null }; }
      case 'dog': { const b = P.mat(r.pick(['#8a6a44', '#2e2828', '#c8a060', '#e6e0d0', '#6a4a30']), 'hair'); return { seed, body: b, head: b, legs: b, hoof: b, eyeM, mane: b, ear: P.mat(r.pick(['#5a3a24', '#2e2828']), 'hair'), patches: r.chance(0.35) ? P.mat('#ece8de', 'hair') : null }; }
      default: { const b = P.mat(r.pick(['#e08a3a', '#2e2828', '#8a8a86', '#e6e0d0', '#6a5a4a']), 'hair'); return { seed, body: b, head: b, legs: b, hoof: b, eyeM: P.mat('#3a6a30', 'cloth'), mane: b, patches: r.chance(0.3) ? P.mat('#ece8de', 'hair') : null }; }
    }
  }

  const cache = new Map();
  function remember(key, make) { let c = cache.get(key); if (!c) { c = make(); cache.set(key, c); if (cache.size > 4000) cache.delete(cache.keys().next().value); } return c; }
  // horse frames carry a `front` layer and a `seat` point so a rider can sit between them
  function horse(h, dir, anim, f) {
    anim = anim in HANIMS ? anim : 'idle'; f %= HANIMS[anim].frames;
    return remember('h' + h.id + ':' + (h.saddled ? 1 : 0) + ':' + dir + anim + f, () => build('horse', horseLook(h), dir, anim, f, true));
  }
  // small animals: moving -> 8-frame walk, otherwise idle or (for grazers) grazing
  function animal(kind, seed, dir, moving, f, anim) {
    const an = anim || (moving ? 'walk' : 'idle'); f %= HANIMS[an].frames;
    return remember(kind + seed + ':' + dir + an + f, () => build(kind, smallLook(kind, seed), dir, an, f, false));
  }
  const HW = SPEC.horse.W, HH = SPEC.horse.H, HG = SPEC.horse.G;
  O.Animals = { horse, animal, COATS, HANIMS, HW, HH, HG, SPEC };
})();
