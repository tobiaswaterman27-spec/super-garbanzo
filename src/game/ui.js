// The game's on-screen furniture, kept to a minimum: a small clock in the corner, a line of text
// along the bottom for news and happenings (one message at a time, like a village notice read
// aloud), a soft marker over whatever you could interact with, a conversation box in the style of
// a storybook — the speaker's name on a tab, the words written out as they're spoken, your replies
// in a bubble at the side — and a pause menu (Esc) that holds everything else.
'use strict';
(function () {
  const esc = (s) => O.escape(String(s));
  function setup(game) {
    const root = game.el.parentElement;
    const PS = O.PlayerState;

    // ---------------------------------------------------------------- clock
    const clock = document.createElement('div'); clock.className = 'ui-clock'; root.appendChild(clock);
    const status = document.createElement('div'); status.className = 'ui-status'; root.appendChild(status);
    let lastClock = '';
    game.hooks.update.push(() => {
      const s = O.SimRef.cur, m = Math.floor(s.minute), h = Math.floor(m / 60) % 24, mm = m % 60;
      const ampm = h < 12 ? 'AM' : 'PM', hh = h % 12 === 0 ? 12 : h % 12;
      const place = game.scene ? (game.scene.b.name || 'Indoors') : (O.placeName ? O.placeName() : s.world.name);
      const txt = `<b>${hh}:${String(mm).padStart(2, '0')}</b><small>${ampm}</small><span>${O.DAYNAMES[s.weekday]} · ${s.season} ${s.weather.dayOfSeason}</span><em>${esc(place)}</em>`;
      if (txt !== lastClock) { clock.innerHTML = txt; lastClock = txt; }
      const st = [];
      if (PS.hunger < 22) st.push('Hungry'); if (PS.energy < 18) st.push('Exhausted'); if (PS.hp < 35) st.push('Badly hurt');
      if (PS.wantedLevel && PS.wantedLevel() >= 1) st.push('Wanted');
      const sTxt = st.map((x) => `<span>${x}</span>`).join('');
      if (status.innerHTML !== sTxt) status.innerHTML = sTxt;
    });

    // ---------------------------------------------------------------- the bottom line
    const line = document.createElement('div'); line.className = 'ui-ticker'; line.setAttribute('aria-live', 'polite'); root.appendChild(line);
    const queue = []; let showing = null, until = 0;
    function say(text, kind = '') {
      if (!text) return;
      if (queue.some((q) => q.text === text) || (showing && showing.text === text)) return;
      queue.push({ text, kind }); if (queue.length > 6) queue.shift();
    }
    game.hooks.update.push(() => {
      const now = performance.now();
      if (showing && now < until) return;
      if (showing && !queue.length) { line.classList.remove('on'); showing = null; return; }
      if (!queue.length) return;
      showing = queue.shift();
      line.className = 'ui-ticker on ' + showing.kind; line.textContent = showing.text;
      until = now + Math.max(2600, Math.min(6500, showing.text.length * 55)) * (queue.length > 2 ? 0.6 : 1);
    });
    O.UI.say = say;

    // ---------------------------------------------------------------- the target marker
    game.hooks.drawTop.push((ctx, cam) => {
      const c = O.interactTarget; if (!c || O.panelOpen || O.UI.dialogOpen() || game.player.walkingDoor) return;
      const bob = Math.round(Math.sin(game.t * 4) * 1.5);
      const x = Math.round(c.x - cam.x), y = Math.round((c.type === 'npc' ? c.y - O.Char.GROUND - 4 : c.y - 6) - cam.y + bob);
      ctx.fillStyle = 'rgba(20,14,30,0.65)'; ctx.fillRect(x - 3, y - 2, 7, 7);
      ctx.fillStyle = '#fff6dc'; ctx.fillRect(x - 1, y - 1, 3, 5); ctx.fillRect(x - 2, y, 5, 3);
      ctx.fillStyle = '#f0b45c'; ctx.fillRect(x, y + 1, 1, 1);
    });

    // ---------------------------------------------------------------- conversation
    const box = document.createElement('div'); box.className = 'dlg'; box.hidden = true;
    box.innerHTML = '<div class="dlg-name"></div><div class="dlg-text"></div><div class="dlg-next">▼</div>';
    const opts = document.createElement('div'); opts.className = 'dlg-opts'; opts.hidden = true;
    root.append(box, opts);
    const nameEl = box.querySelector('.dlg-name'), textEl = box.querySelector('.dlg-text'), nextEl = box.querySelector('.dlg-next');
    let D = null; // { text, shown, options, onPick, sel }
    function open(o) {
      D = { text: o.text, shown: 0, options: o.options || [], onPick: o.onPick, sel: 0, onClose: o.onClose };
      nameEl.textContent = o.name || ''; nameEl.style.background = o.color || '#c8743a'; nameEl.hidden = !o.name;
      box.hidden = false; opts.hidden = true; textEl.textContent = ''; nextEl.hidden = true;
      game.player.locked = true;
    }
    function close() {
      if (!D) return; const cb = D.onClose; D = null; box.hidden = true; opts.hidden = true; game.player.locked = false; cb && cb();
    }
    function showOptions() {
      if (!D.options.length) { nextEl.hidden = false; return; }
      opts.innerHTML = D.options.map((op, i) => `<button data-i="${i}" class="${i === D.sel ? 'sel' : ''}${op.hot ? ' hot' : ''}">${esc(op.label)}</button>`).join('');
      opts.hidden = false;
      opts.querySelectorAll('button').forEach((b) => { b.onclick = () => pick(+b.dataset.i); b.onmouseenter = () => { D.sel = +b.dataset.i; mark(); }; });
    }
    function mark() { opts.querySelectorAll('button').forEach((b, i) => b.classList.toggle('sel', i === D.sel)); }
    function pick(i) { if (!D) return; const op = D.options[i]; if (!op) return; D.onPick && D.onPick(op.key, op); }
    function finishText() { if (!D) return; D.shown = D.text.length; textEl.textContent = D.text; showOptions(); }
    game.hooks.update.push((dt) => {
      if (!D) return;
      if (D.shown < D.text.length) { D.shown = Math.min(D.text.length, D.shown + dt * 48); textEl.textContent = D.text.slice(0, Math.floor(D.shown)); if (D.shown >= D.text.length) showOptions(); }
    });
    box.onclick = () => { if (!D) return; if (D.shown < D.text.length) finishText(); else if (!D.options.length) close(); };
    game.keyHandlers.unshift((e) => {
      if (!D) return false;
      const k = e.code;
      if (k === 'KeyE' || k === 'Enter' || k === 'Space') { if (D.shown < D.text.length) finishText(); else if (D.options.length) pick(D.sel); else close(); return true; }
      if (k === 'ArrowDown' || k === 'KeyS') { D.sel = (D.sel + 1) % Math.max(1, D.options.length); mark(); return true; }
      if (k === 'ArrowUp' || k === 'KeyW') { D.sel = (D.sel - 1 + D.options.length) % Math.max(1, D.options.length); mark(); return true; }
      if (k === 'Escape') { const last = D.options.length - 1; if (last >= 0 && D.shown >= D.text.length) pick(last); else close(); return true; }
      return true; // nothing else happens mid-conversation
    });
    O.UI.dialog = { open, close, set: (o) => open(Object.assign({ name: nameEl.textContent, color: nameEl.style.background }, o)) };
    O.UI.dialogOpen = () => !!D;

    // ---------------------------------------------------------------- pause menu
    const menu = document.createElement('div'); menu.className = 'ui-menu'; menu.hidden = true; root.appendChild(menu);
    function openMenu() {
      const snd = O.Sound && O.Sound.on;
      menu.innerHTML = `<div class="ui-menu-in"><h2>Outlaw</h2>
        ${[['resume', 'Continue'], ['satchel', 'Satchel'], ['map', 'Map of Eldoria'], ['chron', 'Chronicle'], ['hold', 'Holdings'], ['gang', 'Gang'], ['ledger', 'Town ledger'], ['guide', 'Guide'], ['sound', `Sound: ${snd ? 'on' : 'off'}`], ['save', 'Save now'], ['new', 'Begin a new life']].map(([k, l]) => `<button data-m="${k}">${l}</button>`).join('')}</div>`;
      menu.hidden = false; O.menuOpen = true; game.player.locked = true;
      menu.querySelectorAll('[data-m]').forEach((b) => b.onclick = () => act(b.dataset.m));
      menu.querySelector('button').focus();
    }
    function closeMenu() { menu.hidden = true; O.menuOpen = false; game.player.locked = false; game.canvas.focus(); }
    function act(k) {
      closeMenu();
      if (k === 'satchel') O.Panels.inventory();
      else if (k === 'map') O.openMap && O.openMap();
      else if (k === 'chron') O.ChronicleUI && O.ChronicleUI.open();
      else if (k === 'hold') O.holdings && O.holdings();
      else if (k === 'gang') O.GangUI && O.GangUI.ledger();
      else if (k === 'ledger') O.npcUI && O.npcUI.toggleLedger(true);
      else if (k === 'guide') O.Guide && O.Guide.open();
      else if (k === 'sound') O.AudioToggle && O.AudioToggle();
      else if (k === 'save') { O.Save.save(game, O.SimRef.home); }
      else if (k === 'new') confirmNew();
    }
    function confirmNew() {
      O.Panels.open('Begin a new life?', '<p class="caption">This forgets the world as you left it: every person, every crime, your purse and your name. You will make a new character and start again.</p><div class="topics"><button data-yes="1">Yes, start over</button><button data-no="1">Keep playing</button></div>', (r) => {
        r.querySelector('[data-no]').onclick = () => O.Panels.close();
        r.querySelector('[data-yes]').onclick = () => { O.Save.clear(); try { localStorage.removeItem('outlaw.spec'); localStorage.removeItem('outlaw.created'); } catch (e) { /* ignore */ } window.__noAutosave = true; location.reload(); };
      });
    }
    game.keyHandlers.push((e) => {
      if (e.code !== 'Escape') return false;
      if (!menu.hidden) { closeMenu(); return true; }
      if (O.panelOpen || D) return false;
      openMenu(); return true;
    });
    // the player stands still whenever a panel, menu or conversation has their attention (recomputed
    // first each frame; actions like searching a chest add their own lock after this)
    game.hooks.update.unshift(() => { game.player.locked = !!(O.panelOpen || O.menuOpen || D); });
  }
  O.UI = { setup, say: () => {}, dialogOpen: () => false };
})();
