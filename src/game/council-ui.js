// Seeing the realm governed. On election day the hall of the place holds the ballot box: a citizen
// (someone who lives here, in a house they own or rent) can read each candidate's record and put in
// their vote, or stand themselves if their name is good. On council day the leaders of the realm ride
// into the capital and take their seats at the long tables in the castle's great hall, the monarch on
// the throne, the guards at the doors; they leave again at evening.
'use strict';
(function () {
  function setup(game, home) {
    const PS = O.PlayerState, cur = () => O.SimRef.cur, say = (t, k) => O.UI.say(t, k), esc = (t) => O.escape(String(t));
    const K = () => home.kingdom;
    const HALLS = ['townhall', 'moothall', 'chapel', 'church', 'guard', 'keep'];
    const citizen = (s) => O.livesIn(s.world.placeId);
    const openElection = (s) => (K().elections || []).find((e) => e.place === s.world.placeId && !e.done);

    O.voteCandidate = () => {
      const s = cur(), sc = game.scene; if (!sc || !HALLS.includes(sc.b.type)) return null;
      const e = openElection(s); if (!e) return null;
      const p = game.player, it = sc.L.items.find((i) => i.kind === 'desk' || i.kind === 'altar' || i.counter) || sc.L.items[0]; if (!it) return null;
      const [x, y] = sc.anchor(it); if (Math.hypot(x - p.x, y + 10 - p.y) > 60) return null;
      return { type: 'vote', e, d: 5, x, y: y - 34 };
    };
    O.voteAct = (c) => {
      const s = cur(), e = c.e, pl = K().place(e.place);
      const voted = e.voters && e.voters.includes('player'), can = citizen(s);
      const rows = e.cands.map((k, i) => `<tr><td><b>${esc(k.name)}</b><br><small class="lbl">${esc(k.record)}</small></td><td>${can && !voted ? `<button data-v="${i}">Vote</button>` : ''}</td></tr>`).join('');
      const stand = can && !e.cands.some((k) => k.player) && PS.rep.local > -0.1 && !(PS.wantedLevel && PS.wantedLevel() > 0);
      O.Panels.open(`Election in ${pl.name}`, `<p class="caption">The old ${esc(K().leaders[e.place]?.title || 'leader').toLowerCase()} ${esc(e.oldName || '')} ${esc(e.why)}. The box is on the table; the count is tomorrow.${can ? '' : ' Only those who live here (in a house of their own or rented, where they sleep) may vote.'}${voted ? ' You have voted.' : ''}</p><table>${rows}</table>${stand ? '<div class="topics" style="margin-top:10px"><button data-stand="1">Stand yourself</button></div>' : ''}`, (r) => {
        r.querySelectorAll('[data-v]').forEach((b) => b.onclick = () => { e.votes[b.dataset.v] = (e.votes[b.dataset.v] || 0) + 1; (e.voters = e.voters || []).push('player'); game.player.anim = 'place'; O.Panels.close(); say(`You fold your vote and drop it in the box for ${e.cands[+b.dataset.v].name}.`); });
        const st = r.querySelector('[data-stand]'); if (st) st.onclick = () => { const nm = (O.Forge && O.Forge.player && O.Forge.player.name) || 'The newcomer'; e.cands.push({ name: nm, record: PS.emp ? `the ${PS.emp.role} at ${PS.emp.bizName}` : 'a newcomer of good name', votes: 0, appeal: 0.3 + PS.rep.local * 0.6 + PS.rep.civilian * 0.3, player: true }); O.Panels.close(); say("Your name goes up beside the others'. The count is tomorrow."); };
      });
    };

    // the council in the great hall: the realm's leaders come for the afternoon
    const SP = O.Sim.prototype, _plan = SP.plan;
    SP.plan = function (p) { if (p.councillor) return this.hour < 16.5 ? { act: 'feast', b: p.councillor } : { act: 'leave', outdoor: true, zone: 'east' }; return _plan.call(this, p); };
    let spawned = -1;
    game.hooks.update.push(() => {
      const s = cur(); if (!s.world.placeId || s.world.placeId !== (K().places.find((x) => x.kind === 'capital') || {}).id) return;
      const hall = s.world.buildings.find((b) => b.royal); if (!hall) return;
      const h = s.hour;
      if (s.weekday === 3 && h >= 13.5 && h < 16.5 && spawned !== s.day) {
        spawned = s.day; K().leadersInit && K().leadersInit();
        const L = Object.entries(K().leaders || {}).filter(([, l]) => !l.out).slice(0, 14);
        for (const [id, l] of L) {
          const q = s.newPerson({ sex: l.sex, age: 40 + (l.name.length % 20), first: l.first || l.name.split(' ')[0], sur: l.name.split(' ').slice(1).join(' '), household: 0, home: null, genes: O.Char.randomGenes(s.rng, 'south'), wealth: 0.85, visitor: true });
          q.name = `${l.title} ${l.name}`; q.title = l.title; q.councillor = hall.id; q.councilFor = id;
          q.app = O.Char.makeAppearance(O.hash('leader', id), { sex: q.sex, age: q.age, genes: q.genes, role: 'noble', wealth: 0.85 });
          const [ex, ey] = s.entry(hall); q.agent = { x: ex * 16 + 8, y: ey * 16 + 10, dir: 3, anim: 'idle', ft: 0, a: q.app, hidden: true, inside: hall.id, path: null, goal: null, person: q };
          s.people.push(q); s.byId.set(q.id, q);
        }
        say('The leaders of the realm are gathering in the great hall for the council.');
      }
      // gone home in the evening
      if (h >= 17 && s.people.some((q) => q.councillor)) { for (const q of s.people.filter((x) => x.councillor)) s.byId.delete(q.id); s.people = s.people.filter((q) => !q.councillor); }
    });

    // the minutes, for whoever asks at the castle or reads the map
    O.councilMinutes = () => {
      const log = (K().councilLog || []).slice(-3).reverse();
      if (!log.length) return '<p class="caption">The council of the realm meets every Thursday at two in the great hall.</p>';
      return log.map((m) => `<div class="lbl">Council of day ${m.day}</div><ul class="chron">${m.items.map((it) => `<li>${esc(it.who)} of ${esc(it.place)}: ${it.sacked ? 'put out of office' : it.resigned ? 'resigned' : `asked for ${esc(it.ask)}, ${it.granted ? 'granted' : 'refused'}`}</li>`).join('')}</ul>`).join('');
    };
  }
  O.CouncilUI = { setup };
})();
