// Shut for good. A shop that has gone under stands with planks nailed across its door and its window
// shutters fastened, a weed or two coming up at the step, until somebody takes it on again.
'use strict';
(function () {
  function setup(game) {
    const cur = () => O.SimRef.cur;
    game.hooks.drawWorld.push((ctx, cam) => {
      const s = cur(); if (!s || game.scene) return; const W = ctx.canvas.width, H = ctx.canvas.height;
      for (const b of s.world.buildings) { if (!b.closedShop || s.biz.get(b.id) || b.ruined || !b.sprite || !b.sprite.door) continue; const sp = b.sprite, bx = b.x * 16 - sp.OV - cam.x, by = (b.bottom + 1) * 16 - sp.H - cam.y; if (bx > W + 10 || by > H + 10 || bx + sp.W < -10 || by + sp.H < -10) continue;
        const d = sp.door, x = Math.round(bx + d.x), y = Math.round(by + d.y), w = d.w, h = d.h;
        ctx.strokeStyle = '#7a5a3a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y + 2); ctx.lineTo(x + w, y + h - 3); ctx.moveTo(x + w, y + 2); ctx.lineTo(x, y + h - 3); ctx.stroke(); ctx.lineWidth = 1;
        ctx.fillStyle = '#8a6a44'; ctx.fillRect(x - 1, y + Math.round(h * 0.45), w + 2, 3); ctx.fillStyle = '#4a4a50'; ctx.fillRect(x, y + Math.round(h * 0.45) + 1, 1, 1); ctx.fillRect(x + w - 1, y + Math.round(h * 0.45) + 1, 1, 1);
        for (const wd of (sp.windows || []).slice(0, 3)) { ctx.fillStyle = 'rgba(70,50,30,0.85)'; ctx.fillRect(Math.round(bx + wd.x), Math.round(by + wd.y), wd.w, wd.h); ctx.fillStyle = 'rgba(40,28,18,0.9)'; ctx.fillRect(Math.round(bx + wd.x + wd.w / 2), Math.round(by + wd.y), 1, wd.h); }
        ctx.fillStyle = '#5a8a3a'; ctx.fillRect(x - 3, y + h - 3, 1, 3); ctx.fillRect(x - 2, y + h - 4, 1, 2); ctx.fillRect(x + w + 2, y + h - 2, 1, 2); }
    });
    // and opened again: the new owner prises off the boards and paints up the sign, and the neighbours wish them luck
    const SP = O.Sim.prototype, _start = SP.startBusiness, opens = [];
    if (_start) SP.startBusiness = function (b, type, owner) { const was = !!(b && b.closedShop); const r = _start.apply(this, arguments); try { if (was && owner && owner !== 'player') opens.push({ s: this, b, q: owner, day: this.day, t: 0, phase: 'wait' }); } catch (e) { /* */ } return r; };
    const talking = (q) => O.npcUI && O.npcUI.talking && O.npcUI.talking() === q;
    game.hooks.update.push((dt) => { const s = cur(); if (!s || game.scene) return; for (const o of opens.slice()) { if (o.s !== s) continue; if (s.day - o.day > 1) { opens.splice(opens.indexOf(o), 1); continue; } const P = game.player, x = o.b.doorX * 16 + 8, y = (o.b.doorY + 1) * 16 + 6; const near = Math.hypot(x - P.x, y - P.y) < 360, a = o.q.agent; if (!a) continue;
        if (o.phase === 'wait') { if (!near || a.frozen || o.q.errand || talking(o.q) || s.minute < 7 * 60 || s.minute > 18 * 60) continue; if (a.inside != null) { a.inside = null; a.hidden = false; } a.x = x + 10; a.y = y; a.frozen = true; a.path = null; a.dir = 3; o.q._reopen = true; o.phase = 'boards'; o.t = 0; }
        o.t += dt; if (talking(o.q)) { a.frozen = false; a.forceAnim = null; o.q._reopen = false; opens.splice(opens.indexOf(o), 1); continue; }
        if (o.phase === 'boards') { a.forceAnim = 'hammer'; if (Math.random() < dt * 2 && near) O.sfx && O.sfx('smack', 0.15); if (o.t > 8) { o.phase = 'sign'; o.t = 0; O.Speech && near && O.Speech.say(o.q, 'There. Off they come, and good riddance.', 2.4); } }
        else if (o.phase === 'sign') { a.forceAnim = 'scrub'; a.lift = Math.round(Math.min(1, o.t / 1.5) * 16); if (o.t > 9) { o.phase = 'luck'; o.t = 0; a.lift = 0; const n = s.people.find((x2) => x2 !== o.q && x2.agent && !x2.agent.hidden && x2.agent.inside == null && !x2.agent.frozen && Math.hypot(x2.agent.x - x, x2.agent.y - y) < 200 && x2.age >= 14); if (n && near) { O.gesture && O.gesture(n, 'wave', 1.6); O.Speech && O.Speech.say(n, ['Good luck to you!', 'About time this place was open.', 'I\'ll be your first customer.'][Math.floor(Math.random() * 3)], 2.4); } } }
        else { a.forceAnim = 'celebrate'; if (o.t > 4) { a.forceAnim = null; a.frozen = false; a.lift = 0; o.q._reopen = false; opens.splice(opens.indexOf(o), 1); } } } });
    game.hooks.drawWorld.push((ctx, cam) => { const s = cur(); if (!s || game.scene) return; for (const o of opens) { if (o.s !== s || o.phase === 'wait') continue; const x = Math.round(o.b.doorX * 16 + 8 - cam.x), y = Math.round((o.b.doorY + 1) * 16 + 6 - cam.y); ctx.fillStyle = '#7a5a3a'; for (let i = 0; i < (o.phase === 'boards' ? Math.min(3, Math.floor(o.t / 2.5)) : 3); i++) ctx.fillRect(x - 18, y - 2 - i * 2, 14, 2); if (o.phase === 'sign') { const a = o.q.agent, ax = Math.round(a.x - cam.x); ctx.strokeStyle = '#7a5a3a'; ctx.beginPath(); ctx.moveTo(ax - 4, y); ctx.lineTo(ax - 2, y - 30); ctx.moveTo(ax + 4, y); ctx.lineTo(ax + 2, y - 30); ctx.stroke(); ctx.fillStyle = '#c8a040'; ctx.fillRect(ax + 6, y - 6, 4, 6); } } });
    O.BoardedUp = { opens, count: () => { const s = cur(); return s.world.buildings.filter((b) => b.closedShop && !s.biz.get(b.id)).length; } };
  }
  O.BoardedUpSetup = { setup };
})();
