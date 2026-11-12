// Mending your own house. A house of yours that's in poor repair (a tree through the thatch, years of
// weather) you can mend yourself: prop the ladder at the door and go up with a hammer, planks if you have
// them (a proper job) or whatever's to hand (a patch). A neighbour may come and foot the ladder for you, as
// you might for them. Or hire it done: ask a builder, carpenter or thatcher, in your own words, to mend your
// roof; they name a price, and if you pay they come round with their ladder and do it properly.
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
    const free = (q) => q && q.alive !== false && q.agent && !q.agent.hidden && q.agent.inside == null && !q.agent.frozen && !q.errand && !q._bit && !q._scene && !q._ownrep && !q.visitor && !talking(q);
    const relOf = (q) => { const r = q.rel.get(0) || { affinity: 0, familiar: 0 }; q.rel.set(0, r); return r; };
    const mine = (s) => s.world.buildings.filter((b) => b.owner && b.owner.kind === 'player' && b.doorX != null && !b.ruined);
    const worn = (b) => (b.condition ?? 1) < 0.85;
    let J = null, H = null, selfJobs = 0, hired = 0, footed = 0;
    const rel_ = (q) => { if (!q || !q._ownrep) return; q._ownrep = false; if (q.agent) { q.agent.forceAnim = null; q.agent.lift = 0; if (!talking(q)) q.agent.frozen = false; } };
    const mend = (b, amt) => { b.condition = Math.min(1, (b.condition ?? 0.7) + amt); if (b.condition > 0.5) b.needsRepair = false; b.dirty = true; };
    game.hooks.update.push((dt) => { const s = cur(); if (!s || !s.world) return; const P = game.player;
      // you, up the ladder
      if (J) { J.t += dt; if (J.s !== s || game.scene) { P.lift = 0; J = null; return; } const [x, y] = J.at; if (!near(x, y, 30)) { P.lift = 0; P.anim = 'idle'; ui('You come down off the ladder, the job half done.', 'info'); if (J.foot) rel_(J.foot); J = null; P.locked = false; return; }
        const up = Math.min(1, J.t / 2.5), down = J.t > J.len - 2.5 ? Math.max(0, (J.len - J.t) / 2.5) : 1; P.lift = Math.round(26 * up * down); P.anim = J.t < 2.5 || J.t > J.len - 2.5 ? 'carry' : 'hammer'; P.dir = 0; P.locked = true; if (Math.random() < dt * 1.6) O.sfx && O.sfx('smack', 0.12);
        if (!J.foot && !J.footTried && J.t > 4) { J.footTried = true; const q = s.people.filter((z) => free(z) && z.age >= 14 && relOf(z).affinity > 0.05 && near(z.agent.x, z.agent.y, 260))[0]; if (q && Math.random() < 0.7) { J.foot = q; q._ownrep = true; O.Errands.send(s, q, [Math.floor(x / T) - 1, Math.floor(y / T)], { anim: 'take', secs: 0.4, face: 0, giveUp: game.t + 25, after: (ok) => { if (!J || J.foot !== q) return; if (!ok) { rel_(q); J.foot = null; return; } q.agent.frozen = true; q.agent.path = null; q.agent.forceAnim = 'take'; footed++; say(q, pick(['I\'ve got the foot of it. Go on.', 'You\'ll break your neck on these stones. I\'ll hold it.']), 2.2); } }); } }
        if (J.foot && J.foot.agent.frozen) J.t += dt * 0.3;
        if (J.t > J.len) { P.lift = 0; P.anim = 'idle'; P.locked = false; mend(J.b, J.amt); selfJobs++; ui(J.amt > 0.15 ? `You come down with sore thumbs and a sound roof. (${J.b.name || 'Your house'} is in ${Math.round(J.b.condition * 100)}% repair.)` : `A patch, and it'll hold a while. (${Math.round(J.b.condition * 100)}% repair.)`, 'good'); if (J.foot) { const q = J.foot; try { s.remember(q, 'Held the stranger\'s ladder while they mended their roof.', 'social', 0.4); const r = relOf(q); r.affinity = Math.min(1, r.affinity + 0.04); } catch (e) { /* */ } rel_(q); } J = null; }
        return; }
      // the builder you hired, coming round
      if (H) { H.t += dt; const q = H.q; if (H.s !== s || H.t > 200 || q.alive === false) { rel_(q); H = null; return; }
        if (H.at) { H.k += dt; const a = q.agent; const up = Math.min(1, H.k / 2.5), down = H.k > 27.5 ? Math.max(0, (30 - H.k) / 2.5) : 1; a.lift = Math.round(26 * up * down); a.forceAnim = H.k < 2.5 || H.k > 27.5 ? 'carry' : 'hammer'; a.dir = 0; if (Math.random() < dt * 1.4 && near(a.x, a.y, 260)) O.sfx && O.sfx('smack', 0.1);
          if (H.k > 30) { mend(H.b, 0.4); hired++; if (near(a.x, a.y, 300)) say(q, pick(['That\'s her done. Tight as a drum.', 'Sound again. She\'ll see out a few winters.']), 2.2); ui(`${q.first} has mended your house: ${Math.round(H.b.condition * 100)}% repair.`, 'good'); rel_(q); H = null; } }
        return; } });
    (O.moreCandidates = O.moreCandidates || []).push(() => { const P = game.player, s = cur(); if (J || game.scene || P.locked || !s || !s.world) return null; const b = mine(s).find((b) => worn(b) && Math.hypot(b.doorX * T + 8 + 18 - P.x, (b.doorY + 1) * T + 6 - P.y) < 30); if (!b) return null; const has = (PS.items || []).includes('planks');
      return { type: 'custom', d: 2, x: b.doorX * T + 8 + 18, y: (b.doorY + 1) * T - 30, label: has ? 'Mend your roof (with a plank)' : 'Patch your roof with what\'s to hand', act: () => { if (has) PS.items.splice(PS.items.indexOf('planks'), 1); J = { s, b, t: 0, len: has ? 22 : 14, amt: has ? 0.22 : 0.08, at: [b.doorX * T + 8 + 18, (b.doorY + 1) * T + 6] }; P.x = J.at[0]; P.y = J.at[1]; } }; });
    // hire it done, in your own words
    const respond = (q, t, line, render) => { (q._conv ||= []).push({ who: 'p', t }, { who: 'q', t: line }); render(line); return Promise.resolve(); };
    const _say = O.AIChat && O.AIChat.say;
    if (_say) O.AIChat.say = function (q, text, render) { try { const s = cur(), t = String(text || '');
      if (!H && s && q && /builder|carpenter|thatcher|roofer|mason|labourer/.test(q.job?.role || '') && /\b(mend|repair|fix|thatch|patch)\w*\b/i.test(t)) { const b = mine(s).filter(worn).sort((a, c) => (a.condition ?? 1) - (c.condition ?? 1))[0];
        if (!b) return respond(q, t, 'Your place? It looked sound enough when I passed.', render);
        const price = Math.max(4, Math.round((1 - (b.condition ?? 0.7)) * 30)); q._quote = { price, b: b.id, day: s.day };
        if (/\b(yes|deal|agreed|do it|here|pay)\b/i.test(t) && (PS.money || 0) >= price) { PS.money -= price; const hh = s.household(q); if (hh) hh.money = (hh.money || 0) + price; H = { s, q, b, t: 0, k: 0, at: false }; q._ownrep = true; setTimeout(() => { O.npcUI && O.npcUI.closeTalk && O.npcUI.closeTalk(); O.Errands.send(s, q, [b.doorX + 1, b.doorY + 1], { anim: 'idle', secs: 0.3, face: 0, carry: { good: 'planks', qty: 1 }, giveUp: game.t + 120, after: (ok) => { if (!H || H.q !== q) return; if (!ok) { rel_(q); H = null; return; } q.agent.frozen = true; q.agent.path = null; H.at = true; } }); }, 1200); return respond(q, t, `${price} it is. I'll fetch my ladder and come now.`, render); }
        return respond(q, t, `For ${b.name && b.name !== "House" ? b.name : "your place"}? ${price} aurin, and I bring the stuff. Say the word and I'll come round.`, render); }
      if (!H && s && q && q._quote && q._quote.day === s.day && /\b(yes|deal|agreed|do it|go on|done)\b/i.test(t)) { const b = s.building(q._quote.b), price = q._quote.price; if (b && (PS.money || 0) >= price) { PS.money -= price; const hh = s.household(q); if (hh) hh.money = (hh.money || 0) + price; q._quote = null; H = { s, q, b, t: 0, k: 0, at: false }; q._ownrep = true; setTimeout(() => { O.npcUI && O.npcUI.closeTalk && O.npcUI.closeTalk(); O.Errands.send(s, q, [b.doorX + 1, b.doorY + 1], { anim: 'idle', secs: 0.3, face: 0, carry: { good: 'planks', qty: 1 }, giveUp: game.t + 120, after: (ok) => { if (!H || H.q !== q) return; if (!ok) { rel_(q); H = null; return; } q.agent.frozen = true; q.agent.path = null; H.at = true; } }); }, 1200); return respond(q, t, 'Done. I\'ll come round now.', render); } if (b) return respond(q, t, `You haven't ${price} on you. Come back when you have.`, render); } } catch (e) { console.error(e); } return _say.apply(this, arguments); };
    (O.extraLines = O.extraLines || []).push((s, q) => { if (H && q === H.q) return 'The player has paid you to mend the roof of their house and you are on your way or at it.'; if (/builder|carpenter|thatcher|roofer|mason/.test(q.job?.role || '') && s.world && mine(s).some(worn)) return 'The player owns a house here that is in poor repair; if they ask you to mend it, you name a fair price and come and do it if they pay.'; return ''; });
    game.hooks.drawWorld.push((ctx, cam) => { const L = J ? J.at : H && H.at ? [H.q.agent.x, H.q.agent.y] : null; if (!L || game.scene) return; const x = Math.round(L[0] - cam.x), y = Math.round(L[1] - cam.y) + 2; ctx.strokeStyle = '#7a5a3a'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x - 5, y); ctx.lineTo(x - 3, y - 44); ctx.moveTo(x + 5, y); ctx.lineTo(x + 3, y - 44); ctx.stroke(); for (let i = 0; i < 8; i++) { const yy = y - 4 - i * 5; ctx.beginPath(); ctx.moveTo(x - 5 + i * 0.25, yy); ctx.lineTo(x + 5 - i * 0.25, yy); ctx.stroke(); } });
    O.OwnRepair = { get job() { return J; }, get hire() { return H; }, get selfJobs() { return selfJobs; }, get hired() { return hired; }, get footed() { return footed; } };
  }
  O.OwnRepairSetup = { setup };
})();
