// Fighting, with more to it.
// - Hold Z to keep your guard up: blows that land on it do a fraction of the harm. Raise it just as the
//   blow comes and you parry: they're thrown off balance and your next blow lands hard.
// - Every weapon has its own pace: a dagger is quick, an axe slow and heavy, a quarterstaff long. Each
//   swing tires you; worn out, you swing slower and weaker.
// - You get better at it: your fighting skill grows with every exchange, in reach of a hit and in power.
// - Those you fight defend themselves as their trade and temper allow: a guard or a gang's man blocks
//   and sidesteps, a baker mostly doesn't.
// - Armour you carry is armour you wear: a padded jack, a mail shirt, an iron helm each take some of
//   the harm. Sold by the tailor and the armourer.
// - A fight draws a crowd: they gather round, shout for one side or the other, and scatter if steel
//   comes out. The watch come running to break up a brawl: stop when they say, or be taken.
// - Badly hurt, you move slower until you've healed.
'use strict';
(function () {
  const D = O.Data, G = D.GOODS;
  // goods for the fight
  G.staff = G.staff || { name: 'Quarterstaff', base: 4, unit: 'staff', slots: 2, weapon: true };
  G.gambeson = G.gambeson || { name: 'Padded jack', base: 22, unit: 'jack', slots: 3, armour: 0.18 };
  if (G.mail) G.mail.armour = 0.35; if (G.helm) G.helm.armour = 0.12;
  { const add = (t, g, rate) => { const bz = D.BUSINESS[t]; if (!bz || bz.sells.includes(g)) return; bz.sells.push(g); bz.targets[g] = 2; bz.recipes.push({ out: { [g]: rate }, inp: {} }); }; add('tailor', 'gambeson', 0.02); add('carpenter', 'staff', 0.04); add('woodcutter', 'staff', 0.03); }

  function setup(game) {
    const PS = O.PlayerState, cur = () => O.SimRef.cur, say = (t, k) => O.UI.say(t, k || 'note');
    const sk = () => (PS.skills.fighting || 0);
    let guardUp = false, guardSince = 0, stamina = 100, riposte = 0;
    window.addEventListener('keydown', (e) => { if (e.code === 'KeyZ' && !e.repeat && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') { guardUp = true; guardSince = performance.now(); } });
    window.addEventListener('keyup', (e) => { if (e.code === 'KeyZ') guardUp = false; });
    window.addEventListener('blur', () => { guardUp = false; });
    // the guard pose, and stamina coming back
    game.hooks.update.push((dt) => {
      const P = game.player;
      stamina = Math.min(100, stamina + dt * (guardUp ? 6 : 14));
      riposte = Math.max(0, riposte - dt);
      if (guardUp && !P.swinging && !P.locked) { P.anim = 'block'; P.ft = 0; P.guard = true; } else if (P.guard) { P.guard = false; if (P.anim === 'block') P.anim = 'idle'; }
    });
    // badly hurt, slower
    { const _sp = game.speedFor; game.speedFor = function (run) { let v = _sp ? _sp.call(this, run) : run ? 110 : 62; if (!game.player.mount) { if (PS.hp < 35) v *= 0.75; else if (PS.hp < 55) v *= 0.9; if (guardUp) v *= 0.55; } return v; }; }

    const armourOf = () => Math.min(0.6, ['gambeson', 'mail', 'helm'].reduce((a, k) => a + (PS.items.includes(k) ? G[k].armour || 0 : 0), 0));
    const toughness = (q) => { const r = q.job?.role || ''; return /guard|sergeant|captain|soldier|knight|squire|bounty/.test(r) ? 0.45 : q.gang && q.gang !== 'player' ? 0.32 : q.traits.includes('brave') ? 0.2 : /smith|butcher|woodcutter|quarry|miner/.test(r) ? 0.15 : 0.06; };

    O.CombatDeep = {
      canSwing: () => !guardUp && stamina > 8,
      tempo: () => (stamina < 30 ? 1.35 : 1) * (1 - sk() * 0.15),
      power: (w) => { stamina = Math.max(0, stamina - ({ fists: 6, dagger: 6, sword: 10, axe: 15, hammer: 13, spear: 11, staff: 9 }[w.key] || 8)); PS.skills.fighting = Math.min(1, sk() + 0.006); const p = (1 + sk() * 0.5) * (stamina < 20 ? 0.75 : 1) * (riposte > 0 ? 1.6 : 1); riposte = 0; return p; },
      // what they do with your blow
      defend(q, dmg, wkey) {
        const t = toughness(q), s = cur(); if (q.health.hp <= 0) return dmg;
        const busy = q.agent && q.agent.hitT > 0; // (just struck: no time to raise a guard)
        const r = Math.random();
        if (!busy && r < t * 0.5 * (1 - sk() * 0.4)) { O.Speech && Math.random() < 0.4 && O.Speech.say(q, ['Ha!', 'Too slow.', 'Not like that.'][Math.floor(Math.random() * 3)], 1.4); O.sfx && O.sfx(wkey === 'fists' ? 'smack' : 'catch', 0.5); q.agent.anim = 'block'; q.agent.ft = 0; return 'blocked'; }
        if (!busy && r < t) { q.agent.anim = 'dodge'; q.agent.ft = 0; return dmg * 0.4; }
        void s; return dmg;
      },
      // what your guard does with theirs
      incoming(q, dmg, f) {
        dmg *= 1 - armourOf();
        if (guardUp) {
          const timing = performance.now() - guardSince;
          if (timing < 260 && stamina > 10) { stamina -= 6; riposte = 1.2; if (f) f.cd = 1.6; q.agent.anim = 'hurt'; q.agent.ft = 0; O.sfx && O.sfx('catch', 0.8); PS.skills.fighting = Math.min(1, sk() + 0.01); O.Speech && Math.random() < 0.5 && O.Speech.say(q, 'Ugh!', 1); return 0; }
          stamina = Math.max(0, stamina - 12); O.sfx && O.sfx('smack', 0.5);
          return stamina > 0 ? dmg * (0.25 - sk() * 0.1) : dmg * 0.6;
        }
        return dmg;
      },
      stamina: () => stamina, guard: () => guardUp, armour: armourOf,
    };

    // ---------------------------------------------------------------- a fight draws a crowd
    let ct = 0, ringers = new Set();
    game.hooks.update.push((dt) => {
      ct -= dt; if (ct > 0) return; ct = 1.2;
      const s = cur(), F = O.Combat && O.Combat.fights; if (!s || game.scene || !F) return;
      const P = game.player, active = [...F].filter(([, f]) => f.mode === 'fight');
      if (!active.length) { for (const id of ringers) { const q = s.byId.get(id); if (q && q.agent) { q.agent.frozen = false; q._ringside = false; } } ringers.clear(); return; }
      const steel = O.Combat.armed() || active.some(([id]) => { const q = s.byId.get(id); return q && ['sword', 'axe', 'dagger', 'spear'].includes(q.app.outfit.item); });
      for (const q of s.people) {
        if (!q.agent || q.agent.hidden || q.agent.inside != null || F.has(q.id) || q.age < 8 || /guard|sergeant|captain/.test(q.job?.role || '')) continue;
        const d = Math.hypot(q.agent.x - P.x, q.agent.y - P.y); if (d > 220) continue;
        if (steel && d < 120 && !q.traits.includes('brave')) { if (O.flee) O.flee(q, 5, () => [P.x, P.y]); continue; }
        if (!ringers.has(q.id) && ringers.size < 8 && d > 30) { ringers.add(q.id); q._ringside = true; }
        if (ringers.has(q.id)) {
          const a = q.agent, ang = (q.id * 2.39996) % (Math.PI * 2), tx = P.x + Math.cos(ang) * 56, ty = P.y + Math.sin(ang) * 40;
          if (Math.hypot(a.x - tx, a.y - ty) > 6 && !game.solidAt(tx, ty)) { a.x += (tx - a.x) * 0.5; a.y += (ty - a.y) * 0.5; }
          a.frozen = true; a.dir = O.dirOf(P.x - a.x, P.y - a.y); a.anim = Math.random() < 0.3 ? 'celebrate' : 'idle';
          if (Math.random() < 0.12 && O.Speech) { const foe = s.byId.get(active[0][0]); const fam = ((q.rel.get(0) || {}).affinity || 0) > ((foe && q.rel.get(foe.id)) || {}).affinity; O.Speech.say(q, steel ? ['Put it away!', 'Someone fetch the watch!', 'He has a blade!'][q.id % 3] : fam ? ['Go on, hit him!', 'Mind your left!', 'Have him!'][q.id % 3] : [`Come on, ${foe ? foe.first : 'lad'}!`, 'Fight! Fight!', 'Ooh, that hurt.'][q.id % 3], 1.8); }
        }
      }
      // the watch break it up
      const brawl = !steel && active.length;
      const g = s.people.find((q) => /^guard|sergeant/.test(q.job?.role || '') && q.agent && !q.agent.hidden && q.agent.inside == null && Math.hypot(q.agent.x - P.x, q.agent.y - P.y) < 300);
      if (g && brawl) {
        const L = (PS._breakUp = PS._breakUp || {});
        if (!L.at || performance.now() - L.at > 20000) { L.at = performance.now(); L.warned = true; O.Speech && O.Speech.say(g, 'Break it up! Both of you, now!', 3, 'angry'); O.Errands && O.Errands.send(s, g, [Math.floor(P.x / 16), Math.floor(P.y / 16) + 1], { anim: 'point', secs: 2, giveUp: 30 }); say(`${g.first} of the watch is coming to break it up. Stop fighting.`, 'bad'); }
        else if (performance.now() - L.at > 6000 && L.warned && O.Combat.fights.size) {
          // still at it: the guard takes a hand
          L.warned = false; for (const [id, f] of [...F]) { if (f.mode === 'fight') { F.delete(id); const q = s.byId.get(id); if (q && q.agent) { q.agent.chasing = false; q.agent.anim = 'idle'; } } }
          if (Math.random() < 0.5 && O.Combat.provoke) O.Combat.provoke(g, 'fight'); else { O.Speech && O.Speech.say(g, "That's enough. Go home, the lot of you.", 3); }
        }
      }
    });
    // laying down: once the guard says so, you stop by not swinging; they leave you be after a while
    O.CombatDeep.crowd = () => [...ringers];
  }
  O.CombatDeepSetup = { setup };
})();
