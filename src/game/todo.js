// The To do box, in the corner: everything you have on, in one list. Your shift and its tasks, the
// gang's job, odd jobs, meetings, errands, debts and fines, and the things waiting in other towns.
// Press a line to have the arrow show you the way there (press it again to put the arrow away), or the
// cross to let it go. Folded, it's a small icon with the count on it.
'use strict';
(function () {
  function setup(game) {
    const PS = O.PlayerState, cur = () => O.SimRef.cur, esc = (t) => O.escape(String(t));
    const st = document.createElement('style');
    st.textContent = `.todobox{position:absolute;right:12px;top:12px;width:270px;max-height:calc(100% - 120px);overflow:auto;padding:8px 10px;background:rgba(250,242,222,.95);color:#4a3826;font-family:var(--body);font-size:13px;line-height:1.35;z-index:24;box-shadow:0 -2px 0 #3a2a1a,0 2px 0 #3a2a1a,-2px 0 0 #3a2a1a,2px 0 0 #3a2a1a,4px 4px 0 rgba(40,24,12,.35)}
.todobox.min{width:auto;padding:4px;cursor:pointer}.todobox .th{display:flex;justify-content:space-between;align-items:center;font-weight:700;cursor:pointer;margin-bottom:4px}.todobox .th small{color:#7a5a3a;font-weight:400}
.todobox .sec{border-top:1px dashed #c9b48a;padding-top:4px;margin-top:4px}.todobox .sec .jh{font-weight:700}.todobox .sec .js{color:#7a5a3a;font-size:12px}.todobox .sec ul{list-style:none;margin:2px 0 0;padding:0}.todobox .sec li.done{color:#8a9a6a;text-decoration:line-through}
.todobox ol{list-style:none;margin:4px 0 0;padding:0;display:grid;gap:2px}.todobox ol li{display:flex;gap:6px;align-items:baseline;padding:2px 4px;cursor:pointer}.todobox ol li:hover{background:#f0e2c0}.todobox ol li.on{background:#f0c870}.todobox ol li.far{opacity:.7;cursor:default}
.todobox ol li .m{flex:none;width:12px;color:#9a5a1e}.todobox ol li .t{flex:1;min-width:0}.todobox ol li .w{display:block;color:#7a5a3a;font-size:11px}.todobox ol li .x{flex:none;color:#a8382f;padding:0 2px}
.todobox .jicon{display:flex;align-items:center;gap:4px;font-weight:700}.todobox .jicon img{width:28px;height:28px;image-rendering:pixelated}.todobox .badge{background:#a8382f;color:#fff4dc;font-size:11px;padding:0 4px}`;
    document.head.appendChild(st);
    const el = document.createElement('div'); el.className = 'todobox'; el.hidden = true;
    (document.getElementById('tab-play') || document.body).appendChild(el);
    const now = (s) => s.day * 1440 + s.minute;
    const placeName = (id) => { try { return O.Island.data().place(id)?.name || id; } catch (e) { return id; } };

    // everything there is to do, here and elsewhere
    function items(s) {
      const out = [], here = s.world.placeId, t = now(s);
      for (const c of (O.wayChoices ? O.wayChoices(s) : [])) out.push({ id: c.id, label: c.label, where: c.l && c.l.id != null ? O.whereabouts && O.whereabouts(s, s.byId.get(c.l.id), s.byId.get(c.l.id)) : '', lead: c.l, mark: true });
      for (const l of PS.leads || []) if (l.place && l.place !== here && l.until > t) out.push({ id: O.wayIdOf(l), label: l.label || 'Somewhere to go', where: `in ${placeName(l.place)}`, lead: l, far: true });
      for (const d of PS.debts || []) out.push({ id: 'debt:' + d.who, label: `Pay ${d.name} back ₳${d.n}`, where: d.due <= s.day ? 'overdue' : `by day ${d.due}`, far: d.place !== here, noX: true, markId: d.place === here ? d.who : null });
      if (PS.fineOwed > 0) out.push({ id: 'fine', label: `A fine of ₳${Math.round(PS.fineOwed)} to pay the watch`, where: 'at the watch house', noX: true });
      return out;
    }
    let sig = '', at = 0, list = [];
    function render() {
      const s = cur(); if (!s || !s.world || O.panelOpen || document.getElementById('tab-play')?.hidden) { el.hidden = true; return; }
      list = items(s);
      const work = O.jobCard, gang = O.gangCard, count = list.length + (work ? work.left : 0);
      if (!list.length && !work && !gang) { el.hidden = true; sig = ''; return; }
      let html;
      if (!PS.todoOpen) html = `<div class="jicon" title="To do"><img src="${O.icon('todo')}" alt="To do">${count ? `<span class="badge">${count}</span>` : ''}</div>`;
      else {
        html = `<div class="th" data-fold>To do <small>fold ▲</small></div>`;
        if (work) html += `<div class="sec">${work.html}</div>`;
        if (gang) html += `<div class="sec">${gang}</div>`;
        if (list.length) html += `<ol>${list.map((x, i) => `<li data-i="${i}" class="${PS.wayTo === x.id ? 'on' : ''} ${x.far ? 'far' : ''}"><span class="m">${PS.wayTo === x.id ? '▶' : x.far ? '·' : '○'}</span><span class="t">${esc(x.label)}${x.where ? `<span class="w">${esc(x.where)}</span>` : ''}</span>${x.noX ? '' : `<span class="x" data-x="${i}" title="Let it go">✕</span>`}</li>`).join('')}</ol>`;
      }
      el.classList.toggle('min', !PS.todoOpen);
      if (html === sig && !el.hidden) return; sig = html; el.innerHTML = html; el.hidden = false;
    }
    el.addEventListener('click', (e) => {
      if (!PS.todoOpen) { PS.todoOpen = true; sig = ''; render(); return; }
      if (e.target.closest('[data-fold]')) { PS.todoOpen = false; sig = ''; render(); return; }
      const x = e.target.closest('[data-x]'); if (x) { const it = list[+x.dataset.x]; if (it && it.lead) { O.dropLead((l) => l === it.lead); if (PS.wayTo === it.id) PS.wayTo = null; } sig = ''; render(); return; }
      const li = e.target.closest('[data-i]'); if (!li) return; const it = list[+li.dataset.i]; if (!it) return;
      if (it.far) return O.UI.say(`That's ${it.where}. The map (M) shows it.`);
      if (it.markId != null) { const s = cur(), q = s.byId.get(it.markId); if (q) { O.addLead({ place: s.world.placeId, id: q.id, why: 'debt', label: `Find ${q.first}`, until: now(s) + 1440 }); PS.wayTo = O.wayIdOf((PS.leads || []).slice(-1)[0]); } }
      else PS.wayTo = PS.wayTo === it.id ? null : it.id;
      sig = ''; render();
    });
    if (PS.todoOpen == null) PS.todoOpen = true;
    game.hooks.update.push((dt) => { at -= dt; if (at > 0) return; at = 0.4; render(); });
    O.Todo = { refresh: () => { sig = ''; render(); } };
  }
  O.TodoSetup = { setup };
})();
