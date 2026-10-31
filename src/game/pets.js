// Dogs and cats with people of their own. Some households keep one: it trails its master about the
// town and barks at strangers by the door. A stray will take to you if you share a bite with it, and a
// neighbour whose bitch has whelped may give you a pup; you name it, and it follows at your heel, waits
// where you tell it, or goes home and keeps watch there. Your horse knows you too: whistle (H) and it
// comes to you.
'use strict';
(function () {
  const T = 16;
  const DOG = ['Bran', 'Gelert', 'Hodain', 'Cabal', 'Rufus', 'Bonny', 'Fly', 'Tray', 'Jack', 'Nell', 'Gyp', 'Rook', 'Bess', 'Sorrel', 'Brock', 'Lark', 'Ranger', 'Belle', 'Swift', 'Pip', 'Scrap', 'Bob', 'Grip', 'Holdfast', 'Fleet', 'Shadow', 'Tib', 'Rowan', 'Smudge', 'Bramble'];
  const CAT = ['Tibert', 'Gyb', 'Mog', 'Pangur', 'Grimalkin', 'Puss', 'Tybalt', 'Sooty', 'Ginger', 'Minnie', 'Moll', 'Whisk', 'Tansy', 'Pepper', 'Ash', 'Tom'];
  function setup(game) {
    const PS = O.PlayerState, cur = () => O.SimRef.cur, abs = (s) => s.day * 1440 + s.minute;
    const pets = () => (O.fauna || []).filter((f) => f.kind === 'dog' || f.kind === 'cat');
    const mine = () => pets().filter((f) => f.owner === 'player');
    const nameFor = (k, used) => { const pool = k === 'cat' ? CAT : DOG; return pool.find((n) => !used.has(n)) || pool[Math.floor(Math.random() * pool.length)]; };
    // the town's dogs and cats find their households
    let seededFor = null;
    function settle(s) {
      if (seededFor === s.world.placeId || !O.fauna) return; seededFor = s.world.placeId;
      const used = new Set(pets().map((f) => f.name).filter(Boolean));
      for (const f of pets().filter((f) => f.world === s.world.placeId && f.owner == null && !f.stray)) {
        const cx = (f.z.x0 + f.z.x1) / 2, cy = (f.z.y0 + f.z.y1) / 2;
        const hh = s.households.filter((h) => !h.gone && h.home != null).map((h) => [h, s.building(h.home)]).filter(([, b]) => b && b.doorX != null).sort((a, b) => Math.hypot(a[1].doorX - cx, a[1].doorY - cy) - Math.hypot(b[1].doorX - cx, b[1].doorY - cy))[0];
        if (hh && Math.hypot(hh[1].doorX - cx, hh[1].doorY - cy) < 12) { f.owner = hh[0].id; f.home = hh[1].id; f.name = nameFor(f.kind, used); used.add(f.name); f.barn = null; }
        else { f.stray = true; f.barn = null; }
      }
      // a stray or two about the place
      if (!pets().some((f) => f.world === s.world.placeId && f.stray)) { const sq = s.world.zones && s.world.zones.square; if (sq) O.fauna.push({ world: s.world.placeId, kind: Math.random() < 0.6 ? 'dog' : 'cat', seed: Math.floor(Math.random() * 9999), z: { x0: sq[0], y0: sq[1], x1: sq[2], y1: sq[3] }, x: sq[0] * T + 20, y: sq[3] * T + 8, dir: 0, ft: 0, tx: null, wait: 2, speed: 11, stray: true, barn: null }); }
    }
    O.petLine = (s, q) => { const f = pets().find((x) => x.world === s.world.placeId && x.owner === q.household && x.name); return f ? `Your household keeps a ${f.kind} called ${f.name}.` : ''; };
    O.Pets = { mine, all: pets };

    // ---------------- moving: at heel, at home, or waiting ----------------
    game.hooks.update.push((dt) => {
      const s = cur(); if (!s || !O.fauna) return; settle(s);
      const P = game.player;
      for (const f of pets()) {
        if (f.world !== s.world.placeId) continue;
        // a master's dog walks with its master when they're out and near
        let tx = null, ty = null, fast = false;
        if (f.owner === 'player') {
          if (f.mode === 'heel') { if (game.scene) { f.hiddenIn = true; continue; } if (f.hiddenIn) { f.hiddenIn = false; f.x = P.x - 14; f.y = P.y + 4; } const d = Math.hypot(P.x - f.x, P.y - f.y); if (d > 26) { tx = P.x - 14; ty = P.y + 4; fast = d > 70; } if (d > 500) { f.x = P.x - 14; f.y = P.y + 4; } }
          else if (f.mode === 'home' && f.home != null) { const b = s.building(f.home); if (b && b.doorX != null) { const hx = b.doorX * T + 22, hy = (b.doorY + 1) * T; if (Math.hypot(hx - f.x, hy - f.y) > 30) { tx = hx; ty = hy; } } }
        } else if (f.owner != null) {
          const master = s.people.find((q) => q.household === f.owner && q.age >= 12 && !q.agent.hidden && q.agent.inside == null && Math.hypot(q.agent.x - f.x, q.agent.y - f.y) < 260);
          if (f.kind === 'dog' && master && (master.id + s.day) % 3 === 0) { const d = Math.hypot(master.agent.x - f.x, master.agent.y - f.y); if (d > 24) { tx = master.agent.x - 12; ty = master.agent.y + 4; fast = d > 60; } }
          // a stranger by the door gets barked at
          if (f.kind === 'dog' && !master && Math.hypot(P.x - f.x, P.y - f.y) < 46 && !game.scene && f._barked !== s.day * 24 + Math.floor(s.hour)) { f._barked = s.day * 24 + Math.floor(s.hour); O.Speech && O.Speech.say(f, 'Woof! Woof!', 1.6); }
        }
        if (tx != null) {
          f.petMove = true; f.moving = true; const dx = tx - f.x, dy = ty - f.y, d = Math.hypot(dx, dy), sp = (fast ? 105 : 55) * dt;
          const nx = f.x + dx / d * Math.min(sp, d), ny = f.y + dy / d * Math.min(sp, d);
          if (!game.solidAt(nx, ny)) { f.x = nx; f.y = ny; } else if (!game.solidAt(nx, f.y)) f.x = nx; else if (!game.solidAt(f.x, ny)) f.y = ny;
          f.dir = O.dirOf(dx, dy);
          f.z = { x0: Math.floor(f.x / T) - 1, y0: Math.floor(f.y / T) - 1, x1: Math.floor(f.x / T) + 1, y1: Math.floor(f.y / T) + 1 };
        } else if (f.petMove) { f.moving = false; if (f.owner === 'player' && f.mode !== 'heel') f.petMove = false; else if (f.owner !== 'player') f.petMove = false; }
      }
    });

    // ---------------- E on a dog or cat ----------------
    const near = () => { const P = game.player; if (game.scene) return null; let best = null, bd = 28; for (const f of pets()) { if (f.world !== cur()?.world.placeId || f.inBarn) continue; const d = Math.hypot(f.x - P.x, f.y - P.y); if (d < bd) { bd = d; best = f; } } return best; };
    (O.moreCandidates = O.moreCandidates || []).push(() => {
      const f = near(); if (!f) return null; const s = cur();
      if (f.owner === 'player') return { type: 'custom', d: 0, x: f.x, y: f.y - 30, label: f.name || 'Your ' + f.kind, act: () => menu(f) };
      if (f.stray) { const food = PS.items.find((k) => ['bread', 'meat', 'sausage', 'fish', 'cheese'].includes(k)); return { type: 'custom', d: 0, x: f.x, y: f.y - 30, label: food ? `Share your ${(O.Data.GOODS[food]?.name || food).toLowerCase()} with the ${f.kind}` : `A stray ${f.kind}`, act: () => { if (!food) return O.Speech && O.Speech.say(f, f.kind === 'dog' ? 'Whine...' : 'Mew?', 1.6); PS.remove(food, 1); adopt(s, f); } }; }
      const own = s.households.find((h) => h.id === f.owner); return { type: 'custom', d: 0, x: f.x, y: f.y - 30, label: `Pat ${f.name || 'the ' + f.kind}${own ? ` (the ${own.surname}s')` : ''}`, act: () => { O.Speech && O.Speech.say(f, f.kind === 'dog' ? '♥' : 'Purr...', 1.4); } };
    });
    function adopt(s, f, from) {
      f.owner = 'player'; f.stray = false; f.mode = 'heel'; f.barn = null; f.petMove = true; f.bond = 0.3; f.home = null; f.adopted = s.day;
      O.Speech && O.Speech.say(f, f.kind === 'dog' ? 'Woof!' : 'Mrrp.', 1.4);
      setTimeout(() => nameIt(f, from), 600);
    }
    function nameIt(f, from) {
      O.Panels.open(f.kind === 'dog' ? 'A dog of your own' : 'A cat of your own', `<p>${from ? `${O.escape(from)} gives you ${f.kind === 'dog' ? 'a pup' : 'a kitten'}.` : `The ${f.kind} has taken to you.`} What will you call ${f.kind === 'dog' ? 'it' : 'it'}?</p><input type="text" data-n maxlength="14" placeholder="${nameFor(f.kind, new Set())}" style="width:100%"><div class="topics" style="margin-top:8px"><button data-ok>That's its name</button></div>`, (r) => {
        const i = r.querySelector('[data-n]'); i.focus();
        const ok = () => { const v = (i.value || i.placeholder).trim().replace(/[^A-Za-z' -]/g, '').slice(0, 14); f.name = v ? v[0].toUpperCase() + v.slice(1) : i.placeholder; O.Panels.close(); };
        r.querySelector('[data-ok]').onclick = ok; i.onkeydown = (e) => { if (e.key === 'Enter') ok(); };
      });
    }
    function menu(f) {
      const s = cur(), home = s.world.buildings.find((b) => b.owner?.kind === 'player') || (PS.lease && s.building(PS.lease.b)) || (PS.partner && PS.partner.stage === 'married' && s.byId.get(PS.partner.id) && s.building(s.byId.get(PS.partner.id).home));
      O.Panels.open(f.name || 'Your ' + f.kind, `<div class="topics"><button data-m="heel">Come along</button><button data-m="stay">Stay here</button>${home ? '<button data-m="home">Go home and keep watch</button>' : ''}<button data-m="pat">Pat ${f.kind === 'dog' ? 'him' : 'her'}</button>${f.kind === 'dog' ? '<button data-m="sit">Sit!</button>' : ''}<button data-m="name">Call ${f.kind === 'dog' ? 'him' : 'her'} something else</button>${(O.petExtra ? O.petExtra(f) : []).map(([k, l]) => `<button data-m="${k}">${l}</button>`).join('')}</div>`, (r) => {
        r.querySelectorAll('[data-m]').forEach((b) => b.onclick = () => { const m = b.dataset.m; O.Panels.close();
          if (m === 'heel') { f.mode = 'heel'; f.petMove = true; }
          if (m === 'stay') { f.mode = 'stay'; f.petMove = true; f.moving = false; }
          if (m === 'home' && home) { f.mode = 'home'; f.home = home.id; f.petMove = true; }
          if (m === 'pat') { f.bond = Math.min(1, (f.bond || 0) + 0.05); O.Speech && O.Speech.say(f, '♥', 1.4); }
          if (m === 'sit') { const ok = Math.random() < 0.3 + (f.bond || 0) * 0.7; O.Speech && O.Speech.say(f, ok ? '(sits, tail wagging)' : '(cocks its head)', 1.8); if (ok) f.bond = Math.min(1, (f.bond || 0) + 0.03); }
          if (m === 'name') nameIt(f);
          if (O.petDo) O.petDo(f, m);
        });
      });
    }
    // a pup or kitten from someone who has one to spare, given in talk
    const base = O.NpcActs.apply;
    O.NpcActs.apply = function (s, q, a, main) {
      if (a && a.do === 'give_pet') {
        const theirs = pets().find((f) => f.world === s.world.placeId && f.owner === q.household); if (!theirs || mine().length >= 3) return null;
        const young = { world: s.world.placeId, kind: theirs.kind, seed: Math.floor(Math.random() * 9999), z: { x0: 0, y0: 0, x1: 0, y1: 0 }, x: q.agent.x + 10, y: q.agent.y + 4, dir: 0, ft: 0, tx: null, wait: 1, speed: 11, barn: null };
        O.fauna.push(young); adopt(s, young, q.first); return null;
      }
      return base.apply(this, arguments);
    };
    // ---------------- your horse comes when you whistle ----------------
    window.addEventListener('keydown', (e) => {
      if (e.code !== 'KeyH' || e.repeat || game.player.mount || O.panelOpen || /INPUT|TEXTAREA/.test((document.activeElement || {}).tagName || '')) return;
      const s = cur(), P = game.player; if (!s || game.scene) return;
      const hs = (O.horsesAll ? O.horsesAll() : []).filter((h) => h.owner === 'player' && (h.world || 'ashford') === s.world.placeId && !h.stabled);
      const near0 = hs.find((h) => Math.hypot(h.x - P.x, h.y - P.y) < 26); if (near0 || !hs.length) return;
      const h = hs.sort((a, b) => Math.hypot(a.x - P.x, a.y - P.y) - Math.hypot(b.x - P.x, b.y - P.y))[0];
      if (Math.hypot(h.x - P.x, h.y - P.y) > 900) return;
      h.called = abs(s); h.tied = false; O.Speech && O.Speech.say(game.player, '(you whistle)', 1.4);
    }, true);
    game.hooks.update.push((dt) => {
      const P = game.player; if (game.scene || !O.horsesAll) return;
      for (const h of O.horsesAll()) { if (!h.called || h === P.mount) continue; const dx = P.x + 18 - h.x, dy = P.y - h.y, d = Math.hypot(dx, dy); if (d < 20) { h.called = null; h.anim = 'idle'; continue; } const sp = 90 * dt, nx = h.x + dx / d * sp, ny = h.y + dy / d * sp; if (!game.solidAt(nx, ny)) { h.x = nx; h.y = ny; } else if (!game.solidAt(nx, h.y)) h.x = nx; else if (!game.solidAt(h.x, ny)) h.y = ny; h.dir = O.dirOf(dx, dy) % 4; h.anim = 'walk'; h.tx = null; }
    });
  }
  O.PetsSetup = { setup };
})();
