// The moot, seen. When the folk gather in the square at five to choose their reeve, it's a proper meeting:
// the two who stand get up on boxes in the middle and speak their piece in turn, the crowd heckles and
// argues among itself, points and shakes its head, and at six the show of hands goes up, a forest of arms,
// and the name is cried, and the winner is cheered and slapped on the back while the loser shakes his hand.
'use strict';
(function () {
  function setup(game) {
    const cur = () => O.SimRef.cur, SP = O.Sim.prototype;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    let M = null, held = 0;
    const talking = (q) => O.npcUI && O.npcUI.talking && O.npcUI.talking() === q;
    const near = (x, y, r) => Math.hypot(x - game.player.x, y - game.player.y) < r;
    // the crowd's own business while it waits
    const _idle = SP.idleAnim; SP.idleAnim = function (p) { if (p.activity?.act === 'moot' && !p.agent.talking) { if (M && M.cheer > 0) return (Math.floor(this.minute) + p.id) % 2 ? 'celebrate' : 'wave'; if (M && M.hands) return 'celebrate'; const k = (Math.floor(this.minute / 2) + p.id) % 9; return ['look', 'talk', 'look', 'point', 'look', 'shake', 'talk', 'look', 'nod'][k]; } return _idle.call(this, p); };
    const _hold = SP.holdMoot;
    if (_hold) SP.holdMoot = function () { const before = this.reeveId; const r = _hold.apply(this, arguments); try { if (M && M.s === this) { const now = this.reeveId; M.result = now === 'player' ? 'you' : (this.byId.get(now) || null); M.cheer = 14; M.hands = false; held++; const w = M.result && M.result !== 'you' ? M.result : null; if (w && near(M.x, M.y, 420)) { O.Speech && O.Speech.say(w, pick(['I thank you all. I\'ll not let you down.', 'Well! A drink for everyone, then!', 'I\'ll do my best by this town.']), 3.5); } const l = M.cands.find((c) => c !== w); if (l && w && near(M.x, M.y, 420)) setTimeout(() => { O.Speech && O.Speech.say(l, 'Well won. I\'ll hold you to your promises.', 2.6); O.gesture && O.gesture(l, 'give', 1.5); }, 2500); void before; } } catch (e) { /* */ } return r; };
    function release() { if (!M) return; for (const q of M.cands) { const a = q.agent; if (!a) continue; a.forceAnim = null; a.lift = 0; if (!talking(q)) a.frozen = false; q._moot = false; } M = null; }
    game.hooks.update.push((dt) => {
      const s = cur(); if (!s || !s.world || game.scene) return; const hr = s.minute / 60;
      if (M) { M.t += dt; if (M.cheer > 0) { M.cheer -= dt; if (M.cheer <= 0) { release(); return; } }
        if (M.s !== s || hr >= 18.6 || M.cands.some((q) => talking(q) || q.alive === false)) { release(); return; }
        if (hr >= 17.9 && !M.hands && !M.result) { M.hands = true; const c = M.cands[0]; near(M.x, M.y, 420) && O.Speech && O.Speech.say(c, 'Show of hands, then! Who\'s for me?', 2.4); O.sfx && near(M.x, M.y, 420) && O.sfx('handbell', 0.3); }
        M.cands.forEach((q, i) => { const a = q.agent; a.x = M.x + (i ? 22 : -22); a.y = M.y; a.lift = 6; a.dir = 0; a.frozen = true; a.path = null; a.forceAnim = M.result ? (q === M.result ? 'celebrate' : 'nod') : M.hands ? 'point' : (M.turn === i ? 'gesture' : 'look'); });
        M.speak -= dt; if (M.speak <= 0 && !M.hands && !M.result) { M.speak = 7; M.turn = 1 - (M.turn || 0); const q = M.cands[M.turn]; if (near(M.x, M.y, 420)) { O.Speech && O.Speech.say(q, pick(['I\'ll mend the bridge before the floods come!', 'Lower tolls, and fair weights at the market!', 'I\'ve served this town thirty years.', 'Ask yourselves who kept the granary full last winter!', 'No more fines for the poor!', 'A stronger watch, and safe streets at night!']), 4); const h = s.people.find((x) => x.activity?.act === 'moot' && x.agent && !x.agent.hidden && Math.random() < 0.4); if (h) setTimeout(() => O.Speech && O.Speech.say(h, pick(['Words are cheap!', 'Hear, hear!', 'And who pays for it?', 'Liar!', 'Aye!']), 2), 2000); } }
        return; }
      if (s.reeveMoot !== s.day || hr < 17 || hr >= 17.8 || !s.Z || !s.Z.square) return;
      const [x0, y0, x1, y1] = s.Z.square, cx = (x0 + x1) * 8 + 8, cy = (y0 + y1) * 8 + 8; if (!near(cx, cy, 600)) return;
      const crowd = s.people.filter((p) => p.activity?.act === 'moot' && p.age >= 30 && !p.gang && p.agent && !p.agent.hidden && !p.agent.frozen && !talking(p));
      const pre = (p) => { try { return (s.household(p).money > 150 ? 0.15 : 0) + p.age / 300 + (p.id === s.reeveId ? 0.3 : 0); } catch (e) { return p.age / 300; } };
      const cands = crowd.sort((a, b) => pre(b) - pre(a)).slice(0, 2); if (cands.length < 2) return;
      for (const q of cands) q._moot = true; M = { s, cands, x: cx, y: cy, t: 0, speak: 1, turn: 1, hands: false, result: null, cheer: 0 };
    });
    game.hooks.drawWorld.push((ctx, cam) => { if (!M || game.scene || M.s !== cur()) return; for (const i of [0, 1]) { const x = Math.round(M.x + (i ? 22 : -22) - cam.x), y = Math.round(M.y - cam.y); ctx.fillStyle = '#7a5a3a'; ctx.fillRect(x - 6, y - 6, 12, 7); ctx.fillStyle = '#9a7a4a'; ctx.fillRect(x - 6, y - 6, 12, 1); } });
    (O.extraLines = O.extraLines || []).push((s, q) => M && M.cands.includes(q) ? 'You are standing for reeve at the moot in the square, speaking to the crowd from a box.' : (q.activity?.act === 'moot' ? 'You are at the moot in the square, where the town is choosing its reeve. You have opinions about the candidates.' : ''));
    O.MootScene = { get moot() { return M; }, get held() { return held; } };
  }
  O.MootSceneSetup = { setup };
})();
