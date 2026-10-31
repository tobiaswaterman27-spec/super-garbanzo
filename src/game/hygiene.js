// Keeping clean. A day's work, a fight, a road in the rain: they all leave their mark, and in time you
// smell of it and people notice (the fussy and the gentry first). Wash in a river or a lake, splash at
// a well, scrub at a washtub, wash with warm water at your own hearth, or pay the innkeeper for a hot
// bath. Filthy enough, and the flies find you. A cunning woman or herbalist will read your palm for a
// coin or two, and tell you what she sees.
'use strict';
(function () {
  const T = 16;
  function setup(game) {
    const PS = O.PlayerState, cur = () => O.SimRef.cur, say = (t, k) => O.UI.say(t, k);
    PS.grime = PS.grime || 0;
    const busy = () => game.player.locked;
    const wash = (anim, secs, to, msg, then) => { const P = game.player; P.anim = anim; P.ft = 0; P.locked = true; setTimeout(() => { P.locked = false; if (P.anim === anim) P.anim = 'idle'; PS.grime = Math.min(PS.grime, to); PS.mood = Math.min(100, (PS.mood || 50) + 2); say(msg); then && then(); }, secs * 1000); };

    // the dirt of the day
    let lastMin = null;
    game.hooks.update.push(() => {
      const s = cur(); if (!s) return; const abs = s.day * 1440 + s.minute; if (lastMin == null) { lastMin = abs; return; }
      const dm = abs - lastMin; if (dm < 10) return; lastMin = abs; if (dm > 600) return; // a long sleep or a load: skip
      const P = game.player; if (P.anim === 'sleep' || P.anim === 'lie') return;
      let r = 0.012; if (PS.emp && PS.emp.onShift) r += 0.02; if (!game.scene && s.raining) r += 0.03; if (s.weather && s.weather.kind === 'heat' && !game.scene) r += 0.015;
      const was = PS.grime; PS.grime = Math.min(1, PS.grime + (r * dm) / 60);
      if (was < 0.6 && PS.grime >= 0.6) say('You could do with a wash.');
      if (was < 0.85 && PS.grime >= 0.85) say('You are filthy, and you can smell yourself.');
    });
    if (O.Combat && O.Combat.provoke) { const _pv = O.Combat.provoke; O.Combat.provoke = function (q, how) { if (how === 'fight') PS.grime = Math.min(1, PS.grime + 0.04); return _pv.apply(this, arguments); }; }

    // where to wash, out of doors
    (O.moreCandidates = O.moreCandidates || []).push(() => {
      const w = game.world, P = game.player, s = cur(); if (!s || game.scene || busy() || PS.grime < 0.15 || !w.ter) return null;
      const well = w.props.find((x) => x.kind === 'well' && Math.hypot(x.x - P.x, x.y - P.y) < 30);
      if (well) return { type: 'custom', d: 20, x: well.x, y: well.y - 44, label: 'Wash at the well', act: () => wash('scrub', 2.4, 0.25, 'You draw a bucket and sluice your face, neck and arms. Better.') };
      const tx = Math.floor(P.x / T), ty = Math.floor(P.y / T);
      if ([[1, 0], [-1, 0], [0, 1], [0, -1], [0, 2]].some(([dx, dy]) => w.ter[(ty + dy) * w.W + tx + dx] === w.TER.WATER)) {
        const cold = s.season === 'winter';
        return { type: 'custom', d: 18, x: P.x, y: P.y - 40, label: cold ? 'Wash in the icy water' : 'Wash in the water', act: () => wash('scrub', 3, 0.08, cold ? 'You scrub yourself raw in water so cold it makes you gasp.' : 'You strip to the waist and scrub off the dirt of the road. Cool and clean.', () => { if (cold) PS.energy = Math.max(0, PS.energy - 6); }) };
      }
      return null;
    });
    // indoors: a washtub, or warm water at your own hearth
    (O.sceneMore = O.sceneMore || []).push(() => {
      const sc = game.scene, P = game.player; if (!sc || busy() || PS.grime < 0.15) return null;
      const tub = sc.L && sc.L.items.find((i) => i.kind === 'washtub' && (() => { const [x, y] = sc.anchor(i); return Math.hypot(x - P.x, y + 14 - P.y) < 50; })());
      if (tub) { const [x, y] = sc.anchor(tub); return { type: 'custom', d: -3, x, y: y - 26, label: 'Wash at the tub', act: () => wash('scrub', 3, 0.05, 'You scrub yourself down at the tub till the water runs grey.') }; }
      const b = sc.b.parent || sc.b, mine = b.owner?.kind === 'player' || (PS.residence && PS.residence.b === b.id) || (PS.lease && PS.lease.b === b.id) || (PS.room && PS.room.b === b.id);
      if (mine) return { type: 'custom', d: 30, x: P.x, y: P.y - 40, label: 'Wash with warm water', act: () => wash('scrub', 3, 0, 'You heat a pot of water at the fire and wash properly, neck and ears and all.') };
      return null;
    });
    // a hot bath at the inn, and a palm read by the wise
    const base = O.NpcActs.apply;
    O.NpcActs.apply = function (s, q, a) {
      if (a && a.do === 'draw_bath') {
        if (!/innkeeper|tapster|alewife|landlord|chambermaid|potboy|servant|maid/.test(q.job?.role || '')) return null;
        const pr = O.clamp(Math.round(Number(a.price) || 2), 0, 10); if (PS.money < pr) return `A bath is ₳${pr}, and you haven't it.`;
        PS.money -= pr; const hh = s.household(q); if (hh) hh.money += pr; O.gesture(q, 'bucket', 2.5);
        setTimeout(() => wash('sit', 4, 0, 'You sink into a tub of hot water by the fire and soak till it cools. You come out pink and new.'), 1500);
        return `${q.first} has the tub filled with hot water for you (₳${pr}).`;
      }
      if (a && a.do === 'read_palm') {
        if (!/herbalist|wise|cunning|midwife|hermit|pilgrim guide|apothecary/.test(q.job?.role || q.kind || '') && !q.hermit) return null;
        const pr = O.clamp(Math.round(Number(a.price) || 2), 0, 10); if (PS.money < pr) return `She wants ₳${pr} to cross her palm.`;
        PS.money -= pr; const hh = s.household(q); if (hh) hh.money += pr; O.gesture(q, 'look', 3); game.player.anim = 'idle';
        return `${q.first} takes your hand and turns it to the light (₳${pr}).`;
      }
      return base.apply(this, arguments);
    };
    (O.extraActs = O.extraActs || []).push('draw_bath {"price"} (innkeepers and their servants: fill a hot tub for the player, about ₳2)', 'read_palm {"price"} (herbalists, midwives, hermits and cunning folk: read the player\'s palm for a coin or two, then tell their fortune in your own words, cryptic but fitting what you know of them)');
    (O.extraLines = O.extraLines || []).push((s, q) => PS.grime >= 0.85 ? 'The player is filthy and smells strongly: you notice and it shows (a wrinkled nose, a step back, a remark), the more so if you are fussy or of gentle birth.' : PS.grime >= 0.6 ? 'The player is grubby and could do with a wash; you may notice.' : '');
    (O.extraLines = O.extraLines || []).push((s, q) => /herbalist|midwife|apothecary/.test(q.job?.role || '') || q.hermit ? 'You know a little of the old ways and can read a palm (read_palm).' : '');
    (O.extraLines = O.extraLines || []).push((s, q) => /innkeeper|tapster|alewife/.test(q.job?.role || '') ? 'You can draw the player a hot bath by the fire (draw_bath, about ₳2).' : '');

    // the look of it: dirt on your clothes, and flies when it's bad
    game.hooks.drawWorld.push((ctx, cam) => {
      if (game.scene || PS.grime < 0.6) return; const P = game.player, x = Math.round(P.x - cam.x), y = Math.round(P.y - cam.y), t = performance.now() / 1000;
      ctx.fillStyle = 'rgba(84,62,40,0.75)'; ctx.fillRect(x - 4, y - 6, 2, 1); ctx.fillRect(x + 3, y - 12, 1, 2); ctx.fillRect(x - 2, y - 17, 2, 1); if (PS.grime > 0.75) { ctx.fillRect(x + 1, y - 4, 2, 1); ctx.fillRect(x - 5, y - 13, 1, 1); }
      if (PS.grime >= 0.85) { ctx.fillStyle = '#141014'; for (let i = 0; i < 2; i++) ctx.fillRect(Math.round(x + Math.sin(t * 5 + i * 2) * 9), Math.round(y - 30 + Math.cos(t * 7 + i * 3) * 6), 1, 1); }
    });
  }
  O.HygieneSetup = { setup };
})();
