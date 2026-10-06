// Words that must follow the facts: when a queen holds the crown it is the Queen's host and the Queen's
// coin, not the King's. Applied wherever text reaches the player (news, messages, panels and dialogs).
'use strict';
(function () {
  function setup(game) {
    const queen = () => { const c = O.SimRef.home?.kingdom?.rulers?.crown; return !!(c && c.sex === 'f'); };
    const fix = (t) => (typeof t === 'string' && queen() ? t.replace(/\bKing(\\?)'s (host|coin|men|peace|purveyors|justice|name|law|levy|army|service)\b/g, "Queen$1's $2").replace(/\bthe King's\b(?! Road)/g, "the Queen's") : t);
    O.crownly = fix;
    let done = false;
    game.hooks.update.push(() => { const s = O.SimRef.cur; if (s && s.world) O.fixBizNames(s.world, s); });
    game.hooks.update.push(() => {
      if (done) return; done = true;
      const K = O.SimRef.home.kingdom, _n = K.addNews.bind(K); K.addNews = (t, k, p) => _n(fix(t), k, p);
      const _say = O.UI.say; O.UI.say = (t, k) => _say(fix(t), k);
      const _po = O.Panels.open; O.Panels.open = (title, html, cb) => _po(fix(title), fix(html), cb);
      const _do = O.UI.dialog.open; O.UI.dialog.open = (o) => _do(Object.assign({}, o, { text: fix(o.text), name: fix(o.name), options: (o.options || []).map((x) => Object.assign({}, x, { label: fix(x.label) })) }));
      const SP = O.Sim.prototype, _log = SP.log; SP.log = function (t, k) { t = fix(t); if (typeof t === 'string') t = t.replace(/^[a-z]/, (c) => c.toUpperCase()); return _log.call(this, t, k); }; // (a line never starts small: "the new house site...")
    });
  }
  // names made before the naming rule: put right whenever a world is shown
  const fixed = new WeakSet();
  O.fixBizNames = (world, sim) => {
    if (!world || fixed.has(world) || !O.bizName) return; fixed.add(world);
    const LABELS = Object.values(O.Data.BUSINESS).map((d) => d.label).filter(Boolean);
    for (const b of world.buildings) {
      const bz0 = sim && sim.biz.get(b.id), m = /^(.+?)'s (.+)$/.exec(b.name || '');
      let nn = null;
      if (m && LABELS.includes(m[2])) nn = bz0 && (bz0.def.public || ['guard', 'morgue', 'hospital', 'school', 'gaol'].includes(bz0.type)) ? `${(world.name || '').replace(/ .*/, '')} ${m[2]}` : O.bizName(m[1], m[2]);
      else if (bz0 && (LABELS.includes(b.name) || b.name === bz0.def.label || /^(Butcher|Carpenter|Physician|Armourer|Smithy|Jeweller|Saddler|Glazier|Chandlery|Builder's Yard)$/.test(b.name || ''))) { const own = sim.byId.get(bz0.owner) || sim.byId.get(bz0.workers[0]); nn = own && own.sur ? O.bizName(own.sur, bz0.def.label) : `The ${O.bizName('x', bz0.def.label).slice(4)}`; }
      if (!nn || nn === b.name) continue;
      const old = b.name; b.name = nn; const bz = sim && sim.biz.get(b.id); if (bz && bz.name === old) bz.name = nn;
      for (const e of O.PlayerState.posts || []) if (e.bizName === old) e.bizName = nn;
    }
  };
  O.TextsSetup = { setup };
})();
