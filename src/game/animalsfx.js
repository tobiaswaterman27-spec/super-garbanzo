// The beasts have voices. Each call is built like a voice: a throat (a buzzing oscillator with its own
// pitch contour, wobble and breath) shaped by a mouth (two or three resonant formants that open and
// close through the call), then a touch of air. Cows low, sheep and goats bleat with a tremble, pigs
// grunt and squeal, hens cluck and the cock crows at dawn, horses whinny and snort, dogs bark, cats mew,
// wolves howl on winter nights, owls hoot and crows caw. Near you, now and then, at their own times.
'use strict';
(function () {
  function setup(game) {
    const S = O.Sound; if (!S) return;
    const ok = () => S.on && S.ctx;
    // one voiced sound: f0 contour [[t, hz]...], formants [[t, [f1, f2, f3]]...], amplitude contour, wobble
    function voice(dest, t0, o) {
      const c = S.ctx, dur = o.dur;
      const osc = c.createOscillator(); osc.type = o.wave || 'sawtooth';
      osc.frequency.setValueAtTime(o.f0[0][1], t0); for (const [t, f] of o.f0.slice(1)) osc.frequency.linearRampToValueAtTime(f, t0 + t * dur);
      // tremble (sheep, goats) or roughness (pigs, crows)
      if (o.vib) { const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = o.vib[0]; lg.gain.value = o.vib[1]; lfo.connect(lg); lg.connect(osc.frequency); lfo.start(t0); lfo.stop(t0 + dur + 0.05); }
      const src = c.createGain(); src.gain.value = 1; osc.connect(src);
      if (o.am) { const am = c.createOscillator(), ag = c.createGain(); am.frequency.value = o.am[0]; ag.gain.value = o.am[1]; am.connect(ag); ag.connect(src.gain); am.start(t0); am.stop(t0 + dur + 0.05); }
      const out = c.createGain(); out.gain.setValueAtTime(0.0001, t0);
      for (const [t, a] of o.amp) out.gain.linearRampToValueAtTime(Math.max(0.0001, a * o.vol), t0 + t * dur);
      out.gain.linearRampToValueAtTime(0.0001, t0 + dur + 0.04);
      // the mouth: formant resonators in parallel
      const nF = o.form[0][1].length;
      for (let k = 0; k < nF; k++) {
        const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = o.q ? o.q[k] : [6, 9, 12][k];
        bp.frequency.setValueAtTime(o.form[0][1][k], t0); for (const [t, fs] of o.form.slice(1)) bp.frequency.linearRampToValueAtTime(fs[k], t0 + t * dur);
        const g = c.createGain(); g.gain.value = [1, 0.55, 0.3][k]; src.connect(bp); bp.connect(g); g.connect(out);
      }
      // breath on top
      if (o.breath) { const n = c.createBufferSource(); n.buffer = S.noise; const hp = c.createBiquadFilter(); hp.type = 'bandpass'; hp.frequency.value = o.breath[0]; hp.Q.value = 0.8; const ng = c.createGain(); ng.gain.value = o.breath[1]; n.connect(hp); hp.connect(ng); ng.connect(out); n.start(t0, Math.random()); n.stop(t0 + dur + 0.05); }
      osc.start(t0); osc.stop(t0 + dur + 0.08); out.connect(dest);
    }
    const r = (a, b) => a + Math.random() * (b - a);
    const CALLS = {
      cow: (d, t, v) => { const p = r(0.9, 1.15); voice(d, t, { dur: r(1.2, 1.8), vol: v * 0.5, f0: [[0, 98 * p], [0.25, 112 * p], [0.75, 104 * p], [1, 82 * p]], form: [[0, [280, 600, 2200]], [0.35, [520, 900, 2400]], [0.8, [380, 700, 2200]], [1, [300, 600, 2100]]], amp: [[0.08, 0.6], [0.3, 1], [0.8, 0.8], [1, 0.1]], breath: [700, 0.25], vib: [5, 2] }); },
      sheep: (d, t, v) => { const p = r(0.9, 1.2); voice(d, t, { dur: r(0.7, 1), vol: v * 0.42, f0: [[0, 330 * p], [0.2, 360 * p], [1, 300 * p]], form: [[0, [700, 1500, 2600]], [0.3, [800, 1700, 2800]], [1, [600, 1300, 2500]]], amp: [[0.05, 0.7], [0.25, 1], [0.85, 0.7], [1, 0.05]], am: [24, 0.55], vib: [24, 12], breath: [2000, 0.12] }); },
      goat: (d, t, v) => { const p = r(1, 1.3); voice(d, t, { dur: r(0.6, 0.9), vol: v * 0.42, f0: [[0, 420 * p], [0.3, 480 * p], [1, 380 * p]], form: [[0, [800, 1800, 3000]], [1, [700, 1500, 2700]]], amp: [[0.05, 0.8], [0.3, 1], [1, 0.05]], am: [30, 0.6], vib: [30, 18] }); },
      pig: (d, t, v) => { const n = 1 + Math.floor(r(1, 4)); for (let k = 0; k < n; k++) voice(d, t + k * r(0.22, 0.32), { dur: r(0.12, 0.2), vol: v * 0.45, f0: [[0, 140], [1, 110]], form: [[0, [400, 900, 2000]], [1, [300, 800, 1800]]], amp: [[0.1, 1], [1, 0.1]], am: [55, 0.8], breath: [500, 0.5], q: [4, 6, 8] }); if (Math.random() < 0.15) voice(d, t + 1, { dur: 0.5, vol: v * 0.3, f0: [[0, 700], [0.4, 1100], [1, 800]], form: [[0, [1200, 2400, 3500]], [1, [1100, 2200, 3200]]], amp: [[0.1, 1], [1, 0.1]], am: [40, 0.4] }); },
      chicken: (d, t, v) => { const n = 2 + Math.floor(r(1, 5)); for (let k = 0; k < n; k++) { const last = k === n - 1; voice(d, t + k * r(0.16, 0.24), { dur: last ? 0.32 : 0.09, vol: v * 0.32, wave: 'square', f0: last ? [[0, 620], [0.3, 900], [1, 560]] : [[0, 520], [1, 470]], form: [[0, [900, 2000, 3200]], [1, [800, 1800, 3000]]], amp: [[0.1, 1], [1, 0.05]], breath: [3000, 0.15] }); } },
      rooster: (d, t, v) => { const syl = [[0.18, 520, 600], [0.16, 620, 700], [0.18, 700, 820], [0.6, 820, 520]]; let tt = t; for (const [dd, a, b] of syl) { voice(d, tt, { dur: dd, vol: v * 0.27, wave: 'square', f0: [[0, a], [0.4, b], [1, b * 0.9]], form: [[0, [900, 2100, 3300]], [1, [800, 1900, 3000]]], amp: [[0.1, 1], [0.8, 0.9], [1, 0.05]], vib: [18, 10], breath: [3200, 0.18] }); tt += dd + 0.03; } },
      horse: (d, t, v) => { if (Math.random() < 0.5) { voice(d, t, { dur: r(0.25, 0.4), vol: v * 0.5, f0: [[0, 90], [1, 70]], form: [[0, [300, 800, 1600]], [1, [250, 700, 1500]]], amp: [[0.05, 1], [1, 0.05]], breath: [600, 1.4], am: [70, 0.9] }); return; } voice(d, t, { dur: r(1.1, 1.5), vol: v * 0.33, f0: [[0, 900], [0.15, 1100], [0.5, 700], [1, 380]], form: [[0, [1000, 2200, 3200]], [0.5, [800, 1800, 3000]], [1, [500, 1200, 2600]]], amp: [[0.05, 0.8], [0.2, 1], [0.8, 0.6], [1, 0.05]], vib: [14, 60], am: [14, 0.5], breath: [2500, 0.3] }); },
      dog: (d, t, v) => { const n = 1 + Math.floor(r(0, 3)); for (let k = 0; k < n; k++) voice(d, t + k * r(0.25, 0.4), { dur: 0.13, vol: v * 0.55, f0: [[0, 420], [0.3, 520], [1, 300]], form: [[0, [700, 1500, 2700]], [0.4, [1000, 1900, 2900]], [1, [600, 1300, 2500]]], amp: [[0.05, 1], [0.5, 0.7], [1, 0.05]], breath: [1500, 0.7] }); },
      cat: (d, t, v) => voice(d, t, { dur: r(0.6, 0.9), vol: v * 0.32, f0: [[0, 560], [0.4, 820], [1, 520]], form: [[0, [500, 1800, 3000]], [0.4, [1100, 2000, 3200]], [1, [700, 1600, 2800]]], amp: [[0.1, 0.7], [0.4, 1], [1, 0.05]], breath: [3000, 0.1] }),
      wolf: (d, t, v) => voice(d, t, { dur: r(2.2, 3.2), vol: v * 0.35, wave: 'triangle', f0: [[0, 330], [0.2, 520], [0.6, 560], [1, 380]], form: [[0, [500, 1200, 2400]], [0.5, [700, 1300, 2500]], [1, [400, 1000, 2300]]], amp: [[0.15, 0.8], [0.4, 1], [0.85, 0.8], [1, 0.05]], vib: [5, 7], breath: [1200, 0.08] }),
      owl: (d, t, v) => { for (const [dt, dur, f] of [[0, 0.32, 380], [0.55, 0.18, 360], [0.8, 0.5, 370]]) voice(d, t + dt, { dur, vol: v * 0.21, wave: 'sine', f0: [[0, f], [0.5, f * 1.04], [1, f * 0.95]], form: [[0, [400, 800, 1600]], [1, [380, 760, 1500]]], amp: [[0.25, 1], [0.7, 0.9], [1, 0.05]], q: [3, 4, 6] }); },
      crow: (d, t, v) => { const n = 2 + Math.floor(r(0, 3)); for (let k = 0; k < n; k++) voice(d, t + k * 0.42, { dur: 0.3, vol: v * 0.3, f0: [[0, 760], [0.3, 840], [1, 620]], form: [[0, [1200, 2200, 3200]], [1, [1000, 1900, 3000]]], amp: [[0.05, 1], [0.6, 0.8], [1, 0.05]], am: [80, 0.6], breath: [2200, 0.5], q: [4, 6, 8] }); },
      bear: (d, t, v) => voice(d, t, { dur: r(0.9, 1.3), vol: v * 0.4, f0: [[0, 70], [0.4, 85], [1, 60]], form: [[0, [300, 700, 1500]], [1, [250, 600, 1400]]], amp: [[0.1, 1], [1, 0.05]], am: [35, 0.7], breath: [500, 0.9] }),
      deer: (d, t, v) => voice(d, t, { dur: 0.5, vol: v * 0.25, f0: [[0, 600], [1, 450]], form: [[0, [900, 2000, 3000]], [1, [800, 1800, 2800]]], amp: [[0.1, 1], [1, 0.05]], breath: [2000, 0.3] }),
    };
    O.animalCall = (kind, vol = 0.8, inScene = false) => { if (!ok() || !CALLS[kind]) return; try { CALLS[kind](inScene ? S.inBus : S.outBus, S.ctx.currentTime + 0.02, vol); } catch (e) { /* */ } };
    // when they call: each kind its own rate; the cock at first light, wolves and owls at night
    const RATE = { cow: 0.02, sheep: 0.03, goat: 0.03, pig: 0.03, chicken: 0.05, dog: 0.02, cat: 0.008, horse: 0.012, wolf: 0.01, bear: 0.006, deer: 0.004 };
    const last = new WeakMap();
    let t0 = 0, crowed = -1, owlT = 30, crowT = 20;
    game.hooks.update.push((dt) => {
      if (!ok()) return; t0 += dt; if (t0 < 0.5) return; const step = t0; t0 = 0;
      const s = O.SimRef.cur, P = game.player; if (!s) return; const h = s.hour, night = h < 5 || h > 21, inScene = !!game.scene;
      for (const f of O.fauna || []) {
        if (f.world !== s.world.placeId || f.inBarn) continue; const d = Math.hypot(f.x - P.x, f.y - P.y); if (d > 320) continue;
        let rate = RATE[f.kind] || 0; if (night && !['wolf', 'dog'].includes(f.kind)) rate *= 0.15; if (f.kind === 'wolf' && !night) rate *= 0.1;
        if (Math.random() < rate * step && (performance.now() - (last.get(f) || 0)) > 6000) { last.set(f, performance.now()); O.animalCall(f.kind, (1 - d / 320) * (inScene ? 0.3 : 1), inScene); }
      }
      for (const hz of (O.Horses && O.Horses.horses) || []) { const d = Math.hypot(hz.x - P.x, hz.y - P.y); if (d < 260 && Math.random() < 0.01 * step) O.animalCall('horse', (1 - d / 260) * (inScene ? 0.3 : 0.9), inScene); }
      // the cock crows at first light, once or twice, wherever there are hens
      if (h >= 5 && h < 6.2 && crowed !== s.day && (O.fauna || []).some((f) => f.kind === 'chicken' && f.world === s.world.placeId)) { crowed = s.day; O.animalCall('rooster', inScene ? 0.3 : 0.7, inScene); setTimeout(() => O.animalCall('rooster', 0.5, !!game.scene), 4000); }
      // owls in the dark, crows by day, out among the trees
      owlT -= step; crowT -= step;
      if (night && owlT < 0) { owlT = 25 + Math.random() * 40; if (!inScene) O.animalCall('owl', 0.5); }
      if (!night && crowT < 0) { crowT = 30 + Math.random() * 60; if (!inScene && Math.random() < 0.6) O.animalCall('crow', 0.35); }
    });
  }
  O.AnimalSfxSetup = { setup };
})();
