// Street callers, going door to door. Most days somebody with no place of their own goes round the houses
// crying a trade: the knife-grinder pushing his wheel on its barrow ("Knives to grind!"), who stops and
// treadles it while the sparks fly off the blade; the ratcatcher with his pole hung with rats and his
// terrier at his heels ("Rats! Any rats?"), the dog nosing round the corners of the house; the tinker
// hung about with pots and pans that clank as he walks ("Pots to mend!"), tapping a patch onto a kettle on
// the step; and the pie-woman with her tray on her head ("Hot pies!"). Someone from the house comes to the
// door, hands over the work or a coin, and takes it back done.
'use strict';
(function () {
  const T = 16;
  function setup(game) {
    const cur = () => O.SimRef.cur;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    const KINDS = { grinder: { cry: ['Knives to grind!', 'Scissors, knives, sickles!', 'Sharp as a sword, a penny a blade!'], work: 'pitch', secs: 9 }, rats: { cry: ['Rats! Any rats?', 'Ratcatcher! Rats and mice!', 'Rats to catch, rats!'], work: 'crouch', secs: 8 }, tinker: { cry: ['Pots to mend!', 'Any old pots and pans?', 'Kettles mended!'], work: 'hammer', secs: 9 }, pies: { cry: ['Hot pies! Hot!', 'Pies, hot pies, mutton and pork!', 'Fresh from the oven!'], work: 'give', secs: 4 } };
    const callers = [], sparks = []; let cool = 20;
    const near = (x, y, r) => Math.hypot(x - game.player.x, y - game.player.y) < r;
    const say = (q, t, d) => q.agent && near(q.agent.x, q.agent.y, 300) && O.Speech && O.Speech.say(q, t, d || 2.5);
    const freeAt = (q) => q && q.alive !== false && q.agent && !q.agent.hidden && q.agent.inside == null && !q.agent.frozen && !q.agent.mount && !q.errand && !q._bit && !q._scene && !q._call && !q.visitor && !(O.npcUI && O.npcUI.talking && O.npcUI.talking() === q);
    function finish(C) { const q = C.q; if (q.agent) { q.agent.forceAnim = null; if (!(O.npcUI && O.npcUI.talking && O.npcUI.talking() === q)) q.agent.frozen = false; } q._call = null; if (C.client) { const a = C.client.agent; if (a) { a.forceAnim = null; a.frozen = false; } C.client._call = null; } callers.splice(callers.indexOf(C), 1); }
    function nextStop(C) {
      const s = C.s, q = C.q; if (C.stops.length === 0 || game.t > C.until) { say(q, 'That\'s me done.'); finish(C); return; }
      const b = C.stops.shift(); C.b = b; C.phase = 'walk'; C.cry = 0;
      O.Errands.send(s, q, [b.doorX + 1, b.doorY + 1], { anim: 'idle', secs: 0.2, face: 1, giveUp: game.t + 70, after: (ok) => {
        if (!ok || !q.agent || C.done) { if (!C.done) nextStop(C); return; }
        const a = q.agent; a.frozen = true; a.path = null; a.dir = 1; C.phase = 'knock'; C.t = 0;
        say(q, pick(KINDS[C.kind].cry));
        // does anyone come out?
        const home = s.people.filter((x) => x.home === b.id && x !== q && x.age >= 12 && x.agent && (x.agent.inside === b.id || (!x.agent.hidden && Math.hypot(x.agent.x - b.doorX * T, x.agent.y - b.doorY * T) < 200)) && !x.agent.frozen && !x.errand && !x._call && !(O.npcUI && O.npcUI.talking && O.npcUI.talking() === x));
        const c = home.length && Math.random() < 0.75 ? pick(home) : null; C.client = null;
        if (!c) { C.phase = 'wait'; return; }
        c._call = 'client';
        O.Errands.send(s, c, [b.doorX, b.doorY + 1], { anim: 'give', secs: 1.2, face: 2, giveUp: game.t + 25, after: (ok2) => { if (!ok2 || !c.agent || C.done) { c._call = null; return; } c.agent.frozen = true; c.agent.path = null; c.agent.dir = 2; C.client = c; C.phase = 'work'; C.t = 0; } });
      } });
    }
    game.hooks.update.push((dt) => {
      for (const p of sparks.slice()) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 90 * dt; if (p.t > 0.5) sparks.splice(sparks.indexOf(p), 1); }
      const s = cur(); if (!s || !s.world || game.scene) return; const hr = s.minute / 60;
      for (const C of callers.slice()) {
        const q = C.q, a = q.agent; C.t += dt; C.ft += dt;
        if (C.s !== s || !a || q.alive === false || hr > 18.5 || s.raining || (O.npcUI && O.npcUI.talking && O.npcUI.talking() === q && C.phase !== 'walk')) { C.done = true; finish(C); continue; }
        // a trail for the dog
        C.trail.push([a.x, a.y]); if (C.trail.length > 40) C.trail.shift();
        if (C.phase === 'walk') { C.cry -= dt; if (C.cry <= 0) { C.cry = 9 + Math.random() * 6; say(q, pick(KINDS[C.kind].cry)); } if (C.kind === 'tinker' && a.path && Math.random() < dt * 1.2 && near(a.x, a.y, 200)) O.sfx && O.sfx('place', 0.06); }
        else if (C.phase === 'wait') { a.forceAnim = 'idle'; if (C.t > 5) { a.frozen = false; a.forceAnim = null; nextStop(C); } }
        else if (C.phase === 'knock') { a.forceAnim = 'idle'; if (C.t > 22) { a.frozen = false; nextStop(C); } }
        else if (C.phase === 'work') {
          const K = KINDS[C.kind]; a.forceAnim = K.work; if (C.client) C.client.agent.forceAnim = C.t < 1.5 ? 'give' : C.t > K.secs - 1.5 ? 'take' : 'idle';
          if (C.kind === 'grinder' && Math.random() < dt * 14) sparks.push({ x: a.x - 12, y: a.y - 10, vx: -20 - Math.random() * 40, vy: -20 - Math.random() * 30, t: 0 });
          if (C.kind === 'grinder' && Math.random() < dt * 2 && near(a.x, a.y, 200)) O.sfx && O.sfx('saw', 0.06);
          if (C.kind === 'tinker' && Math.random() < dt * 2.5 && near(a.x, a.y, 200)) O.sfx && O.sfx('smack', 0.07);
          if (C.kind === 'rats' && C.t > 3 && !C.caught && Math.random() < dt * 0.4) { C.caught = true; C.rats++; say(q, pick(['Got him! A big one.', 'There\'s your trouble.', 'Look at the size of him!'])); }
          if (C.t > K.secs) { const pay = C.kind === 'pies' ? 1 : 2; if (C.client) try { const hc = s.household(C.client), hq = s.household(q); if (hc && hq && hc !== hq && hc.money >= pay) { hc.money -= pay; hq.money += pay; C.earned += pay; } } catch (e) { /* */ } if (C.client) { say(C.client, pick(['Thank you kindly.', 'Here.', 'Mind you come back next month.']), 2); const ca = C.client.agent; ca.frozen = false; ca.forceAnim = null; C.client._call = null; C.client = null; } C.caught = false; a.frozen = false; a.forceAnim = null; nextStop(C); }
        }
      }
      cool -= dt; if (cool > 0) return; cool = 25 + Math.random() * 25;
      if (hr < 8.5 || hr > 16 || s.raining || (game.isNight && game.isNight()) || callers.filter((c) => c.s === s).length >= 2) return;
      const P = game.player, houses = s.world.buildings.filter((b) => b.type === 'house' && b.doorX != null && !b.site && Math.hypot(b.doorX * T - P.x, b.doorY * T - P.y) < 520); if (houses.length < 3) return;
      const kind = pick(Object.keys(KINDS).filter((k) => !callers.some((c) => c.kind === k && c.s === s)));
      if (!kind) return; start(s, kind, houses);
    });
    function start(s, kind, houses) {
      const P = game.player, q = s.people.filter((x) => freeAt(x) && !x.job && x.age >= (kind === 'pies' ? 14 : 20) && x.age < 62 && (kind !== 'pies' || x.sex === 'f') && Math.hypot(x.agent.x - P.x, x.agent.y - P.y) < 700 && x._called !== s.day)[0]
        || s.people.filter((x) => freeAt(x) && x.age >= 18 && x.age < 60 && ['stroll', 'idle', 'socialise'].includes(x.activity?.act) && Math.hypot(x.agent.x - P.x, x.agent.y - P.y) < 700 && x._called !== s.day)[0];
      if (!q) return null;
      const stops = houses.filter((b) => b.id !== q.home).sort(() => Math.random() - 0.5).slice(0, 5);
      const C = { s, q, kind, stops, phase: 'walk', t: 0, ft: 0, cry: 0, trail: [], rats: 3 + Math.floor(Math.random() * 3), earned: 0, until: game.t + 300, dog: kind === 'rats' ? { seed: O.hash('ratdog', q.id) % 1000, ft: 0 } : null };
      q._call = kind; q._called = s.day; callers.push(C); say(q, pick(KINDS[kind].cry)); nextStop(C); return q.first + ' (' + kind + ')';
    }
    game.hooks.drawWorld.push((ctx, cam) => {
      const s = cur(); if (!s || game.scene) return; const tk = performance.now() / 1000;
      for (const C of callers) {
        if (C.s !== s) continue; const a = C.q.agent; if (!a || a.hidden) continue; if (O.occluded && O.occluded(a.x, a.y)) continue; const x = Math.round(a.x - cam.x), y = Math.round(a.y - cam.y), lift = a.lift || 0, d = a.dir === 2 ? 1 : a.dir === 1 ? -1 : 0;
        if (C.kind === 'grinder') { // the wheel on its barrow, pushed in front, or set down and turning
          const bx = x + (C.phase === 'work' ? -14 : (d || 1) * 14), by = y; ctx.fillStyle = '#7a5a3a'; ctx.fillRect(bx - 7, by - 6, 14, 3); ctx.fillRect(bx - 7, by - 3, 2, 3); ctx.fillStyle = '#3a2a1a'; ctx.beginPath(); ctx.arc(bx + 6, by - 2, 2.5, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#9a968e'; ctx.beginPath(); ctx.arc(bx - 1, by - 11, 5, 0, Math.PI * 2); ctx.fill(); const ang = C.phase === 'work' ? tk * 14 : 0; ctx.strokeStyle = '#6a665e'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(bx - 1, by - 11); ctx.lineTo(bx - 1 + Math.cos(ang) * 5, by - 11 + Math.sin(ang) * 5); ctx.stroke(); }
        else if (C.kind === 'rats') { // the pole over his shoulder hung with rats
          const px = x - (d || 1) * 6; ctx.strokeStyle = '#6a4a2c'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x + (d || 1) * 2, y - 18 - lift); ctx.lineTo(px - (d || 1) * 12, y - 30 - lift); ctx.stroke(); ctx.fillStyle = '#4a3a30'; for (let i = 0; i < Math.min(6, C.rats); i++) { const rx = Math.round(x + (d || 1) * 2 - (d || 1) * (3 + i * 2.5)), ry = Math.round(y - 19 - lift - (i + 1) * 1.8); ctx.fillRect(rx, ry, 1, 3); ctx.fillRect(rx - 1, ry + 3, 3, 2); }
          if (C.dog && C.trail.length > 12) { const [dx, dy] = C.trail[C.trail.length - 12]; C.dog.ft += 1 / 60; const moving = Math.hypot(dx - a.x, dy - a.y) > 6 && C.phase === 'walk'; let ox = 0; if (C.phase !== 'walk') ox = Math.sin(tk * 1.3) * 14; try { const an = moving ? 'walk' : 'idle', HA = O.Animals.HANIMS[an], fr = O.Animals.animal('dog', C.dog.seed, dx + ox < a.x ? 2 : 1, moving, Math.floor(C.dog.ft * HA.fps) % HA.frames, an); if (!(O.occluded && O.occluded(dx + ox, dy + 4))) ctx.drawImage(fr, Math.round(dx + ox - (fr.ox ?? fr.width / 2) - cam.x), Math.round(dy + 4 - (fr.gy ?? fr.height) - cam.y)); } catch (e) { /* */ } } }
        else if (C.kind === 'tinker') { // pots and a kettle hung about him
          ctx.fillStyle = '#5a5a60'; ctx.fillRect(x - 8, y - 22 - lift, 5, 4); ctx.fillStyle = '#8a6a3a'; ctx.fillRect(x + 4, y - 20 - lift, 5, 5); ctx.fillStyle = '#6a6a70'; ctx.fillRect(x - 3, y - 27 - lift, 6, 3); const sw = C.phase === 'walk' ? Math.round(Math.sin(tk * 8)) : 0; ctx.fillStyle = '#4a4a50'; ctx.fillRect(x - 9 + sw, y - 16 - lift, 3, 3);
          if (C.phase === 'work') { ctx.fillStyle = '#8a6a3a'; ctx.fillRect(x - 12, y - 6, 7, 6); ctx.fillStyle = '#5a4028'; ctx.fillRect(x - 11, y - 8, 5, 2); } }
        else if (C.kind === 'pies') { // the tray on her head with the pies steaming
          const ty = y - 38 - lift; ctx.fillStyle = '#8a6239'; ctx.fillRect(x - 9, ty, 18, 3); ctx.fillStyle = '#c88a40'; for (let i = 0; i < 4; i++) ctx.fillRect(x - 8 + i * 4, ty - 3, 3, 3); if (Math.floor(tk * 2) % 3 === 0) { ctx.fillStyle = 'rgba(240,240,240,0.5)'; ctx.fillRect(x - 4 + Math.round(Math.sin(tk) * 3), ty - 7, 1, 2); ctx.fillRect(x + 3, ty - 8, 1, 2); } }
      }
      for (const p of sparks) { ctx.fillStyle = p.t < 0.2 ? '#fff0a0' : '#ffa040'; ctx.fillRect(Math.round(p.x - cam.x), Math.round(p.y - cam.y), 1, 1); }
    });
    (O.extraLines = O.extraLines || []).push((s, q) => { const C = callers.find((c) => c.q === q); if (C) return { grinder: 'You are a knife-grinder for the day, pushing your grindstone barrow from door to door crying "Knives to grind!" and sharpening whatever folk bring out.', rats: `You are the ratcatcher, going round the houses with your terrier and your pole hung with ${C.rats} rats, crying "Rats! Any rats?".`, tinker: 'You are a tinker going door to door with pots and pans hung about you, mending kettles and pans on the step.', pies: 'You are selling hot pies from a tray on your head, door to door, a penny a pie.' }[C.kind]; return q._call === 'client' ? 'You have come to your door to give the street-caller some work.' : ''; });
    O.StreetCallers = { callers, start: (kind) => { const s = cur(), P = game.player; const houses = s.world.buildings.filter((b) => b.type === 'house' && b.doorX != null && !b.site).sort((x, y) => Math.hypot(x.doorX * T - P.x, x.doorY * T - P.y) - Math.hypot(y.doorX * T - P.x, y.doorY * T - P.y)).slice(0, 10); return start(s, kind, houses); } };
  }
  O.StreetCallersSetup = { setup };
})();
