// A chimney on fire. Soot builds up in a flue, and one cold evening it catches: a roar like wind, a
// fountain of sparks and flame out of the chimney-top, burning flakes drifting down on the thatch next
// door. The household tumbles out into the lane; the neighbours run with buckets, one sets a ladder to
// the wall and goes up with a wet sack while the others hand the water up and fling it at the roof,
// and at last it chokes down to a thick black smoke, and everyone stands about coughing and telling
// the goodwife to get the sweep in.
'use strict';
(function () {
  const T = 16;
  function setup(game) {
    const cur = () => O.SimRef.cur;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    let C = null, cool = 400, fires = 0; const parts = [];
    const near = (x, y, r) => Math.hypot(x - game.player.x, y - game.player.y) < r;
    const talking = (q) => O.npcUI && O.npcUI.talking && O.npcUI.talking() === q;
    const able = (q) => q && q.alive !== false && q.agent && !q.agent.frozen && !q.errand && !q._chim && !q._bit && !q._scene && !talking(q);
    function rel(q) { if (!q || !q.agent) return; q.agent.forceAnim = null; q.agent.lift = 0; if (!talking(q)) q.agent.frozen = false; q._chim = false; }
    function end() { if (!C) return; for (const q of [...C.house, ...C.help]) rel(q); C = null; }
    game.hooks.update.push((dt) => {
      for (const p of parts.slice()) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += p.g * dt; if (p.t > p.life) parts.splice(parts.indexOf(p), 1); }
      const s = cur(); if (!s || !s.world || game.scene) return; const hr = s.minute / 60;
      if (C) { C.t += dt; if (C.s !== s || C.t > 90) { end(); return; } const [cx, cy] = C.top, k = C.t < 40 ? 1 : Math.max(0, 1 - (C.t - 40) / 15);
        // the fountain of sparks, then smoke
        for (let i = 0; i < (k > 0.3 ? 4 : 1); i++) if (Math.random() < 0.8) parts.push(k > 0.3 && C.t < 48 ? { x: cx + (Math.random() - 0.5) * 4, y: cy, vx: (Math.random() - 0.5) * 30, vy: -40 - Math.random() * 50, g: 30, t: 0, life: 0.8 + Math.random() * 0.8, c: Math.random() < 0.5 ? '#ffd060' : '#f07020', s: 1 } : { x: cx + (Math.random() - 0.5) * 4, y: cy, vx: 4 + Math.random() * 6, vy: -14 - Math.random() * 6, g: 0, t: 0, life: 2.5, c: '#2a2624', s: 3 });
        if (k > 0.3 && Math.random() < dt * 4) parts.push({ x: cx + (Math.random() - 0.5) * 30, y: cy - 10, vx: (Math.random() - 0.5) * 20, vy: 12, g: 4, t: 0, life: 3, c: '#e06020', s: 1 });
        if (Math.random() < dt * 0.7 && near(cx, cy, 340)) O.sfx && O.sfx('crackle', 0.4);
        C.house.forEach((q, i) => { const a = q.agent; if (!a.frozen) return; a.dir = 3; a.forceAnim = C.t < 40 ? (i ? 'cough' : 'shocked') : 'cough'; });
        C.help.forEach((q, i) => { const a = q.agent; if (!a.frozen) return; a.dir = 3; if (i === 0) { a.lift = Math.min(18, (a.lift || 0) + dt * 6); a.forceAnim = C.t < 42 ? 'pitch' : 'wipe'; } else { a.forceAnim = C.t < 42 ? (i % 2 ? 'pour' : 'give') : 'idle'; if (C.t < 42 && Math.random() < dt * 1.2) for (let j = 0; j < 6; j++) parts.push({ x: a.x, y: a.y - 18, vx: (cx - a.x) * 0.6 + (Math.random() - 0.5) * 20, vy: -80 - Math.random() * 20, g: 160, t: 0, life: 0.7, c: '#a8c0d8', s: 1 }); } });
        if (!C.s1 && C.t > 1) { C.s1 = true; if (near(cx, cy, 340)) { O.Speech && O.Speech.say(C.house[0], pick(['FIRE! The chimney\'s afire!', 'Help! Oh God, the chimney!', 'Get out, get out, all of you!']), 2.6); } }
        if (C.t > 6 && !C.called) { C.called = true; const w = s.world, b = C.b;
          const men = s.people.filter((q) => able(q) && q.age >= 14 && !C.house.includes(q) && !q.agent.hidden && q.agent.inside == null && Math.hypot(q.agent.x - cx, q.agent.y - cy) < 500).slice(0, 3);
          men.forEach((q, i) => { q._chim = true; C.help.push(q); const tx = b.doorX + (i === 0 ? (b.doorX - b.x > b.w / 2 ? -1 : 1) : (i === 1 ? -2 : 2)), ty = b.doorY + (i === 0 ? 1 : 2); O.Errands.send(s, q, [Math.max(1, Math.min(w.W - 2, tx)), ty], { anim: 'idle', secs: 0.1, face: 3, sprint: true, giveUp: game.t + 30, carry: i ? { good: 'ale', qty: 1 } : null, after: (ok) => { if (!C || !q._chim) return; if (!ok) { rel(q); return; } q.agent.frozen = true; q.agent.path = null; q.agent.carrying = null; if (i === 0 && near(cx, cy, 340)) O.Speech && O.Speech.say(q, 'Hand me up the wet sack! Quick!', 2.2); } }); }); }
        if (C.t > 56 && !C.s2) { C.s2 = true; fires++; if (near(cx, cy, 340)) { const h = C.help[1] || C.help[0]; if (h) O.Speech && O.Speech.say(h, pick(['That\'s it out. Get the sweep in, mistress, before you burn the street down.', 'Out. Thank God for a wet roof.', 'There. And there\'s your supper smoked.']), 3); } }
        if (C.t > 64) end();
        return; }
      cool -= dt; if (cool > 0) return; cool = 900 + Math.random() * 900; if (s.season === 'summer' || !(hr > 16 || hr < 8)) return;
      const lit = game.lit || new Set(); const P = game.player;
      const hs = s.world.buildings.filter((b) => b.type === 'house' && b.sprite && b.sprite.chimney && b.doorX != null && (lit.has(b.id) || !lit.size) && Math.hypot(b.doorX * T - P.x, b.doorY * T - P.y) < 360); if (!hs.length) return;
      const b = pick(hs), house = s.people.filter((q) => q.home === b.id && able(q)).slice(0, 3); if (!house.length) return;
      const sp = b.sprite, top = [b.x * T - sp.OV + sp.chimney.x, (b.bottom + 1) * T - sp.H + sp.chimney.y];
      house.forEach((q, i) => { const a = q.agent; a.inside = null; a.hidden = false; a.x = (b.doorX + (i - 1)) * T + 8; a.y = (b.doorY + 2) * T + 4; if (game.solidAt(a.x, a.y - 2)) a.x = b.doorX * T + 8; a.frozen = true; a.path = null; q._chim = true; });
      C = { s, b, top, house, help: [], t: 0 };
    });
    const draw = (ctx, cam) => { if (game.scene) return; const s = cur(); if (!C || C.s !== s) { if (!parts.length) return; }
      for (const p of parts) { ctx.globalAlpha = Math.max(0, 1 - p.t / p.life) * (p.s > 1 ? 0.5 : 1); ctx.fillStyle = p.c; const r = p.s > 1 ? Math.round(p.s + p.t * 3) : 1; ctx.fillRect(Math.round(p.x - cam.x) - (r >> 1), Math.round(p.y - cam.y) - (r >> 1), r, r); } ctx.globalAlpha = 1;
      if (C && C.s === s && C.t < 46) { const [cx, cy] = C.top, x = Math.round(cx - cam.x), y = Math.round(cy - cam.y), f = Math.floor(performance.now() / 90) % 3; ctx.fillStyle = '#f08020'; ctx.fillRect(x - 3, y - 6 - f, 6, 6 + f); ctx.fillStyle = '#ffd060'; ctx.fillRect(x - 1, y - 4 - f, 3, 4); }
      // the ladder against the wall
      if (C && C.s === s && C.help[0] && C.help[0].agent.frozen) { const a = C.help[0].agent, x = Math.round(a.x - cam.x) + 4, y = Math.round(a.y - cam.y); ctx.fillStyle = '#7a5a30'; ctx.fillRect(x - 5, y - 40, 1, 40); ctx.fillRect(x + 1, y - 40, 1, 40); for (let i = 0; i < 8; i++) ctx.fillRect(x - 5, y - 4 - i * 5, 7, 1); } };
    game.hooks.drawTop.push((ctx, cam, inScene) => { if (!inScene) draw(ctx, cam); });
    (O.extraLines = O.extraLines || []).push((s, q) => !C || !q._chim ? '' : C.house.includes(q) ? 'Your chimney has caught fire! The soot in the flue is burning and you have run out of the house in a fright.' : 'A neighbour\'s chimney has caught fire and you have run to help put it out with water and a wet sack.');
    // you can fling water up at the roof too
    let yours = 0; const relOf = (q) => { const r = q.rel.get(0) || { affinity: 0, familiar: 0 }; q.rel.set(0, r); return r; };
    (O.moreCandidates = O.moreCandidates || []).push(() => { const P = game.player; if (!C || C.t > 42 || C.youHelped || game.scene || P.locked) return null; const b = C.b; if (Math.hypot(b.doorX * T + 8 - P.x, (b.doorY + 2) * T - P.y) > 50) return null;
      return { type: 'custom', d: 50, x: b.doorX * T + 8, y: (b.doorY + 1) * T - 20, label: 'Grab a bucket and throw water on the roof', act: () => { if (!C) return; const s = cur(); C.youHelped = true; yours++; C.t = Math.max(C.t, 30); P.anim = 'pour'; P.locked = true; for (let j = 0; j < 14; j++) parts.push({ x: P.x, y: P.y - 18, vx: (C.top[0] - P.x) * 0.6 + (Math.random() - 0.5) * 20, vy: -90 - Math.random() * 20, g: 160, t: 0, life: 0.8, c: '#a8c0d8', s: 1 });
        setTimeout(() => { P.locked = false; P.anim = 'idle'; }, 1800); const h = C.house[0]; if (h) { const r = relOf(h); r.affinity = Math.min(1, r.affinity + 0.2); try { s.remember(h, 'When my chimney caught fire, a stranger ran up with a bucket and helped put it out.', 'kindness', 0.7); } catch (e) { /* */ } setTimeout(() => O.Speech && O.Speech.say(h, 'God bless you! Another one, quick!', 2), 600); } } }; });
    O.ChimneyFire = { get yours() { return yours; }, get fire() { return C; }, get fires() { return fires; }, soon: () => { cool = 0; } };
  }
  O.ChimneyFireSetup = { setup };
})();
