// The war, seen in the street.
// - The recruiting sergeant stands on a box in the square under the King's banner, a boy beating the
//   drum, calling for men, and coins change hands.
// - When the levy goes, the men are drawn up in a line in the square; their families come to them,
//   wives and mothers holding on, children waving; then they march out east in file behind the
//   sergeant and the drum, and the street waves them off.
// - When a letter comes that a man has fallen, his family's door wears a black cloth for a week, and
//   they're seen in mourning.
// - When the soldiers come home, their families run down the road to meet them.
'use strict';
(function () {
  const T = 16;
  function setup(game) {
    const cur = () => O.SimRef.cur, S = O.Sim.prototype;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    const say = (q, t, secs) => O.Speech && O.Speech.say(q, t, secs || 2.2);
    const open = (x, y) => !game.solidAt(x - 3, y - 2) && !game.solidAt(x + 3, y - 2);
    function steer(q, tx, ty, dt, sp, an) { const a = q.agent, dx = tx - a.x, dy = ty - a.y, d = Math.hypot(dx, dy); if (d < 2) return true; const st = Math.min(d, sp * dt); let nx = a.x + dx / d * st, ny = a.y + dy / d * st; if (open(nx, ny)) { a.x = nx; a.y = ny; } else if (open(nx, a.y)) a.x = nx; else if (open(a.x, ny)) a.y = ny; else { a.x = nx; a.y = ny; } a.forceAnim = an || 'walk'; a.dir = O.dirOf(dx, dy); return false; }
    const hold = (q) => { q._war = true; const a = q.agent; a.frozen = true; a.path = null; a.inside = null; a.hidden = false; };
    const free = (q) => { if (!q || !q._war) return; q._war = false; q.agent.forceAnim = null; q.agent.frozen = false; };
    const sqCentre = (s) => { const [x0, y0, x1, y1] = s.Z.square; return [((x0 + x1) / 2) * T + 8, ((y0 + y1) / 2) * T + 8]; };
    let farewell = null, drum = 0;

    // ---------------------------------------------------------------- the levy marches out
    const _levy = S.levyMen;
    S.levyMen = function (n) {
      const sg = this.sergeant; const taken = _levy.apply(this, arguments);
      try { if (taken && taken.length && this === cur()) { const [cx, cy] = sqCentre(this);
        const kin = []; for (const p of taken) for (const id of (this.household(p)?.members || [])) { const q = this.byId.get(id); if (q && q !== p && q.alive !== false && !q._war && !q.visitor && q.agent && !q.jailUntil && kin.length < 10) kin.push({ q, to: p }); }
        const boy = this.people.find((q) => q.age >= 9 && q.age <= 14 && q.alive !== false && q.agent && !q._war && !q._playing);
        const sarge = sg && sg.agent ? sg : null;
        taken.forEach((p, i) => { hold(p); p.agent.x = cx - (taken.length - 1) * 8 + i * 16; p.agent.y = cy; p.agent.dir = 3; });
        if (sarge) { hold(sarge); sarge.agent.x = cx; sarge.agent.y = cy - 22; sarge.agent.dir = 0; }
        if (boy) { hold(boy); boy.agent.x = cx + (taken.length) * 8 + 14; boy.agent.y = cy - 4; }
        for (const k of kin) { hold(k.q); const a = k.q.agent; a.x = cx + (Math.random() - 0.5) * 120; a.y = cy + 40 + Math.random() * 30; if (!open(a.x, a.y)) { a.x = cx; a.y = cy + 34; } }
        farewell = { s: this, men: taken, sarge, boy, kin, t: 0, stage: 'goodbye', centre: [cx, cy], east: [this.Z.east[0] * T, this.Z.east[1] * T] };
        say(taken[0], pick(['Don\'t cry, now. I\'ll be back by harvest.', 'Look after them for me.', 'It\'s the King\'s coin, and it\'s good coin.']), 3);
      } } catch (e) { console.error(e); }
      return taken;
    };
    function endFarewell() { const f = farewell; if (!f) return; for (const p of [...f.men, ...(f.sarge ? [f.sarge] : [])]) { free(p); p.agent.x = f.east[0] + 8; p.agent.y = f.east[1] + 8; p.agent.path = null; } /* (at the road's end, and gone) */ if (f.boy) free(f.boy); for (const k of f.kin) free(k.q); farewell = null; }

    // ---------------------------------------------------------------- the dead and the homecoming
    const _battle = S.onBattle;
    S.onBattle = function (b) { const before = new Set((this.kingdom.war?.soldiers || []).filter((x) => x.dead).map((x) => x.id)); const r = _battle.apply(this, arguments);
      try { for (const sd of this.kingdom.war.soldiers) if (sd.dead && !before.has(sd.id)) { const hh = this.households[sd.household - 1]; if (hh) { hh._mourn = this.day; hh._mournFor = sd.name; } } } catch (e) { /* */ } return r; };
    const _back = S.soldiersReturn;
    S.soldiersReturn = function () { const r = _back.apply(this, arguments);
      try { if (this === cur()) for (const sd of this.kingdom.war.soldiers) { if (sd.back !== this.day) continue; const p = this.byId.get(sd.id); if (!p || !p.agent) continue; const hh = this.household(p); for (const id of hh?.members || []) { const q = this.byId.get(id); if (!q || q === p || q.alive === false || q._war || !q.agent || q.jailUntil) continue; homecomings.push({ q, to: p, t: 0 }); hold(q); const b = this.building(q.home); if (b && q.agent.inside != null) { q.agent.x = b.doorX * T + 8; q.agent.y = b.doorY * T + 18; } } } } catch (e) { console.error(e); }
      return r; };
    const homecomings = [];

    game.hooks.update.push((dt) => {
      const s = cur(); if (!s) return; drum -= dt;
      // the sergeant at his recruiting
      const sg = s.sergeant; if (sg && sg.agent && !sg.agent.hidden && sg.agent.inside == null && !sg.agent.path && (sg.activity?.act || sg.task?.act) === 'recruit') { sg._box = true; if (Math.random() < dt * 0.12) { say(sg, pick(['Who\'ll take the King\'s shilling? Twelve aurin to your family the day you march!', 'Strong lads wanted! Meat every day and a coat on your back!', 'Serve your King! Come up, come up!']), 3); O.gesture && O.gesture(sg, 'point', 1.4); } }
      else if (sg) sg._box = false;
      if (sg && sg._box && drum <= 0 && Math.hypot(sg.agent.x - game.player.x, sg.agent.y - game.player.y) < 260) { drum = 0.55; O.sfx && O.sfx('smack', 0.08); }
      // the farewell
      const f = farewell;
      if (f) { f.t += dt; if (f.s !== s || game.scene) { endFarewell(); }
        else if (f.stage === 'goodbye') {
          f.men.forEach((p) => { p.agent.forceAnim = 'idle'; p.agent.dir = 3; });
          for (const k of f.kin) { const to = k.to.agent, side = (k.q.id % 2 ? 1 : -1) * 6, kid = k.q.age < 13; if (steer(k.q, to.x + side, to.y + 6, dt, kid ? 55 : 40, kid ? 'run' : 'walk')) { k.q.agent.forceAnim = kid ? (Math.floor(f.t * 2) % 3 ? 'wave' : 'celebrate') : (k.q.sex === 'f' ? 'mourn' : 'nod'); k.q.agent.dir = 0; } }
          if (f.sarge) { f.sarge.agent.forceAnim = Math.floor(f.t) % 5 === 0 ? 'point' : 'idle'; }
          if (f.boy) { f.boy.agent.forceAnim = 'drum'; if (drum <= 0) { drum = 0.5; O.sfx && O.sfx('smack', 0.07); } }
          if (f.t > 6 && f.t < 6.05) say(pick(f.kin.map((k) => k.q).concat(f.men)), pick(['Come back to us.', 'You write. Get someone to write.', 'Mind you keep your head down.', 'God keep you.']), 3);
          if (f.t > 14) { f.stage = 'march'; f.t = 0; if (f.sarge) say(f.sarge, 'Fall in! By the left... march!', 2.5); }
        } else if (f.stage === 'march') {
          const lead = f.sarge || f.men[0], line = [lead, ...(f.boy ? [f.boy] : []), ...f.men.filter((p) => p !== lead)];
          line.forEach((p, i) => { const tx = i === 0 ? f.east[0] : line[i - 1].agent.x - 12, ty = i === 0 ? f.east[1] : line[i - 1].agent.y; if (i === 0 || Math.hypot(tx - p.agent.x, ty - p.agent.y) > 11) steer(p, tx, ty, dt, 42, p === f.boy ? 'drum' : 'walk'); else p.agent.forceAnim = p === f.boy ? 'drum' : 'idle'; });
          if (f.boy && drum <= 0) { drum = 0.5; O.sfx && O.sfx('smack', 0.06); }
          for (const k of f.kin) { k.q.agent.forceAnim = k.q.age < 13 ? 'wave' : f.t < 4 ? 'wave' : 'mourn'; k.q.agent.dir = O.dirOf(lead.agent.x - k.q.agent.x, lead.agent.y - k.q.agent.y); }
          if (f.boy && f.t > 10) { free(f.boy); f.boy = null; }
          if (f.t > 9 && f.kin.length) { for (const k of f.kin) free(k.q); f.kin = []; }
          const gone = Math.hypot(lead.agent.x - game.player.x, lead.agent.y - game.player.y) > 340 || Math.hypot(lead.agent.x - f.east[0], lead.agent.y - f.east[1]) < 6;
          if (gone || f.t > 35) endFarewell();
        }
      }
      for (const h of homecomings.slice()) { h.t += dt; const kid = h.q.age < 13, to = h.to.agent; if (h.t > 40 || !to || to.hidden || h.q.alive === false) { free(h.q); homecomings.splice(homecomings.indexOf(h), 1); continue; }
        if (steer(h.q, to.x + (h.q.id % 2 ? 7 : -7), to.y + 3, dt, kid ? 60 : 52, 'run')) { h.q.agent.forceAnim = h.t % 6 < 3 ? 'celebrate' : 'laugh'; if (!h.said) { h.said = true; say(h.q, pick([`${h.to.first}! Oh, ${h.to.first}!`, 'You came back. You came back!', 'Look at you! Thin as a rake!']), 3); } if (!h.hold) h.hold = h.t; if (h.t - h.hold > 8) { free(h.q); homecomings.splice(homecomings.indexOf(h), 1); } } }
      // the bereaved in mourning, now and then
      if (Math.random() < dt * 0.2) for (const hh of s.households || []) { if (hh._mourn == null || s.day - hh._mourn > 7) continue; for (const id of hh.members || []) { const q = s.byId.get(id); if (q && q.agent && !q.agent.hidden && q.agent.inside == null && !q.agent.path && !q._war && Math.random() < 0.3) O.gesture && O.gesture(q, Math.random() < 0.5 ? 'mourn' : 'pray', 4); } }
    });
    game.hooks.drawWorld.push((ctx, cam) => {
      const s = cur(); if (!s || game.scene) return; ctx.save();
      const sg = s.sergeant; if (sg && sg._box) { const x = Math.round(sg.agent.x - cam.x), y = Math.round(sg.agent.y - cam.y); banner(ctx, x + 12, y); }
      if (farewell && farewell.stage === 'goodbye' && farewell.sarge) { const a = farewell.sarge.agent; banner(ctx, Math.round(a.x - cam.x) + 12, Math.round(a.y - cam.y)); }
      if (farewell && farewell.stage === 'march') { const a = (farewell.sarge || farewell.men[0]).agent; banner(ctx, Math.round(a.x - cam.x) + 6, Math.round(a.y - cam.y)); for (const p of farewell.men) { const x = Math.round(p.agent.x - cam.x), y = Math.round(p.agent.y - cam.y); ctx.fillStyle = '#6a4a2c'; ctx.fillRect(x + 4, y - 30, 1, 26); ctx.fillStyle = '#9aa0aa'; ctx.fillRect(x + 3, y - 33, 3, 3); } }
      for (const hh of s.households || []) { if (hh._mourn == null || s.day - hh._mourn > 7) continue; const b = s.building(hh.home); if (!b || b.doorX == null) continue; const x = Math.round(b.doorX * T + 8 - cam.x), y = Math.round(b.doorY * T - cam.y); if (x < -20 || y < -20 || x > ctx.canvas.width + 20 || y > ctx.canvas.height + 20) continue; ctx.fillStyle = '#1a1418'; ctx.fillRect(x - 5, y - 2, 10, 3); ctx.fillRect(x - 2, y + 1, 2, 6); ctx.fillRect(x + 1, y + 1, 2, 5); }
      ctx.restore();
    });
    function banner(ctx, x, y) { ctx.fillStyle = '#5a3d26'; ctx.fillRect(x, y - 38, 1, 38); ctx.fillStyle = '#9a1e24'; const w = Math.sin(performance.now() / 300) > 0 ? 1 : 0; ctx.fillRect(x + 1, y - 37, 9 + w, 8); ctx.fillStyle = '#e0c050'; ctx.fillRect(x + 4, y - 35, 3, 3); ctx.fillStyle = '#8a6239'; }
    // the sergeant's box
    game.hooks.drawGround.push((ctx, cam) => { const s = cur(); if (!s || game.scene) return; const sg = s.sergeant; if (sg && sg._box) { const x = Math.round(sg.agent.x - cam.x), y = Math.round(sg.agent.y - cam.y); ctx.fillStyle = '#7a5232'; ctx.fillRect(x - 7, y - 3, 14, 6); ctx.fillStyle = '#5a3d26'; ctx.fillRect(x - 7, y - 3, 14, 1); } });
    (O.extraLines = O.extraLines || []).push((s, q) => { const hh = s.household && s.household(q); if (hh && hh._mourn != null && s.day - hh._mourn <= 7) return `Your household is in mourning: word came that ${hh._mournFor || 'one of yours'} fell in the war. There's a black cloth on the door.`; if (farewell && (farewell.men.includes(q))) return 'You are marching off to the war with the levy, this very hour.'; return ''; });
    O.WarSights = { get farewell() { return farewell; }, homecomings, levy: (n) => cur().levyMen(n || 3) };
  }
  O.WarSightsSetup = { setup };
})();
