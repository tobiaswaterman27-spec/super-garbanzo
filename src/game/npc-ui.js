// NPC interaction (contextual prompt + talk card) and the Town Ledger inspector.
'use strict';
(function () {
  const G = O.Data.GOODS;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const ACT_LABEL = {
    sleep: 'asleep', work: 'working', fieldwork: 'working the fields', chop: 'felling timber', festival: 'at the harvest festival', lessons: 'at lessons in the chapel', feast: 'at a wedding feast', council: 'away at the castle council', cry: 'crying the news', gangmeet: 'meeting at the hideout', report: 'reporting a crime to the watch', investigate: 'investigating a crime', jailed: 'locked in the cell', market: 'coming to market', service: 'in service at a house', sick: 'ill in bed', collapsed: 'collapsed!', help: 'running to help someone', escort: 'helping a patient to the physician', 'to-doctor': 'going to the physician', treated: 'being treated by the physician', mourn: 'at a funeral', wedding: 'at a wedding', build: 'building the new house', 'move-in': 'moving to Ashford', forage: 'gathering herbs', patrol: 'on patrol', eat: 'having a meal', 'eat-out': 'eating at the tavern',
    home: 'at home', play: 'playing', shop: 'shopping', socialise: 'drinking at the tavern', perform: 'playing for the tavern', recruit: 'calling for recruits', moot: 'at the moot in the square', firefight: 'fighting a fire!', leave: 'on the road out', sit: 'resting on the bench', stroll: 'taking the air', worship: 'at chapel',
    'wait-work': 'waiting for carrying work', pickup: 'collecting goods', deliver: 'making a delivery', 'carry-home': 'carrying shopping home', import: 'bringing goods to market', rest: 'resting at the inn', leave: 'leaving town',
  };
  O.ACT_LABEL = ACT_LABEL;

  function setup(game, sim) {
    const root = game.el.parentElement;
    const card = document.createElement('aside'); card.className = 'hud talk'; card.hidden = true; card.setAttribute('aria-live', 'polite'); root.appendChild(card);
    const ledger = document.createElement('div'); ledger.className = 'ledger'; ledger.hidden = true; root.appendChild(ledger);
    let talking = null, ltab = 'people', lsel = null;

    game.hooks.update.push(() => {
      if (!talking) return;
      const pos = game.scene ? game.scene.personPos(talking) : (talking.agent.hidden ? null : [talking.agent.x, talking.agent.y]);
      if (!pos || Math.hypot(pos[0] - game.player.x, pos[1] - game.player.y) > 60) closeTalk();
    });

    function openTalk(q) {
      talking = q; q.agent.frozen = true;
      const pos = game.scene ? game.scene.personPos(q) || [q.agent.x, q.agent.y] : [q.agent.x, q.agent.y];
      const dx = game.player.x - pos[0], dy = game.player.y - pos[1];
      q.agent.dir = O.dirOf(dx, dy);
      if (game.scene) { const a = game.scene.actors.get(q.id); if (a) a.dir = q.agent.dir; }
      game.player.dir = O.dirOf(-dx, -dy);
      const r = q.rel.get(0) || { affinity: 0, familiar: 0 }; r.familiar = Math.min(1, r.familiar + 0.1); q.rel.set(0, r);
      if (r.familiar <= 0.11) sim.remember(q, 'A stranger stopped me in the street to talk.', 'player', 0.8, 0);
      renderTalk(O.Dialogue.provider.greet(O.Dialogue.buildContext(sim, q), q.id + sim.day));
    }
    function closeTalk() { if (talking) { talking.agent.frozen = false; talking.agent.talking = 0; } talking = null; card.hidden = true; if (O.UI.dialogOpen()) O.UI.dialog.close(); }
    function bar(v, cls = '') { return `<span class="bar ${cls}"><i style="width:${Math.round(O.clamp(v, 0, 100))}%"></i></span>`; }
    // name tag in the colour of their clothes
    function tagColour(q) { const m = q.app?.outfit?.over; const r = m != null && O.Pal.ramp ? O.Pal.ramp(m) : null; return r ? `rgb(${r[2][0]},${r[2][1]},${r[2][2]})` : '#b0683a'; }
    function renderTalk(line) {
      const q = talking; if (!q) return;
      q.agent.talking = 30;
      const bz = q.job?.biz ? sim.biz.get(q.job.biz) : null;
      const atWork = bz && bz.open && q.agent.inside === bz.id && q.activity?.act === 'work' && bz.def.sells.length;
      const innkeeper = bz && bz.type === 'tavern' && q.agent.inside === bz.id && bz.open;
      const options = [];
      for (const [k, l] of (api.extraButtons ? api.extraButtons(q) : [])) options.push({ key: 'x-' + k, label: l, hot: true });
      if (atWork) options.push({ key: 'trade', label: 'Show me your wares', hot: true });
      if (innkeeper) options.push({ key: 'rent', label: 'A room for the night (6d)', hot: true });
      for (const [k, l] of [['self', 'How are you?'], ['work', 'What do you do?'], ['news', 'Any news?'], ['prices', 'How are prices?'], ['family', 'Your family?']]) options.push({ key: k, label: l });
      options.push({ key: 'bye', label: 'Goodbye' });
      O.UI.dialog.open({ name: q.first + (q.title ? `, ${q.title}` : ''), color: tagColour(q), text: line, options, onPick: (t) => pickTopic(q, bz, t), onClose: () => { if (talking === q) { q.agent.frozen = false; q.agent.talking = 0; talking = null; } } });
    }
    function pickTopic(q, bz, t) {
      if (t === 'bye') { const bye = ['Fare you well.', 'God keep you.', 'Mind how you go.', 'Until next time.'][(q.id + sim.day) % 4]; O.UI.dialog.open({ name: q.first, color: tagColour(q), text: bye, options: [] }); talking = null; q.agent.frozen = false; setTimeout(() => { if (O.UI.dialogOpen() && !talking) O.UI.dialog.close(); }, 1600); return; }
      if (t.startsWith('x-')) return api.onExtra && api.onExtra(q, t.slice(2), renderTalk);
      if (t === 'trade') { closeTalk(); return O.Panels.trade(sim, bz, q); }
      if (t === 'rent') {
        const PS = O.PlayerState;
        if (PS.room && PS.room.b === bz.id && sim.day <= PS.room.until) return renderTalk("You've a room already. Top of the stairs.");
        if (PS.money < 6) return renderTalk("Six pence a night, and I don't do credit.");
        PS.money -= 6; bz.cash += 6; PS.room = { b: bz.id, until: sim.day + 1 }; PS.add('key');
        sim.remember(q, 'Let a room to a stranger.', 'work', 0.5, 0);
        return renderTalk("Room's upstairs, first bed on the left. Chest is yours while you stay. Mind the third step.");
      }
      const seed = q.id * 31 + sim.day + Math.floor(sim.minute / 7) + t.length;
      const ctx = O.Dialogue.buildContext(sim, q), line = O.Dialogue.provider.topic(ctx, t, seed);
      if (t === 'news' && ctx._picked && O.Chronicle) O.Chronicle.playerHears(O.Chronicle.byId(ctx._picked.f), ctx._picked.v, ctx._picked.src === 'saw' ? 'rumour' : ctx._picked.src, q.name);
      renderTalk(line);
    }

    // ---------------- ledger ----------------
    function money(d) { d = Math.round(d); const s = Math.floor(d / 12), p = d % 12; return s ? `${s}s ${p}d` : `${p}d`; }
    function renderLedger() {
      if (ledger.hidden) return;
      const tabs = [['people', 'Residents'], ['biz', 'Businesses'], ['town', 'Town'], ['log', 'Chronicle']];
      let body = '';
      if (ltab === 'people') {
        const rows = sim.people.filter((p) => !p.visitor).slice().sort((a, b) => a.household - b.household || b.age - a.age);
        body = `<table><thead><tr><th>Name</th><th>Age</th><th>Occupation</th><th>Home</th><th class="n">Purse</th><th>Doing</th><th>Fed</th></tr></thead><tbody>${rows.map((p) => {
          const hh = sim.household(p), home = sim.building(p.home);
          return `<tr data-id="${p.id}" class="${lsel === p.id ? 'sel' : ''}"><td>${esc(p.name)}</td><td class="n">${p.age}</td><td>${esc(p.job ? p.job.role : p.age < 16 ? (p.age < 3 ? 'baby' : 'child') : 'none')}</td><td>${esc(home?.name || '')} #${home?.id ?? ''}</td><td class="n">${money(hh.money)}</td><td>${esc(ACT_LABEL[p.activity?.act] || '')}</td><td>${bar(p.needs.hunger, p.needs.hunger < 25 ? 'warn' : '')}</td></tr>`;
        }).join('')}</tbody></table>`;
        if (lsel != null) {
          const p = sim.byId.get(lsel);
          if (p) body = `<div class="detail"><b>${esc(p.name)}</b> — ${p.traits.join(', ')}. Goal: ${esc(p.goal || '—')}. Skill: ${p.job ? Math.round((p.skills[p.job.role] || 0) * 100) : '—'}.<br><span class="lbl">Memories</span><ul>${p.memories.slice(0, 6).map((m) => `<li>Day ${m.day}: ${esc(m.text)}</li>`).join('') || '<li>Nothing notable yet.</li>'}</ul></div>` + body;
        }
      } else if (ltab === 'biz') {
        body = `<div class="bizgrid">${[...sim.biz.values()].map((bz) => {
          const owner = sim.byId.get(bz.owner);
          const stock = Object.entries(bz.stock).map(([g, q]) => `<tr><td>${G[g].name}</td><td class="n">${Math.floor(q)}</td><td class="n">${bz.def.sells.includes(g) ? sim.price(bz, g) + 'd' : '—'}</td></tr>`).join('');
          const orders = bz.orders.map((o) => `${o.qty} ${G[o.good].name.toLowerCase()} from ${sim.biz.get(o.from)?.name || 'trader'}`).join('; ');
          return `<section class="biz"><h3>${esc(bz.name)} <span class="pill ${bz.open ? 'ok' : ''}">${bz.open ? 'OPEN' : 'CLOSED'}</span></h3>
            <div class="lbl">${owner ? 'Owner ' + esc(owner.name) + ' · ' : ''}${bz.workers.length} staff · till ${money(bz.cash)} · sold today ${money(bz.salesToday)}</div>
            <table><thead><tr><th>Stock</th><th class="n">Qty</th><th class="n">Price</th></tr></thead><tbody>${stock || '<tr><td colspan="3">No goods</td></tr>'}</tbody></table>
            ${orders ? `<div class="lbl">On order: ${esc(orders)}</div>` : ''}</section>`;
        }).join('')}</div>`;
      } else if (ltab === 'town') {
        const pop = sim.people.filter((p) => !p.visitor);
        const stages = {}; pop.forEach((p) => (stages[p.stage] = (stages[p.stage] || 0) + 1));
        const hungry = pop.filter((p) => p.needs.hunger < 25).length;
        const purse = sim.households.reduce((s, h) => s + h.money, 0);
        const employed = pop.filter((p) => p.job).length, adults = pop.filter((p) => p.age >= 16 && p.age < 66).length;
        body = `<div class="kv">
          <div><span class="lbl">Population</span><b>${pop.length}</b><small>${Object.entries(stages).map(([k, v]) => `${v} ${k.replace(/([A-Z])/g, ' $1').toLowerCase()}`).join(', ')}</small></div>
          <div><span class="lbl">Households</span><b>${sim.households.length}</b><small>combined purse ${money(purse)}</small></div>
          <div><span class="lbl">Employment</span><b>${employed}/${adults}</b><small>working-age adults with a trade</small></div>
          <div><span class="lbl">Going hungry</span><b class="${hungry ? 'warn' : ''}">${hungry}</b><small>residents with an empty belly</small></div>
          <div><span class="lbl">Treasury</span><b>${money(sim.treasury.cash)}</b><small>taxes in ${money(sim.treasury.income)} · wages out ${money(sim.treasury.spent)}</small></div>
          <div><span class="lbl">Trade</span><b>${money(sim.stats.sales)}</b><small>all sales since you arrived · wages paid ${money(sim.stats.wages)} · exports ${money(sim.stats.exports || 0)}</small></div>
          <div><span class="lbl">Health</span><b class="${pop.filter((p) => p.health.illness).length > 6 ? 'warn' : ''}">${pop.filter((p) => p.health.illness).length} ill</b><small>sanitation ${Math.round(sim.settlement.sanitation * 100)}% · ${pop.filter((p) => p.activity?.act === 'treated').length} with the physician${sim.settlement.outbreak ? ' · OUTBREAK' : ''}</small></div>
          <div><span class="lbl">Births & deaths</span><b>${sim.history.filter((h) => h.kind === 'life' && /was born/.test(h.text)).length} · ${sim.dead.length}</b><small>${sim.dead.slice(-2).map((d) => `${d.name} (${d.age})`).join(', ') || 'none buried yet'}</small></div>
          <div><span class="lbl">Produced</span><b>${Math.round(sim.stats.produced.bread || 0)} loaves</b><small>${Object.entries(sim.stats.produced).filter(([g]) => g !== 'bread').map(([g, q]) => `${Math.round(q)} ${G[g].name.toLowerCase()}`).join(', ')}</small></div>
        </div>`;
      } else {
        body = `<ol class="chron">${sim.history.slice().reverse().slice(0, 80).map((h) => `<li><span class="lbl">Day ${h.day} ${String(Math.floor(h.minute / 60)).padStart(2, '0')}:${String(h.minute % 60).padStart(2, '0')}</span> ${esc(h.text)}</li>`).join('')}</ol>`;
      }
      ledger.innerHTML = `<div class="ledger-in"><header><h2>${esc(sim.world.name)} Ledger</h2><nav>${tabs.map(([k, l]) => `<button data-lt="${k}" aria-pressed="${k === ltab}">${l}</button>`).join('')}</nav><button class="x" aria-label="Close ledger">✕</button></header><div class="ledger-body">${body}</div></div>`;
      ledger.querySelectorAll('[data-lt]').forEach((b) => b.onclick = () => { ltab = b.dataset.lt; lsel = null; renderLedger(); });
      ledger.querySelector('.x').onclick = () => toggleLedger(false);
      ledger.querySelectorAll('tr[data-id]').forEach((tr) => tr.onclick = () => { lsel = lsel === +tr.dataset.id ? null : +tr.dataset.id; renderLedger(); });
    }
    function toggleLedger(v) {
      const keep = ledger.querySelector('.ledger-body')?.scrollTop || 0;
      ledger.hidden = v === undefined ? !ledger.hidden : !v;
      renderLedger(); const lb = ledger.querySelector('.ledger-body'); if (lb) lb.scrollTop = keep;
    }
    let acc = 0;
    game.hooks.update.push((dt) => { acc += dt; if (acc > 1.5 && !ledger.hidden) { acc = 0; const lb = ledger.querySelector('.ledger-body'); const st = lb ? lb.scrollTop : 0; renderLedger(); const nb = ledger.querySelector('.ledger-body'); if (nb) nb.scrollTop = st; } });

    game.keyHandlers.push((e) => {
      if (e.code === 'KeyL') { toggleLedger(); return true; }
      if (e.code === 'Escape' && (talking || !ledger.hidden)) { closeTalk(); toggleLedger(false); return true; }
      return false;
    });
    const api = { openTalk, closeTalk, toggleLedger, talking: () => talking };
    O.npcUI = api;
    return api;
  }
  O.NpcUI = { setup };
})();
