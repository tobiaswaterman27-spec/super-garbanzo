// The town's stray. A rangy dog belonging to nobody does the round of the shop fronts: it sits at the
// butcher's door with its head on one side until a scrap is tossed to it, noses along the gutter, and now
// and then, when the trestle outside a shop is left a moment, it snatches something (a sausage, a loaf, a
// fish) and is off down the street with it, the shopkeeper pelting after it shouting, and giving up
// red-faced while the street laughs.
'use strict';
(function () {
  const T = 16;
  function setup(game) {
    const cur = () => O.SimRef.cur;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    let D = null, thefts = 0, fed = 0;
    const near = (x, y, r) => Math.hypot(x - game.player.x, y - game.player.y) < r;
    const talking = (q) => O.npcUI && O.npcUI.talking && O.npcUI.talking() === q;
    const LOOT = { butcher: '#b04040', bakery: '#c89a5a', fishery: '#c8d4dc', market: '#c83a2a' };
    const shops = (s) => [...s.biz.values()].filter((z) => z.open !== false && ['butcher', 'bakery', 'fishery', 'grocer', 'store', 'chandler', 'cheesemonger'].includes(z.type)).map((z) => [z, s.building(z.b?.id ?? z.id)]).filter(([, b]) => b && b.doorX != null);
    function newDog(s) { return { s, x: game.player.x - 200, y: game.player.y, dir: 2, ft: 0, st: 'wander', t: 0, tx: null, ty: null, seed: O.hash('stray', s.world.placeId || 'x') % 1000, loot: null }; }
    const go = (d, x, y) => { d.tx = x; d.ty = y; };
    game.hooks.update.push((dt) => {
      const s = cur(); if (!s || !s.world || game.scene) return; const hr = s.minute / 60;
      if (!D || D.s !== s) D = newDog(s); const d = D; d.ft += dt; d.t += dt;
      // walk to the target
      let moving = false; if (d.tx != null) { const dx = d.tx - d.x, dy = d.ty - d.y, dd = Math.hypot(dx, dy), v = d.st === 'flee' ? 110 : d.st === 'trot' ? 40 : 22; if (dd < 2) { d.tx = null; } else { const st = Math.min(dd, v * dt), nx = d.x + dx / dd * st, ny = d.y + dy / dd * st; if (!game.solidAt || !game.solidAt(nx, ny)) { d.x = nx; d.y = ny; } else d.tx = null; d.dir = dx > 0 ? 2 : 1; moving = true; } } d.moving = moving;
      const P = game.player, list = shops(s);
      if (d.st === 'wander') { if (d.tx == null && d.t > 3) { d.t = 0; const near2 = list.filter(([, b]) => Math.hypot(b.doorX * T - P.x, b.doorY * T - P.y) < 500); if (near2.length && Math.random() < 0.6 && hr > 7 && hr < 18) { const [z, b] = pick(near2); d.shop = z; d.b = b; d.st = 'trot'; go(d, (b.doorX + 1) * T + 8, (b.doorY + 1) * T + 12); } else go(d, P.x + (Math.random() - 0.5) * 360, P.y + (Math.random() - 0.5) * 220); } }
      else if (d.st === 'trot') { if (d.tx == null) { d.st = 'beg'; d.t = 0; } }
      else if (d.st === 'beg') {
        if (d.t > 3 && !d.tried) { d.tried = true; const keeper = (d.shop.workers || []).map((id) => s.byId.get(id)).find((q) => q && q.agent && q.agent.inside === d.b.id || (q && q.agent && !q.agent.hidden && Math.hypot(q.agent.x - d.x, q.agent.y - d.y) < 80));
          const r = Math.random();
          if (d.shop.type === 'butcher' && r < 0.6) { fed++; d.loot = '#b04040'; d.st = 'eat'; d.t = 0; if (keeper && near(d.x, d.y, 260)) O.Speech && O.Speech.say(keeper, pick(['Here, you mangy thing.', 'Go on then. Now clear off.', 'Same time tomorrow, is it?']), 2.2); }
          else if (r < 0.45 && O.ShopDisplay && O.ShopDisplay.spots.get(d.b.id)) { const sp = O.ShopDisplay.spots.get(d.b.id); d.loot = LOOT[d.shop.type] || '#c8a060'; thefts++; d.st = 'flee'; d.t = 0; d.x = sp[0]; d.y = sp[1] + 4; const away = d.x < P.x ? -1 : 1; go(d, d.x + away * 260, d.y + (Math.random() - 0.5) * 60); if (near(d.x, d.y, 300)) O.animalCall && O.animalCall('dog', 0.3);
            const k = keeper && !keeper.agent.frozen && !keeper.errand && !talking(keeper) ? keeper : null; if (k) { O.Speech && near(d.x, d.y, 300) && O.Speech.say(k, pick(['Thief! Come back here!', 'Drop it, you cur!', 'My sausages!']), 2.4); O.Errands.send(s, k, [Math.floor((d.x + away * 120) / T), Math.floor(d.y / T)], { anim: 'shake', secs: 1.5, face: 0, sprint: true, giveUp: game.t + 15, after: () => { O.Speech && near(k.agent.x, k.agent.y, 300) && O.Speech.say(k, pick(['Next time, dog. Next time.', 'Blast it.', 'Puffed. Blast that animal.']), 2.2); const w = s.people.find((x) => x !== k && x.agent && !x.agent.hidden && x.agent.inside == null && Math.hypot(x.agent.x - k.agent.x, x.agent.y - k.agent.y) < 140); if (w) O.gesture && O.gesture(w, 'laugh', 1.6); } }); } }
          else { d.st = 'wander'; d.t = 0; } }
        if (d.t > 9 && d.st === 'beg') { d.st = 'wander'; d.t = 0; d.tried = false; }
      }
      else if (d.st === 'eat') { if (d.t > 6) { d.loot = null; d.st = 'wander'; d.t = 0; d.tried = false; } }
      else if (d.st === 'flee') { if (d.tx == null) { d.st = 'eat'; d.t = 0; d.tried = false; } }
      if (Math.hypot(d.x - P.x, d.y - P.y) > 700) { d.x = P.x - Math.sign(P.x - d.x || 1) * 400; d.y = P.y; d.tx = null; }
    });
    game.hooks.drawWorld.push((ctx, cam) => {
      const s = cur(); if (!s || game.scene || !D || D.s !== s) return; const d = D; if (O.occluded && O.occluded(d.x, d.y)) return;
      try { const an = d.moving ? (d.st === 'flee' ? 'gallop' : 'walk') : d.st === 'eat' ? 'graze' : 'idle', HA = O.Animals.HANIMS[an] || O.Animals.HANIMS.idle, fr = O.Animals.animal('dog', d.seed, d.dir, d.moving, Math.floor(d.ft * HA.fps) % HA.frames, an); ctx.drawImage(fr, Math.round(d.x - (fr.ox ?? fr.width / 2) - cam.x), Math.round(d.y - (fr.gy ?? fr.height) - cam.y)); } catch (e) { /* */ }
      if (d.loot) { const x = Math.round(d.x + (d.dir === 2 ? 9 : -11) - cam.x), y = Math.round(d.y - (d.st === 'eat' ? 3 : 9) - cam.y); ctx.fillStyle = d.loot; ctx.fillRect(x, y, 4, 2); }
      if (d.st === 'beg' && !d.moving && Math.floor(performance.now() / 300) % 4 === 0) { ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(Math.round(d.x - cam.x) + (d.dir === 2 ? -10 : 8), Math.round(d.y - 5 - cam.y), 2, 1); }
    });
    O.StrayDog = { get dog() { return D; }, get thefts() { return thefts; }, get fed() { return fed; } };
  }
  O.StrayDogSetup = { setup };
})();
