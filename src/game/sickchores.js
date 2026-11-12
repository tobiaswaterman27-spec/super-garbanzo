// When the house is sick. Someone lies ill at home and the jobs that keep a house going stop: the axe is
// left in the chopping block, the water bucket stands empty by the door, the hens go unfed. You can see it
// from the lane. A good neighbour comes over, splits a few logs, carries water in, and goes home again; or
// you do: a quarter hour's work at their door, and a household that won't forget it (and a patient who
// mends a little quicker for a warm hearth and a full jug).
'use strict';
(function () {
  const T = 16;
  function setup(game) {
    const cur = () => O.SimRef.cur, PS = O.PlayerState;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    const say = (q, t, secs) => O.Speech && O.Speech.say(q, t, secs || 2.2);
    const near = (x, y, r) => Math.hypot(x - game.player.x, y - game.player.y) < r;
    const talking = (q) => O.npcUI && O.npcUI.talking && O.npcUI.talking() === q;
    const free = (q) => q && q.alive !== false && q.agent && !q.agent.hidden && q.agent.inside == null && !q.agent.frozen && !q.errand && !q._bit && !q._scene && !q._sickhelp && !q.visitor && !talking(q);
    const relOf = (q) => { const r = q.rel.get(0) || { affinity: 0, familiar: 0 }; q.rel.set(0, r); return r; };
    const ill = (q) => q && q.alive !== false && q.health && q.health.illness && q.health.illness.sev > 0.2;
    const done = new Map(); // household id -> day the chores were done
    let J = null, acc = 0, byYou = 0, byNpc = 0;
    // houses near you where someone lies ill, and nobody's done the chores today
    const needy = (s) => { const out = []; for (const h of s.households || []) { if (!h || h.gone || !h.members || !h.members.length || done.get(h.id) === s.day) continue; const ms = h.members.map((id) => s.byId.get(id)).filter(Boolean); const sick = ms.find((q) => ill(q) && q.age >= 16); if (!sick) continue; const b = sick.home != null && s.building(sick.home); if (!b || b.doorX == null || !near(b.doorX * T, b.doorY * T, 420)) continue; const well = ms.filter((q) => !ill(q) && q.age >= 14 && q.alive !== false); if (well.length >= 2) continue; out.push({ h, sick, b }); } return out; };
    const spot = (b) => [b.doorX * T + 8 + 22, (b.doorY + 1) * T + 6]; // the chopping block, beside the door
    function finish(s, n, who) { const { h, sick, b } = n; done.set(h.id, s.day); h.pantry = h.pantry || {}; h.pantry.firewood = (h.pantry.firewood || 0) + 2; if (sick.health && sick.health.illness) sick.health.illness.sev = Math.max(0, sick.health.illness.sev - 0.06);
      const ms = h.members.map((id) => s.byId.get(id)).filter(Boolean);
      if (who === 'you') { byYou++; for (const q of ms) { const r = relOf(q); r.affinity = Math.min(1, r.affinity + 0.12); r.familiar = Math.min(1, (r.familiar || 0) + 0.1); try { s.remember(q, `When ${q === sick ? 'I' : sick.first} lay sick, the stranger came and chopped our wood and fetched our water.`, 'kindness', 0.9); } catch (e) { /* */ } } if (PS.rep) PS.rep.civilian = Math.min(1, (PS.rep.civilian || 0) + 0.02); try { O.TownTalk && O.TownTalk.tell(b.doorX * T, b.doorY * T, `The stranger chopped wood and fetched water for the ${h.surname || sick.sur}s while ${sick.first} lay sick.`, `They say the stranger did the chores for a sick household.`); } catch (e) { /* */ } O.UI && O.UI.say && O.UI.say(`The woodbox is full and the bucket brimming. A weak voice calls thanks from inside.`, 'good'); }
      else { byNpc++; for (const q of ms) { try { s.relate(q, who, 0.12); s.remember(q, `${who.first} came and did our chores while ${q === sick ? 'I' : sick.first} lay sick.`, 'kindness', 0.7, who.id); } catch (e) { /* */ } } } }
    game.hooks.update.push((dt) => { const s = cur(); if (!s || !s.world || game.scene) return;
      if (J) { J.t += dt; const { s: js, q, n } = J; if (js !== s || J.t > 90 || (q && q.alive === false)) { if (q) { q._sickhelp = false; q.agent.forceAnim = null; if (!talking(q)) q.agent.frozen = false; } J = null; return; }
        if (J.who === 'npc' && J.at) { J.k += dt; const a = q.agent; a.forceAnim = J.k < 8 ? 'chop' : J.k < 10 ? 'carry' : 'idle'; a.dir = 0; if (J.k < 8 && Math.random() < dt * 1.3 && near(a.x, a.y, 300)) O.sfx && O.sfx('chop', 0.15);
          if (J.k > 8 && !J.carried) { J.carried = true; J.chips = true; }
          if (J.k > 11) { finish(s, n, q); if (near(a.x, a.y, 300)) say(q, pick([`There, ${n.sick.first}. Wood for the night. Get well.`, 'That\'s the water in. I\'ll look in tomorrow.']), 2.2); q._sickhelp = false; a.forceAnim = null; a.frozen = false; J = null; } }
        if (J && J.who === 'you') { const [x, y] = spot(n.b); if (!near(x, y, 40)) { O.UI && O.UI.say && O.UI.say('You leave the chores half done.', 'info'); game.player.anim = 'idle'; J = null; return; } J.k += dt; const P = game.player; P.anim = J.k < 7 ? 'chop' : 'carry'; P.dir = 0; if (J.k < 7 && Math.random() < dt * 1.4) O.sfx && O.sfx('chop', 0.25); if (J.k > 7 && !J.chips) J.chips = true; if (J.k > 10) { finish(s, n, 'you'); P.anim = 'idle'; J = null; } }
        return; }
      acc += dt; if (acc < 8) return; acc = 0; const hr = s.minute / 60; if (hr < 8 || hr > 17) return;
      const ns = needy(s); if (!ns.length) return; const n = pick(ns); if (Math.random() > 0.35) return;
      // a neighbour who thinks well of them comes over
      const q = s.people.filter((x) => free(x) && x.age >= 16 && x.household !== n.h.id && Math.hypot(x.agent.x - n.b.doorX * T, x.agent.y - n.b.doorY * T) < 420 && ((x.rel.get(n.sick.id) || {}).affinity || 0) > -0.1).sort((a, c) => ((c.rel.get(n.sick.id) || {}).affinity || 0) - ((a.rel.get(n.sick.id) || {}).affinity || 0))[0]; if (!q) return;
      q._sickhelp = true; J = { s, q, n, who: 'npc', t: 0, k: 0 }; const [x, y] = spot(n.b);
      O.Errands.send(s, q, [Math.floor(x / T), Math.floor(y / T)], { anim: 'idle', secs: 0.2, face: 0, giveUp: game.t + 45, after: (ok) => { if (!J || J.q !== q) return; if (!ok) { q._sickhelp = false; J = null; return; } q.agent.frozen = true; q.agent.path = null; J.at = true; } }); });
    (O.moreCandidates = O.moreCandidates || []).push(() => { const P = game.player, s = cur(); if (game.scene || P.locked || !s || !s.world || (J && J.who === 'you')) return null; const hr = s.minute / 60; if (hr < 6 || hr > 20) return null;
      const n = needy(s).find((x) => { const [sx, sy] = spot(x.b); return Math.hypot(sx - P.x, sy - P.y) < 30; }); if (!n || (J && J.n.h === n.h)) return null; const [x, y] = spot(n.b);
      return { type: 'custom', d: 2, x, y: y - 30, label: `Chop wood and fetch water for the ${n.h.surname || n.sick.sur}s (${n.sick.first} is sick)`, act: () => { J = { s, q: null, n, who: 'you', t: 0, k: 0 }; } }; });
    // the signs, from the lane: an axe left in the block, an empty bucket
    game.hooks.drawWorld.push((ctx, cam) => { const s = cur(); if (!s || !s.world || game.scene) return;
      const P = game.player; for (const h of s.households || []) { if (!h || h.gone || !h.members) continue; const sick = h.members.map((id) => s.byId.get(id)).find((q) => ill(q) && q.age >= 16); if (!sick) continue; const b = sick.home != null && s.building(sick.home); if (!b || b.doorX == null) continue; const [x0, y0] = spot(b); if (Math.abs(x0 - P.x) > 420 || Math.abs(y0 - P.y) > 300) continue;
        const x = Math.round(x0 - cam.x), y = Math.round(y0 - cam.y), full = done.get(h.id) === s.day;
        ctx.fillStyle = '#6a4a2c'; ctx.fillRect(x - 4, y - 4, 8, 5); ctx.fillStyle = '#c8a878'; ctx.fillRect(x - 4, y - 5, 8, 1);
        if (!full && !(J && J.n.h === h && J.k > 0)) { ctx.fillStyle = '#5a3e26'; ctx.fillRect(x, y - 11, 1, 7); ctx.fillStyle = '#9aa0a8'; ctx.fillRect(x - 2, y - 6, 4, 2); }
        ctx.fillStyle = '#7a5a3a'; ctx.fillRect(x + 7, y - 5, 5, 5); ctx.fillStyle = full ? '#5a8ab8' : '#3a2a1a'; ctx.fillRect(x + 8, y - 5, 3, 1);
        if (full) { ctx.fillStyle = '#7a5434'; for (let i = 0; i < 4; i++) ctx.fillRect(x - 12 + (i % 2) * 5, y - 2 - Math.floor(i / 2) * 3, 4, 3); } } });
    (O.extraLines = O.extraLines || []).push((s, q) => J && J.who === 'npc' && J.q === q ? `${J.n.sick.first} is sick and you are doing their household's chores (wood and water) for them.` : '');
    O.SickChores = { get job() { return J; }, get byYou() { return byYou; }, get byNpc() { return byNpc; }, needy: () => needy(cur()), done };
  }
  O.SickChoresSetup = { setup };
})();
