// The tax collector at the door. On collection days he goes round with his book under his arm, and when he
// knocks, somebody comes out: most count the hearth tax into his palm with a long face; the poor turn out
// their purse to show him there's no more, and he licks his pencil and writes them down; now and then one
// argues, jabbing a finger, and he only shrugs and writes. You can watch all of it from the street.
'use strict';
(function () {
  const T = 16;
  function setup(game) {
    const cur = () => O.SimRef.cur, SP = O.Sim.prototype;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    const scenes = []; let seen = 0;
    const near = (x, y, r) => Math.hypot(x - game.player.x, y - game.player.y) < r;
    const talking = (q) => O.npcUI && O.npcUI.talking && O.npcUI.talking() === q;
    const _onEnter = SP.onEnter;
    SP.onEnter = function (p, bid) {
      const collecting = p.task?.act === 'collect' && bid === p.task.b;
      const before = collecting ? this.households.filter((hh) => !hh.gone && hh.home === bid).map((hh) => [hh, hh.taxDue || 0]) : null;
      const r = _onEnter.apply(this, arguments);
      if (!collecting || this !== cur() || game.scene) return r;
      const b = this.building(bid); if (!b || b.doorX == null || !near(b.doorX * T, b.doorY * T, 420)) return r;
      try { const owed = before.reduce((m, [, d]) => m + d, 0), left = before.reduce((m, [hh]) => m + (hh.taxDue || 0), 0);
        // he stays on the step, and someone comes out
        const a = p.agent; a.inside = null; a.hidden = false; a.x = b.doorX * T + 8 + 10; a.y = (b.doorY + 1) * T + 6; a.frozen = true; a.path = null; a.dir = 1; p._taxdoor = true;
        const who = this.people.find((x) => x.home === bid && x.age >= 16 && x.agent && x.agent.inside === bid && !x.agent.frozen && !x.errand && !talking(x));
        if (who) { who.agent.inside = null; who.agent.hidden = false; who.agent.x = b.doorX * T + 8 - 8; who.agent.y = (b.doorY + 1) * T + 6; who.agent.frozen = true; who.agent.path = null; who.agent.dir = 2; who._taxdoor = true; }
        scenes.push({ s: this, p, who, b, t: 0, paid: owed - left, short: left > 0, owed, argue: left > 0 && who && Math.random() < 0.5 }); seen++;
      } catch (e) { /* the round goes on regardless */ }
      return r;
    };
    function end(S) { for (const q of [S.p, S.who]) { if (!q || !q.agent) continue; q.agent.forceAnim = null; if (!talking(q)) q.agent.frozen = false; q._taxdoor = false; } if (S.who && S.who.agent && S.who.agent.inside == null && !talking(S.who)) { S.who.agent.inside = S.b.id; S.who.agent.hidden = true; } scenes.splice(scenes.indexOf(S), 1); }
    game.hooks.update.push((dt) => {
      const s = cur();
      for (const S of scenes.slice()) { S.t += dt; if (S.s !== s || S.t > 9 || game.scene) { end(S); continue; } const p = S.p.agent, w = S.who && S.who.agent;
        p.forceAnim = S.t < 1.5 ? 'open' : S.t < 6 ? (S.short ? 'write' : 'take') : 'nod';
        if (w) w.forceAnim = S.t < 1.5 ? 'idle' : S.argue && S.t > 3 && S.t < 6 ? 'point' : S.t < 5 ? (S.paid > 0 ? 'give' : 'shrug') : 'idle';
        if (!S.s1 && S.t > 1.2) { S.s1 = true; near(p.x, p.y, 300) && O.Speech && O.Speech.say(S.p, `Hearth tax, ${S.owed} aurin${S.owed === 1 ? '' : 's'}.`, 2.4); }
        if (!S.s2 && S.t > 3 && w) { S.s2 = true; near(p.x, p.y, 300) && O.Speech && O.Speech.say(S.who, S.argue ? pick(['Again? We paid you last week!', 'Bleed us dry, why don\'t you!', 'Tell the council to feed my children, then.']) : S.short ? pick(['That\'s all there is. Look.', 'Next week. I swear it.', 'The purse is empty.']) : pick(['There. Every penny.', 'Take it, then.', 'Here. Don\'t spend it all on the reeve\'s wine.']), 2.6); if (S.paid > 0 && near(p.x, p.y, 260)) O.sfx && O.sfx('coins', 0.5); }
        if (!S.s3 && S.t > 6) { S.s3 = true; near(p.x, p.y, 300) && O.Speech && O.Speech.say(S.p, S.short ? pick(['I\'ll write it down. It\'s owed.', 'Next week, then. With the arrears.']) : pick(['Thank you kindly.', 'God keep you.']), 2.2); } }
    });
    game.hooks.drawWorld.push((ctx, cam) => { for (const S of scenes) { if (S.s !== cur() || game.scene) continue; const a = S.p.agent, x = Math.round(a.x - cam.x), y = Math.round(a.y - cam.y); ctx.fillStyle = '#6a3a2a'; ctx.fillRect(x - 9, y - 16, 5, 6); ctx.fillStyle = '#e8e0c8'; ctx.fillRect(x - 8, y - 15, 3, 4); if (S.t > 3 && S.t < 5 && S.paid > 0) { ctx.fillStyle = '#e0c040'; ctx.fillRect(x - 4 + Math.round(Math.sin(S.t * 10) * 2), y - 14 - Math.round((S.t - 3) * 3), 2, 1); } } });
    (O.extraLines = O.extraLines || []).push((s, q) => { const S = scenes.find((x) => x.p === q || x.who === q); if (!S) return ''; return q === S.p ? 'You are at a door collecting the hearth tax, your book under your arm.' : (S.short ? 'The tax collector is at your door and you cannot pay all the hearth tax.' : 'The tax collector is at your door and you have just paid the hearth tax.'); });
    O.TaxDoor = { scenes, get seen() { return seen; } };
  }
  O.TaxDoorSetup = { setup };
})();
