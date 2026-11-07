// The notice board draws a crowd. Passers-by stop at it to read what's pinned up (those who can read
// do it aloud for those who can't), point at one notice, shake their heads at another; the crier comes
// of a morning to pin up a fresh sheet; and the sheets themselves flutter, more of them as the week goes.
'use strict';
(function () {
  function setup(game) {
    const cur = () => O.SimRef.cur;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    const say = (q, t, secs) => O.Speech && O.Speech.say(q, t, secs || 1.8);
    let tick = 4;
    const board = (s) => s.world.props.find((p) => p.kind === 'noticeboard');
    game.hooks.update.push((dt) => {
      const s = cur(); if (!s || !s.world || game.scene || !O.Errands) return; tick -= dt; if (tick > 0) return; tick = 6;
      const b = board(s); if (!b || Math.hypot(b.x - game.player.x, b.y - game.player.y) > 420) return; const h = s.minute / 60; if (h < 7 || h > 20) return;
      const readers = [...O.Errands.live].filter((q) => q.errand && q.errand.board).length; if (readers >= 3) return;
      const q = s.people.find((x) => x.age >= 12 && x.agent && !x.agent.hidden && x.agent.inside == null && !x.agent.frozen && !x.errand && x.agent.path && Math.hypot(x.agent.x - b.x, x.agent.y - b.y) < 140 && Math.random() < 0.25); if (!q) return;
      const tx = Math.floor(b.x / 16) + (readers % 3) - 1, ty = Math.floor(b.y / 16) + 1; if (s.world.solid[ty * s.world.W + tx]) return;
      const lettered = (q.skills && q.skills.letters > 0.3) || q.gentry || /clerk|priest|scribe|teacher|physician/.test(q.job?.role || '');
      O.Errands.send(s, q, [tx, ty], { board: true, anim: lettered ? 'read' : 'look', secs: 4 + Math.random() * 4, face: 3, giveUp: game.t + 30, at: () => { const news = (s.chronicle && s.chronicle.facts && s.chronicle.facts.slice(-1)[0]) || null; if (Math.random() < 0.5) say(q, lettered ? pick(['"By order of the council..." Hm.', 'They\'re putting the tolls up again.', 'A reward for a runaway apprentice.', 'Banns of marriage. Well, well.']) : pick(['What does that one say?', 'Can anyone read this?', 'More taxes, I\'ll wager.']), 2.2); void news; } });
    });
    game.hooks.drawWorld.push((ctx, cam) => {
      const s = cur(); if (!s || !s.world || game.scene) return; const b = board(s); if (!b) return; const x = Math.round(b.x - cam.x), y = Math.round(b.y - cam.y); if (x < -30 || y < -50 || x > ctx.canvas.width + 30 || y > ctx.canvas.height + 30) return;
      const n = 3 + (s.weekday % 4), tk = performance.now() / 1000;
      for (let i = 0; i < n; i++) { const px = x - 9 + (i % 3) * 6, py = y - 26 + Math.floor(i / 3) * 6, fl = Math.sin(tk * 3 + i) > 0.85 ? 1 : 0; ctx.fillStyle = ['#efe6c8', '#e8dcc0', '#f4ecd8'][i % 3]; ctx.fillRect(px, py, 5, 5 - fl); ctx.fillStyle = '#5a4a3a'; ctx.fillRect(px + 1, py + 1, 3, 1); ctx.fillRect(px + 1, py + 3, 2, 1); ctx.fillStyle = '#b8352a'; ctx.fillRect(px + 2, py, 1, 1); }
    });
  }
  O.NoticeBoardSetup = { setup };
})();
