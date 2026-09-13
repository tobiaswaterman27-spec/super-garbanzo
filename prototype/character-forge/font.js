/* font.js — crisp pixel text.
 *
 * Canvas text is anti-aliased, which turns to mush once the low-res buffer is
 * scaled up. So each glyph is rasterised once, thresholded to a 1-bit mask and
 * cached; drawing is then a straight pixel blit with no grey fringe anywhere.
 */
(function (global) {
  'use strict';

  const FAMILY = '"Silkscreen", "Courier New", monospace';
  const CELL_H = 11;
  const BASELINE = 8;
  const SIZE = 8;

  const glyphs = new Map();
  let scratch = null;
  let sctx = null;
  let ready = false;

  function ensureScratch() {
    if (scratch) return;
    scratch = document.createElement('canvas');
    scratch.width = 24;
    scratch.height = CELL_H;
    sctx = scratch.getContext('2d', { willReadFrequently: true });
  }

  function buildGlyph(ch) {
    ensureScratch();
    sctx.setTransform(1, 0, 0, 1, 0, 0);
    sctx.clearRect(0, 0, scratch.width, scratch.height);
    sctx.font = SIZE + 'px ' + FAMILY;
    sctx.textBaseline = 'alphabetic';
    sctx.fillStyle = '#fff';
    sctx.fillText(ch, 1, BASELINE);

    const advance = Math.max(1, Math.round(sctx.measureText(ch).width));
    const w = Math.min(scratch.width, advance + 3);
    const data = sctx.getImageData(0, 0, w, CELL_H).data;
    const mask = new Uint8Array(w * CELL_H);
    for (let i = 0; i < w * CELL_H; i++) {
      // Threshold rather than blend: a pixel is either on or it is not.
      mask[i] = data[i * 4 + 3] > 110 ? 1 : 0;
    }
    const g = { w: w, h: CELL_H, mask: mask, advance: advance };
    glyphs.set(ch, g);
    return g;
  }

  function glyph(ch) {
    let g = glyphs.get(ch);
    if (!g) g = buildGlyph(ch);
    return g;
  }

  function measure(text) {
    let x = 0;
    for (let i = 0; i < text.length; i++) x += glyph(text[i]).advance;
    return x;
  }

  function draw(target, text, x, y, colour) {
    let cx = Math.round(x);
    const cy = Math.round(y);
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      const g = glyph(ch);
      if (ch !== ' ') {
        for (let gy = 0; gy < g.h; gy++) {
          const ty = cy + gy;
          if (ty < 0 || ty >= target.h) continue;
          const trow = ty * target.w;
          const grow = gy * g.w;
          for (let gx = 0; gx < g.w; gx++) {
            if (!g.mask[grow + gx]) continue;
            const tx = cx + gx;
            if (tx < 0 || tx >= target.w) continue;
            target.colour[trow + tx] = colour;
          }
        }
      }
      cx += g.advance;
    }
    return cx - Math.round(x);
  }

  // Draws text with a 1px drop shadow — used for labels over the world.
  function drawShadowed(target, text, x, y, colour, shadow) {
    draw(target, text, x, y + 1, shadow);
    draw(target, text, x, y, colour);
  }

  function wrap(text, maxWidth) {
    const words = text.split(' ');
    const lines = [];
    let line = '';
    for (let i = 0; i < words.length; i++) {
      const candidate = line ? line + ' ' + words[i] : words[i];
      if (measure(candidate) > maxWidth && line) {
        lines.push(line);
        line = words[i];
      } else {
        line = candidate;
      }
    }
    if (line) lines.push(line);
    return lines;
  }

  function reset() { glyphs.clear(); }

  function whenReady(cb) {
    if (ready) { cb(); return; }
    const finish = function () {
      ready = true;
      reset(); // rebuild any glyph cached against the fallback face
      cb();
    };
    if (document.fonts && document.fonts.load) {
      Promise.race([
        document.fonts.load('8px Silkscreen').then(function () { return document.fonts.ready; }),
        new Promise(function (r) { setTimeout(r, 2500); })
      ]).then(finish, finish);
    } else {
      finish();
    }
  }

  global.Text = {
    CELL_H, SIZE, LINE_H: CELL_H,
    glyph, measure, draw, drawShadowed, wrap, reset, whenReady
  };
})(window);
