// The Chronicle (C): the world's timeline as the parish clerks record it, what you have heard and
// from whom (set against the record), your own story (including what only you know), and the
// realm's notables — rulers, memorials, the founders of its trades. Also: memorial stones raised in
// the chapel yard for notable dead, ballads sung by visiting bards, and the city broadsheet.
'use strict';
(function () {
  const C = () => O.Chronicle;
  const esc = (s) => O.escape(String(s));
  let tab = 'timeline', cat = 'all', minor = false, here = false;

  function setup(game, home) {
    const btn = document.createElement('button'); btn.className = 'btn ghost chron-btn'; btn.textContent = 'Chronicle (C)';
    btn.onclick = () => (O.panelOpen ? O.Panels.close() : open()); document.getElementById('tab-play').appendChild(btn);
    game.keyHandlers.push((e) => { if (e.code === 'KeyC' && !O.panelOpen) { open(); return true; } return false; });

    // memorial stones in the chapel yard of the home village
    home.onMemorial = (ep) => {
      const w = home.world, ch = w.buildings.find((b) => b.type === 'chapel'); if (!ch) return;
      // in the churchyard among the graves if there is one, else beside the chapel
      const gs = w.props.filter((q) => q.kind === 'gravestone' || q.kind === 'memorial');
      const cx = gs.length ? gs.reduce((a, q) => a + q.x / 16, 0) / gs.length : ch.doorX, cy = gs.length ? gs.reduce((a, q) => a + q.y / 16, 0) / gs.length : ch.doorY + 2;
      const spots = []; for (let y = Math.floor(cy) - 4; y <= Math.floor(cy) + 4; y++) for (let x = Math.floor(cx) - 5; x <= Math.floor(cx) + 5; x++) spots.push([x, y]);
      spots.sort((a, b) => Math.hypot(a[0] - cx, a[1] - cy) - Math.hypot(b[0] - cx, b[1] - cy));
      const ok = ([x, y]) => x >= 0 && y >= 0 && x < w.W && y < w.H && !w.solid[y * w.W + x] && !(Math.abs(x - ch.doorX) <= 1 && y > ch.bottom) && w.ter[y * w.W + x] !== 1 && !w.buildings.some((b) => x >= b.x - 1 && x < b.x + b.w + 1 && y >= b.y && y <= b.bottom + 1) && !w.props.some((q) => Math.floor(q.x / 16) === x && Math.floor(q.y / 16) === y);
      const spot = spots.find(ok); if (!spot) return;
      w.props.push({ kind: 'memorial', x: spot[0] * 16 + 8, y: spot[1] * 16 + 14, seed: ep.died, v: 1, solid: true, epitaph: ep });
      w.solid[spot[1] * w.W + spot[0]] = 1; w.dirtyStatics = true;
      home.log(`The parish has raised a memorial stone to ${ep.name} by the chapel.`, 'event');
    };

    // ballads: when you're in the tavern and the bard strikes up, you hear the song
    let lastSong = null;
    game.hooks.update.push(() => {
      const s = O.SimRef.cur, bd = s.bard;
      if (!bd || !bd.song || !game.scene || game.scene.b.id !== s.tavernId || bd.agent.inside !== s.tavernId) return;
      if (lastSong === bd.song) return; lastSong = bd.song;
      bd.agent.talking = 50;
      O.Panels.toast(`${bd.first} sings: ${bd.song.text}`);
      C().playerHears(C().byId(bd.song.f), bd.song.text, 'bard', bd.name);
    });
  }

  // ---------------------------------------------------------------- panel
  function open() {
    const s = O.SimRef.cur, Ch = C();
    const tabs = [['timeline', 'Timeline'], ['heard', 'Hearsay'], ['mine', 'Your story'], ['notables', 'Notables']];
    let body = `<div class="topics" style="margin-bottom:10px">${tabs.map(([k, l]) => `<button data-tab="${k}" class="${tab === k ? 'hot' : ''}">${l}</button>`).join('')}</div>`;
    if (tab === 'timeline') body += timeline(s, Ch);
    else if (tab === 'heard') body += hearsay(Ch);
    else if (tab === 'mine') body += mine(Ch);
    else body += notables(s, Ch);
    O.Panels.open('The Chronicle', body, (r) => {
      r.querySelectorAll('[data-tab]').forEach((b) => b.onclick = () => { tab = b.dataset.tab; open(); });
      r.querySelectorAll('[data-cat]').forEach((b) => b.onclick = () => { cat = b.dataset.cat; open(); });
      const mn = r.querySelector('[data-minor]'); if (mn) mn.onclick = () => { minor = !minor; open(); };
      const hr = r.querySelector('[data-here]'); if (hr) hr.onclick = () => { here = !here; open(); };
    });
  }
  function timeline(s, Ch) {
    const placeId = s.world.placeId || 'ashford';
    const list = Ch.facts.filter((f) => (minor || f.imp >= 2) && (cat === 'all' || f.cat === cat || (cat === 'player' && f.byPlayer)) && (!here || f.place === placeId)).slice().reverse();
    const chips = `<div class="topics" style="margin-bottom:8px">${[['all', 'All'], ...Object.entries(Ch.CATS)].map(([k, l]) => `<button data-cat="${k}" class="${cat === k ? 'hot' : ''}">${l}</button>`).join('')}</div>
      <div class="topics" style="margin-bottom:10px"><button data-minor="1" class="${minor ? 'hot' : ''}">${minor ? 'Showing small matters' : 'Show small matters'}</button><button data-here="1" class="${here ? 'hot' : ''}">${here ? `Only ${esc(s.world.name)}` : 'Everywhere'}</button></div>`;
    if (!list.length) return chips + '<p class="caption">Nothing worth the ink yet. The clerks wait for something to happen.</p>';
    let out = '', season = '';
    for (const f of list.slice(0, 160)) {
      const lab = Ch.dateLabel(f.day), sea = lab.replace(/ \d+$/, '');
      if (sea !== season) { season = sea; out += `<li class="lbl" style="margin-top:8px">${esc(sea)}</li>`; }
      out += `<li><span class="lbl">${esc(lab.split(', ')[1])} · ${esc(f.placeName)}</span> ${'★'.repeat(Math.max(0, f.imp - 2))}${esc(f.text)}${f.byPlayer ? ' <span class="pill">you</span>' : ''}</li>`;
    }
    return chips + `<ol class="chron">${out}</ol>`;
  }
  function hearsay(Ch) {
    if (!Ch.heard.length) return '<p class="caption">You have heard nothing yet. Ask people for news, listen to the crier, sit in the tavern when a bard is in, or buy a broadsheet in Kingsbridge.</p>';
    const rows = Ch.heard.slice().reverse().map((h) => {
      const f = Ch.byId(h.f);
      const differs = f && h.text.replace(/[^a-z0-9]/gi, '').toLowerCase() !== f.text.replace(/[^a-z0-9]/gi, '').toLowerCase();
      return `<li><span class="lbl">${esc(Ch.dateLabel(h.day))} · ${esc(Ch.SOURCES[h.src] || h.src)}${h.from ? ' · ' + esc(h.from) : ''}</span> “${esc(h.text)}”${f && differs ? `<br><small class="caption">The record: ${esc(f.text)}</small>` : ''}</li>`;
    }).join('');
    return `<p class="caption">What you have been told, and by whom. The parish record is set beside it where the telling strays from the facts.</p><ol class="chron">${rows}</ol>`;
  }
  function mine(Ch) {
    const list = Ch.facts.filter((f) => f.byPlayer).slice().reverse();
    if (!list.length) return '<p class="caption">You have left no mark on the world yet. That can change.</p>';
    return `<p class="caption">Your deeds as you know them. Some the world knows; some only you.</p><ol class="chron">${list.map((f) => `<li><span class="lbl">${esc(Ch.dateLabel(f.day))} · ${esc(f.placeName)} · ${f.secret ? 'known only to you' : 'known'}</span> ${esc(f.mine || f.text)}</li>`).join('')}</ol>`;
  }
  function notables(s, Ch) {
    const H = O.SimRef.home, K = H.kingdom;
    const rulers = K.places.map((p) => `<li><b>${esc(p.name)}</b> — ${esc(p.id === 'ashford' ? (H.lordship?.holder === 'player' ? 'you, as Lord of Ashford' : (p.leader || 'the crown')) : p.leader || 'a council')}</li>`).join('');
    const mems = (H.memorials || []).slice().reverse().map((m) => `<li><b>${esc(m.name)}</b>${m.title ? ', ' + esc(m.title) : ''} — died ${esc(Ch.dateLabel(m.died))}, aged ${m.age}</li>`).join('') || '<li class="caption">No memorials raised yet.</li>';
    const founders = [...s.biz.values()].filter((bz) => !bz.def.public && bz.type !== 'site').map((bz) => `<li><b>${esc(bz.name)}</b> — ${bz.founded ? `founded ${esc(Ch.dateLabel(bz.founded.day))} by ${esc(bz.founded.by)}` : 'kept since time out of mind'}</li>`).join('');
    const graves = (H.graves || []).length;
    return `<div class="kv"><div><span class="lbl">Years recorded</span><b>${Ch.yearOf(H.day)}</b><small>${esc(Ch.dateLabel(H.day))}</small></div><div><span class="lbl">Facts in the record</span><b>${Ch.facts.length}</b><small>${Ch.facts.filter((f) => f.imp >= 3).length} of great moment</small></div><div><span class="lbl">Buried in Ashford</span><b>${graves}</b><small>${(H.memorials || []).length} with memorials</small></div></div>
      <div class="lbl" style="margin-top:12px">Who rules where</div><ol class="chron">${rulers}</ol>
      <div class="lbl" style="margin-top:12px">Remembered dead</div><ol class="chron">${mems}</ol>
      <div class="lbl" style="margin-top:12px">Trades of ${esc(s.world.name)}</div><ol class="chron">${founders}</ol>`;
  }

  // ---------------------------------------------------------------- memorial, broadsheet
  function memorial(ep) {
    if (!ep) return O.Panels.toast('The inscription is too weathered to read.');
    const Ch = C();
    O.Panels.open('Memorial', `<p style="font-family:var(--display);font-size:22px;margin:0">In memory of ${esc(ep.name)}</p>
      <p class="caption">${ep.title ? esc(ep.title) + '. ' : ''}Died ${esc(Ch.dateLabel(ep.died))}, aged ${ep.age}.</p>
      ${ep.deeds && ep.deeds.length ? `<div class="lbl">Remembered for</div><ol class="chron">${ep.deeds.map((d) => `<li>${esc(d)}</li>`).join('')}</ol>` : '<p class="caption">“Well loved, and missed.”</p>'}`);
    const f = Ch.facts.find((x) => x.cat === 'death' && x.who === ep.name); if (f) Ch.playerHears(f, f.text, 'record');
  }
  function broadsheet() {
    const PS = O.PlayerState, Ch = C(), s = O.SimRef.cur;
    if (PS.money < 1) return O.Panels.toast("The hawker won't give you a sheet for nothing.", 'bad');
    PS.money -= 1;
    const rng = O.RNG(O.hash('sheet', s.day));
    const items = Ch.facts.filter((f) => f.imp >= 2 && f.day >= s.day - 14).sort((a, b) => b.imp - a.imp || b.day - a.day).slice(0, 5);
    const rows = items.map((f) => { const v = Ch.tell(f, 'broadsheet', s, rng); Ch.playerHears(f, v, 'broadsheet', 'The Kingsbridge Crier'); return `<li><span class="lbl">${esc(f.placeName)}</span> ${esc(v)}</li>`; }).join('');
    O.Panels.open('The Kingsbridge Crier', `<p class="caption">One penny. Printed this morning at the sign of the Bell, Cathedral Lane. “Truth, or near enough.”</p><ol class="chron">${rows || '<li>NOTHING HAS HAPPENED, which is itself remarkable!</li>'}</ol>`);
  }

  O.ChronicleUI = { setup, open, memorial, broadsheet };
})();
