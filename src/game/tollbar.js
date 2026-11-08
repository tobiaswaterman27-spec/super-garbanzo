// The toll bar. Where a place keeps a toll house, a painted pole lies across the road beside it, and the
// toll keeper steps out to whoever comes, holds out a hand for the penny, and swings the bar up to let
// them by; then down it comes again. You pay too, once a day, if you've a penny on you; the keeper
// remembers you've paid.
'use strict';
(function () {
  const T = 16;
  function setup(game) {
    const cur = () => O.SimRef.cur;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    const mem = new WeakMap(), M = (o) => { let m = mem.get(o); if (!m) mem.set(o, (m = {})); return m; };
    let taken = 0; const paidToday = new Map();
    const near = (x, y, r) => Math.hypot(x - game.player.x, y - game.player.y) < r;
    function barOf(s, b) { const m = M(b); if (m.bar !== undefined) return m.bar; const w = s.world; let best = null, bd = 1e9; for (let ty = b.doorY - 3; ty <= b.doorY + 5; ty++) for (let tx = b.doorX - 6; tx <= b.doorX + 6; tx++) { if (tx < 1 || ty < 1 || tx >= w.W - 1 || ty >= w.H - 1) continue; const i = ty * w.W + tx; if (w.ter[i] !== w.TER.ROAD || w.solid[i]) continue; const d = Math.abs(tx - b.doorX) + Math.abs(ty - b.doorY - 1); if (d < bd) { bd = d; best = [tx, ty]; } } if (!best) return (m.bar = null); const [tx, ty] = best; const horiz = w.ter[ty * w.W + tx - 1] === w.TER.ROAD || w.ter[ty * w.W + tx + 1] === w.TER.ROAD; return (m.bar = { x: tx * T + 8, y: ty * T + 8, horiz, up: 0, want: 0, t: 0 }); }
    game.hooks.update.push((dt) => {
      const s = cur(); if (!s || !s.world || game.scene) return; const hr = s.minute / 60, open = hr >= 6 && hr < 21;
      for (const z of s.biz.values()) { if (z.type !== 'tollhouse') continue; const b = s.building(z.b?.id ?? z.id); if (!b || b.doorX == null) continue; const B = barOf(s, b); if (!B) continue;
        B.t -= dt; const keeper = (z.workers || []).map((id) => s.byId.get(id)).find((q) => q && q.agent && q.alive !== false);
        // anyone coming along the road raises it (by day; at night the bar stays down and you go round)
        let coming = null; if (open) { for (const q of s.people) { const a = q.agent; if (!a || a.hidden || a.inside != null || !a.path || q === keeper) continue; if (Math.hypot(a.x - B.x, a.y - B.y) < 30) { coming = q; break; } } const P = game.player; if (!coming && !P.hidden && Math.hypot(P.x - B.x, P.y - B.y) < 30) coming = 'player'; }
        if (coming && B.t <= 0) { B.want = 1; B.t = 3.5;
          if (keeper && keeper.agent && !keeper.agent.frozen && !keeper.errand && near(B.x, B.y, 260)) { O.gesture && O.gesture(keeper, 'take', 1.2); if (Math.random() < 0.3) O.Speech && O.Speech.say(keeper, pick(['A penny the toll, friend.', 'Pass, and God speed.', 'Toll for the bridge and the road.']), 2); }
          if (coming === 'player') { const PS = O.PlayerState, key = s.world.placeId + ':' + b.id; if (paidToday.get(key) !== s.day && PS && PS.money >= 1) { PS.money -= 1; paidToday.set(key, s.day); taken++; z.cash = (z.cash || 0) + 1; O.UI && O.UI.say && O.UI.say('You pay the toll keeper a penny to pass.', 'info'); } }
          else { try { const hh = s.household(coming); if (hh && hh.money >= 1 && Math.random() < 0.6) { hh.money -= 1; z.cash = (z.cash || 0) + 1; taken++; } } catch (e) { /* */ } }
        }
        if (B.t <= 0) B.want = 0; B.up += (B.want - B.up) * Math.min(1, dt * 3);
      }
    });
    game.hooks.drawWorld.push((ctx, cam) => {
      const s = cur(); if (!s || game.scene) return;
      for (const z of s.biz.values()) { if (z.type !== 'tollhouse') continue; const b = s.building(z.b?.id ?? z.id); if (!b) continue; const B = M(b).bar; if (!B) continue; const x = Math.round(B.x - cam.x), y = Math.round(B.y - cam.y); if (x < -60 || y < -60 || x > ctx.canvas.width + 60 || y > ctx.canvas.height + 60) continue;
        ctx.fillStyle = '#6a4a2c'; const px = B.horiz ? x : x - 12, py = B.horiz ? y - 12 : y; ctx.fillRect(px - 1, py - 10, 3, 12); ctx.fillStyle = '#5a5a60'; ctx.fillRect(px - 2, py + 1, 5, 2);
        const ang = -B.up * 1.35, len = 26; const dx = B.horiz ? 0 : 1, dy = B.horiz ? 1 : 0; // bar runs across the road
        const ex = px + (dx * Math.cos(ang) * len), ey = py - 7 + (dy * len * Math.cos(ang)) + Math.sin(ang) * len * (B.horiz ? 0.6 : 1);
        ctx.strokeStyle = '#e8e0d0'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(px, py - 7); ctx.lineTo(ex, ey); ctx.stroke(); ctx.strokeStyle = '#b83a3a'; ctx.lineWidth = 2; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(px, py - 7); ctx.lineTo(ex, ey); ctx.stroke(); ctx.setLineDash([]); ctx.lineWidth = 1; }
    });
    O.TollBar = { get taken() { return taken; }, bars: () => { const s = cur(); return [...s.biz.values()].filter((z) => z.type === 'tollhouse').map((z) => { const b = s.building(z.b?.id ?? z.id); return b && barOf(s, b); }).filter(Boolean); } };
  }
  O.TollBarSetup = { setup };
})();
