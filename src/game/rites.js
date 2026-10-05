// The great rites of life and death.
//   Childbirth: late in her time a woman's belly shows. When it comes she goes to the infirmary (or to her
//   own bed, with the midwife sent for), lies in, and some hours later the child is born. She carries the
//   baby home in her arms.
//   The coronation: a new monarch is crowned in the castle chapel the day after taking the throne, before
//   the court, the gentry and as many townsfolk as can crowd in. Kneel at the altar and the crown is set
//   on your head; there's a feast that night.
//   The block: the worst crimes (murder, treason, sedition, arson, highway robbery, or a third conviction)
//   are punished by death. On the morning set, a scaffold stands in the square, the crowd gathers, the
//   guards bring the condemned out, and the headsman does his work. If you're the executioner, it's your
//   work. A monarch can pardon the condemned, or send a prisoner to the block.
'use strict';
(function () {
  const T = 16;
  function setup(game) {
    const PS = O.PlayerState, Ch = O.Char, cur = () => O.SimRef.cur, say = (t, k) => O.UI.say(t, k);
    const abs = (s) => s.day * 1440 + s.minute;
    const SP = O.Sim.prototype;
    const keepOf = (s) => s.world.buildings.find((b) => b.royal);
    const capital = () => O.SimRef.home.kingdom.places.find((x) => x.kind === 'capital');

    // ================================================================ childbirth
    const _birth = SP.birth;
    function deliver(s, mum, hh) {
      _birth.call(s, mum, hh || s.household(mum));
      mum.labour = null; mum.app.pregnant = false;
      for (const par of [mum, s.byId.get(mum.spouse)]) if (par && par.children) par.children = [...new Set(par.children)]; // (a child is only listed once)
      const baby = s.byId.get((mum.children || []).slice(-1)[0]);
      if (mum.agent.inside != null && mum.agent.inside !== mum.home) { // carried home from the infirmary
        mum.app.babe = true; mum.agent.carrying = 'babe'; mum.task = { act: 'home', b: mum.home, babe: baby?.id };
        s.log(`${mum.first} carries her newborn home from the infirmary.`, 'life');
      } else mum.task = null;
      Ch.invalidate(mum.app);
      if (mum.midwife) { const mw = s.byId.get(mum.midwife); if (mw && mw.task?.midwife) mw.task = null; mum.midwife = null; }
    }
    SP.birth = function (mum, hh) {
      const now = abs(this);
      if (!mum.labour) {
        const doc = this.docId && this.biz.get(this.docId) ? this.docId : null, dest = doc || mum.home;
        mum.labour = { since: now, b: dest }; mum.task = { act: 'labour', b: dest };
        // at home, the midwife (or a nurse, or a neighbour who's done it before) comes to her
        if (!doc) { const mw = this.people.find((q) => q.alive !== false && ['midwife', 'nurse', 'physician'].includes(q.job?.role)) || this.people.find((q) => q.sex === 'f' && q.age > 35 && (q.children || []).length > 1 && q.household !== mum.household); if (mw) { mw.task = { act: 'visit', b: mum.home, midwife: true }; mum.midwife = mw.id; } }
        this.log(`${mum.first} ${hh?.surname || ''}'s time has come${doc ? '; she is taken to the infirmary' : '; the midwife is sent for'}.`, 'life');
        return;
      }
      if (now - mum.labour.since > 600) deliver(this, mum, hh); // (nobody's looking: a day on, the child is born)
    };
    const _enter = SP.onEnter;
    SP.onEnter = function (p, bid) {
      if (p.task?.babe != null && bid === p.task.b) { p.task = null; p.agent.carrying = null; p.app.babe = false; Ch.invalidate(p.app); return; }
      if (p.task?.act === 'labour' && bid === p.task.b) { p.labour && (p.labour.inBed = abs(this)); }
      return _enter.call(this, p, bid);
    };
    const _plan = SP.plan;
    SP.plan = function (p) {
      if (p.labour && p.task?.act === 'labour') return { act: 'labour', b: p.task.b };
      if (p.task?.midwife) return { act: 'visit', b: p.task.b };
      const r = coronationPlan(this, p) || executionPlan(this, p);
      return r || _plan.call(this, p);
    };
    // every few seconds: bellies that show, labours that end
    let tk = 0;
    game.hooks.update.push((dt) => {
      tk -= dt; if (tk > 0) return; tk = 1.5;
      const s = cur(), now = abs(s);
      for (const p of s.people) {
        if (p.sex !== 'f' || p.alive === false) continue;
        const show = !!p.pregnant && p.pregnant - s.day <= 14;
        if (!!p.app.pregnant !== show && !p.labour) { p.app.pregnant = show; Ch.invalidate(p.app); }
        if (p.labour && p.agent.inside === p.labour.b && (p.labour.inBed ??= now) && now - p.labour.inBed >= 240) deliver(s, p);
      }
    });

    // ================================================================ the coronation
    const CORONATION_H = [10, 13];
    const HIGHROLE = /steward|chamberlain|lady-in-waiting|captain|master of horse|herald|jester|butler|treasurer|magistrate|knight|reeve|mayor/;
    function coronationOn(s) { const c = PS.coronation; return c && !c.done && s.world.placeId === c.place && s.day === c.day && s.hour >= CORONATION_H[0] && s.hour < CORONATION_H[1]; }
    const lingering = (s) => { const c = PS.coronation; return c && c.done && c.doneAt && s.world.placeId === c.place && abs(s) < c.doneAt + 45; }; // (they stay a while after, and cheer you out)
    function coronationPlan(s, p) {
      if (!(coronationOn(s) || lingering(s)) || p.age < 12 || p.task?.act === 'jailed' || p.health?.illness) return null;
      const k = keepOf(s); if (!k) return null;
      const role = p.job?.role || '';
      if (['priest', 'chaplain', 'bishop'].includes(role)) return { act: 'work', b: k.id };
      if (p.gentry || p.title || HIGHROLE.test(role) || (role === 'royal guard' && p.id % 2) || (p.age >= 16 && p.id % 13 === 0)) return { act: 'worship', b: k.id };
      return null;
    }
    // set the day once you hold the crown
    game.hooks.update.push(() => {
      if (PS.anointed && O.crowned && !O.crowned()) { PS.anointed = false; PS.coronation = null; O.dropLead && O.dropLead((l) => l.why === 'coronation'); say('You are monarch no longer. The crown stays in the castle.'); return; } // left the throne: the crown stays behind
      if (!O.crowned || !O.crowned()) return;
      const s = cur(), cap = capital(); if (!cap) return;
      if (PS.anointed) return;
      if (!PS.coronation) {
        PS.coronation = { place: cap.id, day: O.SimRef.home.day + 1 };
        say('The bishop sends word: you will be crowned tomorrow in the castle chapel, between ten and one. Kneel at the altar.');
      }
      const c = PS.coronation;
      if (s.world.placeId === c.place) {
        const k = keepOf(s);
        if (k && !(PS.leads || []).some((l) => l.why === 'coronation')) O.addLead && O.addLead({ place: c.place, b: k.id, until: c.day * 1440 + CORONATION_H[1] * 60, why: 'coronation', label: 'Your coronation in the castle chapel' });
        if (s.day > c.day || (s.day === c.day && s.hour >= CORONATION_H[1])) { c.day = s.day + 1; s.log('The coronation was put off: the crown never came to the chapel.', 'politics'); say('You missed your own coronation. It is put off until tomorrow.', 'bad'); }
      }
    });
    let cer = null;
    const prevScene = O.sceneCandidate;
    O.sceneCandidate = () => {
      const sc = game.scene, s = cur();
      if (sc && !cer && sc.b.roomKey === 'chapel' && sc.b.parent?.royal && coronationOn(s)) {
        const alt = sc.L.items.find((i) => i.kind === 'altar');
        if (alt) { const [x, y] = sc.anchor(alt), p = game.player, d = Math.hypot(x - p.x, y + 18 - p.y); if (d < 50) return { type: 'custom', d, label: 'Kneel before the altar to be crowned', act: () => crown(sc, alt) }; }
      }
      return prevScene ? prevScene() : null;
    };
    function crown(sc, alt) {
      const p = game.player, [x, y] = sc.anchor(alt);
      p.x = x; p.y = y + 22; p.dir = 3; p.locked = true; p.sitting = null;
      const officiant = [...sc.actors.values()].find((a) => ['priest', 'chaplain', 'bishop'].includes(a.person?.job?.role));
      if (officiant) { officiant.x = x + 14; officiant.y = y + 12; officiant.dir = 0; }
      cer = { t: 0, x, y: y - 22, officiant };
    }
    game.hooks.update.push((dt) => {
      if (!cer) return;
      const p = game.player; cer.t += dt; p.anim = 'pray'; p.locked = true;
      for (const a of game.scene ? game.scene.actors.values() : []) if (a !== cer.officiant && a.anim !== 'sit') a.dir = O.dirOf(p.x - a.x, p.y - a.y);
      if (cer.t > 5.2 && !cer.said) {
        cer.said = true;
        const s = cur(), f = (O.Forge.player?.sex || O.Forge.player?.a?.sex) === 'f';
        PS.anointed = true; PS.coronation.done = true; PS.coronation.doneAt = abs(s); O.dropLead && O.dropLead((l) => l.why === 'coronation');
        PS.rep.civilian = Math.min(1, PS.rep.civilian + 0.25);
        s.hosted = { kind: 'midwinter', day: s.day, coronation: true }; // the coronation feast tonight
        for (const q of s.people) if (q.agent.inside === keepOf(s)?.id) s.relate(q, { id: 0 }, 0.08);
        s.log(`The new ${f ? 'queen' : 'king'} was crowned in the castle chapel. A feast is called for tonight.`, 'politics');
        O.Chronicle && O.Chronicle.deed && O.Chronicle.deed(s, `The stranger was crowned in the castle chapel.`, 'You were crowned.');
        O.UI.dialog.open({ name: 'The coronation', color: '#7a1a2a', text: `The crown is set upon your head. The chapel rings: "God save the ${f ? 'Queen' : 'King'}! God save the ${f ? 'Queen' : 'King'}!" Outside, the bells begin. There is a feast tonight in the great hall.`, options: [{ key: 'ok', label: 'Rise, crowned' }], onPick: () => { O.UI.dialog.close(); p.locked = false; p.anim = 'idle'; cer = null; } });
      }
    });
    // the crown coming down, and a little light
    const crownPx = (ctx, x, y) => {
      x = Math.round(x); y = Math.round(y);
      ctx.fillStyle = '#5a3a10'; ctx.fillRect(x - 6, y - 1, 13, 6);
      ctx.fillStyle = '#e8b830'; ctx.fillRect(x - 5, y + 1, 11, 3); ctx.fillRect(x - 5, y - 2, 2, 3); ctx.fillRect(x - 1, y - 3, 3, 4); ctx.fillRect(x + 4, y - 2, 2, 3);
      ctx.fillStyle = '#fff0a0'; ctx.fillRect(x - 5, y + 1, 11, 1);
      ctx.fillStyle = '#c8202a'; ctx.fillRect(x - 3, y + 2, 1, 1); ctx.fillRect(x + 3, y + 2, 1, 1); ctx.fillStyle = '#2a60c8'; ctx.fillRect(x, y + 2, 1, 1);
    };
    // from the feet to the crown of the head (the head's top in the frame, less a little so the crown sits on it)
    const HEAD_Y = (p) => { const hy = Ch.headY(p.a); return Ch.GROUND - (hy.cy - hy.ry) + 3 - (p.anim === 'pray' ? -1 : p.sitting || p.anim === 'sit' ? 5 : 0); };
    // a crowned monarch wears the crown
    game.hooks.drawTop.push((ctx, cam) => {
      const p = game.player; if (cer || !PS.anointed || !O.crowned || !O.crowned() || p.inBed || p.mount) return;
      crownPx(ctx, p.x - cam.x + (p.dir === 1 ? -1 : p.dir === 2 ? 1 : 0), p.y - HEAD_Y(p) - cam.y);
    });
    game.hooks.drawTop.push((ctx, cam, indoor) => {
      if (!cer || !indoor) return;
      const p = game.player, k = O.clamp((cer.t - 1.5) / 3.5, 0, 1), e = 1 - Math.pow(1 - k, 2);
      const x = cer.x + (p.x - cer.x) * e - cam.x, y = cer.y + (p.y - HEAD_Y(p) - cer.y) * e - cam.y;
      if (cer.t > 1) { ctx.globalAlpha = 0.18 + 0.1 * Math.sin(cer.t * 6); ctx.fillStyle = '#fff4c0'; ctx.fillRect(Math.round(p.x - cam.x) - 10, 0, 20, Math.round(p.y - cam.y)); ctx.globalAlpha = 1; }
      crownPx(ctx, x, y);
      if (cer.t > 5) for (let i = 0; i < 6; i++) { const a = cer.t * 2 + i, r = 10 + ((cer.t * 20 + i * 7) % 14); ctx.fillStyle = '#fff6c8'; ctx.fillRect(Math.round(p.x - cam.x + Math.cos(a) * r), Math.round(p.y - 30 - cam.y + Math.sin(a) * r * 0.6), 1, 1); }
    });

    // ================================================================ the block
    const CAPITAL_CRIME = /murder|kill|slay|treason|sedition|regicide|arson|bandit|highway/;
    const _arrest = SP.arrestNPC;
    SP.arrestNPC = function (q, crime, wrong) {
      _arrest.call(this, q, crime, wrong);
      if (wrong || !q.sentence) return;
      q.convictions = (q.convictions || 0) + 1;
      if (CAPITAL_CRIME.test(crime.kind || '') || (crime.severity || 1) >= 5 || q.convictions >= 3) condemn(this, q, q.convictions >= 3 && !CAPITAL_CRIME.test(crime.kind || '') ? `${crime.kind}, a third time` : crime.kind);
    };
    function condemn(s, q, why) {
      s.executions = (s.executions || []).filter((e) => e.id !== q.id);
      const day = s.day + 2;
      s.executions.push({ id: q.id, day, why });
      q.jailUntil = day + 1; q.task = { act: 'jailed', b: s.prisonId() };
      q.sentence = Object.assign(q.sentence || {}, { death: day, crime: `${why}: to the block on day ${day}`, bail: null });
      s.remember(q, `Condemned to die for ${why}.`, 'crime', 3);
      for (const id of s.household(q)?.members || []) { const r = s.byId.get(id); if (r && r !== q) { r.mood -= 0.4; s.remember(r, `${q.first} is to be executed.`, 'grief', 2, q.id); } }
      s.log(`${q.name} is condemned to die on the block in the square, the day after tomorrow at half past ten, for ${why}.`, 'crime');
    }
    O.condemn = condemn;
    const todays = (s) => (s.executions || []).filter((e) => e.day === s.day && !e.done && s.byId.get(e.id)?.sentence?.death === e.day && s.byId.get(e.id)?.alive !== false);
    // the scaffold goes on a clear patch of the square (not on the well or a stall), with room in front for the crowd
    function scaffoldTile(s) {
      if (s._scaffold) return s._scaffold;
      const [x0, y0, x1, y1] = s.Z.square, w = s.world, free = (x, y) => x >= 0 && y >= 0 && x < w.W && y < w.H && w.solid[y * w.W + x] !== 1;
      let best = [Math.floor((x0 + x1) / 2), y0 + 1], bs = -1e9;
      for (let by = y0; by <= y1; by++) for (let bx = x0 + 2; bx <= x1 - 2; bx++) {
        let ok = true; for (let y = by - 1; y <= by + 1 && ok; y++) for (let x = bx - 2; x <= bx + 2; x++) if (!free(x, y)) { ok = false; break; }
        if (!ok) continue;
        let room = 0; for (let y = by + 2; y <= by + 5; y++) for (let x = bx - 5; x <= bx + 5; x++) if (free(x, y)) room++;
        const sc = room - Math.abs(bx - (x0 + x1) / 2) * 0.5; if (sc > bs) { bs = sc; best = [bx, by]; }
      }
      return (s._scaffold = best);
    }
    const playerHeadsman = (s) => PS.emp && PS.emp.role === 'executioner' && PS.emp.place === s.world.placeId;
    function headsmanOf(s) {
      if (playerHeadsman(s)) return null;
      return s.people.find((q) => q.job?.role === 'executioner' && q.alive !== false) || s.people.find((q) => /sergeant|^guard$|watchman/.test(q.job?.role || '') && q.alive !== false && q.activity?.act !== 'sleep');
    }
    function executionPlan(s, p) {
      const list = todays(s); if (!list.length) return null;
      const h = s.hour;
      if (h < 9.5 || h >= 11.75) return null;
      const e = list[0];
      if (p.id === e.id) { if (h >= 10) return { act: 'condemned', outdoor: true, zone: 'scaffold' }; return null; }
      const hm = headsmanOf(s);
      if (hm && p.id === hm.id) return { act: 'headsman', outdoor: true, zone: 'scaffold' };
      if (/^guard$|watchman|sergeant/.test(p.job?.role || '') && p.id % 3 === 0) return { act: 'watch', outdoor: true, zone: 'scaffold' };
      const kin = s.household(s.byId.get(e.id))?.members.includes(p.id);
      if (p.age >= 10 && !p.visitor && (kin || p.id % 3 === 0) && p.activity?.act !== 'sleep' && !p.health?.illness) return { act: 'watch', outdoor: true, zone: 'scaffold' };
      return null;
    }
    const _zone = SP.zoneTile;
    SP.zoneTile = function (p, zone) {
      if (zone !== 'scaffold') return _zone.call(this, p, zone);
      const [bx, by] = scaffoldTile(this), act = p.activity?.act || p.task?.act;
      if (act === 'condemned') return [bx, by];
      if (act === 'headsman') return [bx + 1, by];
      if (act === 'stand') return [bx + (p.id % 2 ? -2 : 2), by + 1];
      const k = p.id % 33; return [bx - 5 + (k % 11), by + 4 + Math.floor(k / 11)];
    };
    // the scaffold: a platform of planks, steps, the block, and straw on the boards
    function drawScaffold(ctx, cam, s) {
      const [bx, by] = scaffoldTile(s), x = Math.round((bx - 1.5) * T - cam.x), y = Math.round((by - 0.6) * T - cam.y), w = T * 4 + 8, hgt = 30;
      ctx.fillStyle = '#2a1c12'; ctx.fillRect(x - 1, y - 1, w + 2, hgt + 10);
      ctx.fillStyle = '#7a5a3a'; ctx.fillRect(x, y, w, hgt - 8); // the boards
      ctx.fillStyle = '#6a4a2e'; for (let i = 0; i < w; i += 6) ctx.fillRect(x + i, y, 1, hgt - 8);
      ctx.fillStyle = '#4a3220'; ctx.fillRect(x, y + hgt - 8, w, 8); // the front face
      ctx.fillStyle = '#3a2618'; for (const px of [x + 2, x + w - 6, x + w / 2 - 2]) ctx.fillRect(px, y + hgt - 8, 4, 16); // posts
      ctx.fillStyle = '#5a3e26'; ctx.fillRect(x + w - 20, y + hgt, 14, 3); ctx.fillRect(x + w - 18, y + hgt + 3, 12, 3); // steps
      ctx.fillStyle = '#c8b060'; for (let i = 0; i < 9; i++) ctx.fillRect(x + 8 + ((i * 17) % (w - 16)), y + 4 + ((i * 7) % 12), 3, 1); // straw
      // the block
      const kx = Math.round(bx * T - cam.x) - 4, ky = y + 9;
      ctx.fillStyle = '#2a1c12'; ctx.fillRect(kx - 1, ky - 1, 12, 9); ctx.fillStyle = '#5a3a22'; ctx.fillRect(kx, ky, 10, 7); ctx.fillStyle = '#6e4a2c'; ctx.fillRect(kx, ky, 10, 2); ctx.fillStyle = '#3a2416'; ctx.fillRect(kx + 4, ky, 2, 2);
    }
    let ex = null; // the execution under way where you are: { e, q, h, t }
    // nobody stands on the scaffold but the condemned and the headsman
    game.hooks.update.push(() => {
      const s = cur(); if (game.scene || !s.executions || !s.executions.some((z) => z.day === s.day) || s.hour < 6 || s.hour >= 14) return;
      const [bx, by] = scaffoldTile(s), L = (bx - 2.6) * T, R = (bx + 2.6) * T, Tp = (by - 1) * T, B = (by + 3.2) * T;
      for (const q of s.people) { const a = q.agent; if (!a || a.hidden || a.inside != null || ['condemned', 'headsman'].includes(q.activity?.act) || (ex && (q === ex.q || q === ex.h))) continue; if (a.x > L && a.x < R && a.y > Tp && a.y < B) { a.y = B + 2; a.path = null; } }
      const p = game.player; if (p.x > L && p.x < R && p.y > Tp && p.y < B && !(ex && ex.byPlayer)) p.y = B + 2;
    });
    game.hooks.drawGround.push((ctx, cam) => {
      const s = cur(); if (!s.executions || game.scene) return;
      const e = s.executions.find((z) => z.day === s.day);
      if (e && s.hour >= 6 && s.hour < 14) drawScaffold(ctx, cam, s);
    });
    function strike(s) {
      ex.struck = true; ex.t2 = 0; ex.e.done = true;
      O.Audio && O.Audio.play && O.Audio.play('hit');
      game.shake = Math.max(game.shake || 0, 0.25);
    }
    function finish(s) {
      const q = ex.q;
      q.agent.frozen = false; q.sentence = null; q.jailUntil = null; q.task = null;
      s.die(q, `was beheaded in the square for ${ex.e.why}`);
      for (const p of s.people) if (p.activity?.act === 'watch' && Math.random() < 0.3) s.remember(p, `Watched ${q.first} die on the block.`, 'crime', 1, q.id);
      if (ex.h) ex.h.agent.frozen = false;
      if (ex.byPlayer) { PS.money += 6; say('It is done. The sheriff\'s man counts ₳6 into your hand: the headsman\'s fee.'); }
      ex = null;
    }
    game.hooks.update.push((dt) => {
      const s = cur(), list = s.executions ? todays(s) : []; if (!list.length && !ex) return;
      const e = list[0];
      // nobody to see it (you're indoors, or elsewhere): it happens all the same
      if (e && !ex && s.hour >= 10.75 && (game.scene || !s.byId.get(e.id)?.agent || s.byId.get(e.id).agent.inside != null || s.hour >= 11.4)) {
        const q = s.byId.get(e.id); e.done = true; q.sentence = null; q.jailUntil = null; q.task = null; s.die(q, `was beheaded in the square for ${e.why}`);
        if (playerHeadsman(s)) say('The sergeant did the headsman\'s work, since you never came. Your master will hear of it.', 'bad');
        return;
      }
      if (game.scene) return;
      if (e && !ex && s.hour >= 10.1) {
        const q = s.byId.get(e.id), [bx, by] = scaffoldTile(s), tx = bx * T + 8, ty = by * T + 12;
        const qa = q.agent, dd = Math.hypot(qa.x - tx, qa.y - ty);
        // the last of the way he's walked up by the guards, straight to the block
        if (qa.inside == null && q.activity?.act === 'condemned' && dd >= 4 && dd < 200) { const sp = Math.min(dd, 34 * dt); qa.frozen = true; qa.path = null; qa.x += (tx - qa.x) / dd * sp; qa.y += (ty - qa.y) / dd * sp; qa.dir = O.dirOf(tx - qa.x, ty - qa.y); qa.anim = 'walk'; qa.ft += dt; }
        if (qa.inside == null && dd < 4) {
          const h = headsmanOf(s);
          ex = { e, q, h, t: 0, tx, ty, byPlayer: playerHeadsman(s) };
          q.agent.frozen = true; q.agent.path = null;
          if (h && h.agent.inside == null) { h.agent.frozen = true; h.agent.path = null; }
          s.log(`The condemned, ${q.name}, is brought up onto the scaffold.`, 'crime');
          if (!ex.byPlayer && Math.hypot(game.player.x - tx, game.player.y - ty) < 260) say(`The crowd goes quiet. ${q.first} kneels at the block.`);
        }
      }
      if (!ex) return;
      if (ex.byPlayer && !ex.struck && s.hour >= 11.5) { ex.byPlayer = false; say('You never swung. A sergeant takes the axe from the rack and does it himself. Your master will hear of it.', 'bad'); strike(s); return; }
      ex.t += dt;
      const q = ex.q, a = q.agent;
      a.x = ex.tx; a.y = ex.ty + 2; a.dir = 0; a.anim = ex.struck ? 'lie' : 'pray'; a.frozen = true; a.path = null;
      if (ex.struck) { ex.t2 += dt; if (ex.t2 > 1.4) { finish(s); return; } }
      if (ex.h && !ex.struck && ex.h.agent.inside == null) {
        const ha = ex.h.agent; ha.x = ex.tx + 18; ha.y = ex.ty; ha.dir = 1;
        if (ex.t < 3) { ha.anim = 'idle'; } else { ha.anim = 'chop'; ha.ft = ex.t < 4 ? 0 : 0.26; if (ex.t > 4.1) strike(s); }
      } else if (!ex.byPlayer && !ex.struck && ex.t > 4) strike(s);
      if (ex && ex.h && ex.struck) { ex.h.agent.anim = 'chop'; ex.h.agent.ft = 0.5; }
      // a gasp from the crowd
      if (ex && ex.struck && !ex.gasp) { ex.gasp = true; for (const p of s.people) if (p.activity?.act === 'watch' && p.agent.inside == null) { p.agent.dir = 0; } }
    });
    // the headsman's own work: E at the block
    const hookStall = () => {
      const prev = O.stallCandidate;
      O.stallCandidate = () => {
        const s = cur();
        if (ex && ex.byPlayer && !ex.struck && !game.scene) { const d = Math.hypot(game.player.x - (ex.tx + 18), game.player.y - ex.ty); if (d < 30) return { type: 'custom', d, label: 'Swing the axe', act: () => { const p = game.player; p.anim = 'chop'; p.ft = 0; p.dir = 1; p.swinging = true; setTimeout(() => { p.swinging = false; p.anim = 'idle'; strike(s); }, 700); } }; }
        return prev ? prev() : null;
      };
    };
    let hooked = false; game.hooks.update.push(() => { if (!hooked) { hooked = true; hookStall(); } });
  }
  O.RitesSetup = { setup };
})();
