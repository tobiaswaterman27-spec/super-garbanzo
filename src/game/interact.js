// Contextual interaction: finds what's in reach (people, doors, containers, beds, stairs), shows only
// actions that make sense, and runs them. Taking what isn't yours is theft, and anyone awake in the
// room sees it.
'use strict';
(function () {
  const G = O.Data.GOODS, PS = O.PlayerState;

  function setup(game, sim, npcUI) {
    const prompt = { hidden: true, innerHTML: '' }; // no on-screen hints: a small marker shows what you'd interact with
    let cur = null, searching = 0, pendingSearch = null;

    function doorLocked(b) {
      const h = sim.hour, bz = sim.biz.get(b.id);
      if (b.type === 'barn' || b.type === 'stable' || b.type === 'smithy' || b.type === 'mill' || (b.spec && b.spec.bigDoor)) return false; // open fronts and great doors stand open
      if ((b._doorOpen || 0) > game.t) return false; // someone has just opened it: you can follow them in
      if (sim.biz && sim.biz.get(b.id) && sim.biz.get(b.id).def && h >= sim.biz.get(b.id).def.hours[0] && h < sim.biz.get(b.id).def.hours[1] && sim.biz.get(b.id).workers?.some((id) => sim.byId.get(id)?.agent.inside === b.id)) return false; // someone at work inside
      if (b.owner && b.owner.kind === 'player') return false;
      if (b.type === 'hideout') return b.gang !== 'player';
      if (PS.room && PS.room.b === b.id && sim.day <= PS.room.until) return false;
      if (PS.lease && PS.lease.b === b.id && PS.lease.place === sim.world.placeId) return false;
      if (bz && (bz.open || bz.def.public)) return false;
      const home = b.household && sim.households[b.household - 1];
      const someoneIn = home && home.members.some((id) => sim.byId.get(id)?.agent.inside === b.id);
      return !(someoneIn && h >= 7 && h < 21);
    }

    function candidates() {
      const p = game.player, out = [];
      if (game.scene) return game.scene.candidates();
      if (O.horseCandidate) { const hc = O.horseCandidate(); if (hc) out.push(hc); }
      if (O.caravanCandidate) { const cc = O.caravanCandidate(); if (cc) out.push(cc); }
      if (O.noticeCandidate) { const nc = O.noticeCandidate(); if (nc) out.push(nc); }
      if (O.exitCandidate) { const ec = O.exitCandidate(); if (ec) out.push(ec); }
      if (O.saleCandidate) { const sc = O.saleCandidate(); if (sc) out.push(sc); }
      if (O.signCandidate) { const sg = O.signCandidate(); if (sg) out.push(sg); }
      if (O.jobCandidate) { const jc = O.jobCandidate(); if (jc) out.push(jc); }
      if (O.voteCandidate) { const vc = O.voteCandidate(); if (vc) out.push(vc); }
      if (O.placedCandidate) { const pc2 = O.placedCandidate(); if (pc2) out.push(pc2); }
      if (O.furnCandidate) { const fc = O.furnCandidate(); if (fc) out.push(fc); }
      if (O.stallCandidate) { const st = O.stallCandidate(); if (st) out.push(st); }
      if (O.pickupCandidate) { const pc = O.pickupCandidate(); if (pc) out.push(pc); }
      if (O.roadCandidate) { const rc = O.roadCandidate(); if (rc) out.push(rc); }
      for (const q of sim.people) { const a = q.agent; if (a.hidden) continue; const d = Math.hypot(a.x - p.x, a.y - p.y); if (d < 26) out.push({ type: 'npc', person: q, d, x: a.x, y: a.y }); }
      const T = sim.T;
      for (const pr of sim.world.props) if (pr.kind === 'memorial' || (pr.kind === 'noticeboard' && pr.broadsheet)) { const d = Math.hypot(pr.x - p.x, pr.y - p.y); if (d < 22) out.push({ type: pr.kind === 'memorial' ? 'memorial' : 'broadsheet', prop: pr, d: d + 1, x: pr.x, y: pr.y - 30 }); }
      for (const pr of sim.world.props) if (pr.kind === 'gravestone') { const d = Math.hypot(pr.x - p.x, pr.y - p.y); if (d < 20) out.push({ type: 'grave', prop: pr, d: d + 2, x: pr.x, y: pr.y - 14 }); }
      for (const b of sim.world.buildings) {
        if (b.site || b.ruined) continue;
        if (b.fire) { const fx = b.doorX * T + 8, fy = (b.bottom + 1) * T + 6, fd = Math.hypot(fx - p.x, fy - p.y); if (fd < 60) out.push({ type: 'fire', b, d: fd - 30, x: fx, y: fy - 30 }); continue; }
        if (b.type === 'hideout' && b.level === 0) {
          const cx = b.x * T + 24, cy = (b.bottom + 1) * T;
          const d = Math.hypot(cx - p.x, cy - p.y);
          if (d < 34) {
            if (b.unclaimed) out.push({ type: 'claim', b, d, x: cx, y: cy - 20 });
            else if (b.gang === 'player') { out.push({ type: 'stash', b, d, x: cx, y: cy - 20 }); out.push({ type: 'campbed', b, d: d + 3, x: cx, y: cy - 20 }); }
          }
          continue;
        }
        const dx = b.doorX * T + 8, dy = b.doorY * T + 4;
        const d = Math.hypot(dx - p.x, dy - p.y);
        if (d < 14) out.push({ type: 'door', b, d: d + 4, x: dx, y: dy - 18 });
      }
      return out;
    }
    function label(c) {
      switch (c.type) {
        case 'npc': return c.person.health.hp <= 0 ? `${c.person.name} lies senseless` : `Talk to ${c.person.name}`;
        case 'door': return doorLocked(c.b) ? `${c.b.name}, locked` : `Enter ${c.b.type === 'house' ? 'house' : c.b.name}`;
        case 'container': return `Search ${c.it.kind}`;
        case 'grave': return 'Read the gravestone';
        case 'memorial': return 'Read the memorial';
        case 'work': return O.Craft.RECIPES[c.it.kind] ? `${O.workLabel()} · or make your own` : O.workLabel();
        case 'craft': return O.craftLabel(c);
        case 'fire': return O.fireLabel(c);
        case 'stall': return O.stallLabel();
        case 'portrait': return `Look at the portrait`;
        case 'broadsheet': return 'Buy a broadsheet · 1d';
        case 'caravan': return `Hail ${c.L.c.merchant}'s caravan`;
        case 'notices': return 'Read the notice board';
        case 'property': return c.b.owner?.kind === 'player' ? 'Your property' : 'For sale: look it over';
        case 'namesign': return 'Read the sign';
        case 'job': return O.jobLabel(c);
        case 'vote': return 'The ballot box: read the candidates';
        case 'placed': { const g = O.Data.GOODS[c.x0.good]; return (g.food || g.drink) && O.PlayerState.hunger < 85 ? `${g.drink ? 'Drink' : 'Eat'} the ${g.name.toLowerCase()}` : `Pick up the ${g.name.toLowerCase()}`; }
        case 'furn': return `Take up the ${(O.Data.FURN[c.it.kind] || [c.it.kind])[0].toLowerCase()}`;
        case 'exit': return `Leave ${sim.world.name} by the ${c.side} road`;
        case 'horse': return `Look over ${c.h.owner === 'player' ? c.h.name : 'the horse'}`;
        case 'claim': return 'Claim the abandoned camp';
        case 'stash': return 'Open the stash';
        case 'campbed': return 'Sleep by the fire';
        case 'bed': return mayUseBed(c.it) ? 'Sleep until morning' : c.it.rent ? 'A guest bed (ask the innkeeper)' : 'Bed, not yours';
        case 'hay': return 'Sleep in the hay';
        case 'traveller': case 'ruin': case 'signpost': return O.roadLabel(c);
        case 'pickup': return `Pick up the ${(O.Data.GOODS[c.it.good]?.name || c.it.good).toLowerCase()}`;
        case 'shop': return `Buy from ${c.seller.first}`;
        case 'stairs': return c.it && c.it.stairs ? 'Go upstairs' : 'Go downstairs';
        case 'sit': return c.it.kind === 'pew' ? 'Sit in the pew' : c.it.kind === 'bench' ? 'Sit on the bench' : c.it.kind === 'throne' ? 'Sit on the throne' : 'Sit down';
        default: return '';
      }
    }
    const mayUseBed = (it) => (game.scene && game.scene.b.owner?.kind === 'player') || (game.scene && PS.lease && PS.lease.b === game.scene.b.id) || (it.gangBed && game.scene && game.scene.b.gang === 'player') || (it.rent && PS.room && game.scene && PS.room.b === game.scene.b.id && sim.day <= PS.room.until);

    game.hooks.update.push((dt) => {
      if (searching > 0) { searching -= dt; game.player.anim = 'crouch'; game.player.locked = true; if (searching <= 0) { game.player.locked = false; game.player.anim = 'idle'; pendingSearch && pendingSearch(); pendingSearch = null; } }
      if (O.panelOpen || npcUI.talking()) { prompt.hidden = true; cur = null; O.interactTarget = null; return; }
      const cs = candidates().sort((a, b) => a.d - b.d);
      cur = cs[0] || null;
      O.interactTarget = cur;
      if (cur) {
        const quick = cur.type === 'horse' ? (cur.h.owner === 'player' ? '<kbd>H</kbd>Ride' : '<kbd>Q</kbd>Steal the horse') : cur.type === 'container' ? '<kbd>F</kbd>Quick loot' : cur.type === 'npc' && O.Combat && O.Combat.lootable(cur.person) ? '<kbd>F</kbd>Search them' : cur.type === 'npc' && cur.person.age >= 8 ? '<kbd>Q</kbd>Pickpocket' : cur.type === 'door' && doorLocked(cur.b) && cur.b.type !== 'guard' ? '<kbd>Q</kbd>Pick the lock' : '';
        prompt.hidden = false; prompt.innerHTML = `<kbd>E</kbd>${O.escape(label(cur))}${quick ? ' &nbsp; ' + quick : ''}`;
      } else prompt.hidden = true;
    });


    // ----- container contents come from the real owners -----
    function contents(it) {
      const b = game.scene.b, hh = b.household ? sim.households[b.household - 1] : null, bz = sim.biz.get(b.id);
      const out = [];
      if (b.owner?.kind === 'player' && !hh) { const st = (PS.homes = PS.homes || {}); const key = sim.world.placeId + ':' + b.id; (st[key] = st[key] || []).forEach((k) => out.push({ k, n: 1, src: 'homestash', key })); return { items: out, owner: 'you' }; }
      if (it.rentChest && PS.room && PS.room.b === b.id) { (PS.stash || (PS.stash = [])).forEach((k) => out.push({ k, n: 1, src: 'stash' })); return { items: out, owner: 'you' }; }
      if (it.stockOf && bz) {
        const goods = it.stockOf === 'farm' ? ['wheat', 'cabbage'] : it.stockOf === 'store' ? ['cabbage', 'firewood', 'flour'] : it.stockOf === 'warehouse' ? ['cloth', 'wheat', 'iron'] : [it.stockOf];
        for (const g of goods) { const n = Math.min(4, Math.floor(bz.stock[g] || 0)); if (n > 0) out.push({ k: g, n, src: 'biz', good: g }); }
        return { items: out, owner: bz.name };
      }
      if (b.type === 'barn') { const farm = sim.supplierOf('farmhouse'); const n = Math.min(3, Math.floor(farm.stock.wheat || 0)); if (n) out.push({ k: 'wheat', n, src: 'farm' }); return { items: out, owner: 'Marsh Farm' }; }
      if (hh && (it.pantry || it.kind === 'cupboard' || it.kind === 'barrel')) for (const g of ['bread', 'cabbage', 'firewood']) { const n = Math.floor(hh.pantry[g] || 0); if (n > 0) out.push({ k: g, n: Math.min(n, 3), src: 'pantry', good: g }); }
      if (it.valuables || it.kind === 'chest' || it.kind === 'wardrobe') {
        if (hh) {
          if (!hh.valuables) { const r = O.RNG(hh.id * 77); hh.valuables = []; if (b.wealth > 0.4 && r.chance(0.7)) hh.valuables.push('spoon'); if (b.wealth > 0.6 && r.chance(0.5)) hh.valuables.push('brooch'); if (r.chance(0.5)) hh.valuables.push('candlestick'); }
          const coin = Math.floor(Math.max(0, hh.money) * 0.35); if (coin > 0) out.push({ k: 'coins', n: coin, src: 'purse' });
          hh.valuables.forEach((k) => out.push({ k, n: 1, src: 'val' }));
        } else if (bz) { const coin = Math.floor(Math.max(0, bz.cash) * 0.3); if (coin > 0) out.push({ k: 'coins', n: coin, src: 'till' }); }
      }
      return { items: out, owner: hh ? `the ${hh.surname} household` : bz ? bz.name : 'someone' };
    }

    function take(it, items, idxs, owner) {
      const b = game.scene.b, hh = b.household ? sim.households[b.household - 1] : null, bz = sim.biz.get(b.id);
      const stolen = [];
      for (const i of idxs) {
        const c = items[i]; if (!c) continue;
        if (c.k === 'coins') { PS.money += c.n; if (c.src === 'purse') hh.money -= c.n; else if (bz) bz.cash -= c.n; stolen.push(`${c.n}d`); continue; }
        const n = c.src === 'stash' ? 1 : c.n; const got = PS.add(c.k, n);
        if (!got) { O.Panels.toast('Your satchel is full.', 'bad'); break; }
        if (c.src === 'stash') PS.stash.splice(PS.stash.indexOf(c.k), 1);
        else if (c.src === 'homestash') PS.homes[c.key].splice(PS.homes[c.key].indexOf(c.k), 1);
        else if (c.src === 'pantry') hh.pantry[c.good] -= got;
        else if (c.src === 'biz') bz.stock[c.good] -= got;
        else if (c.src === 'farm') sim.supplierOf('farmhouse').stock.wheat -= got;
        else if (c.src === 'val') hh.valuables.splice(hh.valuables.indexOf(c.k), 1);
        if (c.src !== 'stash' && c.src !== 'homestash') { stolen.push(`${got} ${G[c.k].name.toLowerCase()}`); PS.stolen[c.k] = (PS.stolen[c.k] || 0) + got; }
      }
      if (stolen.length) O.Crime.theft(game, sim, { building: b, floor: game.scene.floor, what: stolen.join(', '), owner, value: idxs.length });
      O.Panels.close();
    }

    function search(it, quick) {
      const { items, owner } = contents(it);
      const own = owner === 'you';
      if (quick && !own) { O.Panels.toast("That isn't yours to take. Search it with E, stealing has witnesses.", 'bad'); return; }
      searching = 0.7; game.player.dir = 3;
      pendingSearch = () => {
        if (quick) { take(it, items, items.map((_, i) => i), owner); O.Panels.toast(items.length ? 'You gather your things.' : 'Nothing here.'); return; }
        O.Panels.container(`${it.kind[0].toUpperCase() + it.kind.slice(1)}, ${owner}`, items, (idxs) => take(it, items, idxs, owner), own ? null : `This belongs to ${owner}. Anyone awake in the room will see you take it.`);
      };
    }

    // Sleeping: you lie down and the night passes (quickly, for you) while the village sleeps around
    // you; you wake at seven, or when you've slept eight hours if you lay down in the day.
    function sleep(it, rough) {
      if (game.sleepState) return;
      const m0 = sim.minute, target = m0 >= 19 * 60 || m0 < 6 * 60 ? 7 * 60 : (m0 + 8 * 60) % 1440;
      game.sleepState = { it, rough, target, slept: 0 };
      game.player.inBed = it || null; game.player.anim = rough ? 'lie' : 'idle';
      O.UI.say(rough ? 'You bed down in the straw…' : 'You climb into bed and close your eyes…');
    }
    game.hooks.update.push((dt) => {
      const st = game.sleepState; if (!st) return;
      game.player.locked = true;
      for (let k = 0; k < 4; k++) { sim.tick(2); PS.tick(2, true); st.slept += 2; const m = sim.minute; if ((m >= st.target && m < st.target + 6) || st.slept > 16 * 60) { wake(); return; } }
    });
    function wake() {
      const st = game.sleepState; game.sleepState = null;
      const p = game.player; p.inBed = null; p.anim = 'idle'; p.locked = false;
      if (st.rough) { PS.energy = Math.min(PS.energy, 70); PS.hp = Math.max(1, PS.hp - 2); }
      O.UI.say(st.rough ? `You wake stiff and itching on ${O.DAYNAMES[sim.weekday]}.` : `You wake on ${O.DAYNAMES[sim.weekday]}, rested.`);
      // a night in a bed of your own house (or one you rent) makes it where you live
      const b = game.scene && game.scene.b, cs = O.SimRef.cur;
      if (b && !st.rough && cs && O.isHomeOf(b, cs)) PS.residence = { place: cs.world.placeId, b: b.id, day: cs.day };
    }
    // a house is yours to live in if you own it or rent it
    O.isHomeOf = (b, s) => ['house', 'townhouse', 'mansion', 'cottage', 'hovel', 'manor'].includes(b.type) && (b.owner?.kind === 'player' || (PS.lease && PS.lease.b === b.id && PS.lease.place === s.world.placeId));
    // where you live: the house you last slept in, as long as it is still yours
    O.livesIn = (placeId) => {
      const r = PS.residence; if (!r || r.place !== placeId) return false;
      const v = placeId === (O.SimRef.home && O.SimRef.home.world.placeId) ? { world: O.SimRef.home.world, sim: O.SimRef.home } : O.Travel && O.Travel.visited.get(placeId);
      const w = v && (v.world || v.sim?.world), b = w && w.buildings.find((x) => x.id === r.b);
      return !!(b && O.isHomeOf(b, v.sim || O.SimRef.home));
    };
    O.Sleep = { sleep, sleeping: () => !!game.sleepState };

    game.keyHandlers.push((e) => {
      if (e.code === 'KeyI') { if (O.panelOpen) O.Panels.close(); else O.Panels.inventory(); return true; }
      if (e.code === 'Escape' && O.panelOpen) { O.Panels.close(); return true; }
      if (O.panelOpen || searching > 0) return false;
      if (e.code === 'KeyQ' && cur && cur.type === 'horse') return false;
      if (e.code === 'KeyQ') {
        if (cur && cur.type === 'npc' && cur.person.age >= 8) O.Law.pickpocket(cur);
        else if (cur && cur.type === 'door' && doorLocked(cur.b) && cur.b.type !== 'guard') O.Law.pickLock(cur.b);
        return true;
      }
      if (e.code === 'KeyF' && cur && cur.type === 'npc' && O.Combat && O.Combat.lootable(cur.person)) { searching = 0.6; pendingSearch = () => O.Panels.toast(O.Combat.loot(cur.person)); return true; }
      if (e.code === 'KeyF') { if (cur && cur.type === 'container') search(cur.it, true); else O.Panels.toast('Nothing to loot here.'); return true; }
      if (e.code !== 'KeyE') return false;
      if (npcUI.talking()) { npcUI.closeTalk(); return true; }
      if (!cur) return false;
      switch (cur.type) {
        case 'npc': if (cur.person.health.hp <= 0) { O.Panels.toast(`${cur.person.first} is senseless.`); break; } npcUI.openTalk(cur.person); break;
        case 'door':
          if (doorLocked(cur.b)) { O.Panels.toast(`The door of ${cur.b.type === 'house' ? 'the house' : cur.b.name} is barred.`); break; }
          if (game.player.mount) O.Horses.dismount();
          { const bb = cur.b; game.walkInto ? game.walkInto(bb, () => { game.enterBuilding(bb, 0); O.Crime.onEnter(game, sim, bb); }) : (game.enterBuilding(bb, 0), O.Crime.onEnter(game, sim, bb)); }
          break;
        case 'container': search(cur.it, false); break;
        case 'claim': O.GangUI.claim(cur.b); break;
        case 'horse': O.inspectHorse(cur.h); break;
        case 'caravan': O.caravanPanel(cur.L); break;
        case 'notices': O.readNotices(); break;
        case 'exit': O.travelPanel(cur.side); break;
        case 'property': O.propertyPanel(cur.b); break;
        case 'namesign': O.readSign(cur); break;
        case 'job': O.jobAct(cur); break;
        case 'vote': O.voteAct(cur); break;
        case 'placed': O.placedAct(cur); break;
        case 'furn': O.furnAct(cur); break;
        case 'stash': O.GangUI.stash(); break;
        case 'campbed': sleep(null, true); break;
        case 'hay': sleep(null, true); break;
        case 'pickup': O.pickUp(cur.it); break;
        case 'traveller': case 'ruin': case 'signpost': O.roadAct(cur); break;
        case 'memorial': O.ChronicleUI.memorial(cur.prop.epitaph); break;
        case 'work': if (O.Craft.RECIPES[cur.it.kind]) { const J = O.Work.job(); O.craftPanel({ it: cur.it, who: `${J.masterName}'s`, work: true }); } else O.workShift(); break;
        case 'craft': O.craftPanel(cur); break;
        case 'fire': O.fightFire(cur); break;
        case 'stall': O.mindStall(); break;
        case 'portrait': { const pr = cur.it.portrait; O.Panels.toast(`A likeness of ${pr.name}, painted in life. Died ${O.Chronicle.dateLabel(pr.died)}.`); break; }
        case 'broadsheet': O.ChronicleUI.broadsheet(); break;
        case 'grave': { const g = cur.prop.grave; O.Panels.toast(g ? `“Here lies ${g.name}, ${g.age} years. ${g.cause.replace('died ', '').replace(/^./, (c) => c.toUpperCase())}.”` : 'The old stone is worn smooth; you can no longer read the name.'); break; }
        case 'bed':
          if (mayUseBed(cur.it)) sleep(cur.it);
          else if (cur.it.rent) O.Panels.toast('A guest bed. Beds are hired from the innkeeper at the counter downstairs.');
          else O.Panels.toast("That's someone else's bed.");
          break;
        case 'sit': { const sc = game.scene, pose = sc.seatPose(cur.it), p = game.player; p.sitting = Object.assign(pose, { it: cur.it, sx: p.x, sy: p.y, b: sc.b.id, floor: sc.floor }); p.x = pose.x; p.y = pose.y; p.dir = pose.dir; p.anim = 'sit'; if (cur.it.kind === 'throne' && sim.byId) O.Panels.toast('You sit on the throne. Nobody seems pleased about it.'); break; }
        case 'stairs': { const up = cur.it ? !!cur.it.stairs : game.scene.floor === 0; game.enterBuilding(game.scene.b, game.scene.floor + (up ? 1 : -1), up ? 'up' : 'down'); break; }
        case 'shop': O.Panels.trade(sim, sim.biz.get(game.scene.b.id), cur.seller); break;
      }
      return true;
    });
  }
  O.escape = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  O.Interact = { setup };
})();
