// More of the year, out where it can be seen. On a fine dry morning in spring or summer the bedding is
// aired: quilts and blankets hang out over the sills of the upper windows, and are taken in again in the
// afternoon. In autumn the farms press their apples for cider: a heap of apples, the press with its great
// screw, two men walking the bar round, the juice running into a tub, and children coming for a cup.
// And on a warm summer night a young man stands under his sweetheart's window with a lute and sings,
// the notes floating up; sometimes she leans out and drops him a flower, sometimes her father bawls at
// him to clear off.
'use strict';
(function () {
  const T = 16;
  function setup(game) {
    const mem = new WeakMap(), M = (o) => { let m = mem.get(o); if (!m) mem.set(o, (m = {})); return m; };
    const cur = () => O.SimRef.cur;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    const presses = [], serenades = [], notes = []; let started = 0; let cool = 6, sCool = 20;
    const near = (x, y, r) => Math.hypot(x - game.player.x, y - game.player.y) < r;
    const say = (q, t, d) => q && q.agent && near(q.agent.x, q.agent.y, 300) && O.Speech && O.Speech.say(q, t, d || 2.5);
    const talking = (q) => O.npcUI && O.npcUI.talking && O.npcUI.talking() === q;
    const free = (q) => q && q.alive !== false && q.agent && !q.agent.hidden && q.agent.inside == null && !q.agent.frozen && !q.agent.mount && !q.errand && !q._bit && !q._scene && !q._chore && !q._call && !q.visitor && !talking(q);
    const PAL = [['#b83a3a', '#e8d8a0'], ['#3a5a9a', '#e8e0d0'], ['#e8e4d8', '#c8b890'], ['#5a7a3a', '#d8c070'], ['#8a4a8a', '#e8d0e0']];
    // airing the bedding: decided per house per day, drawn on the upper windows
    const airing = (s, b) => { if (s.raining || !(s.season === 'spring' || s.season === 'summer') || (s.weather && s.weather.kind && /rain|storm|fog|snow/.test(s.weather.kind))) return false; const h = s.minute / 60; if (h < 8.5 || h > 15.5) return false; return O.hash('air', b.id, s.day) % 5 === 0; };
    function releaseAll(list) { for (const q of list) { if (!q || !q.agent) continue; q.agent.forceAnim = null; if (!talking(q)) q.agent.frozen = false; q._chore = false; } }
    function startPress(s, b, ppl) {
      const sx = (b.doorX + 3) * T, sy = (b.doorY + 2) * T, w = s.world; if (w.solid[Math.floor(sy / T) * w.W + Math.floor(sx / T)]) return false;
      const P = { s, b, x: sx, y: sy, ppl: [], t: 0, ang: 0, juice: 0, apples: 14, kids: [] };
      ppl.slice(0, 2).forEach((q, i) => { q._chore = 'press'; O.Errands.send(s, q, [Math.floor(sx / T) + (i ? 1 : -1), Math.floor(sy / T)], { anim: 'idle', secs: 0.2, face: 0, giveUp: game.t + 50, after: (ok) => { if (!ok || !q.agent || P.done) { q._chore = false; return; } q.agent.frozen = true; q.agent.path = null; P.ppl.push(q); } }); });
      presses.push(P); return true;
    }
    game.hooks.update.push((dt) => {
      for (const n of notes.slice()) { n.t += dt; n.y -= 12 * dt; n.x += Math.sin(n.t * 3 + n.ph) * 8 * dt; if (n.t > 2.5) notes.splice(notes.indexOf(n), 1); }
      const s = cur(); if (!s || !s.world || game.scene) return; const hr = s.minute / 60;
      // the cider presses
      for (const P of presses.slice()) {
        P.t += dt; if (P.s !== s || P.t > 120 || P.apples <= 0 || s.raining || P.ppl.some((q) => q.alive === false || talking(q))) { P.done = true; releaseAll(P.ppl); releaseAll(P.kids); presses.splice(presses.indexOf(P), 1); continue; }
        if (P.ppl.length >= 1) { P.ang += dt * 0.8; P.juice = Math.min(1, P.juice + dt * 0.01); if (Math.random() < dt * 0.15) P.apples--; P.ppl.forEach((q, i) => { const a = q.agent, k = P.ang + i * Math.PI; a.x = P.x + Math.cos(k) * 14; a.y = P.y + Math.sin(k) * 6 + 4; a.dir = Math.sin(k) > 0 ? 1 : 2; a.forceAnim = 'carry'; }); if (Math.random() < dt * 0.6 && near(P.x, P.y, 200)) O.sfx && O.sfx('pour', 0.08); if (!P.said && P.t > 12) { P.said = 1; say(P.ppl[0], pick(['Round she goes!', 'Push, you idle devil!', 'Smell that. That\'s autumn.'])); } }
        if (P.juice > 0.3 && P.kids.length < 2 && Math.random() < dt * 0.05) { const k = s.people.find((x) => free(x) && x.age >= 5 && x.age < 13 && Math.hypot(x.agent.x - P.x, x.agent.y - P.y) < 300); if (k) { k._chore = 'cup'; O.Errands.send(s, k, [Math.floor((P.x + 26) / T), Math.floor((P.y + 10) / T)], { anim: 'drink', secs: 3, face: 1, giveUp: game.t + 30, after: () => { k._chore = false; say(k, pick(['Mmm! Sweet!', 'Can I have another?']), 2); } }); } }
      }
      // serenades
      for (const S of serenades.slice()) {
        S.t += dt; const a = S.q.agent;
        if (S.s !== s || !a || S.t > 60 || talking(S.q) || hr < 19) { releaseAll([S.q]); serenades.splice(serenades.indexOf(S), 1); continue; }
        if (!S.on) continue; a.forceAnim = 'lute'; a.dir = 3;
        if (Math.random() < dt * 2.5) notes.push({ x: a.x + (Math.random() - 0.5) * 8, y: a.y - 30, t: 0, ph: Math.random() * 6 });
        if (!S.sung && S.t > 4) { S.sung = 1; say(S.q, pick(['Fair maid, my heart is yours...', 'O lady, look down from thy window...', 'Sweet as the May, fair as the morn...']), 4); }
        if (!S.end && S.t > 22) { S.end = 1; const fa = S.s.people.find((x) => x.home === S.b.id && x.sex === 'm' && x.age > 38 && x.alive !== false); if (fa && Math.random() < 0.4) { S.who = 'father'; say(fa, pick(['Clear off, you caterwauling pup!', 'Some of us have work at dawn!', 'I\'ll set the dog on you!']), 3); S.t = 50; } else { S.who = 'her'; S.flower = { x: S.b.doorX * T + 8 + 10, y: (S.b.doorY - 2) * T, t: 0 }; say(S.her, pick(['Oh, you fool. Here.', 'Go home before my father hears!', 'Sing it again tomorrow.']), 3); } }
        if (S.flower) { S.flower.t += dt; if (S.flower.y < a.y - 6) S.flower.y += 30 * dt; else if (!S.thanked) { S.thanked = 1; say(S.q, 'She threw me a rose!', 2.5); } }
      }
      // new things
      cool -= dt; sCool -= dt;
      if (cool <= 0) { cool = 10 + Math.random() * 10; if (s.season === 'autumn' && hr > 9 && hr < 16 && !s.raining && presses.filter((p) => p.s === s).length < 1) { const P = game.player, farms = s.world.buildings.filter((b) => b.type === 'farmhouse' && b.doorX != null && Math.hypot(b.doorX * T - P.x, b.doorY * T - P.y) < 520 && M(b).pressed !== s.day); if (farms.length) { const b = pick(farms), bz = s.biz.get(b.id), ws = (bz ? bz.workers : []).map((id) => s.byId.get(id)).filter(free); const ppl = ws.length >= 2 ? ws : ws.concat(s.people.filter((x) => free(x) && x.age >= 15 && x.age < 60 && x.home === b.id)); if (ppl.length >= 2 && startPress(s, b, ppl)) M(b).pressed = s.day; } } }
      if (sCool <= 0) { sCool = 25 + Math.random() * 20; if (s.season === 'summer' || s.season === 'spring') if (hr > 20 && hr < 23 && !s.raining && serenades.filter((x) => x.s === s).length < 1) {
        const P = game.player; const freeHome = (q) => q && q.alive !== false && q.agent && !q.agent.frozen && !q.agent.mount && !q.errand && !q._bit && !q._scene && !q._chore && !q._call && !q.visitor && !talking(q) && ((!q.agent.hidden && q.agent.inside == null) || (q.agent.inside != null && q.agent.inside === q.home)) && q.activity && ['home', 'socialise', 'stroll', 'idle', 'rest', 'pastime'].includes(q.activity.act);
        for (const q of s.people) { if (!freeHome(q) || q.sex !== 'm' || q.age < 16 || q.age > 30 || q.spouse) continue; let her = null; for (const [id, r] of q.rel || []) { if ((r.affinity || 0) < 0.35) continue; const g = s.byId.get(id); if (g && g.sex === 'f' && !g.spouse && g.age >= 15 && g.age < 30 && g.home && g.household !== q.household && g.agent && g.agent.inside === g.home) { her = g; break; } } if (!her && q.courting) { const g = s.byId.get(q.courting); if (g && g.agent && g.agent.inside === g.home) her = g; }
          if (!her) continue; const b = s.building(her.home); if (!b || b.doorX == null || Math.hypot(b.doorX * T - P.x, b.doorY * T - P.y) > 700) continue;
          const S = { s, q, her, b, t: 0, on: false }; q._chore = 'serenade'; serenades.push(S); started++; O.Errands.send(s, q, [b.doorX + 1, b.doorY + 2], { anim: 'idle', secs: 0.3, face: 3, giveUp: game.t + 50, after: (ok) => { if (!ok || !q.agent) { q._chore = false; S.t = 99; return; } q.agent.frozen = true; q.agent.path = null; S.on = true; S.t = 0; } }); break; } } }
    });
    game.hooks.drawWorld.push((ctx, cam) => {
      const s = cur(); if (!s || game.scene) return; const tk = performance.now() / 1000, W = ctx.canvas.width, H = ctx.canvas.height;
      // bedding out of the upper windows
      for (const b of s.world.buildings) {
        if (b.type !== 'house' || !b.sprite || !b.sprite.windows || b.site || b.ruined) continue; const sp = b.sprite, bx = b.x * T - sp.OV, by = (b.bottom + 1) * T - sp.H; if (bx - cam.x > W + 20 || bx + sp.W - cam.x < -20 || by - cam.y > H + 20 || by + sp.H - cam.y < -20) continue;
        if (!airing(s, b)) continue; const top = Math.min(...sp.windows.map((w) => w.y)); const ups = sp.windows.filter((w) => w.y <= top + 2); const wins = ups.length && (b.floors || 1) > 1 ? ups : sp.windows.slice(0, 1);
        wins.slice(0, 2).forEach((w, i) => { const [c1, c2] = PAL[(b.id + i) % PAL.length], x = Math.round(bx + w.x - 2 - cam.x), y = Math.round(by + w.y + w.h - 2 - cam.y), ww = w.w + 4, hh = 9 + ((b.id + i) % 3) * 2, sw = Math.round(Math.sin(tk * 1.5 + b.id) * 0.6); ctx.fillStyle = c1; ctx.fillRect(x + sw, y, ww, hh); ctx.fillStyle = c2; for (let k = 2; k < hh; k += 4) ctx.fillRect(x + sw, y + k, ww, 1); ctx.fillRect(x + sw + 2, y, 1, hh); ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.fillRect(x + sw, y + hh, ww, 1); });
      }
      // the presses
      for (const P of presses) { if (P.s !== s) continue; const x = Math.round(P.x - cam.x), y = Math.round(P.y - cam.y); ctx.fillStyle = '#6a4a2c'; ctx.fillRect(x - 7, y - 16, 2, 16); ctx.fillRect(x + 5, y - 16, 2, 16); ctx.fillRect(x - 8, y - 18, 16, 3); ctx.fillStyle = '#8a6239'; ctx.fillRect(x - 6, y - 6, 12, 6); ctx.fillStyle = '#5a4028'; ctx.fillRect(x - 1, y - 16, 2, 10); const bar = P.ang; ctx.strokeStyle = '#7a5232'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x - Math.cos(bar) * 12, y - 12 - Math.sin(bar) * 3); ctx.lineTo(x + Math.cos(bar) * 12, y - 12 + Math.sin(bar) * 3); ctx.stroke();
        ctx.fillStyle = '#c83a2a'; for (let i = 0; i < Math.min(14, P.apples); i++) ctx.fillRect(x - 24 + (i % 5) * 3, y - 2 - Math.floor(i / 5) * 2, 2, 2); ctx.fillStyle = '#7a5a3a'; ctx.fillRect(x + 16, y - 7, 9, 7); ctx.fillStyle = '#c8a040'; ctx.fillRect(x + 17, y - 7, 7, 1 + Math.round(P.juice * 2)); if (P.ppl.length && Math.floor(tk * 6) % 2) { ctx.fillStyle = '#d8b050'; ctx.fillRect(x + 6, y - 3, 10, 1); } }
      // the serenade: a rose falling, notes rising
      for (const S of serenades) if (S.flower && S.s === s) { const f = S.flower, x = Math.round(f.x - cam.x), y = Math.round(f.y - cam.y); ctx.fillStyle = '#c82a3a'; ctx.fillRect(x, y, 2, 2); ctx.fillStyle = '#3a7a2a'; ctx.fillRect(x, y + 2, 1, 3); }
      ctx.fillStyle = '#f8f0c0'; for (const n of notes) { ctx.globalAlpha = Math.max(0, 1 - n.t / 2.5); const x = Math.round(n.x - cam.x), y = Math.round(n.y - cam.y); ctx.fillRect(x, y, 2, 2); ctx.fillRect(x + 1, y - 4, 1, 4); ctx.fillRect(x + 2, y - 4, 1, 1); } ctx.globalAlpha = 1;
    });
    (O.extraLines = O.extraLines || []).push((s, q) => { if (q._chore === 'press') return 'You are pressing apples for cider at the farm, walking the bar of the press round.'; if (q._chore === 'serenade') { const S = serenades.find((x) => x.q === q); return S ? `You are standing under ${S.her.first}'s window at night with a lute, singing to her.` : ''; } return ''; });
    O.SeasonChores = { presses, serenades, get started() { return started; }, soon: () => { sCool = 0; }, candidates: () => { const s = cur(), out = []; for (const q of s.people) { if (q.sex !== 'm' || q.age < 16 || q.age > 30 || q.spouse) continue; for (const [id, r] of q.rel || []) { const g = s.byId.get(id); if (g && g.sex === 'f' && !g.spouse && g.age >= 15 && g.age < 30 && (r.affinity || 0) >= 0.35 && g.home) out.push([q.id, g.id, g.home]); } } return out; }, airing: (b) => airing(cur(), b), press: () => { const s = cur(), P = game.player; const b = s.world.buildings.filter((x) => x.type === 'farmhouse').sort((x, y) => Math.hypot(x.doorX * T - P.x, x.doorY * T - P.y) - Math.hypot(y.doorX * T - P.x, y.doorY * T - P.y))[0]; if (!b) return null; const ppl = s.people.filter((x) => free(x) && x.age >= 15 && x.age < 60).sort((x, y) => Math.hypot(x.agent.x - b.doorX * T, x.agent.y - b.doorY * T) - Math.hypot(y.agent.x - b.doorX * T, y.agent.y - b.doorY * T)); return startPress(s, b, ppl) ? ppl.slice(0, 2).map((q) => q.first).join(' & ') : null; } };
  }
  O.SeasonChoresSetup = { setup };
})();
