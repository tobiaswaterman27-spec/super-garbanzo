// Walking out. On fine evenings a courting pair (or a young married couple) go for a walk together,
// side by side and close, to the well or a bench or the riverbank, and sit a while; he picks her a
// flower from the verge (or she him), heads lean together, there's laughing, and they walk back
// slowly. Folk watching smile and nudge each other; a child makes a face.
'use strict';
(function () {
  const T = 16;
  function setup(game) {
    const cur = () => O.SimRef.cur;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    const say = (q, t, secs) => O.Speech && O.Speech.say(q, t, secs || 1.8);
    const near = (x, y, r) => Math.hypot(x - game.player.x, y - game.player.y) < r;
    const free = (q) => q && q.alive !== false && q.agent && !q.agent.hidden && q.agent.inside == null && !q.agent.frozen && !q.errand && !q._scene && !q._playing && !q._fighting && !q._bit && !q.job?.onShift && !q.visitor && !(O.npcUI && O.npcUI.talking && O.npcUI.talking() === q);
    let walk = null, cool = 30;
    function pair(s) {
      const ppl = s.people.filter((q) => free(q) && q.age >= 16 && q.age <= 40 && near(q.agent.x, q.agent.y, 500));
      for (const a of ppl) { if (a.sex !== 'm') continue; for (const b of ppl) { if (b.sex !== 'f' || b === a) continue; const ra = a.rel && a.rel.get(b.id) || {}; const wed = a.spouse === b.id && a.age < 32; const sweet = !a.spouse && !b.spouse && (ra.affinity || 0) > 0.35 && a.household !== b.household; if (wed || sweet || a.courting === b.id) return [a, b]; } }
      return null;
    }
    function spot(s, a) { const w = s.world, cands = []; for (const pr of w.props) if ((pr.kind === 'bench' || pr.kind === 'well') && Math.hypot(pr.x - a.agent.x, pr.y - a.agent.y) < 360) cands.push([Math.floor(pr.x / T), Math.floor(pr.y / T) + 1]); const pt = pick(cands); if (pt && !w.solid[pt[1] * w.W + pt[0]]) return pt; return null; }
    function begin(s, force) {
      const p2 = force || pair(s); if (!p2) return null; const [a, b] = p2; const sp = spot(s, a); if (!sp) return null;
      const path = s.path.find(Math.floor(a.agent.x / T), Math.floor((a.agent.y - 1) / T), sp[0], sp[1]); if (!path || path.length > 40) return null;
      for (const q of [a, b]) { q._walkout = true; q.agent.frozen = true; q.agent.path = null; }
      b.agent.x = a.agent.x + 8; b.agent.y = a.agent.y + 2;
      walk = { s, a, b, path: path.map(([x, y]) => [x * T + 8, y * T + 10]), pi: 0, stage: 'go', t: 0 }; say(a, pick([`Walk with me, ${b.first}?`, 'Shall we go a little way?', 'It\'s a lovely evening for it.']), 2);
      return walk;
    }
    function end() { const w = walk; if (!w) return; for (const q of [w.a, w.b]) { q._walkout = false; q.agent.forceAnim = null; q.agent.lift = 0; const tq = O.npcUI && O.npcUI.talking && O.npcUI.talking(); if (tq !== q) q.agent.frozen = false; } walk = null; cool = 90 + Math.random() * 90; }
    game.hooks.update.push((dt) => {
      const s = cur(); if (!s) return;
      if (!walk) { cool -= dt; if (cool > 0 || game.scene) return; cool = 12; const h = s.minute / 60; if (h >= 17.5 && h < 21 && !s.raining && s.season !== 'winter') begin(s); return; }
      const w = walk; w.t += dt; if (w.s !== s || game.scene || w.t > 80 || [w.a, w.b].some((q) => q.alive === false || q._fighting)) { end(); return; }
      if ([w.a, w.b].some((q) => O.npcUI && O.npcUI.talking && O.npcUI.talking() === q)) return;
      const A = w.a.agent, B = w.b.agent;
      if (w.stage === 'go' || w.stage === 'back') { if (w.pi !== w.lastPi) { w.lastPi = w.pi; w.stall = 0; } else if ((w.stall = (w.stall || 0) + dt) > 6) { end(); return; } const path = w.stage === 'go' ? w.path : w.back; const tgt = path[w.pi]; if (!tgt) { if (w.stage === 'go') { w.stage = 'sit'; w.st = 0; } else end(); return; }
        const dx = tgt[0] - A.x, dy = tgt[1] - A.y, d = Math.hypot(dx, dy), st = 18 * dt; if (d <= st) { A.x = tgt[0]; A.y = tgt[1]; w.pi++; } else { A.x += dx / d * st; A.y += dy / d * st; } A.dir = O.dirOf(dx, dy); A.forceAnim = 'walk';
        const side = Math.abs(dx) > Math.abs(dy) ? [0, 6] : [7, 0]; const bx = A.x + side[0], by = A.y + side[1]; if (!game.solidAt(bx, by - 2)) { B.x += (bx - B.x) * Math.min(1, dt * 6); B.y += (by - B.y) * Math.min(1, dt * 6); } else { B.x += (A.x - B.x) * Math.min(1, dt * 4); B.y += (A.y + 3 - B.y) * Math.min(1, dt * 4); } B.dir = A.dir; B.forceAnim = 'walk';
        if (Math.random() < dt * 0.15) { const q = pick([w.a, w.b]); q.agent.forceAnim = 'laugh'; }
        if (Math.random() < dt * 0.6) for (const o of w.s.people) { if (o === w.a || o === w.b || !o.agent || o.agent.hidden || o.agent.inside != null || o.agent.frozen || o._sawLove === w || Math.hypot(o.agent.x - A.x, o.agent.y - A.y) > 60) continue; o._sawLove = w; O.gesture && O.gesture(o, o.age < 12 ? 'laugh' : pick(['nod', 'laugh', 'look']), 1.5); if (o.age < 12 && Math.random() < 0.3) say(o, pick(['Ewww.', `${w.a.first} and ${w.b.first}, sitting in a tree...`]), 1.6); } }
      else if (w.stage === 'sit') { w.st += dt; A.forceAnim = 'sit'; B.forceAnim = 'sit'; B.x = A.x + 9; B.y = A.y; A.dir = 2; B.dir = 1;
        if (w.st > 3 && !w.flower) { w.flower = 1; A.forceAnim = 'give'; B.forceAnim = 'take'; w.fl = { t: 0 }; say(w.a, pick(['For you.', 'It\'s not as pretty as you.', 'I picked it on the way.']), 2); setTimeout(() => walk === w && say(w.b, pick(['Oh, you fool.', 'Thank you.', 'You\'re sweet.']), 1.8), 1600); }
        if (w.st > 6 && w.st < 14) { const k = Math.floor(w.st * 0.8) % 3; A.forceAnim = k === 0 ? 'talk' : k === 1 ? 'laugh' : 'sit'; B.forceAnim = k === 1 ? 'laugh' : k === 2 ? 'talk' : 'sit'; }
        if (w.st > 16) { w.stage = 'back'; w.back = w.path.slice().reverse(); w.pi = 0; } }
    });
    game.hooks.drawWorld.push((ctx, cam) => { const w = walk; if (!w || !w.flower || game.scene) return; const B = w.b.agent, x = Math.round(B.x - cam.x) + 4, y = Math.round(B.y - cam.y) - 14; ctx.fillStyle = '#4a8a3a'; ctx.fillRect(x, y, 1, 5); ctx.fillStyle = pick(['#e8d040']) && '#e8d040'; ctx.fillRect(x - 1, y - 2, 3, 2); ctx.fillStyle = '#c04060'; ctx.fillRect(x, y - 3, 1, 1); });
    (O.extraLines = O.extraLines || []).push((s, q) => { const w = walk; if (!w || (q !== w.a && q !== w.b)) return ''; const o = q === w.a ? w.b : w.a; return `You are out walking with ${o.first} on a fine evening; you are sweet on each other and don't much want company.`; });
    O.Courting2 = { start: (a, b) => begin(cur(), a && b ? [a, b] : null), get walk() { return walk; } };
  }
  O.Courting2Setup = { setup };
})();
