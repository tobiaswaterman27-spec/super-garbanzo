// Said, not clicked: the rest of it. Wherever a person would have put a list of buttons in front of you
// (the stablemaster's horses, the parish clerk's empty houses, the moneylender's terms, the fair stall,
// the bandits on the road, your dog), they say it instead, and you answer in your own words: "I'll take
// the grey mare", "rent me the one by the mill", "lend me twenty", "here, take my purse", "heel!".
// What you say is matched to what's on offer and done just as before; anything else is ordinary talk.
// Letters can agree to more as well: hire, lend, sell, rent, take on.
'use strict';
(function () {
  const STOP = new Set(['the', 'and', 'for', 'you', 'your', 'with', 'this', 'that', 'will', 'have', 'from', 'are', 'one', 'can', 'please', 'would', 'like', 'want', 'just', 'then', 'them', 'its', "i'll", 'ill', 'let', 'give', 'me', 'my']);
  const SYN = {
    buy: ['buy', 'purchase', 'take', 'have', 'want', 'get', 'ill', "i'll"], sell: ['sell', 'offload', 'part'], rent: ['rent', 'lease', 'let', 'live'],
    borrow: ['borrow', 'lend', 'loan'], pay: ['pay', 'hand', 'purse', 'give', 'settle', 'coin', 'money'], fight: ['fight', 'draw', 'attack', 'stand', 'blade', 'sword'],
    run: ['run', 'flee', 'spur', 'escape', 'bolt', 'ride'], feed: ['feed', 'oats', 'hay', 'wheat'], stroke: ['stroke', 'pat', 'scratch'], come: ['come', 'heel', 'follow', 'along', 'here'],
    stay: ['stay', 'wait', 'remain'], home: ['home', 'keep', 'watch', 'guard'], sit: ['sit', 'down'], give: ['give', 'end', 'quit'], bet: ['bet', 'wager', 'stake'],
    enter: ['enter', 'ride', 'compete', 'join', 'try', 'shoot', 'wrestle'], watch: ['watch', 'look', 'see'], take: ['take', 'accept', 'yes', 'aye'], not: ['not', 'no', 'nay', 'later'],
  };
  const words = (t) => String(t).toLowerCase().replace(/[₳.,!?;:"“”()]/g, ' ').split(/\s+/).filter(Boolean);
  const nums = (t) => (String(t).match(/\d+/g) || []).map(Number);
  function score(text, opt) {
    const w = words(text), lab = words(opt.label), ctx = words(opt.ctx), have = new Set(w);
    let sc = 0;
    // the verb of the button, or a word that means it
    for (const lw of lab) { if (have.has(lw) && !STOP.has(lw)) sc += 3; for (const [k, syn] of Object.entries(SYN)) if ((lw === k || syn.includes(lw)) && syn.some((x) => have.has(x))) sc += 2; }
    // the thing it's about: a horse's name, a house, a good
    for (const cw of ctx) if (cw.length > 2 && !STOP.has(cw) && have.has(cw)) sc += 1.5;
    // a number said that matches the button's number
    const tn = nums(text), on = nums(opt.label + ' ' + opt.ctx); if (tn.length && on.length) sc += tn.some((n) => on.includes(n)) ? 3 : -2;
    return sc;
  }
  const textOf = (el) => { const c = el.cloneNode(true); c.querySelectorAll('button, input, select, textarea, .x, script, style').forEach((x) => x.remove()); return c.textContent.replace(/\s+/g, ' ').trim(); };

  function setup(game) {
    const PS = O.PlayerState, cur = () => O.SimRef.cur;
    const free = () => !!(O.AI && O.AI.ready);
    // who you were just talking to, and when
    let lastQ = null, lastT = -1e9;
    game.hooks.update.push(() => { const t = O.npcUI && O.npcUI.talking && O.npcUI.talking(); if (t) { lastQ = t; lastT = performance.now(); } });
    // (and whoever was just spoken to, even before the talk card is up)
    if (O.AIChat) { const _s = O.AIChat.say; O.AIChat.say = function (q) { if (q && q.id != null) { lastQ = q; lastT = performance.now(); } return _s.apply(this, arguments); }; }
    { const n = O.npcUI; if (n && n.openTalk) { const _o = n.openTalk; n.openTalk = function (q) { if (q) { lastQ = q; lastT = performance.now(); } return _o.apply(this, arguments); }; } }
    // panels that stay panels: your own books and plans, not a person's offer
    const OWN = /^(Songs and tunes|Satchel|Guide|How folk see you|Chronicle|Notice board|Map|The realm|Ledger|Settings|Business|Holdings|Your gang|Undertakings|Where to|A letter|Letters|Write a letter|What's on|Decorat)/i;
    // the few with no person behind them, and who "says" them
    const VOICE = [[/^Bandits/i, 'The bandits'], [/^The magistrate/i, 'The magistrate'], [/council|moot/i, 'The council']];

    const P = O.Panels, _open = P.open;
    P.open = function (title, body, onBind) {
      const r = _open.apply(this, arguments);
      try {
        if (!free() || OWN.test(String(title))) return r;
        const root = [...document.querySelectorAll('.ledger-in')].reverse().find((e) => e.getClientRects().length && (e.querySelector('h2') || {}).textContent === String(title)); if (!root) return r;
        if (root.querySelector('input:not([type=hidden]), textarea, select')) return r; // (forms with typing stay as they are)
        const btns = [...root.querySelectorAll('.ledger-body button')].filter((b) => typeof b.onclick === 'function' && !b.classList.contains('x'));
        if (!btns.length) return r;
        const recent = lastQ && performance.now() - lastT < 4000 ? lastQ : null;
        const pet = btns.some((b) => b.dataset && b.dataset.m === 'heel');
        const voice = VOICE.find(([re]) => re.test(String(title))) || (pet ? [null, String(title)] : null);
        if (!recent && !voice) return r;
        const opts = btns.map((b) => ({ label: b.textContent.replace(/\s+/g, ' ').trim(), ctx: textOf(b.closest('tr') || b.parentElement || b), fn: b.onclick, el: b }));
        const said = textOf(root.querySelector('.ledger-body')).slice(0, 420);
        const q = voice ? null : recent; const name = q ? q.first : (voice && voice[1]) || String(title);
        P.close();
        converse(pet ? null : q, name, said, opts, String(title), { pet, must: /^(Bandits|The magistrate)/i.test(String(title)) });
      } catch (e) { console.error(e); }
      return r;
    };

    function converse(q, name, said, opts, title, o = {}) {
      let chosen = false;
      const col = '#8a6239';
      const hint = opts.slice(0, 4).map((o) => o.label.toLowerCase()).join(', ');
      const show = (text) => O.UI.dialog.open({ name, color: col, text, options: [], chat: (t) => answer(t), onClose: () => { if (o.must && !chosen) setTimeout(() => show(title.startsWith('Bandits') ? '“Not so fast. Purse, or blood, or run.”' : 'The magistrate waits for your answer.'), 200); } });
      function answer(t) {
        if (!o.must && /^(no|nothing|never mind|not now|goodbye|farewell|bye|leave it)\b/i.test(t.trim())) { O.UI.dialog.close(); return; }
        const ranked = opts.map((o) => [o, score(t, o)]).sort((a, b) => b[1] - a[1]);
        const [best, sc] = ranked[0] || [];
        const tie = ranked[1] && ranked[1][1] === sc && ranked[1][0].label !== best.label;
        if (best && sc >= 2 && !tie) {
          chosen = true; O.UI.dialog.close();
          const before = document.querySelector('.ledger-in');
          try { best.fn.call(best.el, { preventDefault() {}, stopPropagation() {}, target: best.el, currentTarget: best.el }); } catch (e) { console.error(e); }
          // if the deal opened its own list again (a stall, a stable), that one is said too; otherwise all's done
          void before; return;
        }
        if (best && sc >= 2 && tie) return show(`Which do you mean? ${ranked.filter((x) => x[1] === sc).slice(0, 3).map(([o]) => (o.ctx || o.label).slice(0, 60)).join('; or ')}?`);
        if (q && O.AIChat) { O.UI.dialog.open({ name, color: col, text: '', busy: true, options: [], chat: (t2) => answer(t2) }); O.AIChat.say(q, t, (line) => show(line)); return; }
        show(title.startsWith('Bandits') ? '“Well? Purse or blood. Or run, if you think you can.”' : o.pet ? `${name} cocks its head at you.` : `${name} waits for you to say what you want.`);
      }
      show(o.pet ? `${name} looks up at you, waiting.` : said);
      // a whisper of what can be said, where the eye falls
      setTimeout(() => { const i = document.querySelector('.dlg-say input'); if (i) i.placeholder = `Say it: ${hint}`.slice(0, 80); }, 50);
    }

    // ---------------------------------------------------------------- pets answer to words
    // (a pet's menu has no person: the pet is spoken to directly)
    const _cands = O.moreCandidates || [];
    void _cands;

    // ---------------------------------------------------------------- letters can agree to more
    O.letterActs = [...new Set([...(O.letterActs || []), 'lend', 'sell', 'buy', 'hire_player', 'take_job', 'rent_room', 'odd_job', 'retain', 'set_prices', 'set_start', 'gang_in', 'end_strike', 'make_peace', 'pardon', 'bless', 'teach'])];
    O.SpokenPanels = { score, converse };
  }
  O.SpokenSetup = { setup };
})();
