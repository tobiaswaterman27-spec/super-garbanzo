// What people do in the rain. Those who must be out pull a sack or a fold of cloak up over their heads and
// hurry, mud flicking up from their heels on the roads; those with nowhere to be duck into the nearest
// doorway and stand there under the eaves, looking up at the sky and holding out a hand to see if it's
// easing, until it does.
'use strict';
(function () {
  const T = 16;
  function setup(game) {
    const cur = () => O.SimRef.cur;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    const shelters = [], mud = []; let cool = 3, t = 0, sheltered = 0;
    const near = (x, y, r) => Math.hypot(x - game.player.x, y - game.player.y) < r;
    const talking = (q) => O.npcUI && O.npcUI.talking && O.npcUI.talking() === q;
    const COVER = ['#6a5a40', '#5a4a3a', '#4a4a5a', '#7a6a4a', '#3a4a3a'];
    function release(S) { const a = S.q.agent; if (a) { a.forceAnim = null; if (!talking(S.q)) a.frozen = false; } S.q._rain = false; shelters.splice(shelters.indexOf(S), 1); }
    game.hooks.update.push((dt) => {
      for (const m of mud.slice()) { m.t += dt; m.x += m.vx * dt; m.y += m.vy * dt; m.vy += 160 * dt; if (m.t > 0.35) mud.splice(mud.indexOf(m), 1); }
      const s = cur(); if (!s || !s.world || game.scene) return; const raining = s.raining, P = game.player, w = s.world;
      for (const S of shelters.slice()) { S.t += dt; const a = S.q.agent; if (S.s !== s || !a || (!raining && S.t > 4) || S.t > (S.max || 240) || talking(S.q)) { if (!raining && a && near(a.x, a.y, 240) && Math.random() < 0.4) O.Speech && O.Speech.say(S.q, pick(['There. It\'s easing.', 'Back to it, then.', 'Wet enough for ducks.']), 2); release(S); continue; } a.forceAnim = Math.floor(S.t / 5) % 4 === 1 ? 'look' : Math.floor(S.t / 5) % 7 === 3 ? 'point' : 'idle'; a.dir = 0; }
      if (!raining) return;
      // mud flicking from the heels on the roads
      t += dt; if (t > 0.15) { t = 0; for (const q of s.people) { const a = q.agent; if (!a || a.hidden || a.inside != null || !a.path || !near(a.x, a.y, 300)) continue; const i = Math.floor(a.y / T) * w.W + Math.floor(a.x / T); if (w.ter[i] !== w.TER.ROAD && w.ter[i] !== w.TER.YARD) continue; if (Math.random() < 0.5) mud.push({ x: a.x + (Math.random() - 0.5) * 4, y: a.y - 1, vx: (Math.random() - 0.5) * 30, vy: -25 - Math.random() * 20, t: 0 }); } }
      cool -= dt; if (cool > 0) return; cool = 2 + Math.random() * 3;
      if (shelters.filter((x) => x.s === s).length >= 6) return;
      const q = s.people.find((x) => x.agent && !x.agent.hidden && x.agent.inside == null && !x.agent.frozen && !x.errand && !x._rain && !x._bit && !x._scene && !talking(x) && x.age >= 6 && (['stroll', 'idle', 'socialise', 'play', 'wait-work', 'pastime-none'].includes(x.activity?.act) || (x.activity?.act === 'home' && x.agent.path && Math.random() < 0.25)) && near(x.agent.x, x.agent.y, 420)); if (!q) return;
      let best = null, bd = 1e9; for (const b of w.buildings) { if (b.doorX == null || b.site || b.ruined) continue; const d = Math.hypot(b.doorX * T - q.agent.x, b.doorY * T - q.agent.y); if (d < bd && !shelters.some((S) => S.b === b)) { bd = d; best = b; } }
      if (!best || bd > 260) return; const side = Math.random() < 0.5 ? -1 : 1, tx = best.doorX + (w.solid[(best.doorY + 1) * w.W + best.doorX + side] ? 0 : side), ty = best.doorY + 1; q._rain = true;
      O.Errands.send(s, q, [tx, ty], { anim: 'idle', secs: 0.1, face: 0, sprint: true, giveUp: game.t + 25, after: (ok) => { if (!ok || !q.agent) { q._rain = false; return; } q.agent.frozen = true; q.agent.path = null; q.agent.y = best.doorY * T + 20; shelters.push({ s, q, b: best, t: 0, max: q.activity?.act === 'home' ? 20 + Math.random() * 20 : 240 }); sheltered++; if (Math.random() < 0.3 && near(q.agent.x, q.agent.y, 260)) O.Speech && O.Speech.say(q, pick(['Look at it come down!', 'I\'ll wait it out here.', 'Soaked to the skin.']), 2.2); } });
    });
    game.hooks.drawWorld.push((ctx, cam) => {
      const s = cur(); if (!s || game.scene) return;
      ctx.fillStyle = '#6a5038'; for (const m of mud) ctx.fillRect(Math.round(m.x - cam.x), Math.round(m.y - cam.y), 1, 1);
      if (!s.raining) return;
      // a sack or a fold of cloak over the head of those hurrying through it
      const P = game.player; for (const q of s.people) { const a = q.agent; if (!a || a.hidden || a.inside != null || !a.path || q.age < 8 || (q.id % 5) > 2 || Math.abs(a.x - P.x) > 420 || Math.abs(a.y - P.y) > 300) continue; if (O.occluded && O.occluded(a.x, a.y)) continue; const x = Math.round(a.x - cam.x), y = Math.round(a.y - cam.y) - (a.lift || 0) - (q.age < 13 ? 26 : 33); ctx.fillStyle = COVER[q.id % COVER.length]; ctx.fillRect(x - 6, y, 12, 3); ctx.fillRect(x - 7, y + 2, 2, 7); ctx.fillRect(x + 5, y + 2, 2, 7); ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fillRect(x - 6, y, 12, 1); }
    });
    (O.extraLines = O.extraLines || []).push((s, q) => q._rain ? 'You are sheltering from the rain in a doorway, waiting for it to ease.' : '');
    O.RainFolk = { shelters, get sheltered() { return sheltered; } };
  }
  O.RainFolkSetup = { setup };
})();
