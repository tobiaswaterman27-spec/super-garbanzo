// The gangs, out where you can see them.
// - Every gang has its colour, and its people wear it: a cap dyed crimson, woad, green or black.
// - Gangs grow and shrink: they take on the poor and the angry young, and lose those who are taken by the
//   watch or have had enough of the boss.
// - Of an evening they gather at their haunt by the tavern: lounging, talking shop where you might hear
//   it, throwing dice. Ask to be dealt in and you can play them.
// - A member who knows you may ask a favour: go and get what someone owes, and keep a third.
// - Talk to one and they know their gang: the boss, their place in it, who they hate, what the gang did
//   lately, and what they think of the one giving the orders.
'use strict';
(function () {
  const T = 16;
  const COLOURS = ['crimson', 'woad', 'forest', 'black', 'mustard', 'plum'];
  const CNAME = { crimson: 'red', woad: 'blue', forest: 'green', black: 'black', mustard: 'yellow', plum: 'purple' };
  function setup(game) {
    const PS = O.PlayerState, cur = () => O.SimRef.cur, say = (t, k) => O.UI.say(t, k || 'note');
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    const near = (q, r) => q && q.agent && !q.agent.hidden && Math.hypot(q.agent.x - game.player.x, q.agent.y - game.player.y) < r;
    const gangsOf = (s) => (s.gangs || []).filter((g) => g.id !== 'player' && g.members.length);
    const colourOf = (g, k) => (g.colour = g.colour || COLOURS[(k ?? 0) % COLOURS.length]);
    function wear(s, q, g) {
      if (!q || !q.app || !q.app.outfit) return; const c = O.Pal.cloth[colourOf(g)]; if (!c) return;
      if (q.app.outfit._gang === g.id) return; q.app.outfit._gang = g.id; q.app.outfit.hat = 'cap'; q.app.outfit.hatMat = O.Pal.mat(c); O.Char.invalidate(q.app);
    }
    // colours on everyone, now and as they join
    let ct = 0;
    game.hooks.update.push((dt) => { ct -= dt; if (ct > 0) return; ct = 6; const s = cur(); if (!s) return; gangsOf(s).forEach((g, k) => { colourOf(g, k); for (const m of g.members) wear(s, s.byId.get(m.id), g); }); });

    // ---------------------------------------------------------------- growing and shrinking
    const SP = O.Sim.prototype, _nd = SP.newDay;
    SP.newDay = function () {
      const r = _nd.apply(this, arguments);
      try {
        for (const g of gangsOf(this)) {
          // the watch's catch and the fed-up leave
          for (const m of g.members.slice()) { const q = this.byId.get(m.id); if (!q || q.alive === false) { g.members = g.members.filter((x) => x !== m); continue; } if (m.id !== g.leader && m.loyalty < 0.18 && Math.random() < 0.3) { g.members = g.members.filter((x) => x !== m); q.gang = null; q._leftGang = this.day; if (q.app && q.app.outfit && q.app.outfit._gang) { q.app.outfit._gang = null; q.app.outfit.hat = null; O.Char.invalidate(q.app); } this.remember(q, `Walked out on ${g.name}. I've had enough of ${this.byId.get(g.leader)?.first || 'them'}.`, 'crime', 2); (g.log = g.log || []).push(`Day ${this.day}: ${q.first} walked out.`); } }
          // and new blood: the poor, the angry, the bored young
          if (g.members.length < 9 && Math.random() < 0.12 + (g.influence || 0) * 0.3) {
            const cand = this.people.filter((q) => !q.gang && !(q._leftGang != null && this.day - q._leftGang < 14) && !q.visitor && q.age >= 16 && q.age <= 32 && !O.upright(this, q) && ((this.household(q)?.money || 0) < 25 || q.attitude < -0.1 || q.traits.includes('hostile') || q.traits.includes('risk-taking')) && !q.jailUntil);
            const q = pick(cand); if (q) { g.members.push({ id: q.id, role: 'recruit', loyalty: 0.45, wage: 2, joined: this.day }); q.gang = g.id; q.attitude = Math.min(q.attitude, -0.15); this.remember(q, `Took the ${CNAME[g.colour] || ''} cap: I'm with ${g.name} now.`, 'crime', 2.5); (g.log = g.log || []).push(`Day ${this.day}: ${q.first} took the cap.`); this.log(`${q.name} has been seen in ${g.name}'s colours.`, 'gang'); }
          }
          // a little pay and a little grumbling
          for (const m of g.members) { if (g.purse >= (m.wage || 2)) { g.purse -= m.wage || 2; m.loyalty = Math.min(1, m.loyalty + 0.01); } else m.loyalty = Math.max(0, m.loyalty - 0.05); }
        }
      } catch (e) { console.error(e); }
      return r;
    };

    // ---------------------------------------------------------------- the evening haunt
    const haunt = (s, g) => { const tv = s.building(s.tavernId); const k = gangsOf(s).indexOf(g); if (!tv || tv.doorX == null) return null; return [tv.doorX + (k % 2 ? -5 : 4), tv.doorY + 2 + Math.floor(k / 2) * 2]; };
    const _plan = SP.plan;
    SP.plan = function (p) {
      const r = _plan.apply(this, arguments);
      try {
        if (p.gang && p.gang !== 'player' && r && !p.jailUntil && !p.job?.onShift && p.age >= 16) {
          const h = this.minute / 60;
          if (h >= 19 && h < 23 && (['home', 'socialise', 'stroll', 'idle', 'rest', 'errand'].includes(r.act) || (r.act === 'gangmeet' && this.day % 2 === 0)) && ((p.id + this.day) % 5) < 4) return { act: 'socialise', outdoor: true, zone: 'haunt:' + p.gang };
        }
      } catch (e) { /* */ }
      return r;
    };
    const _zone = SP.zoneTile;
    SP.zoneTile = function (p, zone) {
      if (typeof zone === 'string' && zone.startsWith('haunt:')) { const g = this.gang && this.gang(zone.slice(6)); const at = g && haunt(this, g); if (at) { const k = g.members.findIndex((m) => m.id === p.id); return [at[0] + (k % 3) - 1, at[1] + Math.floor(k / 3)]; } }
      return _zone.call(this, p, zone);
    };
    // what they say there, if you're close enough to hear
    const SHOP = ['The {h} place has silver in the back room, they say.', "Watch's changed its rounds. Mark it.", 'Who took the cut from the {h} job? Someone owes me.', "If the boss wants the market stalls, he'll have to pay the men.", 'They say the {g} are coming into our streets.', "Keep your voice down. Someone's listening.", 'Sixes again! You load these dice?', 'Another round, and put it on the boss.'];
    let ht = 4;
    game.hooks.update.push((dt) => {
      ht -= dt; if (ht > 0) return; ht = 7 + Math.random() * 6;
      const s = cur(); if (!s || game.scene) return; const h = s.minute / 60; if (h < 19 || h >= 23) return;
      for (const g of gangsOf(s)) {
        const here = g.members.map((m) => s.byId.get(m.id)).filter((q) => q && q.activity?.zone === 'haunt:' + g.id && near(q, 260) && !q.agent.hidden);
        if (here.length < 2) continue;
        const q = pick(here), hh = pick(s.households.filter((x) => !x.gone && x.surname)), other = pick(gangsOf(s).filter((x) => x !== g)) || g;
        const line = pick(SHOP).replace('{h}', hh ? hh.surname : 'Miller').replace('{g}', other.name.replace(/^the /i, ''));
        O.Speech && O.Speech.say(q, line, 3.2); if (/dice|Sixes/.test(line)) { O.gesture && O.gesture(q, 'celebrate', 1.4); O.sfx && O.sfx('catch', 0.4); }
        if (/listening/.test(line) && near(q, 80)) { q.agent.dir = O.dirOf(game.player.x - q.agent.x, game.player.y - q.agent.y); }
        break;
      }
    });

    // ---------------------------------------------------------------- dice, a favour, and what they know
    const RX = { dice: /\b(deal me in|can i (play|join)|throw (the )?dice|a game of dice|play dice|roll (the )?dice)\b/i, debtTake: /\b(i'?ll (do it|get it|collect)|aye|yes|done)\b/i, debtCollect: /\b(you owe|pay (up|what you owe)|the money you owe|settle your debt|i'?m here for (the|his|her) money)\b/i, debtDeliver: /\b(here'?s (your|the) money|i got (it|your money)|collected)\b/i };
    const respond = (q, text, render, line) => { (q._conv = q._conv || []).push({ who: 'p', t: text }); q._conv.push({ who: 'q', t: line }); render(line); return Promise.resolve(); };
    function tryGang(s, q, text, render) {
      // dice at the haunt
      if (q.gang && q.gang !== 'player' && q.activity?.zone === 'haunt:' + q.gang && RX.dice.test(text)) {
        const stake = Math.max(1, Math.min(10, (String(text).match(/\d+/) || [2])[0] * 1));
        if (PS.money < stake) return respond(q, text, render, "Come back when you've coin to lose.");
        const you = 1 + Math.floor(Math.random() * 6) + 1 + Math.floor(Math.random() * 6), them = 2 + Math.floor(Math.random() * 6) + Math.floor(Math.random() * 6) + (q.traits.includes('dishonest') ? 1 : 0);
        PS.skills.gambling = Math.min(1, (PS.skills.gambling || 0) + 0.01);
        O.sfx && O.sfx('catch', 0.6); O.gesture && O.gesture(q, 'celebrate', 1);
        if (you > them) { PS.money += stake; const hh = s.household(q); if (hh) hh.money -= stake; s.relate(q, { id: 0 }, 0.02); return respond(q, text, render, `You throw ${you}, I throw ${them}. Curse you. ₳${stake}, take it.`); }
        if (you === them) return respond(q, text, render, `${you} and ${you}. Again, then.`);
        PS.money -= stake; const hh = s.household(q); if (hh) hh.money += stake; s.relate(q, { id: 0 }, 0.04);
        return respond(q, text, render, `${them} beats your ${you}. ₳${stake} to me. Another?`);
      }
      // the favour: collect a debt
      const F = PS.gfavour;
      if (F && F.creditor === q.id && !F.taken && RX.debtTake.test(text)) { F.taken = true; O.addLead && O.addLead({ place: s.world.placeId, id: F.debtor, until: (s.day + 3) * 1440, why: 'favour', label: `Get ₳${F.amt} off ${s.byId.get(F.debtor)?.first || 'the debtor'}` }); return respond(q, text, render, `Good. ₳${F.amt}, and you keep a third. Don't come back light.`); }
      if (F && F.taken && !F.got && F.debtor === q.id && RX.debtCollect.test(text)) {
        const scared = q.traits.includes('cowardly') || PS.equipped !== 'fists' || (PS.rep.criminal || 0) > 0.3, hh = s.household(q), can = hh && hh.money >= F.amt;
        if (scared && can) { hh.money -= F.amt; F.got = true; PS.money += F.amt; O.NpcActs && O.NpcActs.fly && O.NpcActs.fly(q, 'player', 'coin'); s.relate(q, { id: 0 }, -0.3); return respond(q, text, render, `All right! All right. ₳${F.amt}. Tell him we're square.`); }
        if (!can) return respond(q, text, render, "I haven't got it. Look at this place. Tell him I'll pay at Michaelmas.");
        s.relate(q, { id: 0 }, -0.2); if (O.Combat && Math.random() < 0.4) O.Combat.provoke(q, 'fight');
        return respond(q, text, render, 'I owe him nothing. Get off my step.');
      }
      if (F && F.got && F.creditor === q.id && RX.debtDeliver.test(text)) {
        const give = Math.ceil(F.amt * 2 / 3); if (PS.money < give) return respond(q, text, render, "That's not all of it. Two thirds, I said.");
        PS.money -= give; const g = s.gang(q.gang); if (g) g.purse += give; PS.gfavour = null; s.relate(q, { id: 0 }, 0.25); (PS.gangRanks || []).filter((m) => m.gid === q.gang).forEach((m) => { m.trust = Math.min(1, (m.trust || 0) + 0.1); });
        O.NpcActs && O.NpcActs.fly && O.NpcActs.fly('player', q, 'coin'); O.dropLead && O.dropLead((l) => l.why === 'favour');
        return respond(q, text, render, 'Every coin. You can be trusted, then. Remember who sent you.');
      }
      return null;
    }
    const _say = O.AIChat && O.AIChat.say;
    if (_say) O.AIChat.say = function (q, text, render, opt) { if (q && typeof text === 'string' && O.AI && O.AI.ready) { try { const r = tryGang(cur(), q, text, render); if (r) return r; } catch (e) { console.error(e); } } return _say.apply(this, arguments); };
    // a member who knows you comes with a favour
    let ft = 30;
    game.hooks.update.push((dt) => {
      ft -= dt; if (ft > 0) return; ft = 45;
      const s = cur(); if (!s || game.scene || PS.gfavour || (O.npcUI && O.npcUI.talking())) return;
      const q = s.people.find((z) => z.gang && z.gang !== 'player' && near(z, 160) && ((z.rel.get(0) || {}).familiar || 0) > 0.25 && ((z.rel.get(0) || {}).affinity || 0) > 0);
      if (!q || Math.random() > 0.35) return;
      const debtor = pick(s.people.filter((z) => z !== q && !z.gang && z.age >= 20 && !O.upright(s, z) && z.home != null)); if (!debtor) return;
      const amt = 6 + Math.floor(Math.random() * 14); PS.gfavour = { creditor: q.id, debtor: debtor.id, amt, day: s.day, place: s.world.placeId };
      O.npcUI.startFrom(q, `You. ${debtor.name} owes me ₳${amt} and won't pay. Get it off them and you keep a third. Will you do it?`);
    });
    game.hooks.update.push(() => { const F = PS.gfavour, s = cur(); if (F && s && s.day - F.day > 4) { PS.gfavour = null; const q = s.byId.get(F.creditor); if (q && F.taken) { s.relate(q, { id: 0 }, -0.25); s.remember(q, 'The stranger took my debt to collect and never came back with it.', 'grudge', 2); } } });
    (O.extraLines = O.extraLines || []).push((s, q) => {
      if (!q.gang || q.gang === 'player') return '';
      const g = s.gang(q.gang); if (!g) return ''; const m = g.members.find((x) => x.id === q.id); if (!m) return '';
      const boss = s.byId.get(g.leader), foes = Object.entries(g.rel || {}).filter(([, v]) => v === 'enemy').map(([id]) => s.gang(id)?.name).filter(Boolean);
      const last = (g.log || []).slice(-2).map((l) => l.replace(/^Day \d+: /, '')).join(' ');
      const F = PS.gfavour;
      return `You are in ${g.name}, who wear ${CNAME[g.colour] || 'their'} caps; you are a ${m.role}${g.leader === q.id ? ' and the boss' : boss ? `, under ${boss.name}` : ''}. ${g.leader === q.id ? `You run it: ${g.members.length} in the gang, the purse at ₳${Math.round(g.purse || 0)}, and you watch for anyone getting ideas.` : m.loyalty > 0.7 ? 'You would die for the gang.' : m.loyalty < 0.35 ? 'You are sick of the boss and half thinking of walking out.' : 'You do as you are told.'}${foes.length ? ` You are at war with ${foes.join(' and ')}.` : ''}${last ? ` Lately: ${last}` : ''}${q.activity?.zone === 'haunt:' + g.id ? ' You are with the others at your haunt by the tavern, with dice; you will deal in anyone with coin.' : ''}${F && F.creditor === q.id ? ` You asked the player to collect ₳${F.amt} owed by ${s.byId.get(F.debtor)?.name}.` : ''} Never name the gang's business to an upright person.`;
    });
    O.GangStreet = { COLOURS, CNAME, haunt };
  }
  O.GangStreetSetup = { setup };
})();
