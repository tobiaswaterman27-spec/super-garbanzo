// Turned out. When a family is evicted for the rent, it happens in the street: their goods are put out on
// the cobbles by the door (a chest, a stool, the cooking pot, the bedding in a bundle) and stand there a
// day; the bailiff stands by with folded arms; the family sit on their things, the mother weeping, the
// children not understanding, until they carry it all off to wherever they can go; and the neighbours
// come to their doors and shake their heads.
'use strict';
(function () {
  const T = 16;
  function setup(game) {
    const cur = () => O.SimRef.cur, SP = O.Sim.prototype;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    const piles = []; let shown = 0;
    const near = (x, y, r) => Math.hypot(x - game.player.x, y - game.player.y) < r;
    const talking = (q) => O.npcUI && O.npcUI.talking && O.npcUI.talking() === q;
    const _evict = SP.evict;
    if (_evict) SP.evict = function (b, hh) { const members = (hh.members || []).slice(); const r = _evict.apply(this, arguments); try { if (b && b.doorX != null) piles.push({ s: this, b, hh, members, at: this.day * 1440 + this.minute, scene: null, name: hh.surname }); } catch (e) { /* */ } return r; };
    function release(P) { const S = P.scene; if (!S) return; for (const q of S.ppl) { if (!q.agent) continue; q.agent.forceAnim = null; if (!talking(q)) q.agent.frozen = false; q._evict = false; } P.scene = null; }
    game.hooks.update.push((dt) => {
      const s = cur(); if (!s || !s.world) return; const now = s.day * 1440 + s.minute;
      for (const P of piles.slice()) { if (P.s === s && now - P.at > 1440) { release(P); piles.splice(piles.indexOf(P), 1); continue; }
        if (P.s !== s || game.scene) continue; const x = P.b.doorX * T + 8, y = (P.b.doorY + 1) * T + 10;
        if (P.scene) { const S = P.scene; S.t += dt; if (S.t > 80 || S.ppl.some(talking)) { release(P); P.done = true; continue; }
          S.ppl.forEach((q, i) => { const a = q.agent; a.forceAnim = q === S.bailiff ? (Math.floor(S.t / 6) % 3 === 2 ? 'point' : 'idle') : q.age < 12 ? (Math.floor(S.t / 4 + i) % 3 ? 'sit' : 'look') : i === 0 ? (Math.floor(S.t / 5) % 2 ? 'mourn' : 'sit') : (Math.floor(S.t / 5 + i) % 3 ? 'sit' : 'wipe'); a.dir = 0; });
          if (!S.said && S.t > 3) { S.said = true; const m = S.ppl.find((q) => q !== S.bailiff); m && near(x, y, 300) && O.Speech && O.Speech.say(m, pick(['Where will we go now?', 'Twelve years we lived here. Twelve years.', 'Have you no pity?', 'Hush, children. Hush.']), 3); }
          if (!S.said2 && S.t > 10 && S.bailiff) { S.said2 = true; near(x, y, 300) && O.Speech && O.Speech.say(S.bailiff, pick(['The rent is the rent. I don\'t make the law.', 'You had your warnings.', 'Move along, now, all of you.']), 2.8); }
          if (!S.nb && S.t > 14) { S.nb = true; const n = s.people.find((q) => q.agent && !q.agent.hidden && q.agent.inside == null && !q._evict && Math.hypot(q.agent.x - x, q.agent.y - y) < 180 && q.age >= 16); if (n) { O.gesture && O.gesture(n, 'shake', 2); near(x, y, 300) && O.Speech && O.Speech.say(n, pick(['God help them.', 'Could be any of us, come a bad winter.', 'Shameful.']), 2.4); } }
          continue; }
        // when you're near, the family is seen there with their things (once)
        if (P.done || !near(x, y, 360) || now - P.at > 600) continue;
        const fam = P.members.map((id) => s.byId.get(id)).filter((q) => q && q.alive !== false && q.agent && !q.agent.frozen && !q.errand && !talking(q)).slice(0, 4); if (!fam.length) { P.done = true; continue; }
        const bailiff = s.people.find((q) => /bailiff|guard|sergeant/.test(q.job?.role || '') && q.agent && !q.agent.frozen && !q.errand && !talking(q) && q.alive !== false);
        const S = { ppl: [], bailiff, t: 0 }; P.scene = S; shown++;
        const put = (q, dx, dy) => { const a = q.agent; if (a.inside != null) { a.inside = null; a.hidden = false; } a.x = x + dx; a.y = y + dy; a.frozen = true; a.path = null; q._evict = true; S.ppl.push(q); };
        fam.forEach((q, i) => put(q, -10 + i * 9, 4 + (i % 2) * 4)); if (bailiff) put(bailiff, 26, 2);
      }
    });
    game.hooks.drawWorld.push((ctx, cam) => {
      const s = cur(); if (!s || game.scene) return;
      for (const P of piles) { if (P.s !== s) continue; const x = Math.round(P.b.doorX * T + 8 - cam.x), y = Math.round((P.b.doorY + 1) * T + 10 - cam.y); if (x < -40 || y < -40 || x > ctx.canvas.width + 40 || y > ctx.canvas.height + 40) continue;
        ctx.fillStyle = '#6a4a2c'; ctx.fillRect(x - 6, y - 8, 14, 8); ctx.fillStyle = '#8a6239'; ctx.fillRect(x - 6, y - 8, 14, 2); ctx.fillStyle = '#c8a040'; ctx.fillRect(x, y - 6, 2, 2);
        ctx.fillStyle = '#7a5a3a'; ctx.fillRect(x + 10, y - 7, 6, 2); ctx.fillRect(x + 11, y - 5, 1, 5); ctx.fillRect(x + 14, y - 5, 1, 5);
        ctx.fillStyle = '#3a3a40'; ctx.beginPath(); ctx.arc(x - 11, y - 3, 3, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#d8d0b8'; ctx.fillRect(x - 4, y - 14, 9, 6); ctx.fillStyle = '#b8b098'; ctx.fillRect(x - 4, y - 10, 9, 1); ctx.fillRect(x, y - 14, 1, 6); }
    });
    (O.extraLines = O.extraLines || []).push((s, q) => { const P = piles.find((p) => p.scene && p.scene.ppl.includes(q)); if (!P) return ''; return q === P.scene.bailiff ? `You are standing by while the ${P.name} family are put out of their house for the rent.` : 'Your family has just been thrown out of your house for the rent; your things are piled in the street and you sit on them, not knowing where to go.'; });
    O.Evictions = { piles, get shown() { return shown; } };
  }
  O.EvictionsSetup = { setup };
})();
