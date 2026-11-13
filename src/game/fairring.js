// The fair games, out on the green. On fair day a ring is roped off near the square and a pair of straw
// butts set up at sixty paces, and they are used: townsfolk strip to their shirts and wrestle best of three
// falls while a crowd shouts round the ropes, and take turns at the line with a bow, the arrows thudding into
// the straw. Step into the ring yourself (or call someone out, in your own words) and it's a real neighbour
// you're grappling, down in the dirt in front of everyone; shoot at the butts and your three arrows stand in
// the target for all to count.
'use strict';
(function () {
  const T = 16;
  function setup(game) {
    const cur = () => O.SimRef.cur, PS = O.PlayerState;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    const say = (q, t, secs) => O.Speech && O.Speech.say(q, t, secs || 2);
    const ui = (t, k) => O.UI && O.UI.say && O.UI.say(t, k || 'info');
    const near = (x, y, r) => Math.hypot(x - game.player.x, y - game.player.y) < r;
    const talking = (q) => O.npcUI && O.npcUI.talking && O.npcUI.talking() === q;
    const free = (q) => q && q.alive !== false && q.agent && !q.agent.hidden && q.agent.inside == null && !q.agent.frozen && !q.errand && !q._bit && !q._scene && !q._fair && !q.visitor && !q.jailUntil && !talking(q);
    const isFair = (s) => O.Festivals && O.Festivals.today && O.Festivals.today(s) === 'fair';
    const open = (s) => isFair(s) && s.hour >= 10 && s.hour < 18 && !game.scene;
    let G = null, B = null, A = null, bouts = 0, youWrestled = 0, youWon = 0, shots = 0, youShot = 0, npcShots = 0; const flying = [], stuck = []; let cool = 8, acool = 5;
    const rel_ = (q) => { if (!q || q === 'player') return; q._in = false; q._at = false; if (!q._fair) return; q._fair = false; if (q.agent) { q.agent.forceAnim = null; if (!talking(q)) q.agent.frozen = false; } };
    function clear(s, x, y, hw, hh) { for (let dx = -hw; dx <= hw; dx += 12) for (let dy = -hh; dy <= hh; dy += 10) if (game.solidAt(x + dx, y + dy)) return false;
      // nor under anyone's roof: a house's roof stands well above its walls
      if (s.world.buildings.some((b) => b.x != null && x + hw > b.x * T - 6 && x - hw < (b.x + b.w) * T + 6 && y + hh > (b.y - 2 - (b.floors || 1) * 2) * T && y - hh - 20 < ((b.bottom ?? b.y + b.d) + 1) * T)) return false;
      return !s.world.props.some((p) => { const m = p.kind === 'stall' ? 26 : p.kind === 'puddle' || p.kind === 'flowers' || p.kind === 'grass' ? -999 : 4; return Math.abs(p.x - x) < hw + m && Math.abs(p.y - y) < hh + m; }); }
    function ground(s) { if (G && G.day === s.day && G.place === s.world.placeId) return G; const lists = s.world.props.find((x) => x.kind === 'noticeboard') || s.world.props.find((x) => x.kind === 'well'); if (!lists) return null;
      let ring = null, line = null;
      // the square first, if there's room on the cobbles
      const sq = s.Z && s.Z.square; if (sq) for (let ty = sq[1] + 2; ty <= sq[3] - 1 && !ring; ty++) for (let tx = sq[0] + 3; tx <= sq[2] - 2 && !ring; tx++) { const x = tx * T + 8, y = ty * T + 8; if (clear(s, x, y, 40, 28)) ring = [x, y]; }
      for (let r = 50; r <= 420 && (!ring || !line); r += 16) for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2, x = lists.x + Math.cos(a) * r, y = lists.y + Math.sin(a) * r * 0.8;
        if (!ring && clear(s, x, y, 40, 28)) { ring = [x, y]; continue; }
        if (!line && ring && Math.hypot(x - ring[0], y - ring[1]) > 120 && Math.hypot(x + 110 - ring[0], y - ring[1]) > 100 && Math.abs(y - ring[1]) > 50 && clear(s, x, y, 8, 8) && clear(s, x + 110, y, 8, 10) && [30, 55, 80].every((d) => !game.solidAt(x + d, y))) line = [x, y]; }
      G = { day: s.day, place: s.world.placeId, ring, line, butt: line ? [line[0] + 110, line[1]] : null }; return G; }
    // ---------------------------------------------------------------- the wrestling ring
    function crowdFor(s, cx, cy, n) { const out = []; for (const q of s.people) { if (out.length >= n) break; if (!free(q) || q.age < 8 || Math.hypot(q.agent.x - cx, q.agent.y - cy) > 340) continue; out.push(q); }
      out.forEach((q, i) => { q._fair = true; const a = (i / Math.max(1, out.length)) * Math.PI * 2 + 0.3, x = cx + Math.cos(a) * 52, y = cy + Math.sin(a) * 36; O.Errands.send(s, q, [Math.floor(x / T), Math.floor(y / T)], { anim: 'idle', secs: 0.2, giveUp: game.t + 25, after: (ok) => { if (!B || !B.crowd.includes(q)) return; if (!ok) { rel_(q); return; } q.agent.frozen = true; q.agent.path = null; q._at = true; } }); }); return out; }
    function rival(s, cx, cy, not) { return s.people.filter((q) => free(q) && q !== not && q.age >= 18 && q.age <= 45 && Math.hypot(q.agent.x - cx, q.agent.y - cy) < 400).sort((a, b) => ((b.sex === 'm') - (a.sex === 'm')) || (Math.random() - 0.5))[0]; }
    function enter(s, q, x, y, dir) { q._fair = true; O.Errands.send(s, q, [Math.floor(x / T), Math.floor(y / T)], { anim: 'idle', secs: 0.2, face: dir, giveUp: game.t + 30, after: (ok) => { if (!B) return; if (!ok) { q.agent.x = x; q.agent.y = y; } q.agent.frozen = true; q.agent.path = null; q.agent.dir = dir; q._in = true; } }); }
    function startBout(s, a, b) { const g = ground(s); if (!g || !g.ring) return false; const [cx, cy] = g.ring; bouts++;
      B = { s, a, b, t: 0, fall: 0, me: 0, him: 0, stage: 'in', crowd: crowdFor(s, cx, cy, 6), x: cx, y: cy, k: 0 };
      if (a === 'player') { const P = game.player; P.x = cx - 12; P.y = cy; P.dir = 2; P.locked = true; } else enter(s, a, cx - 12, cy, 2); enter(s, b, cx + 12, cy, 1);
      if (near(cx, cy, 420)) ui(a === 'player' ? `You duck under the rope. ${b.first} spits on their hands and steps in. Best of three falls.` : `${a.first} and ${b.first} are in the wrestling ring. Best of three falls.`, 'info'); return true; }
    const strength = (who) => who === 'player' ? Math.random() * 0.8 + Math.max(PS.skills.fighting || 0, PS.skills.combat || 0) * 0.5 + (PS.hp / 100) * 0.2 : Math.random() * 0.8 + 0.25 + (who.sex === 'm' ? 0.05 : 0) + ((who.skills && who.skills.fighting) || 0) * 0.3;
    const agentOf = (w) => w === 'player' ? game.player : w.agent;
    const setAnim = (w, an) => { if (w === 'player') game.player.anim = an || 'idle'; else w.agent.forceAnim = an; };
    function endBout() { if (!B) return; const { a, b, crowd } = B; if (a === 'player') { game.player.locked = false; game.player.anim = 'idle'; } else rel_(a); rel_(b); for (const q of crowd) rel_(q); B = null; cool = 40 + Math.random() * 40; }
    game.hooks.update.push((dt) => { const s = cur(); if (!s || !s.world) return;
      if (B) { B.t += dt; const { a, b } = B; if (B.s !== s || game.scene || B.t > 120 || (a !== 'player' && a.alive === false) || b.alive === false) { endBout(); return; }
        for (const q of B.crowd) if (q._at) { q.agent.dir = O.dirOf(B.x - q.agent.x, B.y - q.agent.y); }
        if (B.stage === 'in') { const ready = (a === 'player' || a._in) && b._in; if (ready || B.t > 18) { if (a !== 'player' && !a._in) { a.agent.x = B.x - 12; a.agent.y = B.y; a.agent.frozen = true; } if (!b._in) { b.agent.x = B.x + 12; b.agent.y = B.y; b.agent.frozen = true; } B.stage = 'grip'; B.k = 0; B.fall++; } return; }
        B.k += dt; const aa = agentOf(a), ba = agentOf(b);
        if (B.stage === 'grip') { const f = Math.floor(B.k * 4) % 4; setAnim(a, f % 2 ? 'attack' : 'hurt'); setAnim(b, f % 2 ? 'hurt' : 'attack'); const sh = Math.sin(B.k * 6) * 4; aa.x = B.x - 9 + sh; ba.x = B.x + 9 + sh; if (Math.random() < dt * 3 && near(B.x, B.y, 340)) O.sfx && O.sfx('smack', 0.15); if (Math.random() < dt * 1.5) { const z = pick(B.crowd.filter((c) => c._at)); if (z) { O.gesture && O.gesture(z, pick(['celebrate', 'point']), 0.8); if (Math.random() < 0.3 && near(z.agent.x, z.agent.y, 300)) say(z, pick([`Go on, ${a === 'player' ? 'stranger' : a.first}!`, `Throw him, ${b.first}!`, 'Get his leg!', 'Hold him!']), 1.4); } }
          if (B.k > 3.2) { const aw = strength(a) > strength(b); B.down = aw ? b : a; if (aw) B.me++; else B.him++; B.stage = 'down'; B.k = 0; setAnim(B.down, 'lie'); setAnim(aw ? a : b, 'celebrate'); O.sfx && near(B.x, B.y, 380) && O.sfx('smack', 0.4); for (const z of B.crowd) O.gesture && O.gesture(z, 'celebrate', 1.2);
            if (near(B.x, B.y, 420)) ui(`Fall ${B.fall}: ${aw ? (a === 'player' ? 'you throw' : `${a.first} throws`) + ` ${b.first}` : `${b.first} throws ${a === 'player' ? 'you' : a.first}`}. (${B.me} to ${B.him})`, 'info'); } return; }
        if (B.stage === 'down') { if (B.k < 2) return; setAnim(a, null); setAnim(b, null); if (B.me < 2 && B.him < 2) { B.stage = 'grip'; B.k = 0; B.fall++; return; }
          const aw = B.me > B.him, winner = aw ? a : b, loser = aw ? b : a;
          if (a === 'player') { youWrestled++; PS.hp = Math.max(5, PS.hp - (aw ? 4 : 10)); PS.skills.fighting = Math.min(1, (PS.skills.fighting || 0) + 0.03); if (aw) { youWon++; PS.money = (PS.money || 0) + 12; PS.rep.local = Math.min(1, (PS.rep.local || 0) + 0.06); s.log(`The stranger won the wrestling at the fair, throwing ${b.name}.`, 'event'); ui(`The ring roars. The reeve slaps the purse of ₳12 into your hand.`, 'good'); } else ui(`${b.first} has you twice. The crowd groan for you, and laugh, and buy you an ale.`, 'info');
            try { s.remember(b, aw ? 'The stranger threw me in the wrestling at the fair, in front of everyone.' : 'I threw the stranger in the wrestling at the fair.', aw ? 'loss' : 'pride', 1.2, 0); const r = b.rel.get(0) || { affinity: 0, familiar: 0 }; r.familiar = Math.min(1, (r.familiar || 0) + 0.2); r.affinity = Math.max(-1, Math.min(1, r.affinity + (aw ? -0.02 : 0.05))); b.rel.set(0, r); } catch (e) { /* */ } }
          else { const hh = s.household(winner); if (hh) hh.money = (hh.money || 0) + 12; try { s.remember(winner, `Won the wrestling at the fair, throwing ${loser.first}.`, 'pride', 1.5); s.remember(loser, `${winner.first} threw me in the wrestling at the fair.`, 'loss', 1); s.relate(winner, loser, 0.05); } catch (e) { /* */ } if (near(B.x, B.y, 420)) ui(`${winner.first} wins the wrestling and the purse.`, 'info'); }
          if (winner !== 'player' && near(B.x, B.y, 380)) say(winner, pick(['Who\'s next?', 'Ha! Down you go.', 'Good bout. Good bout.']), 1.8);
          B.stage = 'done'; B.k = 0; return; }
        if (B.stage === 'done' && B.k > 2) endBout(); return; }
      if (!open(s)) return; cool -= dt; if (cool > 0) return; cool = 25; const g = ground(s); if (!g || !g.ring || !near(g.ring[0], g.ring[1], 520)) return;
      const a = rival(s, g.ring[0], g.ring[1]); const b = a && rival(s, g.ring[0], g.ring[1], a); if (a && b) startBout(s, a, b); });
    // ---------------------------------------------------------------- the butts
    function score(skill) { return Math.max(0, Math.min(10, Math.round(3 + skill * 6 + (Math.random() - 0.4) * 6))); }
    function loose(fromX, fromY, sc) { const g = G; const off = (10 - sc) * 1.6, ang = Math.random() * Math.PI * 2; const tx = g.butt[0] + Math.cos(ang) * off * 0.7, ty = g.butt[1] - 16 + Math.sin(ang) * off; flying.push({ x: fromX, y: fromY - 18, tx, ty, t: 0, dur: 0.55, sc }); O.sfx && near(fromX, fromY, 400) && O.sfx('whoosh', 0.4); }
    game.hooks.update.push((dt) => { const s = cur(); if (!s || !s.world) return;
      for (const f of flying.slice()) { f.t += dt; if (f.t >= f.dur) { flying.splice(flying.indexOf(f), 1); stuck.push({ x: f.tx, y: f.ty, day: s.day }); if (stuck.length > 30) stuck.shift(); if (near(f.tx, f.ty, 400)) O.sfx && O.sfx('smack', 0.15); } }
      if (A) { A.t += dt; const { who } = A; if (A.s !== s || game.scene || A.t > 60) { endShoot(); return; }
        const ag = agentOf(who); if (!A.at) { if (who === 'player' || who._in || A.t > 15) { A.at = true; A.k = 0; if (who !== 'player') { ag.x = G.line[0]; ag.y = G.line[1]; ag.frozen = true; } } return; }
        A.k += dt; ag.dir = 2; setAnim(who, A.k % 1.6 < 0.9 ? 'point' : 'idle');
        if (A.n < 3 && A.k > 1.2 + A.n * 1.6) { const sc = A.scores[A.n]; A.n++; loose(ag.x, ag.y, sc); }
        if (A.n >= 3 && A.k > 1.2 + 3 * 1.6 + 0.8) { const total = A.scores.reduce((x, y) => x + y, 0);
          if (who === 'player') { youShot++; const others = (s._fairArch || []).filter((x) => x.day === s.day).map((x) => x.total); const best = others.length ? Math.max(...others) : 14 + Math.floor(Math.random() * 10); PS.skills.archery = Math.min(1, ((PS.skills && PS.skills.archery) || 0.1) + 0.05); const won = total > best;
            if (won) { PS.money = (PS.money || 0) + 25; PS.rep.civilian = Math.min(1, PS.rep.civilian + 0.08); s.log('The stranger won the archery at the fair.', 'event'); }
            ui(`Your arrows: ${A.scores.join(', ')}, ${total} in all. Best of the others: ${best}. ${won ? 'The crowd cheer; the reeve hands you the purse of ₳25.' : 'Not today.'}`, won ? 'good' : 'info'); }
          else { npcShots++; (s._fairArch = s._fairArch || []).push({ day: s.day, who: who.id, total }); if (near(ag.x, ag.y, 360)) say(who, total >= 20 ? pick(['Ha! Beat that.', 'Three in the straw, near enough.']) : pick(['Wind took that one.', 'Bah.']), 1.6); }
          endShoot(); } return; }
      if (!open(s)) return; acool -= dt; if (acool > 0) return; acool = 18 + Math.random() * 12; const g = ground(s); if (!g || !g.line || !near(g.line[0], g.line[1], 520)) return;
      const q = s.people.find((z) => free(z) && z.age >= 14 && z.age <= 55 && Math.hypot(z.agent.x - g.line[0], z.agent.y - g.line[1]) < 380); if (q) shoot(s, q); });
    function shoot(s, who) { const g = ground(s); if (!g || !g.line || A) return false; shots++; const skill = who === 'player' ? ((PS.skills && (PS.skills.archery || PS.skills.hunting)) || 0.1) : (((who.skills && who.skills.hunting) || 0) * 0.6 + 0.15 + Math.random() * 0.25);
      A = { s, who, t: 0, n: 0, at: false, scores: [0, 1, 2].map(() => score(skill)) };
      if (who === 'player') { const P = game.player; P.x = g.line[0]; P.y = g.line[1]; P.locked = true; A.at = true; A.k = 0; ui('You take the bow, nock, and draw. Sixty paces to the straw.', 'info'); }
      else { who._fair = true; O.Errands.send(s, who, [Math.floor(g.line[0] / T), Math.floor(g.line[1] / T)], { anim: 'idle', secs: 0.2, face: 2, giveUp: game.t + 25, after: () => { if (A && A.who === who) who._in = true; } }); } return true; }
    function endShoot() { if (!A) return; if (A.who === 'player') { game.player.locked = false; game.player.anim = 'idle'; } else { A.who._in = false; rel_(A.who); } A = null; }
    // drawing: the ring's posts and rope on the ground, the butts on their trestle, arrows in flight and in the straw
    (game.hooks.drawGround = game.hooks.drawGround || []).push((ctx, cam) => { const s = cur(); if (game.scene || !s || !isFair(s) || !G || G.day !== s.day) return;
      if (G.ring) { const [cx, cy] = G.ring, x0 = Math.round(cx - 40 - cam.x), y0 = Math.round(cy - 28 - cam.y), w = 80, h = 56; ctx.fillStyle = 'rgba(90,70,40,0.22)'; ctx.fillRect(x0 + 1, y0 + 1, w - 1, h - 1); for (let i = 0; i < 26; i++) { ctx.fillStyle = i % 3 ? '#b89a62' : '#9a7a48'; ctx.fillRect(x0 + 3 + ((i * 29) % (w - 6)), y0 + 4 + ((i * 17) % (h - 8)), 2, 1); } const rope = (x, y, ww, hh2) => { ctx.fillStyle = '#6a4e2a'; ctx.fillRect(x, y + 1, ww, hh2); ctx.fillStyle = '#c8a868'; ctx.fillRect(x, y, ww, hh2); }; rope(x0, y0 - 6, w, 1); rope(x0, y0 + h - 6, w, 1); rope(x0, y0 - 6, 1, h); rope(x0 + w, y0 - 6, 1, h + 1);
        for (const [px, py] of [[x0, y0], [x0 + w, y0], [x0, y0 + h], [x0 + w, y0 + h]]) { ctx.fillStyle = 'rgba(28,20,44,0.3)'; ctx.fillRect(px - 1, py + 1, 4, 1); ctx.fillStyle = '#5a3d26'; ctx.fillRect(px - 1, py - 10, 3, 11); ctx.fillStyle = '#8a6239'; ctx.fillRect(px - 1, py - 10, 1, 10); } } });
    game.hooks.drawWorld.push((ctx, cam) => { const s = cur(); if (game.scene || !s || !isFair(s) || !G || G.day !== s.day) return;
      if (G.butt) { const bx = Math.round(G.butt[0] - cam.x), by = Math.round(G.butt[1] - cam.y); ctx.fillStyle = '#5a3d26'; ctx.fillRect(bx - 6, by - 2, 2, 4); ctx.fillRect(bx + 5, by - 2, 2, 4); ctx.fillStyle = '#c8a860'; ctx.beginPath(); ctx.arc(bx, by - 16, 9, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#e8e0cc'; ctx.beginPath(); ctx.arc(bx, by - 16, 6, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#b03a2a'; ctx.beginPath(); ctx.arc(bx, by - 16, 3, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#e8c860'; ctx.fillRect(bx - 1, by - 17, 2, 2);
        if (G.line) { const lx = Math.round(G.line[0] - cam.x), ly = Math.round(G.line[1] - cam.y); ctx.fillStyle = 'rgba(240,235,220,0.6)'; ctx.fillRect(lx - 1, ly - 10, 1, 18); }
        for (const st of stuck) if (st.day === s.day) { const x = Math.round(st.x - cam.x), y = Math.round(st.y - cam.y); ctx.fillStyle = '#6a4a2c'; ctx.fillRect(x - 5, y, 5, 1); ctx.fillStyle = '#d8d0c0'; ctx.fillRect(x - 7, y - 1, 2, 3); } }
      ctx.save(); for (const a of flying) { const k = Math.min(1, a.t / a.dur), x = a.x + (a.tx - a.x) * k, y = a.y + (a.ty - a.y) * k - Math.sin(k * Math.PI) * 10, ang = Math.atan2(a.ty - a.y - Math.cos(k * Math.PI) * 10, a.tx - a.x); ctx.translate(Math.round(x - cam.x), Math.round(y - cam.y)); ctx.rotate(ang); ctx.fillStyle = '#6a4a2c'; ctx.fillRect(-6, 0, 10, 1); ctx.fillStyle = '#d8d0c0'; ctx.fillRect(-7, -1, 2, 3); ctx.fillStyle = '#8a8a90'; ctx.fillRect(4, 0, 2, 1); ctx.setTransform(1, 0, 0, 1, 0, 0); } ctx.restore(); });
    // you: duck under the rope, or step to the line
    const wrestleYou = (s, foe) => { if (B) return ui('There\'s a bout on. Wait your turn.', 'info'); const did = s._fairDid && s._fairDid.day === s.day ? s._fairDid : (s._fairDid = { day: s.day }); if (did.wrest) return ui('You\'ve had your bout today.', 'info'); if ((PS.money || 0) < 1) return ui('The fee is ₳1.', 'warn'); if (PS.hp < 30) return ui('You\'re in no state to wrestle.', 'warn'); const g = ground(s); if (!g || !g.ring) return; const b = foe || rival(s, g.ring[0], g.ring[1]); if (!b) return ui('Nobody will take you on just now.', 'info'); PS.money -= 1; did.wrest = true; startBout(s, 'player', b); };
    const shootYou = (s) => { if (A) return ui('Someone\'s at the line. Wait your turn.', 'info'); if (s._archeryDay === s.day) return ui('You have had your three arrows today.', 'info'); if ((PS.money || 0) < 2) return ui('The fee is two aurins.', 'warn'); PS.money -= 2; s._archeryDay = s.day; shoot(s, 'player'); };
    (O.moreCandidates = O.moreCandidates || []).push(() => { const s = cur(), P = game.player; if (!s || !open(s) || B || P.locked) return null; const g = ground(s); if (!g || !g.ring || !near(g.ring[0], g.ring[1] + 28, 46)) return null;
      return { type: 'custom', d: 2, x: g.ring[0], y: g.ring[1] - 40, label: 'Duck under the rope and wrestle (₳1, purse ₳12)', act: () => wrestleYou(s) }; });
    (O.moreCandidates = O.moreCandidates || []).push(() => { const s = cur(), P = game.player; if (!s || !open(s) || A || P.locked) return null; const g = ground(s); if (!g || !g.line || !near(g.line[0], g.line[1], 30)) return null;
      return { type: 'custom', d: 2, x: g.line[0], y: g.line[1] - 34, label: 'Shoot three arrows at the butts (₳2, purse ₳25)', act: () => shootYou(s) }; });
    // call someone out, in your own words
    const _say = O.AIChat && O.AIChat.say;
    if (_say) O.AIChat.say = function (q, text, render) { try { const s = cur(), t = String(text || ''); if (s && open(s) && q && /\b(wrestle|wrestling|a fall|throw you|in the ring)\b/i.test(t) && !B) { (q._conv ||= []).push({ who: 'p', t }); const ok = q.age >= 16 && q.age <= 55 && ((q.rel.get(0) || {}).affinity || 0) > -0.5;
        const line = ok ? pick(['You? Ha! Into the ring, then.', 'Right. Don\'t cry when you\'re in the dirt.', 'Go on, then. Best of three.']) : 'Not me. Find some other fool.'; q._conv.push({ who: 'q', t: line }); render(line); if (ok) setTimeout(() => { O.npcUI && O.npcUI.closeTalk && O.npcUI.closeTalk(); q.agent.frozen = false; wrestleYou(s, q); }, 1200); return Promise.resolve(); } } catch (e) { console.error(e); } return _say.apply(this, arguments); };
    (O.extraLines = O.extraLines || []).push((s, q) => { if (B && (q === B.a || q === B.b)) return 'You are wrestling in the ring at the fair, best of three falls.'; if (B && B.crowd.includes(q)) return 'You are watching the wrestling at the fair, shouting with the crowd.'; return ''; });
    O.FairRing = { get ground() { return G; }, get bout() { return B; }, get archer() { return A; }, get bouts() { return bouts; }, get youWrestled() { return youWrestled; }, get youWon() { return youWon; }, get youShot() { return youShot; }, get npcShots() { return npcShots; }, get stuck() { return stuck.length; }, wrestleYou, shootYou, soon: () => { cool = 0; acool = 0; } };
  }
  O.FairRingSetup = { setup };
})();
