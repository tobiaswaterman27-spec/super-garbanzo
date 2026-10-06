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
    // beside the door, never in the road or the street (a sign mustn't block the way)
    for (const dx of side < 0 ? [-1, -2, 1, 2] : [1, 2, -1, -2]) {
      const x = b.doorX + dx, y = b.doorY, i = y * w.W + x;
      if (x < 0 || y < 0 || x >= w.W || y >= w.H || w.solid[i]) continue;
      const t = w.ter[i]; if (t === w.TER.WATER || t === w.TER.BRIDGE || t === w.TER.ROAD || t === w.TER.COBBLE) continue;
      if (w.props.some((p) => Math.floor(p.x / 16) === x && Math.floor((p.y - 1) / 16) === y && !p.flat)) continue;
      return [x, y];
    }
    // a town street of cobbles all round: the sign stands at the wall's foot and you can step past it
    for (const dx of side < 0 ? [-1, 1] : [1, -1]) { const x = b.doorX + dx, y = b.doorY, i = y * w.W + x; if (x >= 0 && y >= 0 && x < w.W && y < w.H && !w.solid[i] && w.ter[i] === w.TER.COBBLE) return [x, y, true]; }
    return null;
  }
  // stand a sign prop beside a building's door (kept solid so you walk round it like anything else)
  function plant(w, b, kind, sprite, side) {
    const at = spotBy(w, b, side); if (!at) return null;
    const p = { kind, x: at[0] * 16 + 8, y: at[1] * 16 + 13, seed: b.id, solid: !at[2], sprite, signFor: b.id };
    w.props.push(p); if (!at[2]) w.solid[at[1] * w.W + at[0]] = 1; w.dirtyStatics = true;
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
      if (b.royal) { const K = O.SimRef.cur.kingdom, cr = K && K.rulers && K.rulers.crown; O.UI.dialog.open({ name: b.name, color: '#8a6239', text: `${cr && cr.name ? cr.name + ' holds court here. ' : ''}Five floors, each a guarded hallway with doors along both walls. Ground floor: the throne room, the kitchens, the servants' hall, the steward's hall, the guardroom and the chapel. First floor: the council hall, where the council of the realm sits at the long table every Thursday at two. Second floor: the rooms of the household's servants and their families. Third floor: the rooms of those who stand higher at court, and the guest chamber. Fourth floor: the monarch's bedchamber and the royal family's chambers, kept locked.`, options: [] }); return; }
      const nice = (t) => t.toLowerCase().replace(/(^|[\s'-])([a-z])/g, (m, a, ch) => a + ch.toUpperCase());
      O.UI.dialog.open({ name: nice(lines[0]), color: '#8a6239', text: lines.slice(1).map(nice).join('. ') || 'Nothing more is written.', options: [] });
    };
    // in the castle every door off the hallway has its plaque: what the room is, and (close up) who lives there
    // in the castle every door off the hallway has a little painted board beside it with an icon, like
    // the trade signs outside: a crown, a pot, a cup, a shield, a cross, a bed. Walk up to it and read it (E)
    // to learn what the room is and who has it.
    const ICON = {
      crown: ['#.#.#.#', '#######', '#.#.#.#', '#######'], pot: ['#.....#', '#######', '#######', '.#####.', '..###..'], mug: ['.####.', '.####.#', '.####.#', '.####.', '.####.'],
      shield: ['######', '#.##.#', '######', '.####.', '..##..'], cross: ['..##..', '######', '######', '..##..', '..##..'], scales: ['...#...', '#######', '#..#..#', '##.#.##', '..###..'],
      bed: ['#......', '#.###..', '#######', '#######', '#.....#'], star: ['...#...', '.#####.', '..###..', '.#...#.'],
    };
    const COL = { crown: '#e8b830', pot: '#5a5a62', mug: '#e8d8a0', shield: '#a8382f', cross: '#c83a3a', scales: '#d8b040', bed: '#3f5f8e', star: '#e8b830' };
    const yours = (room) => room.playerRoom && room.roomKey === 'chamber:player' || (room.roomKey === 'chamber:monarch' && O.crowned && O.crowned());
    function iconOf(room) {
      const k = room.roomKey || '';
      if (k === 'throne') return 'crown'; if (k === 'kitchen') return 'pot'; if (k === 'hall') return 'mug'; if (k === 'steward') return 'scales'; if (k === 'guardroom') return 'shield'; if (k === 'chapel') return 'cross';
      if (k === 'chamber:monarch') return 'crown';
      return 'bed';
    }
    const signAt = (sc, it) => { const [ax, ay] = sc.anchor(it); return it.front ? [ax - 16, ay + 6] : [ax - 17, ay - 26]; }; // (to the left of the door)
    function drawBoard(ctx, x, y, icon, mine, royal) {
      const W = 12, H = 9, rim = mine ? '#e8b830' : royal ? '#6a3a7a' : '#3a2618';
      ctx.fillStyle = rim; ctx.fillRect(x - 1, y - 1, W + 2, H + 2); ctx.fillStyle = '#8a6a44'; ctx.fillRect(x, y, W, H); ctx.fillStyle = '#a07e54'; ctx.fillRect(x, y, W, 1);
      const rows = ICON[icon] || []; ctx.fillStyle = COL[icon] || '#fff';
      const iw = Math.max(...rows.map((rw) => rw.length), 0), ox = Math.floor((W - iw) / 2), oy = Math.floor((H - rows.length) / 2); // (centred on the board)
      rows.forEach((row, r) => [...row].forEach((ch, c) => { if (ch === '#') ctx.fillRect(x + ox + c, y + oy + r, 1, 1); }));
      if (mine) { ctx.fillStyle = '#e8b830'; ctx.fillRect(x + W - 2, y + 1, 1, 1); }
    }
    game.hooks.drawTop.push((ctx, cam, indoor) => {
      const sc = game.scene; if (!indoor || !sc || !sc.b.royal || sc.b.parent || !O.Castle) return;
      const s = O.SimRef.cur, plan = O.Castle.plan(sc.b, s);
      for (const it of sc.L.items) {
        if (it.kind !== 'roomdoor') continue;
        const room = plan.all.find((r) => r.roomKey === it.room); if (!room) continue;
        const [sx, sy] = signAt(sc, it);
        drawBoard(ctx, Math.round(sx - 6 - cam.x), Math.round(sy - 5 - cam.y), iconOf(room), yours(room), !!room.royalRoom);
      }
    });
    // reading a door's board
    function describe(room, s) {
      const os = (room.roomOwners || []).map((id) => s.byId.get(id)).filter((q) => q && q.alive !== false);
      const nm = (q) => (q.title ? `${q.title} ${q.first}` : `${q.first} ${q.sur || ''}`.trim()) + (q.job?.role && !q.title ? `, ${q.job.role}` : '');
      const lock = room.locked === 'monarch' ? ' Kept locked: only the monarch and consort go in.' : room.locked === 'royal' ? ' Kept locked: for the royal family.' : '';
      const k = room.roomKey || '';
      const GROUND = { throne: 'Where the crown sits in state and hears petitions.', kitchen: 'The master cook and the kitchen hands feed the whole castle from here.', hall: 'Where the servants eat and rest between duties.', steward: "The steward keeps the castle's accounts and stores here, and answers for the household.", guardroom: 'The royal guard muster here; the armoury racks are along the walls.', chapel: 'The castle chapel, where the court hears mass. Coronations are held at its altar.' };
      if (GROUND[k]) return GROUND[k];
      if (yours(room)) return (k === 'chamber:monarch' ? "The monarch's bedchamber: yours. Your bed, and a chest for your things." : `Your chamber, while you hold your place at court. Your bed, and a chest for your things.`) + lock;
      if (k === 'chamber:guest') return 'Kept ready for guests of the crown.' + (os.length ? ` Now: ${os.map(nm).join(', ')}.` : ' Empty just now.');
      if (!os.length) return (k === 'chamber:monarch' ? 'The monarch\'s bedchamber. Nobody sleeps here now.' : 'Standing empty.') + lock;
      return `${os.slice(0, 4).map(nm).join('; ')}${os.length > 4 ? `, and ${os.length - 4} more` : ''}.${lock}`;
    }
    let prevSc = null, wrapped = false;
    game.hooks.update.push(() => { if (wrapped) return; wrapped = true; prevSc = O.sceneCandidate; O.sceneCandidate = boardCandidate; }); // (once everything else has made its own)
    const boardCandidate = () => {
      const base = prevSc ? prevSc() : null, sc = game.scene;
      if (!sc || !sc.b.royal || sc.b.parent || !O.Castle) return base;
      const p = game.player, s = O.SimRef.cur, plan = O.Castle.plan(sc.b, s); let best = null;
      for (const it of sc.L.items) {
        if (it.kind !== 'roomdoor') continue;
        const [sx, sy] = signAt(sc, it), gy = it.front ? sy - 10 : sy + 34; // where you stand to read it
        if (Math.abs(p.x - sx) > 9 || Math.abs(p.y - gy) > 20) continue;
        const room = plan.all.find((r) => r.roomKey === it.room); if (!room) continue;
        const d = Math.hypot(p.x - sx, p.y - gy) - 12;
        if (!best || d < best.d) best = { type: 'custom', d, label: 'Read the sign', x: sx, y: sy - 12, act: () => O.UI.dialog.open({ name: room.name, color: '#8a6239', text: describe(room, s), options: [] }) };
      }
      return best && (!base || best.d < base.d) ? best : base;
    };
    void T;
  }
  O.Signs = { setup, linesFor, plant, pull, spotBy, nameSign: () => nameSign() };
})();
