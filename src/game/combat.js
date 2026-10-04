// Stylised, non-graphic combat. Hits produce a flash, a stagger and a little dust (a tiny brief red
// fleck for blades), never wounds. Damage moves people through healthy -> hurt -> seriously
// injured -> incapacitated, and those states feed the health system (the injured heal over days;
// the incapacitated are found and helped to the physician). Reactions come from personality:
// fight, flee, call the watch, or hand over the purse.
'use strict';
(function () {
  const PS = O.PlayerState, G = O.Data.GOODS;
  const WEAPONS = { fists: { dmg: 7, reach: 15, name: 'fists', blade: false, key: 'fists' }, dagger: { dmg: 13, reach: 17, name: 'dagger', blade: true, key: 'dagger' }, sword: { dmg: 19, reach: 20, name: 'sword', blade: true, key: 'sword' }, axe: { dmg: 21, reach: 18, name: 'axe', blade: true, key: 'axe' }, hammer: { dmg: 15, reach: 16, name: 'hammer', blade: false, key: 'hammer' }, spear: { dmg: 18, reach: 26, name: 'spear', blade: true, key: 'spear' } };

  function setup(game, sim, npcUI) {
    const fights = new Map(); // person id -> { mode, cd, t }
    const fx = [];
    let swing = 0, swingHit = false, playerCd = 0;
    PS.equipped = PS.items.includes('dagger') ? 'dagger' : 'fists';
    game.hooks.update.push(() => { if (PS.equipped !== 'fists' && !PS.items.includes(PS.equipped)) PS.equipped = 'fists'; syncLook(); });

    function weapon() { const w = PS.equipped; return WEAPONS[w && PS.items.includes(w) ? w : 'fists']; }
    function syncLook() { const w = PS.equipped && PS.items.includes(PS.equipped) ? PS.equipped : null; if (game.player.a.outfit.item !== w) { game.player.a.outfit.item = w; O.Char.invalidate(game.player.a); } }

    function personAt(px, py, reach, dir) {
      const d = O.Char.DIRV[dir] || [0, 1];
      const hx = px + d[0] * reach * 0.7, hy = py + d[1] * reach * 0.6;
      let best = null, bd = reach;
      const list = game.scene ? [...game.scene.actors.values()].map((a) => [a.person, a.x, a.y]) : sim.people.filter((q) => !q.agent.hidden).map((q) => [q, q.agent.x, q.agent.y]);
      for (const [q, x, y] of list) { const dd = Math.hypot(x - hx, y - hy); if (dd < bd) { bd = dd; best = q; } }
      return best;
    }
    function posOf(q) { if (game.scene) return game.scene.personPos(q); return q.agent.hidden ? null : [q.agent.x, q.agent.y]; }

    function puff(x, y, blade) {
      O.Sound && O.Sound.play('thud', 0.8);
      for (let i = 0; i < 6; i++) fx.push({ x, y: y - 10, vx: (Math.random() - 0.5) * 40, vy: -Math.random() * 30, t: 0, max: 0.35, c: 'rgba(170,140,100,0.8)' });
      if (blade) for (let i = 0; i < 3; i++) fx.push({ x, y: y - 14, vx: (Math.random() - 0.5) * 30, vy: Math.random() * 20, t: 0, max: 0.25, c: 'rgba(170,40,40,0.85)' });
      fx.push({ x, y: y - 16, flash: true, t: 0, max: 0.12 });
    }

    // damage applies to the shared health model
    function hurt(q, dmg, byPlayer, blade, wkey) {
      const h = q.health;
      const armour = q.app.outfit.armour === 'mail' ? 0.65 : 1;
      dmg = Math.round(dmg * armour * sim.rng.float(0.8, 1.2));
      const wasDown = h.hp <= 0;
      h.hp -= dmg;
      const pos = posOf(q); sim.wound && sim.wound(q, wkey || (blade ? 'dagger' : 'fists'), dmg, pos && !game.scene ? pos[0] : null, pos && !game.scene ? pos[1] : null); if (pos) { puff(pos[0], pos[1], blade); if (!game.scene) { const d = Math.atan2(pos[1] - game.player.y, pos[0] - game.player.x); q.agent.x += Math.cos(d) * 4; q.agent.y += Math.sin(d) * 4; } }
      q.agent.hitT = 0.15;
      if (wasDown && h.hp < -35) { sim.die(q, 'was killed'); return 'dead'; }
      const sev = O.clamp(1 - h.hp / 100, 0.1, 0.99);
      if (!h.illness) h.illness = { kind: 'injury', sev, since: sim.day }; else h.illness.sev = Math.max(h.illness.sev, sev);
      h.state = h.hp <= 0 ? 'incapacitated' : h.hp < 35 ? 'seriously injured' : 'hurt';
      if (h.hp <= 0) { h.illness.sev = 0.9; q.agent.anim = 'lie'; q.agent.chasing = false; q.agent.frozen = false; fights.set(q.id, { mode: 'down', t: 0, looted: fights.get(q.id)?.looted }); }
      return h.state;
    }

    function react(q) {
      const brave = q.traits.includes('brave') || q.traits.includes('hostile'), coward = q.traits.includes('cowardly');
      const guard = q.job?.role?.startsWith('guard');
      if (q.health.hp <= 0) return 'down';
      if (guard) return 'fight';
      if (q.health.hp < 40 && !brave) return 'surrender';
      if (coward || q.age < 14 || q.age > 68) return 'flee';
      if (brave && q.age >= 16) return 'fight';
      return sim.rng.chance(0.5) ? 'flee' : 'fight';
    }

    function crimeFor(q, kind, severity) {
      const pos = posOf(q) || [game.player.x, game.player.y];
      const seen = (game.scene ? [...game.scene.actors.values()].map((a) => a.person).filter((z) => z !== q && z.activity?.act !== 'sleep') : sim.seers(pos[0], pos[1], q));
      const cr = sim.recordCrime({ kind, perp: 'player', placeName: game.scene ? game.scene.b.name : sim.where(q.agent), tile: [Math.floor(pos[0] / 16), Math.floor(pos[1] / 16)], seen: seen.filter((z) => z.health.hp > 0), victimPerson: q.health.hp > 0 ? q : null, severity, royal: !!q.royal });
      PS.crimes.push(cr.id);
      if (O.scare) O.scare(pos[0], pos[1], 120, q); // bystanders run
      PS.rep.local = Math.max(-1, PS.rep.local - 0.12 * severity); PS.rep.civilian = Math.max(-1, PS.rep.civilian - 0.08 * severity); PS.rep.criminal = Math.min(1, PS.rep.criminal + 0.03 * severity);
      return cr;
    }

    const extraTargets = []; // functions returning [{ x, y, hit(dmg, blade, weapon) }]
    function attack() {
      if (swing > 0 || playerCd > 0 || O.panelOpen || game.player.locked) return;
      syncLook(); swing = 0.36; swingHit = false; playerCd = 0.45; game.player.swinging = true;
      game.player.anim = 'attack'; game.player.ft = 0;
    }

    game.keyHandlers.push((e) => {
      if (e.code === 'Space') { attack(); return true; }
      if (e.code === 'KeyR' && !O.panelOpen) { // cycle the weapon in hand
        const opts = ['fists', ...['dagger', 'sword', 'axe'].filter((w) => PS.items.includes(w))];
        PS.equipped = opts[(opts.indexOf(PS.equipped) + 1) % opts.length]; syncLook();
        // (no message: you can see what's in your hand)
        return true;
      }
      return false;
    });

    game.hooks.update.push((dt) => {
      playerCd = Math.max(0, playerCd - dt);
      if (swing > 0) {
        swing -= dt; game.player.anim = 'attack';
        if (!swingHit && swing < 0.2) {
          swingHit = true;
          const w = weapon();
          const q = personAt(game.player.x, game.player.y - 2, w.reach, game.player.dir);
          // no townsperson in reach: anyone else out there (travellers, a gang at its fire, a carter and cart)
          if (!q && !game.scene) { const d = O.Char.DIRV[game.player.dir] || [0, 1], hx = game.player.x + d[0] * w.reach * 0.7, hy = game.player.y - 2 + d[1] * w.reach * 0.6; let best = null, bd = w.reach + 6; for (const f of extraTargets) for (const t of f()) { const dd = Math.hypot(t.x - hx, t.y - hy); if (dd < bd) { bd = dd; best = t; } } if (best) { puff(best.x, best.y, w.blade); best.hit(w.dmg, w.blade, w.key); } }
          if (q) {
            const first = !fights.has(q.id);
            const res = hurt(q, w.dmg, true, w.blade, w.key);
            const guardHit = q.job?.role?.startsWith('guard');
            q._punched = (q._punched || 0) + 1;
            // a punch or two is a quarrel, not a crime: the victim and everyone watching think less of you.
            // Keep going, or draw steel, and it's assault and the watch will hear of it.
            const brawl = w.key === 'fists' && !guardHit && q._punched <= 2 && q.health.hp > 55;
            if (brawl) {
              sim.relate(q, { id: 0 }, -0.35); sim.remember(q, 'The stranger punched me.', 'social', 1.5, 0);
              const pos = posOf(q) || [game.player.x, game.player.y];
              for (const z of (game.scene ? [...game.scene.actors.values()].map((a) => a.person) : sim.seers(pos[0], pos[1], q))) { if (z === q) continue; sim.relate(z, { id: 0 }, -0.12); sim.remember(z, `Saw the stranger strike ${q.first}.`, 'social', 0.8, 0); }
              PS.rep.local = Math.max(-1, PS.rep.local - 0.02);
            } else if (first || !q._assaulted) { q._assaulted = true; const c = crimeFor(q, guardHit ? 'assault on the watch' : w.key === 'fists' ? 'brawling' : 'assault', guardHit ? 3 : w.key === 'fists' ? 1 : 2); if (guardHit) PS.bounty = true; void c; sim.remember(q, 'The stranger attacked me.', 'crime', 2.5, 0); sim.relate(q, { id: 0 }, -0.8); }
            if (res === 'dead') { crimeFor(q, 'murder', 5); O.Panels.toast(`${q.first} lies still. You have killed a man of ${sim.world.name}.`, 'bad'); PS.bounty = true; fights.delete(q.id); }
            else if (res !== 'incapacitated') { const prev = fights.get(q.id); const mode = react(q); fights.set(q.id, { mode, t: prev?.t || 0, cd: prev ? prev.cd : 0.7, looted: prev?.looted }); if (mode === 'surrender' && prev?.mode !== 'surrender') O.Panels.toast(`${q.first}: “Enough! Take my purse, take it!”`, 'bad'); if (mode === 'flee' && prev?.mode !== 'flee') { O.Panels.toast(`${q.first} runs, shouting for the watch!`, 'bad'); } }
            else O.Panels.toast(`${q.first} falls and does not get up.`, 'bad');
          }
        }
        if (swing <= 0) { game.player.swinging = false; game.player.anim = game.player.moving ? (game.keys.has('run') ? 'run' : 'walk') : 'idle'; }
      }
      // NPC fighters and fleers act in real time
      for (const [id, f] of [...fights]) {
        const q = sim.byId.get(id); if (!q || q.alive === false) { fights.delete(id); continue; }
        f.t += dt; f.cd = Math.max(0, (f.cd || 0) - dt);
        if (q.agent.hitT) q.agent.hitT = Math.max(0, q.agent.hitT - dt);
        if (f.mode === 'down') { if (q.health.hp > 0 || f.t > 600) fights.delete(id); continue; }
        if (game.scene) { if (f.t > 20) fights.delete(id); continue; } // indoor brawls are handled abstractly
        const a = q.agent; a.chasing = true; a.path = null;
        const dx = game.player.x - a.x, dy = game.player.y - a.y, d = Math.hypot(dx, dy) || 1;
        if (f.mode === 'fight') {
          if (d > 14) { const sp = 70 * dt; const nx = a.x + (dx / d) * sp, ny = a.y + (dy / d) * sp; if (!game.solidAt(nx, ny)) { a.x = nx; a.y = ny; } a.anim = 'run'; }
          else if (f.cd <= 0) {
            f.cd = 0.9; a.anim = 'attack'; a.ft = 0;
            const armed = q.app.outfit.item && ['spear', 'sword', 'axe', 'hammer', 'pitchfork', 'dagger'].includes(q.app.outfit.item);
            const dmg = (armed ? 12 : 6) * (q.job?.role?.startsWith('guard') ? 1.2 : 1) * sim.rng.float(0.7, 1.2);
            PS.hp -= dmg; fx.push({ x: game.player.x, y: game.player.y - 16, flash: true, t: 0, max: 0.12 });
            { const wk = armed ? q.app.outfit.item : 'fists', kind = (O.Aftermath && O.Aftermath.WOUND[wk]) || 'bruise'; (PS.wounds = PS.wounds || []).push({ kind, sev: Math.min(1, dmg / 22), day: sim.day, part: sim.rng.pick(['face', 'torso', 'arm']), seed: sim.rng.int(1, 999) }); if (PS.wounds.length > 6) PS.wounds.shift(); const bl = O.Aftermath && O.Aftermath.BLOOD[kind]; if (bl && !game.scene) sim.bleed(game.player.x, game.player.y + 1, bl, dmg / 18); }
            for (let i = 0; i < 4; i++) fx.push({ x: game.player.x, y: game.player.y - 8, vx: (Math.random() - 0.5) * 40, vy: -Math.random() * 30, t: 0, max: 0.3, c: 'rgba(170,140,100,0.8)' });
            if (PS.hp <= 0) return knockedOut(q);
          } else if (f.cd < 0.55) a.anim = 'idle';
          a.dir = O.dirOf(dx, dy);
          if (d > 200 || f.t > 40) { fights.delete(id); a.chasing = false; }
        } else if (f.mode === 'flee') {
          const sp = 80 * dt; const nx = a.x - (dx / d) * sp, ny = a.y - (dy / d) * sp;
          if (!game.solidAt(nx, ny)) { a.x = nx; a.y = ny; } else if (!game.solidAt(a.x - (dx / d) * sp, a.y)) a.x -= (dx / d) * sp; else a.y -= (dy / d) * sp;
          a.anim = 'run'; a.dir = O.dirOf(-dx, -dy);
          if (f.t > 5) { fights.delete(id); a.chasing = false; const g = sim.people.find((z) => z.job?.role?.startsWith('guard') && !z.agent.hidden && !z.task); if (g) { const cr = sim.crimes.filter((c) => c.perp === 'player').pop(); if (cr && !cr.reported) { cr.reported = true; g.task = { act: 'investigate', outdoor: true, crime: cr.id, tile: cr.tile }; } } }
        } else if (f.mode === 'surrender') { a.anim = 'idle'; a.dir = O.dirOf(dx, dy); if (f.t > 12) { fights.delete(id); a.chasing = false; } }
      }
      for (const p of fx) { p.t += dt; if (!p.flash) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 80 * dt; } }
      for (let i = fx.length - 1; i >= 0; i--) if (fx[i].t > fx[i].max) fx.splice(i, 1);
      PS.hp = Math.max(0, PS.hp);
    });

    game.hooks.drawWorld.push((ctx, cam) => {
      for (const p of fx) {
        if (p.flash) { ctx.fillStyle = 'rgba(255,250,235,0.7)'; ctx.fillRect(Math.round(p.x - cam.x) - 3, Math.round(p.y - cam.y) - 3, 7, 7); ctx.clearRect; continue; }
        ctx.fillStyle = p.c; ctx.fillRect(Math.round(p.x - cam.x), Math.round(p.y - cam.y), 1, 1);
      }
    });

    function knockedOut(by) {
      O.Panels.toast(`${by.first} beats you to the ground…`, 'bad');
      for (const [id] of fights) { const q = sim.byId.get(id); if (q) q.agent.chasing = false; }
      fights.clear();
      const lost = Math.floor(PS.money * 0.3); PS.money -= lost;
      PS.hp = 25;
      if (by.job?.role?.startsWith('guard')) { O.Law && O.LawUI; O.Panels.toast('You wake in irons.'); setTimeout(() => O.lawJail && O.lawJail(by), 50); return; }
      // carried to the physician like anyone else
      const doc = sim.building(sim.docId);
      if (game.scene) game.exitBuilding();
      game.enterBuilding(doc, 0);
      let g = 0; while (g++ < 300) { sim.tick(2); PS.tick(2, true); }
      PS.hp = 60;
      O.Panels.toast(`You wake in the physician's house, sore and ${lost ? '₳' + lost + ' lighter' : 'aching'}.`);
    }

    // talk card: threaten when armed
    const prevExtra = npcUI.extraButtons, prevOn = npcUI.onExtra;
    npcUI.extraButtons = (q) => { const out = prevExtra ? prevExtra(q) : []; if (O.Combat.armed() && q.gang !== 'player' && q.age >= 12) out.push(['rob', `Threaten with your ${PS.equipped}`]); return out; };
    npcUI.onExtra = (q, key, render) => { if (key === 'rob') { const line = O.Combat.rob(q); npcUI.closeTalk(); O.Panels.toast(`${q.first}: ${line}`, 'bad'); return; } return prevOn && prevOn(q, key, render); };

    // robbery and looting hooks for the talk card and F
    O.Combat = {
      addTargets: (f) => extraTargets.push(f),
      armed: () => PS.equipped && PS.equipped !== 'fists' && PS.items.includes(PS.equipped),
      rob(q) {
        const brave = q.traits.includes('brave') || q.traits.includes('hostile');
        const comply = q.traits.includes('cowardly') ? 0.9 : brave ? 0.2 : 0.6 - (q.job?.role?.startsWith('guard') ? 0.6 : 0);
        crimeFor(q, 'robbery', 2);
        if (sim.rng.chance(comply)) {
          const hh = sim.household(q), n = Math.max(1, Math.min(30, Math.floor(hh.money * 0.25)));
          hh.money -= n; PS.money += n; sim.remember(q, `Robbed at knifepoint of ₳${n} by the stranger.`, 'crime', 3, 0);
          fights.set(q.id, { mode: 'flee', t: 0 });
          return `“Take it! Take it and go!” They hand over ₳${n}.`;
        }
        fights.set(q.id, { mode: brave ? 'fight' : 'flee', t: 0, cd: 0.6 });
        return brave ? '“Over my dead body.”' : '“Help! HELP! Robbers!”';
      },
      lootable(q) { return q.health.hp <= 0 || fights.get(q.id)?.mode === 'surrender'; },
      loot(q) {
        const hh = sim.household(q), n = Math.max(0, Math.min(40, Math.floor(hh.money * 0.3)));
        hh.money -= n; PS.money += n;
        const item = q.app.outfit.item && G[q.app.outfit.item] ? q.app.outfit.item : null;
        if (item && PS.add(item)) { q.app.outfit.item = null; O.Char.invalidate(q.app); PS.stolen[item] = (PS.stolen[item] || 0) + 1; }
        if (!fights.get(q.id)?.looted) { crimeFor(q, 'robbery', 2); const f = fights.get(q.id); if (f) f.looted = true; }
        return `You search ${q.first} and take ₳${n}${item ? ' and a ' + G[item].name.toLowerCase() : ''}.`;
      },
      fights,
    };
  }
  O.CombatSetup = { setup, WEAPONS };
})();
