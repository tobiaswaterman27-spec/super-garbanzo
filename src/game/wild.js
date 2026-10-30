// The wild, and the outlaw's life in it. Wolves run the deep woods in packs (bold in winter and by night),
// a bear keeps the high woods, boar root in the thickets; they go for you if you come too close, and you
// can fight them off and take their pelts. Off the road in thick fog or a blizzard you lose your way: no
// arrow to follow, and your feet wander. And the greenwood life: do enough against the law and the sheriff
// cries you outlaw, a wolf's head, with a price on you; his men search the woods by day, and townsfolk who
// don't love you raise the hue and cry when they see you. Stop travellers on the road and demand their
// purse (they hand it over, fight or run, as they choose); give to the poor and the poor will not betray you.
// A lord, the sheriff or the crown can pardon you, for a price.
'use strict';
(function () {
  const T = 16;
  function setup(game) {
    const PS = O.PlayerState, cur = () => O.SimRef.cur, say = (t, k) => O.UI.say(t, k), clamp = O.clamp, G = O.Data.GOODS;
    Object.assign(G, {
      pelt: G.pelt || { name: 'Wolf pelt', base: 9, unit: 'pelt', slots: 1 },
      bearskin: G.bearskin || { name: 'Bearskin', base: 40, unit: 'skin', slots: 2 },
      boarmeat: G.boarmeat || { name: 'Boar meat', base: 5, unit: 'joint', slots: 1, food: 50 },
    });
    const relOf = (q) => { const r = q.rel.get(0) || { affinity: 0, familiar: 0 }; q.rel.set(0, r); return r; };
    const FIERCE = { wolf: { hp: 2, bite: 6, speed: 34, sight: 130, drop: 'pelt' }, bear: { hp: 5, bite: 14, speed: 26, sight: 70, drop: 'bearskin' }, boar: { hp: 3, bite: 9, speed: 30, sight: 60, drop: 'boarmeat' } };

    // ---------------------------------------------------------------- the beasts of the deep woods
    const spawned = new Set();
    game.hooks.update.push(() => {
      const w = game.world; if (!w || !w.island || spawned.has(w.placeId) || !O.fauna) return; spawned.add(w.placeId);
      const r = O.RNG(O.hash('beasts', w.placeId)), deep = [];
      for (let k = 0; k < 1500 && deep.length < 40; k++) {
        const x = r.int(6, w.W - 7), y = r.int(6, w.H - 7); if (w.ter[y * w.W + x] !== w.TER.FOREST || w.solid[y * w.W + x]) continue;
        const dt = Math.max(w.ox - x, x - w.ox - w.townW, w.oy - y, y - w.oy - w.townH, 0); if (dt < 30) continue;
        if (w.gx0 != null && (O.Island.ownerAt(w.gx0 + x, w.gy0 + y) || {}).id !== w.placeId) continue; // (only in this place's own country)
        let f = 0; for (let j = -4; j <= 4; j++) for (let i = -4; i <= 4; i++) if (w.ter[(y + j) * w.W + x + i] === w.TER.FOREST) f++; if (f > 60) deep.push([x, y]);
      }
      const put = (kind, x, y) => O.fauna.push({ world: w.placeId, kind, seed: r.int(1, 9999), z: { x0: x - 7, y0: y - 5, x1: x + 7, y1: y + 5 }, x: x * T + 8, y: y * T + 12, dir: r.int(0, 7), ft: r.next() * 2, tx: null, wait: r.next() * 4, speed: kind === 'bear' ? 10 : 14, wild: true, fierce: true, barn: null, hp: FIERCE[kind].hp });
      for (let p = 0; p < 2 && deep.length; p++) { const [x, y] = deep.splice(r.int(0, deep.length - 1), 1)[0]; for (let n = 0, m = 2 + r.int(0, 2); n < m; n++) put('wolf', x + r.int(-2, 2), y + r.int(-2, 2)); }
      if (deep.length && r.chance(0.7)) { const [x, y] = deep.splice(r.int(0, deep.length - 1), 1)[0]; put('bear', x, y); }
      for (let n = 0; n < 2 && deep.length; n++) { const [x, y] = deep.splice(r.int(0, deep.length - 1), 1)[0]; put('boar', x, y); }
    });
    // they come for you, bite, and give up when hurt
    let bite = 0, howl = 0;
    game.hooks.update.push((dt) => {
      bite -= dt; howl -= dt;
      const s = cur(), P = game.player; if (!s || game.scene || game.sleepState || !O.fauna) return;
      const night = s.hour < 6 || s.hour >= 21, winter = s.season === 'winter';
      for (const f of O.fauna) {
        if (!f.fierce || f.dead || f.world !== game.world.placeId) continue;
        const F = FIERCE[f.kind], d = Math.hypot(f.x - P.x, f.y - P.y);
        const bold = f.kind === 'wolf' ? (winter || night) : f.kind === 'bear' ? d < F.sight : d < F.sight;
        if (f.fleeing > 0) { f.fleeing -= dt; continue; }
        if (bold && d < F.sight * (P.mount ? 0.6 : 1)) {
          f.tx = P.x; f.ty = P.y; f.wait = 0; f.speed = F.speed; f.hunting = true;
          if (f.kind === 'wolf' && howl <= 0 && O.Speech) { howl = 20; O.Speech.say(f, night ? 'Awoooo...' : 'Grrr...', 2); }
          if (d < 16 && bite <= 0) {
            bite = 1.1; PS.hp = Math.max(5, PS.hp - F.bite); O.Sound && O.Sound.play('thud', 0.7);
            if (PS.hp <= 8) { for (const g of O.fauna) if (g.fierce && g.world === f.world && Math.hypot(g.x - f.x, g.y - f.y) < 120) { g.fleeing = 30; g.tx = g.z.x0 * T; g.ty = g.z.y0 * T; g.hunting = false; } say(`The ${f.kind} mauls you and leaves you bleeding in the leaves.`, 'bad'); PS.wounds = (PS.wounds || []).concat([{ kind: 'bite', day: s.day }]); }
            else say(f.kind === 'wolf' ? 'A wolf has you by the leg!' : f.kind === 'bear' ? 'The bear swipes at you!' : 'The boar gores you!', 'bad');
          }
        } else if (f.hunting && d > F.sight * 1.6) { f.hunting = false; f.tx = null; f.speed = 12; }
      }
    });
    O.Combat && O.Combat.addTargets(() => (O.fauna || []).filter((f) => f.fierce && !f.dead && f.world === game.world.placeId).map((f) => ({ x: f.x, y: f.y, hit: () => {
      f.hp = (f.hp ?? 1) - 1; O.Speech && O.Speech.say(f, f.kind === 'wolf' ? 'Yelp!' : 'Rrraw!', 1);
      if (f.hp > 0) { if (f.kind === 'wolf' && f.hp <= 1) { f.fleeing = 20; f.tx = f.z.x0 * T; f.ty = f.z.y0 * T; } return; }
      f.dead = true; O.fauna.splice(O.fauna.indexOf(f), 1); const s = cur(); s.drop(FIERCE[f.kind].drop, 1, f.x, f.y);
      if (f.kind === 'bear') { PS.rep.local = Math.min(1, (PS.rep.local || 0) + 0.05); s.log('The stranger killed a bear in the deep woods.', 'event'); }
      for (const g of O.fauna) if (g.fierce && g.kind === f.kind && g.world === f.world && Math.hypot(g.x - f.x, g.y - f.y) < 100) { g.fleeing = 25; g.tx = g.z.x1 * T; g.ty = g.z.y1 * T; }
      say(`The ${f.kind} is dead.`);
    } })));

    // ---------------------------------------------------------------- lost in the fog
    let lost = false, drift = 0;
    O.lostInFog = () => lost;
    game.hooks.update.push((dt) => {
      const s = cur(), w = game.world, P = game.player; if (!s || !w || game.scene || !w.ter) { lost = false; return; }
      const W = s.weather, tx = Math.floor(P.x / T), ty = Math.floor(P.y / T), t = w.ter[ty * w.W + tx];
      const thick = W && ((W.kind === 'fog' && W.level >= 2) || (W.kind === 'snow' && W.level >= 3));
      const offRoad = w.TER && t !== w.TER.ROAD && t !== w.TER.COBBLE && t !== w.TER.BRIDGE;
      const out = w.ox != null && Math.max(w.ox - tx, tx - w.ox - w.townW, w.oy - ty, ty - w.oy - w.townH, 0) > 6;
      const was = lost; lost = !!(thick && offRoad && out);
      if (lost && !was) say(W.kind === 'fog' ? "The fog closes in. You can't tell one tree from the next, and you've lost the way." : 'The snow blinds you. You have lost the way.', 'bad');
      if (!lost && was) say('You find your bearings again.');
      if (lost && (P.moving || P.anim === 'walk' || P.anim === 'run')) { drift += dt; const ang = Math.sin(drift * 0.7) * 0.9, nx = P.x + Math.cos(ang) * 4 * dt, ny = P.y + Math.sin(ang) * 4 * dt; if (!game.blocked || !game.blocked(nx, ny)) { P.x = nx; P.y = ny; } }
    });
    // the arrow can't help you when you're lost
    { const _g = O.guideArrow; if (_g) O.guideArrow = function () { if (lost) return; return _g.apply(this, arguments); }; }

    // ---------------------------------------------------------------- outlawry
    const crimesOpen = (s) => s.crimes.filter((c) => c.perp === 'player' && !c.closed).length;
    let od = -1;
    game.hooks.update.push(() => {
      const s = cur(); if (!s || od === s.day || (O.crowned && O.crowned())) return; od = s.day;
      if (PS.outlaw) return;
      const sev = s.crimes.filter((c) => c.perp === 'player' && !c.closed).reduce((n, c) => n + (c.severity || 1), 0);
      if (sev >= 7 || (PS.bounty && (PS.rep.criminal || 0) > 0.45)) declare(s);
    });
    function sheriffOf(s) {
      let q = s.people.find((z) => z.title === 'Sheriff' && z.alive !== false);
      if (!q) { q = s.people.filter((z) => /guard captain|sergeant|guard/.test(z.job?.role || '') && z.alive !== false && z.age >= 25).sort((a, b) => b.age - a.age)[0]; if (q) q.title = 'Sheriff'; }
      return q;
    }
    function declare(s) {
      const sh = sheriffOf(s); PS.outlaw = { since: s.day, place: s.world.placeId, sheriff: sh ? sh.name : 'the sheriff' }; PS.bounty = true; PS.bountyAmount = Math.max(PS.bountyAmount || 0, 60);
      s.log(`${sh ? sh.name + ', sheriff,' : 'The sheriff'} has cried the stranger outlaw: a wolf's head, with ₳${PS.bountyAmount} on it, dead or alive.`, 'crime');
      say(`You have been cried outlaw. There's ₳${PS.bountyAmount} on your head, and ${sh ? sh.name : 'the sheriff'} means to have it.`, 'bad');
    }
    // the sheriff's men search the woods by day
    const SP = O.Sim.prototype, _plan = SP.plan;
    SP.plan = function (p) {
      if (PS.outlaw && this === O.SimRef.cur && p.job && /guard/.test(p.job.role) && this.hour >= 8 && this.hour < 17 && (p.title === 'Sheriff' || p.id % 3 === 0) && this.Z && this.Z.wood) return { act: 'patrol', outdoor: true, zone: 'wood' };
      return _plan.call(this, p);
    };
    // the hue and cry: those who don't love you shout when they see you
    let hc = 0;
    game.hooks.update.push((dt) => {
      hc -= dt; if (hc > 0) return; hc = 2;
      const s = cur(); if (!PS.outlaw || !s || game.scene || (O.Law && O.Law.chasing && O.Law.chasing())) return;
      const P = game.player;
      for (const q of s.people) {
        if (q.agent.hidden || q.agent.inside != null || q.age < 14 || q.alive === false || /guard/.test(q.job?.role || '')) continue;
        if (Math.hypot(q.agent.x - P.x, q.agent.y - P.y) > 90) continue;
        const r = relOf(q), hh = s.household(q), poor = hh && hh.money < 25;
        if (r.affinity > 0.25 || (poor && (PS.almsToPoor || 0) >= 3) || q.gang) continue;
        if (Math.random() > 0.35) continue;
        O.Speech && O.Speech.say(q, 'Outlaw! The outlaw is here! Watch, the watch!', 3, 'shout');
        const g = s.people.filter((z) => /guard/.test(z.job?.role || '') && !z.agent.hidden && z.agent.inside == null).sort((a, b) => Math.hypot(a.agent.x - P.x, a.agent.y - P.y) - Math.hypot(b.agent.x - P.x, b.agent.y - P.y))[0];
        if (g && Math.hypot(g.agent.x - P.x, g.agent.y - P.y) < 500 && O.Law && O.Law.startChase) O.Law.startChase(g);
        return;
      }
    });
    // alms to the poor are remembered
    (O.onGift = O.onGift || []).push((s, q, o) => { const hh = s.household(q); if (o.g === 'coin' && hh && hh.money < 30) { PS.almsToPoor = (PS.almsToPoor || 0) + 1; if (PS.outlaw) for (const z of s.people) { const zh = s.household(z); if (zh && zh.money < 30 && Math.random() < 0.3) s.relate(z, { id: 0 }, 0.04); } } });

    // ---------------------------------------------------------------- the highway: stand and deliver
    const roadside = (s, q) => { const w = s.world; if (game.scene || q.agent.inside != null || q.agent.hidden || w.ox == null) return false; const tx = Math.floor(q.agent.x / T), ty = Math.floor(q.agent.y / T); return Math.max(w.ox - tx, tx - w.ox - w.townW, w.oy - ty, ty - w.oy - w.townH, 0) > 4; };
    (O.moreCandidates = O.moreCandidates || []).push(() => {
      const s = cur(); if (!s || game.scene || !O.npcUI || O.npcUI.talking()) return null; const P = game.player;
      const q = s.people.find((z) => z.age >= 14 && z.alive !== false && roadside(s, z) && Math.hypot(z.agent.x - P.x, z.agent.y - P.y) < 30 && !/guard/.test(z.job?.role || '') && z.gang !== 'player');
      if (!q) return null;
      return { type: 'custom', d: 3, x: q.agent.x, y: q.agent.y - 50, label: `Stand and deliver! (rob ${q.first})`, act: () => { O.npcUI.openTalk(q); q._robbed = true; setTimeout(() => O.npcUI.playerSays && O.npcUI.playerSays(q, 'Stand and deliver! Your purse, or your life.'), 300); } };
    });
    function handOver(s, q, a) {
      const hh = s.household(q), have = Math.floor((hh && hh.money) || 0) + (q.purse || 0); const n = clamp(Math.round(Number(a.amount) || Math.min(have, 20)), 0, Math.min(have, 200)); if (n <= 0) return `${q.first} has nothing to give.`;
      if (hh) hh.money -= n; PS.money += n; O.NpcActs.fly && O.NpcActs.fly(q, 'player', 'coin');
      const rich = (hh && hh.money > 100) || q.gentry || q.title; if (rich) PS.robbedRich = (PS.robbedRich || 0) + n;
      const c = s.recordCrime({ kind: 'robbery', perp: 'player', placeName: 'the road', tile: [Math.floor(q.agent.x / T), Math.floor(q.agent.y / T)], seen: [q], severity: 2, victim: q.household }); if (c) PS.crimes.push(c.id);
      PS.rep.criminal = Math.min(1, (PS.rep.criminal || 0) + 0.04); q._robbed = false;
      O.grudge && O.grudge(s, q, 'you robbed me on the road', 0.4);
      return `${q.first} hands over ₳${n}.`;
    }
    function pardon(s, q, a) {
      if (!PS.outlaw && !PS.bounty) return null;
      if (!(q.title === 'Sheriff' || q.lordOf || q.gentry || /reeve|judge|lord|lady|king|queen|monarch|bishop/.test((q.job?.role || '') + ' ' + (q.title || '').toLowerCase()))) return null;
      const pr = clamp(Math.round(Number(a.price) || 0), 0, 500); if (PS.money < pr) return `You haven't ₳${pr}.`;
      PS.money -= pr; PS.outlaw = null; PS.bounty = false; PS.bountyAmount = 0; for (const c of s.crimes) if (c.perp === 'player') c.closed = true;
      s.log(`The stranger has been pardoned by ${q.name}.`, 'crime'); return `${q.first} pardons you${pr ? ` (₳${pr})` : ''}. You are no longer an outlaw.`;
    }
    const base = O.NpcActs.apply;
    O.NpcActs.apply = function (s, q, a, main) { if (a && a.do === 'hand_over') return handOver(s, q, a); if (a && a.do === 'pardon') return pardon(s, q, a); return base.apply(this, arguments); };
    (O.extraActs = O.extraActs || []).push('hand_over {"amount"} (the player is robbing or threatening you and you give in: you hand over money)', 'pardon {"price"} (only a lord, the sheriff, a judge or the crown: you pardon the player\'s outlawry, for whatever price you set)');
    (O.extraLines = O.extraLines || []).push((s, q) => {
      const out = [];
      if (q._robbed) out.push('The player is robbing you on the road, demanding your purse. Decide as you would: hand_over, fight, or flee.');
      if (PS.outlaw) { const poor = (s.household(q)?.money || 0) < 25; out.push(`The player is an outlaw, cried so by ${PS.outlaw.sheriff}, with ₳${PS.bountyAmount || 60} on their head.${poor && (PS.almsToPoor || 0) >= 3 ? ' But they give to the poor, and folk like you would never give them up.' : ''}${(PS.robbedRich || 0) > 50 ? ' They are said to rob the rich.' : ''}`); }
      if (q.title === 'Sheriff') out.push(PS.outlaw ? 'You are the sheriff, and you mean to take the outlaw. You could pardon them, for a price, if it suited you.' : 'You are the sheriff of these parts.');
      return out.join(' ');
    });
  }
  O.WildSetup = { setup };
})();
