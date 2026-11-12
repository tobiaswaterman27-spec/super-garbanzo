// Your tooth. Now and then a back tooth starts to throb, and it doesn't stop: you feel it on the cold air,
// you feel it chewing, and folk see your swollen jaw and wince for you. Chew a pinch of herbs on it and it
// may settle; or do what everyone does in the end: sit on the barber's stool outside his door with idlers
// gathering, and grip the stool while he goes in with the pincers. A howl, a heave, and up it comes, held
// high for the street to see, and the street cheers.
'use strict';
(function () {
  const T = 16;
  function setup(game) {
    const cur = () => O.SimRef.cur, PS = O.PlayerState;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    const say = (q, t, secs) => O.Speech && O.Speech.say(q, t, secs || 2.2);
    const ui = (t, k) => O.UI && O.UI.say && O.UI.say(t, k || 'info');
    const near = (x, y, r) => Math.hypot(x - game.player.x, y - game.player.y) < r;
    const talking = (q) => O.npcUI && O.npcUI.talking && O.npcUI.talking() === q;
    let throb = 30, J = null, pulled = 0, eased = 0, got = 0;
    const barberOf = (s) => { const bz = [...s.biz.values()].find((z) => z.type === 'barber' && (z.workers || []).length); if (!bz) return null; const b = s.building(bz.b?.id ?? bz.id); const q = bz.workers.map((id) => s.byId.get(id)).find((x) => x && x.alive !== false && x.agent && !x.agent.frozen && !x.errand && !talking(x)); return b && b.doorX != null && q ? { b, q } : null; };
    game.hooks.update.push((dt) => { const s = cur(); if (!s || !s.world) return; const P = game.player;
      // it comes on, now and then
      if (!PS.tooth && Math.random() < dt / (60 * 60 * 3)) { PS.tooth = { since: s.day }; got++; ui('A back tooth has started to throb. It is not going to stop on its own.', 'warn'); }
      if (PS.tooth && !J) { throb -= dt; if (throb <= 0) { throb = 70 + Math.random() * 80; ui(pick(['Your tooth throbs.', 'You bite on the wrong side and see stars. The tooth.', 'The cold air finds your bad tooth.']), 'info'); } }
      if (!J) return; J.t += dt; const { q } = J;
      if (J.s !== s || game.scene || q.alive === false) { P.locked = false; J = null; return; }
      P.locked = true; P.x = J.sx; P.y = J.sy; P.dir = 0;
      if (!J.at) { if (J.t > 25) { q.agent.x = J.sx + 16; q.agent.y = J.sy; q.agent.path = null; q.agent.frozen = true; J.at = true; J.t = 0; } return; }
      q.agent.dir = O.dirOf(P.x - q.agent.x, P.y - q.agent.y);
      if (J.t < 2) { P.anim = 'sit'; q.agent.forceAnim = 'talk'; if (!J.s0) { J.s0 = true; say(q, pick(['Open wide. Wider. Hold the stool.', 'Ah, that one. That\'s coming out. Grip tight.']), 2.4); for (const z of s.people) if (z !== q && z.agent && !z.agent.hidden && z.agent.inside == null && near(z.agent.x, z.agent.y, 200) && !z.agent.frozen) { J.crowd.push(z); O.gesture && O.gesture(z, 'look', 6); } } }
      else if (J.t < 6) { P.anim = J.t < 4 ? 'sit' : 'hurt'; q.agent.forceAnim = 'attack'; if (!J.howl && J.t > 4) { J.howl = true; O.sfx && O.sfx('smack', 0.4); ui('AAAGH!', 'warn'); for (const z of J.crowd) O.gesture && O.gesture(z, 'shocked', 1.5); } }
      else if (J.t < 8) { q.agent.forceAnim = 'celebrate'; P.anim = 'sit'; if (!J.up) { J.up = true; say(q, 'There she is! Roots and all!', 2.2); for (const z of J.crowd) O.gesture && O.gesture(z, 'celebrate', 2); if (J.crowd[0]) setTimeout(() => say(J && J.crowd[0] || q, pick(['Hooray!', 'Look at the size of it!', 'Didn\'t even faint!']), 1.6), 500); } }
      else { pulled++; PS.tooth = null; if (PS.hp != null) PS.hp = Math.max(1, PS.hp - 2); q.agent.forceAnim = null; q._ptooth = false; P.anim = 'idle'; P.locked = false; ui('A mouthful of blood and a hole where the pain was. Bliss.', 'good'); try { s.remember(q, 'Pulled a tooth for the stranger outside my door, with half the street watching.', 'social', 0.5); } catch (e) { /* */ } J = null; } });
    function sit(s) { const B = barberOf(s); if (!B) return false; const { b, q } = B; const P = game.player; const cost = 2; if ((PS.money || 0) < cost) { ui(`The barber wants ${cost} aurin to pull it, and you haven't that.`, 'warn'); return true; } PS.money -= cost; const hh = s.household(q); if (hh) hh.money = (hh.money || 0) + cost;
      const sx = (b.doorX + 2) * T + 8, sy = (b.doorY + 2) * T + 8; J = { s, q, b, sx, sy, t: 0, at: false, crowd: [] }; q._ptooth = true; if (q.agent.inside != null) { q.agent.x = b.doorX * T + 8; q.agent.y = (b.doorY + 1) * T + 8; q.agent.inside = null; q.agent.hidden = false; }
      O.Errands.send(s, q, [Math.floor(sx / T) + 1, Math.floor(sy / T)], { anim: 'idle', secs: 0.2, face: 1, giveUp: game.t + 20, after: () => { if (J && J.q === q) { q.agent.frozen = true; q.agent.path = null; J.at = true; J.t = 0; } } }); return true; }
    (O.moreCandidates = O.moreCandidates || []).push(() => { const P = game.player, s = cur(); if (!PS.tooth || J || game.scene || P.locked || !s || !s.world) return null;
      const B = barberOf(s); if (B && Math.hypot(B.b.doorX * T + 8 - P.x, (B.b.doorY + 1) * T - P.y) < 40) return { type: 'custom', d: 2, x: B.b.doorX * T + 8, y: B.b.doorY * T - 20, label: 'Have the barber pull your bad tooth (₳2)', act: () => sit(s) };
      return null; });
    // chew herbs on it, in your own words or from the satchel
    (O.moreCandidates = O.moreCandidates || []).push(() => { const P = game.player; if (!PS.tooth || J || game.scene || P.locked || !(PS.items || []).includes('herbs')) return null;
      return { type: 'custom', d: 40, x: P.x, y: P.y - 44, label: 'Chew a pinch of herbs on your bad tooth', act: () => { PS.items.splice(PS.items.indexOf('herbs'), 1); if (Math.random() < 0.5) { PS.tooth = null; eased++; ui('Bitter as gall, but the throbbing fades. It might hold.', 'good'); } else ui('Bitter as gall, and no better. It will have to come out.', 'info'); } }; });
    { const _s = O.AIChat && O.AIChat.say; if (_s) O.AIChat.say = function (q, text, render) { try { const s = cur(), t = String(text || ''); if (PS.tooth && !J && /barber/.test(q.job?.role || '') && /\b(tooth|pull|draw)\b/i.test(t)) { (q._conv ||= []).push({ who: 'p', t }); const line = (PS.money || 0) >= 2 ? 'Let\'s have a look. Two aurin, and sit on the stool outside. In the light.' : 'Two aurin to pull it. Come back when you have it.'; q._conv.push({ who: 'q', t: line }); render(line); if ((PS.money || 0) >= 2) setTimeout(() => { O.npcUI && O.npcUI.closeTalk && O.npcUI.closeTalk(); if (game.scene && game.exitBuilding) game.exitBuilding(); setTimeout(() => sit(cur()), 500); }, 1400); return Promise.resolve(); } } catch (e) { console.error(e); } return _s.apply(this, arguments); }; }
    (O.extraLines = O.extraLines || []).push((s, q) => PS.tooth ? 'The player has a bad tooth: their jaw is swollen on one side and they wince when they talk. You might say so, or recommend the barber.' : '');
    O.Toothache = { get pulled() { return pulled; }, get eased() { return eased; }, get got() { return got; }, get job() { return J; }, give: () => { PS.tooth = { since: cur().day }; } };
  }
  O.ToothacheSetup = { setup };
})();
