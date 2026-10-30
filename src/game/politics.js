// The great houses, the commons, and the siege. Every lordship is a House, with its allies and its
// enemies: they marry their children to each other, fall out and feud, and now and then one plots
// against another (a lord dies at table, and whispers say poison) or seizes a rival's castle outright.
// You can be drawn in: a noble may take you into their house's favour, or plot with you against a rival
// house, and you can put the scheme to them yourself. The commons rise wherever they're pushed too far
// (dear bread, hard lords, heavy taxes), and before they march they gather in the square with whatever
// they can carry; you can lead them, or warn the lord. And a castle or walled town can be besieged: the
// besiegers' tents and fires ring it, food inside runs down day by day, and you can join either side,
// lead an assault on the walls or man them, until it falls or holds.
'use strict';
(function () {
  const T = 16;
  function setup(game) {
    const PS = O.PlayerState, cur = () => O.SimRef.cur, say = (t, k) => O.UI.say(t, k), K = () => O.SimRef.home.kingdom, clamp = O.clamp;
    const placeName = (id) => K().place(id)?.name || id;
    const lordOf = (id) => (K().lordName ? K().lordName(id) : placeName(id));
    const houses = () => {
      const k = K(); if (k.houses) return k.houses; k.houses = {};
      for (const [pid, L] of Object.entries((k.rulers && k.rulers.lords) || {})) { const parts = String(L.name || '').trim().split(' '); k.houses[pid] = { seat: pid, name: parts.length > 1 ? `House ${parts[parts.length - 1]}` : `the House of ${placeName(pid)}`, stance: {}, schemes: [] }; }
      return k.houses;
    };
    const houseAt = (pid) => houses()[pid];
    const stance = (a, b) => (houseAt(a) && houseAt(a).stance[b]) || 'neutral';
    const setStance = (a, b, v) => { if (houseAt(a)) houseAt(a).stance[b] = v; if (houseAt(b)) houseAt(b).stance[a] = v; };
    const busy = (id) => (K().conflicts || []).some((c) => !c.done && (c.a === id || c.b === id));
    const news = (t, kind, at) => K().addNews && K().addNews(t, kind || 'politics', at);
    const newLord = (pid, how) => { const R = K().rulers, L = R.lords[pid]; if (!L) return; const sex = Math.random() < 0.5 ? 'm' : 'f'; const nm = (O.Data.NAMES[sex] || ['Edmund'])[Math.floor(Math.random() * 40)]; const h = L.heir && L.heir.age >= 14 ? L.heir : { name: `${nm} ${String(L.name || '').split(' ').slice(-1)[0]}`, sex, age: 20 + Math.floor(Math.random() * 20) }; R.lords[pid] = Object.assign({}, h, { title: L.title, heir: null, how }); };

    // ---------------------------------------------------------------- the houses at their game
    let day0 = -1;
    game.hooks.update.push(() => {
      const home = O.SimRef.home; if (!home || day0 === home.day) return; const first = day0 < 0; day0 = home.day; if (first) return;
      const H = houses(), ids = Object.keys(H); if (ids.length < 2 || Math.random() > 0.2) return;
      const a = ids[Math.floor(Math.random() * ids.length)], b = ids.filter((x) => x !== a)[Math.floor(Math.random() * (ids.length - 1))];
      const st = stance(a, b), A = H[a], B = H[b], roll = Math.random();
      if (st === 'neutral' && roll < 0.35) { setStance(a, b, 'ally'); news(`${A.name} and ${B.name} are joined: a son of the one is to marry a daughter of the other.`, 'politics', a); }
      else if (st !== 'ally' && roll < 0.65 && !busy(a) && !busy(b) && O.startConflict) { setStance(a, b, 'feud'); O.startConflict({ kind: 'feud', a, b, days: 6 + Math.floor(Math.random() * 6), aMen: 0, bMen: 0 }); }
      else if (st === 'feud' && roll < 0.85) { newLord(b, 'poison'); news(`${placeName(b)} mourns: its lord died at table, and was buried in haste. Whispers say poison, and look toward ${A.name}.`, 'politics', b); }
      else if (st === 'feud' && !busy(b)) { const old = B.name; B.name = A.name; newLord(b, 'seized'); news(`${A.name} has seized the castle of ${placeName(b)} by night. ${old} is driven out; a kinsman of ${A.name} sits in the hall.`, 'politics', b); setStance(a, b, 'ally'); }
    });
    // what a noble knows of their house, and what they might do with you
    const nobleHouse = (s, q) => { if (q.lordOf) return q.lordOf; if (!(q.gentry || q.title || /lord|lady|knight|steward|chamberlain/.test(q.job?.role || ''))) return null; const pid = s.world.placeId; return houseAt(pid) ? pid : null; };
    (O.extraLines = O.extraLines || []).push((s, q) => {
      const pid = nobleHouse(s, q); if (!pid) return '';
      const H = houseAt(pid), friends = Object.entries(H.stance).filter(([, v]) => v === 'ally').map(([k]) => houseAt(k)?.name).filter(Boolean), foes = Object.entries(H.stance).filter(([, v]) => v === 'feud').map(([k]) => houseAt(k)?.name).filter(Boolean);
      const fav = (PS.houseFavour || {})[pid] || 0, plot = (PS.plots2 || []).find((p) => p.with === pid && !p.done);
      return `You are of ${H.name}, whose seat is ${placeName(pid)}${friends.length ? `; allied with ${friends.join(', ')}` : ''}${foes.length ? `; at feud with ${foes.join(', ')}` : ''}. ${fav > 0.3 ? 'The player is in your house\'s favour. ' : ''}${plot ? `You and the player are plotting against ${houseAt(plot.against)?.name || placeName(plot.against)} (${plot.how}). ` : ''}If it suits your house you may take the player into its favour (favour), or plot with them against a rival house: scheme {"against":"place or house","how":"feud"|"plot"|"seize"}. Never with someone you don't trust.`;
    });
    const findSeat = (txt) => { const t = String(txt || '').toLowerCase(); const H = houses(); return Object.keys(H).find((pid) => t.includes(placeName(pid).toLowerCase()) || t.includes(H[pid].name.toLowerCase()) || t.includes(H[pid].name.toLowerCase().replace('house ', ''))); };

    // ---------------------------------------------------------------- the commons rise, and gather first
    let rd = -1;
    game.hooks.update.push(() => {
      const home = O.SimRef.home; if (!home || rd === home.day) return; rd = home.day;
      const k = K(); if ((k.conflicts || []).filter((c) => !c.done && c.kind === 'revolt').length >= 2) return;
      for (const p of k.places) {
        if (busy(p.id) || p.kind === 'capital') continue;
        const grief = (p.happiness ?? 0.5) < 0.3 ? 1 : 0, dear = (k.taxRate || 0.1) > 0.18 ? 1 : 0, hungry = (p.food ?? 0.6) < 0.35 ? 1 : 0;
        if (grief + dear + hungry >= 2 && Math.random() < 0.02) { O.startConflict && O.startConflict({ kind: 'revolt', a: 'commons', b: p.id, leader: ['a tanner called Hob', 'a carter called Jack', 'a weaver called Alys', 'a thatcher called Piers'][Math.floor(Math.random() * 4)], days: 4 + Math.floor(Math.random() * 4) }); break; }
      }
    });
    const SP = O.Sim.prototype, _plan = SP.plan;
    SP.plan = function (p) {
      const here = this.world.placeId, k = this.kingdom || (O.SimRef.home && O.SimRef.home.kingdom);
      const c = k && (k.conflicts || []).find((x) => !x.done && x.kind === 'revolt' && x.b === here);
      if (c && this.hour >= 9 && this.hour < 18 && p.age >= 16 && p.age < 60 && !p.gentry && !/guard|sheriff/.test(p.job?.role || '') && ((this.household(p)?.money || 0) < 45 || p.id % 4 === 0)) return { act: 'festival', outdoor: true, zone: 'square', angry: true };
      const sg = k && (k.conflicts || []).find((x) => !x.done && x.kind === 'siege' && x.b === here);
      if (sg && /guard/.test(p.job?.role || '') && this.hour >= 7 && this.hour < 20) return { act: 'patrol', outdoor: true, zone: 'square' };
      return _plan.call(this, p);
    };
    let shout = 0;
    game.hooks.update.push((dt) => {
      shout -= dt; if (shout > 0) return; shout = 4;
      const s = cur(); if (!s || game.scene || !O.Speech) return; const c = (K().conflicts || []).find((x) => !x.done && x.kind === 'revolt' && x.b === s.world.placeId); if (!c) return;
      const crowd = s.people.filter((q) => q.activity?.angry && !q.agent.hidden && q.agent.inside == null && Math.hypot(q.agent.x - game.player.x, q.agent.y - game.player.y) < 260);
      const q = crowd[Math.floor(Math.random() * crowd.length)]; if (!q) return;
      O.gesture && O.gesture(q, 'point', 1.6); O.Speech.say(q, ['Down with the lord!', 'Bread, not tolls!', `We follow ${c.leader}!`, 'No more dues!', 'Fetch your scythes!'][Math.floor(Math.random() * 5)], 2.5, 'shout');
    });

    // ---------------------------------------------------------------- sieges
    const sieges = () => (K().conflicts || []).filter((c) => c.kind === 'siege' && !c.done);
    function startSiege(a, b, why) {
      if (!O.startConflict || busy(b)) return null;
      const c = O.startConflict({ kind: 'siege', a, b, days: 99, food: 1, why: why || '', aMen: Math.round(20 + Math.random() * 30), bMen: Math.round(10 + Math.random() * 20) });
      news(`SIEGE. ${a === 'crown' ? 'The king\'s host' : `${lordOf(a)}'s host`} has laid siege to ${placeName(b)}${why ? `: ${why}` : ''}. Tents ring the walls, and nobody goes in or out.`, 'war', b);
      return c;
    }
    O.startSiege = startSiege;
    let sd = -1;
    game.hooks.update.push(() => {
      const home = O.SimRef.home; if (!home) return; const k = K();
      for (const c of sieges()) c.seenDay = cur().day; // (fought out here, not at the town's door)
      if (sd === home.day) return; sd = home.day;
      // the long feuds come to a siege of the loser's walls
      for (const c of (k.conflicts || [])) if (!c.done && c.kind === 'feud' && home.day - c.since >= 4 && !c.sieged && Math.random() < 0.25) { const tgt = K().place(c.b); if (tgt && ['castle', 'city', 'town'].includes(tgt.kind)) { c.sieged = true; startSiege(c.a, c.b, 'the feud has come to the walls'); } }
      if (k.war && k.war.phase === 'war' && Math.random() < 0.05) { const t = k.places.filter((p) => p.kind === 'castle' && !busy(p.id))[0]; if (t) startSiege('crown', t.id, 'a castle that would not open its gates to the king'); }
      for (const c of sieges()) {
        c.food = Math.max(0, c.food - (0.08 + Math.random() * 0.06)); const P = k.place(c.b); if (P) { P.food = Math.min(P.food ?? 0.6, c.food); P.happiness = Math.max(0.05, (P.happiness ?? 0.5) - 0.02); }
        if (c.food <= 0) endSiege(c, true, `${placeName(c.b)} has fallen: starved out, its gates opened to ${c.a === 'crown' ? 'the king\'s host' : lordOf(c.a)}.`);
        else if (home.day - c.since > 3 && Math.random() < 0.08) endSiege(c, false, `A relieving force has come to ${placeName(c.b)}, and the besiegers have struck their tents and gone.`);
      }
    });
    function endSiege(c, fell, how) {
      c.done = true; c.winner = fell ? c.a : c.b; news(how, 'war', c.b);
      if (fell && c.a !== 'crown' && houseAt(c.a) && houseAt(c.b)) { houseAt(c.b).name = houseAt(c.a).name; newLord(c.b, 'siege'); }
      unpitch(c);
      if (PS.siegeSide && PS.siegeSide.id === c.id) { const won = (PS.siegeSide.side === 'a') === fell; if (won) { PS.money += 30; PS.rep.local = Math.min(1, (PS.rep.local || 0) + 0.08); say(`The siege is over, and your side has won. ₳30 of the spoils are yours.`); } else say('The siege is over, and your side has lost.', 'bad'); PS.siegeSide = null; }
    }
    // the camp you can see: tents, fires and banners on the roads round the walls
    function pitch(s, c) {
      const w = s.world; if (c._pitched === w || w.ox == null) return; c._pitched = w;
      const pts = []; for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2, rx = w.townW / 2 + 6, ry = w.townH / 2 + 5, x = Math.round(w.ox + w.townW / 2 + Math.cos(a) * rx), y = Math.round(w.oy + w.townH / 2 + Math.sin(a) * ry); if (x > 2 && y > 2 && x < w.W - 3 && y < w.H - 3 && !w.solid[y * w.W + x]) pts.push([x, y]); }
      pts.forEach(([x, y], i) => { const kind = i % 4 === 0 ? 'banner' : i % 3 === 0 ? 'firepit' : 'tent'; w.props.push({ kind, x: x * T + 8, y: y * T + 15, seed: c.id * 31 + i, v: 0, solid: kind !== 'firepit', siege: c.id, country: false }); if (kind !== 'firepit') w.solid[y * w.W + x] = 1; });
      w.dirtyStatics = true; c._camp = pts;
    }
    function unpitch(c) { const w = game.world; if (!w || !w.props) return; for (const p of w.props) if (p.siege === c.id && p.solid) w.solid[Math.floor((p.y - 1) / T) * w.W + Math.floor(p.x / T)] = 0; w.props = w.props.filter((p) => p.siege !== c.id); w.dirtyStatics = true; }
    game.hooks.update.push(() => { const s = cur(); if (!s || game.scene) return; for (const c of sieges()) if (c.b === s.world.placeId) pitch(s, c); });
    // join a side, then fight: at the camp, or on the walls
    (O.moreCandidates = O.moreCandidates || []).push(() => {
      const s = cur(); if (!s || game.scene) return null; const c = sieges().find((x) => x.b === s.world.placeId); if (!c || !c._camp) return null;
      const P = game.player, nearCamp = c._camp.some(([x, y]) => Math.hypot(x * T + 8 - P.x, y * T + 8 - P.y) < 50);
      const w = s.world, inTown = Math.floor(P.x / T) >= w.ox && Math.floor(P.x / T) < w.ox + w.townW && Math.floor(P.y / T) >= w.oy && Math.floor(P.y / T) < w.oy + w.townH;
      const side = PS.siegeSide && PS.siegeSide.id === c.id ? PS.siegeSide.side : null;
      if (nearCamp && !side) return { type: 'custom', d: 2, x: P.x, y: P.y - 50, label: 'Join the besiegers', act: () => { PS.siegeSide = { id: c.id, side: 'a' }; say(`You throw in with the besiegers of ${placeName(c.b)}.`); } };
      if (nearCamp && side === 'a') return { type: 'custom', d: 2, x: P.x, y: P.y - 50, label: 'Lead an assault on the walls', act: () => assault(s, c, 'a') };
      if (inTown && !side && !nearCamp) return null;
      if (inTown && side === 'b') return { type: 'custom', d: 4, x: P.x, y: P.y - 50, label: 'Man the walls', act: () => assault(s, c, 'b') };
      return null;
    });
    const _talkSide = (s, q) => sieges().find((x) => x.b === s.world.placeId);
    function assault(s, c, side) {
      if (c._lastAssault === s.day) return say('The last assault was today. The men need a night before the next.', 'bad'); c._lastAssault = s.day;
      const attacking = side === 'a', ours = Math.min(18, attacking ? c.aMen : c.bMen), theirs = Math.min(18, attacking ? c.bMen : c.aMen);
      O.Battle && O.Battle.start({ ours, theirs, ourLook: 'guard', theirLook: 'guard', ourBanner: attacking ? '#7a1a1a' : '#2a4a8a', theirBanner: attacking ? '#2a4a8a' : '#7a1a1a', ourStr: attacking ? 0.85 : 1.25, title: `${attacking ? 'The assault on' : 'Holding'} the walls of ${placeName(c.b)}: walk up to the enemy and press E to strike.`, onEnd: (won) => {
        if (attacking) { if (won) endSiege(c, true, `${placeName(c.b)} has fallen to an assault on its walls.`); else { c.aMen = Math.max(6, c.aMen - 6); say('The assault is thrown back from the walls.', 'bad'); } }
        else { if (won) { c.aMen = Math.max(4, c.aMen - 8); if (c.aMen <= 6) endSiege(c, false, `The besiegers of ${placeName(c.b)} have been beaten off the walls and gone.`); else say('You throw them back from the walls.'); } else { c.bMen = Math.max(4, c.bMen - 5); say('They gain the wall before they are driven off. It cannot hold much longer.', 'bad'); c.food = Math.max(0, c.food - 0.15); } }
      } });
    }

    // ---------------------------------------------------------------- the acts
    const A = {
      favour(s, q) { const pid = nobleHouse(s, q); if (!pid) return null; (PS.houseFavour = PS.houseFavour || {})[pid] = Math.min(1, ((PS.houseFavour || {})[pid] || 0) + 0.4); return `You are in the favour of ${houseAt(pid).name}.`; },
      scheme(s, q, a) {
        const pid = nobleHouse(s, q); if (!pid) return null; const tgt = findSeat(a.against); if (!tgt || tgt === pid) return null;
        const how = ['feud', 'plot', 'seize'].includes(a.how) ? a.how : 'feud';
        (PS.plots2 = PS.plots2 || []).push({ with: pid, against: tgt, how, day: s.day + 2 + Math.floor(Math.random() * 3), done: false });
        return `${houseAt(pid).name} will move against ${houseAt(tgt).name} (${how}). It is on you, too, if it comes out.`;
      },
      rise_up(s, q) {
        const here = s.world.placeId; if (busy(here) || q.gentry || /guard/.test(q.job?.role || '')) return null;
        const c = O.startConflict && O.startConflict({ kind: 'revolt', a: 'commons', b: here, leader: 'the stranger', days: 3, byPlayer: true });
        if (!c) return null; PS.rep.criminal = Math.min(1, (PS.rep.criminal || 0) + 0.1); return `The word goes round: the commons of ${s.world.name} will rise, with you at their head.`;
      },
      betray_rising(s, q) {
        const c = (K().conflicts || []).find((x) => !x.done && x.kind === 'revolt' && x.b === s.world.placeId); if (!c) return null;
        if (!(q.gentry || q.title || /guard|sheriff|reeve|steward|lord/.test((q.job?.role || '') + ' ' + (q.title || '').toLowerCase()))) return null;
        c.done = true; c.winner = 'lord'; news(`The rising at ${s.world.name} was betrayed before it began; its ringleaders are taken.`, 'war', c.b); PS.rep.guard = Math.min(1, (PS.rep.guard || 0) + 0.15); PS.rep.civilian = Math.max(-1, (PS.rep.civilian || 0) - 0.1); PS.money += 20;
        return `${q.first} thanks you, and pays ₳20 for the warning. The rising is crushed before it starts.`;
      },
      siege_side(s, q, a) { const c = sieges().find((x) => x.b === s.world.placeId); if (!c) return null; PS.siegeSide = { id: c.id, side: a.side === 'besiegers' ? 'a' : 'b' }; return PS.siegeSide.side === 'a' ? 'You are with the besiegers now.' : 'You are with the defenders now.'; },
    };
    // a scheme comes to pass, and if it comes out, you share the blame
    game.hooks.update.push(() => {
      const home = O.SimRef.home; if (!home || !PS.plots2) return;
      for (const p of PS.plots2) {
        if (p.done || home.day < p.day) continue; p.done = true;
        const A0 = houseAt(p.with), B0 = houseAt(p.against); if (!A0 || !B0) continue;
        if (p.how === 'feud' && !busy(p.with) && !busy(p.against)) { setStance(p.with, p.against, 'feud'); O.startConflict && O.startConflict({ kind: 'feud', a: p.with, b: p.against, days: 8, aMen: 0, bMen: 0 }); }
        else if (p.how === 'plot') { newLord(p.against, 'poison'); news(`The lord of ${placeName(p.against)} is dead, and it is whispered that ${A0.name} had a hand in it.`, 'politics', p.against); }
        else if (p.how === 'seize' && !busy(p.against)) { startSiege(p.with, p.against, `${A0.name} means to take it`); }
        PS.houseFavour = PS.houseFavour || {}; PS.houseFavour[p.with] = Math.min(1, (PS.houseFavour[p.with] || 0) + 0.3);
        if (Math.random() < 0.3) { PS.rep.criminal = Math.min(1, (PS.rep.criminal || 0) + 0.1); news(`Word is out that the stranger had a part in ${A0.name}'s move against ${B0.name}.`, 'politics', p.against); }
      }
    });
    const base = O.NpcActs.apply;
    O.NpcActs.apply = function (s, q, a, main) { if (a && A[a.do]) return A[a.do](s, q, a); return base.apply(this, arguments); };
    (O.extraActs = O.extraActs || []).push('favour (a noble takes the player into their house\'s favour)', 'scheme {"against","how":"feud"|"plot"|"seize"} (a noble agrees to move against a rival house, with the player)', 'rise_up (you are poor or wronged and agree to rise against the lord with the player leading)', 'betray_rising (a lord, guard or official hearing from the player of a rising, and acting on it)', 'siege_side {"side":"besiegers"|"defenders"} (you take the player into your side of a siege)');
    (O.extraLines = O.extraLines || []).push((s, q) => {
      const out = [], here = s.world.placeId, k = K();
      const rv = (k.conflicts || []).find((x) => !x.done && x.kind === 'revolt' && x.b === here); if (rv) out.push(`The commons of ${s.world.name} are rising against ${lordOf(here)}, led by ${rv.leader}. ${q.activity?.angry ? 'You are one of them, and angry.' : ''}`);
      const sg = sieges().find((x) => x.b === here); if (sg) out.push(`${s.world.name} is under siege by ${sg.a === 'crown' ? 'the king\'s host' : lordOf(sg.a)}; food is ${sg.food > 0.6 ? 'holding' : sg.food > 0.3 ? 'running low' : 'nearly gone'}.`);
      return out.join(' ');
    });
    O.Politics = { houses, startSiege, assault };
  }
  O.PoliticsSetup = { setup };
})();
