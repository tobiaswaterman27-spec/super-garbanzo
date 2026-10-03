// Contextual interaction: finds what's in reach (people, doors, containers, beds, stairs), shows only
// actions that make sense, and runs them. Taking what isn't yours is theft, and anyone awake in the
// room sees it.
'use strict';
(function () {
  const G = O.Data.GOODS, PS = O.PlayerState;

  function setup(game, sim, npcUI) {
    const prompt = document.createElement('div'); prompt.className = 'hud hud-prompt prompt'; prompt.hidden = true; game.el.parentElement.appendChild(prompt);
    let cur = null, searching = 0, pendingSearch = null;

    function doorLocked(b) {
      const h = sim.hour, bz = sim.biz.get(b.id);
      if (b.type === 'barn') return false;
      if (b.type === 'hideout') return b.gang !== 'player';
      if (PS.room && PS.room.b === b.id && sim.day <= PS.room.until) return false;
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
      for (const q of sim.people) { const a = q.agent; if (a.hidden) continue; const d = Math.hypot(a.x - p.x, a.y - p.y); if (d < 26) out.push({ type: 'npc', person: q, d, x: a.x, y: a.y }); }
      const T = sim.T;
      for (const pr of sim.world.props) if (pr.kind === 'gravestone') { const d = Math.hypot(pr.x - p.x, pr.y - p.y); if (d < 20) out.push({ type: 'grave', prop: pr, d: d + 2, x: pr.x, y: pr.y - 14 }); }
      for (const b of sim.world.buildings) {
        if (b.site) continue;
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
        case 'door': return doorLocked(c.b) ? `${c.b.name} — locked` : `Enter ${c.b.type === 'house' ? 'house' : c.b.name}`;
        case 'container': return `Search ${c.it.kind}`;
        case 'grave': return 'Read the gravestone';
        case 'caravan': return `Hail ${c.L.c.merchant}'s caravan`;
        case 'notices': return 'Read the notice board';
        case 'horse': return `Look over ${c.h.owner === 'player' ? c.h.name : 'the horse'}`;
        case 'claim': return 'Claim the abandoned camp';
        case 'stash': return 'Open the stash';
        case 'campbed': return 'Sleep by the fire';
        case 'bed': return mayUseBed(c.it) ? 'Sleep until morning' : 'Bed — not yours';
        case 'stairs': return game.scene.floor === 0 ? 'Go upstairs' : 'Go downstairs';
        default: return '';
      }
    }
    const mayUseBed = (it) => (it.gangBed && game.scene && game.scene.b.gang === 'player') || (it.rent && PS.room && game.scene && PS.room.b === game.scene.b.id && sim.day <= PS.room.until);

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
    game.hooks.drawWorld.push((ctx, cam) => {
      if (!cur || cur.type !== 'npc') return;
      const x = Math.round(cur.x - cam.x), y = Math.round(cur.y - O.Char.GROUND - cam.y + 1 + (Math.floor(game.t * 3) % 2));
      ctx.fillStyle = '#1b1424'; ctx.fillRect(x - 3, y - 1, 7, 4);
      ctx.fillStyle = '#f0b45c'; ctx.fillRect(x - 2, y, 5, 1); ctx.fillRect(x - 1, y + 1, 3, 1); ctx.fillRect(x, y + 2, 1, 1);
    });

    // ----- container contents come from the real owners -----
    function contents(it) {
      const b = game.scene.b, hh = b.household ? sim.households[b.household - 1] : null, bz = sim.biz.get(b.id);
      const out = [];
      if (it.rentChest && PS.room && PS.room.b === b.id) { (PS.stash || (PS.stash = [])).forEach((k) => out.push({ k, n: 1, src: 'stash' })); return { items: out, owner: 'you' }; }
      if (it.stockOf && bz) {
        const goods = it.stockOf === 'farm' ? ['wheat', 'cabbage'] : it.stockOf === 'store' ? ['cabbage', 'firewood', 'flour'] : [it.stockOf];
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
        else if (c.src === 'pantry') hh.pantry[c.good] -= got;
        else if (c.src === 'biz') bz.stock[c.good] -= got;
        else if (c.src === 'farm') sim.supplierOf('farmhouse').stock.wheat -= got;
        else if (c.src === 'val') hh.valuables.splice(hh.valuables.indexOf(c.k), 1);
        if (c.src !== 'stash') { stolen.push(`${got} ${G[c.k].name.toLowerCase()}`); PS.stolen[c.k] = (PS.stolen[c.k] || 0) + got; }
      }
      if (stolen.length) O.Crime.theft(game, sim, { building: b, floor: game.scene.floor, what: stolen.join(', '), owner, value: idxs.length });
      O.Panels.close();
    }

    function search(it, quick) {
      const { items, owner } = contents(it);
      const own = owner === 'you';
      if (quick && !own) { O.Panels.toast("That isn't yours to take. Search it with E — stealing has witnesses.", 'bad'); return; }
      searching = 0.7; game.player.dir = 3;
      pendingSearch = () => {
        if (quick) { take(it, items, items.map((_, i) => i), owner); O.Panels.toast(items.length ? 'You gather your things.' : 'Nothing here.'); return; }
        O.Panels.container(`${it.kind[0].toUpperCase() + it.kind.slice(1)} — ${owner}`, items, (idxs) => take(it, items, idxs, owner), own ? null : `This belongs to ${owner}. Anyone awake in the room will see you take it.`);
      };
    }

    function sleep() {
      O.Panels.toast('You sleep…');
      const target = 7 * 60;
      let guard = 0;
      while (guard++ < 1000) { sim.tick(2); PS.tick(2, true); const m = sim.minute; if (m >= target && m < target + 4) break; }
      game.player.anim = 'idle';
      O.Panels.toast(`You wake on ${O.DAYNAMES[sim.weekday]}, rested.`);
    }

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
          game.enterBuilding(cur.b, 0);
          O.Crime.onEnter(game, sim, cur.b);
          break;
        case 'container': search(cur.it, false); break;
        case 'claim': O.GangUI.claim(cur.b); break;
        case 'horse': O.inspectHorse(cur.h); break;
        case 'caravan': O.caravanPanel(cur.L); break;
        case 'notices': O.readNotices(); break;
        case 'stash': O.GangUI.stash(); break;
        case 'campbed': sleep(); break;
        case 'grave': { const g = cur.prop.grave; O.Panels.toast(g ? `“Here lies ${g.name}, ${g.age} years. ${g.cause.replace('died ', '').replace(/^./, (c) => c.toUpperCase())}.”` : 'The old stone is worn smooth; you can no longer read the name.'); break; }
        case 'bed': if (mayUseBed(cur.it)) sleep(); else O.Panels.toast("That's someone else's bed."); break;
        case 'stairs': game.enterBuilding(game.scene.b, game.scene.floor === 0 ? 1 : 0, true); break;
      }
      return true;
    });
  }
  O.escape = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  O.Interact = { setup };
})();
