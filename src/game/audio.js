// Procedural audio: no sound files, everything synthesised with WebAudio so it can follow the
// simulation. Ambient beds (wind, rain, crowd murmur, fire crackle) are filtered noise whose levels
// track the weather and who is nearby; point sounds (the smith's hammer, the chapel bell, birds,
// crickets, the dawn rooster, hoofbeats, footsteps, blows) are short synth voices placed in the
// world and attenuated by distance. Outdoor sound is muffled when you are indoors.
'use strict';
(function () {
  function setup(game, sim) {
    let ctx = null, master, outBus, outFilter, inBus, noise, beds = {}, enabled = false;
    const pref = (() => { try { return localStorage.getItem('outlaw.sound') === 'on'; } catch (e) { return false; } })();
    const btn = { textContent: '', setAttribute() {} }; // sound is toggled from the pause menu

    function start() {
      if (ctx) { ctx.resume(); return; }
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain(); master.gain.value = 0.55; master.connect(ctx.destination);
      outFilter = ctx.createBiquadFilter(); outFilter.type = 'lowpass'; outFilter.frequency.value = 18000; outFilter.connect(master);
      outBus = ctx.createGain(); outBus.connect(outFilter);
      inBus = ctx.createGain(); inBus.connect(master);
      const len = ctx.sampleRate * 2; noise = ctx.createBuffer(1, len, ctx.sampleRate); const d = noise.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      const bed = (bus, type, freq, q) => { const src = ctx.createBufferSource(); src.buffer = noise; src.loop = true; const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q; const g = ctx.createGain(); g.gain.value = 0; src.connect(f); f.connect(g); g.connect(bus); src.start(); return { g, f }; };
      beds.wind = bed(outBus, 'bandpass', 380, 0.6);
      beds.rain = bed(outBus, 'highpass', 1800, 0.4);
      beds.crowd = bed(outBus, 'bandpass', 720, 1.4);
      beds.fire = bed(inBus, 'lowpass', 1400, 0.5);
      beds.room = bed(inBus, 'bandpass', 600, 1.2);
    }
    function setEnabled(v) {
      enabled = v; btn.textContent = v ? 'Sound: on' : 'Sound: off'; btn.setAttribute('aria-pressed', String(v));
      try { localStorage.setItem('outlaw.sound', v ? 'on' : 'off'); } catch (e) { /* ignore */ }
      if (v) start(); else if (ctx) ctx.suspend();
    }
    O.AudioToggle = () => setEnabled(!enabled);
    // sound can only begin after the player interacts; honour a remembered preference then
    const kick = () => { if (pref && !enabled) setEnabled(true); window.removeEventListener('keydown', kick); window.removeEventListener('pointerdown', kick); };
    window.addEventListener('keydown', kick); window.addEventListener('pointerdown', kick);

    // ---- voices ----
    const now = () => ctx.currentTime;
    function env(g, t, a, peak, decay) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + decay); }
    function tone(bus, freq, type, peak, decay, t = now(), detune = 0) { const o = ctx.createOscillator(); o.type = type; o.frequency.value = freq; o.detune.value = detune; const g = ctx.createGain(); o.connect(g); g.connect(bus); env(g, t, 0.005, peak, decay); o.start(t); o.stop(t + decay + 0.05); return o; }
    function burst(bus, type, freq, peak, decay, t = now()) { const s = ctx.createBufferSource(); s.buffer = noise; s.playbackRate.value = 0.8 + Math.random() * 0.4; const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; const g = ctx.createGain(); s.connect(f); f.connect(g); g.connect(bus); env(g, t, 0.003, peak, decay); s.start(t, Math.random()); s.stop(t + decay + 0.05); }
    const V = {
      bell(strikes, vol) { for (let i = 0; i < strikes; i++) { const t = now() + i * 1.6; for (const [r, a] of [[1, 1], [2, 0.5], [2.4, 0.35], [3, 0.25], [4.2, 0.15]]) tone(outBus, 196 * r, 'sine', 0.18 * a * vol, 3.2, t); } },
      hammer(vol, bus = outBus) { const t = now(); for (const [f, a] of [[1180, 1], [1730, 0.6], [2650, 0.4]]) tone(bus, f, 'sine', 0.12 * a * vol, 0.22, t); burst(bus, 'highpass', 3000, 0.08 * vol, 0.04, t); },
      bird(vol) { const t0 = now(), n = 2 + Math.floor(Math.random() * 3), base = 2200 + Math.random() * 1500; for (let i = 0; i < n; i++) { const t = t0 + i * 0.12; const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(base, t); o.frequency.exponentialRampToValueAtTime(base * 1.5, t + 0.07); const g = ctx.createGain(); o.connect(g); g.connect(outBus); env(g, t, 0.01, 0.05 * vol, 0.08); o.start(t); o.stop(t + 0.12); } },
      cricket(vol) { const t0 = now(); for (let i = 0; i < 6; i++) tone(outBus, 4600, 'square', 0.012 * vol, 0.025, t0 + i * 0.05); },
      rooster(vol) { const t = now(); const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(520, t); o.frequency.linearRampToValueAtTime(760, t + 0.25); o.frequency.linearRampToValueAtTime(700, t + 0.7); o.frequency.linearRampToValueAtTime(480, t + 1.1); const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1400; f.Q.value = 2; const g = ctx.createGain(); o.connect(f); f.connect(g); g.connect(outBus); env(g, t, 0.05, 0.08 * vol, 1.1); o.start(t); o.stop(t + 1.3); },
      hoof(vol) { burst(outBus, 'lowpass', 500, 0.16 * vol, 0.07); },
      step(vol, bus = outBus) { burst(bus, 'bandpass', 900, 0.03 * vol, 0.05); },
      thud(vol) { tone(outBus, 90, 'sine', 0.3 * vol, 0.18); burst(outBus, 'lowpass', 1200, 0.15 * vol, 0.08); },
      pluck(freq, vol, bus = outBus) { tone(bus, freq, 'triangle', 0.08 * vol, 0.9); tone(bus, freq * 2, 'sine', 0.02 * vol, 0.4); },
    };
    const SCALE = [196, 220, 246.9, 261.6, 293.7, 329.6, 349.2, 392]; // D dorian-ish on a lute
    const TUNE = [0, 2, 4, 5, 4, 2, 3, 1, 0, 4, 7, 5, 4, 2, 1, 0];
    let tunePos = 0, tuneT = 0, birdT = 0, hammerT = 0, stepT = 0, lastHour = -1, cricketT = 0;

    const dist = (x, y) => Math.hypot(x - game.player.x, y - game.player.y);
    const near = (d, range) => Math.pow(O.clamp(1 - d / range, 0, 1), 2);
    const B = (type) => sim.world.buildings.find((b) => b.type === type);
    const doorPos = (b) => [b.doorX * 16 + 8, b.doorY * 16];

    game.hooks.update.push((dt) => {
      if (!enabled || !ctx) return;
      const t = now(), W = sim.weather, h = sim.hour, inside = game.scene ? game.scene.b : null;
      outFilter.frequency.setTargetAtTime(inside ? 700 : 18000, t, 0.2);
      outBus.gain.setTargetAtTime(inside ? 0.5 : 1, t, 0.2);
      beds.wind.g.gain.setTargetAtTime(0.04 + W.wind * 0.12, t, 1);
      beds.rain.g.gain.setTargetAtTime(W.raining ? 0.05 + W.intensity() * 0.12 : 0, t, 1.5);
      const crowd = inside ? 0 : sim.people.filter((p) => !p.agent.hidden && dist(p.agent.x, p.agent.y) < 140).length;
      beds.crowd.g.gain.setTargetAtTime(Math.min(0.08, crowd * 0.006), t, 0.8);
      // indoors: a fire if there is one; a busy room murmurs
      const fire = inside && game.scene.L.items.some((i) => i.kind === 'fireplace' || i.kind === 'oven' || i.kind === 'forge');
      beds.fire.g.gain.setTargetAtTime(fire ? 0.02 + Math.random() * 0.03 : 0, t, 0.05);
      beds.room.g.gain.setTargetAtTime(inside ? Math.min(0.07, game.scene.actors.size * 0.008) : 0, t, 0.6);
      // the chapel bell strikes the hour (from 6 in the morning to 9 at night)
      const hr = Math.floor(h);
      if (hr !== lastHour) { lastHour = hr; if (hr >= 6 && hr <= 21 && game.clock.speed <= 10) { const c = B('chapel'); if (c) { const [x, y] = doorPos(c); V.bell(hr > 12 ? hr - 12 : hr, Math.max(0.25, near(dist(x, y), 1400))); } } if (hr === 6) V.rooster(0.8); }
      if (game.clock.speed > 10) return;
      // the smith at the anvil
      hammerT -= dt;
      const sm = B('smithy'), smith = sm && sim.people.find((p) => p.job?.role === 'blacksmith' && p.agent.inside === sm.id && p.activity?.act === 'work');
      if (smith && hammerT <= 0) { hammerT = 0.7 + Math.random() * 0.3; const v = inside === sm ? 1 : inside ? 0 : near(dist(...doorPos(sm)), 420); if (v > 0.01) V.hammer(v, inside === sm ? inBus : outBus); }
      // tavern music in the evening
      const tv = B('tavern');
      if (tv && h >= 18 && h < 23.5) { tuneT -= dt; if (tuneT <= 0) { tuneT = 0.32; const v = inside === tv ? 0.9 : inside ? 0 : near(dist(...doorPos(tv)), 300) * 0.6; if (v > 0.01) V.pluck(SCALE[TUNE[tunePos % TUNE.length]], v, inside === tv ? inBus : outBus); tunePos++; } }
      // birds by day, crickets by night
      if (!inside && !W.raining) {
        birdT -= dt; if (h > 5.5 && h < 19.5 && birdT <= 0) { birdT = 1.5 + Math.random() * 4; V.bird(0.6 + Math.random() * 0.4); }
        cricketT -= dt; if ((h > 20.5 || h < 4.5) && sim.season !== 'winter' && cricketT <= 0) { cricketT = 0.6 + Math.random() * 1.2; V.cricket(0.7); }
      }
      // feet and hooves
      if (game.player.moving) { stepT -= dt; if (stepT <= 0) { if (game.player.mount) { stepT = game.player.galloping ? 0.13 : 0.24; V.hoof(0.8); } else { stepT = game.keys.has('run') ? 0.2 : 0.32; V.step(1, inside ? inBus : outBus); } } }
    });
    O.Sound = { V, play: (k, ...a) => enabled && ctx && V[k] && V[k](...a), get on() { return enabled; } };
  }
  O.AudioSetup = { setup };
})();
