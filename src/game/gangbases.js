// A gang's bases. Every den lies well out in the woods with no trodden path to it: you have to know
// the way, or be shown it. Spare camps stand empty in the woods round a town, and a gang that is
// growing (enough hands, a fat purse) takes one over as an outpost; so can you, for your own gang.
// The camps fill out as their gang rises: a fire pit, then tents for the extra hands, then a lookout
// tower over the stakes. Some of the gang keep to each outpost of an evening.
'use strict';
(function () {
  const T = 16;
  function setup(game) {
    const SP = O.Sim.prototype, PS = O.PlayerState, cur = () => O.SimRef.cur;
    const basesOf = (s, g) => (g.bases = g.bases && g.bases.length ? g.bases : [g.hideout]);
    const camps = (s) => s.world.buildings.filter((b) => b.type === 'hideout' && b.den && !b.roadKey);
    const free = (s) => camps(s).filter((b) => b.outpost && !b.gang);
    // what a camp shows of its gang's standing
    function dress(s, b) {
      const w = s.world, lvl = b.level ?? 0; if ((b._dressed ?? -1) >= lvl) return; b._dressed = lvl;
      const x = b.doorX, y = b.doorY - 1, add = (kind, tx, ty, solid = true, v = 0) => {
        if (w.props.some((p) => p.denOf === b.id && p.kind === kind && p.tx === tx && p.ty === ty)) return;
        const p = { kind, x: tx * T + 8, y: ty * T + 15, seed: O.hash('camp', b.id, kind, tx), v, solid, denOf: b.id, tx, ty, country: false }; w.props.push(p); if (solid) w.solid[ty * w.W + tx] = 1;
      };
      if (lvl >= 1) add('firepit', x + 1, y + 2, false);
      if (lvl >= 2) { add('tent', x - 3, y - 4); add('tent', x + 6, y - 3); }
      if (lvl >= 3) add('lookout', x + 10, y - 4);
      w.dirtyStatics = true;
    }
    function claim(s, g, b, by) {
      b.gang = g.id; b.outpost = true; b.level = Math.max(1, b.level || 0); b.dirty = true;
      b.name = `${g.name.replace(/^the /, 'The ')}${/s$/.test(g.name) ? "'" : "'s"} outpost`;
      basesOf(s, g).push(b.id); dress(s, b);
      (g.log = g.log || []).push(`Day ${s.day}: took over ${by === 'player' ? 'an empty camp' : 'a camp in the woods'} as an outpost.`);
      if (by !== 'player') s.log(`${g.name.replace(/^the /, 'The ')} have taken over an old camp in the woods outside ${s.world.name}.`, 'gang');
    }
    // each day: growing gangs reach out; rich ones build up their outposts
    const _nd = SP.newDay;
    SP.newDay = function () {
      const r = _nd.apply(this, arguments);
      for (const g of this.gangs || []) {
        const bases = basesOf(this, g);
        for (const id of bases) { const b = this.building(id); if (b) dress(this, b); }
        if (g.id === 'player') continue;
        const room = free(this);
        if (room.length && g.members.length >= 4 && g.purse >= 90 && bases.length < 1 + Math.max(1, g.level || 1) && this.rng.chance(0.25)) { g.purse -= 60; claim(this, g, room[Math.floor(this.rng.next() * room.length)]); }
        for (const id of bases.slice(1)) { const b = this.building(id); if (b && (b.level || 1) < Math.min(3, g.level || 1) && g.purse >= 120 && this.rng.chance(0.15)) { g.purse -= 80; b.level++; b.dirty = true; O.Interior && O.Interior.invalidate && O.Interior.invalidate(b); dress(this, b); } }
      }
      return r;
    };
    // some of the gang keep each outpost of an evening
    const _plan = SP.plan;
    SP.plan = function (p) {
      const a = _plan.call(this, p);
      if (a && p.gang && p.gang !== 'player' && a.act === 'gangmeet' && a.b != null) {
        const g = (this.gangs || []).find((x) => x.id === p.gang), bases = g && g.bases;
        if (bases && bases.length > 1) { const k = p.id % bases.length; if (k > 0 && this.building(bases[k])) return Object.assign({}, a, { b: bases[k] }); }
      }
      return a;
    };
    // the camps as they stand now, when the world is first seen
    let done = new WeakSet();
    game.hooks.update.push(() => { const s = cur(); if (!s || !s.world || done.has(s.world)) return; done.add(s.world); for (const b of camps(s)) dress(s, b); });
    // you can take an empty camp for your own gang
    (O.moreCandidates = O.moreCandidates || []).push(() => {
      const s = cur(); if (!s || game.scene || !PS.gang) return null; const P = game.player;
      const b = free(s).find((z) => Math.hypot(z.doorX * T + 8 - P.x, z.doorY * T + 8 - P.y) < 40); if (!b) return null;
      const g = (s.gangs || []).find((x) => x.id === 'player'); if (!g) return null;
      return { type: 'custom', d: 1, x: b.doorX * T + 8, y: b.doorY * T - 30, label: `Take this camp for ${g.name}`, act: () => { claim(s, g, b, 'player'); O.UI.say(`The camp is ${g.name}'s now: an outpost in the woods.`); } };
    });
    O.GangBases = { basesOf, claim, dress, free };
    // what a gang's people know of their bases
    (O.extraLines = O.extraLines || []).push((s, q) => {
      if (!q.gang || q.gang === 'player') return '';
      const g = (s.gangs || []).find((x) => x.id === q.gang); if (!g || !g.bases || g.bases.length < 2) return '';
      return `Your gang holds ${g.bases.length} camps in the woods: the den and ${g.bases.length - 1} outpost${g.bases.length > 2 ? 's' : ''}. No path leads to any of them; you would only show the way to someone you trust.`;
    });
  }
  O.GangBasesSetup = { setup };
})();
