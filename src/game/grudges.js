// Grudges, and your name on the road. Wrong someone (jilt them, rob them, beat them, take their custom)
// and they bear you a grudge: cold to you, quick to run you down to their friends, and now and then they
// come and have it out with you. Real amends (in your own words) and they may forgive; otherwise it
// fades only slowly. And what you do doesn't stay where you did it: travellers carry it, and in a few
// days the next town has heard, some of them anyway, and talks of it.
'use strict';
(function () {
  function setup(game) {
    const SP = O.Sim.prototype, PS = O.PlayerState, cur = () => O.SimRef.cur, clamp = O.clamp;
    const relOf = (q) => { const r = q.rel.get(0) || { affinity: 0, familiar: 0 }; q.rel.set(0, r); return r; };

    O.grudge = (s, q, why, amt = 0.3) => {
      if (!q || q.alive === false || q.age < 8) return;
      const g = q.grudge && q.grudge.level > 0.05 ? q.grudge : (q.grudge = { why, day: s.day, level: 0 });
      g.level = Math.min(1, g.level + amt); g.why = why; g.day = s.day;
      const r = relOf(q); r.affinity = clamp(r.affinity - amt * 0.5, -1, 1);
    };
    // the wrongs: anything they remember of you that cut deep
    const _rem = SP.remember;
    SP.remember = function (p, text, kind, strength, about) {
      _rem.apply(this, arguments);
      if (kind === 'player' && typeof about === 'number' && about <= -0.5) O.grudge(this, p, text.replace(/\.$/, ''), Math.min(0.6, -about * 0.5));
      if ((kind === 'crime' || kind === 'theft') && /stranger|newcomer|player/i.test(text) && (strength || 1) >= 1) O.grudge(this, p, text.replace(/\.$/, ''), 0.25);
    };
    // each day: a grudge spreads among friends, and slowly cools
    const _nd = SP.newDay;
    SP.newDay = function () {
      const r = _nd.apply(this, arguments);
      for (const p of this.people) {
        const g = p.grudge; if (!g) continue;
        g.level -= 0.015; if (g.level <= 0.05) { p.grudge = null; continue; }
        if (g.level > 0.3 && this.rng.chance(0.3)) {
          const fr = [...p.rel.entries()].filter(([id, x]) => id !== 0 && x.affinity > 0.3).map(([id]) => this.byId.get(id)).filter((z) => z && z.alive !== false);
          const z = fr[Math.floor(this.rng.next() * fr.length)];
          if (z && !(z.beliefs || []).some((b) => b.grudge === p.id)) { (z.beliefs = z.beliefs || []).unshift({ t: `${p.first} has no good word for the stranger: ${g.why}.`, src: 'friend', from: p.first, day: this.day, grudge: p.id }); relOf(z).affinity = clamp(relOf(z).affinity - 0.04, -1, 1); }
        }
      }
      return r;
    };
    O.grudgeLine = (s, q) => {
      const g = q.grudge; if (!g || g.level <= 0.05) return '';
      const how = g.level > 0.6 ? 'a bitter grudge' : g.level > 0.3 ? 'a grudge' : 'a lingering grudge';
      return `You bear the player ${how}, since ${s.day - g.day < 1 ? 'today' : s.day - g.day + ' days ago'}: ${g.why}. You are cold to them, may refuse to deal with them, and speak ill of them; only if they make real amends (a true apology, putting it right, a fitting gift) do you let it go (forgive). If they wrong you again in talk, grudge {"why"}.`;
    };
    // having it out with you
    let at = 0;
    game.hooks.update.push((dt) => {
      at -= dt; if (at > 0) return; at = 4;
      const s = cur(); if (!s || !O.npcUI || O.npcUI.talking() || O.panelOpen || O.UI.dialogOpen() || game.sleepState || game.scene) return;
      const p = game.player;
      for (const q of s.people) {
        const g = q.grudge; if (!g || g.level < 0.5 || g.faced === s.day || q.agent.hidden || q.agent.inside != null || q.age < 14 || q.activity?.act === 'sleep') continue;
        if (Math.hypot(q.agent.x - p.x, q.agent.y - p.y) > 70 || Math.random() > 0.12) continue;
        g.faced = s.day; O.npcUI.startFrom(q, "I've not forgotten what you did to me.");
        return;
      }
    });
    const base = O.NpcActs.apply;
    O.NpcActs.apply = function (s, q, a, main) {
      if (a && a.do === 'grudge') { O.grudge(s, q, String(a.why || 'the way they spoke to me').slice(0, 120), 0.3); return null; }
      if (a && a.do === 'forgive') { if (!q.grudge) return null; q.grudge = null; const r = relOf(q); r.affinity = clamp(r.affinity + 0.1, -1, 1); s.remember(q, 'Made it up with the stranger.', 'player', 1, 0.3); return `${q.first} lets the old grudge go.`; }
      return base.apply(this, arguments);
    };

    // ---------------------------------------------------------------- your name on the road
    const deeds = () => (PS.deeds = PS.deeds || []);
    const _log = SP.log;
    SP.log = function (text, kind) {
      _log.apply(this, arguments);
      if (kind === 'weather' || !this.world) return;
      const nm = O.Forge && O.Forge.player && O.Forge.player.name;
      if (/\b(the )?(stranger|newcomer)('s)?\b/i.test(text) || (nm && text.includes(nm))) {
        const D = deeds(); if (D.some((d) => d.t === text)) return;
        D.push({ t: text, day: this.day, place: this.world.placeId, from: this.world.name, i: (D.length ? D[D.length - 1].i : 0) + 1 }); if (D.length > 40) D.shift();
      }
    };
    O.renownLine = (s, q) => {
      if (q.age < 10) return '';
      const here = s.world.placeId, heard = [];
      for (const d of deeds().slice().reverse()) {
        const local = d.place === here, delay = local ? 0 : 1 + (O.hash('road', d.i, here) % 4);
        if (s.day < d.day + delay) continue;
        const odds = local ? 65 : 30 + (q.job && /merchant|innkeeper|carter|crier|guard/.test(q.job.role) ? 30 : 0);
        if (O.hash('heard', d.i, q.id) % 100 >= odds) continue;
        heard.push(local ? d.t : `${d.t} (word from ${d.from})`); if (heard.length >= 3) break;
      }
      return heard.length ? `What you have heard of the player (who may be "the stranger" or "the newcomer" in the telling): ${heard.join(' ')}` : '';
    };
  }
  O.GrudgesSetup = { setup };
})();
