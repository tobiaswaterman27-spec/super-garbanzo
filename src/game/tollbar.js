// The toll bar. Where a place keeps a toll house, a painted pole lies across the road beside it, and the
// toll keeper steps out to whoever comes, holds out a hand for the penny, and swings the bar up to let
// them by; then down it comes again. You pay too, once a day, if you've a penny on you; the keeper
// remembers you've paid. Townsfolk of the place go free, and so do children, clergy and the watch; you go
// free too if you own property there, if the keeper counts you a friend, or if you stand high in the gang
// that runs the place. No penny? A keeper who likes you (or has heard well of you) lets it ride till next
// time; otherwise the bar stays down. Slip past without paying and the keeper shouts after you, remembers,
// and wants twice the toll next time.
'use strict';
(function () {
  const T = 16;
  function setup(game) {
    const cur = () => O.SimRef.cur;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    const mem = new WeakMap(), M = (o) => { let m = mem.get(o); if (!m) mem.set(o, (m = {})); return m; };
    let taken = 0, waved = 0, dodged = 0, trusted = 0; const paidToday = new Map(), owed = new Map(), passing = new Map();
    const relOf = (q) => { const r = q.rel.get(0) || { affinity: 0, familiar: 0 }; q.rel.set(0, r); return r; };
    const exemptNpc = (s, q, keeper) => q.age < 12 || (!q.visitor && q.home != null) || /priest|friar|monk|nun|chaplain|abbot|bishop|guard|sergeant|watch|captain|constable/.test(q.job?.role || '') || (keeper && q.household === keeper.household);
    function playerFree(s, keeper) { const PS = O.PlayerState; if (s.world.buildings.some((b) => b.owner && b.owner.kind === 'player')) return 'yours'; if (keeper && relOf(keeper).affinity >= 0.5) return 'friend'; if ((PS.gangRanks || []).some((g) => g.place === s.world.placeId && (g.trust || 0) >= 0.6)) return 'gang'; return null; }
    const near = (x, y, r) => Math.hypot(x - game.player.x, y - game.player.y) < r;
    function barOf(s, b) { const m = M(b); if (m.bar !== undefined) return m.bar; const w = s.world; let best = null, bd = 1e9; for (let ty = b.doorY - 3; ty <= b.doorY + 5; ty++) for (let tx = b.doorX - 6; tx <= b.doorX + 6; tx++) { if (tx < 1 || ty < 1 || tx >= w.W - 1 || ty >= w.H - 1) continue; const i = ty * w.W + tx; if (w.ter[i] !== w.TER.ROAD || w.solid[i]) continue; const d = Math.abs(tx - b.doorX) + Math.abs(ty - b.doorY - 1); if (d < bd) { bd = d; best = [tx, ty]; } } if (!best) return (m.bar = null); const [tx, ty] = best; const horiz = w.ter[ty * w.W + tx - 1] === w.TER.ROAD || w.ter[ty * w.W + tx + 1] === w.TER.ROAD; return (m.bar = { x: tx * T + 8, y: ty * T + 8, horiz, up: 0, want: 0, t: 0 }); }
    game.hooks.update.push((dt) => {
      const s = cur(); if (!s || !s.world || game.scene) return; const hr = s.minute / 60, open = hr >= 6 && hr < 21;
      for (const z of s.biz.values()) { if (z.type !== 'tollhouse') continue; const b = s.building(z.b?.id ?? z.id); if (!b || b.doorX == null) continue; const B = barOf(s, b); if (!B) continue;
        B.t -= dt; const keeper = (z.workers || []).map((id) => s.byId.get(id)).find((q) => q && q.agent && q.alive !== false);
        // anyone coming along the road raises it (by day; at night the bar stays down and you go round)
        let coming = null; if (open) { for (const q of s.people) { const a = q.agent; if (!a || a.hidden || a.inside != null || !a.path || q === keeper) continue; if (Math.hypot(a.x - B.x, a.y - B.y) < 30) { coming = q; break; } } }
        if (coming && B.t <= 0) { B.want = 1; B.t = 3.5;
          if (keeper && keeper.agent && !keeper.agent.frozen && !keeper.errand && near(B.x, B.y, 260)) { O.gesture && O.gesture(keeper, 'take', 1.2); if (Math.random() < 0.3) O.Speech && O.Speech.say(keeper, pick(['A penny the toll, friend.', 'Pass, and God speed.', 'Toll for the bridge and the road.']), 2); }
          if (!exemptNpc(s, coming, keeper)) { try { const hh = s.household(coming); if (hh && hh.money >= 1) { hh.money -= 1; z.cash = (z.cash || 0) + 1; taken++; } else if (keeper && near(B.x, B.y, 260) && Math.random() < 0.5) { O.Speech && O.Speech.say(coming, 'I\'ve nothing, master. Have a heart.', 2); setTimeout(() => keeper && O.Speech && O.Speech.say(keeper, Math.random() < 0.6 ? 'Go on, then. Just this once.' : 'Then back you go.', 2), 1400); } } catch (e) { /* */ } }
          // (someone turned back who goes round the bar anyway)
          for (const [k, p] of passing) { if (game.t - p.t > 12) { passing.delete(k); continue; } }
        }
        { const P = game.player; if (open && !P.hidden && Math.hypot(P.x - B.x, P.y - B.y) < 30 && !(M(b).pLast > game.t - 6)) { M(b).pLast = game.t; const before = passing.size; { const PS = O.PlayerState, key = s.world.placeId + ':' + b.id; if (paidToday.get(key) !== s.day && PS) { const ui = (t, k) => O.UI && O.UI.say && O.UI.say(t, k || 'info'); const free = playerFree(s, keeper), due = 1 + (owed.get(key) || 0);
            if (free) { paidToday.set(key, s.day); waved++; ui(free === 'yours' ? 'The keeper knows you for a householder here and waves you through.' : free === 'friend' ? `${keeper.first} waves you through. "Not from you, friend."` : 'The keeper takes one look at you and finds something interesting to study in the other direction.'); }
            else if (PS.money >= due) { PS.money -= due; owed.delete(key); paidToday.set(key, s.day); taken += due; z.cash = (z.cash || 0) + due; ui(due > 1 ? `You pay the toll keeper ${due} pennies: today's, and the one you slipped last time.` : 'You pay the toll keeper a penny to pass.'); }
            else if (keeper && (relOf(keeper).affinity > 0.2 || ((PS.rep && PS.rep.civilian) || 0) > 0.4)) { paidToday.set(key, s.day); trusted++; owed.set(key, (owed.get(key) || 0) + 1); ui(`No penny? ${keeper.first} sighs. "Next time, then. I'll remember."`); }
            else { B.want = 0; B.t = 1.5; passing.set(key, { t: game.t, x: game.player.x, y: game.player.y }); ui('"A penny, or you go back the way you came." The bar stays down.', 'warn'); } } } if (passing.size === before) { B.want = 1; B.t = 3.5; } } }
        { const key = s.world.placeId + ':' + b.id, p = passing.get(key), P = game.player; const side = (x, y) => B.horiz ? Math.sign(x - B.x) : Math.sign(y - B.y); if (p && game.t - p.t < 12 && Math.hypot(P.x - B.x, P.y - B.y) < 60 && side(P.x, P.y) !== 0 && side(P.x, P.y) !== side(p.x, p.y) && Math.abs(B.horiz ? P.x - B.x : P.y - B.y) > 14) { passing.delete(key); dodged++; owed.set(key, (owed.get(key) || 0) + 1); paidToday.set(key, s.day); const PS = O.PlayerState; if (PS.rep) PS.rep.criminal = Math.min(1, (PS.rep.criminal || 0) + 0.01); if (keeper) { relOf(keeper).affinity = Math.max(-1, relOf(keeper).affinity - 0.1); try { s.remember(keeper, 'The stranger ducked under my bar without paying the toll.', 'crime', 0.8); } catch (e) { /* */ } O.reportOutdoorCrime && O.reportOutdoorCrime(s, { kind: 'theft', place: b.name || 'the toll house', seen: [keeper], victim: keeper, reporter: keeper, chance: 0.35, severity: 1 }); O.Speech && O.Speech.say(keeper, 'Oi! The toll! I\'ll know your face next time!', 2.4); O.gesture && O.gesture(keeper, 'point', 1.4); } } }
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
    O.TollBar = { get taken() { return taken; }, get waved() { return waved; }, get dodged() { return dodged; }, get trusted() { return trusted; }, owed, bars: () => { const s = cur(); return [...s.biz.values()].filter((z) => z.type === 'tollhouse').map((z) => { const b = s.building(z.b?.id ?? z.id); return b && barOf(s, b); }).filter(Boolean); } };
  }
  O.TollBarSetup = { setup };
})();
