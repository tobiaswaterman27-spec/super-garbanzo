// The night's work, seen. Late at night, if you're out near the houses, you may see one of the gangs
// at it: a figure in a dark cap creeping along the house fronts, crouching at a door to work the lock,
// slipping in, and coming out again with a sack over the shoulder. A dog may bark. The house wakes to
// find its purse lighter in the morning. If you saw who it was, tell the watch (any guard, in your own
// words: "I saw Hob break into the Miller house") and they'll take them; or face the thief yourself.
'use strict';
(function () {
  const T = 16;
  function setup(game) {
    const PS = O.PlayerState, cur = () => O.SimRef.cur;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    let job = null, next = 40;
    const near = (x, y, r) => Math.hypot(x - game.player.x, y - game.player.y) < r;
    game.hooks.update.push((dt) => {
      const s = cur(); if (!s || game.scene) return;
      const h = s.minute / 60;
      if (job) return step(s, dt);
      next -= dt; if (next > 0) return; next = 45 + Math.random() * 60;
      if (!(h >= 23 || h < 4)) return;
      const gs = (s.gangs || []).filter((g) => g.id !== 'player' && g.members.length);
      const g = pick(gs); if (!g) return;
      const thief = g.members.map((m) => s.byId.get(m.id)).find((q) => q && !q.jailUntil && q.agent && q.alive !== false && !q._fighting && q.id !== g.leader);
      if (!thief) return;
      // a house near you, with people asleep inside
      const house = s.world.buildings.filter((b) => b.doorX != null && b.household && ['house', 'townhouse', 'cottage'].includes(b.type) && near(b.doorX * T, b.doorY * T, 360) && !near(b.doorX * T, b.doorY * T, 60)).sort(() => Math.random() - 0.5)[0];
      if (!house) return;
      const hh = s.households[house.household - 1]; if (!hh || hh.home === thief.home) return;
      // they come from the dark edge of the street
      thief.agent.hidden = false; thief.agent.inside = null; thief.agent.x = house.doorX * T + 8 + (Math.random() < 0.5 ? -120 : 120); thief.agent.y = (house.doorY + 2) * T;
      job = { s, g, thief, house, hh, stage: 'creep', t: 0, seen: false };
      O.Errands && O.Errands.send(s, thief, [house.doorX, house.doorY + 1], { anim: 'crouch', secs: 6, face: 3, giveUp: 60, at: () => { job && (job.stage = 'lock'); O.sfx && O.sfx('catch', 0.3); }, after: (ok) => { if (!job) return; if (!ok) { job = null; return; } job.stage = 'inside'; job.t = 0; thief.agent.hidden = true; O.sfx && O.sfx('door', 0.25); } });
      thief.agent.sneak = true;
    });
    function step(s, dt) {
      const J = job, q = J.thief; J.t += dt;
      if (!q || q.alive === false || q.jailUntil) { job = null; return; }
      if (!J.seen && !q.agent.hidden && near(q.agent.x, q.agent.y, 330)) { J.seen = true; PS.sawBurglar = { id: q.id, house: J.house.id, hh: J.hh.id, day: s.day, place: s.world.placeId, gang: J.g.id, name: q.name }; }
      if (J.stage === 'lock' && Math.random() < dt * 0.15) { const dog = (O.fauna || []).find((f) => f.kind === 'dog' && f.world === s.world.placeId && Math.hypot(f.x - q.agent.x, f.y - q.agent.y) < 200); if (dog && O.animalCall) O.animalCall('dog', 0.6); }
      if (J.stage === 'inside' && J.t > 12) {
        J.stage = 'away'; q.agent.hidden = false; q.agent.x = J.house.doorX * T + 8; q.agent.y = (J.house.doorY + 1) * T + 4; q.agent.carrying = { good: 'sack', qty: 1 };
        // the house is the poorer for it
        const take = Math.floor(Math.max(0, J.hh.money) * 0.2); J.hh.money -= take; J.g.purse = (J.g.purse || 0) + take; (J.g.log = J.g.log || []).push(`Day ${s.day}: ${q.first} did the ${J.hh.surname} house: ₳${take}.`);
        const crime = s.recordCrime({ kind: 'burglary', perp: q, gang: J.g.id, placeName: `the ${J.hh.surname} house`, tile: [J.house.doorX, J.house.doorY], victim: J.hh.id, seen: [], severity: 1 });
        J.crime = crime.id; if (PS.sawBurglar && PS.sawBurglar.id === q.id) PS.sawBurglar.crime = crime.id;
        const owner = J.hh.members.map((id) => s.byId.get(id)).find((z) => z && z.age >= 16); if (owner) s.remember(owner, `Thieves were in the house in the night and took ₳${take}.`, 'crime', 1.5);
        const away = [Math.floor(q.agent.x / T) + (q.agent.x > game.player.x ? 12 : -12), J.house.doorY + 3];
        O.Errands && O.Errands.send(s, q, away, { anim: 'idle', secs: 0.5, giveUp: 40, carry: { good: 'sack', qty: 1 }, after: () => { q.agent.carrying = null; q.agent.sneak = false; job = null; } });
      }
      if (J.t > 120) { q.agent.sneak = false; job = null; }
    }
    // telling the watch what you saw
    const _say = O.AIChat && O.AIChat.say;
    if (_say) O.AIChat.say = function (q, text, render, opt) {
      const S = PS.sawBurglar, s = cur();
      if (q && S && s && /guard|sergeant|watch|captain|constable/.test(q.job?.role || '') && typeof text === 'string' && /\b(saw|seen|watched)\b.*\b(break|broke|breaking|thief|burgl|rob|stealing|took)\b|\b(thief|burglar)\b/i.test(text) && O.AI && O.AI.ready) {
        const thief = s.byId.get(S.id), named = thief && (new RegExp('\\b' + thief.first + '\\b', 'i').test(text) || /cap|gang|him|her|them/i.test(text));
        let line;
        if (thief && named && !thief.jailUntil) { const cr = s.crimes.find((c) => c.id === S.crime) || s.recordCrime({ kind: 'burglary', perp: thief, placeName: 'a house', tile: [0, 0], seen: [], severity: 1 }); s.arrestNPC && s.arrestNPC(thief, cr, false); s.relate(q, { id: 0 }, 0.2); PS.rep.guard = Math.min(1, (PS.rep.guard || 0) + 0.1); const g = s.gang && s.gang(S.gang); if (g && g.rel) g.rel.player = 'enemy'; s.remember(thief, `${(O.Forge && O.Forge.player && O.Forge.player.name) || 'The stranger'} told the watch it was me.`, 'grudge', 3); line = `${thief.first}? We've had our eye on that one. We'll have them before breakfast. You did right, but watch your back: their friends won't thank you.`; PS.sawBurglar = null; }
        else line = 'Who? What did they look like? A cap, a name, anything?';
        (q._conv = q._conv || []).push({ who: 'p', t: text }, { who: 'q', t: line }); render(line); return Promise.resolve();
      }
      return _say.apply(this, arguments);
    };
    (O.extraLines = O.extraLines || []).push((s, q) => { if (job && job.thief === q) return `It is the dead of night and you are ${job.stage === 'away' ? 'slipping away with a sack of what you took from' : 'breaking into'} the ${job.hh.surname} house for ${job.g.name}. You've been seen by the player. You'd rather not talk; you might threaten them, or offer them a share to keep quiet.`; return ''; });
    O.NightWork = { job: () => job, force: () => { next = 0; } };
  }
  O.NightWorkSetup = { setup };
})();
