// A building site you can watch. The builders don't all stand hammering at the same spot: while the
// ground is cleared they dig and wheel the earth away in a barrow; when the frame and walls go up one is
// up on the scaffold hammering, one saws timber on the trestles in a haze of sawdust, one carries stone
// up on his shoulder from the pile; at the roof a man is up on the rafters and the hoist creaks a load
// up on its rope; at the end they're painting. The timber and stone stand stacked by the site, going
// down as the work eats them.
'use strict';
(function () {
  const T = 16;
  function setup(game) {
    const cur = () => O.SimRef.cur, SP = O.Sim.prototype;
    const _idle = SP.idleAnim; SP.idleAnim = function (p) { if (p._siteAnim && p.activity?.act === 'build' && !p.agent.talking) return p._siteAnim; return _idle.call(this, p); };
    const held = new Set(), dust = []; let t = 0;
    const ROLES = (st) => st < 3 ? ['dig', 'barrow', 'dig'] : st < 6 ? ['scaffold', 'saw', 'hod'] : st < 8 ? ['roof', 'hoist', 'saw'] : ['paint', 'paint', 'sweep'];
    const ANIM = { dig: 'dig', barrow: 'carry', scaffold: 'hammer', saw: 'saw', hod: 'carry', roof: 'hammer', hoist: 'pickup', paint: 'scrub', sweep: 'sweep' };
    const near = (x, y, r) => Math.hypot(x - game.player.x, y - game.player.y) < r;
    function let_go(q) { const a = q.agent; if (a) { a.lift = 0; if (q._siteBase != null && !a.path) a.x = q._siteBase; } q._siteAnim = null; q._siteRole = null; q._siteBase = null; held.delete(q); }
    game.hooks.update.push((dt) => {
      t += dt; for (const d of dust.slice()) { d.t += dt; d.y += 10 * dt; d.x += d.vx * dt; if (d.t > 1) dust.splice(dust.indexOf(d), 1); }
      const s = cur(); if (!s || !s.build) { for (const q of [...held]) let_go(q); return; }
      const using = new Set();
      for (const site of s.build.sites) {
        if (site.stage >= 10 || !site.b) continue; const b = site.b, bz = s.biz.get(site.id); if (!bz) continue;
        const fx = (b.x + b.w / 2) * T, fy = (b.bottom + 2) * T; if (!near(fx, fy, 700) || game.scene) continue;
        const ppl = bz.workers.map((id) => s.byId.get(id)).filter((q) => q && q.alive !== false && q.agent && q.activity?.act === 'build' && !q.agent.path && !q.agent.frozen && q.agent.inside == null && Math.abs(q.agent.x - fx) < b.w * T && Math.abs(q.agent.y - fy) < 60).sort((x, y) => x.id - y.id);
        const roles = ROLES(site.stage);
        ppl.forEach((q, i) => {
          const role = roles[i % roles.length], a = q.agent; using.add(q); held.add(q);
          if (q._siteRole !== role) { if (q._siteBase != null) a.x = q._siteBase; q._siteRole = role; q._siteBase = a.x; q._siteT = Math.random() * 6; }
          q._siteT += dt; q._siteAnim = ANIM[role];
          const lift = role === 'scaffold' ? (site.stage >= 5 ? 30 : 16) : role === 'roof' ? 36 : role === 'paint' && i === 0 ? 14 : 0; a.lift = a.talking ? 0 : lift;
          if (role === 'barrow' || role === 'hod') { const span = role === 'barrow' ? 34 : 26, k = Math.sin(q._siteT * 0.7); a.x = q._siteBase + k * span; a.dir = Math.cos(q._siteT * 0.7) > 0 ? 2 : 1; q._siteLoad = (role === 'barrow') === (Math.cos(q._siteT * 0.7) > 0); }
          else if (role === 'saw') { a.dir = 2; if (Math.random() < dt * 8) dust.push({ x: a.x + 14 + (Math.random() - 0.5) * 4, y: a.y - 8, vx: (Math.random() - 0.5) * 8, t: 0 }); }
          else a.dir = role === 'hoist' ? 1 : 3;
          if ((role === 'scaffold' || role === 'roof') && Math.random() < dt * 1.5 && near(a.x, a.y, 240)) O.sfx && O.sfx('smack', 0.1);
          if (role === 'saw' && Math.random() < dt * 0.8 && near(a.x, a.y, 200)) O.sfx && O.sfx('saw', 0.12);
          if (Math.random() < dt * 0.012 && near(a.x, a.y, 240) && O.Speech) O.Speech.say(q, { dig: ['Rock here. Fetch the bar.', 'Deep enough?'], barrow: ['Mind your feet!', 'Coming through.'], scaffold: ['Hand me up the pegs.', 'Hold that plumb line straight.'], saw: ['Keep it on the line.', 'This oak\'s like iron.'], hod: ['Another load. My shoulder.', 'Where d\'you want it?'], roof: ['Don\'t walk under me!', 'Hand me up a batten.'], hoist: ['Heave! And again.', 'Steady, steady.'], paint: ['Not too thick.', 'There. Like new.'], sweep: ['Nearly done.', 'Look at the mess you lot made.'] }[role][Math.floor(Math.random() * 2)], 2.2);
        });
        site._crew = ppl.length;
      }
      for (const q of [...held]) if (!using.has(q)) let_go(q);
    });
    game.hooks.drawWorld.push((ctx, cam) => {
      const s = cur(); if (!s || !s.build || game.scene) return; const tk = performance.now() / 1000, W = ctx.canvas.width, H = ctx.canvas.height;
      for (const site of s.build.sites) {
        if (site.stage >= 10 || !site.b) continue; const b = site.b, bz = s.biz.get(site.id); const x0 = Math.round(b.x * T - cam.x), x1 = Math.round((b.x + b.w) * T - cam.x), fy = Math.round((b.bottom + 1) * T - cam.y); if (x1 < -60 || x0 > W + 60 || fy < -120 || fy > H + 60) continue;
        // timber and stone stacked to one side
        const px = x1 + 10, py = fy + 10, logs = Math.min(8, Math.round(bz?.stock?.logs || 0)), stone = Math.min(8, Math.round(bz?.stock?.stone || 0));
        for (let i = 0; i < logs; i++) { const lx = px + (i % 3) * 3 + Math.floor(i / 3) * 2, ly = py - Math.floor(i / 3) * 3; ctx.fillStyle = '#7a5232'; ctx.fillRect(lx, ly - 3, 14, 3); ctx.fillStyle = '#c8a070'; ctx.fillRect(lx + 13, ly - 3, 1, 3); }
        for (let i = 0; i < stone; i++) { const sx = px + 2 + (i % 4) * 5, sy = py + 10 - Math.floor(i / 4) * 4; ctx.fillStyle = i % 2 ? '#9a968e' : '#a8a49c'; ctx.fillRect(sx, sy - 4, 5, 4); ctx.fillStyle = '#7a766e'; ctx.fillRect(sx, sy - 1, 5, 1); }
        if (site.stage < 3) { ctx.fillStyle = '#6a4a30'; ctx.beginPath(); ctx.moveTo(x0 - 18, fy + 10); ctx.quadraticCurveTo(x0 - 10, fy - 2, x0 - 2, fy + 10); ctx.fill(); }
        // the hoist: a pole and a pulley over the eaves, a load going up and down on its rope
        if (site.stage >= 3 && site.stage < 9 && site._crew) { const hx = x0 - 6, top = fy - 58, k = (Math.sin(tk * 0.6) + 1) / 2, ly = Math.round(fy - 4 - k * 46); ctx.fillStyle = '#8a6239'; ctx.fillRect(hx, top, 2, 60); ctx.fillRect(hx, top, 12, 2); ctx.fillStyle = '#5a4028'; ctx.fillRect(hx + 10, top + 1, 3, 3); ctx.strokeStyle = '#c8b890'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(hx + 11, top + 4); ctx.lineTo(hx + 11, ly); ctx.stroke(); if (site.stage < 6) { ctx.fillStyle = '#7a5a3a'; ctx.fillRect(hx + 8, ly, 7, 6); ctx.fillStyle = '#a8a49c'; ctx.fillRect(hx + 9, ly, 5, 2); } else { ctx.fillStyle = '#7a5232'; ctx.fillRect(hx + 4, ly, 14, 3); } }
        for (const id of bz ? bz.workers : []) {
          const q = s.byId.get(id); if (!q || !q._siteRole || !q.agent) continue; const a = q.agent, ax = Math.round(a.x - cam.x), ay = Math.round(a.y - cam.y), r = q._siteRole;
          if (r === 'barrow') { const d = a.dir === 2 ? 1 : -1, bx = ax + d * 10; ctx.fillStyle = '#7a5a3a'; ctx.fillRect(bx - 6, ay - 8, 12, 5); ctx.fillStyle = '#3a2a1a'; ctx.fillRect(bx + d * 6 - 1, ay - 4, 3, 3); if (q._siteLoad) { ctx.fillStyle = '#6a4a30'; ctx.fillRect(bx - 5, ay - 10, 10, 3); } }
          else if (r === 'hod' && q._siteLoad) { ctx.fillStyle = '#a8a49c'; ctx.fillRect(ax - 2, ay - 30, 6, 4); ctx.fillStyle = '#7a766e'; ctx.fillRect(ax - 2, ay - 27, 6, 1); }
          else if (r === 'saw') { const sx = ax + 14; ctx.fillStyle = '#6a4a2c'; ctx.fillRect(sx - 7, ay - 9, 1, 9); ctx.fillRect(sx + 7, ay - 9, 1, 9); ctx.fillStyle = '#8a6239'; ctx.fillRect(sx - 10, ay - 11, 22, 3); ctx.fillStyle = '#c8a070'; ctx.fillRect(sx + 11, ay - 11, 1, 3); ctx.fillStyle = '#c8ccd4'; const o = Math.round(Math.sin(tk * 10) * 3); ctx.fillRect(sx - 1 + o, ay - 16, 1, 7); }
          else if (r === 'dig') { ctx.fillStyle = '#6a4a30'; ctx.fillRect(ax + 8, ay - 3, 8, 3); ctx.fillRect(ax + 10, ay - 5, 4, 2); }
          else if (r === 'paint' || r === 'sweep') { if (r === 'paint') { ctx.fillStyle = '#7a5a3a'; ctx.fillRect(ax + 8, ay - 6, 6, 6); ctx.fillStyle = '#f0ece0'; ctx.fillRect(ax + 8, ay - 6, 6, 1); } }
        }
      }
      ctx.fillStyle = '#e8d0a0'; for (const d of dust) ctx.fillRect(Math.round(d.x - cam.x), Math.round(d.y - cam.y), 1, 1);
    });
    O.SiteWork = { held };
  }
  O.SiteWorkSetup = { setup };
})();
