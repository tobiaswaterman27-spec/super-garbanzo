// The river, and what lives by it.
// - The river is a road: a barge calls at river towns every other day. Ask the bargeman (or any boatman,
//   ferryman or fisher) for passage to a town on the same water and you go by river, quicker than the
//   road and safe from bandits, for a few aurins. On barge days the heavy goods come in cheaper.
// - Fishing rights: the water by a town belongs to someone. Fish it without leave and you may be seen
//   and fined; buy the right for the season from the fishery, the ferryman or the reeve.
// - Rats get into granaries, bakehouses, mills and stores: the stock goes down, the workers grumble.
//   Set traps there for the master and get paid; a cat in the house keeps them down.
// - The lord's deer: shooting a deer without the lord's leave is poaching, and a gamekeeper or forester
//   who sees you will report it. Leave to hunt is bought from the gamekeeper, forester or steward, and
//   only in autumn and winter: spring and summer are the fawning, the closed season, for everyone.
'use strict';
(function () {
  const T = 16;
  function setup(game) {
    const PS = O.PlayerState, cur = () => O.SimRef.cur, say = (t, k) => O.UI.say(t, k || 'note'), G = O.Data.GOODS;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    const K = () => cur().kingdom || O.SimRef.kingdom;
    const life = () => (PS.wild = PS.wild || {});
    const respond = (q, text, render, line) => { (q._conv = q._conv || []).push({ who: 'p', t: text }); q._conv.push({ who: 'q', t: line }); render(line); return Promise.resolve(); };

    // ---------------------------------------------------------------- the river as a road
    const riverNames = () => new Set(((O.Eldoria && O.Eldoria.RIVERS) || []).map((r) => r.name));
    function riverPorts(s) {
      const k = s.kingdom; if (!k || !k.place) return [];
      const me = k.place(s.world.placeId); if (!me || !riverNames().has(me.area)) return [];
      return k.places.filter((p) => p.id !== me.id && p.area === me.area);
    }
    const bargeDay = (s) => s.day % 2 === 0;
    const bargeHere = (s) => bargeDay(s) && s.minute >= 8 * 60 && s.minute < 12 * 60 && riverPorts(s).length > 0;
    O.riverPorts = riverPorts;
    // on barge days the heavy goods come in by water
    const SP = O.Sim.prototype, _nd = SP.newDay;
    SP.newDay = function () {
      const r = _nd.apply(this, arguments);
      try {
        if (bargeDay(this) && riverPorts(this).length) {
          for (const bz of this.biz.values()) for (const g of ['grain', 'wheat', 'barley', 'stone', 'logs', 'planks', 'salt', 'iron', 'cloth']) if ((bz.def.buys || {})[g] && (bz.stock[g] || 0) < (bz.def.targets[g] || 0)) bz.stock[g] = (bz.stock[g] || 0) + Math.ceil((bz.def.targets[g] || 4) * 0.3);
          this.log('The barge is in at the landing with grain, timber and stone.', 'economy');
        }
        // rats
        for (const bz of this.biz.values()) {
          if (!['mill', 'bakery', 'farmhouse', 'store', 'warehouse', 'brewery'].includes(bz.type)) continue;
          const hh = bz.owner != null && this.household(this.byId.get(bz.owner));
          const cat = hh && (hh.pets || []).some((p) => /cat/.test(p.kind || p)) || (O.fauna || []).some((f) => f.kind === 'cat' && f.owner === (hh && hh.id));
          if (!bz.rats && Math.random() < (cat ? 0.02 : 0.07)) { bz.rats = 1; this.log(`Rats have got into the stores at ${bz.name}.`, 'economy'); }
          if (bz.rats) { for (const g of ['grain', 'wheat', 'barley', 'flour', 'bread', 'malt', 'oats']) if (bz.stock[g] > 1) bz.stock[g] = Math.max(0, bz.stock[g] * (1 - 0.04 * bz.rats)); bz.rats = Math.min(3, bz.rats + (cat ? 0 : 0.5)); if (cat && Math.random() < 0.3) bz.rats = 0; }
        }
      } catch (e) { console.error(e); }
      return r;
    };
    (O.extraLines = O.extraLines || []).push((s, q) => {
      const out = [], bz = q.job && s.biz.get(q.job.biz);
      if (bz && bz.rats) out.push(`Rats have got into the stores at ${bz.name}; ${bz.rats > 2 ? 'they are eating you out of house and home' : 'the sacks are gnawed'}. Someone ought to set traps.`);
      if (bargeHere(s) && /boat|ferry|fisher|barge|carter|merchant/.test(q.job?.role || '')) out.push(`The barge is at the landing this morning; it goes on to ${riverPorts(s).map((p) => p.name).join(', ')}. Passage is a few aurins.`);
      if (/gamekeeper|forester|steward/.test(q.job?.role || '')) out.push(`The deer are the lord's. ${['spring', 'summer'].includes(s.season) ? 'It is the closed season: no one hunts them now.' : 'Leave to hunt them can be had, for ₳10 a season.'} Poachers are taken before the lord.`);
      if (/fisher|ferry|reeve|boat/.test(q.job?.role || '')) out.push('The fishing in the water here belongs to the fishery; anyone else needs the right, ₳12 for the season.');
      return out.join(' ');
    });

    // ---------------------------------------------------------------- said in your own words
    const RX = {
      passage: /\b(passage|take me|carry me|a place on|ride|go|sail|row)\b.*\b(barge|boat|downriver|upriver|by river|by water|on the river)\b|\b(barge|boat) to (\w+)/i,
      fishRight: /\b(fishing rights?|right to fish|leave to fish|licence to fish|fish (your|the) water)\b/i,
      huntLeave: /\b(leave to hunt|hunting (rights?|licence|leave)|hunt (the|your) (deer|lord'?s deer)|permission to hunt)\b/i,
      traps: /\b(set (some )?traps|catch (your|the) rats|rid (you|the place) of (the )?rats|ratcatch)\b/i,
    };
    function tryRiver(s, q, text, render) {
      const role = q.job?.role || '';
      if (RX.passage.test(text) && /boat|ferry|fisher|barge|bargeman|sailor/.test(role)) {
        const ports = riverPorts(s); if (!ports.length) return respond(q, text, render, 'There is no barge on this water.');
        if (!bargeHere(s)) return respond(q, text, render, `The barge calls every other morning. ${bargeDay(s) ? 'It has gone for today.' : 'Tomorrow, from eight.'}`);
        const named = ports.find((p) => text.toLowerCase().includes(p.name.toLowerCase())) || ports[0];
        const fare = Math.max(2, Math.round(s.kingdom.dist(s.world.placeId, named.id) * 0.6));
        if (PS.money < fare) return respond(q, text, render, `It's ₳${fare} to ${named.name}, and you haven't it.`);
        PS.money -= fare; const bz = q.job && s.biz.get(q.job.biz); if (bz) bz.cash = (bz.cash || 0) + fare;
        setTimeout(() => { if (O.npcUI && O.npcUI.talking()) O.npcUI.closeTalk(); say(`You take passage on the barge for ₳${fare}. The banks slide by.`, 'good'); const h = O.Travel && O.Travel.byRiver ? O.Travel.byRiver(s.world.placeId, named.id) : 0; void h; }, 1800);
        return respond(q, text, render, `₳${fare} to ${named.name}. Step aboard and mind the sacks.`);
      }
      if (RX.fishRight.test(text) && /fisher|ferry|reeve|boat|steward/.test(role)) {
        const k = s.world.placeId, L = life(); if ((L.fish || {})[k] === s.season) return respond(q, text, render, 'You have the right already, this season.');
        if (PS.money < 12) return respond(q, text, render, "It's ₳12 for the season, and you haven't it.");
        PS.money -= 12; (L.fish = L.fish || {})[k] = s.season; s.treasury.cash += 12;
        return respond(q, text, render, `₳12, and you may fish the water here till ${s.season} is out.`);
      }
      if (RX.huntLeave.test(text) && /gamekeeper|forester|steward|lord|lady|reeve/.test(role + (q.gentry ? ' lord' : ''))) {
        if (['spring', 'summer'].includes(s.season)) return respond(q, text, render, 'Not in the fawning. No one hunts the deer till autumn, not even the lord.');
        const L = life(); if ((L.hunt || {})[s.world.placeId] === s.season) return respond(q, text, render, 'You have your leave already.');
        if (PS.money < 10) return respond(q, text, render, "Leave to hunt is ₳10 the season. Come back with it.");
        PS.money -= 10; (L.hunt = L.hunt || {})[s.world.placeId] = s.season;
        return respond(q, text, render, `₳10. You may take the lord's deer till ${s.season} ends. Mind you take only what you can eat.`);
      }
      const bz = q.job && s.biz.get(q.job.biz);
      if (RX.traps.test(text) && bz && bz.rats && (s.bossOf(bz) === q || q.id === bz.owner)) {
        bz._trapper = { day: s.day }; return respond(q, text, render, "Would you? I'll give you ₳4 if they're gone. The traps are in the corner; the stores are through there.");
      }
      return null;
    }
    const _say = O.AIChat && O.AIChat.say;
    if (_say) O.AIChat.say = function (q, text, render, opt) {
      if (q && typeof text === 'string' && !(opt && opt.gift) && O.AI && O.AI.ready) { try { const r = tryRiver(cur(), q, text, render); if (r) return r; } catch (e) { console.error(e); } }
      return _say.apply(this, arguments);
    };
    // setting the traps, inside the place
    (O.sceneMore = O.sceneMore || []).push(() => {
      const sc = game.scene, s = cur(); if (!sc || !s) return null; const bz = s.biz.get(sc.b.id); if (!bz || !bz.rats) return null;
      const P = game.player; if (P.locked) return null;
      return { type: 'custom', d: 30, prio: 6, x: P.x, y: P.y - 44, label: 'Set traps for the rats', act: () => {
        P.locked = true; P.anim = 'crouch'; P.ft = 0; O.sfx && O.sfx('place', 0.6, true);
        setTimeout(() => { P.locked = false; P.anim = 'idle'; bz.rats = Math.max(0, bz.rats - 1.5); const paid = bz._trapper && s.day - bz._trapper.day < 2 && bz.rats <= 0; if (paid) { bz._trapper = null; const n = Math.min(4, Math.floor(bz.cash || 0)); bz.cash -= n; PS.money += n; O.sfx && O.sfx('kaching', 0.5, true); say(`The rats are caught. You're paid ₳${n}.`, 'good'); } else say(bz.rats > 0 ? 'You set the traps. A few caught; there are more.' : 'The last of the rats is caught.', 'good'); PS.skills.trapping = Math.min(1, (PS.skills.trapping || 0) + 0.03); }, 2600);
      } };
    });

    // ---------------------------------------------------------------- fishing without the right
    const _add = PS.add;
    PS.add = function (k) {
      const r = _add.apply(this, arguments);
      try {
        if (k === 'fish' && game.player.anim === 'fish' && !game.scene) {
          const s = cur(), w = s.world, P = game.player, L = life();
          const inTown = w.townW && P.x / T >= w.ox - 6 && P.y / T >= w.oy - 6 && P.x / T < w.ox + w.townW + 6 && P.y / T < w.oy + w.townH + 6;
          if (inTown && (L.fish || {})[w.placeId] !== s.season && L.fishWarned !== s.day) {
            const seer = s.people.find((q) => q.agent && !q.agent.hidden && /fisher|ferry|reeve|guard|watch|bailiff/.test(q.job?.role || '') && Math.hypot(q.agent.x - P.x, q.agent.y - P.y) < 220);
            if (seer) {
              L.fishWarned = s.day; L.fishFines = (L.fishFines || 0) + 1;
              const fine = L.fishFines > 1 ? 5 : 0;
              setTimeout(() => { O.Speech && O.Speech.say(seer, fine ? "You again! That's the fishery's water. ₳5, or the watch." : "Oi! That water's the fishery's. Buy the right or keep your line out of it.", 3.5, 'angry'); if (fine) { const n = Math.min(fine, PS.money); PS.money -= n; s.treasury.cash += n; say(`Fined ₳${n} for fishing without the right.`, 'bad'); } }, 600);
              s.remember(seer, 'Caught the stranger fishing our water without the right.', 'crime', 1);
            }
          }
        }
      } catch (e) { console.error(e); }
      return r;
    };

    // ---------------------------------------------------------------- the lord's deer
    O.Bus && O.Bus.on && O.Bus.on('poach', ({ kind, sim }) => {
      if (kind !== 'deer') return;
      const s = sim || cur(), L = life(), P = game.player;
      const leave = (L.hunt || {})[s.world.placeId] === s.season && !['spring', 'summer'].includes(s.season);
      if (leave) return say('A clean kill, and with the lord\'s leave.', 'good');
      const keeper = s.people.find((q) => q.agent && !q.agent.hidden && /gamekeeper|forester|verderer|ranger/.test(q.job?.role || '') && Math.hypot(q.agent.x - P.x, q.agent.y - P.y) < 320);
      const found = keeper || Math.random() < 0.12;
      if (!found) return say(['spring', 'summer'].includes(s.season) ? 'You bring down a deer in the closed season. If anyone finds out, it will go hard with you.' : "You bring down one of the lord's deer. Nobody saw. You hope.", 'bad');
      const crime = s.recordCrime({ kind: 'poaching', perp: 'player', placeName: s.world.name, tile: [Math.floor(P.x / T), Math.floor(P.y / T)], seen: keeper ? [keeper] : [], severity: ['spring', 'summer'].includes(s.season) ? 3 : 2 });
      PS.crimes.push(crime.id);
      if (keeper) { O.Speech && O.Speech.say(keeper, "Poacher! That's the lord's deer!", 3.5, 'angry'); s.remember(keeper, 'Caught the stranger poaching the lord\'s deer.', 'crime', 2.5); if (s.guardId != null && !keeper.task) keeper.task = { act: 'report', b: s.guardId, crime: crime.id }; say(`${keeper.first} the ${keeper.job.role} saw you take the deer. Poaching: they've gone to tell the watch.`, 'bad'); }
      else say('Word gets about that someone has been at the lord\'s deer. They are looking for the poacher.', 'bad');
    });
    // in the closed season the townsfolk don't hunt either; and the gamekeeper walks the woods
    O.WildRiver = { riverPorts, bargeHere, RX, tryRiver };
  }
  O.RiverWildSetup = { setup };
})();
