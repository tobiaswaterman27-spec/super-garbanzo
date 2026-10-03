// Controlled palettes: every material is a 5-step hue-shifted ramp.
//   0 deep shadow / ambient occlusion
//   1 shadow
//   2 base
//   3 light
//   4 highlight
// Shadows drift toward cool violet, highlights toward warm yellow, which is what gives
// hand-made pixel art its depth instead of flat "darker/lighter" shading.
'use strict';
(function () {
  const hexToRgb = (hex) => {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const rgbToHsl = ([r, g, b]) => {
    r /= 255; g /= 255; b /= 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    let h = 0, s = 0; const l = (mx + mn) / 2;
    if (mx !== mn) {
      const d = mx - mn;
      s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
      if (mx === r) h = (g - b) / d + (g < b ? 6 : 0);
      else if (mx === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60;
    }
    return [h, s, l];
  };
  const hslToRgb = (h, s, l) => {
    h = ((h % 360) + 360) % 360;
    const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2;
    let r = 0, g = 0, b = 0;
    if (h < 60) [r, g, b] = [c, x, 0]; else if (h < 120) [r, g, b] = [x, c, 0];
    else if (h < 180) [r, g, b] = [0, c, x]; else if (h < 240) [r, g, b] = [0, x, c];
    else if (h < 300) [r, g, b] = [x, 0, c]; else [r, g, b] = [c, 0, x];
    return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
  };
  const shiftHue = (h, target, amt) => {
    let d = ((target - h + 540) % 360) - 180;
    return h + d * amt;
  };

  // Build a ramp from a base hex colour. `contrast` widens the light spread (metal ~1.5, cloth ~0.9).
  function makeRamp(hex, contrast = 1, satBoost = 0) {
    const [h, s, l] = rgbToHsl(hexToRgb(hex));
    const steps = [-0.27, -0.14, 0, 0.1, 0.19];
    const out = [];
    for (let i = 0; i < 5; i++) {
      const dl = steps[i] * contrast;
      const t = i < 2 ? (2 - i) / 2 : i > 2 ? (i - 2) / 2 : 0;
      let hh = h, ss = s + satBoost, ll = l + dl;
      if (i < 2) { hh = shiftHue(h, 255, 0.10 * t + (s < 0.15 ? 0.25 * t : 0)); ss = s + (s > 0.45 ? -0.12 * t : 0.06 * t); }
      if (i > 2) { hh = shiftHue(h, 50, 0.08 * t); ss = s - 0.06 * t; }
      ll = O.clamp(ll, 0.04, 0.97); ss = O.clamp(ss, 0, 1);
      out.push(hslToRgb(hh, ss, ll));
    }
    // outline: darker than deep shadow, slightly violet; and a softer "lit side" outline variant
    // Outlines are pulled toward one shared deep ink so every sprite in the world reads as one set.
    const INK = [27, 20, 36];
    const mix = (c, t) => c.map((v, k) => Math.round(v * (1 - t) + INK[k] * t));
    out.outline = mix(out[0], 0.72);
    out.outlineLit = mix(out[0], 0.5);
    return out;
  }

  // Material registry: id -> ramp. Ids are small integers so raster buffers stay typed arrays.
  const mats = [], matIndex = new Map();
  function mat(hex, kind = 'cloth') {
    const key = hex + kind;
    if (matIndex.has(key)) return matIndex.get(key);
    const contrast = kind === 'metal' ? 1.6 : kind === 'skin' ? 0.85 : kind === 'hair' ? 1.05 : kind === 'wood' ? 1.0 : 0.95;
    const r = makeRamp(hex, contrast, kind === 'skin' ? 0.03 : 0);
    r.kind = kind;
    r.hex = hex;
    const id = mats.length;
    mats.push(r);
    matIndex.set(key, id);
    return id;
  }
  const rgbStr = (c, a = 1) => (a === 1 ? `rgb(${c[0]},${c[1]},${c[2]})` : `rgba(${c[0]},${c[1]},${c[2]},${a})`);

  O.Pal = {
    hexToRgb, rgbToHsl, hslToRgb, makeRamp, mat, mats, rgbStr,
    ramp: (id) => mats[id],
    col: (id, shade) => rgbStr(mats[id][O.clamp(shade, 0, 4)]),
    // Medieval dye/cloth palette: what real dyes could produce, more saturated pigments = wealthier.
    cloth: {
      linen: '#d9cfb4', undyed: '#b9a888', wool: '#8f8a7e', greyWool: '#6d6c6a', brown: '#7a5634',
      darkBrown: '#4f3a28', russet: '#8e4a2b', ochre: '#b98a3a', mustard: '#c4a136', madder: '#a8382f',
      crimson: '#8f1f2c', woad: '#3f5f8e', navy: '#2c3a5e', teal: '#2f6b68', forest: '#3d5e34', olive: '#6b6d38',
      sage: '#879272', black: '#2a2630', purple: '#5e3672', plum: '#6e2f4f', white: '#e9e4d6', rose: '#b86a72',
      sky: '#6f93b8', leather: '#6d4a2c', darkLeather: '#463022', tan: '#a07648',
    },
    skin: ['#f6d7c0', '#eec3a2', '#e0ac85', '#c98f68', '#ad7550', '#8c5a3c', '#6b4330', '#4e3125'],
    hair: {
      black: '#262024', darkBrown: '#3f2c22', brown: '#664229', chestnut: '#7e4a2a', auburn: '#8f3f24',
      ginger: '#b85f2c', blonde: '#d0a75a', lightBlonde: '#e3c98c', ashBrown: '#7c6a58', grey: '#9a9692', white: '#dedad4',
    },
    eyes: { brown: '#5a3820', darkBrown: '#2f2018', blue: '#4a78b0', green: '#4e7d46', hazel: '#7a6630', grey: '#6f7a84' },
    metal: { iron: '#8a8f98', steel: '#a5adb8', darkIron: '#5c5f66', brass: '#b8913e', gold: '#d8ad3c', silver: '#c9ced6', copper: '#b06a3e' },
    wood: { oak: '#8a6239', pine: '#a8834f', dark: '#5a3d26', walnut: '#6b4a30', ash: '#b29a72', weathered: '#8a7a68' },
  };
})();
