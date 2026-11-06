// Gang politics. A hard, ambitious member who has stopped believing in the boss starts plotting to take
// the gang. If you run with that gang, they'll sound you out: will you back them? Back them and, when the
// night comes, they face the boss down in front of the others, and with you behind them they likely win;
// they remember who stood with them. Or go to the boss and tell them: the boss deals with the plotter,
// and you're trusted for it. Do nothing, and it plays out without you, one way or the other.
'use strict';
(function () {
  function setup(game) {
    const PS = O.PlayerState, cur = () => O.SimRef.cur;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    const pname = () => (O.Forge && O.Forge.player && O.Forge.player.name) || 'the stranger';
    const mine = (s, gid) => (PS.gangRanks || []).some((m) => m.gid === gid && m.place === s.world.placeId);
    const SP = O.Sim.prototype, _nd = SP.newDay;
    SP.newDay = function () {
      const r = _nd.apply(this, arguments);
      try {
        for (const g of (this.gangs || []).filter((x) => x.id !== 'player' && x.members.length >= 3)) {
          if (g.plot) { // the night it comes to a head
            if (this.day >= g.plot.day) resolve(this, g);
            continue;
          }
          if (Math.random() > 0.08) continue;
          const boss = this.byId.get(g.leader); if (!boss) continue;
          const m = g.members.filter((x) => x.id !== g.leader).map((x) => [x, this.byId.get(x.id)]).find(([x, q]) => q && x.loyalty < 0.45 && (q.traits.includes('ambitious') || q.traits.includes('hostile') || q.traits.includes('risk-taking')));
          if (!m) continue;
          g.plot = { by: m[1].id, day: this.day + 3, backers: [], warned: false };
          this.remember(m[1], `I mean to take ${g.name} from ${boss.first}. Soon.`, 'gang', 3);
          (g.log = g.log || []).push(`Day ${this.day}: there's muttering against ${boss.first}.`);
        }
      } catch (e) { console.error(e); }
      return r;
    };
    function resolve(s, g) {
      const P = g.plot; g.plot = null; const boss = s.byId.get(g.leader), plotter = s.byId.get(P.by); if (!boss || !plotter || plotter.gang !== g.id) return;
      if (P.warned) { // the boss knew: the plotter is thrown out, or worse
        g.members = g.members.filter((x) => x.id !== plotter.id); plotter.gang = null;
        s.remember(plotter, `${boss.first} knew I was coming. Someone talked. Thrown out of ${g.name}.`, 'grudge', 3);
        if (P.warner === 0) { s.relate(plotter, { id: 0 }, -0.6); s.remember(plotter, `${pname()} told ${boss.first} what I was planning.`, 'grudge', 3); }
        s.log(`${plotter.name} has been thrown out of ${g.name}. They say he plotted against ${boss.name}.`, 'gang'); (g.log = g.log || []).push(`Day ${s.day}: ${plotter.first} was thrown out for plotting.`);
        return;
      }
      const odds = 0.4 + (P.backers.includes(0) ? 0.35 : 0) + P.backers.length * 0.05;
      if (Math.random() < odds) {
        g.leader = plotter.id; const bm = g.members.find((x) => x.id === boss.id); if (bm) { bm.role = 'member'; bm.loyalty = 0.1; } const pm = g.members.find((x) => x.id === plotter.id); if (pm) { pm.role = 'leader'; pm.loyalty = 0.9; }
        s.log(`${g.name} have a new boss: ${plotter.name} faced ${boss.name} down in front of them all.`, 'gang'); (g.log = g.log || []).push(`Day ${s.day}: ${plotter.first} took the gang from ${boss.first}.`);
        s.remember(boss, `${plotter.first} took my gang from me.`, 'grudge', 3, plotter.id);
        if (P.backers.includes(0)) { s.relate(plotter, { id: 0 }, 0.5); s.remember(plotter, `${pname()} stood behind me when I took the gang.`, 'gang', 3); (PS.gangRanks || []).filter((m) => m.gid === g.id).forEach((m) => { m.trust = Math.min(1, (m.trust || 0) + 0.25); m.rank = Math.min(6, (m.rank || 0) + 1); }); PS.gangNote = `${plotter.first} is boss of ${g.name} now, and you stood behind them: you're moved up.`; }
      } else {
        g.members = g.members.filter((x) => x.id !== plotter.id); plotter.gang = null;
        s.log(`${plotter.name} tried to take ${g.name} from ${boss.name}, and failed. Thrown out.`, 'gang');
        if (P.backers.includes(0)) { s.relate(boss, { id: 0 }, -0.6); s.remember(boss, `${pname()} backed ${plotter.first} against me.`, 'grudge', 3); PS.gangRanks = (PS.gangRanks || []).filter((m) => m.gid !== g.id); PS.gangNote = `${plotter.first}'s try for ${g.name} failed, and the boss knows you were in it. You're out of the gang, and a marked one.`; if (g.rel) g.rel.player = 'enemy'; }
      }
    }
    game.hooks.update.push(() => { const n = PS.gangNote; if (!n) return; PS.gangNote = null; O.UI.say(n, n.includes('failed') ? 'bad' : 'good'); });
    // the plotter sounds you out; you can back them, or tell the boss
    let st = 30;
    game.hooks.update.push((dt) => {
      st -= dt; if (st > 0) return; st = 30;
      const s = cur(); if (!s || game.scene || (O.npcUI && O.npcUI.talking && O.npcUI.talking())) return;
      for (const g of s.gangs || []) { const P = g.plot; if (!P || P.asked || !mine(s, g.id)) continue; const q = s.byId.get(P.by); if (!q || !q.agent || q.agent.hidden || Math.hypot(q.agent.x - game.player.x, q.agent.y - game.player.y) > 220) continue; P.asked = true; O.npcUI.startFrom(q, `A word, quietly. ${s.byId.get(g.leader)?.first || 'The boss'} is finished: he takes the best of every job and sends us to hang. In ${P.day - s.day} nights I mean to take the gang. Are you with me?`); return; }
    });
    const _say = O.AIChat && O.AIChat.say;
    if (_say) O.AIChat.say = function (q, text, render, opt) {
      const s = cur(); if (q && s && typeof text === 'string' && O.AI && O.AI.ready) {
        const g = q.gang && s.gang && s.gang(q.gang), P = g && g.plot;
        const reply = (l) => { (q._conv = q._conv || []).push({ who: 'p', t: text }, { who: 'q', t: l }); render(l); return Promise.resolve(); };
        if (P && P.by === q.id && P.asked && !P.answered) {
          if (/\b(i'?m with you|count me in|aye|yes|i'?ll back you|i'?ll stand with you)\b/i.test(text)) { P.answered = true; P.backers.push(0); return reply(`Good. When it comes, stand behind me and keep your hand near your blade. No one else knows. No one.`); }
          if (/\b(no|not me|leave me out|i won'?t)\b/i.test(text)) { P.answered = true; s.relate(q, { id: 0 }, -0.1); return reply('Then forget we spoke. If you breathe a word of this, I\'ll know.'); }
        }
        if (g && g.leader === q.id && g.plot && /\b(plotting|plot against you|wants? your place|take the gang|turn on you|coming for you)\b/i.test(text)) {
          const pl = s.byId.get(g.plot.by); g.plot.warned = true; g.plot.warner = 0; s.relate(q, { id: 0 }, 0.4); (PS.gangRanks || []).filter((m) => m.gid === g.id).forEach((m) => { m.trust = Math.min(1, (m.trust || 0) + 0.2); });
          return reply(pl ? `${pl.first}. I wondered. You've done well to tell me, and I won't forget it. Leave ${pl.first} to me.` : 'I\'ll look into it. You did right to tell me.');
        }
      }
      return _say.apply(this, arguments);
    };
    (O.extraLines = O.extraLines || []).push((s, q) => { const g = q.gang && s.gang && s.gang(q.gang); if (!g || !g.plot) return ''; if (g.plot.by === q.id) return `You are plotting to take ${g.name} from the boss in ${Math.max(0, g.plot.day - s.day)} nights. You trust nobody with it but the player, if they've said they're with you.`; if (g.leader === q.id) return g.plot.warned ? 'You have been warned that one of yours is plotting against you, and you are ready.' : 'You sense something wrong in the gang: whispers that stop when you come in.'; return 'There is muttering in the gang against the boss; you keep your head down.'; });
    O.GangPolitics = { resolve };
  }
  O.GangPoliticsSetup = { setup };
})();
