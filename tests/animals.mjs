import { start } from './lib.mjs';
const { p, done } = await start();
const res = await p.evaluate(async () => {
  if (!O.Sound.on) O.AudioToggle(); await new Promise(r => setTimeout(r, 300));
  const S = O.Sound, an = S.ctx.createAnalyser(); an.fftSize = 2048; S.outBus.connect(an); const buf = new Float32Array(2048); const out = {};
  for (const k of ['cow', 'sheep', 'goat', 'pig', 'chicken', 'rooster', 'horse', 'dog', 'cat', 'wolf', 'owl', 'crow', 'bear', 'deer']) {
    O.animalCall(k, 1); let peak = 0; const t0 = performance.now(); while (performance.now() - t0 < 900) { await new Promise(r => setTimeout(r, 30)); an.getFloatTimeDomainData(buf); for (const v of buf) peak = Math.max(peak, Math.abs(v)); }
    out[k] = peak.toFixed(3); await new Promise(r => setTimeout(r, 1500)); }
  return JSON.stringify(out);
});
console.log(res); await done();
