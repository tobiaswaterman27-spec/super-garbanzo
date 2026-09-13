/* font.js — text.
 *
 * Previously this thresholded every glyph to a 1-bit mask so it would survive
 * being scaled up as pixel art. Nothing is pixel art now, so text is simply
 * drawn on the canvas and anti-aliased like everything else.
 */
(function (global) {
  'use strict';

  const FAMILY = '"Outfit", "Trebuchet MS", "Segoe UI", system-ui, sans-serif';

  function font(size, weight) {
    return (weight || 500) + ' ' + size + 'px ' + FAMILY;
  }

  function measure(ctx, text, size, weight) {
    ctx.font = font(size, weight);
    return ctx.measureText(text).width;
  }

  // A label over the world: soft shadow behind, so it stays readable on grass.
  function label(ctx, text, x, y, size, colour, weight) {
    ctx.font = font(size, weight || 600);
    ctx.save();
    ctx.shadowColor = 'rgba(12, 14, 18, 0.85)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetY = 1;
    ctx.fillStyle = colour;
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  function draw(ctx, text, x, y, size, colour, weight, align) {
    ctx.font = font(size, weight || 500);
    ctx.textAlign = align || 'left';
    ctx.fillStyle = colour;
    ctx.fillText(text, x, y);
  }

  // Greedy wrap against a real measured width.
  function wrap(ctx, text, maxWidth, size, weight) {
    ctx.font = font(size, weight || 500);
    const words = text.split(' ');
    const lines = [];
    let line = '';
    for (let i = 0; i < words.length; i++) {
      const candidate = line ? line + ' ' + words[i] : words[i];
      if (ctx.measureText(candidate).width > maxWidth && line) {
        lines.push(line);
        line = words[i];
      } else {
        line = candidate;
      }
    }
    if (line) lines.push(line);
    return lines;
  }

  function whenReady(cb) {
    if (document.fonts && document.fonts.load) {
      Promise.race([
        document.fonts.load('600 16px Outfit').then(function () { return document.fonts.ready; }),
        new Promise(function (r) { setTimeout(r, 2500); })
      ]).then(cb, cb);
    } else {
      cb();
    }
  }

  global.Text = { FAMILY, font, measure, label, draw, wrap, whenReady };
})(window);
