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

  // Little wooden signs on a post, like a village noticeboard in miniature: one stands by every door,
  // just to the left of it, and you read it by walking up to it (E). A For Sale board stands to the right.
  let nameSprite = null;
  function nameSign() {
    if (nameSprite) return nameSprite;
    const P = O.Pal, B = new O.MatBuffer(16, 17), wood = P.mat(P.wood.oak, 'wood'), pale = P.mat('#c89a5e', 'wood'), ink = P.mat('#4a3020', 'wood');
    B.part(1); B.capsule(8, 16, 8, 8, 0.9, 0.9, wood);
    B.part(2); B.rect(1, 1, 14, 9, pale, 2); for (let x = 1; x < 15; x++) { B.shadeAt(x, 9, 1); B.shadeAt(x, 1, 3); } B.shadeAt(1, 1, 1); B.shadeAt(14, 1, 1);
    for (const [x0, x1, y] of [[3, 12, 4], [4, 10, 6]]) for (let x = x0; x <= x1; x++) B.plot(x, y, ink, 1);
    const c = B.toCanvas(); nameSprite = { canvas: c, ox: 8, oy: 16, W: c.width, H: c.height }; return nameSprite;
  }
  // a spot beside a door that's free to stand a sign on, or null
  function spotBy(w, b, side) {
    for (const dx of side < 0 ? [-1, -2] : [1, 2]) {
      const x = b.doorX + dx, y = b.doorY, i = y * w.W + x;
      if (x < 0 || y < 0 || x >= w.W || y >= w.H || w.solid[i]) continue;
      const t = w.ter[i]; if (t === w.TER.WATER || t === w.TER.BRIDGE) continue;
      if (w.props.some((p) => Math.floor(p.x / 16) === x && Math.floor((p.y - 1) / 16) === y && !p.flat)) continue;
      return [x, y];
    }
    return null;
  }
  // stand a sign prop beside a building's door (kept solid so you walk round it like anything else)
  function plant(w, b, kind, sprite, side) {
    const at = spotBy(w, b, side); if (!at) return null;
    const p = { kind, x: at[0] * 16 + 8, y: at[1] * 16 + 13, seed: b.id, solid: true, sprite, signFor: b.id };
    w.props.push(p); w.solid[at[1] * w.W + at[0]] = 1; w.dirtyStatics = true;
    return p;
  }
  function pull(w, p) { const i = w.props.indexOf(p); if (i >= 0) w.props.splice(i, 1); w.solid[Math.floor((p.y - 1) / 16) * w.W + Math.floor(p.x / 16)] = 0; w.dirtyStatics = true; }

  function setup(game) {
    // every building with a door gets its little sign, once per world
    game.hooks.update.push(() => {
      const w = game.world; if (!w || game.scene || w._signed) return;
      w._signed = true;
      for (const b of w.buildings) if (b.doorX != null && !b.site && !b.ruined && b.type !== 'hideout' && !w.props.some((p) => p.kind === 'namesign' && p.signFor === b.id)) plant(w, b, 'namesign', nameSign(), -1);
    });
    const T = 16;
    O.signCandidate = () => {
      const w = game.world; if (!w || game.scene) return null;
      const p = game.player; let best = null, bd = 22;
      for (const q of w.props) if (q.kind === 'namesign' && Math.abs(q.x - p.x) < 30 && Math.abs(q.y - p.y) < 30) { const d = Math.hypot(q.x - p.x, q.y - p.y); if (d < bd) { bd = d; best = { type: 'namesign', prop: q, d, x: q.x, y: q.y - 26 }; } }
      return best;
    };
    O.readSign = (c) => {
      const w = game.world, b = w.buildings.find((x) => x.id === c.prop.signFor); if (!b) return;
      const lines = linesFor(O.SimRef.cur, b) || [b.name || 'A house'];
      const nice = (t) => t.toLowerCase().replace(/(^|[\s'-])([a-z])/g, (m, a, ch) => a + ch.toUpperCase());
      O.UI.dialog.open({ name: nice(lines[0]), color: '#8a6239', text: lines.slice(1).map(nice).join('. ') || 'Nothing more is written.', options: [] });
    };
    void T;
  }
  O.Signs = { setup, linesFor, plant, pull, spotBy, nameSign: () => nameSign() };
})();
