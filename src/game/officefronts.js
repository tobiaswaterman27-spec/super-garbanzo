// The public houses have their doorsteps too. Outside the infirmary a sister shakes out sheets and a
// patient sits wrapped in a blanket in the sun; the schoolmaster rings his handbell on the step and the
// children come running; at the post house the post-boy sounds his horn and a fresh horse is led out; a
// debtor wrings his hands at the moneylender's door while the scales come out; a monk of the scriptorium
// sets parchment to dry on a frame and trims his quills on the step; at the gaol a wife brings bread to
// the barred window and the turnkey jangles his keys; the sexton sweeps the chapel porch; and at the town
// hall a petitioner waits on the step, cap in hand, rehearsing what to say.
'use strict';
(function () {
  const T = 16;
  function setup(game) {
    const cur = () => O.SimRef.cur;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    const live = []; let cool = 6, count = 0;
    const near = (x, y, r) => Math.hypot(x - game.player.x, y - game.player.y) < r;
    const talking = (q) => O.npcUI && O.npcUI.talking && O.npcUI.talking() === q;
    const free = (q) => q && q.alive !== false && q.agent && !q.agent.frozen && !q.errand && !q._bit && !q._scene && !q._office && !talking(q);
    // type: who does it ('staff' from the place, or 'town' someone from the street), the anim, the hours, lines, props
    const K = {
      hospital: { who: 'staff', anim: ['shake', 'pickup', 'shake'], hours: [8, 17], lines: ['Fresh linen for the beds.', 'Air, that\'s what they need. Fresh air.', 'Lord, the state of these.'], prop: 'sheet', extra: 'patient' },
      school: { who: 'staff', anim: ['ringbell', 'ringbell', 'point'], hours: [8, 9.5], lines: ['In, in, all of you! Lessons!', 'Slates out!', 'Late again, young Tom?'], prop: 'bell', extra: 'kids' },
      posthouse: { who: 'staff', anim: ['pipe', 'idle', 'take'], hours: [7, 18], lines: ['Post! Post for Kingsbridge!', 'Fresh horse, and quick about it!', 'Letters for the north road!'], prop: 'horn', extra: 'horse' },
      moneylender: { who: 'staff', anim: ['count', 'write', 'count'], hours: [9, 17], lines: ['Twenty, and four more for the week.', 'You knew the terms.', 'Bring the pledge, and we\'ll talk.'], prop: 'scales', extra: 'debtor' },
      scriptorium: { who: 'staff', anim: ['write', 'pickup', 'write'], hours: [9, 16], lines: ['Mind the ink, it\'s wet.', 'The light\'s better out here.', 'A fair hand takes patience.'], prop: 'frame' },
      gaol: { who: 'town', anim: ['give', 'idle', 'mourn'], hours: [10, 17], lines: ['Bread, love. And a bit of cheese.', 'Two more days. Be strong.', 'The children ask after you.'], prop: 'window', extra: 'keys' },
      chapel: { who: 'staff', anim: ['sweep', 'sweep', 'idle'], hours: [7, 12], lines: ['Mud everywhere. Every Sunday the same.', 'Dust off your feet before you go in.', 'God sees a clean porch.'], prop: 'broom' },
      townhall: { who: 'town', anim: ['look', 'idle', 'wipe'], hours: [9, 15], lines: ['"My lord, the ditch..." no. "Good sirs..."', 'They\'ll never hear me.', 'Three weeks I\'ve waited for this.'], prop: 'cap' },
    };
    function release(L) { for (const q of [L.q, ...(L.more || [])]) { if (!q || !q.agent) continue; q.agent.forceAnim = null; if (!talking(q)) q.agent.frozen = false; q._office = false; } live.splice(live.indexOf(L), 1); }
    function begin(s, b, bz, kind) {
      const k = K[kind], side = Math.random() < 0.5 ? -1 : 1, tx = b.doorX + side, ty = b.doorY + 1, w = s.world; if (w.solid[ty * w.W + tx]) return false;
      let q = null; if (k.who === 'staff') q = (bz.workers || []).map((id) => s.byId.get(id)).find((x) => free(x) && (x.agent.inside === b.id || (!x.agent.hidden && x.agent.inside == null)));
      else q = s.people.find((x) => free(x) && x.age >= 18 && x.agent && !x.agent.hidden && x.agent.inside == null && Math.hypot(x.agent.x - b.doorX * T, x.agent.y - b.doorY * T) < 500 && ['stroll', 'idle', 'shop', 'socialise'].includes(x.activity?.act));
      if (!q) return false; if (q.agent.inside === b.id) { q.agent.x = b.doorX * T + 8; q.agent.y = (b.doorY + 1) * T + 6; q.agent.inside = null; q.agent.hidden = false; }
      q._office = true; const L = { s, b, bz, kind, q, side, t: 0, len: 35 + Math.random() * 25, more: [], said: 0 };
      O.Errands.send(s, q, [tx, ty], { anim: 'idle', secs: 0.2, face: 0, giveUp: game.t + 40, after: (ok) => { if (!ok || !q.agent) { q._office = false; return; } q.agent.frozen = true; q.agent.path = null; q.agent.dir = kind === 'gaol' || kind === 'townhall' ? 3 : 0; live.push(L); count++;
        // a second figure for some scenes
        if (k.extra === 'patient' || k.extra === 'debtor') { const o = s.people.find((x) => free(x) && x !== q && x.age >= 20 && x.agent && !x.agent.hidden && x.agent.inside == null && Math.hypot(x.agent.x - b.doorX * T, x.agent.y - b.doorY * T) < 400); if (o) { o._office = true; O.Errands.send(s, o, [b.doorX - side, b.doorY + 1], { anim: 'idle', secs: 0.2, face: 0, giveUp: game.t + 30, after: (ok2) => { if (!ok2 || !live.includes(L)) { o._office = false; return; } o.agent.frozen = true; o.agent.path = null; L.more.push(o); } }); } }
        if (k.extra === 'kids') { const kids = s.people.filter((x) => free(x) && x.age >= 6 && x.age <= 12 && x.agent && !x.agent.hidden && x.agent.inside == null && Math.hypot(x.agent.x - b.doorX * T, x.agent.y - b.doorY * T) < 500).slice(0, 4); for (const c of kids) { c._office = true; O.Errands.send(s, c, [b.doorX, b.doorY + 1], { anim: 'idle', secs: 0.2, face: 3, sprint: true, giveUp: game.t + 25, after: () => { c._office = false; } }); } }
      } });
      return true;
    }
    game.hooks.update.push((dt) => {
      const s = cur(); if (!s || !s.world || game.scene) return; const hr = s.minute / 60;
      for (const L of live.slice()) { L.t += dt; const a = L.q.agent, k = K[L.kind]; if (L.s !== s || !a || L.t > L.len || talking(L.q) || (s.raining && L.kind !== 'gaol')) { release(L); continue; }
        a.forceAnim = k.anim[Math.floor(L.t / 4) % k.anim.length];
        for (const o of L.more) { o.agent.forceAnim = L.kind === 'patient' || k.extra === 'patient' ? (Math.floor(L.t / 6) % 3 === 2 ? 'cough' : 'sit') : (Math.floor(L.t / 3) % 2 ? 'beg' : 'wipe'); o.agent.dir = 0; }
        if (L.said < 2 && L.t > 2 + L.said * 12 && near(a.x, a.y, 300)) { L.said++; O.Speech && O.Speech.say(L.q, pick(k.lines), 2.6); if (L.kind === 'school' || L.kind === 'posthouse') O.sfx && O.sfx(L.kind === 'school' ? 'handbell' : 'pipe', 0.3); }
        if (L.kind === 'gaol' && Math.random() < dt * 0.3 && near(a.x, a.y, 240)) O.sfx && O.sfx('coins', 0.15);
        if (L.kind === 'moneylender' && L.more[0] && L.said === 1 && !L.dsaid && L.t > 6) { L.dsaid = true; near(a.x, a.y, 300) && O.Speech && O.Speech.say(L.more[0], pick(['One more week. I beg you.', 'The harvest was poor, you know it was.', 'Take the brooch. It was my mother\'s.']), 2.6); } }
      cool -= dt; if (cool > 0) return; cool = 9 + Math.random() * 8;
      if (live.filter((l) => l.s === s).length >= 3) return; const P = game.player;
      const cands = []; for (const bz of s.biz.values()) { const k = K[bz.type]; if (!k || hr < k.hours[0] || hr > k.hours[1]) continue; const b = s.building(bz.b?.id ?? bz.id); if (!b || b.doorX == null || live.some((l) => l.b === b) || Math.hypot(b.doorX * T - P.x, b.doorY * T - P.y) > 480) continue; cands.push([b, bz]); }
      if (!cands.length) return; const [b, bz] = pick(cands); begin(s, b, bz, bz.type);
    });
    game.hooks.drawWorld.push((ctx, cam) => {
      const s = cur(); if (!s || game.scene) return; const tk = performance.now() / 1000;
      for (const L of live) { if (L.s !== s) continue; const a = L.q.agent, x = Math.round(a.x - cam.x), y = Math.round(a.y - cam.y), k = K[L.kind];
        if (k.prop === 'sheet') { const sw = Math.round(Math.sin(tk * 7) * 3); ctx.fillStyle = '#f0ece0'; ctx.fillRect(x + 4, y - 22 + sw, 12, 8); ctx.fillStyle = '#d8d4c8'; ctx.fillRect(x + 4, y - 15 + sw, 12, 1); }
        else if (k.prop === 'bell') { ctx.fillStyle = '#c8a040'; ctx.fillRect(x + 6, y - 24 + (Math.floor(tk * 8) % 2 ? -1 : 1), 4, 4); ctx.fillStyle = '#6a4a2c'; ctx.fillRect(x + 7, y - 27, 2, 3); }
        else if (k.prop === 'horn') { ctx.fillStyle = '#c8a040'; ctx.fillRect(x + 4, y - 24, 8, 2); ctx.fillRect(x + 11, y - 26, 2, 5); }
        else if (k.prop === 'scales') { const tx = x + 14, ty = y - 6; ctx.fillStyle = '#7a5a3a'; ctx.fillRect(tx - 6, ty - 2, 12, 2); ctx.fillRect(tx - 5, ty, 1, 6); ctx.fillRect(tx + 4, ty, 1, 6); ctx.fillStyle = '#c8a040'; const tilt = Math.round(Math.sin(tk * 1.5) * 1.5); ctx.fillRect(tx - 1, ty - 9, 1, 7); ctx.fillRect(tx - 5, ty - 9 + tilt, 9, 1); ctx.fillRect(tx - 5, ty - 8 + tilt, 3, 1); ctx.fillRect(tx + 2, ty - 8 - tilt, 3, 1); ctx.fillStyle = '#e0c040'; ctx.fillRect(tx - 4, ty - 4, 2, 1); ctx.fillRect(tx + 1, ty - 4, 2, 1); }
        else if (k.prop === 'frame') { const fx = x + 16, fy = y - 2; ctx.fillStyle = '#6a4a2c'; ctx.fillRect(fx - 7, fy - 18, 1, 18); ctx.fillRect(fx + 7, fy - 18, 1, 18); ctx.fillRect(fx - 7, fy - 18, 15, 1); ctx.fillStyle = '#ece4cc'; ctx.fillRect(fx - 5, fy - 16, 4, 6); ctx.fillRect(fx + 1, fy - 16, 4, 6); ctx.fillStyle = '#3a2a1a'; ctx.fillRect(fx - 4, fy - 14, 2, 1); ctx.fillRect(fx + 2, fy - 13, 2, 1); }
        else if (k.prop === 'window') { const wx = x - L.side * 2, wy = y - 26; ctx.fillStyle = '#2a2a30'; ctx.fillRect(wx - 6, wy, 12, 8); ctx.fillStyle = '#6a6a70'; for (let i = 0; i < 4; i++) ctx.fillRect(wx - 5 + i * 3, wy, 1, 8); ctx.fillStyle = '#c89a5a'; if (L.t < 8) ctx.fillRect(x + 4, y - 18, 5, 3); }
        else if (k.prop === 'broom') { const sw = Math.round(Math.sin(tk * 5) * 4); ctx.strokeStyle = '#8a6a44'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x + 2, y - 14); ctx.lineTo(x + 6 + sw, y); ctx.stroke(); ctx.fillStyle = '#c8b070'; ctx.fillRect(x + 4 + sw, y - 2, 5, 2); if (Math.random() < 0.3) { ctx.fillStyle = 'rgba(170,150,120,0.5)'; ctx.fillRect(x + 8 + sw, y - 3, 2, 2); } }
        else if (k.prop === 'cap') { ctx.fillStyle = '#5a4a3a'; ctx.fillRect(x - 3, y - 15, 6, 3); }
        if (k.extra === 'horse' && L.t > 6) { try { const h = L.horse || (L.horse = { coat: '#6a4a30', saddled: true, seed: L.b.id + 7, id: 'post' + L.b.id }); const HA = O.Animals.HANIMS.idle, fr = O.Animals.horse(h, 1, 'idle', Math.floor(tk * HA.fps) % HA.frames); ctx.drawImage(fr, Math.round(x - 24 - (fr.ox ?? fr.width / 2)), Math.round(y - (fr.gy ?? fr.height))); } catch (e) { /* */ } }
        if (k.extra === 'keys' && Math.floor(tk * 2) % 3 === 0) { ctx.fillStyle = '#9a9aa0'; ctx.fillRect(x - L.side * 18, y - 14, 3, 2); ctx.fillRect(x - L.side * 18 + 1, y - 12, 1, 3); }
      }
    });
    (O.extraLines = O.extraLines || []).push((s, q) => { const L = live.find((l) => l.q === q || l.more.includes(q)); if (!L) return ''; return { hospital: 'You are at the infirmary door in the fresh air.', school: 'You are at the school door as the lessons begin.', posthouse: 'You are at the post house door as the post goes out.', moneylender: L.q === q ? 'You are at your door with the scales, settling a debt.' : 'You have come to the moneylender to beg more time on your debt.', scriptorium: 'You are drying parchment and trimming quills on the scriptorium step.', gaol: 'You have brought bread to someone dear to you, through the barred window of the gaol.', chapel: 'You are sweeping the chapel porch.', townhall: 'You are waiting on the town hall step with a petition, cap in hand, nervous.' }[L.kind]; });
    O.OfficeFronts = { live, get count() { return count; }, kinds: Object.keys(K) };
  }
  O.OfficeFrontsSetup = { setup };
})();
