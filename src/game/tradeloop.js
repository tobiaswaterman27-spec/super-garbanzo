// Each trade works its own round indoors. The smith goes from the forge (working the bellows, the iron
// heating) to the anvil (hammering) to the tub (quenching it in a hiss of steam) and back; the baker kneads
// at the dough table and carries the loaves to the oven; the butcher cleaves at the block and hangs the
// joints on the rack; the carpenter fetches from the woodpile, saws and hammers at the bench; the tailor
// cuts at the bench and hangs the finished coat on the rail; the brewer stirs the vat and fills the barrels.
'use strict';
(function () {
  function setup(game) {
    const I = O.Indoor; if (!I) return;
    // the round: [item kind (or kinds), anim, seconds]
    const LOOPS = {
      smithy: [['forge', 'pitch', 5], ['anvil', 'hammer', 6], ['washtub', 'pour', 3]],
      armourer: [['forge', 'pitch', 5], ['anvil', 'hammer', 7], ['washtub', 'pour', 3]],
      bakery: [['doughtable', 'knead', 7], ['oven', 'place', 4], ['shelf|counter', 'place', 3]],
      butcher: [['butcherblock', 'cleave', 7], ['rack', 'pickup', 3], ['counter', 'place', 3]],
      carpenter: [['woodpile', 'pickup', 3], ['workbench', 'saw', 7], ['workbench', 'hammer', 5], ['rack|dresser', 'place', 3]],
      cooper: [['woodpile', 'pickup', 3], ['workbench', 'hammer', 8], ['barrel', 'place', 3]],
      tailor: [['workbench', 'work', 7], ['rack', 'pickup', 3], ['table', 'work', 5]],
      cobbler: [['workbench', 'hammer', 7], ['rack|shelf', 'place', 3]],
      chandler: [['cauldron', 'mix', 6], ['workbench|table', 'place', 4], ['shelf|rack', 'place', 3]],
      potter: [['workbench', 'work', 8], ['oven', 'place', 4], ['shelf', 'place', 3]],
      apothecary: [['workbench|table', 'mix', 7], ['shelf', 'pickup', 3], ['counter', 'place', 3]],
      brewery: [['vat', 'mix', 7], ['barrel', 'pour', 4], ['sack', 'pickup', 3]],
      kitchen: [['cauldron', 'cook', 6], ['table', 'knead', 5], ['fireplace', 'pitch', 3]],
    };
    const steam = []; const pick = (L, kinds) => { const ks = kinds.split('|'); return L.items.filter((i) => ks.includes(i.kind)); };
    const _walk = I.prototype.walkActors;
    I.prototype.walkActors = function (dt) {
      try { const loop = LOOPS[this.b.type]; if (loop) for (const a of this.actors.values()) {
        const q = a.person; if (a.leaving || q.agent.frozen || q.agent.talking || q.activity?.act !== 'work' || q.job?.biz !== this.b.id || a.inBed) continue;
        const total = loop.reduce((m, s) => m + s[2], 0); let k = (this.t + q.id * 3.7) % total, step = loop[0]; for (const s of loop) { if (k < s[2]) { step = s; break; } k -= s[2]; }
        const its = pick(this.L, step[0]); if (!its.length) continue; const it = its[q.id % its.length]; const [ax, ay] = this.anchor(it), [, , , ry1] = this.rect(it);
        const ox = (q.id % 2 ? 6 : -6); a.gx = ax + ox; a.gy = ry1 + 12; a.gDir = 3; a.gAnim = step[1]; a.seat = null; a.gSortY = null; a.gBed = null; a._step = step[0];
        if (step[1] === 'pour' && it.kind === 'washtub' && Math.random() < 0.4) steam.push({ x: ax + ox, y: ry1 - 4, t: 0, sc: this });
      } } catch (e) { /* the room still runs */ }
      _walk.call(this, dt);
    };
    game.hooks.drawTop.push((ctx, cam, inScene) => { const sc = game.scene; if (!inScene || !sc) { steam.length = 0; return; } for (const p of steam.slice()) { p.t += 1 / 60; p.y -= 0.5; if (p.t > 1.2 || p.sc !== sc) { steam.splice(steam.indexOf(p), 1); continue; } ctx.globalAlpha = 0.5 * (1 - p.t / 1.2); ctx.fillStyle = '#f0f0f4'; const r = 1 + Math.floor(p.t * 3); ctx.fillRect(Math.round(p.x - cam.x) - r + Math.round(Math.sin(p.t * 6) * 2), Math.round(p.y - cam.y) - r, r * 2, r * 2); } ctx.globalAlpha = 1; if (steam.length && Math.random() < 0.03) O.sfx && O.sfx('pour', 0.2, true); });
    O.TradeLoop = { LOOPS };
  }
  O.TradeLoopSetup = { setup };
})();
