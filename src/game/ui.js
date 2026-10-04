// The game's on-screen furniture, kept to a minimum: a small clock in the corner, a line of text
// along the bottom for news and happenings (one message at a time, like a village notice read
// aloud), a soft marker over whatever you could interact with, a conversation box in the style of
// a storybook, the speaker's name on a tab, the words written out as they're spoken, your replies
// in a bubble at the side, and a pause menu (Esc) that holds everything else.
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
        ${[['resume', 'Continue'], ['satchel', 'Satchel'], ['map', 'Map of Eldoria'], ['chron', 'Chronicle'], ['biz', 'Business'], ['tasks', 'Undertakings'], ['hold', 'Holdings'], ['gang', 'Gang'], ['ledger', 'Town ledger'], ['guide', 'Guide'], ['settings', 'Settings & saves'], ['save', 'Save now']].map(([k, l]) => `<button data-m="${k}">${l}</button>`).join('')}</div>`;
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
      else if (k === 'biz') O.openBusiness && O.openBusiness();
      else if (k === 'tasks') O.openTasks && O.openTasks();
      else if (k === 'hold') O.holdings && O.holdings();
      else if (k === 'gang') O.GangUI && O.GangUI.ledger();
      else if (k === 'ledger') O.npcUI && O.npcUI.toggleLedger(true);
      else if (k === 'guide') O.Guide && O.Guide.open();
      else if (k === 'sound') O.AudioToggle && O.AudioToggle();
      else if (k === 'save') { O.Save.save(game, O.SimRef.home); }
      else if (k === 'new') confirmNew();
      else if (k === 'settings') settings();
    }
    // ---------------------------------------------------------------- settings
    function pardon() {
      // for testing: wipe the slate, every crime forgiven, no bounty, the watch no longer looking
      const sims = [O.SimRef.home, O.SimRef.cur].filter(Boolean);
      for (const s of sims) for (const c of s.crimes || []) if (c.perp === 'player') c.closed = c.closed || 'pardoned';
      PS.crimes = []; PS.bounty = false; PS.bountyAmount = 0; PS.exiled = false; PS.stolen = {}; PS.wanted = 0;
      PS.rep.guard = Math.max(0, PS.rep.guard); PS.rep.civilian = Math.max(0, PS.rep.civilian);
      O.lawEndChase && O.lawEndChase();
    }
    function resetMe() {
      pardon();
      PS.money = 0; PS.items = []; PS.hp = 100; PS.energy = 90; PS.hunger = 75; PS.wounds = []; PS.lease = null; PS.room = null;
      PS.rep.civilian = 0; PS.rep.criminal = 0; PS.rep.guard = 0; PS.rep.merchant = 0; PS.localRep = {};
      if (game.player.mount && O.Horses) O.Horses.dismount(true);
    }
    function settings() {
      const snd = O.Sound && O.Sound.on, last = O.Save.peek();
      const row = (k, l, note) => `<button data-s="${k}">${l}</button>${note ? `<span class="lbl">${note}</span>` : ''}`;
      O.Panels.open('Settings & saves', `<div class="settings">
        <h4>Saves</h4>
        ${row('save', 'Save now', last ? `last saved on day ${last.sim?.day ?? last.day ?? '?'}` : 'no save yet')}
        ${row('load', 'Load the last save', 'go back to where you last saved')}
        ${row('restart', 'Restart this life', 'same character, the world made fresh')}
        ${row('new', 'Begin a new life', 'a new character and a new world')}
        <h4>Game</h4>
        ${row('sound', `Sound: ${snd ? 'on' : 'off'}`)}
        ${row('speed', `Time: ${game.clock.speed >= 2 ? 'fast' : 'normal'}`, 'how fast the days go by')}
        <h4>Testing</h4>
        ${row('pardon', 'Clear my wanted level', 'every crime forgiven, no bounty, no chase')}
        ${row('reset', 'Reset me', 'purse, satchel, health, wounds, standing and wanted level back to a fresh arrival')}
        ${row('post', 'Take up any post', 'try any job in the realm, even ones nobody would give you (king, lord, gaoler...)')}
        ${row('tele', 'Teleport', 'go straight to any city, town, village, hamlet, castle or mine (for testing)')}
      </div>`, (r) => {
        r.querySelectorAll('[data-s]').forEach((b) => b.onclick = () => {
          const k = b.dataset.s;
          if (k === 'save') { O.Save.save(game, O.SimRef.home); settings(); }
          else if (k === 'load') { if (!O.Save.peek()) return O.Panels.toast('There is no save yet.', 'bad'); window.__noAutosave = true; location.reload(); }
          else if (k === 'restart') { O.Save.clear(); O.Names && O.Names.newLife(); window.__noAutosave = true; location.reload(); }
          else if (k === 'new') confirmNew();
          else if (k === 'sound') { O.AudioToggle && O.AudioToggle(); settings(); }
          else if (k === 'speed') { game.clock.speed = game.clock.speed >= 2 ? 1 : 2; settings(); }
          else if (k === 'pardon') { pardon(); O.Panels.close(); O.UI.say('Your slate is wiped clean. Nobody is looking for you.'); }
          else if (k === 'post') posts();
          else if (k === 'tele') teleports();
          else if (k === 'reset') { resetMe(); O.Panels.close(); O.UI.say('You are a stranger again: empty-handed, unhurt, unknown and wanted by no one.'); }
        });
      });
    }
    // every post there is, grouped by where it's held; choosing one puts you in it here (or says where to go)
    function posts() {
      const all = O.allRoles ? O.allRoles() : new Map(), by = new Map();
      for (const [role, type] of all) { const lbl = type === 'crown' ? 'The Crown and nobility' : O.Data.BUSINESS[type]?.label || type; if (!by.has(lbl)) by.set(lbl, []); by.get(lbl).push(role); }
      const html = [...by.entries()].sort((a, c) => a[0].localeCompare(c[0])).map(([lbl, roles]) => `<h4>${O.escape(lbl)}</h4><div class="topics">${roles.map((r) => `<button data-post="${O.escape(r)}">${O.escape(r)}</button>`).join('')}</div>`).join('');
      O.Panels.open('Take up any post', `<p class="caption">For trying the work out: you're put straight into the post in ${O.escape(O.SimRef.cur.world.name)} if there's such a place here, and whoever held it makes way.</p>${html}`, (r) => {
        r.querySelectorAll('[data-post]').forEach((b) => b.onclick = () => { O.Panels.close(); O.takeAnyPost(b.dataset.post); });
      });
    }
    // testing only (to be removed): jump to the middle of any place in the realm
    function teleports() {
      const K = O.SimRef.home.kingdom, order = ['capital', 'city', 'port', 'town', 'castle', 'mine', 'village', 'hamlet'];
      const html = order.map((k) => { const ps = K.places.filter((p) => p.kind === k).sort((a, c) => a.name.localeCompare(c.name)); return ps.length ? `<h4>${k === 'city' ? 'Cities' : k[0].toUpperCase() + k.slice(1) + 's'}</h4><div class="topics">${ps.map((p) => `<button data-tp="${p.id}">${O.escape(p.name)}</button>`).join('')}</div>` : ''; }).join('');
      O.Panels.open('Teleport (testing)', html, (r) => r.querySelectorAll('[data-tp]').forEach((b) => b.onclick = () => { O.Panels.close(); O.teleport(b.dataset.tp); }));
    }
    O.teleport = (id) => {
      const I = O.Island, p = game.player;
      if (game.scene) game.exitBuilding();
      if (p.mount && O.Horses && O.Horses.dismount) O.Horses.dismount();
      p.sitting = null; p.inBed = null; p.locked = false;
      const [cx, cy] = I.centre(id), [lx, ly] = I.toLocal(game.world, cx * 16, cy * 16); p.x = lx; p.y = ly;
      O.OpenWorld.switchTo(id);
      // land in the square (or the nearest open ground)
      const s = O.SimRef.cur, w = game.world, sq = s.Z && s.Z.square;
      if (sq && s.world === w) { p.x = Math.round((sq[0] + sq[2]) / 2) * 16 + 8; p.y = Math.round((sq[1] + sq[3]) / 2) * 16 + 10; }
      for (let r = 0; r < 40 && game.blocked(p.x, p.y); r++) { p.y += 16; }
      game.update(0);
      O.UI.say(`You find yourself in ${w.name}.`);
    };
    O.openSettings = settings;
    function confirmNew() {
      O.Panels.open('Begin a new life?', '<p class="caption">This forgets the world as you left it: every person, every crime, your purse and your name. You will make a new character and start again.</p><div class="topics"><button data-yes="1">Yes, start over</button><button data-no="1">Keep playing</button></div>', (r) => {
        r.querySelector('[data-no]').onclick = () => O.Panels.close();
        r.querySelector('[data-yes]').onclick = () => { O.Save.clear(); O.Names && O.Names.newLife(); try { localStorage.removeItem('outlaw.spec'); localStorage.removeItem('outlaw.created'); } catch (e) { /* ignore */ } window.__noAutosave = true; location.reload(); };
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
