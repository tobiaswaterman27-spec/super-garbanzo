// The gangs' own rites, out at their haunt of an evening. A new recruit is "jumped in": the others
// close round, shove and cuff him about for a count of ten while he takes it, and then it's back-
// slaps and a cheer and he's one of them. And on the night after a good job the boss comes down,
// they straighten up as he passes, and he counts the take out into each hand.
'use strict';
(function () {
  function setup(game) {
    const cur = () => O.SimRef.cur;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    const say = (q, t, secs) => O.Speech && O.Speech.say(q, t, secs || 1.8);
    const near = (x, y, r) => Math.hypot(x - game.player.x, y - game.player.y) < r;
    let rite = null, cool = 20;
    const hold = (q) => { q._rite = true; q.agent.frozen = true; q.agent.path = null; };
    const free = (q) => { q._rite = false; q.agent.forceAnim = null; const tq = O.npcUI && O.npcUI.talking && O.npcUI.talking(); if (tq !== q) q.agent.frozen = false; };
    const out = (q) => q && q.alive !== false && q.agent && !q.agent.hidden && q.agent.inside == null && !q.agent.frozen && !q.errand && !q._fighting && !q.jailUntil && !(O.npcUI && O.npcUI.talking && O.npcUI.talking() === q);
    function begin(s, force) {
      const gangs = (s.npcGangs ? s.npcGangs() : []).filter((g) => g.members && g.members.length >= 3);
      for (const g of gangs) {
        const here = g.members.map((m) => s.byId.get(m.id)).filter((q) => out(q) && near(q.agent.x, q.agent.y, 420));
        if (here.length < 3) continue;
        const fresh = here.find((q) => { const m = g.members.find((x) => x.id === q.id); return m && (s.day - (m.joined ?? -99)) <= 4 && !m.jumped; });
        const boss = here.find((q) => q.id === g.leader);
        const c = here.reduce((a, q) => [a[0] + q.agent.x / here.length, a[1] + q.agent.y / here.length], [0, 0]);
        if (fresh && (force !== 'pay')) { const crew = here.filter((q) => q !== fresh).slice(0, 5); [fresh, ...crew].forEach(hold); g.members.find((x) => x.id === fresh.id).jumped = true; rite = { kind: 'jump', s, g, fresh, crew, c, t: 0 }; say(pick(crew), pick([`Right, ${fresh.first}. Ten count. Don't go down.`, 'Time you earned that cap.', 'Hold still, new boy.']), 2); return rite; }
        if ((boss && (g.recentJobs || 0) > 0 && (g.purse || 0) > 20) || force === 'pay') { const b = boss || here[0]; const crew = here.filter((q) => q !== b).slice(0, 5); if (!crew.length) continue; [b, ...crew].forEach(hold); rite = { kind: 'pay', s, g, boss: b, crew, c, t: 0, i: 0 }; g.recentJobs = 0; say(b, pick(['Good work, lads. Line up.', 'Here\'s your cut. Don\'t drink it all at once.', 'The take. Every penny counted.']), 2); return rite; }
      }
      return null;
    }
    function end() { const r = rite; if (!r) return; for (const q of [r.fresh, r.boss, ...r.crew]) if (q) free(q); rite = null; cool = 120; }
    function step(q, tx, ty, dt, sp) { const a = q.agent, dx = tx - a.x, dy = ty - a.y, d = Math.hypot(dx, dy); if (d < 2) return true; const st = Math.min(d, sp * dt), nx = a.x + dx / d * st, ny = a.y + dy / d * st; if (!game.solidAt(nx, ny - 2)) { a.x = nx; a.y = ny; } else return true; a.dir = O.dirOf(dx, dy); a.forceAnim = 'walk'; return false; }
    game.hooks.update.push((dt) => {
      const s = cur(); if (!s) return;
      if (!rite) { cool -= dt; if (cool > 0 || game.scene) return; cool = 10; const h = s.minute / 60; if (h >= 19 && h < 23.5) begin(s); return; }
      const r = rite; r.t += dt; if (r.s !== s || game.scene || r.t > 40) { end(); return; }
      if ([r.fresh, r.boss, ...r.crew].some((q) => q && O.npcUI && O.npcUI.talking && O.npcUI.talking() === q)) return;
      const [cx, cy] = r.c;
      if (r.kind === 'jump') {
        const fa = r.fresh.agent; step(r.fresh, cx, cy, dt, 30);
        r.crew.forEach((q, i) => { const ang = i / r.crew.length * Math.PI * 2, tx = cx + Math.cos(ang) * 14, ty = cy + Math.sin(ang) * 9; if (step(q, tx, ty, dt, 40)) { q.agent.dir = O.dirOf(fa.x - q.agent.x, fa.y - q.agent.y); if (r.t > 2 && r.t < 10) q.agent.forceAnim = (Math.floor(r.t * 3 + i) % 3 === 0) ? 'attack' : 'celebrate'; } });
        if (r.t > 2 && r.t < 10) { fa.forceAnim = Math.floor(r.t * 4) % 2 ? 'hurt' : 'block'; if (Math.random() < dt * 3 && near(fa.x, fa.y, 260)) O.sfx && O.sfx('smack', 0.25); const cnt = Math.floor(r.t - 1); if (cnt !== r.cnt && cnt <= 8) { r.cnt = cnt; say(pick(r.crew), String(cnt + 1) + '!', 0.8); } }
        if (r.t > 10 && !r.done) { r.done = true; fa.forceAnim = 'celebrate'; for (const q of r.crew) q.agent.forceAnim = pick(['celebrate', 'laugh', 'celebrate']); say(pick(r.crew), pick([`He's in! ${r.fresh.first}, you're one of us!`, 'Ten! Didn\'t go down! Good lad!', `Welcome to ${r.g.name}.`]), 2.2); setTimeout(() => say(r.fresh, pick(['...Is that it?', 'Ow. Thanks. I think.', 'I\'m in!']), 1.6), 1400); r.s.relate(r.fresh, pick(r.crew), 0.1); }
        if (r.t > 14) end();
      } else {
        const ba = r.boss.agent; ba.forceAnim = 'idle';
        r.crew.forEach((q, i) => { const tx = cx - 20 + i * 10, ty = cy + 12; if (step(q, tx, ty, dt, 34)) { q.agent.dir = 3; if (q.agent.forceAnim === 'walk') q.agent.forceAnim = 'nod'; } });
        if (r.t > 2.5) { const k = Math.floor((r.t - 2.5) / 1.6); if (k < r.crew.length && k !== r.i - 1) { r.i = k + 1; const q = r.crew[k]; const cut = Math.max(1, Math.floor((r.g.purse || 0) * 0.04)); r.g.purse = Math.max(0, (r.g.purse || 0) - cut); const hh = r.s.household(q); if (hh) hh.money += cut; ba.forceAnim = 'give'; q.agent.forceAnim = 'take'; r.coin = { x0: ba.x, y0: ba.y - 12, x1: q.agent.x, y1: q.agent.y - 12, t: 0 }; if (near(ba.x, ba.y, 260)) O.sfx && O.sfx('kaching', 0.12); if (Math.random() < 0.4) say(q, pick(['Thanks, boss.', 'That all?', 'Lovely.']), 1.2); }
          if (k >= r.crew.length + 1) end(); }
        if (r.coin) { r.coin.t += dt; if (r.coin.t > 0.4) r.coin = null; }
      }
    });
    game.hooks.drawWorld.push((ctx, cam) => { const r = rite; if (!r || !r.coin || game.scene) return; const c = r.coin, k = c.t / 0.4; ctx.fillStyle = '#e0c050'; ctx.fillRect(Math.round(c.x0 + (c.x1 - c.x0) * k - cam.x), Math.round(c.y0 + (c.y1 - c.y0) * k - Math.sin(k * Math.PI) * 6 - cam.y), 3, 2); });
    (O.extraLines = O.extraLines || []).push((s, q) => { const r = rite; if (!r || !q._rite) return ''; return r.kind === 'jump' ? (q === r.fresh ? 'You are being "jumped in" to your gang: the others cuff you about for a count of ten. You are bruised and proud.' : `You are jumping in ${r.fresh.first}, the gang's new recruit. It's rough, but friendly enough.`) : (q === r.boss ? 'You are paying the gang their cut of the take, coin by coin, at the haunt.' : 'The boss is paying out your cut of the take at the haunt. You are pleased.'); });
    O.GangRites = { start: (k) => begin(cur(), k), get rite() { return rite; } };
  }
  O.GangRitesSetup = { setup };
})();
