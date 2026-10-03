// Horses and village animals.
//
// Every horse is an individual with a name, breed, age, speed, stamina, temperament, value, owner
// and a history of every owner it has had (bought, sold, stolen, gifted). Horses graze in the
// paddock or stand where their rider left them. The player can buy one from the stables, ride it
// (H), gallop (Shift), board it, rename it, sell it — or steal one, which witnesses remember and
// the horse trader may recognise.
'use strict';
(function () {
  const PS = O.PlayerState, A = O.Animals;
  const NAMES = ['Bramble', 'Thistle', 'Ember', 'Ash', 'Mabyn', 'Hob', 'Willow', 'Sorrel', 'Rook', 'Dancer', 'Old Tom', 'Bess', 'Morrow', 'Juniper', 'Flint', 'Hazel', 'Nutmeg', 'Grimald', 'Swallow', 'Duke'];
  const BREEDS = { Courser: { speed: 1.25, stamina: 0.8, value: 140 }, Palfrey: { speed: 1.05, stamina: 1.1, value: 110 }, Rouncey: { speed: 1.0, stamina: 1.0, value: 70 }, Cob: { speed: 0.85, stamina: 1.25, value: 55 }, Jennet: { speed: 1.1, stamina: 0.95, value: 95 }, Destrier: { speed: 1.0, stamina: 1.2, value: 220 } };
  const TEMPERS = ['calm', 'spirited', 'skittish', 'stubborn', 'gentle'];

  function setup(game, sim, npcUI) {
    const r = O.RNG(4242), T = sim.T;
    const stable = sim.world.buildings.find((b) => b.type === 'stable');
    const stableBiz = sim.biz.get(stable.id);
    const paddock = { x0: 16, y0: 33, x1: 21, y1: 34 };
    const horses = [];
    let nextId = 1;
    function make(owner, opts = {}) {
      const breed = opts.breed || r.pick(Object.keys(BREEDS)), B = BREEDS[breed];
      const age = r.int(3, 16);
      const h = { id: nextId++, seed: r.int(1, 9999), name: r.pick(NAMES), breed, age, coat: r.pick(Object.keys(A.COATS)), blaze: r.chance(0.4), socks: r.chance(0.35),
        speed: +(B.speed * r.float(0.9, 1.1) * (age > 13 ? 0.9 : 1)).toFixed(2), staminaMax: Math.round(100 * B.stamina * r.float(0.85, 1.1)), temper: r.pick(TEMPERS),
        owner, history: [], x: 0, y: 0, dir: r.int(0, 3), anim: 'idle', ft: r.next() * 3, saddled: false, fed: 80 };
      h.stamina = h.staminaMax;
      h.value = Math.round(B.value * (age < 5 ? 0.85 : age > 12 ? 0.6 : 1) * h.speed);
      h.history.push({ day: sim.day, event: opts.event || 'bred', owner: ownerName(owner) }); h.world = 'ashford';
      horses.push(h); return h;
    }
    function ownerName(o) { if (o === 'player') return 'you'; if (typeof o === 'string' && o.startsWith('biz:')) return sim.biz.get(+o.slice(4))?.name || 'a stable'; const p = sim.byId.get(o); return p ? p.name : 'unknown'; }
    // the stables' stock, and two horses that belong to villagers
    for (let i = 0; i < 4; i++) { const h = make('biz:' + stable.id); place(h, paddock); }
    const doc = sim.people.find((q) => q.job?.role === 'physician');
    if (doc) { const h = make(doc.id, { breed: 'Palfrey', event: 'bought' }); h.saddled = true; place(h, paddock); }
    const rich = sim.households.filter((hh) => hh.money > 100)[0];
    if (rich) { const p = sim.byId.get(rich.members[0]); const h = make(p.id, { breed: 'Cob', event: 'bought' }); place(h, paddock); }
    function place(h, z) { h.x = r.int(z.x0, z.x1) * T + 8; h.y = r.int(z.y0, z.y1) * T + 12; }
    sim.horses = horses;

    // ---- village animals: chickens and pigs in the farmyard, sheep and cows in the pasture, dogs and cats about the houses
    const fauna = [];
    const zone = (x0, y0, x1, y1) => ({ x0, y0, x1, y1 });
    const add = (kind, n, z, extra = {}) => { for (let i = 0; i < n; i++) fauna.push(Object.assign({ kind, seed: r.int(1, 9999), z, x: r.int(z.x0, z.x1) * T + 8, y: r.int(z.y0, z.y1) * T + 12, dir: r.int(0, 3), ft: r.next() * 2, tx: null, wait: r.next() * 4, speed: kind === 'chicken' ? 14 : kind === 'cow' ? 8 : 11 }, extra)); };
    add('chicken', 7, zone(9, 52, 30, 54)); add('pig', 2, zone(27, 52, 33, 54));
    add('sheep', 5, zone(3, 33, 6, 35)); add('cow', 2, zone(3, 33, 6, 35));
    for (const b of sim.world.buildings.filter((x) => x.type === 'house' && x.wealth > 0.45).slice(0, 4)) add(r.chance(0.6) ? 'dog' : 'cat', 1, zone(b.x - 1, b.bottom + 1, b.x + b.w, b.bottom + 2));
    add('cat', 1, zone(38, 22, 43, 23)); add('dog', 1, zone(30, 29, 35, 29));
    O.fauna = fauna;

    // horse and animal actors are drawn like people
    const _frame = game.actorFrame.bind(game);
    game.actorFrame = (a) => {
      if (a.horse) { const H = O.Animals.HANIMS[a.anim] || O.Animals.HANIMS.idle; return O.Animals.horse(a.horse, a.dir, a.anim in O.Animals.HANIMS ? a.anim : 'idle', Math.floor(a.ft * H.fps) % H.frames); }
      if (a.animal) return O.Animals.animal(a.animal.kind, a.animal.seed, a.dir, a.moving, Math.floor(a.ft * 4) % 2);
      return _frame(a);
    };

    function horseActor(h) { return h._actor || (h._actor = { horse: h, x: h.x, y: h.y, dir: h.dir, anim: 'idle', ft: h.ft }); }
    function animalActor(f) { return f._actor || (f._actor = { animal: f, x: f.x, y: f.y, dir: f.dir, ft: f.ft, moving: false }); }

    // update: grazing wander, riding, stamina
    game.hooks.update.push((dt) => {
      const dtm = dt * game.clock.speed;
      for (const f of fauna) {
        f.ft += dt;
        if (f.tx == null) { f.wait -= dt; if (f.wait <= 0) { f.tx = r.int(f.z.x0, f.z.x1) * T + r.int(2, 14); f.ty = r.int(f.z.y0, f.z.y1) * T + r.int(6, 14); } }
        else {
          const dx = f.tx - f.x, dy = f.ty - f.y, d = Math.hypot(dx, dy), step = Math.min(d, f.speed * Math.min(dtm, 3));
          if (d < 1) { f.tx = null; f.wait = 2 + r.next() * 6; } else { f.x += (dx / d) * step; f.y += (dy / d) * step; f.dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 1 : 2) : (dy < 0 ? 3 : 0); }
        }
        const a = animalActor(f); a.x = f.x; a.y = f.y; a.dir = f.dir; a.ft = f.ft; a.moving = f.tx != null;
      }
      const p = game.player, mount = p.mount;
      for (const h of horses) {
        h.ft += dt;
        if (h === mount) { h.x = p.x; h.y = p.y; h.dir = p.dir; h.anim = p.moving ? (p.galloping ? 'gallop' : 'walk') : 'idle'; }
        else if (h.inPaddock !== false && !h.tied && (h.world || 'ashford') === 'ashford') {
          if (h.tx == null) { if (r.next() < dt * 0.15) { h.tx = r.int(paddock.x0, paddock.x1) * T + 8; h.ty = r.int(paddock.y0, paddock.y1) * T + 12; } h.anim = 'idle'; }
          else { const dx = h.tx - h.x, dy = h.ty - h.y, d = Math.hypot(dx, dy); if (d < 1) h.tx = null; else { const st = Math.min(d, 10 * dt); h.x += (dx / d) * st; h.y += (dy / d) * st; h.dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 1 : 2) : (dy < 0 ? 3 : 0); h.anim = 'walk'; } }
        } else h.anim = 'idle';
        if (h !== mount) h.stamina = Math.min(h.staminaMax, h.stamina + dt * 4);
        const a = horseActor(h); a.x = h.x; a.y = h.y; a.dir = h.dir; a.anim = h.anim; a.ft = h.ft;
      }
      if (mount) {
        p.galloping = game.keys.has('run') && mount.stamina > 5 && p.moving;
        if (p.galloping) mount.stamina = Math.max(0, mount.stamina - dt * 9); else mount.stamina = Math.min(mount.staminaMax, mount.stamina + dt * 2);
        if (p.galloping && mount.temper === 'skittish' && r.chance(dt * 0.02)) { dismount(true); O.Panels.toast(`${mount.name} shies and throws you!`, 'bad'); PS.hp -= 8; }
      }
      const wid = game.world.placeId;
      if (!game.scene) game.actors = [...game.actors.filter((a) => !a.horse && !a.animal), ...horses.filter((h) => h !== mount && (h.world || 'ashford') === wid).map(horseActor), ...(wid === 'ashford' ? fauna.map(animalActor) : [])];
    });

    // riding speed: replace the walking pace while mounted
    const _blocked = game.blocked.bind(game);
    game.speedFor = (run) => (game.player.mount ? (run && game.player.mount.stamina > 5 ? 150 : 82) * game.player.mount.speed : run ? 92 : 50);

    // draw the rider on the horse
    const _drawWorld = game.hooks.drawWorld;
    game.riderDraw = (ctx, a, fx, fy) => {
      const h = a.mount; if (!h) return false;
      const hf = O.Animals.horse(h, a.dir, h.anim, Math.floor(h.ft * (O.Animals.HANIMS[h.anim]?.fps || 2)) % (O.Animals.HANIMS[h.anim]?.frames || 2));
      const hx = Math.round(a.x - hf.ox - game.cam.x), hy = Math.round(a.y - hf.gy - game.cam.y);
      ctx.fillStyle = 'rgba(28,20,44,0.3)'; ctx.fillRect(hx + 12, hy + hf.gy - 1, 36, 3);
      const side = a.dir === 1 || a.dir === 2;
      const rider = O.Char.frame(a.a, a.dir, 'sit', 0);
      const ry = hy + hf.gy - 45 - (side ? 22 : 20), rx = Math.round(a.x - 16 - game.cam.x) + (side ? (a.dir === 2 ? -2 : 2) : 0);
      if (a.dir === 3) { ctx.drawImage(hf, hx, hy); ctx.drawImage(rider, rx, ry); }
      else if (a.dir === 0) { ctx.drawImage(hf, hx, hy); ctx.drawImage(rider, rx, ry); ctx.drawImage(hf, 0, 0, hf.width, 22, hx, hy, hf.width, 22); }
      else { ctx.drawImage(hf, hx, hy); ctx.drawImage(rider, rx, ry); }
      return true;
    };
    void _drawWorld; void _blocked;

    function nearestHorse() { let best = null, bd = 26; for (const h of horses) { if (h === game.player.mount || (h.world || 'ashford') !== game.world.placeId) continue; const d = Math.hypot(h.x - game.player.x, h.y - game.player.y); if (d < bd) { bd = d; best = h; } } return best; }
    function mountHorse(h) { if (game.scene) return; game.player.mount = h; h.saddled = true; h.tied = false; h.inPaddock = false; game.player.x = h.x; game.player.y = h.y; O.Panels.toast(`You swing up onto ${h.owner === 'player' ? h.name : 'the ' + h.coat + ' ' + h.breed.toLowerCase()}. Shift to gallop, H to dismount.`); }
    function dismount(thrown) { const h = game.player.mount; if (!h) return; game.player.mount = null; h.tied = true; h.x = game.player.x + (thrown ? 10 : 14); h.y = game.player.y; if (!thrown) O.Panels.toast(`You tie ${h.owner === 'player' ? h.name : 'the horse'} up.`); }
    O.Horses = { horses, nearestHorse, dismount, mountHorse };

    function inspect(h) {
      const mine = h.owner === 'player';
      O.Panels.open(`${mine ? h.name : 'A horse'}`, `<div class="kv">
        <div><span class="lbl">Breed</span><b>${h.breed}</b><small>${h.coat}${h.blaze ? ', a white blaze' : ''}${h.socks ? ', white socks' : ''} · ${h.age} years</small></div>
        <div><span class="lbl">Temperament</span><b>${h.temper}</b><small>speed ${Math.round(h.speed * 100)} · stamina ${h.staminaMax}</small></div>
        <div><span class="lbl">Worth</span><b>${O.money(h.value)}</b><small>owner: ${O.escape(ownerName(h.owner))}</small></div></div>
        <div class="lbl" style="margin-top:10px">History</div><ol class="chron">${h.history.map((e) => `<li>Day ${e.day}: ${e.event} — ${O.escape(e.owner)}</li>`).join('')}</ol>
        ${mine ? `<label class="lbl" for="horseName" style="display:block;margin-top:10px">Rename</label><input type="text" id="horseName" value="${O.escape(h.name)}" maxlength="20" style="width:100%;margin:4px 0"><button class="btn" data-ren="1">Rename</button> <button class="btn ghost" data-feed="1">Feed (1 wheat or 1d)</button>` : ''}`, (rr) => {
        const rn = rr.querySelector('[data-ren]'); if (rn) rn.onclick = () => { h.name = rr.querySelector('#horseName').value.trim() || h.name; inspect(h); };
        const fd = rr.querySelector('[data-feed]'); if (fd) fd.onclick = () => { if (PS.remove('wheat')) h.fed = 100; else if (PS.money >= 1) { PS.money -= 1; h.fed = 100; } h.stamina = h.staminaMax; O.Panels.toast(`${h.name} eats happily.`); };
      });
    }

    function trade(trader) {
      const forSale = horses.filter((h) => h.owner === 'biz:' + stable.id);
      const mine = horses.filter((h) => h.owner === 'player');
      O.Panels.open('Ashford Stables', `<p class="caption">${O.escape(trader.name)} runs a hand down a horse's neck. “Good animals, every one. Fair prices.”</p>
        <table><thead><tr><th>Horse</th><th>Breed</th><th class="n">Speed</th><th class="n">Price</th><th></th></tr></thead><tbody>${forSale.map((h) => `<tr><td>${O.escape(h.name)}<br><small class="lbl">${h.coat}, ${h.age}y, ${h.temper}</small></td><td>${h.breed}</td><td class="n">${Math.round(h.speed * 100)}</td><td class="n">${O.money(h.value)}</td><td><button data-buy="${h.id}">Buy</button></td></tr>`).join('') || '<tr><td colspan="5">No horses for sale.</td></tr>'}</tbody></table>
        ${mine.length ? `<table style="margin-top:12px"><thead><tr><th>Your horses</th><th class="n">Offer</th><th></th></tr></thead><tbody>${mine.map((h) => `<tr><td>${O.escape(h.name)}</td><td class="n">${O.money(Math.round(h.value * 0.6))}</td><td><button data-sell="${h.id}">Sell</button></td></tr>`).join('')}</tbody></table>` : ''}`, (rr) => {
        rr.querySelectorAll('[data-buy]').forEach((x) => x.onclick = () => {
          const h = horses.find((z) => z.id === +x.dataset.buy);
          if (PS.money < h.value) return O.Panels.toast(`You need ${O.money(h.value)}.`, 'bad');
          PS.money -= h.value; stableBiz.cash += h.value; h.owner = 'player'; h.history.push({ day: sim.day, event: 'sold', owner: 'you' }); h.inPaddock = true;
          sim.remember(trader, `Sold ${h.name} to the stranger for ${h.value}d.`, 'work', 1, 0);
          O.Panels.toast(`${h.name} is yours. Find them in the paddock.`); trade(trader);
        });
        rr.querySelectorAll('[data-sell]').forEach((x) => x.onclick = () => {
          const h = horses.find((z) => z.id === +x.dataset.sell);
          // the trader knows the horses of Ashford
          const stolen = h.history.find((e) => e.event === 'stolen');
          if (stolen && sim.rng.chance(0.85)) {
            const prev = h.history.filter((e) => e.event !== 'stolen').slice(-1)[0];
            O.Panels.close(); O.Panels.toast(`${trader.first}: “That's ${prev?.owner || 'someone'}'s horse! Watch! Horse thief!”`, 'bad');
            const cr = sim.recordCrime({ kind: 'horse theft', perp: 'player', placeName: 'Ashford Stables', tile: [stable.doorX, stable.doorY], seen: [trader], severity: 3 }); PS.crimes.push(cr.id); return;
          }
          if (game.player.mount === h) dismount();
          const offer = Math.round(h.value * 0.6); PS.money += offer; stableBiz.cash -= offer; h.owner = 'biz:' + stable.id; h.history.push({ day: sim.day, event: 'sold', owner: stable.name }); h.inPaddock = true; h.tied = false; place(h, paddock);
          trade(trader);
        });
      });
    }

    // talk-card hook for the horse trader
    const prevExtra = npcUI.extraButtons, prevOn = npcUI.onExtra;
    npcUI.extraButtons = (q) => { const out = prevExtra ? prevExtra(q) : []; if (q.job?.biz === stable.id && q.agent.inside === stable.id && stableBiz.open) out.push(['horses', 'Horses for sale']); return out; };
    npcUI.onExtra = (q, key, render) => { if (key === 'horses') { npcUI.closeTalk(); return trade(q); } return prevOn && prevOn(q, key, render); };

    game.keyHandlers.push((e) => {
      if (O.panelOpen) return false;
      if (e.code === 'KeyH') {
        if (game.player.mount) { dismount(); return true; }
        const h = nearestHorse(); if (!h) { O.Panels.toast('No horse within reach.'); return true; }
        if (h.owner === 'player') mountHorse(h);
        else O.Panels.toast(`That horse belongs to ${ownerName(h.owner)}. You could take it anyway (Q).`);
        return true;
      }
      if (e.code === 'KeyQ' && !game.scene) {
        const h = nearestHorse(); if (!h || h.owner === 'player') return false;
        // horse theft: witnesses remember the horse as well as the rider
        const seen = sim.seers(game.player.x, game.player.y).filter((q) => r.chance(0.6));
        const prevOwner = ownerName(h.owner);
        h.history.push({ day: sim.day, event: 'stolen', owner: 'a stranger' });
        h.formerOwner = h.owner; h.owner = 'player';
        mountHorse(h);
        PS.rep.criminal = Math.min(1, PS.rep.criminal + 0.06);
        if (seen.length) { const cr = sim.recordCrime({ kind: 'horse theft', perp: 'player', placeName: sim.where({ x: h.x, y: h.y }), tile: [Math.floor(h.x / T), Math.floor(h.y / T)], seen, severity: 3 }); PS.crimes.push(cr.id); O.Panels.toast(`${seen[0].first} shouts: “Horse thief! That's ${prevOwner}'s horse!”`, 'bad'); }
        else O.Panels.toast(`Nobody sees you lead ${prevOwner}'s horse away.`);
        if (typeof h.formerOwner === 'number') { const v = sim.byId.get(h.formerOwner); if (v) sim.remember(v, `My horse ${h.name} has been stolen!`, 'crime', 2.5); }
        return true;
      }
      return false;
    });

    // E on a horse inspects it (registered as an interaction candidate)
    O.horseCandidate = () => { if (game.scene || game.player.mount) return null; const h = nearestHorse(); if (!h) return null; return { type: 'horse', h, d: Math.hypot(h.x - game.player.x, h.y - game.player.y) + 3, x: h.x, y: h.y - 30 }; };
    O.inspectHorse = inspect;
  }
  O.HorsesSetup = { setup, BREEDS };
})();
