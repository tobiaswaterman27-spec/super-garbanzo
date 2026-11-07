// The road brings people through. Now and then someone comes in along the east road, goes about their
// business in town and goes on their way: a carter pulling a handcart piled with sacks (the wheels
// turning), three pilgrims with staffs and badges singing on their way to the chapel, a drover with a
// little flock of sheep for the butcher, a grey friar begging his bread, a pedlar with his pack, a
// king's messenger on foot in a hurry. Talk to any of them: they know the roads and the news.
'use strict';
(function () {
  const T = 16;
  function setup(game) {
    const cur = () => O.SimRef.cur, D = O.Data, Ch = O.Char;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    const say = (q, t, secs) => O.Speech && O.Speech.say(q, t, secs || 2);
    const near = (x, y, r) => Math.hypot(x - game.player.x, y - game.player.y) < r;
    const KINDS = {
      carter: { n: 1, role: 'carter', look: 'farmer', dest: 'square', stay: 25, speed: 24, lines: ['Mind the cart!', 'Gee up, wheel. Gee up.', 'Sacks for the mill, if anyone\'s asking.'], about: 'You are a carter passing through with a handcart of sacks, bound for the next town. You know the state of the roads.' },
      pilgrims: { n: 3, role: 'pilgrim', look: 'peasant', dest: 'chapel', stay: 30, speed: 22, lines: ['Ave Maria, gratia plena...', 'Nearly there, friends.', 'Pray for us, good people!'], about: 'You are a pilgrim walking to the shrines with your friends; you wear a pilgrim\'s badge and carry a staff. You are cheerful and tired, and you\'ve seen many towns.' },
      drover: { n: 1, role: 'drover', look: 'farmer', dest: 'butcher', stay: 25, speed: 20, sheep: 5, lines: ['Hup! Hup! Get on!', 'Come by, come by!', 'Mutton on the hoof, butcher!'], about: 'You are a drover bringing a few sheep in to sell to the butcher. You talk about prices and weather.' },
      friar: { n: 1, role: 'friar', look: 'priest', dest: 'square', stay: 35, speed: 18, lines: ['Alms, for the love of God.', 'Bread for a poor brother?', 'Peace be on this house.'], about: 'You are a grey friar, a wandering preacher who begs his bread. You bless people and scold the rich.' },
      pedlar: { n: 1, role: 'pedlar', look: 'merchant', dest: 'square', stay: 30, speed: 22, lines: ['Pins! Needles! Laces!', 'Ribbons, fair maids, ribbons!', 'Something for everyone in my pack!'], about: 'You are a pedlar with a pack on your back: pins, needles, laces, ribbons, a little mirror. You chatter and flatter.' },
      troops: { n: 10, role: 'soldier of the King\'s host', look: 'guard', dest: 'square', stay: 30, speed: 26, lines: ['Left! Left! Left, right, left!', 'Keep in step there!', 'Any ale in this town?', 'Eyes front!'], about: 'You are a soldier of the King\'s host marching through to the war with your company. You are tired, footsore and hungry, and you joke to hide your fear. You stop briefly in the square.' },
      knight: { n: 2, role: 'knight', look: 'noble', dest: 'tavern', stay: 25, speed: 34, mounted: true, lines: ['Out of the way, there.', 'Is there an inn in this place fit for a Christian?', 'Water the horses, boy.'], about: 'You are a knight riding through with your squire, on your way to your lord. You are proud and courteous to your equals, curt with commoners.' },
      messenger: { n: 1, role: 'king\'s messenger', look: 'guard', dest: 'guard', stay: 8, speed: 70, mounted: true, gallop: true, lines: ['Make way! The King\'s business!', 'Out of the road!'], about: 'You are a king\'s messenger on foot, in a great hurry with letters for the reeve and the next town. You have no time to talk.' },
    };
    const parties = [];
    function destOf(s, k) {
      if (k === 'square') { const [x0, y0, x1, y1] = s.Z.square; return [Math.floor((x0 + x1) / 2) + Math.floor(Math.random() * 5) - 2, Math.floor((y0 + y1) / 2) + 1]; }
      if (k === 'chapel') { const b = s.building(s.chapelId); if (b && b.doorX != null) return [b.doorX, b.doorY + 2]; }
      const bz = [...s.biz.values()].find((z) => z.type === k); if (bz) { const b = s.building(bz.b?.id ?? bz.id); if (b && b.doorX != null) return [b.doorX, b.doorY + 2]; }
      return destOf(s, 'square');
    }
    function route(s, from, to) { const p = s.path.find(from[0], from[1], to[0], to[1]); return p ? p.map(([x, y]) => [x * T + 8, y * T + 10]) : null; }
    function spawn(s, kind) {
      const K = KINDS[kind]; const E = s.Z.east; if (!E) return null; const r = O.RNG(O.hash('road', s.day, s.minute, kind));
      const dest = destOf(s, K.dest); const there = route(s, E, dest); if (!there) return null; const back = there.slice().reverse();
      const ppl = []; for (let i = 0; i < K.n; i++) { const sex = kind === 'pilgrims' ? (r.chance(0.5) ? 'm' : 'f') : kind === 'friar' || kind === 'messenger' || kind === 'drover' || kind === 'carter' || kind === 'troops' || kind === 'knight' ? 'm' : r.chance(0.8) ? 'm' : 'f';
        const q = s.newPerson({ sex, age: r.int(20, 60), first: r.pick(D.NAMES[sex]), sur: kind === 'friar' ? 'the Friar' : r.pick(D.NAMES.sur), household: 0, home: null, genes: Ch.randomGenes(r, r.pick(['east', 'south', 'west', 'north'])), wealth: 0.3, visitor: true });
        q.name = kind === 'friar' ? `Brother ${q.first}` : `${q.first} ${q.sur}`; q.job = { biz: null, role: K.role }; q.wake = 0; q.bed = 1440; q.roadfolk = kind;
        q.app = Ch.makeAppearance(O.hash('roadfolk', q.id), { sex, age: q.age, genes: q.genes, role: K.look, wealth: 0.3 });
        q.agent = { x: there[0][0] + i * 3, y: there[0][1] + i * 2, dir: 1, anim: 'walk', ft: 0, a: q.app, hidden: false, inside: null, path: null, goal: null, person: q, frozen: true };
        if (K.mounted) { const A = O.Animals; q.agent.mount = { seed: r.int(1, 9999), coat: r.pick(Object.keys(A.COATS)), blaze: r.chance(0.4), socks: r.chance(0.35), anim: 'walk', ft: 0, speed: 1 }; }
        q.activity = { act: 'stroll', outdoor: true }; ppl.push(q); }
      const pt = { s, kind, K, ppl, path: there, back, pi: 0, lead: [there[0][0], there[0][1]], trail: [[there[0][0], there[0][1]]], stage: 'in', t: 0, wheel: 0, sheep: K.sheep ? Array.from({ length: K.sheep }, (_, i) => ({ seed: 300 + i * 17 + s.day, x: there[0][0] + 10 + i * 4, y: there[0][1] + (i % 2 ? 5 : -4), dir: 1, ft: Math.random() })) : null };
      parties.push(pt); return pt;
    }
    function remove(pt) { const s = pt.s; for (const q of pt.ppl) { s.people = s.people.filter((z) => z !== q); s.byId.delete(q.id); } parties.splice(parties.indexOf(pt), 1); }
    function walk(pt, path, dt) {
      const tgt = path[pt.pi]; if (!tgt) return true; const dx = tgt[0] - pt.lead[0], dy = tgt[1] - pt.lead[1], d = Math.hypot(dx, dy), st = pt.K.speed * dt;
      if (d <= st) { pt.lead = [tgt[0], tgt[1]]; pt.pi++; } else pt.lead = [pt.lead[0] + dx / d * st, pt.lead[1] + dy / d * st];
      const last = pt.trail[0]; if (Math.hypot(pt.lead[0] - last[0], pt.lead[1] - last[1]) > 2) { pt.trail.unshift([pt.lead[0], pt.lead[1]]); if (pt.trail.length > 120) pt.trail.pop(); }
      return false;
    }
    let next = 40;
    game.hooks.update.push((dt) => {
      const s = cur(); if (!s || !s.world) return;
      for (const pt of parties.slice()) {
        pt.t += dt; if (pt.s !== s) { remove(pt); continue; }
        const talking = pt.ppl.some((q) => O.npcUI && O.npcUI.talking && O.npcUI.talking() === q); if (talking) { for (const q of pt.ppl) if (!(O.npcUI.talking() === q)) q.agent.forceAnim = 'idle'; continue; }
        const at = (k) => pt.trail[Math.min(pt.trail.length - 1, k)];
        if (pt.stage === 'in' || pt.stage === 'out') { const end = walk(pt, pt.stage === 'in' ? pt.path : pt.back, dt);
          pt.ppl.forEach((q, i) => { const [x, y] = at(i * (pt.K.mounted ? 14 : pt.kind === 'troops' ? 5 : 6) + (pt.sheep ? 14 : 0)); const a = q.agent; const dx = x - a.x, dy = y - a.y; if (Math.hypot(dx, dy) > 0.3) a.dir = O.dirOf(dx, dy); a.x = x + (pt.kind === 'troops' ? (i % 2 ? 5 : -5) : (i % 2 ? 3 : -3) * (i > 0 ? 1 : 0)); a.y = y; a.forceAnim = pt.kind === 'carter' ? 'carry' : pt.kind === 'messenger' ? 'run' : 'walk'; a.frozen = true; if (a.mount) { a.mount.anim = pt.K.gallop ? 'gallop' : 'walk'; a.mount.ft += dt; } });
          if (pt.sheep) pt.sheep.forEach((sh, i) => { const [x, y] = at(Math.max(0, i * 3)); const dx = x - sh.x; sh.moving = Math.hypot(x - sh.x, y - sh.y) > 0.5; if (sh.moving) sh.dir = dx > 0 ? 2 : 1; sh.x += (x + (i % 2 ? 4 : -4) - sh.x) * Math.min(1, dt * 4); sh.y += (y + (i % 3) * 3 - 3 - sh.y) * Math.min(1, dt * 4); sh.ft += dt; });
          pt.wheel += pt.K.speed * dt;
          if (pt.kind === 'troops' && Math.random() < dt * 4) for (const q of s.people) { if (q.roadfolk || !q.agent || q.agent.hidden || q.agent.inside != null || q.agent.frozen || q.errand || q._sawTroops === pt || Math.hypot(q.agent.x - pt.lead[0], q.agent.y - pt.lead[1]) > 90) continue; q._sawTroops = pt; O.gesture && O.gesture(q, q.age < 13 ? 'celebrate' : pick(['wave', 'wave', 'mourn', 'point', 'look']), 2.5); if (q.age < 12 && Math.random() < 0.3) O.Speech && O.Speech.say(q, pick(['Soldiers! Look!', 'Can I come?', 'Left, right! Left, right!']), 1.6); }
          if (pt.kind === 'troops' && near(pt.lead[0], pt.lead[1], 360)) { pt.drum = (pt.drum || 0) - dt; if (pt.drum <= 0) { pt.drum = 0.55; O.sfx && O.sfx('smack', 0.06); } }
          if (Math.random() < dt * 0.08 && near(pt.lead[0], pt.lead[1], 320)) say(pick(pt.ppl), pick(pt.K.lines), 2.2);
          if (end) { if (pt.stage === 'in') { pt.stage = 'stay'; pt.st = 0; pt.pi = 0; } else { remove(pt); continue; } } }
        else { pt.st += dt; const lead = pt.ppl[0];
          if (pt.kind === 'troops' && !pt.bought) { pt.bought = true; const bk = [...s.biz.values()].find((z) => z.type === 'bakery'); if (bk && bk.stock) { const n = Math.min(6, Math.floor(bk.stock.bread || 0)); bk.stock.bread -= n; bk.cash = (bk.cash || 0) + n * 2; } const tv = [...s.biz.values()].find((z) => z.type === 'tavern'); if (tv) tv.cash = (tv.cash || 0) + 8; say(lead, 'Fall out! Ten minutes! Bread and ale, and pay for it!', 2.4); }
          pt.ppl.forEach((q, i) => { const a = q.agent; a.forceAnim = pt.kind === 'pilgrims' ? (Math.floor(pt.st + i) % 6 < 2 ? 'pray' : 'idle') : pt.kind === 'friar' ? (Math.floor(pt.st) % 5 < 2 ? 'beg' : 'gesture') : pt.kind === 'pedlar' ? (Math.floor(pt.st) % 4 < 2 ? 'wave' : 'talk') : pt.kind === 'drover' ? (Math.floor(pt.st) % 6 < 2 ? 'point' : 'idle') : pt.kind === 'troops' ? (Math.floor(pt.st + i) % 7 === 0 ? 'drink' : Math.floor(pt.st + i) % 7 === 3 ? 'stretch' : (i % 3 ? 'idle' : 'talk')) : 'idle'; a.dir = 0; });
          if (pt.sheep) pt.sheep.forEach((sh) => { sh.moving = false; sh.ft += dt; });
          for (const q of pt.ppl) if (q.agent.mount) { q.agent.mount.anim = Math.floor(pt.st / 4 + q.id) % 3 ? 'idle' : 'graze'; q.agent.mount.ft += dt; }
          if (Math.random() < dt * 0.1 && near(lead.agent.x, lead.agent.y, 300)) say(pick(pt.ppl), pick(pt.K.lines), 2.2);
          if (pt.kind === 'drover' && pt.sheep && pt.st > pt.K.stay * 0.7 && !pt.sold) { pt.sold = true; const n = 2 + Math.floor(Math.random() * 2); pt.sheep.splice(0, n); const bz = [...s.biz.values()].find((z) => z.type === 'butcher'); if (bz) { bz.stock = bz.stock || {}; bz.stock.meat = (bz.stock.meat || 0) + n * 3; } say(lead, `${n} to the butcher. Good price, too.`, 2); }
          if (pt.st > pt.K.stay) { pt.stage = 'out'; pt.pi = 0; pt.trail = [[pt.lead[0], pt.lead[1]]]; } }
      }
      if (Math.random() < dt * 0.2) { const orphan = s.people.filter((q) => q.roadfolk && !parties.some((pt) => pt.ppl.includes(q))); for (const q of orphan) { s.people = s.people.filter((z) => z !== q); s.byId.delete(q.id); } } // (after a reload: gone on their way)
      next -= dt; if (next > 0 || game.scene) return; next = 50 + Math.random() * 70;
      const h = s.minute / 60; if (h < 7 || h > 18 || parties.length >= 2) return;
      const E = s.Z.east; if (!E || !near(E[0] * T, E[1] * T, 900) && !s.Z.square) return;
      const atWar = s.kingdom && s.kingdom.war && ['war', 'tension'].includes(s.kingdom.war.phase); const kinds = Object.keys(KINDS).filter((k) => (k !== 'messenger' || atWar || Math.random() < 0.3) && (k !== 'troops' || atWar)); if (atWar && Math.random() < 0.35) { spawn(s, 'troops'); return; }
      spawn(s, pick(kinds));
    });
    game.hooks.drawWorld.push((ctx, cam) => {
      if (game.scene) return; ctx.save();
      for (const pt of parties) {
        if (pt.kind === 'carter') { const a = pt.ppl[0].agent, x = Math.round(a.x - cam.x), y = Math.round(a.y - cam.y), back = a.dir === 2 ? -1 : 1, cx = x + back * 14; ctx.fillStyle = '#6a4a2c'; ctx.fillRect(cx - 8, y - 9, 16, 5); ctx.fillStyle = '#5a3d26'; ctx.fillRect(Math.min(cx, x) + 2, y - 8, Math.abs(cx - x) - 2, 1); ctx.fillStyle = '#c8b080'; ctx.fillRect(cx - 7, y - 14, 6, 5); ctx.fillRect(cx, y - 13, 6, 4); ctx.fillStyle = '#a89060'; ctx.fillRect(cx - 4, y - 17, 6, 4);
          ctx.strokeStyle = '#3a2a1a'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(cx, y - 2, 3.5, 0, Math.PI * 2); ctx.stroke(); const r0 = pt.wheel / 3.5; ctx.beginPath(); ctx.moveTo(cx + Math.cos(r0) * 3, y - 2 + Math.sin(r0) * 3); ctx.lineTo(cx - Math.cos(r0) * 3, y - 2 - Math.sin(r0) * 3); ctx.moveTo(cx + Math.cos(r0 + 1.57) * 3, y - 2 + Math.sin(r0 + 1.57) * 3); ctx.lineTo(cx - Math.cos(r0 + 1.57) * 3, y - 2 - Math.sin(r0 + 1.57) * 3); ctx.stroke(); }
        if (pt.kind === 'pilgrims' || pt.kind === 'friar') for (const q of pt.ppl) { const a = q.agent, x = Math.round(a.x - cam.x), y = Math.round(a.y - cam.y); ctx.fillStyle = '#7a5a3a'; ctx.fillRect(x + 6, y - 28, 1, 28); if (pt.kind === 'pilgrims') { ctx.fillStyle = '#e8e0d0'; ctx.fillRect(x - 1, y - 20, 2, 2); } }
        if (pt.kind === 'troops') pt.ppl.forEach((q, i) => { const a = q.agent, x = Math.round(a.x - cam.x), y = Math.round(a.y - cam.y); ctx.fillStyle = '#6a4a2c'; ctx.fillRect(x + 5, y - 34, 1, 32); ctx.fillStyle = '#a8b0bc'; ctx.fillRect(x + 4, y - 37, 3, 3); if (i === 0) { ctx.fillStyle = '#5a3d26'; ctx.fillRect(x - 6, y - 40, 1, 38); ctx.fillStyle = '#9a1e24'; ctx.fillRect(x - 5, y - 39, 9 + (Math.floor(performance.now() / 300) % 2), 7); ctx.fillStyle = '#e0c050'; ctx.fillRect(x - 2, y - 37, 3, 3); } });
        if (pt.kind === 'pedlar') { const a = pt.ppl[0].agent, x = Math.round(a.x - cam.x), y = Math.round(a.y - cam.y); ctx.fillStyle = '#8a6239'; ctx.fillRect(x - (a.dir === 2 ? 9 : -3), y - 24, 7, 10); ctx.fillStyle = '#c04060'; ctx.fillRect(x - (a.dir === 2 ? 8 : -4), y - 16, 2, 4); }
        if (pt.sheep) for (const sh of pt.sheep) { const an = sh.moving ? 'walk' : 'graze', H = O.Animals.HANIMS[an]; try { const fr = O.Animals.animal('sheep', sh.seed, sh.dir, sh.moving, Math.floor(sh.ft * H.fps) % H.frames, an); ctx.drawImage(fr, Math.round(sh.x - (fr.ox ?? fr.width / 2) - cam.x), Math.round(sh.y - (fr.gy ?? fr.height) - cam.y)); } catch (e) { /* */ } }
      }
      ctx.restore();
    });
    (O.extraLines = O.extraLines || []).push((s, q) => q.roadfolk ? KINDS[q.roadfolk].about + ' You are only passing through ' + (s.world.name || 'this town') + '.' : '');
    O.RoadFolk = { parties, spawn: (k) => spawn(cur(), k), KINDS };
  }
  O.RoadFolkSetup = { setup };
})();
