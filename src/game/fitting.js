// Eating, drinking, setting things down, and fitting out a building.
// - Eat or drink from the satchel and you're seen doing it: the bite, the swig, then the good of it.
// - Set food (or a jug, a cup, a lantern) down: you bend and place it within reach. Outdoors it sits on
//   the ground; indoors on the table you're by, or the floor. Anyone hungry nearby may eat it, you too.
// - Furniture you've bought can be set down inside a building you own or rent, and taken up again;
//   it must never block a door, the stairs, or anything that has to be reached.
// - Owners and tenants can have the floor and walls redone.
// - A business is only that business while its equipment is inside: take up the bakery's oven and it
//   stops baking; fit out an empty house with an oven, shelves and a counter and it can open as one.
'use strict';
(function () {
  const T = 16;
  function setup(game) {
    const PS = O.PlayerState, G = O.Data.GOODS, cur = () => O.SimRef.cur, say = (t, k) => O.UI.say(t, k);
    const nm = (k) => (G[k]?.name || k).toLowerCase();

    // ---------------- eating and drinking ----------------
    let busy = 0, then = null;
    game.hooks.update.push((dt) => { if (busy > 0) { busy -= dt; game.player.locked = true; if (busy <= 0) { game.player.locked = false; game.player.anim = 'idle'; const f = then; then = null; f && f(); } } });
    const doAnim = (anim, secs, f) => { game.player.anim = anim; game.player.ft = 0; busy = secs; then = f; };
    O.consume = (k) => {
      const g = G[k]; if (!g || !PS.items.includes(k)) return;
      const drink = !!g.drink;
      doAnim(drink ? 'drink' : 'eat', 1.8, () => {
        PS.remove(k);
        if (g.food) PS.hunger = Math.min(100, PS.hunger + 35 * g.food);
        if (drink) PS.energy = Math.min(100, PS.energy + 6 * (g.drink || 0.3));
        PS.hp = Math.min(100, PS.hp + 3);
        if (k === 'ale' || k === 'wine') { PS.tipsy = Math.min(3, (PS.tipsy || 0) + 1); }
        say(drink ? `You drink the ${nm(k)}.${PS.tipsy >= 3 ? ' The street sways a little.' : ''}` : `You eat the ${nm(k)}.`);
      });
    };
    // drink wears off
    game.hooks.update.push((dt) => { if (PS.tipsy) PS.tipsy = Math.max(0, PS.tipsy - dt / 90); });

    // ---------------- setting things down ----------------
    // indoors: kept per building and floor, in scene pixels
    const placedIn = (b, floor) => (b.placedItems || []).filter((x) => x.floor === floor);
    O.placeItem = (k) => {
      const g = G[k]; if (!g || !PS.items.includes(k)) return;
      if (g.furniture) return placeFurniture(k);
      const p = game.player, d = O.Char.DIRV[p.dir] || [0, 1];
      doAnim('place', 0.9, () => {
        PS.remove(k);
        if (game.scene) {
          const sc = game.scene, b = sc.b;
          // on the nearest table or counter within reach, else on the floor in front of you
          let at = null;
          for (const it of sc.L.items) if (it.table || it.counter || it.kind === 'bar' || it.kind === 'desk') { const [ax, ay] = sc.anchor(it), [x0, y0, x1] = sc.rect(it); if (Math.hypot(ax - p.x, ay - p.y) < 40) { at = { x: O.clamp(p.x, x0 + 6, x1 - 6), y: y0 + 6, top: true }; break; } }
          if (!at) at = { x: p.x + d[0] * 14, y: p.y + d[1] * 10 };
          (b.placedItems = b.placedItems || []).push({ good: k, x: at.x, y: at.y, floor: sc.floor, top: !!at.top, id: Math.random() });
        } else {
          const s = cur(); s.drop(k, 1, p.x + d[0] * 14, p.y + d[1] * 10 + 2); const it = s.dropped[s.dropped.length - 1]; if (it) it.placed = true;
        }
        say(`You set down the ${nm(k)}.`);
      });
    };
    // drawn inside, in their proper place among the furniture and people
    O.sceneExtras = (sc, ctx, cam) => (sc.b.placedItems || []).filter((x) => x.floor === sc.floor).map((x) => ({ y: x.top ? x.y + 10 : x.y, draw: () => { const sp = O.ItemArt.small(x.good); ctx.drawImage(sp, Math.round(x.x - 6 - cam.x), Math.round(x.y - 10 - cam.y)); } }));
    // pick it up again, or eat it where it lies
    O.placedCandidate = () => {
      const p = game.player;
      if (game.scene) { let best = null, bd = 26; for (const x of placedIn(game.scene.b, game.scene.floor)) { const d = Math.hypot(x.x - p.x, x.y - p.y); if (d < bd) { bd = d; best = { type: 'placed', x, d, xx: x.x, y: x.y - 22 }; } } if (best) { best.x0 = best.x; best.x = best.xx; } return best; }
      return null;
    };
    O.placedAct = (c) => {
      const it = c.x0, b = game.scene.b, g = G[it.good];
      const take = () => { b.placedItems = b.placedItems.filter((x) => x !== it); };
      if ((g.food || g.drink) && PS.hunger < 85) { doAnim(g.drink ? 'drink' : 'eat', 1.8, () => { take(); if (g.food) PS.hunger = Math.min(100, PS.hunger + 35 * g.food); say(`You ${g.drink ? 'drink' : 'eat'} the ${nm(it.good)}.`); }); return; }
      doAnim('pickup', 0.6, () => { if (PS.add(it.good)) { take(); say(`You pick up the ${nm(it.good)}.`); } else say('Your satchel is full.'); });
    };
    // hungry people help themselves to food left out, sitting down to it (outdoors and in)
    let nt = 0;
    game.hooks.update.push((dt) => {
      nt -= dt; if (nt > 0) return; nt = 3;
      const s = cur();
      if (!game.scene) {
        for (const d of s.dropped || []) { if (!G[d.good]?.food) continue; const q = s.people.find((x) => !x.agent.hidden && x.needs.hunger < 45 && Math.hypot(x.agent.x - d.x, x.agent.y - d.y) < 40 && !x.agent.frozen); if (q) { q.agent.anim = 'eat'; q.agent.frozen = true; setTimeout(() => { q.agent.frozen = false; }, 2500); q.needs.hunger = Math.min(100, q.needs.hunger + 35 * G[d.good].food); s.pickUpDropped(d); s.remember(q, `Found ${nm(d.good)} left out and ate it.`, 'life', 0.3); break; } }
      } else {
        const sc = game.scene; for (const x of placedIn(sc.b, sc.floor)) { if (!G[x.good]?.food) continue; const q = [...sc.actors.values()].find((a) => a.person && a.person.needs.hunger < 45 && Math.hypot(a.x - x.x, a.y - x.y) < 50); if (q) { q.person.needs.hunger = Math.min(100, q.person.needs.hunger + 35 * G[x.good].food); sc.b.placedItems = sc.b.placedItems.filter((z) => z !== x); s.remember(q.person, `Ate the ${nm(x.good)} that was left out.`, 'life', 0.3); q.gAnim = 'eat'; break; } }
      }
    });

    // ---------------- furniture ----------------
    const mayFit = (b) => b && ((b.owner && b.owner.kind === 'player') || (PS.lease && PS.lease.b === b.id));
    function rebuild(sc) { O.Interior.invalidate(sc.b); game.enterBuilding(sc.b, sc.floor, null); }
    function placeFurniture(k) {
      const sc = game.scene, kind = G[k].furniture;
      if (!sc || !mayFit(sc.b)) return say('Furniture can only be set down inside a building you own or rent.', 'bad');
      const p = game.player, L = sc.L, d = O.Char.DIRV[p.dir] || [0, 1];
      const tx = Math.floor((p.x + d[0] * 18 - sc.R.SW) / T), ty = Math.floor((p.y + d[1] * 14 - sc.R.WH) / T) - (d[1] < 0 ? 1 : 0);
      const b = sc.b, prev = (b.extraFurn || []).slice();
      b.extraFurn = [...prev, { kind, tx: O.clamp(tx, 0, L.w - 1), ty: O.clamp(ty, 0, L.d - 1), floor: sc.floor }];
      O.Interior.invalidate(b);
      const L2 = O.Interior.interior(b, sc.floor, cur());
      const ok = L2.items.some((i) => i.owned && i.kind === kind && i.tx === O.clamp(tx, 0, L.w - 1) && i.ty === O.clamp(ty, 0, L.d - 1));
      // never in the way: the door, the stairs and everything that must be reached stay reachable
      const blocked = !ok || L2.items.some((i) => i.access && !reachable(L2, i));
      if (blocked) { b.extraFurn = prev; O.Interior.invalidate(b); return say(ok ? "That would block the way. Try somewhere else." : "There isn't room there.", 'bad'); }
      doAnim('place', 1, () => { PS.remove(k); rebuild(sc); say(`You set down the ${nm(k)}.`); checkFitting(b); });
    }
    function reachable(L, it) { const R = L.reachable; if (!R) return true; for (let y = it.ty - 1; y <= it.ty + it.fh; y++) for (let x = it.tx - 1; x <= it.tx + it.fw; x++) if (x >= 0 && y >= 0 && x < L.w && y < L.d && R[y * L.w + x]) return true; return false; }
    O.furnCandidate = () => {
      const sc = game.scene; if (!sc || !mayFit(sc.b)) return null;
      const p = game.player; let best = null, bd = 26;
      for (const it of sc.L.items) { if (it.kind === 'stairs' || it.partition || it.portrait || !O.Data.FURN[it.kind]) continue; const [x, y] = sc.anchor(it); const d = Math.hypot(x - p.x, y + 6 - p.y); if (d < bd) { bd = d; best = { type: 'furn', it, d: d + 6, x, y: y - 30 }; } }
      return best;
    };
    O.furnAct = (c) => {
      const sc = game.scene, b = sc.b, it = c.it, k = 'fx_' + it.kind;
      if (!PS.canCarry(k)) return say('Your satchel is too full to carry that.', 'bad');
      doAnim('pickup', 0.9, () => {
        if (it.owned) b.extraFurn = (b.extraFurn || []).filter((f) => !(f.kind === it.kind && f.tx === it.tx && f.ty === it.ty && f.floor === sc.floor));
        else (b.removedFurn = b.removedFurn || []).push(sc.floor + ':' + it.kind + '@' + it.tx + ',' + it.ty);
        PS.add(k); rebuild(sc); say(`You take up the ${nm(k)}.`); checkFitting(b);
      });
    };

    // ---------------- is it still the business it claims to be? ----------------
    function equipOf(b) { const have = []; for (let f = 0; f < (b.floors || 1); f++) { try { have.push(...O.Interior.interior(b, f, cur()).items.map((i) => i.kind)); } catch (e) { /* */ } } return have; }
    function satisfies(have, eq) { const pool = have.slice(); for (const k of eq) { const i = pool.indexOf(k); if (i < 0) return false; pool.splice(i, 1); } return true; }
    function checkFitting(b) {
      const s = cur(), bz = s.biz.get(b.id); if (!bz || !bz.def.equip) return;
      const ok = satisfies(equipOf(b), bz.def.equip);
      if (!ok && !bz.unfitted) { bz.unfitted = true; say(`Without its ${bz.def.equip.join(', ')}, ${bz.name} can't work as a ${bz.def.label.toLowerCase()}.`, 'bad'); }
      if (ok && bz.unfitted) { bz.unfitted = false; say(`${bz.name} has what it needs again.`); }
    }
    O.fitsAs = (b) => { const have = equipOf(b); return Object.entries(O.Data.BUSINESS).filter(([, d]) => d.equip && !d.public && satisfies(have, d.equip)).map(([t]) => t); };
    O.missingFor = (b, type) => { const have = equipOf(b), need = (O.Data.BUSINESS[type]?.equip || []).slice(); for (const k of have) { const i = need.indexOf(k); if (i >= 0) need.splice(i, 1); } return need; };
    // an unfitted business does no work
    const SP = O.Sim.prototype, _work = SP.work;
    SP.work = function (p) { const bz = p.job && this.biz.get(p.job.biz); if (bz && bz.unfitted) return; return _work.call(this, p); };

    // ---------------- floors and walls ----------------
    O.redecorate = (b, what, kind) => {
      const cost = what === 'floor' ? { stone: 30, wood: 18, dirt: 4 }[kind] : { stone: 34, plank: 16, timber: 20, log: 12 }[kind];
      if (PS.money < cost) return say(`That work costs ${cost}d.`, 'bad');
      PS.money -= cost; b.decor = Object.assign({}, b.decor, { [what]: kind }); O.Interior.invalidate(b);
      if (game.scene && game.scene.b === b) rebuild(game.scene);
      say(`The ${what === 'floor' ? 'floor is relaid' : 'walls are redone'} in ${kind}. ${cost}d.`);
    };
  }
  O.FittingSetup = { setup };
})();
