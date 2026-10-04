// The street comes to you. A tax collector who's seen you sprints over and wants the town's dues (only
// if you keep a house or hold a post here); a landlord wants the rent you owe; a beggar asks for a
// penny; and in a crowd someone may lift your purse. When anyone runs at you, you start back.
// In the woods there's game: deer and rabbits. Take one where a gamekeeper can see and it's poaching.
// At night the poaching gangs go after the lords' deer, and the gamekeepers go after them.
'use strict';
(function () {
  const T = 16;
  function setup(game, home) {
    const PS = O.PlayerState, cur = () => O.SimRef.cur, say = (t, k) => O.UI.say(t, k), G = O.Data.GOODS;
    const shock = () => { const p = game.player; if (!p.moving && !game.player.locked) { p.anim = 'shocked'; p.ft = 0; setTimeout(() => { if (p.anim === 'shocked') p.anim = 'idle'; }, 900); } };

    // ---------------- someone running up to you ----------------
    let runner = null; // { q, why, t }
    function sendAt(q, why) {
      if (runner || O.panelOpen || game.scene) return;
      const a = q.agent; a.chasing = true; a.path = null; a.sprint = true;
      runner = { q, why, t: 0 }; shock();
      if (why === 'tax' || why === 'rent' || why === 'debt') say(`${q.first} spots you and comes running.`); else if (why === 'letter') say(`${q.first} hurries over with a letter.`);
    }
    function release() { if (!runner) return; const a = runner.q.agent; a.chasing = false; a.sprint = false; a.frozen = false; a.path = null; a.goal = null; runner = null; }
    game.hooks.update.push((dt) => {
      if (!runner) return;
      const s = cur(), q = runner.q, a = q.agent, p = game.player;
      runner.t += dt;
      if (game.scene || q.alive === false || a.hidden || runner.t > 25 || s.world !== game.world) { release(); return; }
      const dx = p.x - a.x, dy = p.y - a.y, d = Math.hypot(dx, dy);
      if (d > 20) { // running to you by the streets and the bridge, never across the water
        runner.rp = (runner.rp || 0) - dt;
        if (runner.rp <= 0 || !runner.path) { runner.rp = 0.6; runner.path = s.path.find(Math.floor(a.x / T), Math.floor((a.y - 1) / T), Math.floor(p.x / T), Math.floor((p.y - 1) / T)) || []; runner.pi = 0; }
        let budget = 95 * dt;
        while (budget > 0) {
          let tx, ty; if (runner.pi < runner.path.length) { const [px, py] = runner.path[runner.pi]; tx = px * T + 8; ty = py * T + 10; } else { tx = p.x; ty = p.y; }
          const ex = tx - a.x, ey = ty - a.y, ed = Math.hypot(ex, ey);
          if (ed <= budget) { a.x = tx; a.y = ty; budget -= ed; if (runner.pi < runner.path.length) runner.pi++; else break; } else { a.x += ex / ed * budget; a.y += ey / ed * budget; budget = 0; }
          if (ed > 0.01) a.dir = O.dirOf(ex, ey);
          if (Math.hypot(p.x - a.x, p.y - a.y) <= 20) break;
        }
        a.anim = 'run'; return;
      }
      a.anim = 'talk'; a.frozen = true; a.dir = O.dirOf(dx, dy);
      const why = runner.why; release(); a.frozen = true;
      demand(s, q, why);
    });
    function demand(s, q, why) {
      const done = (t, bad) => { O.Panels.close(); q.agent.frozen = false; if (t) say(t, bad ? 'bad' : ''); };
      if (why === 'tax') {
        const due = 4 + Math.round(s.treasury.taxRate * 40) + (PS.taxOwed || 0);
        if (PS.money >= due) PS.taxOwed = 0;
        taxPending = { s, q };
        O.Panels.open(`${q.name}, tax collector`, `<p class="speech">“The town's dues, if you please: ₳${due}. Everyone with a roof here or a wage here pays.”</p><div class="topics"><button data-a="pay">Pay ₳${due}</button><button data-a="refuse">Refuse</button><button data-a="run">Run</button></div>`, (r) => {
          r.querySelector('[data-a=pay]').onclick = () => { taxPending = null; PS.taxPaidDay = s.day; if (PS.money < due) { PS.taxOwed = (PS.taxOwed || 0) + due; return done(`You turn out your purse: ₳${PS.money}. ${q.first} writes you down as owing ₳${PS.taxOwed}, to be paid next week.`, true); } PS.money -= due; s.treasury.cash += due; done(`You pay ₳${due}. ${q.first} marks it in the book.`); };
          r.querySelector('[data-a=refuse]').onclick = () => { taxPending = null; s.relate(q, { id: 0 }, -0.15); evade(s, q, 'refusing the town its dues'); done(`${q.first}: “Then the watch will have a word.”`, true); };
          r.querySelector('[data-a=run]').onclick = () => { taxPending = null; evade(s, q, 'running from the tax collector'); done('You run for it.', true); };
        });
      } else if (why === 'rent') {
        const L = PS.lease, due = (L && L.rent) || 4;
        O.Panels.open(`${q.name}, your landlord`, `<p class="speech">“The rent, ₳${due}. It's owed.”</p><div class="topics"><button data-a="pay">Pay ₳${due}</button><button data-a="refuse">I can't</button></div>`, (r) => {
          r.querySelector('[data-a=pay]').onclick = () => { if (PS.money < due) return done('You haven\'t got it.', true); PS.money -= due; const hh = s.household(q); if (hh) hh.money += due; if (L) L.paidUntil = s.day + 7; done(`You pay ₳${due} of rent.`); };
          r.querySelector('[data-a=refuse]').onclick = () => { if (L) { L.owed = (L.owed || 0) + 1; if (L.owed >= 2) { PS.lease = null; done(`${q.first}: “Then you're out. I'll have the bailiff clear your things.”`, true); return; } } s.relate(q, { id: 0 }, -0.2); done(`${q.first}: “One more week. Then you're out.”`, true); };
        });
      } else if (why === 'beg') {
        O.Panels.open(q.name, `<p class="speech">“An aurin, for bread? God bless you.”</p><div class="topics"><button data-a="give">Give an aurin</button><button data-a="no">Not today</button></div>`, (r) => {
          r.querySelector('[data-a=give]').onclick = () => { if (PS.money >= 1) { PS.money -= 1; s.household(q).money += 1; s.relate(q, { id: 0 }, 0.2); PS.rep.civilian = Math.min(1, PS.rep.civilian + 0.01); } done(`${q.first} blesses you.`); };
          r.querySelector('[data-a=no]').onclick = () => done(`${q.first} turns away.`);
        });
      } else if (extra[why]) extra[why](s, q, done);
      else q.agent.frozen = false;
    }
    const extra = {};
    O.Street = { sendAt, busy: () => !!runner, on: (why, fn) => { extra[why] = fn; } };
    // refuse the collector, run, or just walk off, and they go straight to the watch, and the watch comes for you
    let taxPending = null;
    game.hooks.update.push(() => { if (taxPending && !O.panelOpen) { const { s, q } = taxPending; taxPending = null; q.agent.frozen = false; evade(s, q, 'walking off from the tax collector'); say(`${q.first}: "Walk away from the crown's dues, would you? Watch!"`, 'bad'); } });
    function evade(s, q, what) {
      PS.taxPaidDay = s.day;
      const c = s.recordCrime && s.recordCrime({ kind: 'tax evasion', perp: 'player', placeName: O.placeName ? O.placeName() : s.world.name, tile: [Math.floor(game.player.x / T), Math.floor(game.player.y / T)], seen: [q], severity: 1 });
      if (!c) return;
      PS.crimes.push(c.id); c.reported = true;
      s.log(`${q.name} reports the stranger for ${what}.`, 'crime');
      const p = game.player, awake = (g) => g.job?.role?.startsWith('guard') && !g.agent.hidden && g.alive !== false && g.activity?.act !== 'sleep' && !g.health?.illness;
      const g = s.people.filter(awake).sort((a, b) => Math.hypot(a.agent.x - p.x, a.agent.y - p.y) - Math.hypot(b.agent.x - p.x, b.agent.y - p.y))[0];
      let told = false;
      const tell = () => { if (told) return; told = true; if (g && !g.agent.hidden) say(`${q.first} points you out to ${g.first} of the watch.`, 'bad'); O.lawReport && O.lawReport(c, g); };
      if (!g) return tell();
      const sent = O.Errands && O.Errands.send(s, q, [Math.floor(g.agent.x / T), Math.floor((g.agent.y - 1) / T)], { anim: 'talk', secs: 2, face: 0, at: tell, after: tell, giveUp: game.t + 25, sprint: true });
      if (!sent) tell();
    }
    // who comes looking for you, and when
    let st = 0;
    game.hooks.update.push((dt) => {
      st -= dt; if (st > 0 || runner || game.scene || O.panelOpen) return; st = 2;
      const s = cur(), p = game.player; if (s.world !== game.world) return;
      const near = (q) => !q.agent.hidden && q.alive !== false && !q.agent.frozen && Math.hypot(q.agent.x - p.x, q.agent.y - p.y) < 220;
      const h = s.hour;
      // the tax collector, once a week, if you've a house or a post in this town
      const mine = (PS.posts || []).filter((e) => e.place === s.world.placeId);
      const exempt = PS.royal || (PS.posts || []).some((e) => O.crownPost && O.crownPost(e.role)) || mine.some((e) => (O.crownPost && O.crownPost(e.role)) || (() => { const bz = s.biz.get(e.biz); return bz && (bz.def.public || bz.type === 'palace' || bz.b?.royal); })()); // the crown and its servants pay no tax
      const liable = !exempt && (mine.length || s.world.buildings.some((b) => b.owner?.kind === 'player'));
      if (liable && h >= 9 && h < 17 && (PS.taxPaidDay == null || s.day - PS.taxPaidDay >= 7)) { const q = s.people.find((x) => x.job?.role === 'tax collector' && near(x)); if (q) return sendAt(q, 'tax'); }
      // the landlord, if the rent's due
      const L = PS.lease; if (L && L.place === s.world.placeId && (L.paidUntil == null || s.day > L.paidUntil) && h >= 8 && h < 20) { const b = s.building(L.b); const landlord = b && b.owner?.kind === 'household' ? s.households[b.owner.id - 1]?.members.map((id) => s.byId.get(id)).find((x) => x && x.age >= 18 && near(x)) : null; if (landlord) return sendAt(landlord, 'rent'); }
      // the poor ask for a penny
      if (h >= 8 && h < 19 && s.rng.chance(0.08)) { const q = s.people.find((x) => !x.job && x.age >= 16 && s.household(x).money < 8 && x.needs.hunger < 40 && near(x) && x._begDay !== s.day); if (q) { q._begDay = s.day; return sendAt(q, 'beg'); } }
      // a cutpurse in the crowd
      const crowd = s.people.filter((x) => !x.agent.hidden && Math.hypot(x.agent.x - p.x, x.agent.y - p.y) < 50).length;
      if (crowd >= 4 && PS.money > 5 && s.rng.chance(0.04)) {
        const thief = s.people.find((x) => x.gang && x.gang !== 'player' && Math.hypot(x.agent.x - p.x, x.agent.y - p.y) < 70);
        if (thief) { const took = Math.min(PS.money, 2 + s.rng.int(0, 6)); const noticed = s.rng.chance(0.4 + (PS.skills?.stealth || 0) * 0.5); PS.money -= took; s.household(thief).money += took; if (noticed) { shock(); say(`A hand in your purse! ${thief.first} slips away with ₳${took}.`, 'bad'); thief.agent.fleeing = true; } }
      }
    });

    // ---------------- game in the woods ----------------
    const wild = new Map(); // placeId -> spawned
    game.hooks.update.push(() => {
      const w = game.world; if (!w || !w.island || wild.has(w.placeId) || !O.fauna) return;
      wild.set(w.placeId, true);
      const r = O.RNG(O.hash('wild', w.placeId)), Wd = w.W;
      let made = 0;
      for (let k = 0; k < 400 && made < 10; k++) {
        const x = r.int(4, w.W - 5), y = r.int(4, w.H - 5);
        if (w.ter[y * Wd + x] !== w.TER.FOREST || w.solid[y * Wd + x]) continue;
        if (x >= w.ox && y >= w.oy && x < w.ox + w.townW && y < w.oy + w.townH) continue;
        const kind = r.chance(0.45) ? 'deer' : 'rabbit', z = { x0: x - 4, y0: y - 3, x1: x + 4, y1: y + 3 };
        O.fauna.push({ world: w.placeId, kind, seed: r.int(1, 9999), z, x: x * T + 8, y: y * T + 12, dir: r.int(0, 7), ft: r.next() * 2, tx: null, wait: r.next() * 4, speed: kind === 'deer' ? 16 : 18, wild: true });
        made++;
      }
    });
    O.Combat && O.Combat.addTargets(() => (O.fauna || []).filter((f) => f.wild && !f.dead && f.world === game.world.placeId).map((f) => ({ x: f.x, y: f.y, hit: () => {
      f.dead = true; O.fauna.splice(O.fauna.indexOf(f), 1);
      const s = cur(), g = f.kind === 'deer' ? 'venison' : 'meat';
      s.drop(g, 1, f.x, f.y);
      O.Bus && O.Bus.emit('poach', { kind: f.kind, sim: s });
      // a lord's game: is a gamekeeper or forester about?
      const keeper = s.people.find((q) => ['gamekeeper', 'forester'].includes(q.job?.role) && !q.agent.hidden && Math.hypot(q.agent.x - f.x, q.agent.y - f.y) < 260);
      if (keeper || (f.kind === 'deer' && s.rng.chance(0.15))) {
        const c = s.recordCrime({ kind: 'poaching', perp: 'player', placeName: O.placeName ? O.placeName() : 'the woods', tile: [Math.floor(f.x / T), Math.floor(f.y / T)], seen: keeper ? [keeper] : [], severity: f.kind === 'deer' ? 2 : 1 });
        if (c) PS.crimes.push(c.id);
        say(keeper ? `${keeper.first} the ${keeper.job.role} saw that! Poaching the lord's ${f.kind === 'deer' ? 'deer' : 'game'}.` : 'You take the deer. Somewhere a twig snaps.', 'bad');
      } else say(`You bring down the ${f.kind}. Its meat lies on the ground.`);
    } })));

    // ---------------- poachers and gamekeepers, at night ----------------
    const SP = O.Sim.prototype, _night = SP.gangNight;
    SP.gangNight = function () {
      _night.call(this);
      const lodge = [...this.biz.values()].find((b) => b.type === 'lodge'); if (!lodge) return;
      for (const g of this.npcGangs ? this.npcGangs() : []) {
        if (g.speciality !== 'poaching' || !g.members.length || !this.rng.chance(0.3)) continue;
        const p = this.byId.get(this.rng.pick(g.members).id); if (!p || p.jailUntil) continue;
        const keeper = lodge.workers.map((id) => this.byId.get(id)).find((q) => q && q.job?.role === 'gamekeeper');
        if (keeper && this.rng.chance(0.35)) {
          const crime = this.recordCrime({ kind: 'poaching', perp: p, gang: g.id, placeName: lodge.name, tile: [lodge.b.doorX, lodge.b.doorY], seen: [keeper], severity: 1 });
          this.arrestNPC && this.arrestNPC(p, crime, false);
          this.log(`${keeper.name} the gamekeeper caught ${p.name} with a snared deer.`, 'crime');
        } else { g.purse += 6; lodge.stock.venison = Math.max(0, (lodge.stock.venison || 0) - 0.5); }
      }
    };
  }
  O.StreetSetup = { setup };
})();
