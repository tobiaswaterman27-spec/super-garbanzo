// Making amends. A bad name isn't forever: every good turn done in the open (a lost child brought home, a
// bull held, a flood bailed, bread given, a fire doused, a wagon shouldered, a coin in a poor man's bowl)
// wears a little off it, and folk start to say you're not so bad after all; done often enough, the
// muttering stops and the mothers stop calling their children in.
'use strict';
(function () {
  function setup(game) {
    const PS = O.PlayerState; const last = new Map(); let acc = 0, deeds = 0;
    const WATCH = [['LostChild', 'rescued'], ['LooseBull', 'grabbed'], ['FloodFolk', 'helped'], ['BreadDole', 'given'], ['ChimneyFire', 'yours'], ['OxWagons', 'helpedYou'], ['Truants', 'sent'], ['PloughMonday', 'yours'], ['Christening', 'yours']];
    const read = (m, k) => { try { const v = O[m] && O[m][k]; return typeof v === 'number' ? v : null; } catch (e) { return null; } };
    game.hooks.update.push((dt) => { acc += dt; if (acc < 0.5) return; acc = 0; if (!PS.rep) return; let n = 0;
      for (const [m, k] of WATCH) { const v = read(m, k); if (v == null) continue; const key = m + k, was = last.get(key); last.set(key, v); if (was != null && v > was) n += v - was; }
      const alms = PS.almsToPoor || 0, wa = last.get('alms'); last.set('alms', alms); if (wa != null && alms > wa) n += (alms - wa) * 0.5;
      if (n <= 0) return; deeds += n; const before = PS.rep.criminal || 0;
      PS.rep.criminal = Math.max(0, before - 0.03 * n); PS.rep.civilian = Math.min(1, (PS.rep.civilian || 0) + 0.015 * n);
      if (before > 0.4 && PS.rep.criminal <= 0.4) O.UI && O.UI.say && O.UI.say('Folk are beginning to say you\'re not so bad after all. The muttering in the street has died down.', 'good');
      else if (before > 0.2 && Math.random() < 0.3) O.UI && O.UI.say && O.UI.say('A good turn, seen. It does your name no harm.'); });
    O.Amends = { get deeds() { return deeds; } };
  }
  O.AmendsSetup = { setup };
})();
