// Holding down a job. Ask whoever runs a place for work (at work or not; they may say no). Once taken
// on you have a post, a wage, hours and a master. Your shift shows in the corner, and while you're on
// it so do your tasks: the real work of the trade, which takes time and keeps the place going. Bake
// the bread at the oven, keep its fire fed, fetch flour from the mill with the business's own money,
// serve whoever comes to the counter, sweep, patrol, hoe, fell, fish, carry, collect the tax...
// Come late and your master notices; miss a day and they mind more; send a letter if you can't come.
// Turn up and work well and you'll be put up a rank and paid more. Slack, and one day you'll find
// you don't work there any more, sometimes without anyone telling you.
'use strict';
(function () {
  const T = 16;
  function setup(game, home, npcUI) {
    const PS = O.PlayerState, D = O.Data, say = (t, k) => O.UI.say(t, k), cur = () => O.SimRef.cur;
    const now = (s) => s.day * 1440 + s.minute;
    const emp = () => PS.emp || null;
    const here = () => { const e = emp(); return e && e.place === cur().world.placeId ? e : null; };
    const bizOf = (e) => { const s = cur(); return e && e.place === s.world.placeId ? s.biz.get(e.biz) : null; };
    const hoursOf = (e, bz) => { const r = e.role; if (['night watchman', 'gaoler'].includes(r)) return [20, 30]; if (r.startsWith('guard') || r === 'sergeant') return [6, 18]; return bz ? bz.def.hours : [8, 17]; };
    const worksToday = (s, bz) => !(s.weekday === 6 && bz && !['tavern', 'chapel', 'guard', 'hospital', 'palace', 'keep', 'manor', 'posthouse'].includes(bz.type));
    const fmtH = (h) => { h = ((h % 24) + 24) % 24; const hh = Math.floor(h), mm = Math.round((h - hh) * 60); return `${hh % 12 || 12}${mm ? ':' + String(mm).padStart(2, '0') : ''}${hh < 12 ? 'am' : 'pm'}`; };

    // ---------------------------------------------------------------- asking for work
    const prevExtra = npcUI.extraButtons, prevOn = npcUI.onExtra;
    npcUI.extraButtons = (q) => {
      const out = (prevExtra ? prevExtra(q) : []).filter(([k]) => k !== 'askwork' && k !== 'quit');
      const s = cur(), bz = q.job?.biz != null ? s.biz.get(q.job.biz) : null;
      if (bz && s.bossOf && s.bossOf(bz) === q) {
        const e = emp();
        if (e && e.biz === bz.id && e.place === s.world.placeId) out.push(['notice', 'Hand in your notice']);
        else out.push(['askjob', `Ask for work at ${bz.name}`]);
      }
      return out;
    };
    npcUI.onExtra = (q, key, render) => {
      if (key === 'askjob') return offer(q, render);
      if (key === 'notice') { quit('You hand in your notice.'); cur().remember(q, 'The stranger left my service.', 'work', 1); return render('Very well. I wish you luck.'); }
      return prevOn && prevOn(q, key, render);
    };
    function offer(q, render) {
      const s = cur(), bz = s.biz.get(q.job.biz);
      const d = s.hireDecision(bz, q, 'player');
      if (!d.yes) return render(d.why === 'bad' ? "Work? For you? I know what's said of you. No." : d.why === 'dislike' ? "I'll not take you on. Try elsewhere." : "I've all the hands I need just now.");
      const e = emp();
      if (e && !(e.biz === bz.id && e.place === s.world.placeId)) { /* they'd leave their other post */ }
      const [o, c] = hoursOf({ role: d.role }, bz);
      npcUI.closeTalk && npcUI.closeTalk();
      O.Panels.open(`Work at ${bz.name}`, `<p class="speech">“I could use a ${d.role}. ${d.wage}d a day, ${fmtH(o)} till ${fmtH(c)}${['tavern', 'chapel', 'guard', 'hospital'].includes(bz.type) ? ', every day' : ', Sundays off'}. Will you take it?”</p>${e ? `<p class="caption">You'd give up your post as ${esc(e.role)} at ${esc(e.bizName)}.</p>` : ''}<div class="topics"><button data-y="1">Take the job</button><button data-n="1">Not now</button></div>`, (r) => {
        r.querySelector('[data-n]').onclick = () => O.Panels.close();
        r.querySelector('[data-y]').onclick = () => { if (e) quit(null); hire(s, bz, q, d.role, d.wage); O.Panels.close(); say(`You're taken on as ${d.role} at ${bz.name}. Your first shift is ${worksToday(s, bz) && s.hour < c ? 'today' : 'tomorrow'} at ${fmtH(o)}.`); };
      });
      return null;
    }
    const esc = (t) => O.escape(String(t));
    function hire(s, bz, boss, role, wage, extra) {
      bz.playerRole = role;
      PS.emp = Object.assign({ place: s.world.placeId, placeName: s.world.name, biz: bz.id, bizName: bz.name, role, wage, master: boss ? boss.id : null, masterName: boss ? boss.name : 'the crown', since: s.day,
        stats: { shifts: 0, late: 0, missed: 0, tasks: 0, excused: 0 }, day: null, tasks: [], level: 0 }, extra || {});
      if (boss) { s.relate(boss, { id: 0 }, 0.05); s.remember(boss, `Took the stranger on as ${role}.`, 'work', 1.2, 0); }
      O.Chronicle && O.Chronicle.deed(s, `A newcomer has been taken on as ${role} at ${bz.name}.`, `You were taken on as ${role} at ${bz.name}.`, 'player', 1, true);
    }
    function quit(msg) { const e = emp(); if (!e) return; const s = cur(); const bz = s.world.placeId === e.place ? s.biz.get(e.biz) : null; if (bz && bz.playerRole === e.role) bz.playerRole = null; PS.emp = null; PS.carry = null; if (msg) say(msg); }
    O.Employment = { emp, hire, quit, here };

    // ---------------------------------------------------------------- tasks
    const MAKERS = new Set(Object.keys(D.ROLE_ACTION));
    const ROLE_KIND = (role) => {
      if (['guard', 'sergeant', 'royal guard', 'captain of the royal guard', 'night watchman', 'gamekeeper', 'bounty hunter', 'knight', 'toll keeper', 'squire', 'spy', 'falconer'].includes(role)) return 'patrol';
      if (['farmhand', 'farmer', 'shepherd', 'vine-dresser', 'beekeeper', 'gardener', 'peat cutter', 'clay digger', 'dairymaid', 'maltster'].includes(role)) return 'field';
      if (['woodcutter', 'forester', 'charcoal burner'].includes(role)) return 'chop';
      if (['fisher', 'ferryman', 'salt boiler'].includes(role)) return 'fish';
      if (['tax collector', 'bailiff', 'market warden'].includes(role)) return 'collect';
      if (['messenger', 'mounted courier', 'carter', 'porter', 'docker', 'warehouse worker', 'page', 'herald', 'town crier', 'labourer', 'bearer', 'water carrier'].includes(role)) return 'deliver';
      if (['maid', 'scullion', 'chambermaid', 'potboy', 'laundress', 'sweeper', 'undertaker', 'chimney sweep', 'rat-catcher', 'lamplighter', 'groom', 'stablehand', 'gravedigger'].includes(role)) return 'sweep';
      if (['shopkeeper', 'server', 'innkeeper', 'postmaster', 'horse trader', 'butler'].includes(role)) return 'serve';
      if (['priest', 'bell-ringer', 'pilgrim guide'].includes(role)) return 'service';
      if (['teacher'].includes(role)) return 'teach';
      if (['physician', 'nurse', 'midwife', 'barber-surgeon'].includes(role)) return 'tend';
      if (['clerk', 'scribe', 'magistrate', 'steward', 'chamberlain', 'moneylender', 'house agent', 'parish clerk', 'ballot clerk', 'guard captain', 'warehouse master', 'mine foreman', 'quarry master', 'master builder', 'master of horse'].includes(role)) return 'write';
      if (['monarch', 'consort', 'lord', 'lady', 'heir', 'prince', 'princess', 'lady-in-waiting', 'jester', 'executioner'].includes(role)) return 'court';
      return 'make';
    };
    const recipeFor = (bz, role) => bz.def.recipes.find((rc) => rc.role === role) || bz.def.recipes.find((rc) => !rc.role) || bz.def.recipes[0] || null;
    const supplierFor = (s, bz, g) => { const opts = String(bz.def.buys?.[g] || '').split('|').filter((t) => t && t !== 'import' && t !== 'none'); for (const t of opts) { const sp = s.supplierOf(t, g); if (sp && sp.id !== bz.id && (sp.stock[g] || 0) >= 1) return sp; } return null; };
    function newTasks(s, bz, e) {
      const kind = ROLE_KIND(e.role), out = [], id = () => Math.random().toString(36).slice(2, 8);
      const n = 3;
      if (kind === 'make') { const rc = recipeFor(bz, e.role); if (rc) { const g = Object.keys(rc.out)[0]; out.push({ id: id(), kind: 'make', good: g, need: n, have: 0, text: `Make ${D.GOODS[g]?.name.toLowerCase() || g}` }); } else out.push({ id: id(), kind: 'sweep', need: n, have: 0, text: 'Tidy and sweep the place' }); }
      else if (kind === 'serve') out.push({ id: id(), kind: 'serve', need: n, have: 0, text: bz.type === 'tavern' ? 'Take orders and serve at the counter' : 'Serve at the counter' });
      else out.push({ id: id(), kind, need: n, have: 0, text: { patrol: 'Walk your beat', field: 'Work the ground', chop: 'Fell and cut timber', fish: 'Fish the water', collect: 'Collect what is owed', deliver: 'Carry goods where they are wanted', sweep: 'Clean and sweep', service: 'Lead the prayers', teach: 'Teach the children', tend: 'Tend the sick', write: 'Keep the books', court: 'Hold court' }[kind] || 'Work' });
      // a fire to keep in
      if (bz.def.recipes.some((rc) => rc.inp.firewood) || ['bakery', 'smithy', 'tavern', 'kitchen'].includes(bz.type)) out.push({ id: id(), kind: 'fire', need: 1, have: 0, text: 'Keep the fire fed' });
      // the innkeeper looks over the rooms
      if (e.role === 'innkeeper') out.push({ id: id(), kind: 'rooms', need: 1, have: 0, text: 'Look over the rooms upstairs' });
      // fetch what's running short, with the business's money
      for (const [g, t] of Object.entries(bz.def.targets || {})) {
        if (out.filter((x) => x.kind === 'fetch').length >= 1 || !bz.def.buys?.[g]) continue;
        if ((bz.stock[g] || 0) < t * 0.35) { const sp = supplierFor(s, bz, g); if (sp) { const qty = Math.min(6, Math.ceil(t * 0.5 - (bz.stock[g] || 0))); out.push({ id: id(), kind: 'fetch', good: g, qty, from: sp.id, fromName: sp.name, need: 1, have: 0, text: `Buy ${qty} ${D.GOODS[g]?.name.toLowerCase() || g} at ${sp.name} (from the business purse)` }); } }
      }
      return out;
    }

    // where a task is done (in the current world or the workplace scene); returns candidates for the player
    function spotsFor(t, s, bz, e) {
      const w = s.world, b = bz.b, inScene = game.scene && game.scene.b.id === bz.id;
      const near = (n, r0, r1, ok) => { const out = []; const rr = O.RNG(O.hash(t.id, s.day)); for (let k = 0; k < 120 && out.length < n; k++) { const a = rr.next() * 6.28, d = rr.float(r0, r1), x = Math.round(b.doorX + Math.cos(a) * d), y = Math.round(b.doorY + 1 + Math.sin(a) * d); if (x < 1 || y < 1 || x >= w.W - 1 || y >= w.H - 1 || w.solid[y * w.W + x]) continue; if (ok && !ok(x, y)) continue; out.push([x * T + 8, y * T + 10]); } return out; };
      if (t._spots && t._day === s.day) return t._spots;
      let spots = null;
      switch (t.kind) {
        case 'patrol': { const Z = w.zones || {}, k0 = s.day % 3; spots = bz.type === 'guard' && Z.patrol && Z.patrol.length >= k0 + 3 ? Z.patrol.slice(k0, k0 + 3).map(([x, y]) => [x * T + 8, y * T + 10]) : near(3, 8, 26); break; }
        case 'field': spots = near(3, 3, 10, (x, y) => w.ter[y * w.W + x] !== w.TER.ROAD); break;
        case 'chop': spots = near(3, 3, 14, (x, y) => w.trees.some((tr) => Math.abs(tr.x / T - x) < 2 && Math.abs((tr.y - 1) / T - y) < 2)); if (spots.length < 3) spots = near(3, 3, 10); break;
        case 'fish': spots = near(3, 2, 20, (x, y) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => w.ter[(y + dy) * w.W + x + dx] === w.TER.WATER)); if (spots.length < 1) spots = near(3, 3, 8); break;
        case 'collect': spots = w.buildings.filter((x) => x.type === 'house' && x.household && x.doorX != null).sort((a, c) => (a.id * 7 + s.day) % 13 - (c.id * 7 + s.day) % 13).slice(0, 3).map((x) => [x.doorX * T + 8, (x.doorY) * T + 10, x.id]); break;
        case 'deliver': { const tg = [...s.biz.values()].filter((x) => x.id !== bz.id && x.b.doorX != null).sort((a, c) => (a.id * 3 + s.day) % 11 - (c.id * 3 + s.day) % 11).slice(0, 3); spots = tg.map((x) => [x.b.doorX * T + 8, x.b.doorY * T + 10, x.id]); break; }
        case 'fetch': { const sp = s.biz.get(t.from); spots = sp ? [[sp.b.doorX * T + 8, sp.b.doorY * T + 10, sp.id]] : []; break; }
        default: spots = null; // done indoors at a station
      }
      if (spots) { t._spots = spots; t._day = s.day; }
      return spots;
    }
    // indoor stations by task
    function stationOk(t, it, e) {
      switch (t.kind) {
        case 'make': return !!(it.work && (it.work.includes(e.role) || it.work.length)) || ['anvil', 'workbench', 'millstone', 'oven', 'forge', 'kiln', 'vat', 'loom', 'spinning', 'doughtable', 'butcherblock', 'cauldron'].includes(it.kind);
        case 'fire': return ['oven', 'forge', 'kiln', 'fireplace'].includes(it.kind);
        case 'serve': return !!(it.counter || it.kind === 'bar');
        case 'sweep': return it.kind !== 'stairs' && !it.partition;
        case 'service': return it.kind === 'altar';
        case 'teach': case 'write': return it.kind === 'desk' || it.kind === 'altar';
        case 'tend': return it.kind === 'medbed' || it.kind === 'desk' || it.kind === 'bed';
        case 'court': return it.kind === 'throne' || it.kind === 'desk';
        case 'rooms': return game.scene && game.scene.floor === 1 && (it.kind === 'bed' || it.rent);
        case 'unload': return !!(it.counter || ['crate', 'sack', 'barrel', 'shelf', 'chest'].includes(it.kind));
        default: return false;
      }
    }
    const ANIM_OF = (t, e) => ({ make: D.actionFor(e.role), fire: 'place', serve: e.role === 'innkeeper' ? 'pour' : 'serve', sweep: 'sweep', patrol: 'look', field: D.actionFor(e.role) === 'idle' ? 'hoe' : D.actionFor(e.role), chop: 'chop', fish: 'fish', collect: 'count', deliver: 'place', service: 'pray', teach: 'read', write: 'write', tend: 'serve', court: 'talk', rooms: 'look', fetch: 'count', unload: 'place' }[t.kind] || 'work');

    // the candidate for E: the task you can do where you stand
    O.jobCandidate = () => {
      const e = here(); if (!e || !e.onShift) return null;
      const s = cur(), bz = bizOf(e); if (!bz) return null;
      const p = game.player, open = e.tasks.filter((t) => t.have < t.need);
      // carrying something back for the workplace
      if (PS.carry && game.scene && game.scene.b.id === bz.id) { const it = game.scene.L.items.find((i) => stationOk({ kind: 'unload' }, i, e)); if (it) { const [x, y] = game.scene.anchor(it); if (Math.hypot(x - p.x, y - 6 - p.y) < 40) return { type: 'job', t: { kind: 'unload', id: 'u' }, it, d: 4, x, y: y - 30 }; } }
      for (const t of open) {
        if (t.kind === 'unload') continue;
        const spots = spotsFor(t, s, bz, e);
        if (spots) {
          if (game.scene) { if (t.kind === 'fetch' && game.scene.b.id === t.from) { const c = game.scene.L.items.find((i) => i.counter || i.kind === 'bar'); if (c) { const [x, y] = game.scene.anchor(c); if (Math.hypot(x - p.x, y - p.y) < 50) return { type: 'job', t, d: 3, x, y: y - 30 }; } } continue; }
          for (let k = 0; k < spots.length; k++) { if ((t.done || []).includes(k)) continue; const [x, y] = spots[k]; if (Math.hypot(x - p.x, y - p.y) < 22) return { type: 'job', t, k, d: 2, x, y: y - 34 }; }
          continue;
        }
        if (!game.scene || game.scene.b.id !== bz.id) continue;
        for (const it of game.scene.L.items) {
          if (!stationOk(t, it, e)) continue;
          const [x, y] = game.scene.anchor(it); const d = Math.hypot(x - p.x, y + 8 - p.y);
          if (d < (t.kind === 'sweep' ? 26 : 36) && !(t.kind === 'sweep' && (t.swept || []).includes(it.id))) return { type: 'job', t, it, d: d - 16, x, y: y - 30 };
        }
      }
      return null;
    };
    const LABEL = { make: (t) => `Make ${D.GOODS[t.good]?.name.toLowerCase() || 'goods'} (${t.have + 1}/${t.need})`, fire: () => 'Feed the fire with firewood', serve: (t) => `Serve (${t.have + 1}/${t.need})`, sweep: (t) => `Sweep here (${t.have + 1}/${t.need})`, patrol: (t) => `Look about your beat (${t.have + 1}/${t.need})`,
      field: (t) => `Work the ground (${t.have + 1}/${t.need})`, chop: (t) => `Fell and cut (${t.have + 1}/${t.need})`, fish: (t) => `Cast a line (${t.have + 1}/${t.need})`, collect: (t) => `Collect the dues (${t.have + 1}/${t.need})`, deliver: (t) => `Deliver here (${t.have + 1}/${t.need})`,
      fetch: (t) => `Buy ${t.qty} ${D.GOODS[t.good]?.name.toLowerCase()} for ${emp().bizName}`, unload: () => `Put away the ${D.GOODS[PS.carry?.good]?.name.toLowerCase() || 'goods'}`, service: (t) => `Lead the prayers (${t.have + 1}/${t.need})`, teach: (t) => `Teach a lesson (${t.have + 1}/${t.need})`,
      write: (t) => `Write up the books (${t.have + 1}/${t.need})`, tend: (t) => `Tend the sick (${t.have + 1}/${t.need})`, court: (t) => `Hear petitions (${t.have + 1}/${t.need})`, rooms: () => 'Look over the rooms' };
    O.jobLabel = (c) => (LABEL[c.t.kind] || (() => 'Work'))(c.t);

    // doing it: the action plays, time passes, and the work is real
    let busy = 0, busyDone = null;
    game.hooks.update.push((dt) => {
      if (busy > 0) { busy -= dt; game.player.locked = true; if (busy <= 0) { game.player.locked = false; const f = busyDone; busyDone = null; game.player.anim = 'idle'; f && f(); } }
    });
    function act(anim, secs, minutes, done) { const p = game.player; p.anim = anim; p.ft = 0; busy = secs; busyDone = () => { const s = cur(); for (let i = 0; i < minutes / 2; i++) { s.tick(2); PS.tick(2, false); } PS.energy = Math.max(0, PS.energy - minutes / 20); done(); }; }
    O.jobAct = (c) => {
      const e = emp(), s = cur(), bz = bizOf(e), t = c.t; if (!bz) return;
      const tick = (msg) => { t.have++; e.stats.tasks++; e.todayTasks = (e.todayTasks || 0) + 1; if (c.k != null) (t.done = t.done || []).push(c.k); if (msg) say(msg); refresh(); };
      switch (t.kind) {
        case 'make': {
          const rc = recipeFor(bz, e.role); if (!rc) return;
          const lack = Object.entries(rc.inp).find(([g, q]) => (bz.stock[g] || 0) < q * 2);
          if (lack) { const g = lack[0]; say(`There's no ${D.GOODS[g]?.name.toLowerCase() || g} to work with.`, 'bad'); if (!e.tasks.some((x) => x.kind === 'fetch' && x.good === g && x.have < x.need)) { const sp = supplierFor(s, bz, g); if (sp) { e.tasks.push({ id: Math.random().toString(36).slice(2, 8), kind: 'fetch', good: g, qty: 4, from: sp.id, fromName: sp.name, need: 1, have: 0, text: `Buy 4 ${D.GOODS[g]?.name.toLowerCase()} at ${sp.name} (from the business purse)` }); refresh(); } } return; }
          act(ANIM_OF(t, e), 2.2, 30, () => { const made = []; for (const [g, q] of Object.entries(rc.inp)) bz.stock[g] -= q * 2; for (const [g, q] of Object.entries(rc.out)) { bz.stock[g] = (bz.stock[g] || 0) + q * 2; made.push(`${+(q * 2).toFixed(1)} ${D.GOODS[g]?.name.toLowerCase() || g}`); } tick(`Half an hour's work: ${made.join(', ')}.`); });
          break;
        }
        case 'fire': {
          if ((bz.stock.firewood || 0) < 1) { say('No firewood left. Someone must fetch some.', 'bad'); if (!e.tasks.some((x) => x.kind === 'fetch' && x.good === 'firewood' && x.have < x.need)) { const sp = supplierFor(s, bz, 'firewood') || s.supplierOf('woodcutter', 'firewood') || s.supplierOf('store', 'firewood'); if (sp) e.tasks.push({ id: 'fw' + s.day, kind: 'fetch', good: 'firewood', qty: 4, from: sp.id, fromName: sp.name, need: 1, have: 0, text: `Buy 4 firewood at ${sp.name} (from the business purse)` }); refresh(); } return; }
          act('place', 1.2, 5, () => { bz.stock.firewood -= 1; bz.fireUntil = now(s) + 180; tick('You build up the fire. It roars.'); });
          break;
        }
        case 'serve': {
          const customers = s.people.filter((q) => q.agent.inside === bz.id && ['shop', 'eat-out', 'socialise', 'deliver', 'import'].includes(q.activity?.act)).length;
          act(ANIM_OF(t, e), 1.6, 15, () => { const sold = bz.def.sells[0]; if (customers && sold && (bz.stock[sold] || 0) >= 1) { const pr = s.price(bz, sold); bz.stock[sold] -= 1; bz.cash += pr; bz.salesToday += pr; tick(`You serve a customer: ${D.GOODS[sold]?.name.toLowerCase()} for ${pr}d into the till.`); } else tick(customers ? 'You see to a customer.' : 'Nobody waiting; you set the counter straight and wait for trade.'); });
          break;
        }
        case 'sweep': act('sweep', 1.6, 15, () => { (t.swept = t.swept || []).push(c.it ? c.it.id : c.k); tick(t.have + 1 >= t.need ? 'Swept clean.' : null); }); break;
        case 'patrol': act('look', 1.4, 15, () => tick(t.have + 1 >= t.need ? 'Your round is walked. All quiet.' : null)); break;
        case 'field': act(ANIM_OF(t, e), 2.4, 40, () => { const rc = recipeFor(bz, e.role); if (rc && !Object.keys(rc.inp).length) for (const [g, q] of Object.entries(rc.out)) bz.stock[g] = (bz.stock[g] || 0) + q * 2; tick(null); }); break;
        case 'chop': act('chop', 2.4, 40, () => { const rc = recipeFor(bz, e.role); if (rc) for (const [g, q] of Object.entries(rc.out)) if (!Object.keys(rc.inp).length) bz.stock[g] = (bz.stock[g] || 0) + q * 2; else bz.stock.logs = (bz.stock.logs || 0) + 1; tick(null); }); break;
        case 'fish': act('fish', 3, 45, () => { const got = s.rng.chance(0.7); if (got) { const g = bz.type === 'saltworks' ? 'salt' : 'fish'; bz.stock[g] = (bz.stock[g] || 0) + (g === 'fish' ? 3 : 2); } tick(got ? (bz.type === 'saltworks' ? 'The pan boils down to salt.' : 'Three fish in the basket.') : 'Nothing biting.'); }); break;
        case 'collect': {
          const b = s.building(t._spots[c.k][2]), hh = b && s.households[b.household - 1];
          act('count', 1.6, 10, () => { if (!hh) return tick(null); const due = Math.max(1, Math.round(hh.members.length * 1.5)); if (hh.money >= due && s.rng.chance(0.8)) { hh.money -= due; if (bz.def.public) s.treasury.cash += due; else bz.cash += due; tick(`The ${hh.surname} household pays ${due}d.`); } else { const q = s.byId.get(hh.members[0]); if (q) { q.agent.shockedUntil = s.minute + 2; s.relate(q, { id: 0 }, -0.05); } tick(`The ${hh.surname} household can't pay. You note it down for the bailiff.`); } });
          break;
        }
        case 'deliver': act('place', 1.4, 15, () => { const to = s.biz.get(t._spots[c.k][2]); const g = bz.def.sells[0]; if (to && g && (bz.stock[g] || 0) >= 1) { bz.stock[g] -= 1; to.stock[g] = (to.stock[g] || 0) + 1; const pr = s.price(bz, g); if (to.cash >= pr) { to.cash -= pr; bz.cash += pr; } } tick(to ? `Delivered to ${to.name}.` : null); }); break;
        case 'fetch': {
          const sp = s.biz.get(t.from), g = t.good; if (!sp) return;
          const qty = Math.min(t.qty, Math.floor(sp.stock[g] || 0)), cost = Math.round(s.price(sp, g) * qty);
          if (qty < 1) { say(`${sp.name} has no ${D.GOODS[g]?.name.toLowerCase()} to sell.`, 'bad'); return; }
          if (bz.cash < cost) { say(`The business purse holds ${Math.floor(bz.cash)}d; that's ${cost}d of ${D.GOODS[g]?.name.toLowerCase()}. Ask the master to put more in.`, 'bad'); return; }
          act('count', 1.4, 10, () => { sp.stock[g] -= qty; sp.cash += cost; bz.cash -= cost; PS.carry = { good: g, qty, for: bz.id }; e.tasks.push({ id: 'un' + t.id, kind: 'unload', need: 1, have: 0, text: `Bring the ${D.GOODS[g]?.name.toLowerCase()} back to ${bz.name}` }); tick(`You pay ${cost}d of ${bz.name}'s money and take ${qty} ${D.GOODS[g]?.name.toLowerCase()}. Carry it back.`); });
          break;
        }
        case 'unload': act('place', 1.2, 5, () => { const cy = PS.carry; if (cy) { bz.stock[cy.good] = (bz.stock[cy.good] || 0) + cy.qty; PS.carry = null; } const u = e.tasks.find((x) => x.kind === 'unload' && x.have < x.need); if (u) { u.have = 1; } e.stats.tasks++; refresh(); say('Put away.'); }); break;
        case 'rooms': act('look', 1.6, 10, () => tick('The rooms are in order.')); break;
        case 'service': case 'teach': case 'write': case 'tend': case 'court': act(ANIM_OF(t, e), 2, 30, () => tick(null)); break;
        default: break;
      }
    };

    // ---------------------------------------------------------------- shifts, lateness, pay, promotion and the sack
    function atWork(s, bz, e) {
      if (game.scene && game.scene.b.id === bz.id) return true;
      const p = game.player; if (game.world !== s.world) return false;
      return Math.hypot(p.x - (bz.b.doorX * T + 8), p.y - bz.b.doorY * T) < 140 || e.tasks.some((t) => t._spots && t._spots.some(([x, y]) => Math.hypot(x - p.x, y - p.y) < 60));
    }
    let lastMin = -1;
    game.hooks.update.push(() => {
      const e = emp(); if (!e) { panel(null); return; }
      // the post is in another town: it waits for you (time passes there too)
      const visited = O.Travel && O.Travel.visited.get(e.place), s = visited ? visited.sim : cur();
      if (!s || s.world.placeId !== e.place) { panel(e); return; }
      const bz = s.biz.get(e.biz); if (!bz) { quit(`${e.bizName} is gone, and your post with it.`); return; }
      if (bz.playerRole !== e.role) bz.playerRole = e.role;
      const m = Math.floor(now(s)); if (m === lastMin) return; lastMin = m;
      const [o, c] = hoursOf(e, bz), h = s.hour + (s.hour < 6 && c > 24 ? 24 : 0), day = s.day;
      if (e.day !== day) { // a new day
        if (e.day != null && e.dayInfo) settle(s, bz, e);
        e.day = day; e.dayInfo = { works: worksToday(s, bz), arrived: null, excused: e.excuseDay === day };
        e.tasks = []; e.onShift = false;
      }
      const D0 = e.dayInfo; if (!D0.works) { panel(e); return; }
      const on = h >= o && h < c;
      if (on && !e.onShift) { e.onShift = true; e.tasks = newTasks(s, bz, e); refresh(); }
      if (!on && e.onShift && h >= c) { e.onShift = false; refresh(); }
      if (on && D0.arrived == null && atWork(s, bz, e)) { D0.arrived = h; if (h > o + 0.25 && !D0.excused) { e.stats.late++; const boss = s.byId.get(e.master); if (boss) s.relate(boss, { id: 0 }, -0.04); say(`You're late. ${e.masterName || 'Your master'} gives you a look.`, 'bad'); } }
      if (on && e.onShift && e.tasks.every((t) => t.have >= t.need) && h < c - 1) { e.tasks.push(...newTasks(s, bz, e).filter((t) => t.kind !== 'rooms')); refresh(); }
      panel(e);
    });
    function settle(s, bz, e) {
      const D0 = e.dayInfo; if (!D0.works) return;
      const boss = s.byId.get(e.master), done = e.todayTasks || 0; e.todayTasks = 0;
      if (D0.arrived == null) {
        if (D0.excused) { e.stats.excused++; if (boss) s.relate(boss, { id: 0 }, -0.02); }
        else { e.stats.missed++; if (boss) { s.relate(boss, { id: 0 }, -0.12); s.remember(boss, 'The stranger never came to work.', 'work', 1.2, 0); } }
      } else {
        e.stats.shifts++;
        // the day's wage, less for a half-hearted day
        const pay = Math.round(e.wage * O.clamp(0.5 + done * 0.12, 0.5, 1.15));
        const purse = bz.def.public ? s.treasury : bz; const paid = Math.min(pay, Math.floor(purse.cash));
        purse.cash -= paid; PS.money += paid; PS.earned = (PS.earned || 0) + paid;
        if (boss) s.relate(boss, { id: 0 }, done >= 3 ? 0.04 : 0.01);
        say(`Your day's pay from ${bz.name}: ${paid}d${paid < pay ? ` (${pay - paid}d owing: the purse is empty)` : ''}.`);
      }
      // the sack: lateness and absence against how much they like you and how badly they need you
      const like = boss ? (boss.rel.get(0)?.affinity || 0) : 0, des = s.desperation ? s.desperation(bz) : 0;
      const bad = e.stats.late * 0.08 + e.stats.missed * 0.3 + Math.max(0, e.stats.excused - 2) * 0.1;
      if (bad - like * 0.8 - des * 0.4 > 0.55) {
        bz.firedPlayer = true;
        const told = s.rng.chance(0.5);
        if (boss) s.remember(boss, 'Let the stranger go. Unreliable.', 'work', 1.5, 0);
        quit(told ? `${e.masterName || 'Your master'} sends word: you're not to come back to ${e.bizName}.` : null);
        if (!told) PS.firedSilently = { biz: bz.id, place: s.world.placeId, name: bz.name };
        return;
      }
      // a step up: good attendance, plenty done, a master who likes you and a business that can pay
      const sh = e.stats.shifts;
      if (sh > 0 && sh % 6 === 0 && e.stats.tasks / sh >= 3 && like > 0.2 && (bz.cash > 120 || bz.def.public)) {
        const roles = bz.def.jobs.map((j) => j[0]), i = roles.indexOf(e.role);
        if (i > 0 && bz.def.wage[roles[i - 1]] !== 0) { const nr = roles[i - 1]; bz.playerRole = nr; e.role = nr; e.wage = Math.max(e.wage + 1, bz.def.wage[nr] || e.wage + 2); say(`${e.masterName || 'Your master'} puts you up to ${nr}, at ${e.wage}d a day.`); }
        else { e.wage += 1; say(`${e.masterName || 'Your master'} raises your pay to ${e.wage}d a day.`); }
      }
    }
    // turning up after being quietly let go
    game.hooks.update.push(() => {
      const f = PS.firedSilently; if (!f || !game.scene || game.scene.b.id !== f.biz || cur().world.placeId !== f.place) return;
      PS.firedSilently = null; say(`Someone at ${f.name} tells you: “You don't work here any more. Didn't they say?”`, 'bad');
    });

    // ---------------------------------------------------------------- the checklist in the corner
    let el = null, sig = '';
    function refresh() { sig = ''; }
    function panel(e) {
      if (!el) { el = document.createElement('div'); el.className = 'joblist'; el.setAttribute('aria-live', 'polite'); (document.getElementById('tab-play') || document.body).appendChild(el); }
      if (!e) { if (!el.hidden) el.hidden = true; return; }
      const s = O.Travel?.visited.get(e.place)?.sim || cur();
      const bz = s.world.placeId === e.place ? s.biz.get(e.biz) : null, [o, c] = hoursOf(e, bz);
      const head = `<b>${esc(e.role)}</b> · ${esc(e.bizName)}${e.place !== cur().world.placeId ? `, ${esc(e.placeName)}` : ''}`;
      const shift = e.onShift ? `On shift till ${fmtH(c)}` : `Next shift: ${e.dayInfo && e.dayInfo.works && s.hour < o ? 'today' : 'tomorrow'} ${fmtH(o)}-${fmtH(c)}`;
      const tasks = e.onShift ? e.tasks.map((t) => `<li class="${t.have >= t.need ? 'done' : ''}">${t.have >= t.need ? '■' : '□'} ${esc(t.text)}${t.need > 1 ? ` (${Math.min(t.have, t.need)}/${t.need})` : ''}</li>`).join('') : '';
      const carry = PS.carry ? `<div class="carry">Carrying: ${PS.carry.qty} ${esc(D.GOODS[PS.carry.good]?.name.toLowerCase() || PS.carry.good)}</div>` : '';
      const html = `<div class="jh">${head}</div><div class="js">${shift} · ${e.wage}d a day</div>${tasks ? `<ul>${tasks}</ul>` : ''}${carry}`;
      if (html === sig) return; sig = html; el.innerHTML = html; el.hidden = false;
    }

    // ---------------------------------------------------------------- markers over where the work is
    game.hooks.drawTop.push((ctx, cam, indoor) => {
      const e = here(); if (!e || !e.onShift) return;
      const s = cur(), bz = bizOf(e); if (!bz) return;
      const bob = Math.round(Math.sin(game.t * 4) * 2), mark = (x, y) => { x = Math.round(x - cam.x); y = Math.round(y - cam.y) + bob; ctx.fillStyle = '#1b1424'; ctx.fillRect(x - 3, y - 1, 7, 5); ctx.fillRect(x - 1, y + 4, 3, 2); ctx.fillStyle = '#f0b45c'; ctx.fillRect(x - 2, y, 5, 3); ctx.fillRect(x, y + 3, 1, 2); };
      for (const t of e.tasks) {
        if (t.have >= t.need) continue;
        if (indoor) {
          if (!game.scene) continue;
          if (t.kind === 'fetch' && game.scene.b.id === t.from) { const c = game.scene.L.items.find((i) => i.counter || i.kind === 'bar'); if (c) { const [x, y] = game.scene.anchor(c); mark(x, y - 40); } continue; }
          if (game.scene.b.id !== bz.id) continue;
          if (t.kind === 'unload') { const it = game.scene.L.items.find((i) => stationOk(t, i, e)); if (it) { const [x, y] = game.scene.anchor(it); mark(x, y - 40); } continue; }
          const it = game.scene.L.items.find((i) => stationOk(t, i, e) && !(t.swept || []).includes(i.id)); if (it) { const [x, y] = game.scene.anchor(it); mark(x, y - 40); }
        } else {
          const spots = spotsFor(t, s, bz, e);
          if (spots) spots.forEach(([x, y], k) => { if (!(t.done || []).includes(k)) mark(x, y - 40); });
          else if (t.kind !== 'unload') mark(bz.b.doorX * T + 8, bz.b.doorY * T - 50);
          else mark(bz.b.doorX * T + 8, bz.b.doorY * T - 50);
        }
      }
    });

    // ---------------------------------------------------------------- any post at all (for trying the jobs out)
    O.allRoles = () => {
      const seen = new Map();
      for (const [type, def] of Object.entries(D.BUSINESS)) for (const [role] of def.jobs) if (!seen.has(role)) seen.set(role, type);
      for (const r of ['monarch', 'consort', 'heir', 'lord', 'lady']) seen.set(r, 'crown');
      return seen;
    };
    O.takeAnyPost = (role) => {
      const s = cur(), type = O.allRoles().get(role);
      let bz = [...s.biz.values()].find((x) => x.type === type) || null;
      if (type === 'crown') bz = [...s.biz.values()].find((x) => x.type === 'palace' || x.type === 'keep' || x.type === 'manor' || x.type === 'townhall') || [...s.biz.values()][0];
      if (!bz) return say(`There's no ${D.BUSINESS[type]?.label.toLowerCase() || type} in ${s.world.name}. Try a bigger place.`, 'bad');
      // whoever held the post makes way (they find work elsewhere)
      const holder = bz.workers.map((id) => s.byId.get(id)).find((q) => q && q.job?.role === role);
      if (holder) { bz.workers = bz.workers.filter((id) => id !== holder.id); holder.job = null; }
      if (emp()) quit(null);
      hire(s, bz, s.bossOf(bz), role, Math.max(3, bz.def.wage?.[role] || (type === 'crown' ? 40 : 6)), { trial: true });
      say(`You take up the post of ${role} at ${bz.name}.`);
    };

    // ---------------------------------------------------------------- the sim keeps its count of who works where
    const SP = O.Sim.prototype, _vac = SP.vacancies;
    void _vac; void home;
  }
  O.EmploymentSetup = { setup };
})();
