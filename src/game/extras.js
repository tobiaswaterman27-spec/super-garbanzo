// Beasts of your own, the village's life, and the tourney.
// - Buy a pig, a goat, a sheep, a cow or hens in talk from a farmer, shepherd or dairymaid: they follow
//   you like a dog and can be taught (a pig to root out mushrooms in the woods, a goat to carry for you,
//   any of them to come when called), and they give: eggs from hens, milk from a cow, wool from sheep at
//   shearing time. Whatever beasts you own are kept with your saved life.
// - Your village holds a fair once a year, folk from the town walk out to its market and fair, and it can
//   fall out with the town next to it over grazing and water: hayricks burn and rents go unpaid until
//   you make peace with the town's head.
// - The tourney: every season (and the spring tournament besides) a town with a castle holds a tourney in
//   the square: the lists go up, knights and men-at-arms ride and fight, the crowd bets, and you can
//   enter, three bouts for a purse and the name of champion, or bet on someone who does.
'use strict';
(function () {
  const T = 16;
  function setup(game) {
    const PS = O.PlayerState, cur = () => O.SimRef.cur, say = (t, k) => O.UI.say(t, k), clamp = O.clamp, G = O.Data.GOODS;
    const relOf = (q) => { const r = q.rel.get(0) || { affinity: 0, familiar: 0 }; q.rel.set(0, r); return r; };

    // ---------------------------------------------------------------- your own beasts, kept and saved
    const BEASTS = { pig: 18, goat: 14, sheep: 16, cow: 45, chicken: 3, hen: 3 };
    const owned = () => (O.fauna || []).filter((f) => f.owner === 'player');
    function newBeast(s, kind, name) { const P = game.player, k = kind === 'hen' ? 'chicken' : kind; const f = { world: s.world.placeId, kind: k, seed: Math.floor(Math.random() * 9999), z: { x0: 0, y0: 0, x1: 1, y1: 1 }, x: P.x - 16, y: P.y + 6, dir: 0, ft: 0, tx: null, wait: 1, speed: k === 'chicken' ? 14 : 12, owner: 'player', mode: 'heel', petMove: true, barn: null, bond: 0.3, name: name || null, skills: {} }; O.fauna.push(f); return f; }
    // kept with your saved life: a note of them every little while, and back again on loading
    let snapT = 0, restored = false;
    game.hooks.update.push((dt) => {
      if (!O.fauna) return;
      if (!restored) { restored = true; if (PS.animals && PS.animals.length && !owned().length) for (const a of PS.animals) { if (a.kind === 'dog' && PS.dog) continue; const f = newBeast(cur(), a.kind, a.name); Object.assign(f, { world: a.world, x: a.x, y: a.y, skills: a.skills || {}, bond: a.bond || 0.3, mode: a.mode === 'home' ? 'stay' : a.mode || 'heel', seed: a.seed || f.seed }); } }
      snapT -= dt; if (snapT > 0) return; snapT = 5;
      PS.animals = owned().map((f) => ({ kind: f.kind, seed: f.seed, name: f.name, skills: f.skills || {}, bond: f.bond, mode: f.mode, world: f.world, x: Math.round(f.x), y: Math.round(f.y) }));
    });
    // what they give, each morning they're with you
    let gd = -1;
    game.hooks.update.push(() => {
      const s = cur(); if (!s || gd === s.day) return; const first = gd < 0; gd = s.day; if (first) return;
      const got = [];
      for (const f of owned()) {
        if (f.kind === 'chicken' && Math.random() < 0.7 && PS.canCarry('eggs')) { PS.add('eggs'); got.push('an egg'); }
        if (f.kind === 'cow' && PS.canCarry('milk')) { PS.add('milk'); got.push('milk'); }
        if (f.kind === 'goat' && Math.random() < 0.5 && PS.canCarry('milk')) { PS.add('milk'); got.push('goat\'s milk'); }
        if (f.kind === 'sheep' && s.season === 'spring' && s.weather?.dayOfSeason === 5 && G.wool && PS.canCarry('wool')) { PS.add('wool'); got.push('a fleece'); }
      }
      if (got.length) say(`Your beasts give: ${got.join(', ')}.`);
    });
    // lessons for the farm beasts, and what they do once learned
    if (O.petExtra) {
      const LES = { pig: [['truffle', 'to root out mushrooms']], goat: [['pack', 'to carry a pack']], sheep: [['come', 'to come when called']], cow: [['come', 'to come when called']], chicken: [['come', 'to come when called']], dog: [['herd', 'to herd your beasts']] };
      const _ex = O.petExtra, _do = O.petDo;
      O.petExtra = (f) => [..._ex(f), ...(LES[f.kind] || []).map(([k, l]) => { const v = (f.skills || {})[k] || 0; return v >= 5 ? null : [`teach:${k}`, `Teach ${l} (${v}/5)`]; }).filter(Boolean)];
      O.petDo = (f, m) => { const k = m.startsWith('teach:') ? m.slice(6) : null; if (k && (LES[f.kind] || []).some(([x]) => x === k)) { const s = cur(); if (f.taught === s.day) return say(`${f.name || 'Your ' + f.kind} has had a lesson today.`); f.taught = s.day; f.skills = f.skills || {}; if (Math.random() < 0.5 + (f.bond || 0) * 0.5) f.skills[k] = (f.skills[k] || 0) + 1; f.bond = Math.min(1, (f.bond || 0) + 0.02); say(f.skills[k] >= 5 ? `${f.name || 'Your ' + f.kind} has learned it.` : `A lesson. (${f.skills[k] || 0}/5)`); return; } return _do(f, m); };
    }
    { const _can = PS.canCarry; PS.canCarry = function (k, n = 1) { if (_can.call(this, k, n)) return true; const goat = owned().find((f) => f.kind === 'goat' && f.mode === 'heel' && ((f.skills || {}).pack || 0) >= 5); return !!goat && this.slotsUsed() + (G[k]?.slots || 1) * n <= (this.SLOTS || 10) + 6; }; }
    let tt = 0;
    game.hooks.update.push((dt) => {
      tt -= dt; if (tt > 0 || game.scene) return; tt = 15; const s = cur(), w = game.world, P = game.player; if (!s || !w.ter) return;
      for (const f of owned()) { if (f.kind !== 'pig' || f.mode !== 'heel' || ((f.skills || {}).truffle || 0) < 5) continue; if (w.ter[Math.floor(P.y / T) * w.W + Math.floor(P.x / T)] !== w.TER.FOREST || Math.random() > 0.3) continue; s.drop('mushrooms', 1, f.x, f.y + 4); O.Speech && O.Speech.say(f, 'Snrrk! Oink!', 1.5); say(`${f.name || 'Your pig'} roots up mushrooms under an oak.`); }
    });
    // a dog that herds keeps your beasts close
    game.hooks.update.push(() => { const herd = owned().some((f) => f.kind === 'dog' && f.mode === 'heel' && ((f.skills || {}).herd || 0) >= 5); if (!herd) return; for (const f of owned()) if (f.kind !== 'dog' && f.mode !== 'heel') { f.mode = 'heel'; f.petMove = true; } });

    // ---------------------------------------------------------------- the village's life
    const V = () => PS.village;
    const fairDay = (s) => !!PS.village && s.season === 'summer' && s.weather?.dayOfSeason === 9;
    const villageB = (s) => { const v = V(); return v ? s.world.buildings.filter((b) => v.plots.some(([x, y]) => b.x === x && b.bottom === y) && !b.site) : []; };
    const SP = O.Sim.prototype, _plan = SP.plan;
    SP.plan = function (p) {
      const v = V(); if (v && this.world.placeId === v.place && !p.task && !p.visitor && p.age >= 8 && (this.weekday === 2 || fairDay(this)) && this.hour >= 10 && this.hour < 16 && p.id % (fairDay(this) ? 3 : 7) === 0) { const vb = villageB(this); if (vb.length) { const a = _plan.call(this, p); if (!a || a.act !== 'work') return { act: 'visit', b: vb[p.id % vb.length].id }; } }
      return _plan.call(this, p);
    };
    let vd = -1;
    game.hooks.update.push(() => {
      const s = cur(), v = V(); if (!s || !v || vd === s.day) return; const first = vd < 0; vd = s.day; if (first) return;
      const w = s.world; if (w.placeId === v.place) {
        w.props = w.props.filter((p) => !p.villageFair);
        if (fairDay(s)) { for (let i = 0; i < 6; i++) { const x = v.cx - 7 + i * 3, y = v.cy - 4; if (!w.solid[y * w.W + x]) w.props.push({ kind: i % 3 === 2 ? 'banner' : 'stall', x: x * T + 8, y: y * T + 14, seed: 40 + i, v: i % 4, solid: false, villageFair: true }); } w.dirtyStatics = true; say(`It's ${v.name} fair today: stalls, games and music by the signpost, and the town walks out to it.`); s.log(`${v.name} keeps its fair.`, 'social'); PS.money += 10 * villageB(s).length; }
      }
      // a quarrel with the town next door, now and then, over grazing and water
      if (!v.feud && villageB(s).length >= 2 && Math.random() < 0.03) { const H = O.SimRef.home, head = H.people.find((q) => /reeve|steward/.test(q.job?.role || '') || q.lordOf) || null; v.feud = { since: s.day, with: H.world.name, head: head ? head.id : null, headName: head ? head.first : 'the reeve' }; H.log(`${H.world.name} and ${v.name} have fallen out over grazing and the stream.`, 'politics'); say(`${H.world.name} has fallen out with ${v.name} over grazing and water. ${v.feud.headName} is the one to make peace with.`, 'bad'); }
      if (v.feud && s.weekday === 5) { const loss = Math.min(PS.money, 6 * villageB(s).length); PS.money -= loss; O.SimRef.home.log(`Hayricks burned in the night at ${v.name}. Nobody saw who did it, but everyone knows.`, 'crime'); if (loss) say(`Trouble at ${v.name}: hayricks burned, and the rents are short by ₳${loss}.`, 'bad'); }
    });
    function makePeace(s, q, a) { const v = V(); if (!v || !v.feud || (v.feud.head != null && v.feud.head !== q.id && !/reeve|steward|lord/.test(q.job?.role || ''))) return null; const pr = clamp(Math.round(Number(a.price) || 0), 0, 300); if (PS.money < pr) return `You haven't ₳${pr}.`; PS.money -= pr; s.log(`${v.feud.with} and ${v.name} have made peace${pr ? `; the stranger paid ₳${pr} for the grazing` : ''}.`, 'politics'); v.feud = null; relOf(q).affinity = clamp(relOf(q).affinity + 0.1, -1, 1); return `Peace between ${s.world.name} and ${v.name}${pr ? ` (₳${pr})` : ''}.`; }

    // ---------------------------------------------------------------- the tourney
    const tourneyDay = (s) => (s.season === 'summer' || s.season === 'autumn' || s.season === 'winter') && s.weather?.dayOfSeason === 9 && !fairDay(s) || (s.season === 'autumn' && s.weather?.dayOfSeason === 6);
    const hasKeep = (s) => s.world.buildings.some((b) => b.type === 'keep' || b.type === 'guard'); // (a castle, or at least a watch to keep the lists)
    const tourneyOn = (s) => tourneyDay(s) && hasKeep(s) && s.hour >= 10 && s.hour < 16;
    let td = -1, tf = 0;
    game.hooks.update.push((dt) => {
      const s = cur(); if (!s || !s.Z || !s.Z.square) return;
      if (td !== s.day) { td = s.day; const w = s.world; w.props = w.props.filter((p) => !p.lists); if (tourneyDay(s) && hasKeep(s)) { const [x0, y0, x1] = s.Z.square; for (let x = x0 + 2; x <= x1 - 2; x++) w.props.push({ kind: 'fenceH', x: x * T + 8, y: (y0 + 1) * T + 15, seed: x, v: 0, solid: false, lists: true, sprite: O.Env.prop('fenceH', x, 0) }); for (const x of [x0 + 1, x1 - 1]) w.props.push({ kind: 'banner', x: x * T + 8, y: (y0 + 1) * T + 14, seed: x, v: 0, solid: false, lists: true }); w.dirtyStatics = true; say(`A tourney today in ${s.world.name}: the lists are up in the square from ten. Speak to the herald or a knight to enter, or bet.`); } }
      tf -= dt; if (tf > 0 || !tourneyOn(s) || game.scene) return; tf = 2.5;
      const fighters = s.people.filter((q) => /knight|guard|squire|sergeant|captain/.test(q.job?.role || '') && !q.agent.hidden && q.agent.inside == null && Math.hypot(q.agent.x - game.player.x, q.agent.y - game.player.y) < 300);
      const a = fighters[Math.floor(Math.random() * fighters.length)], b = fighters.find((x) => x !== a); if (!a || !b) return;
      O.gesture && O.gesture(a, 'attack', 1.5); setTimeout(() => O.gesture && O.gesture(b, Math.random() < 0.5 ? 'attack' : 'hurt', 1.5), 700);
      const crowd = s.people.filter((q) => q.activity?.act === 'festival' && !q.agent.hidden).slice(0, 4); for (const c of crowd) if (Math.random() < 0.4) O.gesture && O.gesture(c, 'celebrate', 1.5);
      if (Math.random() < 0.3 && O.Speech) O.Speech.say(crowd[0] || a, ['A hit! A hit!', 'Unhorsed!', 'Again, again!', 'Well struck!'][Math.floor(Math.random() * 4)], 2, 'shout');
    });
    SP.plan = (function (prev) { return function (p) { if (tourneyOn(this) && !p.task && p.age >= 6 && !p.visitor && (p.id % 2 === 0 || /knight|squire/.test(p.job?.role || ''))) { const a = prev.call(this, p); if (!a || a.act !== 'work' || /knight|squire|guard/.test(p.job?.role || '')) return { act: 'festival', outdoor: true, zone: 'square' }; return a; } return prev.call(this, p); }; })(SP.plan);
    function enterTourney(s, q, a) {
      if (!tourneyOn(s)) return null; if (PS.tourneyDay === s.day) return 'You have ridden in today\'s tourney already.';
      const fee = clamp(Math.round(Number(a.fee) || 5), 0, 50); if (PS.money < fee) return `You haven't ₳${fee} for the entry.`; PS.money -= fee; PS.tourneyDay = s.day;
      const foes = s.people.filter((z) => /knight|guard|squire|sergeant|captain/.test(z.job?.role || '') && z.alive !== false).sort(() => Math.random() - 0.5).slice(0, 3);
      const sk = ((PS.skills && PS.skills.fighting) || 0.2) + (game.player.mount ? 0.15 : 0) + ((PS.equipped && PS.equipped !== 'fists') ? 0.1 : 0);
      let won = 0; const log = [];
      for (const f of foes) { const ok = sk + Math.random() * 0.9 > (/knight/.test(f.job.role) ? 0.75 : 0.5) + Math.random() * 0.5; log.push(`${ok ? 'beat' : 'lost to'} ${f.first}`); if (!ok) break; won++; }
      PS.skills = PS.skills || {}; PS.skills.fighting = Math.min(1, (PS.skills.fighting || 0) + 0.02 * (won + 1));
      game.player.anim = 'attack'; setTimeout(() => { game.player.anim = 'idle'; }, 1500);
      if (won === foes.length && foes.length) { const purse = 40; PS.money += purse; PS.champion = Object.assign(PS.champion || {}, { tourney: s.day }); PS.rep.local = Math.min(1, (PS.rep.local || 0) + 0.1); s.log(`The stranger won the tourney at ${s.world.name}, three bouts and never unhorsed.`, 'event'); return `You ${log.join(', ')}: you win the tourney and its purse of ₳${purse}! The crowd roars your name.`; }
      return `You ${log.join(', ')}. Not this time.`;
    }
    function bet(s, q, a) {
      if (!tourneyOn(s)) return null; const stake = clamp(Math.round(Number(a.stake) || 2), 1, 100); if (PS.money < stake) return `You haven't ₳${stake}.`;
      PS.money -= stake; const win = Math.random() < 0.45; const back = win ? stake * 2 : 0; PS.money += back; const hh = s.household(q); if (hh && !win) hh.money += stake;
      return win ? `Your knight rides true: you collect ₳${back}.` : `Your knight goes down in the dust. The ₳${stake} is gone.`;
    }

    // ---------------------------------------------------------------- buying beasts, and the acts
    const base = O.NpcActs.apply;
    O.NpcActs.apply = function (s, q, a, main) {
      if (a && a.do === 'sell') { const it = String(a.item || '').toLowerCase().replace(/s$/, ''); if (BEASTS[it] != null) { if (!/farmer|farmhand|shepherd|dairymaid|swineherd|goatherd|steward/.test(q.job?.role || '')) return null; const pr = clamp(Math.round(Number(a.price) || BEASTS[it]), 0, 300); if (PS.money < pr) return `You haven't ₳${pr}.`; PS.money -= pr; const hh = s.household(q); if (hh) hh.money += pr; newBeast(s, it); return `${q.first} lets you have ${it === 'hen' || it === 'chicken' ? 'a hen' : 'a ' + it} for ₳${pr}. It follows at your heels.`; } }
      if (a && a.do === 'make_peace') return makePeace(s, q, a);
      if (a && a.do === 'enter_tourney') return enterTourney(s, q, a);
      if (a && a.do === 'bet') return bet(s, q, a);
      return base.apply(this, arguments);
    };
    (O.extraActs = O.extraActs || []).push('make_peace {"price"} (you, as head of the town, make peace with the player\'s village)', 'enter_tourney {"fee"} (a herald, marshal or knight entering the player in today\'s tourney)', 'bet {"stake"} (taking the player\'s bet on the tourney)');
    (O.extraLines = O.extraLines || []).push((s, q) => {
      const out = [], role = q.job?.role || '', v = V();
      if (/farmer|farmhand|shepherd|dairymaid|swineherd|goatherd/.test(role)) out.push(`You could sell the player a beast of yours (sell {"item":"pig"|"goat"|"sheep"|"cow"|"hen","price"}): about ₳${BEASTS.pig} a pig, ₳${BEASTS.goat} a goat, ₳${BEASTS.sheep} a sheep, ₳${BEASTS.cow} a cow, ₳${BEASTS.hen} a hen.`);
      if (v && v.feud && (v.feud.head === q.id)) out.push(`Your town is at odds with the player's village, ${v.name}, over grazing and water. You might make peace (make_peace), for a price or for good words.`);
      if (tourneyOn(s)) out.push(`There is a tourney in the square today${/herald|knight|marshal|captain|squire/.test(role) ? '; you can enter the player for a fee (enter_tourney)' : ''}${/innkeeper|server|moneylender/.test(role) || q.gang ? '; you take bets on it (bet)' : ''}.`);
      if (v && fairDay(s) && s.world.placeId === v.place) out.push(`It is ${v.name}'s fair today.`);
      return out.join(' ');
    });
  }
  O.ExtrasSetup = { setup };
})();
