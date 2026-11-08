// More games the children get up. Knights: two lads with sticks for swords hack and parry and cry
// "Have at thee!" while a third gallops round them on a hobby horse. Tug of war: a rope between two teams,
// heels dug in, the rag in the middle creeping one way and back, till one side goes over in a heap and
// the other cheers. Blind man's buff: one with a cloth over the eyes, arms out, stumbling after the rest
// as they dodge and giggle. Whip and top: a top set spinning in the dirt and kept going with a little
// whip, wobbling when it slows.
'use strict';
(function () {
  const T = 16;
  function setup(game) {
    const cur = () => O.SimRef.cur;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    const games = []; let cool = 8, played = 0;
    const near = (x, y, r) => Math.hypot(x - game.player.x, y - game.player.y) < r;
    const talking = (q) => O.npcUI && O.npcUI.talking && O.npcUI.talking() === q;
    const say = (q, t, d) => q.agent && near(q.agent.x, q.agent.y, 260) && O.Speech && O.Speech.say(q, t, d || 1.8);
    const free = (q) => q && q.alive !== false && q.age >= 5 && q.age <= 12 && q.agent && !q.agent.hidden && q.agent.inside == null && !q.agent.frozen && !q.errand && !q._bit && !q._scene && !q._playing && !q._puddle && !q._kid2 && !talking(q) && q.activity && ['play', 'stroll', 'idle', 'socialise', 'home', 'pastime-none'].includes(q.activity.act);
    const NEED = { knights: 3, tug: 4, buff: 4, top: 1 };
    function end(G) { for (const q of G.kids) { const a = q.agent; if (!a) continue; a.forceAnim = null; a.lift = 0; if (!talking(q)) a.frozen = false; q._kid2 = false; } games.splice(games.indexOf(G), 1); }
    function begin(s, kind, kids, cx, cy) {
      const G = { s, kind, kids: [], t: -1, len: 30 + Math.random() * 25, cx, cy, mid: 0, top: { x: cx, y: cy + 4, spin: 1, a: 0 }, horse: 0 };
      const spots = kind === 'tug' ? [[-30, 0], [-18, 0], [18, 0], [30, 0]] : kind === 'knights' ? [[-9, 0], [9, 0], [0, 26]] : kind === 'buff' ? [[0, 0], [-30, -14], [30, -10], [0, 26]] : [[-10, 0]];
      kids.slice(0, NEED[kind] === 1 ? 1 : spots.length).forEach((q, i) => { q._kid2 = true; const [dx, dy] = spots[i]; const tx = Math.floor((cx + dx) / T), ty = Math.floor((cy + dy) / T);
        O.Errands.send(s, q, [tx, ty], { anim: 'idle', secs: 0.1, face: 0, sprint: true, giveUp: game.t + 25, after: (ok) => { if (!ok || !q.agent || G.over) { q._kid2 = false; return; } const a = q.agent; a.frozen = true; a.path = null; a.x = cx + dx; a.y = cy + dy; q._slot = i; q._home = [a.x, a.y]; G.kids.push(q); if (G.t < 0 && G.kids.length >= Math.min(NEED[kind], 2)) { G.t = 0; } } }); });
      games.push(G); played++; return true;
    }
    game.hooks.update.push((dt) => {
      const s = cur(); if (!s || !s.world || game.scene) return;
      for (const G of games.slice()) {
        if (G.t < 0) { G.wait = (G.wait || 0) + dt; if (G.wait > 30) { G.over = true; end(G); } continue; }
        G.t += dt; if (G.s !== s || G.t > G.len || s.raining || G.kids.some((q) => q.alive === false || talking(q)) || (game.isNight && game.isNight())) { G.over = true; end(G); continue; }
        const K = G.kids;
        if (G.kind === 'knights') { K.forEach((q) => { const a = q.agent, i = q._slot; if (i === 2) { G.horse += dt * 1.6; a.x = G.cx + Math.cos(G.horse) * 34; a.y = G.cy + 8 + Math.sin(G.horse) * 18; a.dir = Math.sin(G.horse) > 0 ? 1 : 2; a.forceAnim = 'run'; return; } const ph = Math.floor(G.t * 2.5 + i) % 4; a.dir = i === 0 ? 2 : 1; a.forceAnim = ph === 0 ? 'attack' : ph === 2 ? 'block' : 'idle'; if (ph === 0 && Math.random() < dt * 3 && near(a.x, a.y, 200)) O.sfx && O.sfx('place', 0.08); });
          if (Math.random() < dt * 0.25 && K.length) say(pick(K), pick(['Have at thee!', 'Yield, knave!', 'I am Sir Roland!', 'You\'re dead! Lie down!', 'Charge!'])); }
        else if (G.kind === 'tug') { G.mid += (Math.random() - 0.5) * dt * 12 + Math.sin(G.t * 0.7) * dt * 3; K.forEach((q) => { const a = q.agent, left = q._slot < 2; a.dir = left ? 2 : 1; a.forceAnim = 'carry'; a.x = q._home[0] + G.mid; });
          if (Math.abs(G.mid) > 14 && !G.won) { G.won = G.mid > 0 ? 'left' : 'right'; G.len = G.t + 5; K.forEach((q) => { const lost = (q._slot < 2) === (G.won === 'right'); q.agent.forceAnim = lost ? 'lie' : 'celebrate'; }); say(pick(K.filter((q) => (q._slot < 2) === (G.won === 'left'))) || K[0], 'We won! We won!'); }
          if (!G.won && Math.random() < dt * 0.3 && K.length) say(pick(K), pick(['Pull!', 'Heave!', 'Dig your heels in!'])); }
        else if (G.kind === 'buff') { const it = K.find((q) => q._slot === 0); K.forEach((q) => { const a = q.agent; if (q === it) { a.forceAnim = 'point'; a.x = G.cx + Math.sin(G.t * 0.6) * 24; a.y = G.cy + Math.cos(G.t * 0.45) * 14; a.dir = Math.cos(G.t * 0.6) > 0 ? 2 : 1; return; } const ang = G.t * 0.9 + q._slot * 2.1; a.x = G.cx + Math.cos(ang) * 40; a.y = G.cy + Math.sin(ang) * 22; a.dir = Math.cos(ang) < 0 ? 2 : 1; a.forceAnim = 'run'; if (it && Math.hypot(a.x - it.agent.x, a.y - it.agent.y) < 10 && !G.caught) { G.caught = q; G.len = G.t + 3; say(it, 'Got you! It\'s ' + q.first + '!'); } });
          if (!G.caught && Math.random() < dt * 0.3 && K.length > 1) say(pick(K.filter((q) => q !== it)), pick(['Over here!', 'Can\'t catch me!', 'Warmer...', 'Hee hee!'])); }
        else if (G.kind === 'top') { const q = K[0]; if (!q) continue; const a = q.agent; G.top.spin = Math.max(0, G.top.spin - dt * 0.12); G.top.a += dt * (4 + G.top.spin * 18); if (G.top.spin < 0.35 && Math.random() < dt * 2) { a.forceAnim = 'attack'; G.top.spin = Math.min(1, G.top.spin + 0.5); if (near(a.x, a.y, 200)) O.sfx && O.sfx('smack', 0.05); } else if (a.forceAnim !== 'attack' || Math.random() < dt * 3) a.forceAnim = 'crouch'; a.dir = 2; }
      }
      cool -= dt; if (cool > 0) return; cool = 10 + Math.random() * 10;
      const hr = s.minute / 60; if (hr < 8 || hr > 19 || s.raining || games.filter((g) => g.s === s).length >= 2) return;
      const P = game.player, kids = s.people.filter((q) => free(q) && Math.hypot(q.agent.x - P.x, q.agent.y - P.y) < 400); if (!kids.length) return;
      const kind = pick(kids.length >= 4 ? ['tug', 'buff', 'knights', 'top'] : kids.length >= 3 ? ['knights', 'top'] : ['top']);
      const lead = pick(kids), group = kids.filter((q) => Math.hypot(q.agent.x - lead.agent.x, q.agent.y - lead.agent.y) < 220).slice(0, NEED[kind]); if (group.length < NEED[kind]) return;
      // a patch of open ground near them
      const w = s.world, tx0 = Math.floor(lead.agent.x / T), ty0 = Math.floor(lead.agent.y / T); let at = null;
      for (let r = 0; r < 6 && !at; r++) for (let dy = -r; dy <= r && !at; dy++) for (let dx = -r; dx <= r && !at; dx++) { const tx = tx0 + dx, ty = ty0 + dy; let ok = true; for (let yy = ty - 1; yy <= ty + 2 && ok; yy++) for (let xx = tx - 3; xx <= tx + 3 && ok; xx++) if (xx < 1 || yy < 1 || xx >= w.W - 1 || yy >= w.H - 1 || w.solid[yy * w.W + xx] || w.ter[yy * w.W + xx] === w.TER.WATER) ok = false; if (ok) at = [tx * T + 8, ty * T + 10]; }
      if (at) begin(s, kind, group, at[0], at[1]);
    });
    game.hooks.drawWorld.push((ctx, cam) => {
      const s = cur(); if (!s || game.scene) return; const tk = performance.now() / 1000;
      for (const G of games) { if (G.s !== s || G.t < 0) continue;
        if (G.kind === 'tug' && G.kids.length >= 2) { const xs = G.kids.map((q) => q.agent.x), x0 = Math.min(...xs), x1 = Math.max(...xs), y = Math.round(G.cy - 12 - cam.y); ctx.strokeStyle = '#c8b080'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(Math.round(x0 - cam.x), y); ctx.lineTo(Math.round(x1 - cam.x), y); ctx.stroke(); ctx.fillStyle = '#c83a3a'; ctx.fillRect(Math.round(G.cx + G.mid - cam.x) - 1, y - 1, 3, 4); ctx.fillStyle = '#7a5a3a'; ctx.fillRect(Math.round(G.cx - cam.x), Math.round(G.cy - cam.y) - 2, 1, 4); }
        for (const q of G.kids) { const a = q.agent, x = Math.round(a.x - cam.x), y = Math.round(a.y - cam.y);
          if (G.kind === 'knights' && q._slot < 2) { const up = a.forceAnim === 'attack'; ctx.strokeStyle = '#7a5a3a'; ctx.lineWidth = 1; ctx.beginPath(); const d = a.dir === 2 ? 1 : -1; ctx.moveTo(x + d * 4, y - 14); ctx.lineTo(x + d * (up ? 14 : 10), y - (up ? 20 : 8)); ctx.stroke(); }
          if (G.kind === 'knights' && q._slot === 2) { const d = a.dir === 2 ? 1 : -1; ctx.strokeStyle = '#8a6a44'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x - d * 8, y - 1); ctx.lineTo(x + d * 6, y - 14); ctx.stroke(); ctx.fillStyle = '#9a7a54'; ctx.fillRect(x + d * 6 - 2, y - 17, 5, 4); ctx.fillStyle = '#3a2a1a'; ctx.fillRect(x + d * 8, y - 16, 1, 1); }
          if (G.kind === 'buff' && q._slot === 0) { ctx.fillStyle = '#e8e4d8'; ctx.fillRect(x - 3, y - 25, 7, 2); }
        }
        if (G.kind === 'top') { const tp = G.top, x = Math.round(tp.x - cam.x), y = Math.round(tp.y - cam.y), wob = Math.round(Math.sin(tk * 6) * (1 - tp.spin) * 2); ctx.fillStyle = '#c8783a'; ctx.fillRect(x - 2 + wob, y - 5, 5, 3); ctx.fillStyle = Math.floor(tp.a) % 2 ? '#3a5a9a' : '#e8e0d0'; ctx.fillRect(x - 1 + wob, y - 5, 2, 3); ctx.fillStyle = '#5a3a2a'; ctx.fillRect(x + wob, y - 2, 1, 2); if (tp.spin > 0.2) { ctx.fillStyle = 'rgba(160,140,110,0.4)'; ctx.fillRect(x - 3, y, 7, 1); } }
      }
    });
    (O.extraLines = O.extraLines || []).push((s, q) => { if (!q._kid2) return ''; const G = games.find((g) => g.kids.includes(q)); return G ? { knights: 'You are playing at knights with a stick for a sword.', tug: 'You are playing tug of war with your friends.', buff: 'You are playing blind man\'s buff.', top: 'You are spinning your whip-top in the dirt.' }[G.kind] : ''; });
    O.KidsPlay2 = { games, get played() { return played; }, start: (kind) => { const s = cur(), P = game.player; const kids = s.people.filter((q) => free(q)).sort((a, b) => Math.hypot(a.agent.x - P.x, a.agent.y - P.y) - Math.hypot(b.agent.x - P.x, b.agent.y - P.y)).slice(0, NEED[kind]); if (kids.length < NEED[kind]) return 'not enough children'; const lead = kids[0]; return begin(s, kind, kids, Math.floor(lead.agent.x / T) * T + 8, Math.floor(lead.agent.y / T) * T + 10) ? kids.map((q) => q.first).join(', ') : null; } };
  }
  O.KidsPlay2Setup = { setup };
})();
