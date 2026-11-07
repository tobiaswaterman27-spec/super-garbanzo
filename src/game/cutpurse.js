// Cutpurses, seen at work. Where folk crowd (the square on a busy day, a fair, a market, a knot of
// gossips), a gang's lifter or a desperate lad sidles up behind someone, dips, and walks off a little
// too briskly with a glint in his hand. Sometimes the mark feels it: a start, a pat of the belt, a
// shout of "Thief!", and a chase through the street with the watch joining in; the cutpurse may get
// clean away, be run down and made to give it back, or be taken. If you saw it, say so: to the mark
// ("he's had your purse"), to the thief ("give it back, I saw you"), or to the watch.
'use strict';
(function () {
  const T = 16;
  function setup(game) {
    const cur = () => O.SimRef.cur, PS = O.PlayerState;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    const say = (q, t, secs) => O.Speech && O.Speech.say(q, t, secs || 1.8);
    const open = (x, y) => !game.solidAt(x - 3, y - 2) && !game.solidAt(x + 3, y - 2);
    const dist = (a, b) => Math.hypot(a.agent.x - b.agent.x, a.agent.y - b.agent.y);
    const nearP = (q, r) => Math.hypot(q.agent.x - game.player.x, q.agent.y - game.player.y) < r;
    const isWatch = (q) => /guard|sergeant|watch|captain|constable/.test(q.job?.role || '');
    const outdoors = (q) => q.agent && !q.agent.hidden && q.agent.inside == null && q.alive !== false;
    const free = (q) => outdoors(q) && !q.agent.frozen && !q.errand && !q._scene && !q._playing && !q._fighting && !q._bit && !q._cp && !q.jailUntil && !(O.npcUI && O.npcUI.talking && O.npcUI.talking() === q);
    let job = null, cool = 25;
    const recent = []; // dips you might have seen: { thief, victim, amt, t, back }
    function steer(q, tx, ty, dt, sp, an) { const a = q.agent, dx = tx - a.x, dy = ty - a.y, d = Math.hypot(dx, dy); if (d < 2) return true; const st = Math.min(d, sp * dt); let nx = a.x + dx / d * st, ny = a.y + dy / d * st; if (open(nx, ny)) { a.x = nx; a.y = ny; } else if (open(nx, a.y)) a.x = nx; else if (open(a.x, ny)) a.y = ny; else { a.x += (Math.random() - 0.5) * 3; } a.forceAnim = an || 'walk'; a.dir = O.dirOf(dx, dy); return false; }
    const hold = (q) => { q._cp = true; q.agent.frozen = true; q.agent.path = null; };
    const let_go = (q) => { if (!q || !q._cp) return; q._cp = false; q.agent.forceAnim = null; const tq = O.npcUI && O.npcUI.talking && O.npcUI.talking(); if (tq !== q) q.agent.frozen = false; };
    const purseOf = (s, q) => s.household(q);
    function thiefFor(s, crowd) {
      return s.people.find((q) => free(q) && q.age >= 13 && q.age <= 40 && !isWatch(q) && nearP(q, 500) && (q.gang && q.gang !== 'player' ? true : ((purseOf(s, q)?.money || 0) < 6 && (q.traits || []).some((t) => /greedy|dishonest|hostile|risk/.test(t)))) && crowd.some((v) => v !== q && dist(q, v) < 160));
    }
    function crowdNear(s) { // people standing about near you, close enough together
      const ppl = s.people.filter((q) => outdoors(q) && q.age >= 16 && !q.visitor && nearP(q, 380) && !isWatch(q) && (purseOf(s, q)?.money || 0) >= 8);
      return ppl.filter((q) => ppl.filter((o) => o !== q && dist(o, q) < 70).length >= 1);
    }
    function begin(s, force) {
      const crowd = crowdNear(s); if (!crowd.length && !force) return false;
      const thief = force?.thief || thiefFor(s, crowd); if (!thief) return false;
      const victim = force?.victim || crowd.filter((v) => v !== thief && v.gang !== thief.gang).sort((a, b) => dist(a, thief) - dist(b, thief))[0]; if (!victim) return false;
      hold(thief); job = { s, thief, victim, stage: 'sidle', t: 0, skill: (thief.skills && thief.skills.stealth) || 0.3, flee: null, chasers: [] };
      return true;
    }
    function end() { if (!job) return; let_go(job.thief); for (const c of job.chasers) let_go(c); job = null; cool = 50 + Math.random() * 60; }
    function caught(by) {
      const { s, thief, victim } = job; const hh = purseOf(s, victim), th = purseOf(s, thief);
      if (th && hh && job.amt) { const back = Math.min(job.amt, th.money); th.money -= back; hh.money += back; }
      O.gesture && O.gesture(thief, 'shake', 1); O.gesture && O.gesture(by, 'attack', 0.5); O.sfx && nearP(by, 300) && O.sfx('smack', 0.5);
      if (isWatch(by)) { say(by, pick(['Got you, you little rat.', 'That\'s the stocks for you.', 'Come along. Quietly.'])); const cr = s.recordCrime({ kind: 'pickpocket', perp: thief, placeName: s.world.name, tile: [Math.floor(thief.agent.x / T), Math.floor(thief.agent.y / T)], seen: job.chasers.filter((c) => c !== by).slice(0, 3), victimPerson: victim, severity: 1 }); setTimeout(() => { s.arrestNPC && s.arrestNPC(thief, cr, false); }, 1800); }
      else { say(by, pick(['Give it here! Now!', 'Thought you\'d have that, did you?', 'Hand it over, thief.'])); setTimeout(() => say(thief, pick(['All right! All right! Take it!', 'Get off me!', 'I found it on the ground, I swear.'])), 900); s.relate(victim, thief, -0.4); s.remember(victim, `${thief.first} cut my purse in the street; I ran them down and had it back.`, 'grudge', 2.5); }
      if (by === victim) setTimeout(() => say(victim, 'Every penny.'), 2200);
      if (PS) { const r = recent.find((x) => x.thief === thief && !x.back); if (r) r.back = true; }
      setTimeout(end, 2600); job.stage = 'over';
    }
    function cry(who) { // a shout goes up and the chase is on
      const { s, thief, victim } = job; job.stage = 'chase'; job.t = 0;
      hold(victim); victim.agent.forceAnim = 'shocked'; say(victim, pick([`Thief! Stop, thief! ${thief.first} has my purse!`, 'My purse! Stop him!', 'Thief! Thief!']), 2.4); job.chasers = [victim];
      for (const q of s.people) { if (q === thief || q === victim || !free(q) || dist(q, thief) > 260) continue; if (isWatch(q) && job.chasers.length < 4) { hold(q); job.chasers.push(q); say(q, 'Stop in the King\'s name!'); } else if (q.age >= 15 && dist(q, thief) < 140 && Math.random() < 0.3 && job.chasers.length < 4) { hold(q); job.chasers.push(q); } else if (dist(q, thief) < 140) O.gesture && O.gesture(q, Math.random() < 0.5 ? 'shocked' : 'point', 1.5); }
      const a = thief.agent; let best = null; for (let k = 0; k < 16; k++) { const ang = k / 16 * Math.PI * 2, tx = a.x + Math.cos(ang) * 260, ty = a.y + Math.sin(ang) * 200; if (!open(tx, ty)) continue; const away = Math.hypot(tx - victim.agent.x, ty - victim.agent.y); if (!best || away > best[2]) best = [tx, ty, away]; } job.flee = best ? [best[0], best[1]] : [a.x + 200, a.y];
      if (who === 'player') say(victim, 'Thank you! After him!');
    }
    game.hooks.update.push((dt) => {
      const s = cur(); if (!s) return;
      for (const r of recent.slice()) if (performance.now() - r.t > 120000) recent.splice(recent.indexOf(r), 1);
      if (!job) { cool -= dt; if (cool > 0 || game.scene) return; cool = 8; const h = s.minute / 60; if (h < 8 || h > 21) return; if (Math.random() < 0.5) begin(s); return; }
      if (game.scene || job.s !== s || job.thief.alive === false || !outdoors(job.thief) || (O.npcUI && O.npcUI.talking && O.npcUI.talking() === job.thief && job.stage !== 'away')) { end(); return; }
      const { thief, victim } = job, ta = thief.agent, va = victim.agent; job.t += dt;
      if (job.stage === 'sidle') { // round behind the mark, idly
        const behind = [va.x + (va.dir === 2 ? -9 : va.dir === 1 ? 9 : 0), va.y + (va.dir === 3 ? 6 : va.dir === 0 ? -5 : 0)];
        if (!outdoors(victim) || job.t > 25) { end(); return; }
        if (steer(thief, behind[0], behind[1], dt, 30, 'walk')) { job.stage = 'dip'; job.t = 0; ta.dir = O.dirOf(va.x - ta.x, va.y - ta.y); } return;
      }
      if (job.stage === 'dip') { ta.forceAnim = 'take'; if (job.t < 1.1) return;
        const hh = purseOf(s, victim), th = purseOf(s, thief); const amt = Math.max(1, Math.min(hh ? Math.floor(hh.money * 0.08) : 1, 3 + Math.floor(Math.random() * 6))); job.amt = 0; if (hh && hh.money >= amt) { hh.money -= amt; job.amt = amt; if (th) th.money += amt; }
        job.glint = { x0: va.x, y0: va.y - 10, t: 0 }; job.stage = 'away'; job.t = 0;
        const sawMe = nearP(thief, 220) && !game.scene; if (sawMe) recent.push({ thief, victim, amt: job.amt, t: performance.now() });
        if (thief.gang && s.gang) { const g = s.gang(thief.gang); if (g) g.purse = (g.purse || 0) + Math.floor(job.amt / 2); }
        const feel = Math.random() < 0.38 - job.skill * 0.25; job.feel = feel ? 1.2 + Math.random() : 0;
        const a = ta; let away = null; for (let k = 0; k < 12; k++) { const ang = k / 12 * Math.PI * 2, tx = a.x + Math.cos(ang) * 120, ty = a.y + Math.sin(ang) * 80; if (open(tx, ty) && Math.hypot(tx - va.x, ty - va.y) > 90) { away = [tx, ty]; break; } } job.away = away || [a.x + 100, a.y];
        return;
      }
      if (job.glint) { job.glint.t += dt; if (job.glint.t > 0.4) job.glint = null; }
      if (job.stage === 'away') { const done = steer(thief, job.away[0], job.away[1], dt, 46, 'walk');
        if (job.feel && job.t > job.feel) { job.feel = 0; O.gesture && O.gesture(victim, 'shocked', 0.8); setTimeout(() => { if (job && job.victim === victim && job.stage === 'away') cry(); }, 800); }
        if (done || job.t > 9) end(); return;
      }
      if (job.stage === 'chase') { const tspeed = 64 + job.skill * 14; steer(thief, job.flee[0], job.flee[1], dt, tspeed, 'run'); if (Math.hypot(ta.x - job.flee[0], ta.y - job.flee[1]) < 4) { if (Math.random() < 0.5) job.flee = [ta.x + (Math.random() - 0.5) * 300, ta.y + (Math.random() - 0.5) * 200]; if (!open(job.flee[0], job.flee[1])) job.flee = [ta.x, ta.y]; }
        let got = null; for (const c of job.chasers) { const sp = isWatch(c) ? 70 : 58 + Math.random() * 18 + (c.age < 30 ? 6 : 0); steer(c, ta.x, ta.y, dt, sp, 'run'); if (!got && dist(c, thief) < 9) got = c; }
        if (Math.random() < dt * 0.06) { ta.forceAnim = 'hurt'; job.flee = [ta.x, ta.y]; } // a stumble
        if (got) { caught(got); return; }
        if (job.t > 14 || job.chasers.every((c) => dist(c, thief) > 220)) { for (const c of job.chasers) { c.agent.forceAnim = 'idle'; } say(victim, pick(['Gone. Curse him.', 'Lost him. My week\'s money...', 'I know your face!']), 2); s.remember(victim, `${thief.first} cut my purse in the street and got away.`, 'grudge', 3); s.relate(victim, thief, -0.5); job.stage = 'over'; setTimeout(end, 1500); }
      }
    });
    game.hooks.drawWorld.push((ctx, cam) => { if (!job || !job.glint || game.scene) return; const g = job.glint, a = job.thief.agent, k = g.t / 0.4, x = g.x0 + (a.x - g.x0) * k, y = g.y0 + (a.y - 12 - g.y0) * k; ctx.fillStyle = '#e0c050'; ctx.fillRect(Math.round(x - cam.x), Math.round(y - cam.y), 2, 2); ctx.fillStyle = '#fff6c8'; ctx.fillRect(Math.round(x - cam.x) + 1, Math.round(y - cam.y) - 1, 1, 1); });

    // what you saw, in your own words
    const respond = (q, t, line, render) => { (q._conv ||= []).push({ who: 'p', t }, { who: 'q', t: line }); render(line); return Promise.resolve(); };
    const _say = O.AIChat && O.AIChat.say;
    if (_say) O.AIChat.say = function (q, text, render, opt) {
      try {
        const s = cur(), t = String(text || '');
        const r = recent.find((x) => !x.back && (x.victim === q || x.thief === q));
        if (r && x_is(t)) {
          if (q === r.victim) { r.back = true; const live = job && job.victim === q && job.stage === 'away'; if (live) { O.npcUI.closeTalk && O.npcUI.closeTalk(); setTimeout(() => job && cry('player'), 300); return respond(q, t, 'What? My purse! THIEF!', render); }
            s.remember(q, `The stranger told me ${r.thief.first} had cut my purse.`, 'crime', 2); s.relate(q, { id: 0 }, 0.15); O.gesture && O.gesture(q, 'shocked', 1.2);
            return respond(q, t, `${r.thief.first}? My purse... it's light! ${r.amt ? `${r.amt} aurin gone` : 'They got nothing, thank God, but they tried'}. I'll have the watch on them. Thank you, friend.`, render); }
          if (q === r.thief) { const hh = s.household(r.victim), th = s.household(q); const bold = (q.traits || []).includes('hostile') || Math.random() < 0.35;
            if (bold) { r.back = true; s.relate(q, { id: 0 }, -0.3); return respond(q, t, 'Saw nothing, you did. And you\'ll say nothing, if you know what\'s good for you.', render); }
            if (th && hh && r.amt) { const back = Math.min(r.amt, th.money); th.money -= back; hh.money += back; } r.back = true; O.gesture && O.gesture(q, 'give', 1); s.relate(q, { id: 0 }, -0.2); s.remember(r.victim, `${q.first} gave my money back, shamefaced. Someone must have seen.`, 'crime', 1.5);
            return respond(q, t, `All right, all right, keep your voice down. Here. I'll put it back in their hand myself. You never saw me.`, render); }
        }
        if (isWatch(q) && /cut.?purse|pick.?pocket|purse|lifted|\bthie[fv]/i.test(t)) { const r2 = recent.find((x) => !x.back && !x.thief.jailUntil); if (r2) { r2.back = true; const cr = s.recordCrime({ kind: 'pickpocket', perp: r2.thief, placeName: s.world.name, tile: [Math.floor(r2.thief.agent.x / T), Math.floor(r2.thief.agent.y / T)], seen: [], victimPerson: r2.victim, severity: 1 }); s.arrestNPC && s.arrestNPC(r2.thief, cr, false); PS.rep.guard = Math.min(1, (PS.rep.guard || 0) + 0.05); return respond(q, t, `${r2.thief.first}, cutting purses in broad day? I'll have them. You did well to tell me.`, render); } }
      } catch (e) { console.error(e); }
      return _say.apply(this, arguments);
    };
    const x_is = (t) => /\b(purse|pocket|cut|lift|lifted|stole|steal|took|taken|nick|nicked|thief|robbed|saw you|give it back|give that back|hand it back|put it back)\b/i.test(t);
    (O.extraLines = O.extraLines || []).push((s, q) => { const r = recent.find((x) => x.thief === q && !x.back); return r ? `A minute ago you cut ${r.victim.first}'s purse in the street (${r.amt} aurin). If the player says they saw, you may deny it, threaten them, or give it back.` : ''; });
    O.Cutpurse = { start: (thief, victim) => begin(cur(), { thief, victim }), get job() { return job; }, recent, cry: () => job && cry() };
  }
  O.CutpurseSetup = { setup };
})();
