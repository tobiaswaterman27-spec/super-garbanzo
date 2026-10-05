// Two more high days for the year, so every season has one:
//   May Day (spring, day 1): a maypole goes up in the square, ribbons and all. From ten the young folk dance
//     round it, winding the ribbons, while the town watches; at noon a Queen of the May is crowned with a
//     garland. You can join the dance, and if you're a young woman well liked in the town, the garland may
//     be yours.
//   Midsummer Eve (summer, day 8): a great bonfire in the square from dusk till midnight. The town gathers
//     round it to drink and sing, and the bold leap the flames for luck in the year to come.
'use strict';
(function () {
  const T = 16;
  function setup(game) {
    const PS = O.PlayerState, cur = () => O.SimRef.cur, say = (t, k) => O.UI.say(t, k), SP = O.Sim.prototype;
    const kindOn = (se, d) => (se === 'spring' && d === 1 ? 'mayday' : se === 'summer' && d === 8 ? 'midsummer' : null);
    const today = (s) => (s && s.weather && !s.quarantine ? kindOn(s.season, s.weather.dayOfSeason) : null);
    const HOURS = { mayday: [10, 17], midsummer: [20, 24] };
    const live = (s) => { const k = today(s); if (!k) return null; const [a, b] = HOURS[k]; return s.hour >= a && s.hour < b ? k : null; };
    O.Revels = { today, live, on: (s, day) => !!kindOn(O.seasonOfDay ? O.seasonOfDay(day) : '', O.dosOfDay ? O.dosOfDay(day) : 0) };
    const meSex = () => O.Forge.player?.sex || O.Forge.player?.a?.sex || 'm';

    // ---------------------------------------------------------------- where: a clear patch of the square
    function spot(s) {
      if (s._revelSpot) return s._revelSpot;
      const [x0, y0, x1, y1] = s.Z.square, w = s.world, free = (x, y) => x >= 0 && y >= 0 && x < w.W && y < w.H && w.solid[y * w.W + x] !== 1 && w.ter[y * w.W + x] !== w.TER.WATER;
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2; let best = [Math.round(cx), Math.round(cy)], bs = -1e9;
      for (let y = y0 + 1; y <= y1; y++) for (let x = x0 + 1; x <= x1 - 1; x++) {
        let room = 0; for (let yy = y - 2; yy <= y + 2; yy++) for (let xx = x - 3; xx <= x + 3; xx++) if (free(xx, yy)) room++;
        if (!free(x, y)) continue;
        const sc = room * 2 - Math.hypot(x - cx, y - cy); if (sc > bs) { bs = sc; best = [x, y]; }
      }
      // keep clear of the scaffold if there's one up
      return (s._revelSpot = best);
    }
    const centre = (s) => { const [x, y] = spot(s); return [x * T + 8, y * T + 8]; };
    O.revelCentre = centre;
    const freeTile = (s, x, y) => { const w = s.world; return x >= 0 && y >= 0 && x < w.W && y < w.H && w.solid[y * w.W + x] !== 1; };

    // ---------------------------------------------------------------- who goes, and where they stand
    const dancer = (s, p) => p.age >= 8 && p.age <= 34 && (p.id % 3 === 0 || (p.age < 14 && p.id % 2 === 0));
    const _plan = SP.plan;
    SP.plan = function (p) {
      const pl = _plan.call(this, p);
      if (!pl || p.task || p.visitor || p.age < 5 || ['sleep', 'sick', 'jailed', 'collapsed', 'court', 'condemned', 'headsman', 'labour'].includes(pl.act) || p.health?.illness) return pl;
      const k = live(this); if (!k) return pl;
      if (pl.act === 'work' && !(k === 'midsummer' && this.hour >= 21)) return pl;
      if (k === 'mayday') {
        if (dancer(this, p) && (this.hour < 12 || this.hour >= 12.6)) return { act: 'maydance', outdoor: true, zone: 'revel' };
        if ((p.id + Math.floor(this.hour)) % 3 < 2) return { act: 'festival', outdoor: true, zone: 'revel' };
      } else if (k === 'midsummer' && p.age >= 10 && (p.id + Math.floor(this.hour)) % 3 === 0) return { act: 'bonfire', outdoor: true, zone: 'revel' };
      return pl;
    };
    const _zone = SP.zoneTile;
    SP.zoneTile = function (p, zone) {
      if (zone !== 'revel') return _zone.call(this, p, zone);
      const [cx, cy] = spot(this), act = p.activity?.act || '';
      const ring = act === 'maydance' ? 2 : act === 'bonfire' ? 3 + (p.id % 3) : 4 + (p.id % 2);
      for (let k = 0; k < 8; k++) {
        const ang = ((p.id * 2.39996) + k * 0.8) % (Math.PI * 2), x = Math.round(cx + Math.cos(ang) * ring), y = Math.round(cy + Math.sin(ang) * ring * 0.7);
        if (freeTile(this, x, y) && !(x === cx && y === cy)) return [x, y];
      }
      return _zone.call(this, p, 'square');
    };
    const _idle = SP.idleAnim;
    SP.idleAnim = function (p) {
      const act = p.activity?.act;
      if (act === 'bonfire') { const k = (p.id + Math.floor(this.minute / 5)) % 5; return k === 0 ? 'celebrate' : k === 1 ? 'drink' : k === 2 ? 'talk' : 'idle'; }
      if (act === 'festival' && live(this) === 'mayday') { const k = (p.id + Math.floor(this.minute / 4)) % 4; return k === 0 ? 'celebrate' : k === 1 ? 'talk' : 'idle'; }
      return _idle.call(this, p);
    };

    // ---------------------------------------------------------------- the dance: round and round the pole
    const RX = 30, RY = 19;
    let danceT = 0, me = null; // you, dancing
    game.hooks.update.push((dt) => {
      const s = cur(); if (!s || !s.people || game.scene) return;
      const k = live(s), [cx, cy] = centre(s), turn = game.t * 0.55;
      const ring = [];
      for (const q of s.people) {
        const a = q.agent; if (!a) continue;
        const dancing = k === 'mayday' && q.activity?.act === 'maydance' && a.inside == null && !a.hidden && (a._dance || Math.hypot(a.x - cx, a.y - cy) < 48);
        if (dancing) ring.push(q);
        else if (a._dance) { a._dance = false; a.frozen = false; a.forceAnim = null; }
      }
      const n = ring.length + (me ? 1 : 0); let i = 0;
      ring.sort((a, b) => a.id - b.id);
      for (const q of ring) {
        const a = q.agent, ang = turn + (i++ / n) * Math.PI * 2, tx = cx + Math.cos(ang) * RX, ty = cy + Math.sin(ang) * RY;
        if (!a._dance) { a._dance = true; a.path = null; }
        const dx = tx - a.x, dy = ty - a.y, d = Math.hypot(dx, dy); a.frozen = true; a.forceAnim = 'walk';
        if (d > 1.5) { const sp = Math.min(d, 60 * dt); a.x += dx / d * sp; a.y += dy / d * sp; } else { a.x = tx; a.y = ty; }
        a.dir = O.dirOf(-Math.sin(ang) * RX, Math.cos(ang) * RY); a.anim = 'walk'; a.ft += dt;
      }
      if (me) {
        const p = game.player, ang = turn + (i / n) * Math.PI * 2;
        p.x = cx + Math.cos(ang) * RX; p.y = cy + Math.sin(ang) * RY; p.dir = O.dirOf(-Math.sin(ang) * RX, Math.cos(ang) * RY); p.anim = 'walk'; p.locked = true;
        danceT -= dt; if (danceT <= 0 || k !== 'mayday') endDance(s, ring);
      }
    });
    function endDance(s, ring) {
      me = null; game.player.locked = false; game.player.anim = 'idle';
      game.player.y = centre(s)[1] + RY + 10;
      if (s._dancedDay === s.day) return say('Round and round once more, till you\'re dizzy and laughing.');
      s._dancedDay = s.day; PS.rep.local = Math.min(1, (PS.rep.local || 0) + 0.04);
      for (const q of ring) s.relate(q, { id: 0 }, 0.05);
      say(`You dance the ribbons round the maypole with ${ring.length ? ring.length + ' others' : 'the young folk'}, under and over, till the pole is wound in colours. The town cheers.`);
    }
    function dance() {
      const s = cur(); me = { s }; danceT = 9;
      say('You take a ribbon and join the ring.');
    }

    // ---------------------------------------------------------------- the Queen of the May
    const crowned = (s) => s.mayQueen && s.mayQueen.day === s.day ? s.mayQueen : null;
    const _look = SP.refreshLook;
    SP.refreshLook = function (p) { _look.call(this, p); const mq = crowned(this); if (mq && mq.id === p.id && p.app) p.app.jewels = [...(p.app.jewels || []).filter((j) => j !== 'circlet'), 'garland']; };
    game.hooks.update.push(() => {
      const s = cur(); if (!s || !s.people || today(s) !== 'mayday' || s.hour < 12 || s.hour >= 17 || (s.mayQueen && s.mayQueen.day === s.day)) return;
      const [cx, cy] = centre(s), p = game.player;
      const near = !game.scene && game.world === s.world && Math.hypot(p.x - cx, p.y - cy) < 200;
      const age = O.Forge.player?.age || 25;
      if (near && meSex() === 'f' && age <= 26 && (PS.rep.local || 0) >= 0.08 && !PS.wantedLevel?.()) {
        s.mayQueen = { day: s.day, id: 0 }; PS.garland = s.day; PS.rep.local = Math.min(1, PS.rep.local + 0.1);
        s.log(`The stranger was crowned Queen of the May in ${s.world.name}.`, 'festival');
        return O.UI.dialog.open({ name: 'Queen of the May', color: '#4a7a34', text: 'The girls come for you with a garland of hawthorn and cowslips. "The Queen of the May!" They set it on your head and lead you round the pole, and the whole square cheers.', options: [{ key: 'ok', label: 'Wave to the crowd' }], onPick: () => O.UI.dialog.close() });
      }
      const girls = s.people.filter((q) => q.alive !== false && q.sex === 'f' && q.age >= 14 && q.age <= 21 && !q.spouse && !q.visitor && q.agent && !q.health?.illness);
      if (!girls.length) { s.mayQueen = { day: s.day, id: null }; return; }
      const q = girls.sort((a, b) => ((a.id * 7919 + s.day) % 97) - ((b.id * 7919 + s.day) % 97))[0];
      s.mayQueen = { day: s.day, id: q.id };
      if (q.app) { q.app.jewels = [...(q.app.jewels || []).filter((j) => j !== 'circlet'), 'garland']; O.Char.invalidate(q.app); }
      s.remember(q, 'Was crowned Queen of the May.', 'life', 2);
      s.log(`${q.first} ${q.sur || ''} was crowned Queen of the May.`.replace('  ', ' '), 'festival');
      if (near) say(`A cheer goes up: ${q.first} ${q.sur || ''} is crowned Queen of the May, with a garland of hawthorn and cowslips.`.replace('  ', ' '));
    });
    // the garland comes off the day after
    game.hooks.update.push(() => {
      const s = cur(); if (!s || !s.mayQueen || s.mayQueen.day === s.day || s.mayQueen.off) return;
      s.mayQueen.off = true; const q = s.byId.get(s.mayQueen.id);
      if (q && q.app) { q.app.jewels = (q.jewels || []).slice(); O.Char.invalidate(q.app); }
    });

    // ---------------------------------------------------------------- the pole and the fire, drawn
    const RIB = ['#c83a3a', '#f0d040', '#3f6fae', '#f0f0f0', '#4a9a4a', '#d870a0'];
    function paintPole(ctx, cam, s) {
      const [cx, cy] = centre(s), x = Math.round(cx - cam.x), y = Math.round(cy - cam.y), top = y - 78;
      ctx.fillStyle = 'rgba(28,20,44,0.32)'; ctx.fillRect(x - 4, y - 1, 9, 3);
      ctx.fillStyle = '#3a2614'; ctx.fillRect(x - 2, top, 5, 79);
      ctx.fillStyle = '#e8e0d0'; ctx.fillRect(x - 1, top, 3, 78);
      ctx.fillStyle = '#c83a3a'; for (let yy = top + 6; yy < y - 2; yy += 7) { ctx.fillRect(x - 1, yy, 3, 2); ctx.fillRect(x - 1, yy + 2, 1, 1); } // painted stripes
      // the crown of greenery at the top
      ctx.fillStyle = '#2e5a24'; ctx.fillRect(x - 8, top - 2, 17, 5); ctx.fillStyle = '#4a7a34'; ctx.fillRect(x - 7, top - 3, 15, 3);
      for (let i = 0; i < 6; i++) { ctx.fillStyle = ['#f0e8f0', '#e8a0b8', '#f0d040'][i % 3]; ctx.fillRect(x - 7 + i * 3, top - 3 + (i % 2), 2, 2); }
      // ribbons to every dancer's hand (or hanging loose)
      const hands = [];
      for (const q of s.people) if (q.agent && q.agent._dance) hands.push([q.agent.x, q.agent.y - 22]);
      if (me) hands.push([game.player.x, game.player.y - 22]);
      const n = Math.max(hands.length, 6);
      for (let i = 0; i < n; i++) {
        const h = hands[i], c = RIB[i % RIB.length]; ctx.fillStyle = c;
        const ex = h ? h[0] - cam.x : x + Math.cos(i) * 5, ey = h ? h[1] - cam.y : y - 20 - (i % 3) * 4;
        const steps = 40; for (let k = 0; k <= steps; k++) { const t = k / steps, sag = Math.sin(t * Math.PI) * 5; ctx.fillRect(Math.round(x + (ex - x) * t), Math.round(top + 2 + (ey - top - 2) * t + sag), 1, 1); }
      }
    }
    const sparks = [];
    function paintFire(ctx, cam, s, dt) {
      const [cx, cy] = centre(s), x = Math.round(cx - cam.x), y = Math.round(cy - cam.y);
      // a ring of stones, and the stacked logs
      ctx.fillStyle = '#5a5650'; for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; ctx.fillRect(Math.round(x + Math.cos(a) * 18) - 2, Math.round(y + Math.sin(a) * 8) - 1, 4, 3); }
      ctx.fillStyle = '#2a1a0e'; ctx.fillRect(x - 12, y - 4, 24, 6);
      ctx.fillStyle = '#4a3020'; for (let i = -3; i <= 3; i++) ctx.fillRect(x + i * 4 - 1, y - 20 + Math.abs(i) * 4, 3, 20 - Math.abs(i) * 4);
      // the flames
      const t = game.t;
      for (let i = 0; i < 16; i++) {
        const fx = x - 13 + i * 1.7 + Math.sin(t * 7 + i) * 1.2, hgt = 18 + Math.sin(t * 9 + i * 1.7) * 6 + (8 - Math.abs(i - 8)) * 3.2;
        ctx.fillStyle = '#c83a10'; ctx.fillRect(Math.round(fx), Math.round(y - hgt), 2, Math.round(hgt));
        ctx.fillStyle = '#f08020'; ctx.fillRect(Math.round(fx), Math.round(y - hgt * 0.7), 2, Math.round(hgt * 0.7));
        ctx.fillStyle = '#f8d040'; ctx.fillRect(Math.round(fx), Math.round(y - hgt * 0.35), 2, Math.round(hgt * 0.35));
      }
      if (Math.random() < 0.5) sparks.push({ x: cx + (Math.random() - 0.5) * 16, y: cy - 36, vy: -20 - Math.random() * 30, vx: (Math.random() - 0.5) * 10, life: 1.2 });
      for (const sp of sparks) { sp.life -= dt; sp.x += sp.vx * dt; sp.y += sp.vy * dt; ctx.fillStyle = sp.life > 0.6 ? '#f8d040' : '#c86020'; ctx.fillRect(Math.round(sp.x - cam.x), Math.round(sp.y - cam.y), 1, 1); }
      while (sparks.length && sparks[0].life <= 0) sparks.shift();
      if (Math.random() < 0.2) game.particles && game.particles.push({ x: cx + (Math.random() - 0.5) * 8, y: cy - 34, vx: 2, vy: -8, life: 0, max: 4 });
    }
    let lastT = 0;
    const POLE = { paint: (ctx, cam) => paintPole(ctx, cam, cur()), revel: true, x: 0, y: 0, ft: 0 };
    const FIRE = { paint: (ctx, cam) => { const dt = Math.min(0.1, game.t - lastT); lastT = game.t; paintFire(ctx, cam, cur(), dt); }, revel: true, x: 0, y: 0, ft: 0 };
    const pole = (s) => today(s) === 'mayday' && s.hour >= 7 && s.hour < 20;
    const fire = (s) => today(s) === 'midsummer' && s.hour >= 19.5;
    game.hooks.update.push(() => {
      const s = cur(); if (!s || !s.world || game.scene || game.world !== s.world) return;
      const want = pole(s) ? POLE : fire(s) ? FIRE : null;
      if (!want) return;
      const [cx, cy] = centre(s); want.x = cx; want.y = cy + 2;
      game.actors.push(want);
    });
    O.extraLights = O.extraLights || [];
    O.extraLights.push((pools, cam) => { const s = cur(); if (!s || !fire(s) || game.world !== s.world) return; const [cx, cy] = centre(s); pools.push([cx - cam.x, cy - 12 - cam.y, 90 + Math.sin(game.t * 6) * 6]); });
    // nobody walks through the fire or the pole
    game.hooks.update.push(() => {
      const s = cur(); if (!s || game.scene || !(pole(s) || fire(s))) return;
      const [cx, cy] = centre(s), r = fire(s) ? 18 : 6, p = game.player;
      if (fire(s)) for (const q of s.people) { const a = q.agent; if (!a || a.hidden || a.inside != null) continue; const d = Math.hypot((a.x - cx) / 1.4, a.y - cy); if (d < 34) { const k = 34.5 / Math.max(0.01, d); a.x = cx + (a.x - cx) * k; a.y = cy + (a.y - cy) * k; if (a.path && a.goal && Math.hypot(a.goal[0] * T + 8 - cx, a.goal[1] * T + 8 - cy) < 40) { a.path = null; a.goal = null; } } }
      if (!leap && !me) { const d = Math.hypot((p.x - cx) / 1.6, p.y - cy); if (d < r) { const k = (r + 0.5) / Math.max(0.01, d); p.x = cx + (p.x - cx) * k; p.y = cy + (p.y - cy) * k; } }
    });

    // ---------------------------------------------------------------- leaping the fire
    let leap = null;
    game.hooks.update.push((dt) => {
      if (!leap) return;
      const p = game.player; leap.t += dt; const u = Math.min(1, leap.t / 0.9);
      p.x = leap.x0 + (leap.x1 - leap.x0) * u; p.y = leap.y0 + (leap.y1 - leap.y0) * u - Math.sin(u * Math.PI) * 18; p.anim = 'walk'; p.locked = true;
      if (u >= 1) { const f = leap.after; leap = null; p.locked = false; p.anim = 'idle'; f(); }
    });
    function leapFire() {
      const s = cur(), p = game.player, [cx, cy] = centre(s), side = p.x < cx ? 1 : -1;
      if (s._leaptDay === s.day) return say('Once is luck. Twice is tempting it.');
      s._leaptDay = s.day;
      leap = { t: 0, x0: cx - side * 26, y0: cy + 4, x1: cx + side * 26, y1: cy + 4, after: () => {
        const ok = Math.random() < 0.82 + (PS.skills.athletics || 0) * 0.15;
        if (ok) { PS.rep.local = Math.min(1, (PS.rep.local || 0) + 0.04); PS.luck = s.day; say('You run and leap the flames clean, to a roar from the crowd. Luck for the year, they say.'); for (const q of s.people) if (q.activity?.act === 'bonfire' && Math.random() < 0.3) { s.relate(q, { id: 0 }, 0.03); if (q.agent) q.agent.anim = 'celebrate'; } }
        else { PS.hp = Math.max(5, PS.hp - 8); say('Your heel catches the embers: you land singed and smoking, and the crowd laughs. (−8 health)', 'bad'); }
      } };
      p.x = leap.x0; p.y = leap.y0;
    }

    // ---------------------------------------------------------------- what you can do there
    const hook = () => {
      const prev = O.stallCandidate;
      O.stallCandidate = () => {
        const base = prev ? prev() : null, s = cur(), p = game.player;
        if (game.scene || me || leap || !s || game.world !== s.world) return base;
        const k = live(s); if (!k) return base;
        const [cx, cy] = centre(s), d = Math.hypot(p.x - cx, p.y - cy);
        let c = null;
        if (k === 'mayday' && d < 60) c = { type: 'custom', d: d - 20, label: 'Join the dance round the maypole', act: dance, x: cx, y: cy - 86 };
        if (k === 'midsummer' && d < 52) c = { type: 'custom', d: d - 20, label: 'Leap the bonfire for luck', act: leapFire, x: cx, y: cy - 40 };
        return c && (!base || c.d < base.d) ? c : base;
      };
    };
    let hooked = false; game.hooks.update.push(() => { if (!hooked) { hooked = true; hook(); } });

    // ---------------------------------------------------------------- the day announced, and in the calendar
    let told = '';
    game.hooks.update.push(() => {
      const s = cur(); if (!s || !s.world) return;
      const k = today(s), key = s.day + ':' + k; if (!k || key === told || s.hour < 7) return; told = key;
      if (k === 'mayday') say(`It's May Day in ${s.world.name}! The maypole is up in the square: dancing from ten, and the Queen of the May crowned at noon.`);
      else say(`It's Midsummer Eve. Tonight there's a great bonfire in the square from eight till midnight.`);
      s.log(k === 'mayday' ? `May Day: the maypole goes up in the square at ${s.world.name}.` : `Midsummer Eve: wood is piled high in the square for the bonfire.`, 'festival');
    });
    const _ev = O.eventsFor;
    if (_ev) O.eventsFor = (s, d0, d1) => {
      const out = _ev(s, d0, d1);
      for (let d = d0; d <= d1; d++) {
        const k = kindOn(O.seasonOfDay(d), O.dosOfDay(d));
        if (k === 'mayday') out.push({ day: d, from: 10, to: 17, title: 'May Day: the maypole dance in the square', where: 'the square', square: true });
        if (k === 'midsummer') out.push({ day: d, from: 20, to: 24, title: 'Midsummer Eve: the bonfire in the square', where: 'the square', square: true });
      }
      return out.sort((a, b) => a.day - b.day || a.from - b.from);
    };
  }
  O.RevelsSetup = { setup };
})();
