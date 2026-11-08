// After the rain, the puddles. Children can't pass one: they run to it and jump in with both feet, again
// and again, the water flying up round them, shrieking, until a mother at a door shouts about the state of
// their clothes and they run off giggling and dripping.
'use strict';
(function () {
  const T = 16;
  function setup(game) {
    const cur = () => O.SimRef.cur;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    const jumps = [], drops = []; let cool = 5, total = 0;
    const near = (x, y, r) => Math.hypot(x - game.player.x, y - game.player.y) < r;
    const KIDACTS = ['play', 'stroll', 'idle', 'home', 'socialise', 'pastime-none'];
    const free = (q) => q && q.alive !== false && q.agent && !q.agent.hidden && q.agent.inside == null && !q.agent.frozen && !q.errand && !q._bit && !q._scene && !q._playing && !q._puddle && !(O.npcUI && O.npcUI.talking && O.npcUI.talking() === q) && q.activity && KIDACTS.includes(q.activity.act);
    const puddleAt = (w, tx, ty) => { const t = w.ter[ty * w.W + tx]; if (t !== w.TER.ROAD && t !== w.TER.COBBLE && t !== w.TER.YARD) return false; const hsh = (tx * 73856093) ^ (ty * 19349663); return ((hsh >>> 0) % 19) === 0 && !w.solid[ty * w.W + tx]; };
    function release(J) { const a = J.q.agent; if (a) { a.forceAnim = null; a.lift = 0; if (!(O.npcUI && O.npcUI.talking && O.npcUI.talking() === J.q)) a.frozen = false; } J.q._puddle = false; jumps.splice(jumps.indexOf(J), 1); }
    game.hooks.update.push((dt) => {
      for (const d of drops.slice()) { d.t += dt; d.x += d.vx * dt; d.y += d.vy * dt; d.vy += 220 * dt; if (d.t > 0.6) drops.splice(drops.indexOf(d), 1); }
      const s = cur(); if (!s || !s.world || game.scene) return; const W = s.weather || {}, wet = W.wet || 0, frozen = s.season === 'winter' && (W.kind === 'snow' || s.hour < 9);
      for (const J of jumps.slice()) {
        J.t += dt; const a = J.q.agent;
        if (J.s !== s || !a || J.t > J.len || (O.npcUI && O.npcUI.talking && O.npcUI.talking() === J.q)) { if (J.s === s && J.t > J.len && J.scold) { O.Speech && near(a.x, a.y, 260) && O.Speech.say(J.q, pick(['Sorry, Mam!', 'Wasn\'t me!', 'Hee hee!']), 1.8); } release(J); continue; }
        const ph = (J.t * 2.2) % 1; a.forceAnim = 'celebrate'; a.lift = Math.round(Math.sin(ph * Math.PI) * 5);
        if (ph < J.lastPh) { for (let i = 0; i < 10; i++) drops.push({ x: a.x + (Math.random() - 0.5) * 6, y: a.y - 1, vx: (Math.random() - 0.5) * 80, vy: -40 - Math.random() * 60, t: 0 }); J.splash = 0.25; if (near(a.x, a.y, 220)) O.sfx && O.sfx('splash', 0.22); if (!J.shrieked && Math.random() < 0.3) { J.shrieked = 1; near(a.x, a.y, 260) && O.Speech && O.Speech.say(J.q, pick(['Wheee!', 'Splash!', 'Bigger one!', 'Look how high!']), 1.6); } }
        J.lastPh = ph; if (J.splash > 0) J.splash -= dt;
        if (!J.scold && J.t > J.len - 3) { J.scold = true; const mum = s.people.find((x) => x.home === J.q.home && x.sex === 'f' && x.age > 20 && x.agent && !x.agent.hidden && x.agent.inside == null && Math.hypot(x.agent.x - a.x, x.agent.y - a.y) < 200); if (mum && near(a.x, a.y, 300)) O.Speech && O.Speech.say(mum, pick([`${J.q.first}! Look at the state of you!`, 'Out of that puddle this minute!', 'Who\'s going to wash those?']), 2.4); }
      }
      cool -= dt; if (cool > 0) return; cool = 6 + Math.random() * 6;
      if (wet < 0.15 || frozen || (game.isNight && game.isNight()) || jumps.filter((j) => j.s === s).length >= 3) return;
      const P = game.player, w = s.world, kids = s.people.filter((q) => free(q) && q.age >= 4 && q.age <= 11 && Math.hypot(q.agent.x - P.x, q.agent.y - P.y) < 420); if (!kids.length) return;
      const q = pick(kids), tx0 = Math.floor(q.agent.x / T), ty0 = Math.floor(q.agent.y / T); let best = null, bd = 1e9;
      for (let ty = ty0 - 10; ty <= ty0 + 10; ty++) for (let tx = tx0 - 12; tx <= tx0 + 12; tx++) { if (tx < 1 || ty < 1 || tx >= w.W - 1 || ty >= w.H - 1 || !puddleAt(w, tx, ty)) continue; if (jumps.some((j) => j.tx === tx && j.ty === ty)) continue; const d = Math.abs(tx - tx0) + Math.abs(ty - ty0); if (d < bd) { bd = d; best = [tx, ty]; } }
      if (!best) return; q._puddle = true;
      O.Errands.send(s, q, best, { anim: 'idle', secs: 0.1, face: 0, sprint: true, giveUp: game.t + 25, after: (ok) => { if (!ok || !q.agent) { q._puddle = false; return; } const a = q.agent; a.frozen = true; a.path = null; a.x = best[0] * T + 8; a.y = best[1] * T + 9; jumps.push({ s, q, tx: best[0], ty: best[1], t: 0, len: 10 + Math.random() * 10, lastPh: 0, splash: 0 }); total++; } });
    });
    game.hooks.drawWorld.push((ctx, cam) => {
      const s = cur(); if (!s || game.scene) return;
      for (const J of jumps) if (J.s === s && J.splash > 0) { const a = J.q.agent, x = Math.round(a.x - cam.x), y = Math.round(a.y - cam.y); ctx.strokeStyle = `rgba(220,235,250,${J.splash * 3})`; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(x, y + 1, 10 - J.splash * 16, 3, 0, 0, Math.PI * 2); ctx.stroke(); }
      ctx.fillStyle = 'rgba(200,220,240,0.85)'; for (const d of drops) ctx.fillRect(Math.round(d.x - cam.x), Math.round(d.y - cam.y), 1, 1);
    });
    (O.extraLines = O.extraLines || []).push((s, q) => q._puddle ? 'You are jumping in a puddle, splashing, and you are soaked and delighted.' : '');
    O.Puddles = { jumps, get total() { return total; } };
  }
  O.PuddlesSetup = { setup };
})();
