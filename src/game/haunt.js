// The gang at its haunt. Of an evening, when a gang's members gather at their corner by the tavern,
// you see them at it: crouched in a ring round a lantern on the ground, dice rattled in a cup and
// thrown into the dirt, the pot of coins in the middle growing and changing hands, a whoop, a curse,
// a shove when someone's luck is too good.
'use strict';
(function () {
  function setup(game) {
    const cur = () => O.SimRef.cur;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    const rings = new Map();
    let scan = 0;
    game.hooks.update.push((dt) => {
      const s = cur(); if (!s || game.scene) { rings.clear(); return; } scan -= dt;
      if (scan <= 0) { scan = 1.5; const by = new Map();
        for (const q of s.people) { const z = q.activity && q.activity.zone; if (!z || typeof z !== 'string' || !z.startsWith('haunt:') || !q.agent || q.agent.hidden || q.agent.inside != null || q.agent.path) continue; if (Math.hypot(q.agent.x - game.player.x, q.agent.y - game.player.y) > 420) continue; if (!by.has(z)) by.set(z, []); by.get(z).push(q); }
        for (const [z, ppl] of by) { if (ppl.length < 3) { const a0 = ppl[0].agent; for (const o of s.people) { if (ppl.length >= 3) break; if (ppl.includes(o) || !o.agent || o.agent.hidden || o.agent.inside != null || o.agent.path || o.agent.frozen || o.age < 15 || o.visitor || !o.activity || !['socialise', 'stroll', 'idle', 'eat-out'].includes(o.activity.act) || Math.hypot(o.agent.x - a0.x, o.agent.y - a0.y) > 70) continue; ppl.push(o); } } // (a punter or two from the tavern door)
          if (ppl.length < 2) { rings.delete(z); continue; } const r = rings.get(z) || { ppl: [], t: 0, turn: 0, pot: 0, dice: null, wait: 1.5 }; r.ppl = ppl.slice(0, 5); r.c = [ppl.reduce((a, q) => a + q.agent.x, 0) / ppl.length, ppl.reduce((a, q) => a + q.agent.y, 0) / ppl.length + 6]; rings.set(z, r); }
        for (const z of [...rings.keys()]) if (!by.has(z)) rings.delete(z); }
      for (const r of rings.values()) { r.t += dt; const n = r.ppl.length;
        r.ppl.forEach((q, i) => { if (O.npcUI && O.npcUI.talking && O.npcUI.talking() === q) return; const a = q.agent; a.dir = O.dirOf(r.c[0] - a.x, r.c[1] - a.y); if (!a.forceAnim || a.forceAnim === 'idle') a.forceAnim = 'crouch'; });
        if (r.dice) { r.dice.t += dt; if (r.dice.t > 0.6 && !r.dice.done) { r.dice.done = true; const tot = r.dice.v[0] + r.dice.v[1], thrower = r.dice.by; if (tot >= 9 || tot === 7) { thrower.agent.forceAnim = 'celebrate'; O.Speech && O.Speech.say(thrower, pick([`${tot}! Mine!`, 'Ha! Pay up, the lot of you.', 'Lady Luck loves me.']), 1.6); r.pot = 0; } else { thrower.agent.forceAnim = 'shake'; if (Math.random() < 0.4) O.Speech && O.Speech.say(thrower, pick(['Curse these bones.', `${tot}. Again.`, 'Loaded, these are.']), 1.4); r.pot += n; if (Math.random() < 0.12 && n > 2) { const o = pick(r.ppl.filter((x) => x !== thrower)); o.agent.forceAnim = 'attack'; thrower.agent.forceAnim = 'hurt'; O.sfx && O.sfx('smack', 0.2); } } setTimeout(() => { for (const q of r.ppl) if (['celebrate', 'shake', 'attack', 'hurt'].includes(q.agent.forceAnim)) q.agent.forceAnim = 'crouch'; }, 1300); } if (r.dice.t > 3) r.dice = null; continue; }
        r.wait -= dt; if (r.wait > 0) continue; r.wait = 3 + Math.random() * 2; const q = r.ppl[r.turn++ % n]; q.agent.forceAnim = 'attack'; r.dice = { by: q, x0: q.agent.x, y0: q.agent.y - 10, t: 0, v: [1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)] }; r.pot += 1;
        if (Math.hypot(q.agent.x - game.player.x, q.agent.y - game.player.y) < 200) O.sfx && O.sfx('place', 0.15); }
      // release anyone no longer in a ring
      for (const q of s.people) if (q.agent && q.agent.forceAnim === 'crouch' && !(q.activity && typeof q.activity.zone === 'string' && q.activity.zone.startsWith('haunt:')) && !q._bit && !q._front && !q._spar) q.agent.forceAnim = null;
    });
    game.hooks.drawWorld.push((ctx, cam) => {
      if (game.scene) return; const night = game.isNight && game.isNight(), tk = performance.now() / 1000;
      for (const r of rings.values()) { const x = Math.round(r.c[0] - cam.x), y = Math.round(r.c[1] - cam.y);
        if (night) { ctx.fillStyle = '#2a2a30'; ctx.fillRect(x + 8, y - 6, 4, 6); ctx.fillStyle = Math.floor(tk * 8) % 3 ? '#ffc050' : '#ffa830'; ctx.fillRect(x + 9, y - 5, 2, 3); }
        ctx.fillStyle = '#c8a030'; for (let i = 0; i < Math.min(12, r.pot); i++) ctx.fillRect(x - 6 + (i % 4) * 2, y - 1 - Math.floor(i / 4), 2, 1);
        if (r.dice) { const d = r.dice, k = Math.min(1, d.t / 0.6), dx = d.x0 + (r.c[0] - d.x0) * k, dy = d.y0 + (r.c[1] - 2 - d.y0) * k - Math.sin(k * Math.PI) * 8; for (let i = 0; i < 2; i++) { const px = Math.round(dx - cam.x) + i * 4, py = Math.round(dy - cam.y); ctx.fillStyle = '#efe8d8'; ctx.fillRect(px, py, 3, 3); if (k >= 1) { ctx.fillStyle = '#1a1a1a'; ctx.fillRect(px + 1, py + 1, 1, 1); } } } }
    });
    (O.extraLines = O.extraLines || []).push((s, q) => { for (const r of rings.values()) if (r.ppl.includes(q)) return `You are crouched at dice with your gang at your corner; there's ₳${r.pot} in the pot. The player could join in if they've coin.`; return ''; });
    O.Haunt = { rings };
  }
  O.HauntSetup = { setup };
})();
