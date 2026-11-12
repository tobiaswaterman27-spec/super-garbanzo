// Run for the midwife. When a woman's time comes at home, the house can't keep it in: the husband bursts
// out of the door half-dressed, shouting for the midwife, and the women of the lane come with kettles and
// linen to stand at the door. Offer to run, and he points you the way (her door, or wherever she is about);
// knock, tell her, and she's off at a trot with her bag. Or leave it, and he runs himself. When the child
// comes, the family remembers who ran; and now and then, a child is named for the stranger who did.
'use strict';
(function () {
  const T = 16;
  function setup(game) {
    const cur = () => O.SimRef.cur, PS = O.PlayerState;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    const say = (q, t, secs) => O.Speech && O.Speech.say(q, t, secs || 2.4);
    const near = (x, y, r) => Math.hypot(x - game.player.x, y - game.player.y) < r;
    const talking = (q) => O.npcUI && O.npcUI.talking && O.npcUI.talking() === q;
    const relOf = (q) => { const r = q.rel.get(0) || { affinity: 0, familiar: 0 }; q.rel.set(0, r); return r; };
    const me = () => { try { const sp = O.Forge && O.Forge.spec && O.Forge.spec(); return sp ? { name: sp.name, sex: sp.sex } : null; } catch (e) { return null; } };
    let E = null, runs = 0, byYou = 0, byDad = 0, named = 0, born = 0; const watch = []; // births to see through
    const doorOf = (s, b) => { const h = b != null && s.building(b); return h && h.doorX != null ? h : null; };
    const where = (s, q) => { const a = q.agent; if (a.inside != null) { const h = doorOf(s, a.inside); return h ? { x: h.doorX * T + 8, y: (h.doorY + 1) * T + 6, h } : null; } return { x: a.x, y: a.y, h: null }; };
    const rel_ = (q) => { if (!q || !q._mwrun) return; q._mwrun = false; if (q.agent) { q.agent.forceAnim = null; if (!talking(q)) q.agent.frozen = false; } };
    function end() { if (!E) return; for (const q of [E.dad, E.mw, ...(E.women || [])]) rel_(q); if (E.mw && E.savedTask && !E.mw.task && !E.fetched) E.mw.task = E.savedTask; E = null; }
    function start(s, mum) { const home = doorOf(s, mum.home), dad = s.byId.get(mum.spouse), mw = s.byId.get(mum.midwife); if (!home || !dad || dad.alive === false || !mw || mw.alive === false || !dad.agent || !mw.agent) return;
      if (!near(home.doorX * T, home.doorY * T, 520) || game.scene || dad === mw) return; runs++;
      // the midwife waits to be told (she doesn't know yet)
      const savedTask = mw.task; mw.task = null;
      const a = dad.agent; const seen = a.inside == null && !a.hidden && near(a.x, a.y, 450); if (!seen) { if (a.inside != null) { a.inside = null; a.hidden = false; } a.x = home.doorX * T + 8; a.y = (home.doorY + 1) * T + 8; } dad._mwrun = true; a.frozen = true; a.path = null; a.forceAnim = 'shocked';
      E = { s, mum, dad, mw, home, savedTask, t: 0, stage: 'cry', women: [] }; watch.push({ s, mum, kids: (mum.children || []).length, day: s.day, by: null });
      say(dad, pick([`The baby! It's coming! Someone fetch ${mw.first}!`, `${mw.first}! Somebody run for ${mw.first}, the baby's coming!`, 'Help! The baby! Oh God, the baby\'s coming now!']), 3);
      O.sfx && O.sfx('door', 0.3);
      // the women of the lane
      const ws = s.people.filter((q) => q.sex === 'f' && q.age >= 25 && q.household !== mum.household && q !== mw && q.agent && !q.agent.hidden && q.agent.inside == null && !q.agent.frozen && !q.errand && !q._mwrun && !talking(q) && q.alive !== false && Math.hypot(q.agent.x - a.x, q.agent.y - a.y) < 320).slice(0, 2);
      ws.forEach((w, i) => { w._mwrun = true; E.women.push(w); setTimeout(() => { if (!E || !E.women.includes(w)) return; say(w, pick(['I\'ll put the water on!', 'Linen! Who has clean linen?', `Hold on, ${mum.first}, we're coming!`]), 2); O.Errands.send(s, w, [home.doorX + (i ? 2 : -1), home.doorY + 1], { anim: 'carry', secs: 0.5, face: 0, sprint: true, giveUp: game.t + 30, after: (ok) => { if (!E || !E.women.includes(w)) return; if (!ok) { rel_(w); return; } w.agent.frozen = true; w.agent.path = null; w.agent.forceAnim = 'carry'; } }); }, 1500 + i * 1200); }); }
    function fetched(s, by) { if (!E || E.fetched) return; E.fetched = by; const mw = E.mw, home = E.home, w = watch.find((x) => x.mum === E.mum && x.by == null); if (w) w.by = by; if (by === 'you') byYou++; else byDad++;
      const a = mw.agent; if (a.inside != null) { const h = doorOf(s, a.inside); a.inside = null; a.hidden = false; if (h) { a.x = h.doorX * T + 8; a.y = (h.doorY + 1) * T + 8; } } a.frozen = false; a.forceAnim = null; mw._mwrun = true;
      if (near(a.x, a.y, 320)) say(mw, pick([`${E.mum.first}? Already? Right. My bag!`, 'Out of my way, then! Hot water, clean linen!', 'Babies never come when it suits.']), 2.4);
      O.Errands.send(s, mw, [home.doorX, home.doorY + 1], { anim: 'open', secs: 0.6, face: 0, sprint: true, giveUp: game.t + 60, after: () => { if (E && E.mw === mw) { rel_(mw); mw.task = E.savedTask || { act: 'visit', b: E.mum.home, midwife: true }; E.stage = 'in'; E.inT = 0; } } }); }
    game.hooks.update.push((dt) => { const s = cur(); if (!s || !s.world) return;
      // the births we're watching for
      for (const w of watch.slice()) { if (w.s !== s || s.day - w.day > 3 || w.mum.alive === false) { watch.splice(watch.indexOf(w), 1); continue; } const ch = w.mum.children || []; if (ch.length > w.kids) { watch.splice(watch.indexOf(w), 1); born++; const baby = s.byId.get(ch[ch.length - 1]); if (!baby) continue; const dad = s.byId.get(w.mum.spouse);
          if (w.by === 'you') { const m = me(); for (const q of [w.mum, dad]) { if (!q) continue; const r = relOf(q); r.affinity = Math.min(1, r.affinity + 0.25); r.familiar = Math.min(1, (r.familiar || 0) + 0.2); }
            if (m && m.name && baby.sex === m.sex && Math.random() < 0.55) { named++; baby.first = m.name; baby.name = `${baby.first} ${baby.sur}`; baby.namedFor = 0; try { s.remember(w.mum, `We named the baby ${baby.first}, for the stranger who ran for the midwife.`, 'life', 2, 0); if (dad) s.remember(dad, `We named our ${baby.sex === 'm' ? 'son' : 'daughter'} ${baby.first}, after the stranger who ran for the midwife the night it came.`, 'life', 2, 0); O.TownTalk && O.TownTalk.tell(w.mum.agent.x, w.mum.agent.y, `${w.mum.first} and ${dad ? dad.first : 'her man'} named their new ${baby.sex === 'm' ? 'boy' : 'girl'} ${baby.first}, after the stranger who ran for the midwife.`, `They say there's a baby in town named for the stranger.`); s.log && s.log(`${w.mum.first}'s baby is named ${baby.first}, after you.`, 'life'); } catch (e) { /* */ } O.UI && O.UI.say && O.UI.say(`Word reaches you: ${w.mum.first}'s baby has come safe, a ${baby.sex === 'm' ? 'boy' : 'girl'}, and they've named ${baby.sex === 'm' ? 'him' : 'her'} ${baby.first}. After you.`, 'good'); }
            else { try { s.remember(w.mum, `The stranger ran for the midwife when ${baby.first} was coming.`, 'kindness', 1.2); } catch (e) { /* */ } O.UI && O.UI.say && O.UI.say(`Word reaches you: ${w.mum.first}'s baby has come safe, a ${baby.sex === 'm' ? 'boy' : 'girl'} called ${baby.first}.`, 'good'); } } } }
      if (E) { E.t += dt; const { dad, mw } = E; if (E.s !== s || E.t > 180 || dad.alive === false || mw.alive === false) { end(); return; }
        if (E.stage === 'cry') { dad.agent.forceAnim = Math.floor(E.t * 2) % 2 ? 'point' : 'shocked';
          if (E.t > 9 && !E.you) { E.stage = 'dadrun'; dad.agent.frozen = false; dad.agent.forceAnim = null; if (near(dad.agent.x, dad.agent.y, 320)) say(dad, pick(['I\'ll go myself!', `Hold on, love! I'm getting ${mw.first}!`]), 2); const go = () => { const p = where(s, mw); if (!p) { end(); return; } O.Errands.send(s, dad, [Math.floor(p.x / T), Math.floor(p.y / T)], { anim: 'open', secs: 0.8, face: 0, sprint: true, giveUp: game.t + 60, after: (ok) => { if (!E || E.dad !== dad) return; if (!ok) { end(); return; } const p2 = where(s, mw); if (p2 && Math.hypot(p2.x - dad.agent.x, p2.y - dad.agent.y) > 40) { go(); return; } fetched(s, 'dad'); dad.agent.frozen = false; O.Errands.send(s, dad, [E.home.doorX + 1, E.home.doorY + 1], { anim: 'idle', secs: 0.5, face: 0, sprint: true, giveUp: game.t + 60 }); } }); }; go(); }
          return; }
        if (E.stage === 'in') { E.inT += dt; if (E.inT > 40) end(); return; }
        return; } });
    (O.moreCandidates = O.moreCandidates || []).push(() => { const P = game.player; if (!E || game.scene || P.locked || E.s !== cur()) return null; const s = cur();
      if (E.stage === 'cry' && !E.you) { const a = E.dad.agent; if (Math.hypot(a.x - P.x, a.y - P.y) > 60) return null;
        return { type: 'custom', d: 1, x: a.x, y: a.y - 30, label: `Run for ${E.mw.first}, the midwife`, act: () => { E.you = true; E.stage = 'you'; const dad = E.dad, p = where(s, E.mw);
          say(dad, p && p.h ? `Go! Go! ${E.mw.first}'s at ${p.h.name || 'the house by the ' + (p.h.type || 'lane')}, I'll see to the water!` : `Go! ${E.mw.first} was out and about, find her! I'll see to the water!`, 3);
          O.UI && O.UI.say && O.UI.say(`Find ${E.mw.first} the midwife and tell her. (She's marked.)`, 'info'); setTimeout(() => { if (E && E.dad === dad) { dad.agent.forceAnim = null; dad.agent.frozen = false; O.Errands.send(s, dad, [E.home.doorX, E.home.doorY + 1], { anim: 'open', secs: 0.5, face: 0, giveUp: game.t + 20, after: () => { if (E && E.dad === dad) { dad.agent.inside = E.mum.home; dad.agent.hidden = true; rel_(dad); } } }); } }, 1800); } }; }
      if (E.stage === 'you' && !E.fetched) { const p = where(s, E.mw); if (!p || Math.hypot(p.x - P.x, p.y - P.y) > 40) return null;
        return { type: 'custom', d: 1, x: p.x, y: p.y - 30, label: p.h ? `Hammer on the door for ${E.mw.first}: the baby's coming` : `Tell ${E.mw.first} the baby's coming`, act: () => { P.anim = p.h ? 'open' : 'point'; setTimeout(() => { P.anim = 'idle'; }, 700); if (p.h) O.sfx && O.sfx('door', 0.4); fetched(s, 'you'); try { s.remember(E.dad, 'The stranger ran for the midwife when our baby was coming.', 'kindness', 1.2); } catch (e) { /* */ } if (PS.rep) PS.rep.civilian = Math.min(1, (PS.rep.civilian || 0) + 0.02); } }; }
      return null; });
    // where she is, while you're running
    game.hooks.drawTop.push((ctx, cam, inScene) => { if (!E || inScene || E.stage !== 'you' || E.fetched) return; const p = where(cur(), E.mw); if (!p) return; const x = Math.round(p.x - cam.x), y = Math.round(p.y - cam.y) - 40 + Math.round(Math.sin(performance.now() / 200) * 2);
      ctx.fillStyle = '#f2e3b0'; ctx.fillRect(x - 1, y - 6, 3, 6); ctx.fillRect(x - 3, y - 1, 7, 1); ctx.fillRect(x - 2, y, 5, 1); ctx.fillRect(x - 1, y + 1, 3, 1); });
    (O.extraLines = O.extraLines || []).push((s, q) => !E ? '' : q === E.dad ? `Your wife ${E.mum.first} is in labour at home and you are frantic; the midwife ${E.mw.first} must be fetched.` : q === E.mw && E.fetched ? `You have been called to ${E.mum.first}'s lying-in and are hurrying there.` : (E.women || []).includes(q) ? `${E.mum.first} is in labour next door and you have come with water and linen.` : '');
    // a labour beginning at home
    // (wrapped late, and again if anything later replaces it: the rites wrap birth too)
    const SP = O.Sim.prototype; let mine = null;
    const hook = () => { if (SP.birth === mine) return; const _birth = SP.birth; mine = SP.birth = function (mum, hh) { const had = !!mum.labour; const r = _birth.apply(this, arguments); try { if (!had && mum.labour && mum.midwife && !E && this === cur()) start(this, mum); } catch (e) { console.error(e); } return r; }; };
    hook(); game.hooks.update.push(hook);
    O.MidwifeRun = { get run() { return E; }, get runs() { return runs; }, get byYou() { return byYou; }, get byDad() { return byDad; }, get named() { return named; }, get born() { return born; }, watch, start: (mum) => start(cur(), mum) };
  }
  O.MidwifeRunSetup = { setup };
})();
