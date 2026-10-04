// The ones who belong to no town. A troupe of minstrels goes the round of the realm: they walk the
// roads from one town to the next, play and sing in the tavern by the hearth through the afternoon
// and evening, and move on. And at one of the old ruins out in the country a hermit lives alone by a
// small fire, who'll talk to anyone who comes, in riddles and old sayings, and sometimes with news.
'use strict';
(function () {
  const FIRST = { m: ['Wat', 'Piers', 'Jory', 'Hob', 'Lambert', 'Colin', 'Martin'], f: ['Joan', 'Mabel', 'Sibley', 'Annot', 'Gilly', 'Rose'] };
  function setup(game, home) {
    const T = 16, K = () => home.kingdom;
    // ---------------------------------------------------------------- the troupe
    let checked = -1;
    game.hooks.update.push(() => {
      const k = K(); if (!k || !k.route || home.day === checked) return; checked = home.day;
      const live = (k.journeys || []).find((j) => j.purpose === 'perform' && !j.done);
      if (live) { if (live.arrived && live.arrivedDay == null) live.arrivedDay = home.day; if (live.arrived && home.day - live.arrivedDay >= 1) live.done = true; return; }
      const r = O.RNG(O.hash('troupe', home.day, O.lifeSeed || 0)), from = k.troupeAt || r.pick(k.places.filter((p) => p.kind !== 'hamlet')).id;
      const nb = (O.Island.data().neighbours ? O.Island.data().neighbours(from) : []).map((x) => (typeof x === 'string' ? x : x.id)).filter((x) => k.place(x));
      const to = nb.length ? r.pick(nb) : r.pick(k.places).id, path = k.route(from, to); if (!path || path.length < 2) return;
      const travellers = [0, 1, 2].map((i) => { const sex = i === 1 ? 'f' : 'm', first = r.pick(FIRST[sex]); return { name: `${first} the ${['Piper', 'Singer', 'Fiddler', 'Juggler'][(i + home.day) % 4]}`, first, sex, age: r.int(18, 50), role: 'minstrel', seed: O.hash('min', home.day, i), genes: O.Char.randomGenes(r, 'south') }; });
      k.journeys = k.journeys || [];
      k.journeys.push({ id: 'troupe' + home.day, from, to, path, purpose: 'perform', goods: null, people: [], travellers, started: home.day * 1440 + home.minute, back: false, horse: false });
      k.troupeAt = to;
      home.log(`A troupe of minstrels is on the road from ${k.place(from).name} to ${k.place(to).name}.`, 'day');
    });

    // ---------------------------------------------------------------- the hermit
    let hermit = null;
    const SAYINGS = ['The river does not ask the stone for leave.', 'A full purse is a heavy pillow.', 'Who digs a pit for another falls in it himself.', 'Every lord was once a babe that wept.', 'The crow knows more of this kingdom than the crown does.', 'Be kind to the miller: he has seen your bread before you have.', 'The road is long only to the one who counts the stones.', 'Sit. The fire is free, if nothing else is.'];
    game.hooks.update.push(() => {
      const w = game.world; if (!w || game.scene) return;
      if (!hermit || hermit.world !== w.placeId) {
        hermit = null;
        const ruins = (w.buildings || []).filter((b) => b.type === 'ruin' && b.doorX != null);
        const rr = ruins.find((b) => O.hash('hermit', b.id, w.placeId) % 3 === 0);
        if (rr) {
          const a = O.Char.makeAppearance(O.hash('hermit', w.placeId), { sex: 'm', age: 71, role: 'priest', wealth: 0.1 });
          a.outfit.over = O.Pal.mat('#6a5a44', 'cloth'); a.outfit.hat = 'hood'; a.outfit.hatMat = a.outfit.over; O.Char.invalidate(a);
          hermit = { a, x: rr.doorX * T + 8 + 22, y: (rr.doorY + 1) * T + 4, dir: 1, anim: 'sit', ft: 0, hermit: true, world: w.placeId, name: 'the hermit' };
        }
      }
      if (hermit) { game.actors = game.actors.filter((x) => !x.hermit); hermit.anim = (Math.floor(game.t / 6) % 4) ? 'sit' : 'pray'; game.actors.push(hermit); }
    });
    // his little fire
    game.hooks.drawWorld.push((ctx, cam) => {
      if (!hermit || game.scene || hermit.world !== game.world.placeId) return;
      const x = Math.round(hermit.x - 18 - cam.x), y = Math.round(hermit.y - 2 - cam.y), f = Math.floor(game.t * 8) % 3;
      ctx.fillStyle = '#4a3828'; ctx.fillRect(x - 4, y, 9, 2); ctx.fillStyle = '#ff9a30'; ctx.fillRect(x - 2, y - 3 - (f % 2), 5, 3); ctx.fillStyle = '#ffe080'; ctx.fillRect(x - 1, y - 4 - f % 2, 2, 2);
    });
    O.hermitCandidate = () => {
      if (!hermit || game.scene || hermit.world !== game.world.placeId) return null;
      const p = game.player, d = Math.hypot(hermit.x - p.x, hermit.y - p.y); return d < 30 ? { type: 'hermit', d, x: hermit.x, y: hermit.y - 40 } : null;
    };
    O.hermitAct = () => {
      const k = K(), n = k.news && k.news.length ? k.news[k.news.length - 1].text : null, i = Math.floor(game.t / 7 + home.day) % SAYINGS.length;
      hermit.dir = O.dirOf(game.player.x - hermit.x, game.player.y - hermit.y);
      O.UI.dialog.open({ name: 'The hermit', color: '#6a5a44', text: `${SAYINGS[i]}${n && i % 2 ? ` They say, down in the towns: ${n}` : ''}`, options: [] });
    };
  }
  O.WanderersSetup = { setup };
})();
