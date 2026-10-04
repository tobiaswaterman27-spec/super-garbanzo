// Signs over the doors. Walk near a building and a little painted board hangs by its door saying what
// it is and who lives or works there: "HOBB'S BAKERY · ALICE HOBB, BAKER", "THE FULLER HOUSE · THOMAS,
// JOAN, PETER". Lettered in a tiny pixel hand, three dots wide and five tall, like everything else.
'use strict';
(function () {
  // 3x5 pixel glyphs, one string of 15 bits per character (rows top to bottom)
  const G = {
    A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', E: '111100110100111', F: '111100110100100', G: '011100101101011',
    H: '101101111101101', I: '111010010010111', J: '001001001101010', K: '101101110101101', L: '100100100100111', M: '101111111101101', N: '110101101101101',
    O: '010101101101010', P: '110101110100100', Q: '010101101110011', R: '110101110101101', S: '011100010001110', T: '111010010010010', U: '101101101101111',
    V: '101101101101010', W: '101101111111101', X: '101101010101101', Y: '101101010010010', Z: '111001010100111',
    0: '111101101101111', 1: '010110010010111', 2: '110001010100111', 3: '110001010001110', 4: '101101111001001', 5: '111100110001110', 6: '011100111101111',
    7: '111001010010010', 8: '111101111101111', 9: '111101111001110', "'": '010010000000000', '.': '000000000000010', ',': '000000000010100', '-': '000000111000000',
    '&': '010101010101011', '·': '000000010000000', ' ': '000000000000000', ':': '000010000010000',
  };
  function width(t) { return t.length * 4 - 1; }
  function text(ctx, t, x, y, col) {
    ctx.fillStyle = col;
    for (let i = 0; i < t.length; i++) { const g = G[t[i]] || G[' ']; for (let k = 0; k < 15; k++) if (g[k] === '1') ctx.fillRect(x + i * 4 + (k % 3), y + Math.floor(k / 3), 1, 1); }
  }
  O.PixText = { text, width };

  const LABEL = { bakery: 'BAKERY', smithy: 'SMITHY', tavern: 'TAVERN', store: 'STORE', doctor: 'PHYSICIAN', guard: 'WATCH HOUSE', chapel: 'CHAPEL', mill: 'MILL', farmhouse: 'FARM', woodcutter: 'WOODCUTTER', stable: 'STABLES', butcher: 'BUTCHER', tailor: 'TAILOR', builder: "BUILDER'S YARD", chandler: 'CHANDLER' };

  function linesFor(sim, b) {
    if (!sim || b.site || b.type === 'hideout' || b.ruined) return null;
    const up = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9 '.,&:-]/g, '');
    const people = (sim.households || []).filter((h) => !h.gone && h.home === b.id).flatMap((h) => h.members.map((id) => sim.byId.get(id)).filter((p) => p && p.alive !== false));
    const bz = sim.biz && sim.biz.get(b.id);
    const title = up(b.name && b.name !== 'House' && b.name !== 'Cottage' ? b.name : people[0] ? `The ${people[0].sur} house` : 'An empty house');
    let who = '';
    if (bz && bz.workers && bz.workers.length) { const boss = sim.byId.get(bz.owner || bz.workers[0]); if (boss) who = `${boss.first} ${boss.sur}, ${boss.job ? boss.job.role : 'keeper'}`; }
    else if (people.length) { const adults = people.filter((p) => p.age >= 16).slice(0, 3); who = adults.map((p) => p.first).join(', ') + (people.length > adults.length ? ` & ${people.length - adults.length} more` : ''); }
    else if (b.vacant) who = b.parishLet ? 'To let: ask the parish clerk' : 'Standing empty';
    const out = [title]; if (who) out.push(up(who));
    return out.map((l) => (l.length > 34 ? l.slice(0, 33) + '.' : l));
  }

  function setup(game) {
    const cache = new Map(); // building -> lines, refreshed every few seconds
    let t = 0;
    game.hooks.update.push((dt) => { t -= dt; if (t <= 0) { t = 3; cache.clear(); } });
    game.hooks.drawTop.push((ctx, cam, indoor) => {
      if (indoor || game.scene || !game.world) return;
      const sim = O.SimRef.cur, p = game.player, T = game.world.T;
      // only the one or two buildings you're nearest, so the street doesn't fill with boards
      const near = game.world.buildings.filter((b) => b.doorX != null && Math.abs(b.doorX * T + 8 - p.x) < 110 && Math.abs(b.doorY * T - p.y) < 90)
        .sort((a, c) => Math.hypot(a.doorX * T + 8 - p.x, a.doorY * T - p.y) - Math.hypot(c.doorX * T + 8 - p.x, c.doorY * T - p.y)).slice(0, 2);
      for (const b of near) {
        const dx = b.doorX * T + 8, dy = b.doorY * T;
        let lines = cache.get(b); if (lines === undefined) { lines = linesFor(sim, b); cache.set(b, lines); }
        if (!lines) continue;
        const w = Math.max(...lines.map(width)) + 8, h = lines.length * 7 + 5;
        const sx = Math.round(dx - w / 2 - cam.x), sy = Math.round(dy - 58 - h - cam.y);
        // the board hanging from its bracket
        ctx.fillStyle = '#3a2618'; ctx.fillRect(sx + 4, sy - 4, 1, 4); ctx.fillRect(sx + w - 5, sy - 4, 1, 4); ctx.fillRect(sx + 2, sy - 5, w - 4, 1);
        ctx.fillStyle = '#2a1a10'; ctx.fillRect(sx - 1, sy - 1, w + 2, h + 2);
        ctx.fillStyle = '#8a6239'; ctx.fillRect(sx, sy, w, h);
        ctx.fillStyle = '#a07448'; ctx.fillRect(sx, sy, w, 1);
        ctx.fillStyle = '#6a4a2c'; ctx.fillRect(sx, sy + h - 1, w, 1);
        lines.forEach((l, i) => { const lx = sx + Math.round((w - width(l)) / 2); text(ctx, l, lx, sy + 3 + i * 7, i ? '#f0e2c0' : '#ffe9a8'); });
      }
    });
  }
  O.Signs = { setup, linesFor };
})();
