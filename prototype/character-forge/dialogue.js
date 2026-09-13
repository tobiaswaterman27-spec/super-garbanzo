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

  const COLOURS = {
    panel: R.pack(243, 236, 217),
    panelShade: R.pack(214, 202, 175),
    border: R.pack(58, 46, 38),
    inner: R.pack(255, 251, 240),
    text: R.pack(48, 38, 32),
    plate: R.pack(200, 150, 62),
    plateText: R.pack(36, 28, 22),
    arrow: R.pack(122, 78, 40)
  };

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

  /* ---------- drawing ---------- */

  function panel(target, x, y, w, h) {
    R.fillRect(target, x, y, w, h, COLOURS.panel);
    // notch the corners so the box reads as rounded at this scale
    for (let i = 0; i < 2; i++) {
      const n = 2 - i;
      R.fillRect(target, x + i, y + i, n, 1, 0);
      R.fillRect(target, x + w - i - n, y + i, n, 1, 0);
      R.fillRect(target, x + i, y + h - i - 1, n, 1, 0);
      R.fillRect(target, x + w - i - n, y + h - i - 1, n, 1, 0);
    }
    R.strokeRect(target, x, y, w, h, COLOURS.border);
    // clip the border's own corner pixels to match the notch
    R.fillRect(target, x, y, 1, 1, 0);
    R.fillRect(target, x + w - 1, y, 1, 1, 0);
    R.fillRect(target, x, y + h - 1, 1, 1, 0);
    R.fillRect(target, x + w - 1, y + h - 1, 1, 1, 0);
    // inner bevel
    R.fillRect(target, x + 2, y + 1, w - 4, 1, COLOURS.inner);
    R.fillRect(target, x + 1, y + 2, 1, h - 4, COLOURS.inner);
    R.fillRect(target, x + 2, y + h - 2, w - 4, 1, COLOURS.panelShade);
    R.fillRect(target, x + w - 2, y + 2, 1, h - 4, COLOURS.panelShade);
  }

  function draw(box, target) {
    if (!box.open) return;

    const margin = 10;
    const h = 62;
    const w = target.w - margin * 2;
    const x = margin;
    const y = target.h - h - 6;

    panel(target, x, y, w, h);

    if (box.speaker) {
      const plateH = T.CELL_H + 4;
      const nameW = T.measure(box.speaker) + 12;
      const plateX = x + 6;
      const plateY = y - plateH + 1;
      R.fillRect(target, plateX, plateY, nameW, plateH, COLOURS.plate);
      R.strokeRect(target, plateX, plateY, nameW, plateH, COLOURS.border);
      R.fillRect(target, plateX, plateY, 1, 1, 0);
      R.fillRect(target, plateX + nameW - 1, plateY, 1, 1, 0);
      T.draw(target, box.speaker, plateX + 6, plateY + 2, COLOURS.plateText);
    }

    const page = currentPage(box);
    const shown = page.slice(0, Math.floor(box.revealed));
    const lines = T.wrap(page, w - 22);

    // Wrap the full page once, then reveal per line, so text never re-flows
    // mid-reveal — re-flowing is the classic typewriter bug.
    let remaining = shown.length;
    let ty = y + 9;
    for (let i = 0; i < lines.length && i < 3; i++) {
      const line = lines[i];
      const take = Math.max(0, Math.min(line.length, remaining));
      if (take > 0) T.draw(target, line.slice(0, take), x + 10, ty, COLOURS.text);
      remaining -= line.length + 1; // +1 for the space the wrap consumed
      ty += T.LINE_H + 3;
    }

    if (pageComplete(box)) {
      const bob = Math.round(Math.sin(box.time * 5.0) * 1.5);
      drawArrow(target, x + w - 13, y + h - 12 + bob);
    }

    // page pips, so you can see how much is left
    const pips = box.pages.length;
    if (pips > 1) {
      for (let i = 0; i < pips; i++) {
        const px = x + w - 10 - (pips - 1 - i) * 5;
        const on = i <= box.pageIndex;
        R.fillRect(target, px, y + 5, 3, 3, on ? COLOURS.arrow : COLOURS.panelShade);
      }
    }
  }

  // A downward chevron, drawn as explicit pixel rows.
  function drawArrow(target, x, y) {
    const rows = [
      [0, 7], [1, 5], [2, 3], [3, 1]
    ];
    for (let i = 0; i < rows.length; i++) {
      const inset = i;
      const width = 7 - i * 2;
      R.fillRect(target, x + inset, y + i, width, 1, COLOURS.arrow);
    }
  }

  global.Dialogue = {
    create, start, update, advance, close, draw,
    currentPage, pageComplete, COLOURS
  };
})(window);
