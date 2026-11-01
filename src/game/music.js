// Music, all of it made here in code. A small consort of instruments, each synthesised to sound like the
// real thing: a plucked lute and a harp (struck strings that ring and fade as real ones do), a recorder
// with its breath and chiff, a fiddle with its bow and vibrato, a nasal shawm, a hurdy-gurdy drone, a
// tabor, handbells, and voices that sing real vowels. Rooms ring: the tavern a little, the chapel and the
// great hall a lot. Tunes are written in the old modes by a composer that knows the dances (jigs, reels,
// estampies, rounds), laments, carols, plainchant and marches, and it has written dozens of them, each
// with its own name. What plays depends on where you are and what's happening: dances in the tavern of
// an evening and at the fair, chant in the chapel, a stately air in the castle, a quiet tune on the road,
// a harp at night, drums when blows are struck. And when someone sings one of the land's songs, they sing
// its words to its own tune, fitted to the lyric, syllable by syllable.
'use strict';
(function () {
  const MODES = { ionian: [0, 2, 4, 5, 7, 9, 11], dorian: [0, 2, 3, 5, 7, 9, 10], phrygian: [0, 1, 3, 5, 7, 8, 10], lydian: [0, 2, 4, 6, 7, 9, 11], mixolydian: [0, 2, 4, 5, 7, 9, 10], aeolian: [0, 2, 3, 5, 7, 8, 10] };
  const VOWELS = { a: [800, 1150, 2900], e: [450, 1800, 2600], i: [320, 2200, 2900], o: [500, 900, 2700], u: [350, 700, 2500] };
  const rngOf = (seed) => { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 100000) / 100000; }; };
  const hashStr = (t) => { let h = 2166136261; for (const c of String(t)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };

  // ---------------------------------------------------------------- the styles the composer knows
  const STYLES = {
    jig: { meter: 6, beat: 0.17, modes: ['dorian', 'mixolydian', 'ionian'], lead: ['fiddle', 'recorder'], acc: 'lute', drum: [0, 3], drone: true, rhythm: [[1, 1, 1], [2, 1], [1, 2], [3]], bars: 8, form: 'AABB' },
    reel: { meter: 4, beat: 0.15, modes: ['dorian', 'mixolydian'], lead: ['fiddle'], acc: 'lute', drum: [0, 2], drone: true, rhythm: [[1, 1], [1, 1], [2], [1, 1]], bars: 8, form: 'AABB' },
    estampie: { meter: 3, beat: 0.32, modes: ['dorian', 'lydian', 'mixolydian'], lead: ['shawm', 'recorder'], acc: 'harp', drum: [0], drone: true, rhythm: [[2, 1], [1, 1, 1], [3]], bars: 8, form: 'ABAB' },
    round: { meter: 4, beat: 0.26, modes: ['ionian', 'mixolydian'], lead: ['recorder'], acc: 'lute', drum: [0], drone: false, rhythm: [[1, 1], [2], [1, 1]], bars: 8, form: 'AABA' },
    pastoral: { meter: 3, beat: 0.42, modes: ['dorian', 'ionian', 'lydian'], lead: ['recorder'], acc: 'lute', drum: null, drone: false, rhythm: [[2, 1], [3], [1, 1, 1]], bars: 8, form: 'AB' },
    lament: { meter: 3, beat: 0.5, modes: ['aeolian', 'dorian', 'phrygian'], lead: ['fiddle', 'voiceU'], acc: 'harp', drum: null, drone: true, rhythm: [[2, 1], [3], [1, 2]], bars: 8, form: 'AB' },
    nocturne: { meter: 3, beat: 0.55, modes: ['aeolian', 'dorian', 'lydian'], lead: ['harp'], acc: 'harp', drum: null, drone: false, rhythm: [[1, 1, 1], [3], [2, 1]], bars: 8, form: 'AB' },
    carol: { meter: 3, beat: 0.34, modes: ['ionian', 'mixolydian'], lead: ['recorder', 'voiceA'], acc: 'lute', drum: [0], drone: false, rhythm: [[2, 1], [1, 1, 1], [3]], bars: 8, form: 'AABB', bells: true },
    chant: { meter: 2, beat: 0.55, modes: ['dorian', 'phrygian', 'mixolydian'], lead: ['choir'], acc: null, drum: null, drone: false, rhythm: [[1, 1], [2]], bars: 8, form: 'AB', chant: true },
    march: { meter: 4, beat: 0.24, modes: ['dorian', 'phrygian'], lead: ['shawm'], acc: null, drum: [0, 1, 2, 3], drone: true, rhythm: [[1, 1], [2], [1, 1]], bars: 4, form: 'AABB' },
    sea: { meter: 6, beat: 0.26, modes: ['aeolian', 'dorian'], lead: ['fiddle', 'recorder'], acc: 'lute', drum: [0], drone: true, rhythm: [[2, 1], [3], [1, 1, 1]], bars: 8, form: 'AB' },
    wild: { meter: 4, beat: 0.4, modes: ['phrygian', 'aeolian'], lead: ['recorder'], acc: null, drum: null, drone: true, rhythm: [[2], [1, 1], [3, 1]], bars: 8, form: 'AB' },
  };
  const NAMES_A = ['The Miller\'s', 'The Ferryman\'s', 'Old Ashford', 'The Reeve\'s', 'Lady Margery\'s', 'The Shepherd\'s', 'The Pedlar\'s', 'Saint Brannoc\'s', 'The Green Wood', 'The King\'s', 'The Bell-ringer\'s', 'The Hayward\'s', 'Goldham', 'The Abbot\'s', 'The Weaver\'s', 'Kettleby', 'The Fowler\'s', 'The Black Hound', 'Moonday Morning', 'The Tinker\'s', 'Crossfield', 'The Widow\'s', 'The Fair Maid\'s', 'Highmere', 'The Plough Boy\'s', 'The Wren\'s', 'The Cooper\'s', 'Long Meadow', 'The Friar\'s', 'The Holly Bough'];
  const NAMES_B = { jig: 'Jig', reel: 'Reel', estampie: 'Estampie', round: 'Round', pastoral: 'Air', lament: 'Lament', nocturne: 'Nocturne', carol: 'Carol', chant: 'Chant', march: 'March', sea: 'Song of the Sea', wild: 'Lay' };
  // the tune itself: phrases in a mode, from a seed
  function compose(style, seed) {
    const st = STYLES[style], r = rngOf(seed), mode = st.modes[Math.floor(r() * st.modes.length)], tonic = [146.8, 164.8, 174.6, 196, 220][Math.floor(r() * 5)];
    const phrase = (start, endDeg, hi) => {
      const notes = []; let deg = start;
      for (let bar = 0; bar < 4; bar++) {
        const cell = st.rhythm[Math.floor(r() * st.rhythm.length)];
        const total = cell.reduce((a, b) => a + b, 0), scale = st.meter / total;
        cell.forEach((d, i) => {
          const last = bar === 3 && i === cell.length - 1;
          if (last) deg = endDeg; else if (!(bar === 0 && i === 0)) { const x = r(); deg += x < 0.38 ? 1 : x < 0.72 ? -1 : x < 0.8 ? 2 : x < 0.88 ? -2 : x < 0.94 ? 4 : -3; deg = Math.max(hi ? 2 : -2, Math.min(hi ? 10 : 8, deg)); }
          notes.push({ deg, d: d * scale, strong: i === 0 });
        });
      }
      return notes;
    };
    const A = [...phrase(r() < 0.5 ? 0 : 4, 4, false), ...phrase(2, 0, false)], B = [...phrase(r() < 0.5 ? 4 : 7, 4, true), ...phrase(5, 0, false)];
    const parts = st.form.split('').map((k) => (k === 'A' ? A : B));
    return { style, seed, mode, tonic, notes: [].concat(...parts), name: `${NAMES_A[seed % NAMES_A.length]} ${NAMES_B[style]}` };
  }
  const TRACKS = []; for (const style of Object.keys(STYLES)) for (let k = 0; k < 8; k++) TRACKS.push(compose(style, hashStr(style + k) % 9973 + k * 31));

  function setup(game) {
    const S = O.Sound; if (!S) return; const cur = () => O.SimRef.cur, PS = O.PlayerState;
    let level = 2; try { const v = localStorage.getItem('outlaw.music'); if (v != null) level = +v; } catch (e) { /* */ }
    const VOL = [0, 0.3, 0.6, 0.95];
    let ctx = null, bus, roomSend, hallSend, muffle, src, noise;
    const freqOf = (tune, deg, oct = 0) => { const M = MODES[tune.mode], o = Math.floor(deg / 7), k = ((deg % 7) + 7) % 7; return tune.tonic * Math.pow(2, (M[k] + 12 * (o + oct)) / 12); };
    function init() {
      if (!S.ctx) return false; if (ctx === S.ctx) return true; ctx = S.ctx; noise = S.noise;
      bus = ctx.createGain(); bus.gain.value = VOL[level]; bus.connect(S.master);
      const ir = (secs, decay) => { const len = Math.floor(ctx.sampleRate * secs), b = ctx.createBuffer(2, len, ctx.sampleRate); for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay) * (i < 40 ? i / 40 : 1); } return b; };
      const room = ctx.createConvolver(); room.buffer = ir(0.8, 3.2); const hall = ctx.createConvolver(); hall.buffer = ir(3.6, 2.4);
      roomSend = ctx.createGain(); roomSend.gain.value = 0.18; hallSend = ctx.createGain(); hallSend.gain.value = 0;
      roomSend.connect(room); hallSend.connect(hall); room.connect(bus); hall.connect(bus);
      const dry = ctx.createGain(); dry.connect(bus); dry.connect(roomSend); dry.connect(hallSend);
      muffle = ctx.createBiquadFilter(); muffle.type = 'lowpass'; muffle.frequency.value = 18000; muffle.connect(dry);
      src = ctx.createGain(); src.connect(muffle); return true;
    }
    const space = (kind) => { if (!ctx) return; const t = ctx.currentTime; roomSend.gain.setTargetAtTime(kind === 'room' ? 0.35 : kind === 'hall' ? 0.1 : 0.12, t, 0.3); hallSend.gain.setTargetAtTime(kind === 'hall' ? 0.55 : 0, t, 0.3); };
    const heard = (vol, muffled) => { if (!ctx) return; const t = ctx.currentTime; src.gain.setTargetAtTime(vol, t, 0.4); muffle.frequency.setTargetAtTime(muffled ? 900 : 18000, t, 0.3); };

    // ---------------------------------------------------------------- the instruments
    const ks = new Map();
    function strBuf(f, bright, dur) {
      const key = Math.round(f * 4) + ':' + bright; if (ks.has(key)) return ks.get(key);
      const sr = ctx.sampleRate, N = Math.floor(sr * dur), P = Math.max(2, Math.round(sr / f)), b = ctx.createBuffer(1, N, sr), d = b.getChannelData(0), ring = new Float32Array(P);
      for (let i = 0; i < P; i++) ring[i] = Math.random() * 2 - 1; for (let i = 1; i < P; i++) ring[i] = ring[i] * bright + ring[i - 1] * (1 - bright);
      const loss = f > 500 ? 0.993 : 0.996; let ix = 0;
      for (let i = 0; i < N; i++) { const a = ring[ix], nx = ring[(ix + 1) % P]; d[i] = a; ring[ix] = loss * 0.5 * (a + nx); ix = (ix + 1) % P; }
      for (let i = 0; i < 60; i++) d[i] *= i / 60; ks.set(key, b); return b;
    }
    const gainEnv = (dest, t, a, peak, hold, rel) => { const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a); g.gain.setValueAtTime(Math.max(0.0002, peak), t + a + hold); g.gain.exponentialRampToValueAtTime(0.0001, t + a + hold + rel); g.connect(dest); return g; };
    const osc = (type, f, t, end, dest, detune = 0) => { const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; o.detune.value = detune; o.connect(dest); o.start(t); o.stop(end); return o; };
    const vib = (o, t, rate, depth, delay = 0.15) => { const l = ctx.createOscillator(), g = ctx.createGain(); l.frequency.value = rate; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(o.frequency.value * depth, t + delay + 0.2); l.connect(g); g.connect(o.frequency); l.start(t); l.stop(t + 30); return l; };
    const noiseBand = (t, dur, f, q, peak, dest) => { const s = ctx.createBufferSource(); s.buffer = noise; s.loop = true; const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = q; const g = gainEnv(dest, t, 0.01, peak, Math.max(0, dur - 0.05), 0.06); s.connect(bp); bp.connect(g); s.start(t, Math.random()); s.stop(t + dur + 0.2); };
    const I = {
      lute(t, f, d, v, out) { const s = ctx.createBufferSource(); s.buffer = strBuf(f, 0.45, 2.2); const body = ctx.createBiquadFilter(); body.type = 'peaking'; body.frequency.value = 280; body.gain.value = 5; const g = ctx.createGain(); g.gain.value = 0.55 * v; s.connect(body); body.connect(g); g.connect(out); s.start(t); s.stop(t + 2.2); },
      harp(t, f, d, v, out) { const s = ctx.createBufferSource(); s.buffer = strBuf(f, 0.75, 3); const g = ctx.createGain(); g.gain.value = 0.45 * v; s.connect(g); g.connect(out); s.start(t); s.stop(t + 3); },
      recorder(t, f, d, v, out) {
        const g = gainEnv(out, t, 0.035, 0.12 * v, Math.max(0.02, d - 0.08), 0.07), lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = f * 5; lp.connect(g);
        const o = osc('sine', f, t, t + d + 0.2, lp); osc('triangle', f, t, t + d + 0.2, (() => { const h = ctx.createGain(); h.gain.value = 0.25; h.connect(lp); return h; })()); vib(o, t, 5.2, 0.004, 0.25);
        noiseBand(t, 0.05, f * 3, 4, 0.05 * v, out); noiseBand(t, d, f * 2, 6, 0.012 * v, out);
      },
      fiddle(t, f, d, v, out) {
        const g = gainEnv(out, t, 0.07, 0.07 * v, Math.max(0.02, d - 0.1), 0.12), bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 0.8;
        const pk = ctx.createBiquadFilter(); pk.type = 'peaking'; pk.frequency.value = 2600; pk.gain.value = 6; const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 4200;
        bp.connect(pk); pk.connect(lp); lp.connect(g); const o = osc('sawtooth', f, t, t + d + 0.3, bp); vib(o, t, 5.6, 0.006, 0.18); osc('sawtooth', f, t, t + d + 0.3, bp, 6);
        noiseBand(t, d, 3000, 2, 0.006 * v, out);
      },
      shawm(t, f, d, v, out) { const g = gainEnv(out, t, 0.03, 0.06 * v, Math.max(0.02, d - 0.06), 0.06), bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1300; bp.Q.value = 1.6; const pk = ctx.createBiquadFilter(); pk.type = 'peaking'; pk.frequency.value = 2800; pk.gain.value = 8; bp.connect(pk); pk.connect(g); const o = osc('square', f, t, t + d + 0.2, bp); osc('sawtooth', f, t, t + d + 0.2, bp, -5); vib(o, t, 6, 0.004, 0.2); },
      tabor(t, f, d, v, out) { noiseBand(t, 0.08, 700, 0.7, 0.18 * v, out); const g = gainEnv(out, t, 0.002, 0.25 * v, 0, 0.18), o = ctx.createOscillator(); o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(70, t + 0.15); o.connect(g); o.start(t); o.stop(t + 0.3); noiseBand(t, 0.03, 4500, 1, 0.05 * v, out); },
      bell(t, f, d, v, out) { for (const [r, a, dc] of [[1, 1, 2.5], [2, 0.5, 1.8], [2.4, 0.4, 1.4], [3, 0.3, 1], [4.2, 0.2, 0.7], [5.4, 0.12, 0.5]]) { const g = gainEnv(out, t, 0.002, 0.06 * a * v, 0, dc); osc('sine', f * r * 2, t, t + dc + 0.1, g); } },
      drone(t, f, d, v, out) { const g = gainEnv(out, t, 0.6, 0.03 * v, Math.max(0.1, d - 1), 0.8), lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700; lp.connect(g); osc('sawtooth', f / 2, t, t + d + 1, lp); osc('sawtooth', f * 0.75, t, t + d + 1, lp, 4); osc('sawtooth', f / 2, t, t + d + 1, lp, -7); },
      voice(t, f, d, v, out, vowel = 'a') {
        const F = VOWELS[vowel] || VOWELS.a, g = gainEnv(out, t, 0.06, 0.09 * v, Math.max(0.02, d - 0.1), 0.12), src0 = ctx.createGain(); src0.gain.value = 1;
        F.forEach((ff, k) => { const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = ff * (f > 260 ? 1.12 : 1); bp.Q.value = 9; const gg = ctx.createGain(); gg.gain.value = [1, 0.6, 0.25][k]; src0.connect(bp); bp.connect(gg); gg.connect(g); });
        const o = osc('sawtooth', f, t, t + d + 0.3, src0); vib(o, t, 5, 0.008, 0.25); noiseBand(t, 0.04, 4000, 1, 0.01 * v, out);
      },
      voiceU(t, f, d, v, out) { I.voice(t, f, d, v, out, 'u'); },
      voiceA(t, f, d, v, out) { I.voice(t, f, d, v, out, 'a'); },
      choir(t, f, d, v, out, vowel) { for (const [m, dt] of [[1, 0], [1, 9], [0.5, -6], [0.667, 3]]) I.voice(t + Math.random() * 0.02, f * m, d, v * 0.5, out, vowel || 'a'); },
    };

    // ---------------------------------------------------------------- playing a tune
    let perf = null; // { tune, gain, t0, i, events, loop, onEnd }
    function events(tune) {
      const st = STYLES[tune.style], out = []; let t = 0; const beat = st.beat;
      const leadName = st.lead[tune.seed % st.lead.length];
      for (const n of tune.notes) {
        const dur = n.d * beat; out.push({ t, inst: leadName, f: freqOf(tune, n.deg, leadName === 'choir' || leadName.startsWith('voice') ? 0 : 1), d: dur * 0.95, v: n.strong ? 1 : 0.8, vowel: st.chant ? 'aeiou'[(Math.floor(t * 3)) % 5] : undefined });
        if (n.strong && st.acc) { const root = n.deg >= 0 ? Math.floor(n.deg / 2) * 2 - (n.deg % 2 ? 2 : 0) : 0; for (const [k, dd] of [[0, 0], [2, 0.03], [4, 0.06]]) out.push({ t: t + dd, inst: st.acc, f: freqOf(tune, root + k, -1), d: dur, v: 0.45 }); }
        t += dur;
      }
      const total = t, barLen = st.meter * beat;
      if (st.drum) for (let b = 0; b * barLen < total; b++) for (const k of st.drum) out.push({ t: b * barLen + k * beat, inst: 'tabor', f: 0, d: 0.1, v: k === 0 ? 1 : 0.6 });
      if (st.drone) out.push({ t: 0, inst: 'drone', f: freqOf(tune, 0, 0), d: total, v: 1 });
      if (st.bells) for (let b = 0; b * barLen < total; b += 2) out.push({ t: b * barLen, inst: 'bell', f: freqOf(tune, b % 4 ? 4 : 0, 0), d: 1, v: 0.6 });
      out.sort((a, b) => a.t - b.t); out.total = total; return out;
    }
    function play(tune, opts = {}) {
      if (!init()) return; stop(0.8);
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, ctx.currentTime); g.gain.exponentialRampToValueAtTime(1, ctx.currentTime + 1.2); g.connect(src);
      perf = { tune, gain: g, t0: ctx.currentTime + 0.2, i: 0, ev: events(tune), loops: opts.loops || 1, onEnd: opts.onEnd, ctxKey: opts.key };
      if (O.Music.showNames) nowPlaying(tune.name);
    }
    function stop(fade = 1.5) { if (!perf || !ctx) return; const p = perf; perf = null; const t = ctx.currentTime; p.gain.gain.cancelScheduledValues(t); p.gain.gain.setValueAtTime(Math.max(0.0001, p.gain.gain.value), t); p.gain.gain.exponentialRampToValueAtTime(0.0001, t + fade); setTimeout(() => { try { p.gain.disconnect(); } catch (e) { /* */ } }, (fade + 0.5) * 1000); }
    function pump() {
      if (!perf || !ctx) return; const ahead = ctx.currentTime + 0.5;
      while (perf.i < perf.ev.length && perf.t0 + perf.ev[perf.i].t < ahead) { const e = perf.ev[perf.i++]; try { I[e.inst](Math.max(ctx.currentTime, perf.t0 + e.t), e.f, e.d, e.v, perf.gain, e.vowel); } catch (er) { console.error(er); } }
      if (perf.i >= perf.ev.length && ctx.currentTime > perf.t0 + perf.ev.total) { perf.loops--; if (perf.loops > 0) { perf.t0 += perf.ev.total + 0.3; perf.i = 0; } else { const f = perf.onEnd; perf = null; f && f(); } }
    }
    let label = null;
    function nowPlaying(name) {
      if (!label) { label = document.createElement('div'); label.style.cssText = 'position:fixed;left:14px;bottom:12px;font:12px monospace;color:#f3e9d2;text-shadow:0 1px 2px #000;opacity:0;transition:opacity 1.2s;pointer-events:none;z-index:5'; document.body.appendChild(label); }
      label.textContent = '♪ ' + name; label.style.opacity = '0.85'; clearTimeout(label._t); label._t = setTimeout(() => { label.style.opacity = '0'; }, 5000);
    }

    // ---------------------------------------------------------------- what plays, where
    const pickTrack = (style, salt) => { const list = TRACKS.filter((x) => x.style === style); return list[Math.abs(salt) % list.length]; };
    let lastKey = null, rest = 20, playedAt = 0;
    function want() {
      const s = cur(); if (!s) return null; const h = s.hour, P = game.player, sc = game.scene, W = s.weather || {};
      const fighting = performance.now() - (O.lastBlowAt || 0) < 8000;
      if (fighting) return { key: 'fight', style: 'march', space: sc ? 'room' : 'open', vol: 0.8, loop: 3, diegetic: false };
      if (sc) {
        const b = sc.b.parent || sc.b, t = b.type || '', bz = s.biz.get(b.id), type = (bz && bz.type) || t;
        if (type === 'tavern' && (h >= 17 || h < 1)) return { key: 'tavern', style: (s.day + Math.floor(h)) % 2 ? 'jig' : 'reel', space: 'room', vol: 0.9, loop: 2, diegetic: true };
        if (/chapel|church|abbey|priory|cathedral/.test(type)) return { key: 'chapel', style: 'chant', space: 'hall', vol: 0.7, loop: 2, diegetic: true };
        if (b.royal || /castle|keep|palace|hall|manor/.test(type)) return { key: 'castle', style: (s.day % 2) ? 'estampie' : 'pastoral', space: 'hall', vol: 0.6, loop: 1 };
        if (type === 'tavern') return { key: 'tavern-day', style: 'round', space: 'room', vol: 0.35, loop: 1, diegetic: true };
        return h >= 20 || h < 6 ? { key: 'home-night', style: 'nocturne', space: 'room', vol: 0.3, loop: 1 } : null;
      }
      // out of doors: a dance where there's merrymaking, the tavern spilling out of an evening
      const party = (s.npcEvents || []).find((e) => e.day === s.day && h >= e.from && h < e.to && (e.kind === 'dance' || e.kind === 'nameday' || e.party || e.fair)) || (O.festivalNow && O.festivalNow());
      if (party) return { key: 'party', style: 'jig', space: 'open', vol: 0.75, loop: 2, diegetic: true };
      const tv = s.world.buildings.find((b) => b.type === 'tavern'); if (tv && (h >= 18 || h < 1)) { const d = Math.hypot(tv.doorX * 16 - P.x, tv.doorY * 16 - P.y); if (d < 260) return { key: 'tavern-out', style: 'jig', space: 'open', vol: 0.5 * (1 - d / 260) + 0.05, loop: 2, muffled: true, diegetic: true }; }
      if (O.rowing && O.rowing()) return { key: 'sea', style: 'sea', space: 'open', vol: 0.45, loop: 1 };
      if (W.kind === 'rain' || W.kind === 'heavy' || W.kind === 'storm') return { key: 'rain', style: 'lament', space: 'open', vol: 0.4, loop: 1 };
      if (h >= 21 || h < 5) return { key: 'night', style: 'nocturne', space: 'open', vol: 0.35, loop: 1 };
      if (s.season === 'winter') return { key: 'winter', style: 'carol', space: 'open', vol: 0.4, loop: 1 };
      const w = game.world; const out = w.ox != null && Math.max(w.ox - P.x / 16, P.x / 16 - w.ox - w.townW, w.oy - P.y / 16, P.y / 16 - w.oy - w.townH, 0) > 10;
      return out ? { key: 'wild', style: (s.day % 3) ? 'pastoral' : 'wild', space: 'open', vol: 0.4, loop: 1 } : { key: 'town', style: ['pastoral', 'round', 'estampie'][s.day % 3], space: 'open', vol: 0.35, loop: 1 };
    }
    let dt0 = 0;
    game.hooks.update.push((dt) => {
      pump(); if (game.player.anim === 'attack' || (game.player.hurtT || 0) > 0) O.lastBlowAt = performance.now(); dt0 -= dt; if (dt0 > 0) return; dt0 = 1;
      if (!S.on || level === 0 || !init()) { if (perf) stop(1); return; }
      if (singing) return;
      const w = want(); if (!w) { if (perf) stop(2.5); lastKey = null; return; }
      space(w.space); heard(w.vol, !!w.muffled);
      if (perf && w.key === lastKey) return;
      if (perf && w.key !== lastKey) { stop(2); rest = w.diegetic ? 0.5 : 2; }
      lastKey = w.key; rest -= 1; if (rest > 0) return;
      const s = cur(); play(pickTrack(w.style, s.day * 7 + Math.floor(performance.now() / 60000)), { loops: w.loop, key: w.key, onEnd: () => { rest = w.diegetic ? 2 : 35 + Math.random() * 60; lastKey = null; } });
    });

    // ---------------------------------------------------------------- the land's songs, sung to their own tunes
    const syll = (word) => { const w = word.toLowerCase().replace(/[^a-z']/g, ''); if (!w) return []; const groups = w.replace(/e$/, '').match(/[aeiouy]+/g) || ['e']; return groups.map((g) => (g[0] === 'y' ? 'i' : g[0])); };
    const moodOf = (song) => { const t = (song.title + ' ' + song.lines.join(' ')).toLowerCase(); return /sorrow|weep|grave|die|dead|cold|alone|lost|mourn|tears|lament/.test(t) ? 'sad' : /ale|drink|merry|dance|jug|feast|cheer|night away/.test(t) ? 'merry' : 'plain'; };
    O.songTune = (song) => {
      const seed = hashStr(song.title || song.lines[0]), r = rngOf(seed), mood = moodOf(song), mode = mood === 'sad' ? 'aeolian' : mood === 'merry' ? 'mixolydian' : ['dorian', 'ionian'][seed % 2];
      const beat = mood === 'sad' ? 0.36 : mood === 'merry' ? 0.2 : 0.27; const tunes = {};
      return song.lines.map((line, li) => {
        const sy = []; for (const w of line.split(/\s+/)) syll(w).forEach((v, k) => sy.push({ v, first: k === 0 }));
        const key = li % 2; const r2 = rngOf(seed + key * 101 + sy.length); let deg = key ? 4 : 0; const notes = [];
        sy.forEach((x, i) => { const strong = i % 2 === (sy.length % 2 ? 0 : 1); if (i) { const a = r2(); deg += a < 0.4 ? 1 : a < 0.75 ? -1 : a < 0.85 ? 2 : -2; deg = Math.max(-2, Math.min(8, deg)); } if (i === sy.length - 1) deg = li % 2 ? 0 : 4; notes.push({ deg, d: (i === sy.length - 1 ? 3 : strong ? 2 : 1) * beat, v: x.v, strong }); });
        tunes[key] = tunes[key] || notes; return { line, notes, mode, beat };
      });
    };
    let singing = false;
    O.Music = {
      get level() { return level; }, setLevel(v) { level = v; try { localStorage.setItem('outlaw.music', String(v)); } catch (e) { /* */ } if (bus) bus.gain.setTargetAtTime(VOL[level], ctx.currentTime, 0.3); if (!level) stop(0.5); },
      // a royal fanfare: shawms in fourths and fifths over a rolling tabor
      fanfare() {
        if (!init() || !S.on || level === 0) return; stop(0.3); space(game.scene ? 'hall' : 'open'); heard(1, false);
        const g = ctx.createGain(); g.gain.value = 1.2; g.connect(src); let t = ctx.currentTime + 0.1; const N = [[392, 0.18], [392, 0.18], [392, 0.18], [523, 0.55], [392, 0.18], [523, 0.18], [659, 0.7], [587, 0.25], [523, 0.25], [659, 0.25], [784, 1.2]];
        for (const [f, d] of N) { I.shawm(t, f, d * 0.92, 1, g); I.shawm(t, f * 0.75, d * 0.92, 0.6, g); t += d; }
        for (let k = 0; k < 14; k++) I.tabor(ctx.currentTime + 0.1 + k * 0.12, 0, 0.1, k % 4 ? 0.5 : 1, g);
        setTimeout(() => { try { g.disconnect(); } catch (e) { /* */ } }, (t - ctx.currentTime + 2) * 1000);
      },
      tracks: TRACKS, play: (name) => { const t = TRACKS.find((x) => x.name === name) || TRACKS[0]; play(t, { loops: 1 }); }, stop, showNames: true,
      sing(q, song, chorus) {
        if (!song || !init()) return; const s = cur(), P = game.player; const tune = O.songTune(song), tonic = q.sex === 'f' ? 293.7 : 146.8, M = MODES[tune[0].mode];
        const pos = game.scene ? game.scene.personPos(q) : [q.agent.x, q.agent.y]; const d = pos ? Math.hypot(pos[0] - P.x, pos[1] - P.y) : 999; const vol = Math.max(0.05, 1 - d / 360);
        stop(1); singing = true; space(game.scene ? 'room' : 'open'); heard(vol, false);
        const g = ctx.createGain(); g.gain.value = 1; g.connect(src); let t = ctx.currentTime + 0.4, delay = 0.4;
        tune.forEach((ln, li) => {
          const lineStart = delay; setTimeout(() => { O.Speech && O.Speech.say(q, '♪ ' + ln.line + ' ♪', ln.notes.reduce((a, n) => a + n.d, 0) + 0.6); O.gesture && O.gesture(q, 'dance', 1.5); if (li === tune.length - 1) for (const z of chorus || []) O.Speech && O.Speech.say(z, '♪ ' + ln.line + ' ♪', 3); }, lineStart * 1000);
          for (const n of ln.notes) {
            const o = Math.floor(n.deg / 7), k = ((n.deg % 7) + 7) % 7, f = tonic * Math.pow(2, (M[k] + 12 * o) / 12);
            I.voice(t, f, n.d * 0.92, 1, g, n.v); if (n.strong) I.lute(t, f / 2, n.d, 0.5, g);
            if (li === tune.length - 1) for (const z of (chorus || []).slice(0, 3)) I.voice(t + 0.01, z.sex === 'f' ? f * (q.sex === 'f' ? 1 : 2) : f * (q.sex === 'f' ? 0.5 : 1), n.d * 0.92, 0.6, g, n.v);
            t += n.d;
          }
          const len = ln.notes.reduce((a, n) => a + n.d, 0); t += 0.35; delay += len + 0.35;
        });
        setTimeout(() => { singing = false; try { g.disconnect(); } catch (e) { /* */ } }, (delay + 1) * 1000);
      },
      hum(q, song) {
        if (!song || !S.on || level === 0 || !init() || singing) return; const P = game.player, d = Math.hypot(q.agent.x - P.x, q.agent.y - P.y); if (d > 220) return;
        const ln = O.songTune(song)[0], tonic = q.sex === 'f' ? 293.7 : 146.8, M = MODES[ln.mode], g = ctx.createGain(); g.gain.value = 0.5 * (1 - d / 220); g.connect(bus);
        let t = ctx.currentTime + 0.1; for (const n of ln.notes) { const o = Math.floor(n.deg / 7), k = ((n.deg % 7) + 7) % 7; I.voice(t, tonic * Math.pow(2, (M[k] + 12 * o) / 12), n.d * 0.9, 0.7, g, 'u'); t += n.d; }
        setTimeout(() => { try { g.disconnect(); } catch (e) { /* */ } }, (t - ctx.currentTime + 1) * 1000);
      },
    };
  }
  O.MusicSetup = { setup, TRACKS, STYLES };
})();
