// Your own satchel dipped. The cutpurses who work the crowds don't only rob the townsfolk: stand about in a
// press of people with a fat satchel at your hip and a lifter may sidle up behind you. Sometimes you feel
// the tug and turn in time to see him walking off a little too briskly; sometimes you only find out later,
// when your purse is light. Shout "Thief!" and run him down (the watch and a stout bystander may join you),
// and he'll drop what he took; or tell the watch afterwards, in your own words, what was taken and by whom.
'use strict';
(function () {
  const T = 16;
  function setup(game) {
    const cur = () => O.SimRef.cur, PS = O.PlayerState, G = O.Data.GOODS;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    const say = (q, t, secs) => O.Speech && O.Speech.say(q, t, secs || 2);
    const ui = (t, k) => O.UI && O.UI.say && O.UI.say(t, k || 'info');
    const dP = (q) => Math.hypot(q.agent.x - game.player.x, q.agent.y - game.player.y);
    const isWatch = (q) => /guard|sergeant|watch|captain|constable/.test(q.job?.role || '');
    const talking = (q) => O.npcUI && O.npcUI.talking && O.npcUI.talking() === q;
    const outdoors = (q) => q.agent && !q.agent.hidden && q.agent.inside == null && q.alive !== false;
    const free = (q) => outdoors(q) && !q.agent.frozen && !q.errand && !q._scene && !q._bit && !q._cp && !q._cutyou && !q.jailUntil && !q.visitor && !talking(q);
    const open = (x, y) => !game.solidAt(x - 3, y - 2) && !game.solidAt(x + 3, y - 2);
    function steer(q, tx, ty, dt, sp, an) { const a = q.agent, dx = tx - a.x, dy = ty - a.y, d = Math.hypot(dx, dy); if (d < 2) return true; const st = Math.min(d, sp * dt); const nx = a.x + dx / d * st, ny = a.y + dy / d * st; if (open(nx, ny)) { a.x = nx; a.y = ny; } else if (open(nx, a.y)) a.x = nx; else if (open(a.x, ny)) a.y = ny; a.dir = O.dirOf(dx, dy); a.forceAnim = an; return false; }
    let J = null, cool = 90, force = false, dipped = 0, felt = 0, caught = 0, escaped = 0, told = 0; const past = [];
    const rel_ = (q) => { if (!q || !q._cutyou) return; q._cutyou = false; if (q.agent) { q.agent.forceAnim = null; if (!talking(q)) q.agent.frozen = false; } };
    const hold = (q) => { q._cutyou = true; q.agent.frozen = true; q.agent.path = null; };
    function end() { if (!J) return; rel_(J.thief); for (const c of J.chasers) rel_(c); J = null; cool = 240 + Math.random() * 300; }
    function crowd(s) { return s.people.filter((q) => outdoors(q) && q.age >= 12 && dP(q) < 110); }
    function begin(s) { const P = game.player; if (P.locked || P.mount || game.scene) return false;
      const thief = s.people.find((q) => free(q) && q.age >= 13 && q.age <= 40 && !isWatch(q) && dP(q) < 420 && ((q.gang && q.gang !== 'player') || (q.traits || []).some((t) => /greedy|dishonest|hostile|risk/.test(t))) && ((q.rel.get(0) || {}).affinity || 0) < 0.4);
      if (!thief) return false; hold(thief); J = { s, thief, stage: 'sidle', t: 0, skill: (thief.skills && thief.skills.stealth) || 0.3, chasers: [], took: null }; return true; }
    function lift() { const lv = (O.BodyGear && O.BodyGear.level((PS.items || []).length)) || 0; const items = (PS.items || []).filter((k) => G[k] && !['key'].includes(k));
      if (items.length && (lv >= 2 ? Math.random() < 0.5 : Math.random() < 0.2)) { const k = pick(items); PS.items.splice(PS.items.indexOf(k), 1); return { item: k, what: G[k].name.toLowerCase() }; }
      const amt = Math.min(PS.money || 0, 1 + Math.floor(Math.random() * (3 + lv * 2))); if (amt <= 0) return null; PS.money -= amt; return { money: amt, what: `${amt} aurin` }; }
    function giveBack(by) { const { thief, took, s } = J; if (!took) return; if (took.item) PS.items.push(took.item); if (took.money) PS.money = (PS.money || 0) + took.money; caught++; J.stage = 'over'; J.t = 0;
      O.gesture && O.gesture(thief, 'shake', 1.2); O.sfx && O.sfx('coins', 0.3); say(thief, pick(['All right! Take it! Take it!', 'Get off me! Here!', 'I never... oh, have it, then.']), 2.2);
      if (by && by !== 'you') say(by, isWatch(by) ? pick(['Got you, you little rat.', 'That\'s the stocks for you.']) : pick(['Here, I\'ve got him!', 'Not so fast, lad.']), 2);
      ui(`${thief.first} drops what they took: you have your ${took.what} back.`, 'good');
      try { s.remember(thief, 'Tried to dip the stranger\'s satchel in the crowd and got run down.', 'grudge', 1.4, 0); const r = thief.rel.get(0) || { affinity: 0, familiar: 0 }; r.affinity = Math.max(-1, r.affinity - 0.3); thief.rel.set(0, r);
        if (by && by !== 'you' && isWatch(by)) { const cr = s.recordCrime({ kind: 'pickpocket', perp: thief, placeName: s.world.name, tile: [Math.floor(thief.agent.x / T), Math.floor(thief.agent.y / T)], seen: [], victimPerson: null, severity: 1 }); setTimeout(() => { try { s.arrestNPC && s.arrestNPC(thief, cr, false); } catch (e) { /* */ } }, 1800); }
        if (by && by !== 'you' && !isWatch(by)) { const r2 = by.rel.get(0) || { affinity: 0, familiar: 0 }; r2.familiar = Math.min(1, (r2.familiar || 0) + 0.1); by.rel.set(0, r2); s.remember(by, `Helped the stranger run down ${thief.first}, who had dipped their satchel.`, 'social', 0.8); } } catch (e) { /* */ }
      setTimeout(end, 2600); }
    function cry() { if (!J || J.stage !== 'off') return; const { s, thief } = J; J.stage = 'chase'; J.t = 0; ui('"Thief! Stop, thief!"', 'warn'); const P = game.player; P.anim = 'point'; setTimeout(() => { if (P.anim === 'point') P.anim = 'idle'; }, 700);
      for (const q of s.people) { if (q === thief || !free(q) || Math.hypot(q.agent.x - thief.agent.x, q.agent.y - thief.agent.y) > 260) continue; if ((isWatch(q) || (q.age >= 16 && q.age < 50 && Math.random() < 0.3)) && J.chasers.length < 3) { hold(q); J.chasers.push(q); if (isWatch(q)) say(q, 'Stop in the King\'s name!', 1.8); } else O.gesture && O.gesture(q, Math.random() < 0.5 ? 'shocked' : 'point', 1.5); }
      const a = thief.agent; let best = null; for (let k = 0; k < 16; k++) { const ang = k / 16 * Math.PI * 2, tx = a.x + Math.cos(ang) * 300, ty = a.y + Math.sin(ang) * 220; if (!open(tx, ty)) continue; const away = Math.hypot(tx - P.x, ty - P.y); if (!best || away > best[2]) best = [tx, ty, away]; } J.flee = best ? [best[0], best[1]] : [a.x + 260, a.y]; }
    game.hooks.update.push((dt) => { const s = cur(); if (!s || !s.world) return; const P = game.player;
      if (J) { J.t += dt; const { thief } = J, a = thief.agent; if (J.s !== s || game.scene || thief.alive === false || a.inside != null) { end(); return; }
        if (J.stage === 'sidle') { // round behind you, close
          const bx = P.x + (thief.agent.x < P.x ? -8 : 8), by = P.y + 2; if (steer(thief, bx, by, dt, 40, 'walk') || dP(thief) < 12) { J.stage = 'dip'; J.t = 0; a.dir = O.dirOf(P.x - a.x, P.y - a.y); a.forceAnim = 'take'; } else if (J.t > 14) end(); return; }
        if (J.stage === 'dip') { if (J.t < 1) return; J.took = lift(); if (!J.took) { end(); return; } dipped++; past.push({ thief, took: J.took, day: s.day, t: game.t }); const feel = J.feelIt || Math.random() < 0.55 - J.skill * 0.3; J.felt = feel; J.stage = 'off'; J.t = 0; J.flee = [a.x + (a.x < P.x ? -280 : 280), a.y]; for (let k = 0; k < 8 && !open(J.flee[0], J.flee[1]); k++) J.flee[1] += 24;
          if (feel) { felt++; ui(`A tug at your satchel! You turn: ${thief.first} is walking off a little too briskly.`, 'warn'); O.gesture && O.gesture(thief, 'look', 0.6); } return; }
        if (J.stage === 'off') { steer(thief, J.flee[0], J.flee[1], dt, 46, 'walk'); if (!J.felt && J.t > 20) { ui(`Your satchel feels light. Somebody has had ${J.took.what} out of it.`, 'warn'); const w = s.people.find((q) => q !== thief && outdoors(q) && dP(q) < 180 && q.age >= 10 && !isWatch(q)); if (w) setTimeout(() => say(w, `That was ${thief.first}! I saw a hand in your bag.`, 2.4), 800); end(); return; }
          if (dP(thief) > 420 || J.t > 40) { escaped++; end(); } return; }
        if (J.stage === 'chase') { const sp = 78 + J.skill * 16; steer(thief, J.flee[0], J.flee[1], dt, sp, 'run'); if (Math.hypot(a.x - J.flee[0], a.y - J.flee[1]) < 6) { const ang = Math.random() * Math.PI * 2; J.flee = [a.x + Math.cos(ang) * 200, a.y + Math.sin(ang) * 160]; }
          for (const c of J.chasers) { steer(c, a.x, a.y, dt, isWatch(c) ? 74 : 66, 'run'); if (Math.hypot(c.agent.x - a.x, c.agent.y - a.y) < 10) { giveBack(c); return; } }
          if (dP(thief) < 16) { giveBack('you'); return; }
          if (J.t > 30 || dP(thief) > 520) { escaped++; ui(`${thief.first} is away down an alley, and your ${J.took.what} with them.`, 'warn'); end(); } return; }
        if (J.stage === 'over') return; }
      cool -= dt; if (cool > 0 && !force) return; cool = 20; const h = s.minute / 60; if (!force && (h < 8 || h > 21 || game.scene || P.locked)) return;
      const lv = (O.BodyGear && O.BodyGear.level((PS.items || []).length)) || 0; const busy = crowd(s).length;
      const mk = O.MarketDay && O.MarketDay.isMarket && O.MarketDay.isMarket(s);
      if (!force && (busy < 3 || ((PS.money || 0) < 2 && lv < 2) || Math.random() > (0.03 + lv * 0.03) * (mk ? 2 : 1))) return;
      const f = force; force = false; if (!begin(s)) { if (f) force = f; } else if (f === 'feel') J.feelIt = true; });
    (O.moreCandidates = O.moreCandidates || []).push(() => { if (!J || J.stage !== 'off' || game.scene) return null; const a = J.thief.agent; if (dP(J.thief) > 300) return null;
      return { type: 'custom', d: 1, x: a.x, y: a.y - 34, label: `Shout "Thief!" after ${J.thief.first}`, act: cry }; });
    // shout it in your own words, or tell the watch afterwards
    const respond = (q, t, line, render) => { (q._conv ||= []).push({ who: 'p', t }, { who: 'q', t: line }); render(line); return Promise.resolve(); };
    const _say = O.AIChat && O.AIChat.say;
    if (_say) O.AIChat.say = function (q, text, render) { try { const s = cur(), t = String(text || '');
      if (J && J.stage === 'off' && /\b(thief|stop (him|her|that)|he took|she took|my purse|my bag)\b/i.test(t)) { setTimeout(() => { O.npcUI && O.npcUI.closeTalk && O.npcUI.closeTalk(); cry(); }, 500); return respond(q, t, isWatch(q) ? 'Which way? After him!' : 'Where? That one? Stop, thief!', render); }
      const last = past.filter((p) => !p.told && s && p.day >= s.day - 1).slice(-1)[0];
      if (last && isWatch(q) && /\b(stole|steal|robbed|thief|took|cut ?purse|pick(ed)? ?pocket|dipped)\b/i.test(t)) { last.told = true; told++; const th = last.thief; const named = new RegExp('\\b' + th.first + '\\b', 'i').test(t);
        if (named || Math.random() < 0.4) { setTimeout(() => { O.npcUI && O.npcUI.closeTalk && O.npcUI.closeTalk(); try { const cr = s.recordCrime({ kind: 'pickpocket', perp: th, placeName: s.world.name, tile: th.agent ? [Math.floor(th.agent.x / T), Math.floor(th.agent.y / T)] : [0, 0], seen: [], victimPerson: null, severity: 1 }); if (th.alive !== false && s.arrestNPC) s.arrestNPC(th, cr, false); if (last.took.money) PS.money = (PS.money || 0) + Math.ceil(last.took.money / 2); ui(`The watch take up ${th.first}${last.took.money ? ', and a little of your money comes back to you' : ''}.`, 'good'); } catch (e) { console.error(e); } }, 1500); return respond(q, t, named ? `${th.first}? Aye, we know that one. Leave it with me.` : `Sounds like ${th.first}'s work. I'll have a word.`, render); }
        return respond(q, t, 'In that crowd? Could have been anyone. Keep your hand on your bag.', render); } } catch (e) { console.error(e); } return _say.apply(this, arguments); };
    (O.extraLines = O.extraLines || []).push((s, q) => { if (J && q === J.thief) return 'You have just dipped the player\'s satchel in the crowd. Act innocent; deny everything.'; const last = past.slice(-1)[0]; if (last && s && last.day >= s.day - 1 && isWatch(q)) return `The player had their satchel dipped in the street lately (${last.took.what}); ${last.thief.first} is a known light-fingered sort.`; return ''; });
    O.CutYou = { get job() { return J; }, get dipped() { return dipped; }, get felt() { return felt; }, get caught() { return caught; }, get escaped() { return escaped; }, get told() { return told; }, soon: (k) => { cool = 0; force = k || true; } };
  }
  O.CutYouSetup = { setup };
})();
