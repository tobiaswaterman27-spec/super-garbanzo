// The bread dole. When the parish buys bread for the families who have nothing, it's handed out at the
// bakery door: a little queue of the poor forms, shabby and quiet, each waiting their turn; the baker (or
// the reeve's man) hands each their loaves, they say "God bless you" and go off home with the bread held
// to the chest, and a few of them can't wait and tear a piece off as they go.
'use strict';
(function () {
  const T = 16;
  function setup(game) {
    const cur = () => O.SimRef.cur, SP = O.Sim.prototype;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    let D = null, doles = 0; const pending = [];
    const near = (x, y, r) => Math.hypot(x - game.player.x, y - game.player.y) < r;
    const talking = (q) => O.npcUI && O.npcUI.talking && O.npcUI.talking() === q;
    const _relief = SP.parishRelief;
    if (_relief) SP.parishRelief = function () { const before = new Map(this.households.map((hh) => [hh, hh.pantry ? hh.pantry.bread : 0])); const r = _relief.apply(this, arguments); try { const fed = this.households.filter((hh) => hh.pantry && hh.pantry.bread > (before.get(hh) || 0)); if (fed.length) pending.push({ s: this, fed, day: this.day }); } catch (e) { /* */ } return r; };
    function end() { if (!D) return; for (const q of D.queue) { if (!q.agent) continue; q.agent.forceAnim = null; if (!talking(q)) q.agent.frozen = false; q._dole = false; } if (D.giver && D.giver.agent) { D.giver.agent.forceAnim = null; if (!talking(D.giver)) D.giver.agent.frozen = false; D.giver._dole = false; } D = null; }
    game.hooks.update.push((dt) => {
      const s = cur(); if (!s || !s.world || game.scene) return; const hr = s.minute / 60;
      if (D) { D.t += dt; if (D.s !== s || D.t > 120 || D.queue.some(talking)) { end(); return; }
        const x = D.x, y = D.y; D.giver.agent.forceAnim = D.handing > 0 ? 'give' : 'idle';
        // the queue shuffles up; the one at the front takes the bread and goes
        D.queue.forEach((q, i) => { const a = q.agent; if (!a.frozen) return; const tx = x - 12 - i * 11, ty = y + 2; a.x += (tx - a.x) * Math.min(1, dt * 3); a.y += (ty - a.y) * Math.min(1, dt * 3); a.dir = 2; a.forceAnim = i === 0 && D.handing > 0 ? 'take' : (Math.floor(D.t / 4 + i) % 4 === 3 ? 'look' : 'idle'); });
        D.next -= dt; if (D.handing > 0) D.handing -= dt;
        if (D.next <= 0 && D.queue.length) { D.next = 6; D.handing = 2; const q = D.queue[0]; setTimeout(() => { if (!D || D.queue[0] !== q) return; near(x, y, 300) && O.Speech && O.Speech.say(q, pick(['God bless you.', 'Thank you. The children haven\'t eaten since yesterday.', 'Bless the parish.']), 2.4); D.queue.shift(); const a = q.agent; a.forceAnim = null; a.frozen = false; q._dole = false; a.carrying = { good: 'bread', qty: 2 }; const hb = s.building(q.home); if (hb && hb.doorX != null) O.Errands.send(s, q, [hb.doorX, hb.doorY + 1], { anim: 'place', secs: 0.8, face: 0, giveUp: game.t + 90, carry: { good: 'bread', qty: 2 } }); doles++; }, 1800); }
        if (!D.queue.length && D.handing <= 0 && D.t > 4) end();
        return; }
      if (!pending.length) return; const P0 = pending[0]; if (P0.s !== s || s.day - P0.day > 1) { pending.shift(); return; } if (hr < 8 || hr > 17) return;
      const bz = s.supplierOf ? s.supplierOf('bakery') : null; const b = bz && s.building(bz.b?.id ?? bz.id); if (!b || b.doorX == null || !near(b.doorX * T, b.doorY * T, 480)) return;
      const giver = (bz.workers || []).map((id) => s.byId.get(id)).find((q) => q && q.agent && !q.agent.frozen && !q.errand && !talking(q)); if (!giver) return;
      const queue = []; for (const hh of P0.fed) { const q = hh.members.map((id) => s.byId.get(id)).find((p) => p && p.alive !== false && p.age >= 10 && p.agent && !p.agent.frozen && !p.errand && !p._bit && !talking(p)); if (q) queue.push(q); if (queue.length >= 5) break; }
      if (!queue.length) { pending.shift(); return; } pending.shift();
      const x = b.doorX * T + 8, y = (b.doorY + 1) * T + 8;
      const ga = giver.agent; if (ga.inside != null) { ga.inside = null; ga.hidden = false; } ga.x = x + 6; ga.y = y; ga.frozen = true; ga.path = null; ga.dir = 1; giver._dole = true;
      for (const [i, q] of queue.entries()) { const a = q.agent; if (a.inside != null) { const hb = s.building(a.inside); if (hb && hb.doorX != null) { a.x = hb.doorX * T + 8; a.y = (hb.doorY + 1) * T + 8; } a.inside = null; a.hidden = false; } q._dole = true; O.Errands.send(s, q, [b.doorX - 1 - i, b.doorY + 1], { anim: 'idle', secs: 0.1, face: 2, giveUp: game.t + 60, after: (ok) => { if (!ok || !D) { q._dole = false; if (D) D.queue.splice(D.queue.indexOf(q), 1); return; } q.agent.frozen = true; q.agent.path = null; } }); }
      D = { s, x, y, giver, queue, t: 0, next: 8, handing: 0 };
    });
    game.hooks.drawWorld.push((ctx, cam) => { if (!D || game.scene || D.s !== cur()) return; const x = Math.round(D.x - cam.x), y = Math.round(D.y - cam.y); ctx.fillStyle = '#8a6239'; ctx.fillRect(x + 12, y - 8, 8, 6); for (let i = 0; i < Math.max(1, 5 - doles % 5); i++) { ctx.fillStyle = '#c89a5a'; ctx.fillRect(x + 12 + (i % 3) * 2, y - 10 - Math.floor(i / 3) * 2, 3, 2); } });
    (O.extraLines = O.extraLines || []).push((s, q) => D && D.queue.includes(q) ? 'You are standing in the queue at the bakery door for the parish bread. You have nothing else to eat, and you are ashamed.' : D && D.giver === q ? 'You are handing out the parish bread to the poor at your door.' : '');
    O.BreadDole = { get dole() { return D; }, get doles() { return doles; }, pending };
  }
  O.BreadDoleSetup = { setup };
})();
