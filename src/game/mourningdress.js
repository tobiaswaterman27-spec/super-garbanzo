// Mourning, worn. For the week after a death the close family go in black: the women with a dark veil
// over the hair, the men with a black band on the sleeve; and the neighbours, meeting them in the street,
// stop to touch an arm and say a word for the dead. You can offer your condolences too, and it's
// remembered.
'use strict';
(function () {
  function setup(game) {
    const cur = () => O.SimRef.cur;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    const comforted = new Map(), yours = new Map(); let acc = 0, comforts = 0, condolences = 0;
    const talking = (q) => O.npcUI && O.npcUI.talking && O.npcUI.talking() === q;
    const mourner = (s, q) => q.mourning && q.mourning.kin && s.day <= q.mourning.until && q.alive !== false;
    game.hooks.update.push((dt) => { acc += dt; if (acc < 1) return; acc = 0; const s = cur(); if (!s || !s.people || game.scene) return; const P = game.player;
      // a neighbour stops to comfort them, once a day
      for (const q of s.people) { if (!mourner(s, q)) continue; const a = q.agent; if (!a || a.hidden || a.inside != null || a.frozen || q.errand || comforted.get(q.id) === s.day || Math.hypot(a.x - P.x, a.y - P.y) > 300) continue;
        const n = s.people.find((x) => x !== q && x.home !== q.home && x.age >= 16 && x.agent && !x.agent.hidden && x.agent.inside == null && !x.agent.frozen && !x.errand && !talking(x) && Math.hypot(x.agent.x - a.x, x.agent.y - a.y) < 110); if (!n) continue;
        comforted.set(q.id, s.day); comforts++; n.agent.dir = O.dirOf(a.x - n.agent.x, a.y - n.agent.y); a.dir = O.dirOf(n.agent.x - a.x, n.agent.y - a.y);
        O.gesture && O.gesture(n, 'give', 1.6); O.gesture && O.gesture(q, 'mourn', 2.2); O.Speech && O.Speech.say(n, pick([`I'm sorry for your trouble. ${q.mourning.for} was a good soul.`, 'God rest them. If there\'s anything you need...', 'I was sorry to hear. Truly.']), 3); setTimeout(() => O.Speech && O.Speech.say(q, pick(['Thank you. Thank you.', 'It was so sudden.', 'Pray for them.']), 2), 2600); try { s.relate(q, n, 0.08); } catch (e) { /* */ } break; } });
    (O.moreCandidates = O.moreCandidates || []).push(() => { const s = cur(), P = game.player; if (!s || game.scene || P.locked) return null; const q = s.people.find((x) => mourner(s, x) && x.agent && !x.agent.hidden && x.agent.inside == null && yours.get(x.id) !== x.mourning.until && Math.hypot(x.agent.x - P.x, x.agent.y - P.y) < 30); if (!q) return null;
      return { type: 'custom', d: 30, x: q.agent.x, y: q.agent.y - 26, label: `Offer ${q.first} your condolences`, act: () => { yours.set(q.id, q.mourning.until); condolences++; P.anim = 'bow'; setTimeout(() => { P.anim = 'idle'; }, 1000); const r = q.rel.get(0) || { affinity: 0, familiar: 0 }; r.affinity = Math.min(1, r.affinity + 0.15); r.familiar = Math.min(1, (r.familiar || 0) + 0.1); q.rel.set(0, r); try { s.remember(q, `A stranger stopped to say they were sorry about ${q.mourning.for}.`, 'kindness', 0.5); } catch (e) { /* */ } O.gesture && O.gesture(q, 'mourn', 2); O.Speech && O.Speech.say(q, pick([`Thank you. ${q.mourning.for} would have liked you, I think.`, 'That\'s kind of you. Kinder than some.', 'Thank you. It doesn\'t feel real yet.']), 3); } }; });
    // the black: a veil over the hair, or a band on the sleeve
    game.hooks.drawWorld.push((ctx, cam) => { const s = cur(); if (!s || game.scene) return; const W = ctx.canvas.width, H = ctx.canvas.height;
      for (const q of s.people) { if (!mourner(s, q)) continue; const a = q.agent; if (!a || a.hidden || a.inside != null) continue; const x = Math.round(a.x - cam.x), y = Math.round(a.y - cam.y) - (a.lift || 0); if (x < -20 || y < -40 || x > W + 20 || y > H + 20) continue; if (O.occluded && O.occluded(a.x, a.y)) continue; const kid = q.age < 13;
        if (q.sex === 'f') { const hy = y - (kid ? 25 : 31); ctx.fillStyle = '#1a1820'; ctx.fillRect(x - 4, hy, 8, 3); if (a.dir !== 0) ctx.fillRect(x - 4, hy + 2, 8, 5); else { ctx.fillRect(x - 4, hy + 2, 2, 6); ctx.fillRect(x + 2, hy + 2, 2, 6); } }
        else { ctx.fillStyle = '#141218'; ctx.fillRect(x + (a.dir === 1 ? -6 : 4), y - (kid ? 15 : 19), 2, 2); } } });
    (O.extraLines = O.extraLines || []).push((s, q) => mourner(s, q) ? `You are in mourning for ${q.mourning.for}, and wear black for them.` : '');
    O.MourningDress = { get comforts() { return comforts; }, get condolences() { return condolences; } };
  }
  O.MourningDressSetup = { setup };
})();
