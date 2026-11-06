// The underworld, deeper. Stolen goods are known: try to sell a man's candlestick back to the town he
// lost it in and someone will know it; take it to the fence, or carry it to another town. A heist is
// planned: you watch a rich house of a night to learn its ways, you talk your crew into it (a lookout
// who calls the watch's coming, a picklock who opens the door), you go in together, and after they want
// their share. The gangs make war where you can see it: brawls in the square, a stall burnt, the tavern
// taken; you can broker a peace or light the fire. There are rats in every gang: a whisper, a test, and
// the reckoning. Smuggling is a night's walk with a load and a toll keeper you've paid to look away.
// And a guard on your purse warns you before the watch come knocking.
'use strict';
(function () {
  const T = 16;
  function setup(game) {
    const PS = O.PlayerState, cur = () => O.SimRef.cur, say = (t, k) => O.UI.say(t, k), G = () => O.Data.GOODS;
    const sp = (q, t, secs = 3) => O.Speech && O.Speech.say(q, t, secs);
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    const nm = (k) => (G()[k]?.name || k).toLowerCase();
    const night = (s) => s.hour >= 21.5 || s.hour < 4.5;
    const myGangs = (s) => (PS.gangRanks || []).filter((m) => m.place === s.world.placeId);
    const inMyGang = (s, q) => q && q.gang && myGangs(s).some((m) => m.gid === q.gang);
    const isWatch = (q) => /^guard|sergeant|watch/.test(q.job?.role || '');

    // ---------------------------------------------------------------- stolen goods are known where they were stolen
    let st = 0;
    game.hooks.update.push((dt) => { st -= dt; if (st > 0) return; st = 2; const s = cur(); if (!s) return; PS.stolenAt = PS.stolenAt || {}; for (const k of Object.keys(PS.stolen || {})) { if ((PS.stolen[k] || 0) > 0 && !PS.stolenAt[k]) PS.stolenAt[k] = s.world.placeId; if (!(PS.stolen[k] > 0)) delete PS.stolenAt[k]; } });
    // selling it at a counter in that same town: the shopkeeper may know it
    O.stolenRecognised = (s, g, seller) => {
      if (!(PS.stolen && PS.stolen[g] > 0) || (PS.stolenAt || {})[g] !== s.world.placeId) return false;
      if (Math.random() > 0.55) return false;
      const by = seller || null;
      if (by) { sp(by, pick([`Where did you get this? That's ${pick(['Hugh', 'Agnes', 'the Millers'])}'s ${nm(g)}, I'd know it anywhere.`, `This was stolen. I'll not touch it.`]), 4); O.gesture && O.gesture(by, 'shake', 1.6); s.remember(by, `The stranger tried to sell me a stolen ${nm(g)}.`, 'crime', 1.6, -0.2); s.relate && s.relate(by, { id: 0 }, -0.2); }
      const cr = s.recordCrime({ kind: 'selling stolen goods', perp: 'player', placeName: s.world.name, tile: [Math.floor(game.player.x / T), Math.floor(game.player.y / T)], seen: by ? [by] : [], severity: 1 }); PS.crimes.push(cr.id);
      O.Panels.toast(`The ${nm(g)} is known here. Take it to a fence, or to another town.`, 'bad');
      return true;
    };
    // goods carried to another town are safe to sell there
    // (hooked into the counter's buy-from-you path)
    if (O.NpcActs) {
      const _apply = O.NpcActs.apply;
      O.NpcActs.apply = function (s, q, a) { if (a && a.do === 'buy') { const g = O.NpcActs.goodFor(a.item); if (g && O.stolenRecognised(s, g, q)) return `${q.first} won't buy it.`; } return _apply.apply(this, arguments); };
    }

    // ---------------------------------------------------------------- heists: case it, crew it, do it, split it
    (O.moreCandidates = O.moreCandidates || []).push(() => {
      const s = cur(), P = game.player; if (!s || game.scene || !night(s)) return null;
      const b = s.world.buildings.find((x) => x.doorX != null && ['house', 'mansion', 'townhouse', 'manor'].includes(x.type) && (x.wealth || 0) > 0.55 && Math.hypot(x.doorX * T + 8 - P.x, (x.doorY + 2) * T - P.y) < 60 && x.household);
      if (!b || (PS.heist && PS.heist.target === b.id && PS.heist.cased)) return null;
      return { type: 'custom', d: 30, x: P.x, y: P.y - 44, label: 'Watch the house a while', act: () => {
        P.locked = true; P.anim = 'crouch'; P.ft = 0;
        setTimeout(() => { P.locked = false; P.anim = 'idle'; const hh = s.households[b.household - 1], n = hh ? hh.members.length : 2;
          PS.heist = { target: b.id, place: s.world.placeId, cased: true, crew: [], start: null, day: s.day, name: hh ? `the ${hh.surname} house` : 'the house' };
          say(`You watch ${PS.heist.name} from the dark. ${n} sleep there; the last lamp goes out late; ${b.wealth > 0.7 ? 'there will be silver, and a strongbox' : 'there may be coin put by'}. A crew would make it easier: a lookout, and a hand with a lock.`);
          O.addLead && O.addLead({ place: s.world.placeId, b: b.id, until: (s.day + 4) * 1440, why: 'heist', label: `The job: ${PS.heist.name}` }); }, 2500);
      } };
    });
    const CREW_ASK = /\b(help me with|in on|join me (for|on)|need (a|you for a)) (a |the )?(job|heist|break[- ]?in|crack|house)\b|\b(lookout|keep watch for me|pick (a|the) lock for me)\b/i;
    const _say = O.AIChat.say;
    O.AIChat.say = function (q, text, render, opt) {
      const s = cur(); const rep = (l) => { (q._conv = q._conv || []).push({ who: 'p', t: text }, { who: 'q', t: l }); render(l, false); return Promise.resolve(); };
      if (q && typeof text === 'string' && s) {
        // crew for the job
        if (PS.heist && PS.heist.place === s.world.placeId && CREW_ASK.test(text)) {
          if (PS.heist.crew.includes(q.id)) return rep("I'm in already. Just say when.");
          const crooked = inMyGang(s, q) || q.gang || (q.attitude ?? 0) < -0.3 || q.traits?.includes('risk-taking');
          if (!crooked) return rep(pick(['A break-in? Are you mad? I want nothing to do with it.', 'I never heard that. Go away before I call the watch.']));
          const role = PS.heist.crew.length === 0 ? 'lookout' : 'picklock'; PS.heist.crew.push(q.id); (PS.heist.roles = PS.heist.roles || {})[q.id] = role;
          s.remember(q, `Agreed to go in on a job with the stranger at ${PS.heist.name}, as ${role}.`, 'crime', 1.5, 0.05);
          return rep(role === 'lookout' ? 'I\'ll keep watch. A whistle if anyone comes. A quarter of the take.' : 'I can open any door in this town. A quarter, mind.');
        }
        // gang war and peace
        if (/\b(make peace|end the feud|truce|stop the fighting) with\b/i.test(text) && q.gang) { const g = s.gang(q.gang), other = s.gangs.find((x) => x.id !== q.gang && text.toLowerCase().includes((x.name || '').toLowerCase().replace(/^the /, ''))) || s.gangs.find((x) => x.id !== q.gang && g.rel[x.id] === 'enemy');
          if (g && g.leader === q.id && other) { const myRank = Math.max(0, ...myGangs(s).map((m) => m.rank || 0)); if (myRank >= 2 || (q.rel.get(0)?.affinity || 0) > 0.4) { g.rel[other.id] = 'rival'; other.rel[g.id] = 'rival'; s.log(`${g.name} and ${other.name} have made a truce, brokered by the newcomer.`, 'gang'); return rep(`For you, then. No more blood with ${other.name}, so long as they keep their side.`); } return rep('Who are you to tell me who to fight?'); } }
        if (/\b(they insulted|they'?re after you|they want your|strike first|hit them|start (a|the) war)\b/i.test(text) && q.gang) { const g = s.gang(q.gang), other = s.gangs.find((x) => x.id !== q.gang && x.id !== 'player'); if (g && g.leader === q.id && other) { g.rel[other.id] = 'enemy'; other.rel[g.id] = 'enemy'; s.log(`War between ${g.name} and ${other.name}.`, 'gang'); return rep(`Then they'll pay for it. Tell no one it came from you.`); } }
        // the rat
        if (/\b(i know (you|it was you) (talked|told|went to the watch)|you'?re the rat|you sold us out|informer)\b/i.test(text) && q.gang && q._rat) { q._rat = false; const g = s.gang(q.gang); if (Math.random() < 0.5) { if (g) g.members = g.members.filter((m) => m.id !== q.id); q.gang = null; O.flee && O.flee(q, 8); s.log(`${q.name} was found out as an informer and ran from ${g ? g.name : 'the gang'}.`, 'gang'); return rep('It wasn\'t... I had to! They had my brother!'); } if (g) g.members = g.members.filter((m) => m.id !== q.id); q.gang = null; for (const m of myGangs(s)) m.trust = Math.min(1, (m.trust || 0) + 0.15); return rep('Aye. I did. Do what you like to me.'); }
        // a guard on your purse
        if (isWatch(q) && /\b(a coin for|look the other way|warn me|tip me off|keep me (warned|posted)|for your trouble)\b/i.test(text)) {
          const greedy = q.traits?.includes('greedy') || (q.attitude ?? 0) < 0; if (!greedy) { s.relate && s.relate(q, { id: 0 }, -0.2); return rep('Are you trying to bribe an officer of the watch? Move along before I take you in.'); }
          if (PS.money < 10) return rep('Ten aurins a week, and you haven\'t ten.'); PS.money -= 10; const hh = s.household(q); if (hh) hh.money += 10; PS.paidGuard = { id: q.id, name: q.first, place: s.world.placeId, until: s.day + 7 }; return rep('Ten a week. If the sergeant\'s planning a visit, you\'ll hear it first. And we never spoke.');
        }
        // a toll keeper who looks away
        if (q.job?.role === 'toll keeper' && /\b(look the other way|not see|wave (me|my cart) through|what'?s in the cart|no questions)\b/i.test(text)) { if (PS.money < 6) return rep('Six aurins buys a short memory, and you haven\'t six.'); PS.money -= 6; const hh = s.household(q); if (hh) hh.money += 6; PS.tollBribed = { place: s.world.placeId, until: s.day + 5 }; return rep('Night carts are none of my business. For a few days.'); }
        // a smuggling run: ask a smuggler or a gang's man for the work
        if ((inMyGang(s, q) || /smuggler/.test(q.job?.role || '')) && /\b(smuggl|a run|run (some|the) goods|carry (it|the goods) (by|at) night)\b/i.test(text) && !PS.run) {
          const buyer = s.world.buildings.filter((b) => b.doorX != null && (b.type === 'tavern' || b.type === 'warehouse' || b.type === 'house'))[Math.floor(Math.random() * 6)] || s.world.buildings.find((b) => b.id === s.tavernId);
          PS.run = { place: s.world.placeId, good: pick(['wine', 'silk', 'spices', 'salt']), to: buyer.id, toName: (buyer.type === 'house' || !buyer.name || /^house$/i.test(buyer.name)) ? (() => { const hh = s.households[(buyer.household || 0) - 1]; return hh ? `the ${hh.surname} house` : 'the house by the ' + (buyer.doorY > s.world.H / 2 ? 'south road' : 'north road'); })() : buyer.name, from: q.id, pay: 18 + Math.floor(Math.random() * 14), until: s.day + 2 };
          if (PS.add(PS.run.good)) { O.NpcActs && O.NpcActs.fly(q, 'player', PS.run.good); PS.carry = PS.carry || { good: PS.run.good, qty: 1, look: 'carry' }; }
          O.addLead && O.addLead({ place: s.world.placeId, b: buyer.id, until: PS.run.until * 1440, why: 'run', label: `Carry the ${nm(PS.run.good)} to ${PS.run.toName}, after dark` });
          return rep(`Take this load of ${nm(PS.run.good)} to ${PS.run.toName}. After dark, and keep off the high street: if the watch see the load, it's yours to explain. ₳${PS.run.pay} when it's there.`);
        }
      }
      return _say.apply(this, arguments);
    };
    // the job itself: the crew go with you; the lookout calls; the picklock opens; the house is richer for knowing it
    let ht = 0, warned = 0;
    game.hooks.update.push((dt) => {
      ht -= dt; if (ht > 0) return; ht = 0.6; const s = cur(), H = PS.heist; if (!s || !H || H.place !== s.world.placeId) return;
      const b = s.building(H.target); if (!b) { PS.heist = null; return; } const P = game.player;
      const near = !game.scene && Math.hypot(b.doorX * T + 8 - P.x, (b.doorY + 1) * T - P.y) < 120;
      if (near && night(s) && H.crew.length && !H.start) { H.start = { money: PS.money, stolen: Object.values(PS.stolen || {}).reduce((a, c) => a + c, 0), day: s.day }; for (const id of H.crew) { const q = s.byId.get(id); if (q && O.NpcActs) O.NpcActs.apply(s, q, { do: 'follow' }, q); } say('Your crew falls in behind you in the dark.'); }
      if (H.start && !game.scene) {
        // the picklock at the door: it opens
        const pl = H.crew.find((id) => (H.roles || {})[id] === 'picklock'), plq = pl && s.byId.get(pl);
        if (plq && Math.hypot(b.doorX * T + 8 - P.x, (b.doorY + 1) * T - P.y) < 30 && !(b._doorOpen > game.t)) { b._doorOpen = game.t + 40; sp(plq, 'There. Quiet as a mouse.', 2.5); O.gesture && O.gesture(plq, 'crouch', 1.5); }
        // the lookout calls the watch's coming
        const lo = H.crew.find((id) => (H.roles || {})[id] === 'lookout'), loq = lo && s.byId.get(lo);
        if (loq && game.t > warned) { const g = s.people.find((q) => isWatch(q) && !q.agent.hidden && q.agent.inside == null && Math.hypot(q.agent.x - P.x, q.agent.y - P.y) < 220); if (g) { warned = game.t + 20; sp(loq, 'Watch! Someone\'s coming!', 2.5); O.sfx && O.sfx('whoosh', 0.5); } }
      }
      // inside: the house is as you watched it, with the silver where you guessed
      if (game.scene && game.scene.b.id === b.id && H.start && !H.seeded) { H.seeded = true; const hh = s.households[b.household - 1]; if (hh) { hh.valuables = [...new Set([...(hh.valuables || []), 'candlestick', b.wealth > 0.7 ? 'necklace' : 'spoon', 'brooch'])]; hh.money += 20; } }
      // done: out and away with something; the crew want their share by morning
      if (H.start && H.seeded && !game.scene && Math.hypot(b.doorX * T + 8 - P.x, (b.doorY + 1) * T - P.y) > 300) {
        const gotCoin = Math.max(0, PS.money - H.start.money), gotGoods = Math.max(0, Object.values(PS.stolen || {}).reduce((a, c) => a + c, 0) - H.start.stolen);
        const worth = gotCoin + gotGoods * 8, share = Math.floor(worth / 4);
        for (const id of H.crew) { const q = s.byId.get(id); if (!q) continue; if (O.NpcActs) O.NpcActs.apply(s, q, { do: 'stop' }, q); const pay = Math.min(share, PS.money); if (pay > 0) { PS.money -= pay; const hh = s.household(q); if (hh) hh.money += pay; } s.remember(q, `Did a job with the stranger at ${H.name}${pay ? ` and was paid ₳${pay}` : ', for nothing'}.`, 'crime', 1.5, pay ? 0.1 : -0.3); }
        say(worth ? `The job's done. ${H.crew.length ? `Your crew take their quarter${H.crew.length > 1 ? 's' : ''} (₳${share} each) and melt away.` : ''}` : 'You come away empty-handed. The crew are not pleased.');
        for (const m of myGangs(s)) { m.trust = Math.min(1, (m.trust || 0) + (worth ? 0.08 : 0)); }
        PS.heist = null; PS.leads = (PS.leads || []).filter((l) => l.why !== 'heist');
      }
      if (H && s.day > H.day + 4) PS.heist = null; // (the chance passes)
    });

    // ---------------------------------------------------------------- the gangs at war, where you can see it
    const SPx = O.Sim.prototype, _nd = SPx.newDay;
    SPx.newDay = function () {
      const r = _nd.apply(this, arguments);
      try {
        const gs = (this.gangs || []).filter((g) => g.id !== 'player' && g.members.length);
        // rivals become enemies over a slight, now and then
        if (gs.length >= 2 && Math.random() < 0.08) { const a = pick(gs), b = pick(gs.filter((x) => x !== a)); if (b && a.rel[b.id] === 'rival') { a.rel[b.id] = 'enemy'; b.rel[a.id] = 'enemy'; this.log(`Blood between ${a.name} and ${b.name}: a man cut in a tavern quarrel.`, 'gang'); } }
        // at war: a stall burns, or the tavern changes hands
        for (const a of gs) for (const b of gs) { if (a.id >= b.id || a.rel[b.id] !== 'enemy' || Math.random() > 0.3) continue;
          if (Math.random() < 0.5) { const stall = this.world.props.find((p) => p.kind === 'stall' && !p.burnt); if (stall) { stall.burnt = this.day; this.world.dirtyStatics = true; this.log(`A market stall burnt in the night: ${a.name}'s work, they say, against ${b.name}'s friends.`, 'gang'); } }
          else { const win = Math.random() < 0.5 ? a : b; const tv = this.biz.get(this.tavernId); if (tv) { tv.gangHeld = win.id; this.log(`${win.name} have the tavern now: their men drink free, and the others stay away.`, 'gang'); } }
        }
        // the rat: in any gang you run with, one member may be talking to the watch
        for (const m of myGangs(this)) { const g = this.gang(m.gid); if (!g || Math.random() > 0.06) continue; const cand = g.members.map((x) => this.byId.get(x.id)).filter((q) => q && q.id !== g.leader && !q._rat); const rat = cand[Math.floor(Math.random() * cand.length)]; if (rat) { rat._rat = true; setTimeout(() => say(`A whisper in ${g.name}: someone has been talking to the watch. Who's been seen at the watch house?`, 'bad'), 4000); } }
        // the paid guard keeps their word, or the arrangement ends
        if (PS.paidGuard && this.day > PS.paidGuard.until) { PS.paidGuard = null; say('Your arrangement with the watch has run out. Pay again for another week of warnings.'); }
        if (PS.run && this.day > PS.run.until) { PS.run = null; say('The smuggled load was never delivered. The ones who gave it you won\'t forget.', 'bad'); }
      } catch (e) { console.error(e); }
      return r;
    };
    // brawls in the square between enemy gangs, at night: you can watch, join in, or keep clear
    let bt = 0;
    game.hooks.update.push((dt) => {
      bt -= dt; if (bt > 0) return; bt = 20; const s = cur(); if (!s || game.scene || !O.Errands || !(s.hour > 20 || s.hour < 1)) return;
      const gs = (s.gangs || []).filter((g) => g.id !== 'player'); const pair = []; for (const a of gs) for (const b of gs) if (a.id < b.id && a.rel[b.id] === 'enemy') pair.push([a, b]); if (!pair.length || Math.random() > 0.35) return;
      const [a, b] = pick(pair), sq = (s.world.zones && s.world.zones.square && O.sqCentre(s.world.zones.square)) || [Math.floor(game.player.x / T), Math.floor(game.player.y / T)];
      const P = game.player; if (Math.hypot(sq[0] * T - P.x, sq[1] * T - P.y) > 500) return;
      const side = (g, off) => g.members.map((m) => s.byId.get(m.id)).filter((q) => q && q.agent && !q.agent.hidden && q.agent.inside == null).slice(0, 3).forEach((q, i) => O.Errands.send(s, q, [sq[0] + off, sq[1] + i - 1], { anim: 'attack', secs: 7, face: off < 0 ? 2 : 1, giveUp: game.t + 50, at: () => { if (Math.random() < 0.5) sp(q, pick(['Get out of our street!', 'You\'ll pay for that!', 'Come on then!']), 2); if (Math.random() < 0.3 && s.fallIll) s.fallIll(q, 'injury', 0.3); } }));
      side(a, -1); side(b, 1); s.log(`${a.name} and ${b.name} brawling in the square.`, 'gang');
      for (const q of s.people) if (!q.gang && q.agent && !q.agent.hidden && q.agent.inside == null && Math.hypot(q.agent.x - sq[0] * T, q.agent.y - sq[1] * T) < 120 && Math.random() < 0.5) O.flee && O.flee(q, 5, () => ({ x: sq[0] * T, y: sq[1] * T }));
    });
    // a burnt stall shows it
    game.hooks.drawWorld.push((ctx, cam) => { const w = game.world; if (!w || game.scene) return; for (const p of w.props) { if (p.kind !== 'stall' || !p.burnt) continue; const x = Math.round(p.x - cam.x), y = Math.round(p.y - cam.y); ctx.fillStyle = 'rgba(20,14,10,0.78)'; ctx.fillRect(x - 15, y - 26, 30, 24); ctx.fillStyle = '#2a1e16'; for (let k = 0; k < 6; k++) ctx.fillRect(x - 14 + k * 5, y - 10 - (k % 3) * 4, 2, 10); } });

    // ---------------------------------------------------------------- the paid guard's warning before a raid
    // when the watch mean to come for you (wanted, or your gang's den), your guard finds you first
    let wt = 0;
    game.hooks.update.push((dt) => {
      wt -= dt; if (wt > 0) return; wt = 5; const s = cur(), G0 = PS.paidGuard; if (!s || !G0 || G0.place !== s.world.placeId) return;
      const wanted = O.Law && O.Law.wanted && O.Law.wanted() >= 1;
      if (!wanted || (G0.warnedDay === s.day)) return; const q = s.byId.get(G0.id); if (!q || !q.agent || q.agent.hidden) return;
      G0.warnedDay = s.day; O.npcUI && !O.npcUI.talking() && O.npcUI.startFrom(q, 'Quiet. The sergeant has your description and the watch will be out for you tonight. Keep off the streets, or change your coat.');
    });
    // the smuggling run: carry it there after dark; seen by the watch with the load, it's a chase
    let rt = 0;
    game.hooks.update.push((dt) => {
      rt -= dt; if (rt > 0) return; rt = 1; const s = cur(), R = PS.run; if (!s || !R || R.place !== s.world.placeId) return; const P = game.player;
      if (!PS.items.includes(R.good)) { PS.run = null; return; }
      if (!night(s) && !game.scene) { const g = s.people.find((q) => isWatch(q) && !q.agent.hidden && q.agent.inside == null && Math.hypot(q.agent.x - P.x, q.agent.y - P.y) < 70); if (g && Math.random() < 0.3 && !(PS.tollBribed && PS.tollBribed.place === s.world.placeId && s.day <= PS.tollBribed.until)) { sp(g, 'What\'s that you\'re carrying? Stop there!', 3); PS.stolen = PS.stolen || {}; PS.stolen[R.good] = (PS.stolen[R.good] || 0) + 1; const cr = s.recordCrime({ kind: 'smuggling', perp: 'player', placeName: s.world.name, tile: [Math.floor(P.x / T), Math.floor(P.y / T)], seen: [g], severity: 1 }); PS.crimes.push(cr.id); O.Law && O.Law.startChase(g); } }
      const b = s.building(R.to); if (b && Math.hypot(b.doorX * T + 8 - P.x, (b.doorY + 1) * T - P.y) < 30) { PS.remove(R.good); if (PS.carry && PS.carry.good === R.good) PS.carry = null; PS.money += R.pay; O.sfx && O.sfx('kaching', 0.9); say(`A hand takes the ${nm(R.good)} at the door, and ₳${R.pay} is pressed into yours. Nobody saw.`); for (const m of myGangs(s)) m.trust = Math.min(1, (m.trust || 0) + 0.06); PS.leads = (PS.leads || []).filter((l) => l.why !== 'run'); PS.run = null; }
    });
    (O.extraLines = O.extraLines || []).push((s, q) => { const out = []; if (q._rat) out.push('You have been secretly talking to the watch about your gang. If accused you may deny it, or crack.'); const tv = s.biz.get(s.tavernId); if (tv && tv.gangHeld && q.gang === tv.gangHeld) out.push('Your gang holds the tavern now.'); if (PS.heist && (PS.heist.crew || []).includes(q.id)) out.push(`You are in on the player's job at ${PS.heist.name}.`); if (PS.paidGuard && PS.paidGuard.id === q.id) out.push('The player pays you each week to warn them of the watch.'); return out.join(' '); });
    O.GangDeep = { night };
  }
  O.GangDeepSetup = { setup };
})();
