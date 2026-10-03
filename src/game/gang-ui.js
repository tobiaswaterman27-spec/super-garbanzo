// Gang interface: claiming the camp, recruiting in conversation, the gang ledger (G), the stash,
// orders for night jobs, hideout upgrades, and selling stolen goods to your fence.
'use strict';
(function () {
  const PS = O.PlayerState, G = O.Data.GOODS, esc = (s) => O.escape(s);
  PS.stash = PS.stash || [];

  function setup(game, simRef, npcUI) {
    const money = O.money;
    const sim = new Proxy({}, { get: (t, k) => { const s = O.SimRef.home; const v = s[k]; return typeof v === 'function' ? v.bind(s) : v; } });

    function claim(b) {
      O.Panels.open('Claim the camp', `<p class="caption">A cold fire ring, a torn tent, a chest with a broken hasp. Nobody has slept here in a year. Make it yours and you'll need a name men can whisper in taverns.</p>
        <label class="lbl" for="gangName">Name your band</label><input type="text" id="gangName" maxlength="28" value="The Hollow Hands" style="margin:6px 0 10px;width:100%">
        <button class="btn" data-claim="1">Claim it</button>`, (r) => {
        r.querySelector('[data-claim]').onclick = () => {
          const name = (r.querySelector('#gangName').value || '').trim() || 'The Hollow Hands';
          sim.foundGang(name, b); b.dirty = true; PS.rep.criminal = Math.min(1, PS.rep.criminal + 0.05);
          O.Panels.close(); O.Panels.toast(`${name} has a home. Press G to manage your band.`);
        };
      });
    }

    function stash() {
      const rows = PS.stash.map((k, i) => `<div class="slot"><img src="${O.icon(k)}" alt=""><span>${esc(G[k].name)}</span><button data-take="${i}">Take</button></div>`).join('');
      const mine = PS.items.map((k, i) => `<div class="slot"><img src="${O.icon(k)}" alt=""><span>${esc(G[k].name)}</span><button data-put="${i}">Stash</button></div>`).join('');
      O.Panels.open('Hideout stash', `<div class="lbl">In the stash · ${PS.stash.length}/40</div><div class="slots">${rows || '<p class="caption">Empty.</p>'}</div><div class="lbl" style="margin-top:12px">Your satchel</div><div class="slots">${mine || '<p class="caption">Nothing.</p>'}</div>`, (r) => {
        r.querySelectorAll('[data-take]').forEach((x) => x.onclick = () => { const k = PS.stash[+x.dataset.take]; if (!PS.add(k)) return O.Panels.toast('Your satchel is full.'); PS.stash.splice(+x.dataset.take, 1); stash(); });
        r.querySelectorAll('[data-put]').forEach((x) => x.onclick = () => { if (PS.stash.length >= 40) return; const k = PS.items[+x.dataset.put]; PS.items.splice(+x.dataset.put, 1); PS.stash.push(k); if (PS.stolen[k]) PS.stolen[k]--; stash(); });
      });
    }

    function fence(seller, cut = 0.55) {
      const vals = [...new Set(PS.items)].filter((k) => G[k].valuable || PS.stolen[k]);
      const rows = vals.map((k) => `<tr><td><img class="ic" src="${O.icon(k)}" alt=""> ${G[k].name} ×${PS.count(k)}</td><td class="n">${Math.max(1, Math.round(G[k].base * cut))}d</td><td><button data-sell="${k}">Sell</button></td></tr>`).join('');
      O.Panels.open(`${seller.name}, fence`, `<p class="caption">“No questions. Half and a bit of what it's worth, take it or leave it.”</p><table><thead><tr><th>Goods</th><th class="n">Offer</th><th></th></tr></thead><tbody>${rows || '<tr><td colspan="3">You have nothing worth fencing.</td></tr>'}</tbody></table>`, (r) => {
        r.querySelectorAll('[data-sell]').forEach((x) => x.onclick = () => { const k = x.dataset.sell, pr = Math.max(1, Math.round(G[k].base * cut)); PS.remove(k); PS.money += pr; if (PS.stolen[k]) PS.stolen[k]--; PS.rep.criminal = Math.min(1, PS.rep.criminal + 0.01); fence(seller, cut); });
      });
    }

    function ledger() {
      const g = sim.playerGang();
      if (!g) return O.Panels.toast('You have no band yet. Find somewhere to make camp in Ashford Wood.');
      const L = O.Gangs.LEVELS, next = L[g.level + 1];
      const houses = sim.households.filter((h) => !h.gone && h.members.length).map((h) => ({ h, b: sim.building(h.home) })).filter((x) => x.b);
      const mem = g.members.map((m, i) => {
        const p = sim.byId.get(m.id); if (!p) return '';
        const ordered = (g.orders || []).find((o) => o.member === m.id);
        return `<tr><td>${esc(p.name)}<br><small class="lbl">${p.age} · ${esc(p.job?.role || 'no trade')}${p.jailUntil ? ' · IN THE CELL' : ''}</small></td>
          <td><select data-role="${i}">${O.Gangs.ROLES.map((r) => `<option ${r === m.role ? 'selected' : ''}>${r}</option>`).join('')}</select></td>
          <td><span class="bar ${m.loyalty < 0.3 ? 'warn' : ''}"><i style="width:${Math.round(m.loyalty * 100)}%"></i></span></td>
          <td class="n">${m.wage}d <button data-wage="${i}" data-d="1">+</button><button data-wage="${i}" data-d="-1">−</button></td>
          <td>${ordered ? `Tonight: the ${esc(sim.households.find((h) => h.home === ordered.target)?.surname || '')} house` : `<select data-job="${i}"><option value="">No job</option>${houses.map(({ h, b }) => `<option value="${b.id}">Burgle the ${esc(h.surname)} house (${b.wealth > 0.6 ? 'rich' : b.wealth > 0.35 ? 'comfortable' : 'poor'})</option>`).join('')}</select>`}</td></tr>`;
      }).join('');
      O.Panels.open(g.name, `<div class="kv">
          <div><span class="lbl">Purse</span><b>${money(g.purse)}</b><small><button data-dep="10">Give 10d</button> <button data-wd="10">Take 10d</button></small></div>
          <div><span class="lbl">Hideout</span><b>${L[g.level].name}</b><small>${next ? `<button data-up="1">Build a ${next.name.toLowerCase()} · ${next.cost}d</button>` : 'As grand as it gets.'}</small></div>
          <div><span class="lbl">Influence</span><b>${Math.round(g.influence * 100)}%</b><small>rivals: the Crows (${Math.round((sim.gang('crows')?.influence || 0) * 100)}%)</small></div>
          <div><span class="lbl">Wages due</span><b>${g.members.reduce((s, m) => s + m.wage, 0)}d/day</b><small>paid from the purse each dawn</small></div>
        </div>
        <table style="margin-top:12px"><thead><tr><th>Member</th><th>Role</th><th>Loyalty</th><th class="n">Wage</th><th>Tonight</th></tr></thead><tbody>${mem || '<tr><td colspan="5">No members yet. Sound out the desperate and the reckless — in the tavern, in the square.</td></tr>'}</tbody></table>
        <div class="lbl" style="margin-top:12px">Recent</div><ol class="chron">${g.log.slice(-6).reverse().map((t) => `<li>${esc(t)}</li>`).join('') || '<li>Nothing yet.</li>'}</ol>`, (r) => {
        r.querySelector('[data-dep]').onclick = () => { if (PS.money >= 10) { PS.money -= 10; g.purse += 10; ledger(); } };
        r.querySelector('[data-wd]').onclick = () => { if (g.purse >= 10) { g.purse -= 10; PS.money += 10; ledger(); } };
        const up = r.querySelector('[data-up]'); if (up) up.onclick = () => { if (sim.upgradeHideout(g)) { O.Panels.toast(`Your band now has a ${L[g.level].name.toLowerCase()}.`); ledger(); } else O.Panels.toast('The purse is too light for that.', 'bad'); };
        r.querySelectorAll('[data-role]').forEach((x) => x.onchange = () => { g.members[+x.dataset.role].role = x.value; });
        r.querySelectorAll('[data-wage]').forEach((x) => x.onclick = () => { const m = g.members[+x.dataset.wage]; m.wage = O.clamp(m.wage + +x.dataset.d, 0, 20); m.loyalty = O.clamp(m.loyalty + (+x.dataset.d > 0 ? 0.04 : -0.06), 0, 1); ledger(); });
        r.querySelectorAll('[data-job]').forEach((x) => x.onchange = () => { if (!x.value) return; g.orders = g.orders || []; g.orders.push({ member: g.members[+x.dataset.job].id, target: +x.value }); ledger(); });
      });
    }

    // talk-card extensions: recruit, fence, gang chatter
    npcUI.extraButtons = (q) => {
      const g = sim.playerGang(), out = [];
      if (g && !q.gang && q.age >= 16 && !q.job?.role?.startsWith('guard') && O.SimRef.cur === O.SimRef.home) out.push(['recruit', 'Sound them out']);
      if (q.gang === 'player') { const m = g?.members.find((x) => x.id === q.id); if (m?.role === 'fence') out.push(['fence', 'Fence goods']); }
      if (!g && q.gang === 'crows' && PS.rep.criminal > 0.04) out.push(['fence', 'Sell them stolen goods']);
      return out;
    };
    npcUI.onExtra = (q, key, render) => {
      if (key === 'fence') { npcUI.closeTalk(); return fence(q, q.gang === 'player' ? 0.6 : 0.45); }
      if (key === 'recruit') {
        const g = sim.playerGang();
        if (q._asked === sim.day) return render('"I told you what I think. Leave it."');
        q._asked = sim.day;
        const c = sim.recruitChance(q);
        if (sim.rng.chance(c)) {
          const wage = Math.max(2, Math.min(8, Math.round(4 + (sim.household(q).money > 60 ? 2 : 0) - (q.traits.includes('loyal') ? 1 : 0))));
          sim.joinGang(q, 'player', wage);
          return render(`"…${wage} pence a day, and you keep my name out of it. I'm in."`);
        }
        sim.relate(q, { id: 0 }, -0.08);
        if (c < 0.15 && sim.rng.chance(0.4)) { sim.remember(q, 'A stranger tried to recruit me into a gang.', 'crime', 1.2, 0); return render('"I know what you are. Get away from me before I call the watch."'); }
        return render(q.traits.includes('cautious') ? '"That sort of life ends at the end of a rope."' : '"Not today. Ask me again when I\'m hungrier."');
      }
    };

    game.keyHandlers.push((e) => {
      if (e.code === 'KeyG' && !O.panelOpen) { ledger(); return true; }
      return false;
    });

    O.GangUI = { claim, stash, ledger, fence };
  }
  O.GangUISetup = { setup };
})();
