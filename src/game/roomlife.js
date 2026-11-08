// What people do in a room, more than sit. At mass the congregation sits, kneels to pray, listens to the
// sermon (the children fidget and look about) and bows at the elevation, when the priest lifts the host
// and the little bell rings; the censer swings on its chain and the incense smoke climbs. At lessons
// the children read and write and look out of the window while the master points and talks. At table
// people eat, drink and talk over steaming bowls, and say grace first. Sleepers breathe slow and the Zs
// rise from their beds. In the cells the prisoners sit, mope, shake the bars and call out.
'use strict';
(function () {
  function setup(game) {
    const I = O.Indoor; if (!I) return;
    const PRIEST = /priest|chaplain|friar|monk|abbot|prior|abbess|nun|clerk/;
    const smoke = [], zs = []; let massSc = null, lastPh = -1;
    const SERMON = ['Love thy neighbour, as the Lord bids.', 'Pride goes before a fall, my children.', 'Give to the poor, and you lend to the Lord.', 'Keep the Sabbath holy.', 'Who among you has not sinned?', 'The harvest is the Lord\'s gift. Be thankful.'];
    const GRACE = ['Bless this food, O Lord.', 'For what we are about to receive...', 'Thanks be to God for this bread.'];
    const PRISON = ['Let me out of here!', 'I\'m innocent, I tell you!', 'Bread, for pity\'s sake.', 'How long now?', 'You\'ll be sorry, the lot of you.'];
    // which part of the mass: a 70-second round
    const phaseOf = (t) => { const k = t % 70; return k < 12 ? 'sit' : k < 26 ? 'kneel' : k < 42 ? 'sermon' : k < 48 ? 'kneel' : k < 53 ? 'elevation' : k < 62 ? 'kneel' : 'sit'; };
    const settled = (a) => a && !a.leaving && a.x === a.gx && a.y === a.gy;
    const _walk = I.prototype.walkActors;
    I.prototype.walkActors = function (dt) {
      // the priest goes to stand at the altar while folk are at mass
      try { const alt = this.L.items.find((i) => i.kind === 'altar'); if (alt && this._mass) { const pr = [...this.actors.values()].find((a) => !a.leaving && PRIEST.test(a.person.job?.role || '') && !a.inBed); if (pr && !pr.person.agent.frozen) { const [ax, ay] = this.anchor(alt); pr.gx = ax; pr.gy = ay + 14; pr.gSortY = null; pr.seat = null; pr.gDir = 0; } } } catch (e) { /* */ }
      _walk.call(this, dt);
      try {
        const b = this.b, items = this.L.items, hasAltar = items.some((i) => i.kind === 'altar');
        const acts = [...this.actors.values()].filter(settled);
        const worship = acts.filter((a) => a.person.activity?.act === 'worship' && !PRIEST.test(a.person.job?.role || '')), lessons = acts.filter((a) => a.person.activity?.act === 'lessons');
        const priest = hasAltar ? acts.find((a) => PRIEST.test(a.person.job?.role || '')) : null;
        this._priest = null;
        if (hasAltar && worship.length >= 2) {
          const ph = phaseOf(this.t); this._mass = ph; massSc = this;
          for (const a of worship) { if (a.person.agent.frozen || a.inBed) continue; const kid = a.person.age < 12, q = a.person; a.anim = ph === 'kneel' || ph === 'elevation' ? (kid && (Math.floor(this.t / 3) + q.id) % 5 === 0 ? 'look' : 'pray') : ph === 'sermon' ? (kid && (Math.floor(this.t / 2.5) + q.id) % 3 === 0 ? ['look', 'scratch', 'yawn'][q.id % 3] : (q.age > 60 && (Math.floor(this.t / 6) + q.id) % 4 === 0 ? 'doze' : 'sit')) : 'sit'; }
          if (priest) { this._priest = priest; priest.dir = 0; priest.anim = ph === 'sermon' ? 'talk' : ph === 'elevation' ? 'celebrate' : ph === 'kneel' ? 'pray' : 'read';
            if (ph !== lastPh) { if (ph === 'sermon' && O.Speech) O.Speech.say(priest.person, SERMON[Math.floor(this.t / 70) % SERMON.length], 5); if (ph === 'elevation') { O.sfx && O.sfx('handbell', 0.25, true); } if (ph === 'sit' && (this.t % 70) > 60 && O.Speech) O.Speech.say(priest.person, 'Go in peace.', 3); }
          }
          lastPh = ph;
        } else if (massSc === this) { massSc = null; this._mass = null; }
        if (lessons.length) { const master = acts.find((a) => a.person.activity?.act === 'work' && (PRIEST.test(a.person.job?.role || '') || /teacher|schoolmaster|tutor/.test(a.person.job?.role || ''))); for (const a of lessons) { const q = a.person; if (q.agent.frozen) continue; const k = (Math.floor(this.t / 4) + q.id) % 7; a.anim = ['read', 'read', 'write', 'write', 'look', 'read', 'scratch'][k]; } if (master) { master.anim = (Math.floor(this.t / 5)) % 3 === 0 ? 'point' : 'talk'; master.dir = 0; } }
        // at table
        const hr = (this.sim.minute / 60) % 24, meal = (hr >= 17.5 && hr < 19.5) || (hr >= 12 && hr < 12.75) || (hr >= 6.5 && hr < 7.25);
        const eaters = acts.filter((a) => a.seat && a.seat.kind !== 'pew' && a.seat.kind !== 'throne' && (['eat', 'eat-out', 'feast'].includes(a.person.activity?.act) || (meal && a.person.activity?.act === 'home' && b.type === 'house')));
        for (const a of eaters) { const q = a.person; if (q.agent.frozen) continue; const k = (Math.floor(this.t / 2.5) + q.id) % 6; a.anim = ['eat', 'eat', 'drink', 'eat', 'talk', 'eat'][k]; if (!q._graceT || q._graceT < this.t - 400) { q._graceT = this.t; if (eaters[0] === a && eaters.length > 1 && O.Speech) O.Speech.say(q, GRACE[q.id % GRACE.length], 2.5); } }
        this._eaters = eaters;
        // in the cells
        if (b.type === 'gaol' || b.type === 'guardhouse' || b.type === 'watchhouse') for (const a of acts) { const q = a.person; if (q.activity?.act !== 'jailed' || q.agent.frozen) continue; const k = (Math.floor(this.t / 5) + q.id) % 8; a.anim = ['sit', 'sit', 'mourn', 'look', 'shake', 'sit', 'pray', 'sit'][k]; if (k === 4 && (this.t % 5) < dt * 1.5) { O.sfx && O.sfx('smack', 0.08, true); if (Math.random() < 0.4 && O.Speech) O.Speech.say(q, PRISON[(q.id + Math.floor(this.t / 40)) % PRISON.length], 2.5); } }
      } catch (e) { /* the room still works without us */ }
    };
    game.hooks.drawTop.push((ctx, cam, inScene) => {
      const sc = game.scene; if (!inScene || !sc || !sc.actors || !sc.anchor) { smoke.length = 0; zs.length = 0; return; }
      const dt = 1 / 60, tk = performance.now() / 1000;
      // the censer and its smoke
      if (sc._mass && sc._priest && sc._mass !== 'sit') { const p = sc._priest, sw = Math.sin(tk * 2.4) * 0.6, cx = p.x + 10 + Math.sin(sw) * 12, cy = p.y - 14 + Math.cos(sw) * 10 - 10; ctx.strokeStyle = '#c8a040'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(Math.round(p.x + 6 - cam.x), Math.round(p.y - 24 - cam.y)); ctx.lineTo(Math.round(cx - cam.x), Math.round(cy - cam.y)); ctx.stroke(); ctx.fillStyle = '#c8a040'; ctx.fillRect(Math.round(cx - 2 - cam.x), Math.round(cy - cam.y), 5, 4); ctx.fillStyle = '#ff9040'; ctx.fillRect(Math.round(cx - cam.x), Math.round(cy + 1 - cam.y), 1, 1); if (Math.random() < 0.5) smoke.push({ x: cx, y: cy - 1, t: 0, vx: (Math.random() - 0.5) * 4 }); }
      for (const s of smoke.slice()) { s.t += dt; s.y -= 9 * dt; s.x += (s.vx + Math.sin(s.t * 2 + s.x) * 4) * dt; if (s.t > 3) smoke.splice(smoke.indexOf(s), 1); }
      for (const s of smoke) { ctx.globalAlpha = 0.4 * (1 - s.t / 3); ctx.fillStyle = '#e8e4f0'; const r = 1 + Math.floor(s.t); ctx.fillRect(Math.round(s.x - cam.x) - r, Math.round(s.y - cam.y) - r, r * 2, r * 2); } ctx.globalAlpha = 1;
      // altar and stand candles flicker
      for (const it of sc.L.items) { if (it.kind !== 'altar' && it.kind !== 'candlestand') continue; let ax, ay; try { [ax, ay] = sc.anchor(it); } catch (e) { continue; } const pts = it.kind === 'altar' ? [[-10, -26], [10, -26]] : [[0, -30]]; for (const [dx, dy] of pts) { const fl = Math.floor(tk * 9 + dx) % 3; ctx.fillStyle = 'rgba(255,200,90,0.18)'; ctx.fillRect(Math.round(ax + dx - 3 - cam.x), Math.round(ay + dy - 4 - cam.y), 7, 7); ctx.fillStyle = fl ? '#ffd060' : '#fff0b0'; ctx.fillRect(Math.round(ax + dx - cam.x), Math.round(ay + dy - fl - cam.y), 1, 2); } }
      // steaming bowls on the table in front of those eating
      for (const a of sc._eaters || []) { const r = a.seat.rot || 0, ox = r === 1 ? 10 : r === 2 ? -10 : 0, oy = r === 0 ? 8 : r === 3 ? -14 : -6, x = Math.round(a.x + ox - cam.x), y = Math.round(a.y + oy - 8 - cam.y); ctx.fillStyle = '#8a6239'; ctx.fillRect(x - 3, y, 6, 2); ctx.fillStyle = '#d8b878'; ctx.fillRect(x - 2, y - 1, 4, 1); if (Math.random() < 0.08) smoke.push({ x: a.x + ox, y: a.y + oy - 10, t: 1.6, vx: 0 }); }
      // Zs over the sleepers
      for (const a of sc.actors.values()) { if (!a.inBed || a.person.activity?.act !== 'sleep') continue; const id = a.person.id; if (Math.random() < 0.006 + (id % 3) * 0.002) { let ax, ay; try { [ax, ay] = sc.anchor(a.inBed); } catch (e) { continue; } zs.push({ x: ax + 4, y: ay - 18, t: 0 }); } }
      for (const z of zs.slice()) { z.t += dt; z.y -= 6 * dt; z.x += Math.sin(z.t * 3) * 6 * dt; if (z.t > 2.4) zs.splice(zs.indexOf(z), 1); }
      ctx.fillStyle = '#e8ecf8'; for (const z of zs) { ctx.globalAlpha = Math.max(0, 1 - z.t / 2.4); const x = Math.round(z.x - cam.x), y = Math.round(z.y - cam.y), s = z.t > 1 ? 4 : 3; ctx.fillRect(x, y, s, 1); ctx.fillRect(x + s - 2, y + 1, 1, 1); ctx.fillRect(x + 1, y + 2, 1, 1); ctx.fillRect(x, y + 3, s, 1); } ctx.globalAlpha = 1;
    });
    O.RoomLife = { phaseOf, get mass() { return massSc && massSc._mass; } };
  }
  O.RoomLifeSetup = { setup };
})();
