// The player's side of the law: pickpocketing and lock-picking, wanted status, guards who recognise
// you by description and give chase, arrest (surrender, bribe or run), the cell and the trial.
'use strict';
(function () {
  const PS = O.PlayerState, J = O.Justice, G = O.Data.GOODS;
  PS.skills = PS.skills || { stealth: 0.1, lockpick: 0.1 };
  PS.stolen = PS.stolen || {};

  function setup(game, sim, npcUI) {
    let chase = null, recogT = 0, escapeT = 0, busy = 0, busyDone = null;

    // ---------------- wanted status ----------------
    function openCrimes() { return sim.crimes.filter((c) => c.perp === 'player' && c.investigated && !c.closed && !c.accused); }
    function wanted() {
      if (PS.exiled || PS.bounty) return 3;
      const look = J.lookOf(game.player.a);
      const open = openCrimes(); if (!open.length) return 0;
      return open.some((c) => J.matchScore(c.profile, look) >= 0.6) ? 2 : 1;
    }
    PS.wantedLevel = wanted;
    PS.wantedText = () => { const w = wanted(); return ['NONE', 'WATCHED', 'SOUGHT', PS.exiled ? 'EXILED' : 'BOUNTY'][w]; };
    PS.soughtFor = () => { const o = openCrimes(); return o.length ? J.describe(o[o.length - 1].profile) : ''; };

    // ---------------- pickpocket ----------------
    function facingAway(q, ax, ay) {
      const d = O.Char.DIRV[q.agent.dir] || [0, 1];
      const vx = game.player.x - ax, vy = game.player.y - ay, m = Math.hypot(vx, vy) || 1;
      return (d[0] * vx + d[1] * vy) / m < 0.2;
    }
    function pickpocket(c) {
      const q = c.person;
      if (q.age < 8) return O.Panels.toast("A child's pockets hold nothing but string.");
      const behind = facingAway(q, c.x, c.y);
      const act = q.activity?.act;
      let chance = 0.45 + PS.skills.stealth * 0.35 + (behind ? 0.15 : -0.35) + (act === 'sit' || act === 'socialise' || q.agent.talking ? 0.12 : 0) - (q.traits.includes('suspicious') ? 0.2 : 0) - (q.traits.includes('curious') ? 0.08 : 0) - (q.job?.role?.startsWith('guard') ? 0.35 : 0) - (sim.hour > 20 || sim.hour < 6 ? -0.08 : 0);
      busy = 0.45; game.player.anim = 'crouch';
      busyDone = () => {
        const hh = sim.household(q);
        const place = game.scene ? game.scene.b.name : sim.where(q.agent);
        if (sim.rng.chance(O.clamp(chance, 0.05, 0.92))) {
          PS.skills.stealth = Math.min(1, PS.skills.stealth + 0.03);
          let got;
          if (hh.money >= 3 && sim.rng.chance(0.75)) { const n = Math.max(1, Math.min(20, Math.floor(hh.money * 0.12))); hh.money -= n; PS.money += n; got = `${n}d`; }
          else { const k = sim.rng.pick(['bread', 'spoon', 'herbs']); if (PS.add(k)) { got = G[k].name.toLowerCase(); PS.stolen[k] = (PS.stolen[k] || 0) + 1; } else got = null; }
          if (!got) return O.Panels.toast('Your satchel is full.');
          // others nearby may still have noticed
          const seen = (game.scene ? game.scene.actors ? [...game.scene.actors.values()].map((a) => a.person).filter((z) => z !== q && z.activity?.act !== 'sleep') : [] : sim.seers(game.player.x, game.player.y, q)).filter(() => sim.rng.chance(0.22));
          PS.rep.criminal = Math.min(1, PS.rep.criminal + 0.02);
          if (seen.length) { const cr = sim.recordCrime({ kind: 'pickpocket', perp: 'player', placeName: place, tile: tileOf(), seen, severity: 1 }); PS.crimes.push(cr.id); O.Panels.toast(`You lift ${got} from ${q.first}… but ${seen[0].first} saw you!`, 'bad'); PS.rep.local -= 0.1; }
          else O.Panels.toast(`You lift ${got} from ${q.first}'s purse. Nobody noticed.`);
          sim.remember(q, 'My purse felt lighter today.', 'crime', 0.4);
        } else {
          const seen = [q, ...(game.scene ? [] : sim.seers(game.player.x, game.player.y, q).filter(() => sim.rng.chance(0.5)))];
          const cr = sim.recordCrime({ kind: 'pickpocket', perp: 'player', placeName: place, tile: tileOf(), seen, severity: 1 }); PS.crimes.push(cr.id);
          PS.rep.local = Math.max(-1, PS.rep.local - 0.15); PS.rep.civilian = Math.max(-1, PS.rep.civilian - 0.08);
          q.agent.talking = 40;
          O.Panels.toast(`${q.first} catches your hand! “Cutpurse! Watch! WATCH!”`, 'bad');
        }
      };
    }
    function tileOf() { if (game.scene) return [game.scene.b.doorX, game.scene.b.doorY]; return [Math.floor(game.player.x / 16), Math.floor((game.player.y - 1) / 16)]; }

    // ---------------- lock-picking ----------------
    function pickLock(b) {
      busy = 2.2; game.player.anim = 'crouch';
      busyDone = () => {
        // better locks on richer and guarded premises (b.security is set by the generator; Ashford falls back to wealth)
        const diff = b.security != null ? 0.2 + b.security * 0.6 : 0.25 + b.wealth * 0.45 + (b.type !== 'house' ? 0.15 : 0);
        const seen = sim.seers(game.player.x, game.player.y).filter(() => sim.rng.chance(0.5));
        // a watchman awake inside hears the pick
        const watch = sim.people.find((q) => q.job?.role === 'night watchman' && q.job.biz === b.id && q.agent.inside === b.id && q.activity?.act === 'work');
        if (watch && sim.rng.chance(0.7) && !seen.includes(watch)) seen.push(watch);
        if (seen.length) { const cr = sim.recordCrime({ kind: 'burglary', perp: 'player', placeName: b.type === 'house' ? `the ${sim.households[b.household - 1]?.surname || ''} house` : b.name, tile: [b.doorX, b.doorY], seen, severity: 2 }); PS.crimes.push(cr.id); O.Panels.toast(`${seen[0].first} sees you working at the lock!`, 'bad'); }
        if (sim.rng.chance(O.clamp(0.55 + PS.skills.lockpick * 0.4 - diff, 0.08, 0.92))) {
          PS.skills.lockpick = Math.min(1, PS.skills.lockpick + 0.04);
          // sleepers may wake at the noise
          const inside = sim.people.filter((q) => q.agent.inside === b.id && q.activity?.act === 'sleep');
          for (const q of inside) if (sim.rng.chance(0.12)) { q._woke = sim.day; q.activity = { act: 'home', b: b.id }; }
          game.enterBuilding(b, 0); O.Panels.toast('The lock gives. You slip inside.');
          PS.rep.criminal = Math.min(1, PS.rep.criminal + 0.03);
        } else { PS.skills.lockpick = Math.min(1, PS.skills.lockpick + 0.015); O.Panels.toast('The pick slips. The lock holds.'); }
      };
    }
    O.Law = { pickpocket, pickLock, facingAway, wanted };

    // ---------------- guards: recognition and pursuit ----------------
    function guards() { return sim.people.filter((q) => q.job?.role?.startsWith('guard') && !q.agent.hidden && q.activity?.act !== 'sleep' && !q.health.illness); }
    function startChase(g) {
      if (chase) return;
      chase = { g, t: 0, path: null, repath: 0, stun: 0 };
      g.agent.chasing = true; game.clock.speed = 1;
      g.agent.talking = 30;
      O.Panels.toast(`${g.first} of the watch: “You there! Stop in the name of the law!”`, 'bad');
      sim.remember(g, 'Gave chase to the wanted stranger.', 'work', 1.2);
    }
    function endChase(escaped) {
      if (!chase) return;
      const g = chase.g; g.agent.chasing = false; g.agent.path = null; g.agent.goal = null;
      if (escaped) { PS.bounty = true; sim.log(`The wanted stranger escaped ${g.name} of the watch. A bounty has been posted.`, 'crime'); O.Panels.toast('You lose them in the lanes. The watch will post a bounty.'); sim.remember(g, 'The stranger got away from me.', 'work', 1.5); }
      chase = null;
    }

    game.hooks.update.push((dt) => {
      if (busy > 0) { busy -= dt; game.player.locked = true; game.player.anim = 'crouch'; if (busy <= 0) { game.player.locked = false; game.player.anim = 'idle'; const f = busyDone; busyDone = null; f && f(); } }
      if (O.panelOpen) return;
      const lvl = wanted();
      recogT += dt;
      if (!chase && lvl >= 1 && recogT > 0.3 && !game.scene) {
        recogT = 0;
        const night = sim.hour < 6 || sim.hour > 20.5;
        for (const g of guards()) {
          const d = Math.hypot(g.agent.x - game.player.x, g.agent.y - game.player.y);
          const range = night ? 50 : 85;
          if (d > range) continue;
          if (lvl >= 2 && sim.rng.chance(lvl === 3 ? 0.6 : 0.3)) { startChase(g); break; }
          if (lvl === 1 && d < 30 && sim.rng.chance(0.04)) { O.Panels.toast(`${g.first} looks you up and down. “Hm. There's been thieving. Mind yourself.”`); g.agent.talking = 30; }
        }
      }
      if (!chase) return;
      const g = chase.g, a = g.agent;
      chase.t += dt; chase.stun = Math.max(0, chase.stun - dt);
      if (game.scene) { // the guard follows you indoors if you ran into a building
        if (chase.t > 2.5 && a.inside !== game.scene.b.id) { a.inside = game.scene.b.id; a.hidden = true; }
        if (a.inside === game.scene.b.id) { const pos = game.scene.personPos(g); if (pos && Math.hypot(pos[0] - game.player.x, pos[1] - game.player.y) < 26) return arrest(g); if (chase.t > 4) return arrest(g); }
        return;
      }
      if (a.hidden) { a.hidden = false; a.inside = null; const T = sim.T; a.x = game.player.x + 20; a.y = game.player.y; }
      const dx = game.player.x - a.x, dy = game.player.y - a.y, d = Math.hypot(dx, dy);
      if (d < 12) return arrest(g);
      if (d > 230) { escapeT += dt; if (escapeT > 6) return endChase(true); } else escapeT = 0;
      if (chase.stun > 0) { a.anim = 'idle'; return; }
      // follow an A* path to the player's tile, refreshed twice a second
      chase.repath -= dt;
      if (chase.repath <= 0 || !chase.path) { chase.repath = 0.5; const T = sim.T; chase.path = sim.path.find(Math.floor(a.x / T), Math.floor((a.y - 1) / T), Math.floor(game.player.x / T), Math.floor((game.player.y - 1) / T)) || []; chase.pi = 0; }
      let budget = 86 * dt;
      while (budget > 0) {
        let tx, ty;
        if (chase.pi < chase.path.length) { const [px, py] = chase.path[chase.pi]; tx = px * 16 + 8; ty = py * 16 + 10; } else { tx = game.player.x; ty = game.player.y; }
        const ddx = tx - a.x, ddy = ty - a.y, dd = Math.hypot(ddx, ddy);
        if (dd <= budget) { a.x = tx; a.y = ty; budget -= dd; if (chase.pi < chase.path.length) chase.pi++; else break; }
        else { a.x += (ddx / dd) * budget; a.y += (ddy / dd) * budget; budget = 0; }
        if (dd > 0.01) a.dir = O.dirOf(ddx, ddy);
      }
      a.anim = 'run'; a.ft += 0;
    });

    // ---------------- arrest ----------------
    function arrest(g) {
      const lvl = wanted();
      const bribe = 12 + openCrimes().length * 8 + (PS.bounty ? 15 : 0);
      const greedy = g.traits.includes('greedy') || g.attitude < 0;
      O.Panels.open('Arrest', `<p class="speech">“${PS.exiled ? 'You were told never to come back.' : 'That\'s the one. You\'re coming with me to the Watch House.'}”</p>
        <p class="caption">${O.escape(g.name)} has you by the arm. The watch wants ${O.escape(PS.soughtFor() || 'you')}.</p>
        <div class="topics"><button data-a="surrender">Surrender</button>${greedy ? `<button data-a="bribe">Offer ${bribe}d to look the other way</button>` : ''}<button data-a="run">Break free and run</button><button data-a="fight">Fight</button></div>`, (r) => {
        r.querySelector('.x').hidden = true;
        r.querySelector('[data-a=surrender]').onclick = () => { O.Panels.close(); jail(g); };
        const bb = r.querySelector('[data-a=bribe]');
        if (bb) bb.onclick = () => {
          if (PS.money < bribe) { O.Panels.toast("You don't have that much."); return; }
          PS.money -= bribe; sim.household(g).money += bribe; PS.rep.guard -= 0.05; PS.rep.criminal += 0.05;
          for (const c of openCrimes()) c.closed = 'bribed';
          PS.bounty = false;
          sim.remember(g, 'Took coin from the stranger and let them go. Nobody needs to know.', 'crime', 2, 0);
          O.Panels.close(); endChase(false); O.Panels.toast(`${g.first} pockets the coin. “Never saw you.”`);
        };
        r.querySelector('[data-a=fight]').onclick = () => {
          O.Panels.close(); endChase(false);
          PS.bounty = true; PS.rep.guard = Math.max(-1, PS.rep.guard - 0.3);
          if (O.Combat) O.Combat.fights.set(g.id, { mode: 'fight', t: 0, cd: 0.5 });
          O.Panels.toast(`You draw on ${g.first} of the watch!`, 'bad');
        };
        r.querySelector('[data-a=run]').onclick = () => {
          O.Panels.close();
          if (!chase) startChase(g);
          if (chase) chase.stun = sim.rng.chance(0.55 + PS.skills.stealth * 0.3) ? 1.6 : 0.3;
          if (chase.stun < 1) { O.Panels.toast(`${g.first} keeps hold of you.`, 'bad'); setTimeout(() => arrest(g), 300); return; }
          PS.rep.guard = Math.max(-1, PS.rep.guard - 0.15);
          O.Panels.toast('You twist free and run!', 'bad');
          const T = sim.T; game.player.x += Math.sign(game.player.x - g.agent.x || 1) * 6;
        };
      });
      void lvl;
    }

    O.lawJail = (g) => jail(g);
    function jail(g) {
      endChase(false);
      const gh = sim.building(sim.guardId);
      // confiscate stolen goods
      let found = 0;
      for (const [k, n] of Object.entries(PS.stolen)) { const r = PS.remove(k, n); found += r; }
      PS.stolen = {};
      if (game.scene) game.exitBuilding();
      game.enterBuilding(gh, 0);
      const cell = game.scene.L.items.find((i) => i.cell); if (cell) { const [ax, ay] = game.scene.anchor(cell); game.player.x = ax; game.player.y = ay - 6; }
      sim.log(`${g.name} brought the stranger to the Watch House in irons.`, 'crime');
      O.Panels.toast('The cell door slams. The magistrate will hear you in the morning.');
      // night in the cell
      let guard = 0; while (guard++ < 1000) { sim.tick(2); PS.tick(2, true); if (Math.floor(sim.minute) >= 9 * 60 && Math.floor(sim.minute) < 9 * 60 + 4) break; }
      trial(found);
    }

    function trial(found) {
      const crimes = openCrimes();
      const evidence = crimes.reduce((s, c) => s + (c.evidence || 0.5), 0) + found * 0.5 + (PS.bounty ? 0.5 : 0);
      const captain = sim.people.find((q) => q.job?.role === 'guard captain');
      const fine = Math.round(8 + crimes.reduce((s, c) => s + c.severity * 8, 0));
      let verdict, body;
      if (PS.rep.local > 0.5 && crimes.length <= 1) { verdict = 'pardon'; body = 'The magistrate notes the good you have done in Ashford. You are pardoned, this once.'; }
      else if (evidence < 0.7) { verdict = 'acquitted'; body = 'The witnesses cannot agree on what they saw. There is not enough to hold you. You are free to go.'; }
      else if (PS.crimes.length >= 6 || (PS.bounty && crimes.length >= 3)) { verdict = 'exile'; body = 'For repeated crimes against the people of Ashford you are banished. If the watch sees you here again, they will take you on sight.'; }
      else if (evidence < 1.8 && PS.money >= fine) { verdict = 'fine'; body = `Guilty. You are fined ${fine}d, paid to those you wronged and the parish.`; }
      else { verdict = 'prison'; body = `Guilty. ${PS.money < fine ? 'You cannot pay the fine. ' : ''}You will serve ${2 + Math.min(3, crimes.length)} days in the cell.`; }
      O.Panels.open('The magistrate rules', `<p class="caption">Heard at the Watch House before ${O.escape(captain ? captain.name : 'the magistrate')}. Charges: ${crimes.map((c) => c.kind).join(', ') || 'evading the watch'}. Witnesses: ${crimes.reduce((s, c) => s + c.witnesses.length, 0)}.${found ? ` Stolen goods found on you: ${found}.` : ''}</p><p class="speech">${body}</p><button class="btn" data-ok="1">Accept the verdict</button>`, (r) => {
        r.querySelector('.x').hidden = true;
        r.querySelector('[data-ok]').onclick = () => {
          O.Panels.close();
          if (verdict === 'fine') { PS.money -= fine; sim.treasury.cash += fine; sim.treasury.income += fine; }
          if (verdict === 'prison') { const days = 2 + Math.min(3, crimes.length); let g = 0; const until = sim.day + days; while (sim.day < until && g++ < 5000) { sim.tick(2); PS.tick(2, true); } PS.hunger = Math.max(PS.hunger, 30); O.Panels.toast(`After ${days} days of bread and water, you are released.`); }
          if (verdict === 'exile') { PS.exiled = true; sim.log('The stranger has been banished from Ashford.', 'crime'); }
          for (const c of crimes) c.closed = verdict;
          if (verdict !== 'exile') PS.bounty = false;
          PS.rep.guard = Math.max(-1, PS.rep.guard - (verdict === 'acquitted' || verdict === 'pardon' ? 0 : 0.1));
          PS.rep.criminal = Math.min(1, PS.rep.criminal + (verdict === 'prison' ? 0.15 : 0.05));
          sim.log(`The stranger was tried at the Watch House: ${verdict}.`, 'crime');
          game.exitBuilding();
        };
      });
    }
  }
  O.LawUI = { setup };
})();
