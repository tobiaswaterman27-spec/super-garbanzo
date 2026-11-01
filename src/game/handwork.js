// Work with your hands and real things. A duty that needs water starts at the well: you fill a bucket
// there and carry it back (you can see it in your hand, walking or running), and only then scrub the
// pails. Firewood comes from the woodpile, stock from the store crates, feed from the sack, hay from the
// rick, stone from the pile. The places you fetch from are marked; the duty itself waits until you
// come with what it needs. Whatever you carry shows in your hands, and goes when it's used.
'use strict';
(function () {
  // what a duty needs, by its words and its action
  const RULES = [
    [/water|bucket|pail|scald|scour|wash|rinse|swill|mop|well/i, { item: 'water', from: ['well'], water: true, verb: 'Fill a bucket', anim: 'bucket', noun: 'a bucket of water' }],
    [/firewood|kindling|logs|stoke|light the|fire up|oven|hearth|forge fire|bank the/i, { item: 'firewood', from: ['woodpile', 'logpile', 'timberstack'], verb: 'Take an armful of firewood', anim: 'pickup', noun: 'an armful of firewood' }],
    [/restock|shelves|fill the shelves|stack|sort the raw|unpack|put away|lay out the goods|bag goods|weigh and bag/i, { item: 'goods', store: true, verb: 'Take goods from the store', anim: 'pickup', noun: 'goods from the store' }],
    [/feed the (hens|chickens|pigs|geese|ducks|animals|stock)|grain|corn for/i, { item: 'grain', store: true, from: ['sack'], verb: 'Scoop a measure of feed', anim: 'pickup', noun: 'a measure of feed' }],
    [/hay|straw|bedding|litter|muck out|stall/i, { item: 'hay', from: ['hay', 'haycock', 'stook', 'haystack'], verb: 'Fork up an armful of hay', anim: 'pitch', noun: 'an armful of hay' }],
    [/mortar|stone|wall|cobble|pave/i, { item: 'stone', from: ['stonepile', 'rock', 'sandpile'], verb: 'Load stone', anim: 'pickup', noun: 'stone' }],
  ];
  const STORE_KINDS = new Set(['crate', 'barrel', 'chest', 'shelf', 'sack', 'cupboard']);
  function setup(game) {
    const PS = O.PlayerState, cur = () => O.SimRef.cur, T = 16;
    const specOf = (t) => { if (t.fetch !== undefined) return t.fetch; if (t.kind !== 'chore') return (t.fetch = false); const txt = (t.text || '') + ' ' + (t.anim === 'bucket' ? 'bucket' : ''); for (const [re, sp] of RULES) if (re.test(txt)) return (t.fetch = Object.assign({}, sp)); return (t.fetch = false); };
    const carrying = (t) => PS.carry && PS.carry.chore === t.id;
    const openChores = () => { const e = PS.emp; if (!e || !e.onShift) return []; return (e.tasks || []).filter((t) => t.kind === 'chore' && t.have < t.need && specOf(t)); };
    // the places to fetch from: props outdoors, store furniture in the workplace
    function sources(t) {
      const sp = specOf(t), out = [], s = cur(), P = game.player; if (!sp || !s) return out;
      if (game.scene) {
        if (sp.store || sp.from?.includes('sack')) for (const it of game.scene.L.items) { if (!STORE_KINDS.has(it.kind) && !(sp.from || []).includes(it.kind)) continue; const [x, y] = game.scene.anchor(it); out.push({ x, y, it }); }
        return out;
      }
      const w = game.world; if (!w) return out;
      for (const pr of w.props) if ((sp.from || []).includes(pr.kind) && Math.abs(pr.x - P.x) < 1400 && Math.abs(pr.y - P.y) < 1000) out.push({ x: pr.x, y: pr.y, pr });
      if (sp.water && !out.length && w.ter) { // no well about: the river or the pond will do
        const tx0 = Math.floor(P.x / T), ty0 = Math.floor(P.y / T);
        for (let r = 1; r < 30 && !out.length; r++) for (let dy = -r; dy <= r && !out.length; dy++) for (const dx of [-r, r]) { const tx = tx0 + dx, ty = ty0 + dy; if (w.ter[ty * w.W + tx] === w.TER.WATER) { out.push({ x: tx * T + 8, y: ty * T + 4, bank: true }); break; } }
      }
      return out;
    }
    const _cand = O.jobCandidate, _label = O.jobLabel, _act = O.jobAct;
    O.jobCandidate = () => {
      const P = game.player;
      // at a place to fetch from, for a duty that needs it (and your hands are free)
      if (!PS.carry) for (const t of openChores()) { for (const src of sources(t)) { const d = Math.hypot(src.x - P.x, src.y - P.y); if (d < (src.it ? 34 : 24)) return { type: 'job', t, fetchFrom: src, d: -20, x: src.x, y: src.y - 30 }; } }
      const c = _cand ? _cand() : null;
      if (c && c.t && c.t.kind === 'chore' && specOf(c.t) && !carrying(c.t)) c.needFetch = true;
      return c;
    };
    O.jobLabel = (c) => {
      if (c.fetchFrom) { const sp = specOf(c.t); return c.fetchFrom.bank ? 'Fill a bucket at the water\'s edge' : `${sp.verb}${c.fetchFrom.pr && c.fetchFrom.pr.kind === 'well' ? ' at the well' : ''}`; }
      if (c.needFetch) { const sp = specOf(c.t); return `${c.t.label || c.t.text}: first bring ${sp.noun}`; }
      return _label(c);
    };
    O.jobAct = (c) => {
      const P = game.player;
      if (c.fetchFrom) {
        const sp = specOf(c.t); if (P.locked) return;
        P.locked = true; P.anim = sp.water ? 'crouch' : sp.anim; P.ft = 0; P.dir = O.dirOf(c.fetchFrom.x - P.x, c.fetchFrom.y - P.y);
        O.sfx && O.sfx(sp.water ? 'splash' : 'place', 0.6, !!game.scene);
        setTimeout(() => { P.locked = false; P.anim = 'idle'; PS.carry = { good: sp.item, qty: 1, chore: c.t.id, look: sp.water ? 'bucket' : 'carry' }; O.Panels.toast(`You have ${sp.noun}. Carry it to the work.`); }, 1500);
        return;
      }
      if (c.needFetch) { const sp = specOf(c.t); O.Panels.toast(`You need ${sp.noun} for this. ${sp.water ? 'Fetch it from the well' : sp.store ? 'Take it from the store' : 'Fetch it'}, marked in gold.`, 'bad'); return; }
      if (c.t && carrying(c.t)) { PS.carry = null; O.sfx && O.sfx(specOf(c.t).water ? 'pour' : 'place', 0.7, !!game.scene); }
      return _act(c);
    };
    // where to fetch from, marked in gold while a duty waits on it
    const pin = (ctx, x, y, t) => { const b = Math.sin(t * 4) * 1.5; ctx.fillStyle = '#1b1424'; ctx.fillRect(x - 3, y - 4 + b, 7, 7); ctx.fillStyle = '#f0b45c'; ctx.fillRect(x - 2, y - 3 + b, 5, 5); ctx.fillStyle = '#ffe2a0'; ctx.fillRect(x - 1, y - 3 + b, 2, 1); };
    game.hooks.drawTop.push((ctx, cam) => {
      if (PS.carry) return; const ch = openChores(); if (!ch.length) return; const t0 = performance.now() / 1000;
      const seen = new Set();
      for (const t of ch) for (const src of sources(t).slice(0, 6)) { const k = Math.round(src.x) + ',' + Math.round(src.y); if (seen.has(k)) continue; seen.add(k); const x = Math.round(src.x - cam.x), y = Math.round(src.y - cam.y) - 34; if (x < -10 || y < -10 || x > game.vw + 10 || y > game.vh + 10) continue; pin(ctx, x, y, t0); }
    });
    // what's in your hands shows: a bucket of water swinging, an armful of wood or goods held before you
    const Ch = O.Char;
    const _frame = game.actorFrame.bind(game);
    game.actorFrame = function (a) {
      if (a === game.player && PS.carry && !a.mount && !a.sitting && !a.inBed) {
        const look = PS.carry.look || (PS.carry.good === 'water' ? 'bucket' : 'carry'), an0 = a.anim;
        if (an0 === 'walk' || an0 === 'run' || an0 === 'idle') {
          const an = an0 === 'walk' ? look : Ch.composite(an0, look), A = Ch.ANIMS[an] || Ch.ANIMS.idle, f = Math.floor((a.ft || 0) * A.fps) % A.frames;
          return Ch.frame(a.a, a.dir, an, f);
        }
      }
      return _frame(a);
    };
    // a load from the job's own errands (bought goods to put away) shows the same way
    // ---------------------------------------------------------------- dirt on the floors
    // every floor gathers dust, straw and mud as people come and go (faster in a busy tavern or a wet
    // season); anyone with a broom sweeps it down, and so can you, whenever you like
    const dirtOf = (b) => (b.dirt = b.dirt ?? 0.1);
    const SP = O.Sim.prototype, _nd = SP.newDay;
    SP.newDay = function () { const r = _nd.apply(this, arguments); try { for (const b of this.world.buildings) { if (b.ruined || b.site) continue; const busy = ['tavern', 'inn', 'smithy', 'stable', 'barn', 'builder', 'mill'].includes(b.type) ? 0.16 : 0.07, wet = ['autumn', 'winter'].includes(this.season) ? 1.5 : 1; b.dirt = Math.min(1, dirtOf(b) + busy * wet); } } catch (e) { /* */ } return r; };
    // within the day: footfall while you watch, sweeping by anyone at the broom
    let dt0 = 0;
    game.hooks.update.push((dt) => {
      const sc = game.scene; if (!sc) return; dt0 += dt; if (dt0 < 1) return; dt0 = 0; const b = sc.b;
      let sweeping = 0; for (const a of sc.actors.values()) { if (a.anim === 'sweep' || a.anim === 'scrub') sweeping++; }
      b.dirt = O.clamp(dirtOf(b) + sc.actors.size * 0.00008 - sweeping * 0.004, 0, 1);
    });
    const SPECKS = ['#c8a868', '#dcc488', '#a8905e', '#4a3826', '#b89a64', '#e0d0a0'];
    const _ex = O.sceneExtras;
    O.sceneExtras = (sc, ctx, cam) => {
      const out = _ex ? _ex(sc, ctx, cam) : []; const b = sc.b, d = dirtOf(b); if (d < 0.06) return out;
      const r = O.RNG(O.hash('dirt', b.id, sc.floor || 0)), L = sc.L, n = Math.floor(d * 90), pts = [];
      for (let k = 0; k < 90; k++) { const tx = r.int(0, L.w - 1), ty = r.int(1, L.d - 1), ox = r.int(1, 14), oy = r.int(2, 13), c = SPECKS[r.int(0, SPECKS.length - 1)], big = r.next() < 0.25; if (k < n && !L.grid[ty * L.w + tx]) { const [x, y] = sc.tileXY(tx, ty); pts.push([x - 8 + ox, y - 12 + oy, c, big]); } }
      out.push({ y: -0.6, draw: () => {
        if (d > 0.3) { ctx.fillStyle = `rgba(196,176,136,${Math.min(0.22, (d - 0.3) * 0.4)})`; for (let k = 0; k < pts.length; k += 6) { const [x, y] = pts[k]; ctx.fillRect(Math.round(x - cam.x) - 4, Math.round(y - cam.y) - 1, 9, 3); ctx.fillRect(Math.round(x - cam.x) - 2, Math.round(y - cam.y) - 2, 5, 5); } } // (dusty patches)
        for (const [x, y, c, big] of pts) { ctx.fillStyle = c; const X = Math.round(x - cam.x), Y = Math.round(y - cam.y); if (big) { ctx.fillRect(X, Y, 3, 1); ctx.fillRect(X + 1, Y - 1, 1, 1); } else ctx.fillRect(X, Y, 2, 1); }
      } });
      return out;
    };
    // you can take up the broom whenever you like
    (O.sceneMore = O.sceneMore || []).push(() => {
      const sc = game.scene; if (!sc || dirtOf(sc.b) < 0.15 || game.player.locked || game.player.sitting) return null; const P = game.player;
      return { type: 'custom', d: 40, x: P.x, y: P.y - 44, label: 'Sweep the floor', act: () => {
        P.locked = true; P.anim = 'sweep'; P.ft = 0; let k = 0;
        const step = () => { if (k++ >= 3 || !game.scene) { P.locked = false; P.anim = 'idle'; O.Panels.toast(dirtOf(sc.b) < 0.15 ? 'Swept clean.' : 'Better. There\'s more yet.'); return; } sc.b.dirt = Math.max(0, dirtOf(sc.b) - 0.09); O.sfx && O.sfx('sweep', 0.8, true); setTimeout(step, 700); };
        setTimeout(step, 400);
        const e = PS.emp; if (e && e.onShift && e.biz === sc.b.id) e.todayTasks = (e.todayTasks || 0) + 1; // (a master notices a clean floor)
      } };
    });
    O.handwork = { specOf, sources };
  }
  O.HandworkSetup = { setup };
})();
