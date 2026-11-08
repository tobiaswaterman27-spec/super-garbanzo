// Winter's own chores. When snow lies, icicles hang along the eaves and drip in the midday sun; folk come
// out with a wooden shovel and clear the snow from before their doors, throwing it up in a bank beside
// the path, and the cleared ground stays dark and trodden; of a frosty morning someone breaks the ice on
// the well with the back of an axe, the bits skittering; and late in the day people carry home a bundle
// of firewood on their backs.
'use strict';
(function () {
  const T = 16;
  function setup(game) {
    const cur = () => O.SimRef.cur;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    const jobs = [], bits = [], drips = []; const cleared = new Map(); let cool = 4, woodCool = 10;
    const near = (x, y, r) => Math.hypot(x - game.player.x, y - game.player.y) < r;
    const snowy = (s) => ((s.weather && s.weather.snowCover) || 0) > 0.3;
    const OFF = ['home', 'idle', 'rest', 'stroll', 'socialise', 'pastime-none', 'wait-work'];
    const free = (q) => q && q.alive !== false && q.agent && (!q.agent.hidden || (q.agent.inside != null && q.agent.inside === q.home)) && !q.agent.frozen && !q.agent.mount && !q.errand && !q._bit && !q._scene && !q._winter && !q._door && !q._repair && !q.visitor && q.activity && OFF.includes(q.activity.act) && !(O.npcUI && O.npcUI.talking && O.npcUI.talking() === q);
    function release(j) { const a = j.q.agent; if (a) { a.forceAnim = null; if (!(O.npcUI && O.npcUI.talking && O.npcUI.talking() === j.q)) a.frozen = false; } j.q._winter = false; jobs.splice(jobs.indexOf(j), 1); }
    function begin(s, q, kind, b, well) {
      const tx = kind === 'ice' ? Math.floor(well.x / T) + 1 : b.doorX, ty = kind === 'ice' ? Math.floor(well.y / T) + 1 : b.doorY + 2, w = s.world; if (w.solid[ty * w.W + tx]) return false;
      q._winter = true;
      O.Errands.send(s, q, [tx, ty], { anim: 'idle', secs: 0.3, face: kind === 'ice' ? 1 : 3, giveUp: game.t + 45, after: (ok) => { if (!ok || !q.agent) { q._winter = false; return; } const a = q.agent; a.frozen = true; a.path = null; a.dir = kind === 'ice' ? 1 : 3; jobs.push({ s, q, kind, b, well, t: 0, len: kind === 'ice' ? 14 : 35, next: 0.6, x0: a.x, y0: a.y }); } });
      return true;
    }
    function eave(b) { const sp = b.sprite; if (!sp || sp.wallTop == null || b.site || b.ruined) return null; return { x0: b.x * T + 2, x1: (b.x + b.w) * T - 2, y: (b.bottom + 1) * T - sp.H + sp.wallTop }; }
    game.hooks.update.push((dt) => {
      for (const p of bits.slice()) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 160 * dt; if (p.t > p.land) { p.vx = 0; p.vy = 0; } if (p.t > p.life) bits.splice(bits.indexOf(p), 1); }
      for (const d of drips.slice()) { d.t += dt; d.y += 60 * dt; if (d.y > d.floor) drips.splice(drips.indexOf(d), 1); }
      const s = cur(); if (!s || !s.world || game.scene) return; const hr = s.minute / 60, snow = snowy(s);
      for (const [k, c] of cleared) if (c.s !== s || !snow) cleared.delete(k);
      for (const j of jobs.slice()) {
        j.t += dt; const a = j.q.agent;
        if (j.s !== s || !a || j.t > j.len || j.q.alive === false || (O.npcUI && O.npcUI.talking && O.npcUI.talking() === j.q)) { if (j.kind === 'shovel' && j.s === s && j.t > j.len) cleared.set(j.b.id, { s, x: j.b.doorX * T + 8, y: (j.b.doorY + 1) * T + 8, h: 3 }); release(j); continue; }
        j.next -= dt;
        if (j.kind === 'shovel') { a.forceAnim = 'dig'; a.x = j.x0 + Math.sin(j.t * 0.3) * 6; if (j.next <= 0) { j.next = 0.9; const side = Math.sin(j.t) > 0 ? 1 : -1; for (let i = 0; i < 5; i++) bits.push({ x: a.x + side * 4, y: a.y - 6, vx: side * (30 + Math.random() * 30), vy: -50 - Math.random() * 30, t: 0, land: 0.5, life: 3, c: '#f4f6fa' }); if (near(a.x, a.y, 200)) O.sfx && O.sfx('dig', 0.08); cleared.set(j.b.id, { s, x: j.b.doorX * T + 8, y: (j.b.doorY + 1) * T + 8, h: Math.min(3, (cleared.get(j.b.id)?.h || 0) + 0.2) }); }
          if (!j.said && j.t > 8) { j.said = 1; near(a.x, a.y, 240) && O.Speech && O.Speech.say(j.q, pick(['More of it every night.', 'My fingers are dead.', 'There. Now nobody breaks a leg.']), 2.4); } }
        else if (j.kind === 'ice') { a.forceAnim = 'chop'; if (j.next <= 0) { j.next = 0.8; for (let i = 0; i < 4; i++) bits.push({ x: j.well.x + (Math.random() - 0.5) * 8, y: j.well.y - 10, vx: (Math.random() - 0.5) * 60, vy: -40 - Math.random() * 30, t: 0, land: 0.4, life: 2.5, c: '#c8e0f4' }); if (near(a.x, a.y, 200)) O.sfx && O.sfx('chop', 0.12); } if (j.t > 10 && !j.said) { j.said = 1; near(a.x, a.y, 240) && O.Speech && O.Speech.say(j.q, 'There. Water for all.', 2); } }
      }
      // icicles drip when the sun is on them
      if (snow && hr > 11 && hr < 15 && !(s.raining) && Math.random() < dt * 6) { const P = game.player, bs = s.world.buildings.filter((b) => b.sprite && Math.abs(b.x * T - P.x) < 300 && Math.abs(b.bottom * T - P.y) < 220); const b = bs.length && pick(bs), e = b && eave(b); if (e) drips.push({ x: e.x0 + Math.random() * (e.x1 - e.x0), y: e.y + 4, t: 0, floor: (b.bottom + 1) * T }); }
      // carrying firewood home late in the day (any cold season)
      woodCool -= dt; if (woodCool <= 0 && (s.season === 'winter' || s.season === 'autumn') && hr > 15 && hr < 18.5) { woodCool = 4; for (const q of s.people) { const a = q.agent; if (!a || a.hidden || a.inside != null || !a.path || a.carrying || q.age < 12 || q.activity?.act !== 'home' || q._wood === s.day) continue; if (Math.random() < 0.3) { q._wood = s.day; a.carrying = { good: 'firewood', qty: 1, firewood: true }; } } }
      for (const q of s.people) { const a = q.agent; if (a && a.carrying && a.carrying.firewood && (a.inside != null || a.hidden)) a.carrying = null; }
      // starting new work
      cool -= dt; if (cool > 0) return; cool = 5 + Math.random() * 5;
      if (hr < 7 || hr > 16.5 || (game.isNight && game.isNight()) || jobs.filter((j) => j.s === s).length >= 3) return;
      const P = game.player, frosty = s.season === 'winter' && hr < 10.5;
      if (frosty && Math.random() < 0.4) { const wells = s.world.props.filter((p) => p.kind === 'well' && Math.hypot(p.x - P.x, p.y - P.y) < 420 && !jobs.some((j) => j.well === p) && p._iced !== s.day); const well = wells.length && pick(wells); const q = well && s.people.filter((x) => free(x) && x.age >= 16 && x.age < 60 && Math.hypot(x.agent.x - well.x, x.agent.y - well.y) < 400)[0]; if (q) { well._iced = s.day; begin(s, q, 'ice', null, well); } return; }
      if (!snow) return;
      const houses = s.world.buildings.filter((b) => b.type === 'house' && b.doorX != null && !cleared.has(b.id) && !jobs.some((j) => j.b === b) && Math.abs(b.doorX * T - P.x) < 420 && Math.abs(b.doorY * T - P.y) < 300); if (!houses.length) return;
      const b = pick(houses), q = s.people.find((x) => x.home === b.id && free(x) && x.age >= 12 && x.age < 65); if (q) begin(s, q, 'shovel', b);
    });
    game.hooks.drawGround.push((ctx, cam) => {
      const s = cur(); if (!s || game.scene) return;
      for (const c of cleared.values()) { if (c.s !== s) continue; const x = Math.round(c.x - cam.x), y = Math.round(c.y - cam.y); ctx.fillStyle = 'rgba(90,80,70,0.55)'; ctx.fillRect(x - 7, y - 6, 14, 26); ctx.fillStyle = '#eef2f8'; const h = Math.round(c.h * 2); ctx.fillRect(x - 13, y - h, 5, h + 20); ctx.fillRect(x + 8, y - h, 5, h + 20); ctx.fillStyle = '#d0d8e4'; ctx.fillRect(x - 13, y + 18, 5, 2); ctx.fillRect(x + 8, y + 18, 5, 2); }
    });
    game.hooks.drawWorld.push((ctx, cam) => {
      const s = cur(); if (!s || game.scene) return; const W = ctx.canvas.width, H = ctx.canvas.height;
      if (snowy(s)) for (const b of s.world.buildings) { const e = eave(b); if (!e) continue; const x0 = Math.round(e.x0 - cam.x), x1 = Math.round(e.x1 - cam.x), y = Math.round(e.y - cam.y); if (x1 < -10 || x0 > W + 10 || y < -40 || y > H + 10) continue; for (let x = x0; x <= x1; x += 3) { const h = 2 + (O.hash('ice', b.id, x - x0) % 6); ctx.fillStyle = 'rgba(220,236,250,0.9)'; ctx.fillRect(x, y, 2, Math.max(1, h - 2)); ctx.fillRect(x, y + h - 2, 1, 2); } }
      ctx.fillStyle = '#d8ecfc'; for (const d of drips) ctx.fillRect(Math.round(d.x - cam.x), Math.round(d.y - cam.y), 1, 2);
      for (const p of bits) { ctx.globalAlpha = Math.min(1, p.life - p.t); ctx.fillStyle = p.c; ctx.fillRect(Math.round(p.x - cam.x), Math.round(p.y - cam.y), 2, 2); } ctx.globalAlpha = 1;
      for (const j of jobs) { if (j.s !== s) continue; const a = j.q.agent, x = Math.round(a.x - cam.x), y = Math.round(a.y - cam.y); if (j.kind === 'shovel') { const up = Math.floor(j.t * 2.2) % 2; ctx.strokeStyle = '#7a5a3a'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x + 3, y - 14); ctx.lineTo(x + 6, y - (up ? 8 : 2)); ctx.stroke(); ctx.fillStyle = '#8a6a44'; ctx.fillRect(x + 4, y - (up ? 9 : 3), 5, 3); if (up) { ctx.fillStyle = '#f4f6fa'; ctx.fillRect(x + 4, y - 11, 5, 2); } } }
    });
    (O.extraLines = O.extraLines || []).push((s, q) => { if (!q._winter) return ''; const j = jobs.find((o) => o.q === q); return j ? (j.kind === 'shovel' ? 'You are shovelling the snow from before your door; your hands are numb.' : 'You are breaking the ice on the well with the back of an axe.') : ''; });
    O.WinterWork = { jobs, cleared, drips, start: (kind) => { const s = cur(), P = game.player; if (kind === 'ice') { const well = s.world.props.filter((p) => p.kind === 'well').sort((a, b) => Math.hypot(a.x - P.x, a.y - P.y) - Math.hypot(b.x - P.x, b.y - P.y))[0]; const q = well && s.people.find((x) => free(x) && x.age >= 16); return q && begin(s, q, 'ice', null, well) ? q.first : null; } const hs = s.world.buildings.filter((b) => b.type === 'house' && b.doorX != null && !jobs.some((j) => j.b === b)).sort((x, y) => Math.hypot(x.doorX * T - P.x, x.doorY * T - P.y) - Math.hypot(y.doorX * T - P.x, y.doorY * T - P.y)); for (const b of hs.slice(0, 40)) { const q = s.people.find((x) => x.home === b.id && free(x) && x.age >= 12); if (q && begin(s, q, 'shovel', b)) return q.first; } return null; } };
  }
  O.WinterWorkSetup = { setup };
})();
