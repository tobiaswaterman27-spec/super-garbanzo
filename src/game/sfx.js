// The sounds of doing things, made in code like everything else. Every movement that makes a noise in
// life makes it here, for you and for anyone near you, in time with the movement: feet that click on
// cobbles, pad on dirt, swish through grass, knock on boards and crunch in snow; an axe biting wood, a
// saw rasping, a spade in earth, a broom, a scrubbing brush, dough slapped down, a cleaver, a quill, a
// page turned, a jug poured, a mouthful bitten, a drink swallowed; coins counted out when your purse
// changes; a door's creak and thud when you go in or out; the whoosh and smack of a blow.
'use strict';
(function () {
  const T = 16;
  function setup(game) {
    const S = O.Sound; if (!S) return;
    const ok = () => S.on && S.ctx;
    const now = () => S.ctx.currentTime;
    // building blocks
    function nz(dest, t, dur, type, f, q, peak, decayTo = 0.0001, rate = 1) {
      const c = S.ctx, s = c.createBufferSource(); s.buffer = S.noise; s.playbackRate.value = rate;
      const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
      const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + 0.004); g.gain.exponentialRampToValueAtTime(decayTo, t + dur);
      s.connect(fl); fl.connect(g); g.connect(dest); s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05); return fl;
    }
    function tn(dest, t, dur, f, type, peak, f2) {
      const c = S.ctx, o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
      const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + 0.05);
    }
    const busFor = (inScene) => (inScene ? S.inBus : S.outBus);
    const FX = {
      // feet
      step_cobble(v, b) { const t = now(); nz(b, t, 0.05, 'bandpass', 2600, 2.5, 0.07 * v); tn(b, t, 0.04, 380, 'sine', 0.03 * v, 220); },
      step_dirt(v, b) { nz(b, now(), 0.08, 'lowpass', 700, 0.8, 0.06 * v); },
      step_grass(v, b) { nz(b, now(), 0.11, 'highpass', 3200, 0.6, 0.025 * v); nz(b, now(), 0.06, 'lowpass', 500, 0.7, 0.03 * v); },
      step_wood(v, b) { const t = now(); tn(b, t, 0.09, 180, 'triangle', 0.08 * v, 120); nz(b, t, 0.05, 'bandpass', 900, 1.5, 0.04 * v); },
      step_snow(v, b) { const t = now(); for (let i = 0; i < 3; i++) nz(b, t + i * 0.018, 0.05, 'bandpass', 1800 + Math.random() * 900, 3, 0.03 * v); },
      splash(v, b) { const t = now(); nz(b, t, 0.35, 'bandpass', 1100, 0.8, 0.12 * v); for (let i = 0; i < 4; i++) tn(b, t + 0.03 + Math.random() * 0.2, 0.05, 900 + Math.random() * 1400, 'sine', 0.02 * v, 1800); },
      // work
      chop(v, b) { const t = now(); nz(b, t, 0.09, 'bandpass', 1300, 1.2, 0.2 * v); tn(b, t, 0.14, 160, 'triangle', 0.18 * v, 90); },
      saw(v, b) { const t = now(); const f = nz(b, t, 0.32, 'bandpass', 2400, 4, 0.08 * v, 0.004); f.frequency.linearRampToValueAtTime(3200, t + 0.3); },
      dig(v, b) { const t = now(); nz(b, t, 0.16, 'lowpass', 900, 0.8, 0.14 * v); nz(b, t + 0.02, 0.08, 'bandpass', 2600, 2, 0.04 * v); },
      sweep(v, b) { const t = now(); const f = nz(b, t, 0.3, 'bandpass', 3800, 1.2, 0.05 * v, 0.002); f.frequency.linearRampToValueAtTime(2600, t + 0.3); },
      scrub(v, b) { const t = now(); for (let i = 0; i < 3; i++) nz(b, t + i * 0.08, 0.07, 'bandpass', 2000 + i * 300, 2, 0.04 * v); },
      knead(v, b) { const t = now(); tn(b, t, 0.1, 110, 'sine', 0.12 * v, 70); nz(b, t, 0.06, 'lowpass', 600, 0.7, 0.05 * v); },
      cleave(v, b) { const t = now(); nz(b, t, 0.05, 'highpass', 2500, 0.8, 0.1 * v); tn(b, t + 0.01, 0.12, 140, 'triangle', 0.16 * v, 80); },
      write(v, b) { const t = now(); for (let i = 0; i < 4; i++) nz(b, t + i * 0.06 + Math.random() * 0.03, 0.03, 'highpass', 5000, 1, 0.015 * v); },
      page(v, b) { const t = now(); const f = nz(b, t, 0.22, 'bandpass', 3400, 0.7, 0.05 * v, 0.003); f.frequency.linearRampToValueAtTime(1800, t + 0.2); },
      pour(v, b) { const t = now(); nz(b, t, 0.6, 'bandpass', 900, 3, 0.04 * v, 0.004); for (let i = 0; i < 6; i++) tn(b, t + i * 0.08, 0.04, 500 + i * 60, 'sine', 0.02 * v); },
      eat(v, b) { const t = now(); nz(b, t, 0.05, 'bandpass', 2200, 1.5, 0.07 * v); nz(b, t + 0.12, 0.04, 'bandpass', 1800, 1.5, 0.04 * v); },
      drink(v, b) { const t = now(); tn(b, t, 0.08, 300, 'sine', 0.06 * v, 180); tn(b, t + 0.25, 0.08, 280, 'sine', 0.05 * v, 170); },
      coins(v, b) { const t = now(); const n = 3 + Math.floor(Math.random() * 3); for (let i = 0; i < n; i++) { const tt = t + i * 0.07 + Math.random() * 0.03; for (const r of [1, 2.76, 5.4]) tn(b, tt, 0.25, (2400 + Math.random() * 500) * r / 2, 'sine', 0.03 * v / r); } },
      door(v, b) { const t = now(); const c = S.ctx, o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(240, t); o.frequency.linearRampToValueAtTime(330, t + 0.25); o.frequency.linearRampToValueAtTime(260, t + 0.45); const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 6; const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.025 * v, t + 0.05); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5); o.connect(bp); bp.connect(g); g.connect(b); o.start(t); o.stop(t + 0.55); tn(b, t + 0.55, 0.18, 90, 'triangle', 0.14 * v, 60); nz(b, t + 0.55, 0.08, 'lowpass', 700, 0.7, 0.06 * v); },
      whoosh(v, b) { const t = now(); const f = nz(b, t, 0.18, 'bandpass', 600, 1.5, 0.08 * v, 0.003); f.frequency.exponentialRampToValueAtTime(2400, t + 0.16); },
      smack(v, b) { const t = now(); nz(b, t, 0.07, 'lowpass', 1600, 0.7, 0.2 * v); tn(b, t, 0.08, 120, 'sine', 0.15 * v, 60); },
      place(v, b) { const t = now(); tn(b, t, 0.07, 220, 'triangle', 0.06 * v, 140); nz(b, t, 0.04, 'bandpass', 1500, 1, 0.03 * v); },
      crackle(v, b) { const t = now(); for (let i = 0; i < 5; i++) nz(b, t + Math.random() * 0.4, 0.015, 'highpass', 3000, 1, (0.02 + Math.random() * 0.04) * v); },
      handbell(v, b) { const t = now(); for (const [r, a] of [[1, 1], [2.4, 0.5], [3.9, 0.3], [5.1, 0.15]]) tn(b, t, 0.9 / Math.sqrt(r), 880 * r, 'sine', 0.05 * v * a); nz(b, t, 0.02, 'highpass', 4000, 1, 0.03 * v); },
      kaching(v, b) { const t = now(); for (let i = 0; i < 4; i++) { const tt = t + i * 0.05; for (const r of [1, 2.76, 5.4]) tn(b, tt, 0.3, (2600 + i * 180) * r / 2, 'sine', 0.035 * v / r); } for (const [f, a] of [[1760, 0.06], [2640, 0.035], [3520, 0.02]]) tn(b, t + 0.22, 0.7, f, 'sine', a * v); },
      handover(v, b) { const t = now(); nz(b, t, 0.08, 'bandpass', 1400, 0.9, 0.06 * v, 0.004); tn(b, t + 0.06, 0.06, 240, 'triangle', 0.05 * v, 160); },
      snip(v, b) { const t = now(); nz(b, t, 0.025, 'highpass', 5200, 2, 0.06 * v); nz(b, t + 0.09, 0.02, 'highpass', 6000, 2, 0.05 * v); },
      catch(v, b) { const t = now(); nz(b, t, 0.03, 'bandpass', 1200, 1.5, 0.05 * v); },
      cough(v, b) { const t = now(); nz(b, t, 0.12, 'bandpass', 700, 1.2, 0.08 * v); nz(b, t + 0.18, 0.1, 'bandpass', 650, 1.2, 0.06 * v); },
    };
    S.FX = FX;
    const play = (k, v, inScene) => { if (!ok() || !FX[k] || v < 0.02) return; try { FX[k](Math.min(1, v), busFor(inScene)); } catch (e) { /* */ } };
    O.sfx = play;

    // which movement makes which sound, and how often
    const BY_ANIM = { shear: ['snip', 0.42], ringbell: ['handbell', 0.34], juggle: ['catch', 0.28], chop: ['chop', 0.62], hoe: ['dig', 0.7], dig: ['dig', 0.7], saw: ['saw', 0.36], sweep: ['sweep', 0.55], scrub: ['scrub', 0.5], knead: ['knead', 0.6], cleave: ['cleave', 0.7], write: ['write', 0.6], read: ['page', 4], pour: ['pour', 1.6], eat: ['eat', 0.9], drink: ['drink', 1.2], count: ['coins', 1.2], attack: ['whoosh', 0.55], place: ['place', 1.2], pickup: ['place', 1.2], cough: ['cough', 1.4], pitch: ['dig', 0.8], cook: ['crackle', 0.8], mix: ['scrub', 0.7] };
    const surface = (w, x, y) => {
      if (game.scene) return 'wood'; const s = O.SimRef.cur; if (s && s.weather && s.weather.snowCover > 0.3) return 'snow';
      if (!w || !w.ter) return 'dirt'; const t = w.ter[Math.floor(y / T) * w.W + Math.floor(x / T)];
      return t === w.TER.COBBLE || t === w.TER.BRIDGE ? 'cobble' : t === w.TER.GRASS || t === w.TER.FOREST || t === w.TER.FIELD ? 'grass' : t === w.TER.WATER ? 'water' : 'dirt';
    };
    const last = new WeakMap();
    let stepT = 0, npcT = 0;
    game.hooks.update.push((dt) => {
      if (!ok()) return; const P = game.player, w = game.world, inScene = !!game.scene, t = performance.now() / 1000;
      // your feet (the old plain step is replaced by this)
      if (P.moving && !P.mount) { stepT -= dt; if (stepT <= 0) { stepT = game.keys && game.keys.has('run') ? 0.24 : 0.36; const sf = surface(w, P.x, P.y); play(sf === 'water' ? 'splash' : 'step_' + sf, sf === 'water' ? 0.4 : 0.9, inScene); } }
      // your work
      const a = BY_ANIM[P.anim]; if (a) { const l = last.get(P) || 0; if (t - l > a[1]) { last.set(P, t); play(a[0], 1, inScene); } }
      // theirs, near you
      npcT -= dt; if (npcT > 0) return; npcT = 0.12; const s = O.SimRef.cur; if (!s) return;
      const list = inScene ? [...game.scene.actors.values()].map((x) => ({ p: x.person, x: x.x, y: x.y, anim: x.anim || (x.person && x.person.agent.gest && x.person.agent.gest.until > performance.now() ? x.person.agent.gest.anim : x.person && x.person.agent.anim) })) : s.people.filter((q) => q.agent && !q.agent.hidden && q.agent.inside == null).map((q) => ({ p: q, x: q.agent.x, y: q.agent.y, anim: q.agent.gest && q.agent.gest.until > performance.now() ? q.agent.gest.anim : q.agent.forceAnim || q.agent.anim }));
      for (const z of list) {
        if (!z.p) continue; const d = Math.hypot(z.x - P.x, z.y - P.y); if (d > 220) continue; const v = 1 - d / 220;
        const b = BY_ANIM[z.anim]; if (b) { const l = last.get(z.p) || 0; if (t - l > b[1]) { last.set(z.p, t + Math.random() * 0.1); play(b[0], v * 0.8, inScene); } continue; }
        if ((z.anim === 'walk' || z.anim === 'run') && d < 120) { const l = last.get(z.p) || 0; if (t - l > (z.anim === 'run' ? 0.25 : 0.4)) { last.set(z.p, t); const sf = surface(w, z.x, z.y); if (sf !== 'water') play('step_' + sf, v * 0.35, inScene); } }
      }
    });
    // the old single footstep gives way to the surface-aware one
    if (S.V && S.V.step) { const _st = S.V.step; S.V.step = function () { /* handled by sfx.js */ }; S.V._oldStep = _st; }
    // coins as your purse changes
    let lastMoney = null;
    game.hooks.update.push(() => { const PS = O.PlayerState; if (lastMoney == null) { lastMoney = PS.money; return; } if (PS.money !== lastMoney) { if (Math.abs(PS.money - lastMoney) >= 1 && !(O._handingUntil > performance.now())) play('coins', Math.min(1, 0.5 + Math.abs(PS.money - lastMoney) / 40), !!game.scene); lastMoney = PS.money; } });
    // doors
    const _enter = game.enterBuilding.bind(game);
    game.enterBuilding = function (b, floor, fromStairs) { if (!fromStairs && !game.scene) play('door', 0.8, true); return _enter(b, floor, fromStairs); };
    if (game.exitBuilding) { const _exit = game.exitBuilding.bind(game); game.exitBuilding = function () { if (game.scene) play('door', 0.7, false); return _exit.apply(this, arguments); }; }
    // blows that land
    if (O.Combat && O.Combat.provoke) { const _pv = O.Combat.provoke; O.Combat.provoke = function (q, how) { if (how === 'fight') play('smack', 0.9, !!game.scene); return _pv.apply(this, arguments); }; }
  }
  O.SfxSetup = { setup };
})();
