// The street between the big events. Folk who spend the evening at the tavern come home merry,
// singing and hiccuping and stopping to steady themselves. Children play tag, hopscotch and leapfrog
// in the street and shriek about it; you can join in. On washing day the lines go out by the houses
// and come in again when it rains. People mind the weather in small ways: a hand over the brow in the
// heat, a shiver in the cold, a curse at the rain, snowballs in the snow. In the morning someone
// sweeps the step. And you can stand an ale for anyone at the tavern, and drink with them.
'use strict';
(function () {
  const T = 16;
  function setup(game) {
    const PS = O.PlayerState, cur = () => O.SimRef.cur, say = (t, k) => O.UI.say(t, k), SP = O.Sim.prototype;
    const sp = (q, t, secs = 2.4, k) => O.Speech && O.Speech.say(q, t, secs, k);
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    const near = (q, r) => { const P = game.player; return !q.agent.hidden && q.agent.inside == null && Math.hypot(q.agent.x - P.x, q.agent.y - P.y) < r; };
    const taverns = (s) => new Set([...s.biz.values()].filter((z) => z.type === 'tavern').map((z) => (z.b && z.b.id != null ? z.b.id : z.b)));

    // ---------------------------------------------------------------- merry on the way home
    // anyone who passes the evening at the tavern may leave it in drink; it wears off by morning
    const _plan = SP.plan;
    SP.plan = function (p) {
      const a = _plan.call(this, p); if (!a) return a; const h = this.hour;
      if (p.age >= 16 && h >= 19 && h < 23 && a.b != null && taverns(this).has(a.b) && p.tipsy !== this.day && Math.random() < 0.004 * (1 + ((p.traits || []).includes('jovial') ? 1 : 0))) p.tipsy = this.day;
      // first thing, one from some houses sweeps the doorstep
      if (a.act === 'home' && h >= 7 && h < 7.6 && p.age >= 14 && p.age < 65 && !this.raining) { const hh = this.household(p); if (hh && hh.members[hh.members.length - 1] === p.id && (p.id + this.day) % 3 === 0) return { act: 'stroll', outdoor: true, zone: 'home', sweep: true }; }
      return a;
    };
    const HIC = ['Hic!', '*hic*', 'Who moved the road?', 'One more, I said, ONE more...', 'I love this town. I love all of you.', 'Shh. Shhh. The wife.', 'Where\'s my door gone?', 'Hic! Pardon.'];
    // children's games
    const GAMES = [
      { name: 'tag', lines: ['You\'re it!', 'Can\'t catch me!', 'Not fair, I was resting!', 'Tag! You\'re it!'], anim: 'run' },
      { name: 'hopscotch', lines: ['One, two, three...', 'You stepped on the line!', 'My turn!', 'Hop, hop, hop!'], anim: 'dance' },
      { name: 'leapfrog', lines: ['Over you go!', 'Bend lower!', 'Ow! Your knee!', 'Again, again!'], anim: 'celebrate' },
      { name: 'hide and seek', lines: ['Ninety-eight, ninety-nine, a hundred!', 'Coming, ready or not!', 'Found you!', 'I can see your feet!'], anim: 'look' },
      { name: 'knucklebones', lines: ['Onesies!', 'Twosies! Ha!', 'You dropped it!', 'Best of three.'], anim: 'crouch' },
    ];
    const W = () => (cur() && cur().weather) || { kind: 'clear' };
    let lt = 0;
    game.hooks.update.push((dt) => {
      lt -= dt; if (lt > 0 || game.scene) return; lt = 1.6; const s = cur(); if (!s) return; const h = s.hour, now = performance.now();
      for (const q of s.people) {
        if (!near(q, 340) || q.alive === false) continue; const ag = q.agent; if (ag.gest && ag.gest.until > now) continue;
        if ((q._sl || 0) > now) continue;
        // in drink
        if (q.tipsy === s.day && h >= 19) { if (Math.random() < 0.3) { O.gesture(q, pick(['shake', 'stretch', 'shrug', 'laugh']), 1.4); sp(q, Math.random() < 0.25 && PS.songBook ? pick(['La la LAAA...', '♪ Oh the miller\'s daughter... ♪', '♪ Hey nonny nonny... ♪']) : pick(HIC), 2.2); q._sl = now + 5000; } continue; }
        // a child at play with another
        if (q.age >= 5 && q.age < 13 && q.activity && ['play', 'stroll'].includes(q.activity.act) && h >= 8 && h < 19 && !s.raining) {
          const mate = s.people.find((z) => z !== q && z.age >= 4 && z.age < 13 && near(z, 340) && Math.hypot(z.agent.x - ag.x, z.agent.y - ag.y) < 80);
          if (mate && Math.random() < 0.35) { const g = GAMES[(q.id + mate.id + s.day) % GAMES.length]; if (W().kind === 'snow') { O.gesture(q, 'attack', 1); sp(q, pick(['Snowball!', 'Got you!', 'Snow fight!']), 2); O.gesture(mate, 'hurt', 1); } else { O.gesture(q, g.anim, 1.8); O.gesture(mate, g.anim === 'run' ? 'laugh' : g.anim, 1.8); sp(q, pick(g.lines), 2.2); } q._sl = now + 6000; q._game = g.name; continue; }
        }
        // the step swept
        if (q.activity && q.activity.sweep) { O.gesture(q, 'sweep', 3); q._sl = now + 3200; continue; }
        // the weather, on the faces of those out in it
        if (q.age >= 13 && Math.random() < 0.06) {
          const k = W().kind;
          if (s.raining || k === 'rain' || k === 'storm') { O.gesture(q, pick(['wipe', 'shake']), 1.4); if (Math.random() < 0.4) sp(q, pick(['This rain!', 'Wet through, again.', 'Good weather for ducks.', 'My boots leak.']), 2); }
          else if (k === 'heat') { O.gesture(q, 'wipe', 1.6); if (Math.random() < 0.3) sp(q, pick(['Phew.', 'Hot as a forge.', 'I\'d give a penny for shade.']), 2); }
          else if (k === 'snow' || (s.season === 'winter' && k !== 'clear')) { O.gesture(q, 'shake', 1.4); if (Math.random() < 0.3) sp(q, pick(['Brr!', 'My fingers have gone.', 'Cold enough to freeze the well.']), 2); }
          else if (k === 'wind' || k === 'gale') { O.gesture(q, 'shake', 1.2); if (Math.random() < 0.2) sp(q, 'Hold onto your hat!', 2); }
          q._sl = now + 20000;
        }
      }
    });
    (O.extraLines = O.extraLines || []).push((s, q) => q.tipsy === s.day && s.hour >= 19 ? 'You have had a good deal of ale tonight: you are merry, loose-tongued, a little slurred and very fond of everyone.' : '');
    (O.extraLines = O.extraLines || []).push((s, q) => q.age < 13 && q._game ? `You were just playing ${q._game} with the other children. You can ask the player to play (play_game).` : '');

    // join the children's game
    (O.moreCandidates = O.moreCandidates || []).push(() => {
      const s = cur(), P = game.player; if (!s || game.scene || s.raining) return null;
      const kids = s.people.filter((q) => q.age >= 5 && q.age < 13 && q._game && near(q, 90)); if (kids.length < 2) return null;
      const g = kids[0]._game;
      return { type: 'custom', d: 10, x: kids[0].agent.x, y: kids[0].agent.y - 46, label: `Join the children's ${g}`, act: () => {
        const G = GAMES.find((x) => x.name === g) || GAMES[0]; P.anim = G.anim === 'crouch' ? 'crouch' : 'run'; setTimeout(() => { P.anim = 'idle'; }, 2500);
        for (const k of kids) { O.gesture(k, 'laugh', 2.5); s.relate(k, { id: 0 }, 0.03); }
        sp(kids[0], pick(['A grown-up wants to play!', 'You\'re it!', 'You have to hop on one foot!']), 2.4);
        PS.mood = Math.min(100, (PS.mood || 50) + 4); PS.energy = Math.max(0, PS.energy - 3);
        setTimeout(() => { sp(kids[1], pick(['Again!', 'You\'re slow!', 'That was the best!']), 2.2); say(`You play ${g} with the children till you're out of breath. They'll remember you for it.`); }, 2600);
      } };
    });

    // ---------------------------------------------------------------- washing lines
    let _line = {};
    const lineSprite = (wet) => {
      if (_line[wet]) return _line[wet]; const c = document.createElement('canvas'); c.width = 40; c.height = 26; const x = c.getContext('2d');
      x.fillStyle = '#5a3d24'; x.fillRect(1, 4, 2, 22); x.fillRect(37, 4, 2, 22); x.fillStyle = '#8b6b48'; x.fillRect(1, 4, 2, 1); x.fillRect(37, 4, 2, 1);
      x.fillStyle = '#d8d0b8'; x.fillRect(3, 6, 34, 1);
      if (!wet) { const cl = [['#e8e4d8', 4, 7, 7, 9], ['#9a5a48', 12, 7, 6, 11], ['#6a7a98', 19, 7, 8, 7], ['#e8e4d8', 28, 7, 7, 10]]; for (const [col, a, b, w, hgt] of cl) { x.fillStyle = col; x.fillRect(a, b, w, hgt); x.fillStyle = 'rgba(0,0,0,0.18)'; x.fillRect(a, b + hgt - 1, w, 1); x.fillRect(a + w - 1, b, 1, hgt); x.fillStyle = '#c8b898'; x.fillRect(a + 1, 6, 1, 2); x.fillRect(a + w - 2, 6, 1, 2); } }
      return (_line[wet] = { canvas: c, W: 40, H: 26, ox: 20, oy: 25 });
    };
    const washDay = (s) => s.weekday === 0 || s.weekday === 3; // Moonday and Thorsday
    function hangLines(w) {
      if (!w || !w.buildings || w._washLines) return; w._washLines = [];
      const houses = w.buildings.filter((b) => /house|cottage|home|hovel/.test(b.type || b.kind || '') && b.doorX != null);
      for (const h of houses) {
        if (O.hash('wash', w.placeId || w.name || 'x', h.id) % 3) continue;
        const fits = (x0, y) => { for (let i = 0; i < 3; i++) { const k = y * w.W + x0 + i; if (w.solid[k] || (w.ter[k] !== w.TER.GRASS && w.ter[k] !== w.TER.YARD) || w.buildings.some((b) => x0 + i >= b.x - 1 && x0 + i <= b.x + b.w && y >= b.y - 1 && y <= b.bottom + 1)) return false; } return !w.props.some((p) => Math.abs(p.x - (x0 * T + 24)) < 40 && Math.abs(p.y - y * T) < 24); };
        const spot = [[h.x + h.w + 1, h.bottom], [h.x - 4, h.bottom], [h.x + h.w + 1, h.bottom - 2], [h.x - 4, h.bottom - 2], [h.x + h.w + 1, h.bottom + 3]].find(([x, y]) => fits(x, y)); if (!spot) continue; const [x0, y] = spot;
        const p = { kind: 'washline', x: x0 * T + 24, y: y * T + 14, seed: 1, v: 0, solid: false, wash: true, sprite: lineSprite(true) }; w.props.push(p); w._washLines.push(p);
      }
      w.dirtyStatics = true;
    }
    let wt = 0;
    game.hooks.update.push((dt) => {
      wt -= dt; if (wt > 0) return; wt = 3; const s = cur(), w = game.world; if (!s || !w || !w.props || game.scene) return;
      hangLines(w); const out = washDay(s) && s.hour >= 8 && s.hour < 17 && !s.raining && W().kind !== 'snow';
      let ch = false; for (const p of w._washLines) { const sp2 = lineSprite(!out); if (p.sprite !== sp2) { p.sprite = sp2; ch = true; } }
      if (ch) w.dirtyStatics = true;
    });

    // ---------------------------------------------------------------- an ale with anyone, at the tavern
    const base = O.NpcActs.apply;
    O.NpcActs.apply = function (s, q, a, main) {
      if (a && a.do === 'drink_with') {
        const tav = game.scene && taverns(s).has((game.scene.b.parent || game.scene.b).id); if (!tav) return `${q.first} would, but not here: at the tavern.`;
        const pr = 2; if (PS.money < pr) return 'You haven\'t the price of two ales.'; PS.money -= pr;
        O.gesture(q, 'drink', 2.6); game.player.anim = 'drink'; setTimeout(() => { if (game.player.anim === 'drink') game.player.anim = 'idle'; }, 2600);
        s.relate(q, { id: 0 }, 0.05); q._ales = (q._alesDay === s.day ? q._ales || 0 : 0) + 1; q._alesDay = s.day; if (q._ales >= 3) q.tipsy = s.day;
        PS.mood = Math.min(100, (PS.mood || 50) + 3); PS.ales = (PS.alesDay === s.day ? PS.ales || 0 : 0) + 1; PS.alesDay = s.day;
        if (PS.ales >= 4) say('The room has a gentle sway to it now.');
        return `You and ${q.first} drink an ale together (₳${pr}).${q._ales >= 3 ? ` ${q.first} is getting merry.` : ''}`;
      }
      if (a && a.do === 'sweep_step') { O.gesture(q, 'sweep', 3); return `${q.first} takes up a broom and sweeps.`; }
      return base.apply(this, arguments);
    };
    (O.extraActs = O.extraActs || []).push('drink_with {} (at the tavern, you and the player share an ale which the player pays for; you get merry after three)');
    // a drunk player staggers a little and says so
    let dt2 = 0;
    game.hooks.update.push((dt) => { dt2 -= dt; if (dt2 > 0) return; dt2 = 9; const s = cur(); if (!s || PS.alesDay !== s.day || (PS.ales || 0) < 4 || game.scene) return; if (Math.random() < 0.4) O.Speech && O.Speech.say(game.player, pick(['Hic!', '*hic*']), 1.6); });
  }
  O.StreetLifeSetup = { setup };
})();
