// The watch at practice. Of a morning and in the slack of the afternoon two of the watch come out of
// the guardhouse with wooden swords and go at it in the yard: cut and parry, a sidestep, a lunge, the
// clack of wood on wood, a rap on the knuckles; the sergeant (or the oldest of them) stands by calling
// "Again!" and "Guard up!". Each bout goes to three touches. Folk stop to watch, and you can put a
// coin on one of them ("my money's on Hal", "two on the tall one").
'use strict';
(function () {
  const T = 16;
  function setup(game) {
    const cur = () => O.SimRef.cur, PS = O.PlayerState;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    const say = (q, t, secs) => O.Speech && O.Speech.say(q, t, secs || 1.6);
    const near = (x, y, r) => Math.hypot(x - game.player.x, y - game.player.y) < r;
    const isWatch = (q) => /guard|sergeant|watch|captain|constable/.test(q.job?.role || '');
    let bout = null, cool = 20;
    const hold = (q) => { q._spar = true; const a = q.agent; a.frozen = true; a.path = null; a.inside = null; a.hidden = false; };
    const let_go = (q, back) => { if (!q || !q._spar) return; q._spar = false; const a = q.agent; a.forceAnim = null; const tq = O.npcUI && O.npcUI.talking && O.npcUI.talking(); if (tq !== q) { a.frozen = false; if (back != null && q.activity && q.activity.act === 'work') { a.inside = back; a.hidden = true; } } };
    function begin(s, force) {
      const gb = [...s.biz.values()].find((z) => z.type === 'guard'); if (!gb) return null; const bid = gb.b?.id ?? gb.id, b = s.building(bid); if (!b || b.doorX == null) return null;
      const cx = b.doorX * T + 8, cy = (b.doorY + 2) * T + 8; if (game.solidAt(cx - 20, cy - 2) || game.solidAt(cx + 20, cy - 2)) return null;
      if (!force && !near(cx, cy, 420)) return null;
      const ws = s.people.filter((q) => isWatch(q) && q.alive !== false && q.agent && !q._spar && !q.errand && !q._scene && !q._fighting && !q.jailUntil && !(O.npcUI && O.npcUI.talking && O.npcUI.talking() === q) && (q.agent.inside === bid || (q.agent.inside == null && !q.agent.hidden && Math.hypot(q.agent.x - cx, q.agent.y - cy) < 200 && !q.agent.frozen)));
      if (ws.length < 2) return null; ws.sort((a, b) => (b.age || 0) - (a.age || 0));
      const [ref, ...rest] = ws.length >= 3 ? ws : [null, ...ws]; const [a, c] = rest.slice(0, 2).sort(() => Math.random() - 0.5);
      for (const q of [a, c, ...(ref ? [ref] : [])]) { q._sparBack = q.agent.inside; hold(q); }
      a.agent.x = cx - 12; a.agent.y = cy; c.agent.x = cx + 12; c.agent.y = cy; if (ref) { ref.agent.x = cx; ref.agent.y = cy - 20; ref.agent.dir = 3; }
      bout = { s, a, c, ref, cx, cy, bid, t: 0, beat: 1.2, score: [0, 0], sway: 0, bets: [], first: true };
      O.sfx && near(cx, cy, 300) && O.sfx('door', 0.3); if (ref) say(ref, pick(['Three touches. Begin!', 'Guards up. Go.', 'Let\'s see you earn your pay.']), 2);
      return bout;
    }
    function end() { const b = bout; if (!b) return; for (const q of [b.a, b.c, b.ref]) if (q) let_go(q, q._sparBack); bout = null; cool = 60 + Math.random() * 60; }
    const skill = (q) => ((q.skills && (q.skills.fighting || q.skills.combat)) || 0.3) + (q.age < 40 ? 0.1 : 0) + ((q.traits || []).includes('brave') ? 0.08 : 0);
    function touch(b, w) { const i = w === b.a ? 0 : 1; b.score[i]++; const l = i ? b.a : b.c; O.sfx && near(b.cx, b.cy, 280) && O.sfx('smack', 0.4); l.agent.forceAnim = 'hurt'; w.agent.forceAnim = 'celebrate';
      if (b.score[i] >= 3) { b.over = 2.5; b.win = w; if (b.ref) say(b.ref, `${w.first} has it, three to ${b.score[1 - i]}.`, 2.2); else say(w, pick(['That\'s three. Pay up.', 'Three! Better luck tomorrow.']), 2); w.skills && (w.skills.fighting = Math.min(1, (w.skills.fighting || 0.3) + 0.01)); settle(b); }
      else if (b.ref && Math.random() < 0.6) say(b.ref, pick([`Touch to ${w.first}!`, 'Again!', `Guard UP, ${l.first}!`, 'Feet! Watch your feet!']), 1.4); else if (Math.random() < 0.4) say(l, pick(['Ow! My knuckles!', 'Lucky.', 'Hah, you\'ll pay for that.']), 1.4); }
    function settle(b) { for (const bet of b.bets) { if (bet.on === b.win) { PS.money += bet.amt * 2; O.UI.say(`Your money was on ${b.win.first}: you take ₳${bet.amt * 2}.`, 'good'); } else O.UI.say(`Your money was on ${bet.on.first}. Gone.`, 'note'); } b.bets = []; }
    game.hooks.update.push((dt) => {
      const s = cur(); if (!s) return;
      if (!bout) { cool -= dt; if (cool > 0 || game.scene) return; cool = 10; const h = s.minute / 60; if (!((h >= 7 && h < 10) || (h >= 14 && h < 16.5))) return; if (Math.random() < 0.5) begin(s); return; }
      const b = bout; b.t += dt; const { a, c } = b;
      if (b.s !== s || game.scene || [a, c].some((q) => q.alive === false || q._fighting) || b.t > 90) { end(); return; }
      if ([a, c, b.ref].some((q) => q && O.npcUI && O.npcUI.talking && O.npcUI.talking() === q)) return; // (a pause while you talk)
      if (b.over != null) { b.over -= dt; if (b.over <= 0) { if (b.ref && b.t < 60 && Math.random() < 0.5) { b.score = [0, 0]; b.over = null; say(b.ref, 'Again. From the start.', 1.6); } else end(); } return; }
      // circling
      b.sway += dt; const off = Math.sin(b.sway * 1.3) * 4, lunge = b.lunge ? Math.max(0, b.lunge -= dt) : 0;
      a.agent.x = b.cx - 12 + off + (b.atk === a ? (0.35 - Math.abs(lunge - 0.35)) * 16 : 0); c.agent.x = b.cx + 12 + off - (b.atk === c ? (0.35 - Math.abs(lunge - 0.35)) * 16 : 0); a.agent.y = c.agent.y = b.cy + Math.cos(b.sway * 0.9) * 2;
      a.agent.dir = 2; c.agent.dir = 1; if (b.ref) { b.ref.agent.dir = 3; b.ref.agent.forceAnim = Math.floor(b.t) % 7 === 0 ? 'point' : 'idle'; }
      b.beat -= dt; if (b.beat > 0) { if (!b.lunge) { a.agent.forceAnim = a.agent.forceAnim === 'hurt' || a.agent.forceAnim === 'celebrate' ? a.agent.forceAnim : 'block'; c.agent.forceAnim = c.agent.forceAnim === 'hurt' || c.agent.forceAnim === 'celebrate' ? c.agent.forceAnim : 'block'; } return; }
      b.beat = 0.9 + Math.random() * 0.7; const atk = Math.random() < 0.5 ? a : c, def = atk === a ? c : a; b.atk = atk; b.lunge = 0.7; atk.agent.forceAnim = 'attack';
      const edge = skill(atk) - skill(def) + (Math.random() - 0.5) * 0.9; const r = Math.random();
      if (Math.random() < Math.max(0.15, Math.min(0.7, 0.32 + (skill(atk) - skill(def)) * 0.8))) setTimeout(() => bout === b && touch(b, atk), 260);
      else { def.agent.forceAnim = r < 0.6 ? 'block' : 'dodge'; setTimeout(() => { if (bout === b && O.sfx && near(b.cx, b.cy, 260)) O.sfx('place', r < 0.6 ? 0.35 : 0.1); }, 220); }
    });
    game.hooks.drawWorld.push((ctx, cam) => { const b = bout; if (!b || game.scene) return; for (const q of [b.a, b.c]) { const a = q.agent, x = Math.round(a.x - cam.x), y = Math.round(a.y - cam.y), dir = a.dir === 2 ? 1 : -1, swing = a.forceAnim === 'attack'; ctx.strokeStyle = '#a07a4a'; ctx.lineWidth = 1.5; ctx.beginPath(); const hx = x + dir * 5, hy = y - 13; ctx.moveTo(hx, hy); ctx.lineTo(hx + dir * (swing ? 12 : 6), hy - (swing ? 2 : 10)); ctx.stroke(); } });
    const respond = (q, t, line, render) => { (q._conv ||= []).push({ who: 'p', t }, { who: 'q', t: line }); render(line); return Promise.resolve(); };
    const _say = O.AIChat && O.AIChat.say;
    if (_say) O.AIChat.say = function (q, text, render) {
      try { const b = bout, t = String(text || ''); if (b && [b.a, b.c, b.ref].includes(q) && b.over == null && /\b(bet|money'?s on|wager|put .* on|stake|back(ing)?|(\d+|one|two|three|four|five|a penny|a coin|an aurin) on)\b/i.test(t)) {
          const m = t.match(/(\d+)/), W = { one: 1, two: 2, three: 3, four: 4, five: 5 }, wm = t.toLowerCase().match(/\b(one|two|three|four|five)\b/); const amt = Math.max(1, Math.min(10, m ? +m[1] : wm ? W[wm[1]] : /penny|coin|aurin/.test(t) ? 1 : 2)); const low = t.toLowerCase(); let on = [b.a, b.c].find((x) => low.includes(x.first.toLowerCase())) || (/\b(him|her|you)\b/.test(low) && q !== b.ref ? q : null) || (/\b(tall|old|big)\b/.test(low) ? [b.a, b.c].sort((x, y) => (y.age || 0) - (x.age || 0))[0] : null);
          if (!on) return respond(q, t, `On who? ${b.a.first} or ${b.c.first}? Say a name.`, render); if ((PS.money || 0) < amt) return respond(q, t, 'With what? Your purse is empty.', render);
          PS.money -= amt; b.bets.push({ on, amt }); O.gesture && O.gesture(q, 'nod', 1); return respond(q, t, q === on ? `On me? Ha! ₳${amt} it is. Don't blink.` : `₳${amt} on ${on.first}. Evens. You'll see.`, render); } } catch (e) { console.error(e); }
      return _say.apply(this, arguments);
    };
    (O.extraLines = O.extraLines || []).push((s, q) => { const b = bout; if (!b || ![b.a, b.c, b.ref].includes(q)) return ''; return q === b.ref ? `You are refereeing ${b.a.first} and ${b.c.first} at sword practice with wooden swords in the yard (${b.score[0]} to ${b.score[1]}).` : `You are at sword practice in the yard with wooden swords against ${q === b.a ? b.c.first : b.a.first}, ${q === b.a ? b.score[0] : b.score[1]} touches to ${q === b.a ? b.score[1] : b.score[0]}. Short of breath; keep it brief. The player can bet on the bout.`; });
    O.Sparring = { start: () => begin(cur(), true), get bout() { return bout; } };
  }
  O.SparringSetup = { setup };
})();
