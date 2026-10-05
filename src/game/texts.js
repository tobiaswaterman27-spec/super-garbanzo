// Words that must follow the facts: when a queen holds the crown it is the Queen's host and the Queen's
// coin, not the King's. Applied wherever text reaches the player (news, messages, panels and dialogs).
'use strict';
(function () {
  function setup(game) {
    const queen = () => { const c = O.SimRef.home?.kingdom?.rulers?.crown; return !!(c && c.sex === 'f'); };
    const fix = (t) => (typeof t === 'string' && queen() ? t.replace(/\bKing(\\?)'s (host|coin|men|peace|purveyors|justice|name|law|levy|army|service)\b/g, "Queen$1's $2").replace(/\bthe King's\b(?! Road)/g, "the Queen's") : t);
    O.crownly = fix;
    let done = false;
    game.hooks.update.push(() => {
      if (done) return; done = true;
      const K = O.SimRef.home.kingdom, _n = K.addNews.bind(K); K.addNews = (t, k, p) => _n(fix(t), k, p);
      const _say = O.UI.say; O.UI.say = (t, k) => _say(fix(t), k);
      const _po = O.Panels.open; O.Panels.open = (title, html, cb) => _po(fix(title), fix(html), cb);
      const _do = O.UI.dialog.open; O.UI.dialog.open = (o) => _do(Object.assign({}, o, { text: fix(o.text), name: fix(o.name), options: (o.options || []).map((x) => Object.assign({}, x, { label: fix(x.label) })) }));
      const SP = O.Sim.prototype, _log = SP.log; SP.log = function (t, k) { return _log.call(this, fix(t), k); };
    });
  }
  O.TextsSetup = { setup };
})();
