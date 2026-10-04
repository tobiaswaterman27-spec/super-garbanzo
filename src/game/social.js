// The town's own social life, played out where you can see it. People who pass a friend wave and
// call out; those with time on their hands stop and talk (about the weather, prices, work, family,
// the news, each other), and their talk shows over their heads. Old enemies who meet trade words,
// and now and then the words turn to blows: a scuffle in the street until one gives way or the watch
// comes running to break it up. Every meeting moves how they feel about each other, and friendships
// count when a master is choosing who to take on.
'use strict';
(function () {
  function setup(game, npcUI) {
    const live = []; let next = 0;
    const busy = (q) => !q.agent || q.agent.hidden || q.agent.inside != null || q.agent.frozen || q.errand || q.agent.chasing || q.agent.chase || q.agent.fleeing || q.alive === false || (q.health && q.health.hp < 40) || q.age < 6 || q.visitor && q.journey == null || (npcUI.talking && npcUI.talking() === q) || q.arriving;
    const FREE = new Set(['stroll', 'wait-work', 'shop', 'home', 'socialise', 'play', 'eat-out', 'festival', 'rest', 'leave', 'work', 'carry-home']);
    const affinity = (a, b) => (a.rel.get(b.id) || {}).affinity || 0;
    const pick = (arr, k) => arr[Math.abs(k) % arr.length];
    function lines(s, a, b, kind) {
      const k = a.id * 7 + b.id + s.day, w = s.weather?.kind || 'fair', K = s.kingdom, news = K && K.news && K.news.length ? K.news[K.news.length - 1 - (k % Math.min(3, K.news.length))].text : null;
      const bread = s.biz && [...s.biz.values()].find((z) => z.type === 'bakery'), pr = bread && s.price ? s.price(bread, 'bread') : null;
      if (kind === 'wave') return [[a, pick([`Morning, ${b.first}!`, `${b.first}! Well met.`, `God keep you, ${b.first}.`, `Mind how you go, ${b.first}.`], k)]];
      if (kind === 'argue') return [
        [a, pick([`You've some nerve showing your face, ${b.first}.`, `I've not forgotten what you did, ${b.first}.`, `Out of my way.`, `Still owe me, you do.`], k)],
        [b, pick(['Say that again.', 'Mind your tongue.', 'You want to make something of it?', 'Go and boil your head.'], k + 1)],
        [a, pick(['Liar and a cheat, the whole town knows it.', "Don't you turn your back on me!", 'You heard.', "I'll say it as loud as I like."], k + 2)],
      ];
      const topics = [
        [[a, w === 'rain' || w === 'heavy' ? 'Will this rain never stop?' : w === 'snow' ? 'Bitter out, this snow.' : w === 'heat' ? 'Hot enough to bake bread on the step.' : 'Fine day for it.'], [b, pick(['It is that.', "Good for the crops, they say.", 'My knees could have told you.', 'Can\'t complain.'], k)]],
        [[a, pr ? `Bread's ₳${pr} a loaf now, did you hear?` : 'Everything costs more than it did.'], [b, pick(['Robbery, I call it.', 'And the loaves smaller.', 'Times are hard.', 'My mother paid half an aurin.'], k)]],
        [[a, a.job ? pick([`Long day at the ${a.job.role === 'baker' ? 'ovens' : 'work'}.`, `They've had me ${a.job.role === 'guard' ? 'on the gate' : 'run off my feet'} all week.`], k) : 'Still looking for work.'], [b, pick(['Keep at it.', 'Something will turn up.', "Better than idle hands.", 'Aye, me too.'], k + 3)]],
        [[a, `How's the family, ${b.first}?`], [b, pick(['All well, thank God.', 'The little one has a cough.', 'Growing like weeds.', "Don't ask."], k + 5)]],
        ...(news ? [[[a, `Heard the news? ${news.length > 90 ? news.slice(0, 87) + '…' : news}`], [b, pick(['Never!', 'So they say.', "I'll believe it when I see it.", 'What a world.'], k + 2)]]] : []),
      ];
      return pick(topics, k + Math.floor(game.t / 50));
    }
    function begin(s, a, b, kind) {
      const ls = lines(s, a, b, kind);
      const m = { s, a, b, kind, ls, i: 0, at: game.t, blows: 0 };
      // stand a pace apart, face to face
      if (kind !== 'wave') { const dx = b.agent.x - a.agent.x, dy = b.agent.y - a.agent.y, d = Math.hypot(dx, dy) || 1; if (d < 20) { const ux = Math.abs(dx) >= Math.abs(dy) * 0.5 ? Math.sign(dx || 1) : 0, uy = ux ? 0 : Math.sign(dy || 1); const nx = a.agent.x + ux * 20, ny = a.agent.y + uy * 14; if (!game.solidAt(nx, ny)) { b.agent.x = nx; b.agent.y = ny; } } }
      if (kind !== 'wave') for (const [x, y] of [[a, b], [b, a]]) { x.agent.frozen = true; x.agent.dir = O.dirOf(y.agent.x - x.agent.x, y.agent.y - x.agent.y); x._social = m; }
      live.push(m);
    }
    function end(m) {
      const { s, a, b, kind } = m;
      for (const x of [a, b]) { if (x._social !== m) continue; x._social = null; x.agent.forceAnim = null; if (!(npcUI.talking && npcUI.talking() === x)) x.agent.frozen = false; x._chatT = game.t + 45 + (x.id % 20); }
      const d = { wave: 0.02, chat: 0.04, argue: -0.08, fight: -0.25 }[kind] || 0;
      s.relate(a, b, d); s.relate(b, a, d);
      if (kind === 'fight') { s.remember(a, `Came to blows with ${b.name} in the street.`, 'social', 2, b.id); s.remember(b, `${a.name} went for me in the street.`, 'social', 2, a.id); }
      else if (kind === 'chat' && s.rng.chance(0.3)) s.remember(a, `Passed the time of day with ${b.first}.`, 'social', 0.5, b.id);
    }
    game.hooks.update.push(() => {
      const s = O.SimRef.cur; if (!s || game.scene || s.world !== game.world) { while (live.length) end(live.pop()); return; }
      // the meetings under way
      for (let i = live.length - 1; i >= 0; i--) {
        const m = live[i], { a, b } = m;
        if (a.alive === false || b.alive === false || a.agent.hidden || b.agent.hidden) { end(m); live.splice(i, 1); continue; }
        if (m.kind === 'wave') { if (m.i === 0) { O.Speech.say(m.ls[0][0], m.ls[0][1], 2.2); a.agent.anim = 'wave'; m.i = 1; } if (game.t - m.at > 1.2) { end(m); live.splice(i, 1); } continue; }
        if (m.kind === 'fight') {
          // blows traded in turn; the weaker gives way, or the watch arrives
          const t = game.t - m.at, turn = Math.floor(t / 0.7) % 2, hitter = turn ? b : a, other = turn ? a : b;
          hitter.agent.forceAnim = 'attack'; other.agent.forceAnim = Math.floor(t / 0.35) % 2 ? 'hurt' in O.Char.ANIMS ? 'hurt' : 'shocked' : 'idle';
          if (Math.floor(t / 0.7) > m.blows) { m.blows++; other.health.hp = Math.max(35, other.health.hp - 4); if (m.blows % 2) O.Speech.say(hitter, pick(['Take that!', 'Had enough?', 'Come on then!', "That's for you!"], m.blows + a.id), 1.2, 'angry'); }
          const g = m.guard;
          if (!g && m.blows === 3) { const gd = s.people.filter((q) => q.job?.role?.startsWith('guard') && q.agent && !q.agent.hidden && q.agent.inside == null && !q.errand).sort((p, q) => Math.hypot(p.agent.x - a.agent.x, p.agent.y - a.agent.y) - Math.hypot(q.agent.x - a.agent.x, q.agent.y - a.agent.y))[0]; if (gd && Math.hypot(gd.agent.x - a.agent.x, gd.agent.y - a.agent.y) < 400) { m.guard = gd; O.Errands.send(s, gd, [Math.floor(a.agent.x / s.T), Math.floor(a.agent.y / s.T) + 1], { anim: 'point', secs: 2, face: 3, at: () => { O.Speech.say(gd, 'Break it up! Both of you!', 2.5, 'shout'); m.stopped = true; } }); } }
          if (m.stopped || m.blows >= 10 || other.health.hp <= 40) { if (!m.stopped) { O.Speech.say(other, pick(['Enough! Enough!', 'All right, all right!', 'Pax!'], m.blows), 2, 'angry'); } other.agent.shockedUntil = s.minute + 2; end(m); live.splice(i, 1); }
          continue;
        }
        // talk, a line at a time
        if (game.t >= (m.next || m.at) && m.i < m.ls.length) { const [who, txt] = m.ls[m.i]; O.Speech.say(who, txt, 2.6, m.kind === 'argue' ? 'angry' : '', 280); m.next = game.t + 2.4 + txt.length * 0.05; who.agent.talking = 3; who.agent.forceAnim = m.kind === 'argue' ? 'point' : 'talk'; const o = who === a ? b : a; o.agent.forceAnim = m.kind === 'argue' ? 'idle' : 'idle'; m.i++; }
        if (m.i >= m.ls.length && game.t > (m.next || 0) + 0.5) {
          // a quarrel between two who hate each other, the hot-headed or the brave, may come to blows
          if (m.kind === 'argue' && affinity(a, b) < -0.45 && (s.has(a, 'hostile') || s.has(a, 'brave') || s.has(b, 'hostile') || s.has(a, 'risk-taking')) && s.rng.chance(0.55)) { m.kind = 'fight'; m.at = game.t; m.blows = 0; O.Speech.say(a, 'Right, that does it!', 1.6, 'angry'); continue; }
          end(m); live.splice(i, 1);
        }
      }
      if (game.t < next) return; next = game.t + 1.2;
      // new meetings, only where you'd see them
      const P = game.player, near = s.people.filter((q) => !busy(q) && q._social == null && !(q._chatT > game.t) && FREE.has(q.activity?.act) && Math.abs(q.agent.x - P.x) < 240 && Math.abs(q.agent.y - P.y) < 170);
      if (live.length >= 4) return;
      for (let i = 0; i < near.length; i++) for (let j = i + 1; j < near.length; j++) {
        const a = near[i], b = near[j]; if (a._social || b._social) continue;
        const d = Math.hypot(a.agent.x - b.agent.x, a.agent.y - b.agent.y); if (d > 52) continue;
        const fa = affinity(a, b), fb = affinity(b, a), walking = a.agent.path || b.agent.path;
        if (fa < -0.3 || fb < -0.3) { if (s.rng.chance(0.5)) { begin(s, a, b, 'argue'); return; } continue; }
        if (walking && (fa > 0.25 || fb > 0.25) && s.rng.chance(0.6)) { begin(s, a.agent.path ? a : b, a.agent.path ? b : a, 'wave'); a._chatT = b._chatT = game.t + 30; return; }
        const sociable = (s.has(a, 'social') || s.has(a, 'friendly') ? 0.25 : 0) + (fa > 0.2 ? 0.25 : 0) + (a.activity?.act === 'stroll' || a.activity?.act === 'wait-work' ? 0.2 : 0) + (walking ? -0.15 : 0.1);
        if (a.age >= 13 && b.age >= 13 && s.rng.chance(0.15 + sociable)) { begin(s, a, b, 'chat'); return; }
      }
    });
    O.Social = { live, begin, stats: () => { const s = O.SimRef.cur, P = game.player; return s.people.filter((q) => !busy(q) && FREE.has(q.activity?.act) && Math.abs(q.agent.x - P.x) < 240 && Math.abs(q.agent.y - P.y) < 170).length; } };
  }
  O.SocialSetup = { setup };
})();
