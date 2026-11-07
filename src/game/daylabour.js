// Day labour. Those with no place stand about the square at first light of a working day, hoping;
// farmers and woodcutters short of hands come by and take on a few for the day ("You, and you"), and
// off they go to the fields or the woods to work till late afternoon, coming home with a few coins.
// The rest drift off, or go to beg. You see the hiring, and the work.
'use strict';
(function () {
  function setup(game) {
    const cur = () => O.SimRef.cur, SP = O.Sim.prototype;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    const able = (s, p) => !p.visitor && !p.job && p.age >= 15 && p.age <= 58 && !p.gentry && !p.title && !p.homefront && !p.jailUntil && p.health?.state !== 'ill';
    const hired = (s, p) => ((p.id * 2654435761 + s.day * 97) >>> 0) % 100 < 55;
    const where = (s, p) => (((p.id + s.day) % 3) === 0 && s.Z && s.Z.wood) ? 'wood' : 'farm';
    let wrapped = false;
    const wrap = () => { if (wrapped) return; wrapped = true; const _plan = SP.plan;
      SP.plan = function (p) { const r = _plan.apply(this, arguments); try { if (!r || this.weekday === 6 || !able(this, p) || !['stroll', 'idle', 'home', 'rest', 'socialise', 'beg', 'play'].includes(r.act)) return r; const h = this.minute / 60;
        if (h >= 6.8 && h < 7.7) return { act: 'wait-work', outdoor: true, zone: 'square', labour: true };
        if (h >= 7.7 && h < 16 && hired(this, p) && !this.weather?.severe && !this.raining) return where(this, p) === 'wood' ? { act: 'labour', kind: 'chop', outdoor: true, zone: 'wood', labour: true } : { act: 'labour', kind: 'hoe', outdoor: true, zone: 'farm', labour: true };
      } catch (e) { /* */ } return r; }; };
    setTimeout(wrap, 0); game.hooks.update.unshift(wrap);
    const _idle = SP.idleAnim; SP.idleAnim = function (p) { if (p.activity?.act === 'labour') return p.agent.talking ? 'talk' : (Math.floor(this.minute / 3) + p.id) % 7 === 0 ? 'wipe' : this.season === 'spring' && p.activity.kind === 'hoe' ? 'dig' : p.activity.kind; return _idle.apply(this, arguments); };
    // the hiring, said aloud; and the pay, at the end of the day
    let lastMin = -1;
    game.hooks.update.push(() => {
      const s = cur(); if (!s) return; const m = Math.floor(s.minute); if (m === lastMin) return; lastMin = m;
      if (m === Math.round(7.7 * 60) && s.weekday !== 6) { const waiting = s.people.filter((p) => p.activity && p.activity.labour && p.activity.act === 'wait-work' && p.agent && !p.agent.hidden && Math.hypot(p.agent.x - game.player.x, p.agent.y - game.player.y) < 400); const takers = waiting.filter((p) => hired(s, p)); if (takers.length) { O.Speech && O.Speech.say(pick(takers), pick(['Work at the farm! Come on!', 'They want hands for the hay!', 'Woodcutter wants two. That\'s us.']), 2.2); for (const p of takers) O.gesture && O.gesture(p, 'celebrate', 1); for (const p of waiting.filter((x) => !hired(s, x))) { O.gesture && O.gesture(p, pick(['shrug', 'mourn', 'shake']), 2); } } }
      if (m === 16 * 60) for (const p of s.people) { if (p.activity && p.activity.labour && p.activity.act !== 'wait-work') { const hh = s.household(p); if (hh) hh.money += 4; s.remember(p, 'A day\'s hire in the ' + (p.activity.kind === 'chop' ? 'woods' : 'fields') + '; four aurin for it.', 'work', 0.6); } }
    });
    (O.extraLines = O.extraLines || []).push((s, q) => { const a = q.activity; if (!a || !a.labour) return ''; return a.act === 'wait-work' ? 'You have no post; you are standing about the square at first light hoping someone will hire you for the day.' : `You have been taken on for a day's labour in the ${a.kind === 'chop' ? 'woods' : 'fields'}, four aurin at the end of it. Hard work, but bread on the table.`; });
    O.DayLabour = { hired: (p) => hired(cur(), p) };
  }
  O.DayLabourSetup = { setup };
})();
