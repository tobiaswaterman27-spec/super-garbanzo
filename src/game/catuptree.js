// The cat up the tree. A child's cat goes up after a bird and won't come down: a small furious face among
// the leaves, mewing, and the child underneath in tears calling its name. Someone fetches a ladder and goes
// up (and comes down scratched, with the cat); or you can climb after it yourself: scratched hands, a cat
// down the front of your coat, and a child who'll remember you.
'use strict';
(function () {
  const T = 16;
  function setup(game) {
    const cur = () => O.SimRef.cur, PS = O.PlayerState;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    const say = (q, t, secs) => O.Speech && O.Speech.say(q, t, secs || 2.2);
    const near = (x, y, r) => Math.hypot(x - game.player.x, y - game.player.y) < r;
    const talking = (q) => O.npcUI && O.npcUI.talking && O.npcUI.talking() === q;
    const free = (q) => q && q.alive !== false && q.agent && !q.agent.hidden && q.agent.inside == null && !q.agent.frozen && !q.errand && !q._bit && !q._scene && !q._cattree && !q.visitor && !talking(q);
    const relOf = (q) => { const r = q.rel.get(0) || { affinity: 0, familiar: 0 }; q.rel.set(0, r); return r; };
    let C = null, cool = 150, force = false, ups = 0, byYou = 0, byNpc = 0;
    const NAMES = ['Smut', 'Tib', 'Mouser', 'Gib', 'Pudding', 'Grizel', 'Moll', 'Sooty', 'Bess', 'Ginger'];
    const rel_ = (q) => { if (!q || !q._cattree) return; q._cattree = false; if (q.agent) { q.agent.forceAnim = null; q.agent.lift = 0; if (!talking(q)) q.agent.frozen = false; } };
    function end() { if (!C) return; rel_(C.kid); rel_(C.h); if (C.you) { game.player.lift = 0; game.player.anim = 'idle'; } C = null; }
    function begin(s) { const P = game.player;
      const tr = (s.world.trees || []).filter((t) => t.kind !== 'pine' && Math.hypot(t.x - P.x, t.y - P.y) < 340 && Math.hypot(t.x - P.x, t.y - P.y) > 50).sort(() => Math.random() - 0.5)[0]; if (!tr) return false;
      const kid = s.people.filter((q) => free(q) && q.age >= 4 && q.age <= 11 && Math.hypot(q.agent.x - tr.x, q.agent.y - tr.y) < 320)[0]; if (!kid) return false;
      ups++; C = { s, tr, kid, h: null, t: 0, stage: 'up', name: pick(NAMES), seed: O.hash('treecat', tr.x, tr.y) % 997, cx: tr.x + (Math.random() < 0.5 ? -6 : 7), cy: tr.y - 44, mew: 1 };
      kid._cattree = true; O.Errands.send(s, kid, [Math.floor(tr.x / T), Math.floor(tr.y / T) + 1], { anim: 'point', secs: 0.4, face: 3, sprint: true, giveUp: game.t + 30, after: (ok) => { if (!C || C.kid !== kid) return; if (!ok) { end(); return; } kid.agent.frozen = true; kid.agent.path = null; if (near(kid.agent.x, kid.agent.y, 320)) say(kid, pick([`${C.name}! Come down! Please come down!`, `${C.name}'s up the tree and can't get down!`, 'Somebody help! My cat!']), 2.6); } });
      return true; }
    game.hooks.update.push((dt) => { const s = cur(); if (!s || !s.world || game.scene) return;
      if (C) { C.t += dt; const { kid } = C; if (C.s !== s || C.t > 160 || kid.alive === false) { end(); return; }
        C.mew -= dt; if (C.mew <= 0 && C.stage !== 'down') { C.mew = 4 + Math.random() * 4; if (near(C.cx, C.cy, 300) && O.animalCall) O.animalCall('cat', near(C.cx, C.cy, 140) ? 0.5 : 0.25); }
        if (kid.agent.frozen && C.stage !== 'down') kid.agent.forceAnim = Math.floor(C.t) % 4 === 0 ? 'point' : 'shake';
        // a grown-up with a ladder
        if (C.stage === 'up' && !C.h && !C.you && C.t > 14 && Math.random() < dt * 0.15) { const h = s.people.filter((q) => free(q) && q.age >= 16 && q.age <= 60 && Math.hypot(q.agent.x - C.tr.x, q.agent.y - C.tr.y) < 300).sort((a, b) => (b.household === kid.household ? 1 : 0) - (a.household === kid.household ? 1 : 0))[0];
          if (h) { C.h = h; h._cattree = true; if (near(h.agent.x, h.agent.y, 320)) say(h, pick(['All right, all right, I\'ll get the ladder.', 'That blessed cat. Again!']), 2); O.Errands.send(s, h, [Math.floor(C.tr.x / T) + (C.cx > C.tr.x ? 1 : -1), Math.floor(C.tr.y / T)], { anim: 'idle', secs: 0.4, face: 3, carry: { good: 'planks', qty: 1 }, giveUp: game.t + 40, after: (ok) => { if (!C || C.h !== h) return; if (!ok) { rel_(h); C.h = null; return; } h.agent.frozen = true; h.agent.path = null; C.stage = 'npcclimb'; C.k = 0; } }); } }
        if (C.stage === 'npcclimb') { C.k += dt; const a = C.h.agent; a.lift = Math.round(Math.min(1, C.k / 3) * 26 * (C.k > 7 ? Math.max(0, 1 - (C.k - 7) / 3) : 1)); a.forceAnim = C.k < 3 || C.k > 7 ? 'carry' : 'take';
          if (C.k > 4.5 && !C.got) { C.got = true; if (near(a.x, a.y, 300)) say(C.h, pick(['Ow! You ungrateful... got you.', 'Come here, you. Ow! Claws!']), 2); }
          if (C.k > 10) { byNpc++; C.stage = 'down'; a.lift = 0; try { s.relate(kid, C.h, 0.15); s.remember(kid, `${C.h.first} climbed up and got ${C.name} down from the tree.`, 'kindness', 0.7, C.h.id); } catch (e) { /* */ } give(s, C.h); } }
        if (C.stage === 'youclimb') { C.k += dt; const P = game.player; if (!near(C.tr.x, C.tr.y + 10, 40)) { P.lift = 0; P.anim = 'idle'; C.stage = 'up'; C.you = false; return; } P.lift = Math.round(Math.min(1, C.k / 2.5) * 26 * (C.k > 6 ? Math.max(0, 1 - (C.k - 6) / 2.5) : 1)); P.anim = C.k < 2.5 || C.k > 6 ? 'carry' : 'take'; P.dir = 3;
          if (C.k > 4 && !C.got) { C.got = true; const scratched = Math.random() < 0.6; if (scratched) { O.UI && O.UI.say && O.UI.say(`${C.name} does not want rescuing, and says so with all four feet. You come away scratched, with a cat.`, 'info'); if (PS.hp != null) PS.hp = Math.max(1, PS.hp - 2); } else O.UI && O.UI.say && O.UI.say(`You get a hand under ${C.name} and they cling to you, trembling.`, 'info'); }
          if (C.k > 8.5) { byYou++; C.stage = 'down'; P.lift = 0; P.anim = 'give'; setTimeout(() => { P.anim = 'idle'; }, 900); C.you = false; const r = relOf(kid); r.affinity = Math.min(1, r.affinity + 0.25); r.familiar = Math.min(1, (r.familiar || 0) + 0.25); try { s.remember(kid, `The stranger climbed the tree and got ${C.name} down for me.`, 'kindness', 1.2); const hh = s.household(kid); if (hh) for (const id of hh.members) { const z = s.byId.get(id); if (z && z !== kid && z.age >= 16) { const rz = relOf(z); rz.affinity = Math.min(1, rz.affinity + 0.05); } } O.TownTalk && O.TownTalk.tell(C.tr.x, C.tr.y, `The stranger climbed a tree to get ${kid.first}'s cat down.`, 'They say the stranger climbed a tree for a child\'s cat.'); } catch (e) { /* */ } give(s, null); } }
        if (C.stage === 'down') { C.dk = (C.dk || 0) + dt; if (C.dk > 6) end(); }
        return; }
      cool -= dt; if (cool > 0 && !force) return; cool = 280 + Math.random() * 260; const hr = s.minute / 60; if (!force && (hr < 8 || hr > 19 || s.season === 'winter' || Math.random() < 0.5)) return; force = false; begin(s); });
    function give(s, from) { const kid = C.kid; kid.agent.forceAnim = 'take'; if (near(kid.agent.x, kid.agent.y, 320)) setTimeout(() => C && say(kid, pick([`${C.name}! You bad, bad cat. I love you.`, 'Thank you! Thank you!', `${C.name}, don't ever do that again!`]), 2.4), 600); setTimeout(() => { if (C && C.kid === kid) { rel_(kid); rel_(C.h); C.h = null; } }, 3500); }
    (O.moreCandidates = O.moreCandidates || []).push(() => { const P = game.player; if (!C || C.stage !== 'up' || C.h || game.scene || P.locked || C.s !== cur()) return null; if (Math.hypot(C.tr.x - P.x, C.tr.y + 10 - P.y) > 40) return null;
      return { type: 'custom', d: 2, x: C.tr.x, y: C.tr.y - 60, label: `Climb up after ${C.name}`, act: () => { C.you = true; C.stage = 'youclimb'; C.k = 0; C.got = false; const P2 = game.player; P2.x = C.tr.x + (C.cx > C.tr.x ? 8 : -8); P2.y = C.tr.y + 4; } }; });
    (O.extraLines = O.extraLines || []).push((s, q) => C && q === C.kid ? `Your cat ${C.name} is stuck up a tree and you are frantic${C.stage === 'down' ? ', but now it is safely down and you are hugging it' : ''}.` : '');
    game.hooks.drawTop.push((ctx, cam, inScene) => { if (!C || inScene || C.s !== cur()) return; let x, y;
      if (C.stage === 'up' || (C.stage === 'npcclimb' && !C.got) || (C.stage === 'youclimb' && !C.got)) { x = C.cx; y = C.cy + Math.sin(C.t * 2) * 0.6; }
      else if (C.stage === 'down') { const a = C.kid.agent; x = a.x + 2; y = a.y - 10; }
      else { const a = C.stage === 'npcclimb' ? C.h.agent : game.player; x = a.x + 3; y = a.y - 14 - (a.lift || 0); }
      try { const H = O.Animals.HANIMS.idle, fr = O.Animals.animal('cat', C.seed, 1, false, Math.floor(C.t * H.fps) % H.frames, 'idle'); ctx.drawImage(fr, Math.round(x - cam.x - (fr.ox ?? fr.width / 2)), Math.round(y - cam.y - (fr.gy ?? fr.height))); } catch (e) { /* */ }
      if (C.stage === 'npcclimb' || C.stage === 'youclimb') { const lx = Math.round(C.tr.x + (C.cx > C.tr.x ? 8 : -8) - cam.x), ly = Math.round(C.tr.y - cam.y) + 4; ctx.strokeStyle = '#7a5a3a'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(lx - 4, ly); ctx.lineTo(lx - 2, ly - 42); ctx.moveTo(lx + 4, ly); ctx.lineTo(lx + 2, ly - 42); ctx.stroke(); for (let i = 0; i < 7; i++) { const yy = ly - 4 - i * 6; ctx.beginPath(); ctx.moveTo(lx - 4 + i * 0.3, yy); ctx.lineTo(lx + 4 - i * 0.3, yy); ctx.stroke(); } } });
    O.CatUpTree = { get cat() { return C; }, get ups() { return ups; }, get byYou() { return byYou; }, get byNpc() { return byNpc; }, soon: () => { cool = 0; force = true; } };
  }
  O.CatUpTreeSetup = { setup };
})();
