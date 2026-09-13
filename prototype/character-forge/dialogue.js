/* dialogue.js — the paged text box.
 *
 * Typewriter reveal, a name plate, and a bobbing arrow in the bottom-right that
 * only appears once the page has finished revealing. Click or press space to
 * advance; advancing past the last page closes the box.
 */
(function (global) {
  'use strict';

  const R = global.Render;
  const T = global.Text;
  const CM = global.CharacterModel;

  const CHARS_PER_SECOND = 34;

  function create() {
    return {
      open: false,
      pages: [],
      pageIndex: 0,
      revealed: 0,
      speaker: '',
      time: 0,
      lastLetter: '',
      onLetter: null,
      onClose: null,
      justClosed: false
    };
  }

  function start(box, pages, speaker, opts) {
    box.open = true;
    box.pages = pages.slice();
    box.pageIndex = 0;
    box.revealed = 0;
    box.speaker = speaker || '';
    box.time = 0;
    box.lastLetter = '';
    box.onLetter = (opts && opts.onLetter) || null;
    box.onClose = (opts && opts.onClose) || null;
  }

  function currentPage(box) { return box.pages[box.pageIndex] || ''; }

  function pageComplete(box) { return box.revealed >= currentPage(box).length; }

  function update(box, dt) {
    if (!box.open) return;
    box.time += dt;
    const page = currentPage(box);
    if (box.revealed < page.length) {
      const before = Math.floor(box.revealed);
      box.revealed = Math.min(page.length, box.revealed + CHARS_PER_SECOND * dt);
      const after = Math.floor(box.revealed);
      for (let i = before; i < after; i++) {
        const ch = page[i];
        if (ch && ch !== ' ') {
          box.lastLetter = ch;
          if (box.onLetter) box.onLetter(ch);
        }
      }
      if (box.revealed >= page.length && box.onLetter) box.onLetter(null);
    }
  }

  // Returns true if the box consumed the input.
  function advance(box) {
    if (!box.open) return false;
    if (!pageComplete(box)) {
      box.revealed = currentPage(box).length; // first click completes the page
      if (box.onLetter) box.onLetter(null);
      return true;
    }
    if (box.pageIndex < box.pages.length - 1) {
      box.pageIndex++;
      box.revealed = 0;
      box.time = 0;
      return true;
    }
    close(box);
    return true;
  }

  function close(box) {
    box.open = false;
    box.pages = [];
    box.revealed = 0;
    box.justClosed = true;
    if (box.onLetter) box.onLetter(null);
    if (box.onClose) box.onClose();
  }

  /* ---------- drawing ----------
   *
   * Straight onto the canvas now rather than into the pixel buffer, so the
   * panel has real rounded corners and the text is anti-aliased.
   */

  const STYLE = {
    panel: 'rgba(247, 242, 230, 0.97)',
    border: 'rgba(58, 46, 38, 0.9)',
    text: '#2f2620',
    plate: '#c08c3a',
    plateText: '#221a12',
    arrow: '#7a4e28',
    pip: '#7a4e28',
    pipOff: 'rgba(122, 78, 40, 0.25)'
  };

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function draw(box, ctx, viewW, viewH) {
    if (!box.open) return;

    const margin = 34;
    const h = 150;
    const w = viewW - margin * 2;
    const x = margin;
    const y = viewH - h - 22;
    const fontSize = 26;
    const lineHeight = 36;

    ctx.save();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';

    ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 5;
    ctx.fillStyle = STYLE.panel;
    roundRect(ctx, x, y, w, h, 14);
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.lineWidth = 2;
    ctx.strokeStyle = STYLE.border;
    ctx.stroke();

    if (box.speaker) {
      const nameSize = 20;
      const nameW = T.measure(ctx, box.speaker, nameSize, 700) + 28;
      const plateH = 34;
      const px = x + 18, py = y - plateH + 6;
      ctx.fillStyle = STYLE.plate;
      roundRect(ctx, px, py, nameW, plateH, 9);
      ctx.fill();
      ctx.strokeStyle = STYLE.border;
      ctx.stroke();
      T.draw(ctx, box.speaker, px + 14, py + 23, nameSize, STYLE.plateText, 700);
    }

    const page = currentPage(box);
    const shown = Math.floor(box.revealed);
    const lines = T.wrap(ctx, page, w - 56, fontSize);

    // wrap the whole page once, then reveal along it, so nothing re-flows
    let remaining = shown;
    let ty = y + 48;
    for (let i = 0; i < lines.length && i < 3; i++) {
      const take = Math.max(0, Math.min(lines[i].length, remaining));
      if (take > 0) T.draw(ctx, lines[i].slice(0, take), x + 28, ty, fontSize, STYLE.text);
      remaining -= lines[i].length + 1;
      ty += lineHeight;
    }

    if (pageComplete(box)) {
      const bob = Math.sin(box.time * 5) * 4;
      const ax = x + w - 34, ay = y + h - 30 + bob;
      ctx.fillStyle = STYLE.arrow;
      ctx.beginPath();
      ctx.moveTo(ax - 10, ay - 6);
      ctx.lineTo(ax + 10, ay - 6);
      ctx.lineTo(ax, ay + 8);
      ctx.closePath();
      ctx.fill();
    }

    const pips = box.pages.length;
    if (pips > 1) {
      for (let i = 0; i < pips; i++) {
        ctx.fillStyle = i <= box.pageIndex ? STYLE.pip : STYLE.pipOff;
        ctx.beginPath();
        ctx.arc(x + w - 22 - (pips - 1 - i) * 16, y + 20, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
  }

  global.Dialogue = {
    create, start, update, advance, close, draw,
    currentPage, pageComplete, STYLE
  };
})(window);
