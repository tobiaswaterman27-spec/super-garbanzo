// Modal panels: inventory, trading, container search, toasts. Item icons are generated pixel art.
'use strict';
(function () {
  const G = O.Data.GOODS, PS = O.PlayerState;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const money = (d) => { d = Math.round(d); const s = Math.floor(d / 12), p = d % 12; return s ? `${s}s ${p}d` : `${p}d`; };
  O.money = money;

  // ---- 14x14 item icons drawn with the material raster ----
  const iconCache = new Map();
  function icon(k) {
    if (iconCache.has(k)) return iconCache.get(k);
    const P = O.Pal, B = new O.MatBuffer(14, 14), col = O.Furn.GOOD_COL[k];
    B.part(1);
    const m = (hex, kind = 'cloth') => P.mat(hex, kind);
    switch (k) {
      case 'bread': B.blob(7, 8, 5.5, 3.6, m('#c88a45', 'wood'), { power: 2 }); B.tweak(5, 6, 1); B.tweak(8, 6, 1); B.tweak(6, 7, -1); B.tweak(9, 7, -1); break;
      case 'cabbage': B.blob(7, 8, 5, 4.5, m('#6a9a44'), { power: 2 }); B.tweak(7, 6, 1); B.tweak(5, 9, -1); B.tweak(9, 8, -1); break;
      case 'flour': case 'wheat': B.blob(7, 8, 4.5, 5, m(k === 'flour' ? '#e6dcc4' : '#d8b048', k === 'flour' ? 'cloth' : 'hair'), { power: 2 }); B.rect(6, 2, 3, 2, m('#7a5634'), 1); break;
      case 'ale': B.rect(4, 3, 6, 9, m('#7a5634', 'wood'), 2); B.rect(10, 5, 2, 4, m('#7a5634', 'wood'), 1); B.rect(4, 3, 6, 2, m('#f0e8d0'), 3); break;
      case 'meal': B.blob(7, 9, 5.5, 3, m('#8a6239', 'wood'), { power: 2 }); B.blob(7, 7, 4, 1.5, m('#a0603a'), { power: 2 }); break;
      case 'logs': case 'firewood': for (const [x, y] of [[4, 9], [10, 9], [7, 5]]) { B.blob(x, y, 2.6, 2.6, m('#7c5a38', 'wood'), { power: 2 }); B.plot(x, y, m('#c8a070', 'wood'), 3); } break;
      case 'iron': B.poly([[2, 10], [12, 10], [10, 5], [4, 5]], [0, -0.6, 0.8], m('#7a7e88', 'metal')); break;
      case 'tools': B.capsule(4, 12, 9, 4, 0.8, 0.8, m('#8a6239', 'wood')); B.rect(7, 2, 6, 3, m('#9aa0aa', 'metal'), 3); break;
      case 'medicine': B.rect(5, 4, 4, 8, m('#6a9ad0', 'metal'), 3); B.rect(6, 2, 2, 2, m('#c8b8a0'), 3); break;
      case 'herbs': for (let i = 0; i < 4; i++) B.capsule(5 + i * 1.5, 12, 3 + i * 2.5, 3, 0.6, 0.9, m('#5a9a40')); break;
      case 'dagger': B.capsule(3, 11, 10, 3, 0.9, 0.5, m('#c8ccd4', 'metal')); B.capsule(2, 9, 6, 13, 0.6, 0.6, m(P.metal.brass, 'metal')); break;
      case 'sword': B.capsule(2, 12, 11, 3, 0.9, 0.6, m(P.metal.steel, 'metal')); B.capsule(2, 9, 6, 13, 0.7, 0.7, m(P.metal.brass, 'metal')); break;
      case 'axe': B.capsule(4, 12, 9, 3, 0.7, 0.7, m('#8a6239', 'wood')); B.blob(10, 4, 2.6, 2, m(P.metal.steel, 'metal'), { power: 2 }); break;
      case 'spoon': B.capsule(3, 11, 9, 5, 0.6, 0.6, m(P.metal.silver, 'metal')); B.blob(10, 4, 2, 1.6, m(P.metal.silver, 'metal'), { power: 2 }); break;
      case 'brooch': B.blob(7, 7, 4.5, 4.5, m(P.metal.gold, 'metal'), { power: 2 }); B.blob(7, 7, 2, 2, m('#c83a3a'), { power: 2 }); break;
      case 'candlestick': B.rect(6, 4, 2, 7, m('#9a9a96', 'metal'), 3); B.rect(4, 11, 6, 2, m('#9a9a96', 'metal'), 2); B.rect(6, 2, 2, 2, m(P.cloth.white), 3); break;
      case 'key': B.blob(4, 7, 2.5, 2.5, m(P.metal.brass, 'metal'), { power: 2 }); B.rect(6, 6, 6, 2, m(P.metal.brass, 'metal'), 3); B.rect(10, 8, 2, 2, m(P.metal.brass, 'metal'), 2); break;
      case 'coins': for (const [x, y] of [[5, 9], [9, 9], [7, 6]]) B.blob(x, y, 2.4, 1.6, m(P.metal.silver, 'metal'), { power: 2 }); break;
      default: B.blob(7, 7, 4, 4, m(col || '#a0a0a0'), { power: 2 });
    }
    const c = B.toCanvas(); const url = c.toDataURL(); iconCache.set(k, url); return url;
  }
  O.icon = icon;

  let root = null, toastEl = null;
  function ensure() {
    if (root) return;
    const host = document.getElementById('tab-play');
    root = document.createElement('div'); root.className = 'ledger panel-modal'; root.hidden = true; host.appendChild(root);
    toastEl = document.createElement('div'); toastEl.className = 'toasts'; toastEl.setAttribute('aria-live', 'polite'); host.appendChild(toastEl);
  }
  // happenings are read out one at a time along the bottom of the screen
  function toast(text, kind = '') { O.UI && O.UI.say(text, kind); }
  function close() { ensure(); root.hidden = true; root.innerHTML = ''; O.panelOpen = false; toastEl.classList.remove('low'); }
  function open(title, body, onBind) {
    ensure(); O.panelOpen = true; toastEl.classList.add('low'); // toasts drop below the panel so they don't hide its title
    root.hidden = false;
    root.innerHTML = `<div class="ledger-in narrow"><header><h2>${esc(title)}</h2><div style="flex:1"></div><span class="purse">${money(PS.money)}</span><button class="x" aria-label="Close">✕</button></header><div class="ledger-body">${body}</div></div>`;
    root.querySelector('.x').onclick = close;
    onBind && onBind(root);
  }
  const slotHTML = (k, btns = '') => `<div class="slot"><img src="${icon(k)}" alt=""><span>${esc(G[k]?.name || k)}</span>${btns}</div>`;

  function inventory() {
    const used = PS.slotsUsed();
    const cells = PS.items.map((k, i) => `<div class="slot"><img src="${icon(k)}" alt=""><span>${esc(G[k].name)}</span>${G[k].food ? `<button data-eat="${i}">Eat</button>` : ''}${G[k].weapon ? `<button data-eq="${k}">${PS.equipped === k ? 'In hand' : 'Hold'}</button>` : ''}<button data-drop="${i}" class="ghost">Drop</button></div>`).join('');
    const empty = Math.max(0, PS.SLOTS - used);
    open('Satchel', `<div class="lbl">${used}/${PS.SLOTS} slots · health ${Math.round(PS.hp)} · fed ${Math.round(PS.hunger)} · rested ${Math.round(PS.energy)}</div>
      <div class="slots">${cells}${'<div class="slot empty"></div>'.repeat(empty)}</div>
      <div class="lbl" style="margin-top:12px">Reputation</div>
      <div class="reps">${Object.entries(PS.rep).map(([k, v]) => `<div><span>${k === 'local' ? 'here' : k}</span><b class="${v < -0.2 ? 'warn' : ''}">${v > 0.6 ? 'admired' : v > 0.2 ? 'liked' : v > -0.2 ? 'unknown' : v > -0.6 ? 'distrusted' : 'hated'}</b></div>`).join('')}</div>
      ${O.Work ? `<div class="lbl" style="margin-top:12px">Skills</div><div class="reps">${Object.entries(PS.skills || {}).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<div><span>${esc(O.Work.SKILL_LABEL[k] || k)}</span><b>${O.Work.rank(v)} · ${Math.round(v * 100)}</b></div>`).join('')}</div>
      <p class="caption">${(() => { const J = PS.job; if (!J) return 'No employer. Ask a master at their workplace for a day\'s work.'; return `${J.apprentice ? 'Apprentice' : 'Hired for the day'} at ${esc(J.bizName)}, ${esc(J.placeName)}, under ${esc(J.masterName)}.`; })()}${PS.earned ? ` Earned honestly so far: ${money(PS.earned)}.` : ''}</p>` : ''}`, (r) => {
      r.querySelectorAll('[data-eat]').forEach((b) => b.onclick = () => { const k = PS.items[+b.dataset.eat]; PS.eat(k); toast(`You eat the ${G[k].name.toLowerCase()}.`); inventory(); });
      r.querySelectorAll('[data-eq]').forEach((b) => b.onclick = () => { PS.equipped = PS.equipped === b.dataset.eq ? 'fists' : b.dataset.eq; const a = O.game.player.a; a.outfit.item = PS.equipped === 'fists' ? null : PS.equipped; O.Char.invalidate(a); inventory(); });
      r.querySelectorAll('[data-drop]').forEach((b) => b.onclick = () => { const k = PS.items[+b.dataset.drop]; if (O.dropItem) O.dropItem(k); else { PS.remove(k); toast(`Dropped ${G[k].name.toLowerCase()}.`); } inventory(); });
    });
  }

  function trade(sim, bz, seller) {
    const no = O.refusesTrade && O.refusesTrade(seller); if (no) return toast(no, 'bad');
    const price = (g) => (O.priceFor ? O.priceFor(sim, bz, g, seller) : sim.price(bz, g));
    const sells = bz.def.sells.filter((g) => (bz.stock[g] || 0) >= 1);
    const buyable = [...new Set(PS.items)].filter((k) => bz.def.targets[k] != null && !G[k].valuable);
    const rows = sells.map((g) => `<tr><td><img class="ic" src="${icon(g)}" alt=""> ${G[g].name}</td><td class="n">${Math.floor(bz.stock[g])}</td><td class="n">${price(g)}d</td><td><button data-buy="${g}">Buy</button></td></tr>`).join('') || '<tr><td colspan="4">Nothing for sale right now.</td></tr>';
    const srows = buyable.map((g) => `<tr><td><img class="ic" src="${icon(g)}" alt=""> ${G[g].name} ×${PS.count(g)}</td><td class="n">${Math.max(1, Math.floor(sim.price(bz, g) * 0.6 * (2 - price(g) / Math.max(1, sim.price(bz, g)))))}d</td><td><button data-sell="${g}">Sell</button></td></tr>`).join('');
    const vals = PS.items.filter((k) => G[k].valuable);
    open(`${bz.name}`, `<div class="lbl">${esc(seller.name)} minds the counter · till ${money(bz.cash)}</div>
      <table><thead><tr><th>For sale</th><th class="n">Stock</th><th class="n">Price</th><th></th></tr></thead><tbody>${rows}</tbody></table>
      ${srows ? `<table style="margin-top:12px"><thead><tr><th>You could sell</th><th class="n">Offer</th><th></th></tr></thead><tbody>${srows}</tbody></table>` : ''}
      ${vals.length ? `<p class="caption">${esc(seller.first)} eyes your ${G[vals[0]].name.toLowerCase()} but won't touch it. Honest traders don't buy goods like that. You'd need a fence.</p>` : ''}`, (r) => {
      r.querySelectorAll('[data-buy]').forEach((b) => b.onclick = () => {
        const g = b.dataset.buy, pr = price(g);
        if (PS.money < pr) return toast(`You can't afford ${G[g].name.toLowerCase()} at ${pr}d.`, 'bad');
        if (!PS.canCarry(g)) return toast('Your satchel is full.', 'bad');
        PS.money -= pr; PS.add(g); bz.stock[g] -= 1; bz.cash += pr * (1 - sim.treasury.taxRate); sim.treasury.cash += pr * sim.treasury.taxRate; bz.salesToday += pr; sim.stats.sales += pr;
        const r0 = seller.rel.get(0) || { affinity: 0, familiar: 0 }; r0.affinity = Math.min(1, r0.affinity + 0.02); seller.rel.set(0, r0);
        PS.rep.merchant = Math.min(1, PS.rep.merchant + 0.005);
        trade(sim, bz, seller);
      });
      r.querySelectorAll('[data-sell]').forEach((b) => b.onclick = () => {
        const g = b.dataset.sell, pr = Math.max(1, Math.floor(sim.price(bz, g) * 0.6 * (2 - price(g) / Math.max(1, sim.price(bz, g)))));
        if (bz.cash < pr) return toast(`${bz.name} can't afford to buy.`, 'bad');
        PS.remove(g); PS.money += pr; bz.cash -= pr; bz.stock[g] = (bz.stock[g] || 0) + 1; trade(sim, bz, seller);
      });
    });
  }

  function container(title, items, onTake, note) {
    const rows = items.map((it, i) => `<div class="slot"><img src="${icon(it.k)}" alt=""><span>${esc(it.k === 'coins' ? `${it.n}d in coin` : `${G[it.k].name}${it.n > 1 ? ' ×' + it.n : ''}`)}</span><button data-take="${i}">Take</button></div>`).join('');
    open(title, `${note ? `<p class="caption warnnote">${esc(note)}</p>` : ''}<div class="slots">${rows || '<p class="caption">Empty.</p>'}</div>${items.length > 1 ? '<button class="btn" data-all="1" style="margin-top:10px">Take everything</button>' : ''}`, (r) => {
      r.querySelectorAll('[data-take]').forEach((b) => b.onclick = () => onTake([+b.dataset.take]));
      const all = r.querySelector('[data-all]'); if (all) all.onclick = () => onTake(items.map((_, i) => i));
    });
  }

  O.Panels = { inventory, trade, container, toast, close, open, slotHTML };
})();
