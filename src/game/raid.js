// Raiders. In time of war, now and then at dusk, a band of the enemy comes over the fields to burn and
// take what they can. The alarm bell rings; townsfolk run for their doors; the watch and the bravest of
// the town meet them in the street, blow by blow. Strike a raider and it's no crime: they're the enemy.
// Drive them off and the reeve pays a bounty for each one put down, and the town remembers who stood.
'use strict';
(function () {
  const T = 16;
  function setup(game) {
    const PS = O.PlayerState, cur = () => O.SimRef.cur, say = (t, k) => O.UI.say(t, k || 'note');
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    let raid = null;
    function begin(s) {
      if (raid || !O.HomeFront) return null;
      const w = s.world, edge = [Math.max(2, w.ox - 4), w.oy + Math.floor(w.townH / 2)];
      const band = [];
      for (let i = 0; i < 4; i++) { const q = O.HomeFront.visitor(s, { role: 'soldier', at: [edge[0], edge[1] + i - 1], age: 20 + i * 5 }); q.raider = true; q.homefront = 'raider'; q.traits = ['brave', 'hostile']; q.health.hp = 70; q.app = O.Char.makeAppearance(O.hash('raider', q.id), { sex: 'm', age: q.age, genes: q.genes, role: 'outlaw', wealth: 0.2 }); q.app.outfit.item = pick(['axe', 'spear', 'sword']); q.agent.a = q.app; O.Char.invalidate(q.app); band.push(q); }
      raid = { s, band, t: 0, downed: 0, byYou: 0, looted: 0 };
      s.log(`Raiders! A band of ${O.HomeFront && O.SimRef.home.kingdom?.war?.enemy || 'the enemy'} came over the fields at dusk.`, 'war');
      say('The alarm bell! Raiders are coming over the fields!', 'bad'); O.sfx && O.sfx('handbell', 0.9);
      for (const q of s.people) if (!q.raider && (q.age < 16 || q.age > 60 || q.traits.includes('cowardly'))) { if (q.agent && !q.agent.hidden && O.flee) O.flee(q, 12, () => [band[0].agent.x, band[0].agent.y]); }
      return raid;
    }
    O.Raid = {
      begin: () => begin(cur()), now: () => raid,
      struck(q, res) { if (!raid) return; if (res === 'incapacitated' || res === 'dead' || q.health.hp <= 0) { if (!q._down) { q._down = true; raid.downed++; raid.byYou++; } } },
    };
    let t0 = 0;
    game.hooks.update.push((dt) => {
      const s = cur(); if (!s) return;
      if (!raid) { t0 -= dt; if (t0 > 0) return; t0 = 30; const ph = O.HomeFront && O.HomeFront.phase(), h = s.minute / 60; if (ph === 'war' && h >= 19 && h < 21 && !s._raidDay && Math.random() < 0.06) { s._raidDay = s.day; begin(s); } return; }
      if (raid.s !== s) { raid = null; return; }
      raid.t += dt;
      for (const r of raid.band) {
        if (r._down || r.health.hp <= 0) { if (!r._down) { r._down = true; raid.downed++; } r.agent.anim = 'lie'; continue; }
        if (r._fighting || (O.Combat && O.Combat.fights.has(r.id))) continue;
        // look for someone to fight, or something to take
        const P = game.player, dP = Math.hypot(P.x - r.agent.x, P.y - r.agent.y);
        if (!game.scene && dP < 90 && O.Combat) { O.Combat.provoke(r, 'fight'); O.Speech && O.Speech.say(r, pick(['For the Sea-Lords!', 'Your silver or your life!', 'Burn it!']), 1.6); continue; }
        const foe = s.people.find((q) => !q.raider && !q._fighting && q.agent && !q.agent.hidden && q.agent.inside == null && q.age >= 16 && q.age <= 60 && (/^guard|sergeant|soldier/.test(q.job?.role || '') || q.traits.includes('brave')) && Math.hypot(q.agent.x - r.agent.x, q.agent.y - r.agent.y) < 260);
        if (foe && O.StreetFight) { const f = O.StreetFight.start(s, foe, r, { why: 'the raid' }); if (f) { f.raid = true; for (const q of f.sides.flat()) f.hp.set(q.id, q.raider ? 45 : 35 + (/guard|soldier/.test(q.job?.role || '') ? 25 : 0)); } continue; }
        if (!r.errand && O.Errands) { const b = pick(s.world.buildings.filter((x) => x.household && x.doorX != null && Math.hypot(x.doorX * T - r.agent.x, x.doorY * T - r.agent.y) < 400)); if (b) O.Errands.send(s, r, [b.doorX, b.doorY + 1], { anim: 'attack', secs: 4, face: 3, giveUp: 40, after: () => { const hh = s.households[b.household - 1]; if (hh && hh.money > 2) { const n = Math.floor(hh.money * 0.3); hh.money -= n; raid.looted += n; } } }); }
      }
      // street fights lost by raiders count as downed
      for (const r of raid.band) if (!r._down && r._lostFight) { r._down = true; raid.downed++; }
      const left = raid.band.filter((r) => !r._down && r.health.hp > 0);
      if (!left.length || raid.t > 180) {
        const s2 = raid.s, beaten = raid.downed, you = raid.byYou;
        for (const r of raid.band) { r.task = { act: 'leave', outdoor: true, zone: 'west', emigrating: true }; r.homefront = 'leaving'; r.raider = false; }
        s2.log(left.length ? `The raiders went off over the fields with ₳${raid.looted} of the town's goods.` : `The raiders were beaten off. ${you ? 'The stranger stood with the watch.' : ''}`, 'war');
        if (you) { const pay = you * 8; PS.money += pay; PS.rep.local = Math.min(1, PS.rep.local + 0.15 * you); PS.rep.civilian = Math.min(1, PS.rep.civilian + 0.1); for (const q of s2.people) if (!q.visitor && q.agent && Math.hypot(q.agent.x - game.player.x, q.agent.y - game.player.y) < 300) { s2.relate(q, { id: 0 }, 0.12); s2.remember(q, 'The stranger fought off the raiders with the watch.', 'war', 2); } say(`The raiders are beaten off. The reeve pays you ₳${pay}, ₳8 for every one you put down.`, 'good'); }
        else say(left.length ? `The raiders melt back over the fields with what they took.` : 'The raiders are beaten off.', left.length ? 'bad' : 'good');
        raid = null;
      }
    });
    // a street fight lost by a raider puts them down
    if (O.StreetFight) { const F = O.StreetFight; const _start = F.start; void _start; }
    const SF = O.Sim.prototype; void SF;
    (O.extraLines = O.extraLines || []).push((s, q) => (q.raider ? 'You are a raider of the enemy host, come over the fields at dusk to burn and plunder. You are hard, hungry and want silver; you do not bargain long.' : raid && raid.s === s ? 'Raiders are in the town right now! You are frightened or furious, and want them gone.' : ''));
  }
  O.RaidSetup = { setup };
})();
