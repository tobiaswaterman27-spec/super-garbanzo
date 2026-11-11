// Weddings and funerals, out in the street.
// - A funeral: on the morning of it the coffin comes out of the house on the shoulders of four bearers,
//   the family walking behind in their dark clothes, slow, to the chapel; folk in the street stop, the
//   men bare their heads, some cross themselves, and the chapel bell tolls.
// - A wedding: when the vows are said the doors open and the couple come out into the light; the
//   guests line the way and throw grain and petals over them, someone strikes up a tune, the bell rings,
//   and the children run alongside.
'use strict';
(function () {
  const T = 16;
  function setup(game) {
    const cur = () => O.SimRef.cur;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    const say = (q, t, secs) => O.Speech && O.Speech.say(q, t, secs || 2);
    const near = (x, y, r) => Math.hypot(x - game.player.x, y - game.player.y) < r;
    const ok = (q) => q && q.alive !== false && q.agent && !q.errand && !q._fighting && !q.jailUntil && !(O.npcUI && O.npcUI.talking && O.npcUI.talking() === q);
    const hold = (q) => { q._proc = true; if (q._bit) q._bit.t = 1e9; const a = q.agent; a.frozen = true; a.path = null; a.inside = null; a.hidden = false; };
    const let_go = (q) => { if (!q || !q._proc) return; q._proc = false; q.agent.forceAnim = null; const tq = O.npcUI && O.npcUI.talking && O.npcUI.talking(); if (tq !== q) q.agent.frozen = false; };
    const done = new Set(); let proc = null; const parts = []; let bell = 0;
    function route(s, from, to) { const p = s.path.find(from[0], from[1], to[0], to[1]); if (!p) return null; return p.map(([x, y]) => [x * T + 8, y * T + 10]); }
    // ---------------------------------------------------------------- the funeral
    function funeral(s, e) {
      const dead = (s.dead || []).find((d) => d.id === e.who) || s.byId.get(e.who) || {}; const hh = s.households[(dead.household || 0) - 1];
      const chapel = s.building(s.chapelId); const home = hh && s.building(hh.home); if (!chapel || !home || home.doorX == null) return false;
      const fam = (hh.members || []).map((id) => s.byId.get(id)).filter((q) => ok(q) && q.age >= 6);
      const friends = s.people.filter((q) => ok(q) && !fam.includes(q) && q.age >= 16 && q.age <= 60 && q.sex === 'm' && q.rel && ((q.rel.get(e.who)?.affinity || 0) > 0.1 || (q.rel.get(e.who)?.familiar || 0) > 0.3));
      const men = fam.filter((q) => q.age >= 15 && q.age <= 65 && q.sex === 'm'); const bearers = [...men, ...friends].slice(0, 4); while (bearers.length < 4) { const x = s.people.find((q) => ok(q) && q.sex === 'm' && q.age >= 18 && q.age <= 55 && !bearers.includes(q) && !fam.includes(q) && !q._proc && near(q.agent.x, q.agent.y, 600)); if (!x) break; bearers.push(x); }
      if (bearers.length < 4) return false;
      const path = route(s, [home.doorX, home.doorY + 1], [chapel.doorX, chapel.doorY + 1]); if (!path) return false;
      const mourners = fam.filter((q) => !bearers.includes(q)).slice(0, 6); const all = [...bearers, ...mourners]; all.forEach(hold);
      const [sx, sy] = path[0]; all.forEach((q, i) => { q.agent.x = sx; q.agent.y = sy + 6 + i * 2; });
      proc = { kind: 'funeral', s, e, bearers, mourners, all, path, pi: 0, lead: [sx, sy], trail: [[sx, sy]], t: 0, chapel, name: e.name || dead.name || 'a neighbour' };
      return true;
    }
    // ---------------------------------------------------------------- the wedding
    function wedding(s, e) {
      const a = s.byId.get(e.a), b = s.byId.get(e.b), chapel = s.building(s.chapelId); if (!ok(a) || !ok(b) || !chapel || chapel.doorX == null) return false;
      const guests = s.people.filter((q) => ok(q) && q !== a && q !== b && q.age >= 5 && (q.activity?.act === 'wedding' || q.household === a.household || (q.rel && ((q.rel.get(a.id)?.familiar || 0) > 0.25 || (q.rel.get(b.id)?.familiar || 0) > 0.25))) && near(q.agent.x, q.agent.y, 700)).slice(0, 12);
      const dx = chapel.doorX * T + 8, dy = (chapel.doorY + 1) * T + 10; const all = [a, b, ...guests]; all.forEach(hold);
      a.agent.x = dx - 4; a.agent.y = dy; b.agent.x = dx + 4; b.agent.y = dy;
      const spots = []; for (let row = 0; row < 8; row++) for (const side of [-1, 1]) for (const off of [16, 24, 32]) { const x = dx + side * off, y = dy + 12 + row * 9; if (!game.solidAt(x - 3, y - 2) && !game.solidAt(x + 3, y - 2)) spots.push([x, y, side]); }
      const used = []; guests.forEach((q, i) => { const sp = spots.find((c) => (c[2] === (i % 2 ? 1 : -1) || !spots.some((d) => d[2] === (i % 2 ? 1 : -1) && !used.includes(d))) && !used.includes(c) && !used.some((u) => Math.hypot(u[0] - c[0], u[1] - c[1]) < 9)); if (sp) { used.push(sp); q.agent.x = sp[0]; q.agent.y = sp[1]; q.agent.dir = sp[2] > 0 ? 1 : 2; } else { q.agent.x = dx + (i % 2 ? 40 : -40); q.agent.y = dy + 20 + i * 4; } });
      const fid = guests.find((q) => q.age >= 16 && (/minstrel|bard|piper/.test(q.job?.role || '') || q.id % 4 === 0));
      proc = { kind: 'wedding', s, e, a, b, guests, all, fid, t: 0, door: [dx, dy], walkTo: [dx, dy + 12 + Math.ceil(guests.length / 6) * 9 + 30] };
      O.sfx && near(dx, dy, 400) && O.sfx('door', 0.4); say(pick(guests.length ? guests : [a]), pick(['Here they come!', 'Long life to you both!', 'Huzzah!']), 2);
      return true;
    }
    function end() { const p = proc; if (!p) return; for (const q of p.all) let_go(q); if (p.kind === 'funeral') for (const q of p.all) { if (q.alive !== false && q.agent) { q.agent.inside = p.chapel.id; q.agent.hidden = true; } } proc = null; }
    function steerTo(q, tx, ty, dt, sp, an) { const a = q.agent, dx = tx - a.x, dy = ty - a.y, d = Math.hypot(dx, dy); if (d < 1) { a.forceAnim = an === 'walk' ? 'idle' : an; return true; } const st = Math.min(d, sp * dt); a.x += dx / d * st; a.y += dy / d * st; a.dir = O.dirOf(dx, dy); a.forceAnim = an; return false; }
    game.hooks.update.push((dt) => {
      const s = cur(); if (!s) return; bell -= dt;
      for (const pt of parts.slice()) { pt.t += dt; pt.x += pt.vx * dt; pt.y += pt.vy * dt; pt.vy += 50 * dt; if (pt.t > pt.life) parts.splice(parts.indexOf(pt), 1); }
      if (!proc) { if (game.scene || !s.events) return; const h = s.minute / 60;
        for (const e of s.events) { if (e.day !== s.day) continue; const key = e.kind + ':' + e.day + ':' + (e.who ?? e.a); if (done.has(key)) continue;
          const chapel = s.building(s.chapelId); if (!chapel) continue;
          if (e.kind === 'funeral' && h >= 9.6 && h < 10.2) { done.add(key); funeral(s, e); break; }
          if (e.kind === 'wedding' && h >= 11.4 && h < 12.2 && near(chapel.doorX * T, chapel.doorY * T, 520)) { done.add(key); wedding(s, e); break; } }
        return; }
      const p = proc; p.t += dt; if (p.s !== s || game.scene || p.t > 120) { end(); return; }
      if (p.all.some((q) => O.npcUI && O.npcUI.talking && O.npcUI.talking() === q)) return;
      if (p.kind === 'funeral') {
        // the leader walks the way, slow; the rest keep their places behind
        const tgt = p.path[p.pi]; if (tgt) { const dx = tgt[0] - p.lead[0], dy = tgt[1] - p.lead[1], d = Math.hypot(dx, dy), st = 16 * dt; if (d <= st) { p.lead = [tgt[0], tgt[1]]; p.pi++; } else { p.lead = [p.lead[0] + dx / d * st, p.lead[1] + dy / d * st]; } const last = p.trail[0]; if (Math.hypot(p.lead[0] - last[0], p.lead[1] - last[1]) > 2) { p.trail.unshift([p.lead[0], p.lead[1]]); if (p.trail.length > 200) p.trail.pop(); } }
        const at = (k) => p.trail[Math.min(p.trail.length - 1, k)];
        p.bearers.forEach((q, i) => { const [x, y] = at(Math.floor(i / 2) * 5); const ang = p.trail.length > 3 ? Math.atan2(p.trail[0][1] - p.trail[3][1], p.trail[0][0] - p.trail[3][0]) : 0; const side = i % 2 ? 1 : -1; const nx = x + Math.cos(ang + Math.PI / 2) * side * 5, ny = y + Math.sin(ang + Math.PI / 2) * side * 3; steerTo(q, nx, ny, dt, 30, 'carry'); });
        p.mourners.forEach((q, i) => { const [x, y] = at(14 + i * 6); steerTo(q, x + (i % 2 ? 4 : -4), y, dt, 30, 'walk'); if (Math.hypot(q.agent.x - x, q.agent.y - y) < 6) q.agent.forceAnim = Math.floor(p.t + i) % 9 < 2 ? 'mourn' : 'walk'; });
        if (bell <= 0 && near(p.lead[0], p.lead[1], 500)) { bell = 4; O.sfx && O.sfx('churchbell', 0.35); }
        // the street stops for it
        if (Math.random() < dt * 2) for (const q of s.people) { if (q._proc || !q.agent || q.agent.hidden || q.agent.inside != null || q.agent.frozen || q.errand || Math.hypot(q.agent.x - p.lead[0], q.agent.y - p.lead[1]) > 70 || q._sawCoffin === p) continue; q._sawCoffin = p; O.gesture && O.gesture(q, q.age >= 14 && q.sex === 'm' ? 'bow' : 'pray', 3); }
        if (p.pi >= p.path.length && Math.hypot(p.bearers[0].agent.x - p.lead[0], p.bearers[0].agent.y - p.lead[1]) < 4) { O.sfx && near(p.lead[0], p.lead[1], 400) && O.sfx('door', 0.3); end(); }
      } else {
        const [wx, wy] = p.walkTo; const walking = p.t > 1.5;
        if (walking) { steerTo(p.a, wx - 4, wy, dt, 14, 'walk'); const arrived = steerTo(p.b, wx + 4, wy, dt, 14, 'walk'); if (arrived) { p.a.agent.forceAnim = 'celebrate'; p.b.agent.forceAnim = 'laugh'; if (!p.cheered) { p.cheered = true; say(p.a, pick(['We did it!', p.b.sex === 'f' ? `My wife! ${p.b.first}, my wife!` : `My husband! ${p.b.first}!`, 'Married! Can you believe it?']), 2); } } }
        for (const q of p.guests) { if (q === p.fid) { q.agent.forceAnim = 'fiddle'; continue; } q.agent.dir = O.dirOf(p.a.agent.x - q.agent.x, p.a.agent.y - q.agent.y);
          if (Math.random() < dt * 0.9 && Math.hypot(q.agent.x - p.a.agent.x, q.agent.y - p.a.agent.y) < 40) { q.agent.forceAnim = 'attack'; setTimeout(() => { if (q.agent.forceAnim === 'attack') q.agent.forceAnim = 'celebrate'; }, 350); for (let k = 0; k < 6; k++) parts.push({ x: q.agent.x, y: q.agent.y - 16, vx: (p.a.agent.x - q.agent.x) * (0.8 + Math.random() * 0.6) + (Math.random() - 0.5) * 20, vy: -40 - Math.random() * 20, t: 0, life: 0.9 + Math.random() * 0.4, c: pick(['#f0e0a0', '#e8a0b0', '#ffffff', '#f0c0d0', '#d8c070']) }); }
          else if (q.agent.forceAnim !== 'attack') q.agent.forceAnim = q.age < 12 ? (Math.floor(p.t * 2) % 2 ? 'celebrate' : 'wave') : Math.floor(p.t + q.id) % 4 === 0 ? 'wave' : 'celebrate'; }
        if (bell <= 0 && near(p.door[0], p.door[1], 500)) { bell = 1.4; O.sfx && O.sfx('handbell', 0.22); }
        if (p.t > 26) end();
      }
    });
    game.hooks.drawWorld.push((ctx, cam) => {
      if (game.scene) return; ctx.save();
      if (proc && proc.kind === 'funeral') { const bs = proc.bearers.map((q) => q.agent), cx = bs.reduce((a, b) => a + b.x, 0) / bs.length, cy = bs.reduce((a, b) => a + b.y, 0) / bs.length; const f = bs[0], r = bs[2] || bs[1], ang = Math.atan2(f.y - r.y, f.x - r.x); ctx.translate(Math.round(cx - cam.x), Math.round(cy - 31 - cam.y)); ctx.rotate(Math.abs(Math.cos(ang)) > 0.5 ? 0 : Math.PI / 2 * 0.15); ctx.fillStyle = '#1a1418'; ctx.fillRect(-15, -5, 30, 10); ctx.fillStyle = '#4a3020'; ctx.fillRect(-14, -4, 28, 8); ctx.fillStyle = '#6a4a30'; ctx.fillRect(-14, -4, 28, 2); ctx.fillStyle = '#2a2026'; ctx.fillRect(-15, 2, 30, 3); ctx.fillStyle = '#e0d8c0'; ctx.fillRect(-1, -4, 2, 7); ctx.fillRect(-4, -2, 8, 2); ctx.setTransform(1, 0, 0, 1, 0, 0); }
      for (const pt of parts) { ctx.fillStyle = pt.c; ctx.fillRect(Math.round(pt.x - cam.x), Math.round(pt.y - cam.y), 1, 1); }
      ctx.restore();
    });
    (O.extraLines = O.extraLines || []).push((s, q) => { const p = proc; if (!p || !p.all.includes(q)) return ''; return p.kind === 'funeral' ? (p.bearers.includes(q) ? `You are carrying ${p.name}'s coffin to the chapel on your shoulder, slowly. Speak low and short.` : `You are walking behind ${p.name}'s coffin to the chapel, grieving. Speak low and short.`) : (q === p.a || q === p.b ? `You have just been married to ${q === p.a ? p.b.first : p.a.first}, and are coming out of the chapel with grain and petals thrown over you. You are overjoyed.` : `You are outside the chapel cheering ${p.a.first} and ${p.b.first}, just married, throwing grain and petals.`); });
    // you can join in: grain over the couple, or a bowed head as the coffin passes
    let threw = 0, bowed = 0; const relOf = (q) => { const r = q.rel.get(0) || { affinity: 0, familiar: 0 }; q.rel.set(0, r); return r; };
    (O.moreCandidates = O.moreCandidates || []).push(() => { const P = game.player, p = proc; if (!p || p.youJoined || game.scene || P.locked) return null; const c = p.kind === 'wedding' ? p.a : (p.bearers || [])[0]; if (!c || !c.agent || Math.hypot(c.agent.x - P.x, c.agent.y - P.y) > 70) return null;
      return { type: 'custom', d: 70, x: c.agent.x, y: c.agent.y - 30, label: p.kind === 'wedding' ? 'Throw a handful of grain over the couple' : 'Stand aside and bow your head as the coffin passes', act: () => { const s = cur(); p.youJoined = true;
        if (p.kind === 'wedding') { threw++; P.anim = 'pitch'; setTimeout(() => { P.anim = 'idle'; }, 900); for (let i = 0; i < 16; i++) parts.push({ x: P.x, y: P.y - 16, vx: (p.a.agent.x - P.x) * (0.8 + Math.random() * 0.6) + (Math.random() - 0.5) * 20, vy: -40 - Math.random() * 20, t: 0, life: 0.9 + Math.random() * 0.4, c: pick(['#f0e0a0', '#e8a0b0', '#ffffff', '#d8c070']) });
          for (const q of [p.a, p.b]) { if (!q) continue; const r = relOf(q); r.affinity = Math.min(1, r.affinity + 0.1); r.familiar = Math.min(1, (r.familiar || 0) + 0.1); try { s.remember(q, 'A stranger threw grain over us for luck on our wedding day.', 'kindness', 0.4); } catch (e) { /* */ } } setTimeout(() => say(p.b || p.a, pick(['Thank you, friend!', 'Ha! Bless you!', 'Come to the feast!']), 2), 700); }
        else { bowed++; P.anim = 'bow'; setTimeout(() => { P.anim = 'idle'; }, 2500); for (const q of p.mourners || []) { if (!q || !q.agent) continue; const r = relOf(q); r.affinity = Math.min(1, r.affinity + 0.06); } const m = (p.mourners || [])[0]; if (m) { try { s.remember(m, `A stranger stood aside and bowed their head as we carried ${p.name} past.`, 'kindness', 0.4); } catch (e) { /* */ } setTimeout(() => O.gesture && O.gesture(m, 'nod', 1.4), 800); } } } }; });
    O.Processions = { get threw() { return threw; }, get bowed() { return bowed; }, get proc() { return proc; }, funeral: (e) => funeral(cur(), e), wedding: (e) => wedding(cur(), e) };
  }
  O.ProcessionsSetup = { setup };
})();
