/* font.js — crisp pixel text.
 *
 * Canvas text is anti-aliased, which turns to mush once the low-res buffer is
 * scaled up. So each glyph is rasterised once, thresholded to a 1-bit mask and
 * cached; drawing is then a straight pixel blit with no grey fringe anywhere.
 */
(function (global) {
  'use strict';

  // Press Start 2P is drawn on an 8px grid specifically to stay readable at
  // this size; Silkscreen is narrower but its letterforms mush together once
  // thresholded. Kept as the fallback because the metrics are close.
  const FAMILY = '"Press Start 2P", "Silkscreen", "Courier New", monospace';
  // A whole multiple of the face's own 8px grid, so it stays crisp when the
  // render resolution goes up rather than being resampled.
  const SCALE = 3;
  const CELL_H = 13 * SCALE;
  const BASELINE = 10 * SCALE;
  const SIZE = 8 * SCALE;

  const glyphs = new Map();
  let scratch = null;
  let sctx = null;
  let ready = false;

  function ensureScratch() {
    if (scratch) return;
    scratch = document.createElement('canvas');
    scratch.width = 28 * SCALE;
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
        Promise.all([
          document.fonts.load(SIZE + 'px "Press Start 2P"'),
          document.fonts.load(SIZE + 'px Silkscreen')
        ]).then(function () { return document.fonts.ready; }),
        new Promise(function (r) { setTimeout(r, 2500); })
      ]).then(finish, finish);
    } else {
      finish();
    }
  }


  /* ---------- the tiny face ----------
   *
   * Press Start 2P bottoms out at eight pixels; below that the thresholding
   * turns it to porridge. So the small face is not a font at all, it is
   * drawn: three pixels wide by five tall, by hand, which is the smallest
   * size at which a capital is still unambiguous. Used for the labels that
   * have to sit above other labels without competing with them.
   */

  const TINY_W = 3, TINY_H = 5, TINY_GAP = 1;

  const TINY_ROWS = {
    'A': 'XXX,X X,XXX,X X,X X',
    'B': 'XX ,X X,XX ,X X,XX ',
    'C': 'XXX,X  ,X  ,X  ,XXX',
    'D': 'XX ,X X,X X,X X,XX ',
    'E': 'XXX,X  ,XX ,X  ,XXX',
    'F': 'XXX,X  ,XX ,X  ,X  ',
    'G': 'XXX,X  ,X X,X X,XXX',
    'H': 'X X,X X,XXX,X X,X X',
    'I': 'XXX, X , X , X ,XXX',
    'J': '  X,  X,  X,X X,XXX',
    'K': 'X X,X X,XX ,X X,X X',
    'L': 'X  ,X  ,X  ,X  ,XXX',
    'M': 'X X,XXX,XXX,X X,X X',
    'N': 'XX ,X X,X X,X X,X X',
    'O': 'XXX,X X,X X,X X,XXX',
    'P': 'XXX,X X,XXX,X  ,X  ',
    'Q': 'XXX,X X,X X,XXX,  X',
    'R': 'XXX,X X,XX ,X X,X X',
    'S': 'XXX,X  ,XXX,  X,XXX',
    'T': 'XXX, X , X , X , X ',
    'U': 'X X,X X,X X,X X,XXX',
    'V': 'X X,X X,X X,X X, X ',
    'W': 'X X,X X,XXX,XXX,X X',
    'X': 'X X,X X, X ,X X,X X',
    'Y': 'X X,X X, X , X , X ',
    'Z': 'XXX,  X, X ,X  ,XXX',
    '0': 'XXX,X X,X X,X X,XXX',
    '1': ' X ,XX , X , X ,XXX',
    '2': 'XXX,  X,XXX,X  ,XXX',
    '3': 'XXX,  X,XXX,  X,XXX',
    '4': 'X X,X X,XXX,  X,  X',
    '5': 'XXX,X  ,XXX,  X,XXX',
    '6': 'XXX,X  ,XXX,X X,XXX',
    '7': 'XXX,  X,  X,  X,  X',
    '8': 'XXX,X X,XXX,X X,XXX',
    '9': 'XXX,X X,XXX,  X,XXX',
    '-': '   ,   ,XXX,   ,   ',
    '.': '   ,   ,   ,   , X ',
    "'": ' X , X ,   ,   ,   ',
    '!': ' X , X , X ,   , X ',
    '?': 'XXX,  X, XX,   , X ',
    ' ': '   ,   ,   ,   ,   '
  };

  const tinyGlyphs = new Map();

  function tinyGlyph(ch) {
    const key = ch.toUpperCase();
    let g = tinyGlyphs.get(key);
    if (g) return g;
    const rows = (TINY_ROWS[key] || TINY_ROWS['?']).split(',');
    const mask = new Uint8Array(TINY_W * TINY_H);
    for (let y = 0; y < TINY_H; y++) {
      const row = rows[y] || '   ';
      for (let x = 0; x < TINY_W; x++) mask[y * TINY_W + x] = row[x] === 'X' ? 1 : 0;
    }
    g = { mask: mask };
    tinyGlyphs.set(key, g);
    return g;
  }

  /* `px` is how many buffer pixels one art pixel is worth — the same PIXEL the
   * rest of the world is drawn at, so the small face lands on the same grid
   * as everything else and never lands between two rows. */
  function measureTiny(text, px) {
    const p = px || 1;
    return text.length > 0 ? (text.length * (TINY_W + TINY_GAP) - TINY_GAP) * p : 0;
  }

  function tinyHeight(px) { return TINY_H * (px || 1); }

  function drawTiny(target, text, x, y, colour, px) {
    const p = px || 1;
    let cx = Math.round(x);
    const cy = Math.round(y);
    for (let i = 0; i < text.length; i++) {
      const g = tinyGlyph(text[i]);
      for (let gy = 0; gy < TINY_H; gy++) {
        const ty = cy + gy * p;
        for (let gx = 0; gx < TINY_W; gx++) {
          if (!g.mask[gy * TINY_W + gx]) continue;
          const tx = cx + gx * p;
          for (let oy = 0; oy < p; oy++) {
            const py = ty + oy;
            if (py < 0 || py >= target.h) continue;
            const row = py * target.w;
            for (let ox = 0; ox < p; ox++) {
              const pxx = tx + ox;
              if (pxx < 0 || pxx >= target.w) continue;
              target.colour[row + pxx] = colour;
            }
          }
        }
      }
      cx += (TINY_W + TINY_GAP) * p;
    }
  }

  function drawTinyShadowed(target, text, x, y, colour, shadow, px) {
    const p = px || 1;
    drawTiny(target, text, x + p, y + p, shadow, p);
    drawTiny(target, text, x, y, colour, p);
  }

  global.Text = {
    CELL_H, SIZE, SCALE, LINE_H: CELL_H,
    glyph, measure, draw, drawShadowed, wrap, reset, whenReady,
    TINY_W, TINY_H, measureTiny, tinyHeight, drawTiny, drawTinyShadowed
  };
})(window);
