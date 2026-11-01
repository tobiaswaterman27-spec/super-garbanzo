// Sickness you can see and catch. The sick cough and sneeze in the street, mop their brows, clutch their
// bellies, and pass it on to those they stand close to; you can catch it from them, and give yours to
// those you talk to. Each sickness has its remedy: feverfew and willow bark for a fever, a mustard
// poultice for a chill, barley water for the flux, sold by the apothecary, the physician and the
// herbalist; the right one works fast, the wrong one barely at all. When you lie badly ill, someone who
// cares for you comes to nurse you, and you can nurse the sick yourself, at some risk.
'use strict';
(function () {
  const T = 16;
  function setup(game) {
    const PS = O.PlayerState, cur = () => O.SimRef.cur, say = (t, k) => O.UI.say(t, k), G = O.Data.GOODS, SP = O.Sim.prototype;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    const sp = (q, t, secs = 2) => O.Speech && O.Speech.say(q, t, secs);
    G.feverfew = G.feverfew || { name: 'Feverfew and willow bark', base: 4, unit: 'twist', slots: 1, drink: 0.02 };
    G.poultice = G.poultice || { name: 'Mustard poultice', base: 3, unit: 'poultice', slots: 1, drink: 0.01 };
    G.barleywater = G.barleywater || { name: 'Barley water', base: 2, unit: 'flask', slots: 1, drink: 0.1 };
    // the apothecary and the physician make and sell them
    for (const t of ['apothecary', 'doctor']) { const B = O.Data.BUSINESS[t]; if (!B) continue; for (const [g, inp] of [['feverfew', { herbs: 0.1 }], ['poultice', { herbs: 0.05 }], ['barleywater', { barley: 0.1 }]]) if (!B.sells.includes(g)) { B.sells.push(g); B.recipes.push({ out: { [g]: 0.15 }, inp }); B.targets = B.targets || {}; B.targets[g] = 4; } }
    const REMEDY = { chill: 'poultice', cold: 'poultice', fever: 'feverfew', pestilence: 'feverfew', flux: 'barleywater' };
    const PLAYER_KIND = { cold: 'chill', fever: 'fever', flux: 'flux', pestilence: 'fever' };
    const contagious = (q) => q.health && q.health.illness && ['cold', 'fever', 'flux', 'pestilence'].includes(q.health.illness.kind);
    const seen = (q, r) => { const P = game.player; return !q.agent.hidden && q.agent.inside == null && Math.hypot(q.agent.x - P.x, q.agent.y - P.y) < r; };
    const infect = (s, q, kind) => { if (q.health.illness || (q.health.immune || 0) > s.day || q.alive === false) return false; q.health.illness = { kind, sev: 0.12, since: s.day, treated: false }; q.health.state = 'hurt'; return true; };
    const playerCatch = (kind, from) => { if (PS.ill) return; const k = PLAYER_KIND[kind] || 'chill'; PS.ill = { kind: k, sev: k === 'fever' ? 0.45 : 0.3, day: cur().day }; say(`${from ? from.first + ' coughed right on you. ' : ''}You've caught ${k === 'chill' ? 'a chill' : k === 'fever' ? 'a fever' : 'the flux'}.`, 'bad'); };

    // the sick in the street: coughs, sneezes, and catching it
    let ct = 0;
    game.hooks.update.push((dt) => {
      ct -= dt; if (ct > 0 || game.scene) return; ct = 3; const s = cur(); if (!s) return; const now = performance.now(), P = game.player;
      for (const q of s.people) {
        if (!contagious(q) || !seen(q, 300) || (q.agent.gest && q.agent.gest.until > now) || Math.random() > 0.3) continue;
        const k = q.health.illness.kind;
        if (k === 'flux') { O.gesture(q, 'hurt', 1.4); if (Math.random() < 0.3) sp(q, pick(['Oh, my belly...', 'Not again...'])); }
        else if (k === 'fever' || k === 'pestilence') { O.gesture(q, Math.random() < 0.5 ? 'cough' : 'wipe', 1.6); if (Math.random() < 0.3) sp(q, pick(['*cough* *cough*', 'I\'m burning up.', '*hack*'])); }
        else { O.gesture(q, 'cough', 1.2); sp(q, pick(['*cough*', 'Achoo!', '*sniff*', 'Ah... ACHOO!'])); }
        // close by, it passes on
        for (const z of s.people) if (z !== q && z.age >= 2 && !z.agent.hidden && z.agent.inside == null && Math.hypot(z.agent.x - q.agent.x, z.agent.y - q.agent.y) < 26 && Math.random() < 0.04) if (infect(s, z, k)) s.remember(z, `Caught ${k === 'cold' ? 'a cold' : 'it'} off ${q.first} in the street.`, 'health', 0.6, q.id);
        if (Math.hypot(q.agent.x - P.x, q.agent.y - P.y) < 32 && Math.random() < 0.05) playerCatch(k, q);
      }
    });
    // yours, passed on to those you talk to
    const _talk = O.npcUI && O.npcUI.openTalk;
    if (_talk) O.npcUI.openTalk = function (q) { const r = _talk.apply(this, arguments); try { const s = cur(); if (PS.ill && q && q.health && Math.random() < 0.12) { const kind = PS.ill.kind === 'chill' ? 'cold' : PS.ill.kind; if (infect(s, q, kind)) s.remember(q, 'I think I caught something off the stranger.', 'health', 0.8, 0); } } catch (e) { console.error(e); } return r; };

    // the right remedy
    const _consume = O.consume;
    O.consume = (k) => {
      _consume(k); if (!['feverfew', 'poultice', 'barleywater'].includes(k)) return;
      setTimeout(() => { if (!PS.ill) return say('You take it, though you\'re not ill.'); const right = REMEDY[PS.ill.kind] === k; PS.ill.sev -= right ? 0.5 : 0.08; if (PS.ill.sev <= 0) { PS.ill = null; say('The remedy does its work. You feel well again.'); } else say(right ? 'The right thing for it. You feel it easing.' : 'It does little for what ails you.'); }, 1500);
    };
    (O.extraLines = O.extraLines || []).push((s, q) => /apothecary|physician|herbalist|doctor|barber|midwife|nurse|monk|nun/.test(q.job?.role || '') ? 'You know remedies: feverfew and willow bark for a fever, a mustard poultice for a chill or cough, barley water for the flux. You may sell the right one (sell {"item":"feverfew|poultice|barleywater"}).' : '');
    (O.extraLines = O.extraLines || []).push((s, q) => contagious(q) ? `You are ill with ${({ cold: 'a heavy cold', fever: 'a fever', flux: 'the flux', pestilence: 'the pestilence' })[q.health.illness.kind]}; you cough, feel wretched, and say so.` : '');
    (O.extraLines = O.extraLines || []).push((s, q) => PS.ill ? `The player looks unwell: ${PS.ill.kind === 'chill' ? 'sniffling and coughing' : PS.ill.kind === 'fever' ? 'flushed and sweating with fever' : 'pale and doubled over'}. You notice, and may keep your distance or show concern.` : '');

    // nursed when you're badly ill
    let nursedDay = -1, nurse = null;
    game.hooks.update.push(() => {
      const s = cur(); if (!s || !PS.ill || PS.ill.sev < 0.55 || nursedDay === s.day) return;
      if (!nurse) {
        const fond = s.people.filter((q) => q.age >= 14 && q.alive !== false && !q.agent.hidden && !contagious(q) && (((q.rel.get(0) || {}).affinity || 0) > 0.35 || (PS.partner && PS.partner.id === q.id)) && Math.hypot(q.agent.x - game.player.x, q.agent.y - game.player.y) < 600);
        nurse = fond.sort((a, b) => ((b.rel.get(0) || {}).affinity || 0) - ((a.rel.get(0) || {}).affinity || 0))[0] || null;
        if (nurse) { O.NpcActs.apply(s, nurse, { do: 'follow' }, false); say(`${nurse.first} has heard you're ill and is coming.`); }
        else { nursedDay = s.day; return; }
      }
      const P = game.player, pos = game.scene ? game.scene.personPos(nurse) : [nurse.agent.x, nurse.agent.y];
      if (pos && Math.hypot(pos[0] - P.x, pos[1] - P.y) < 50) {
        nursedDay = s.day; O.gesture(nurse, 'serve', 2.4); PS.ill.sev = Math.max(0.05, PS.ill.sev - 0.25); PS.hunger = Math.min(100, PS.hunger + 25);
        O.NpcActs.unfollow && O.NpcActs.unfollow(nurse);
        if (O.npcUI && !O.npcUI.talking()) O.npcUI.startFrom(nurse, pick(['You look dreadful. Lie still: I\'ve brought broth.', 'There now. Drink this and sleep.', 'I couldn\'t leave you like this. Here, eat something.']));
        s.relate(nurse, { id: 0 }, 0.05); nurse = null;
      }
    });
    // you nurse the sick
    const nurseCand = () => {
      const s = cur(), P = game.player; if (!s || P.locked) return null; let q = null;
      if (game.scene) { for (const a of game.scene.actors.values()) if (a.person && contagious(a.person) && Math.hypot(a.x - P.x, a.y - P.y) < 34 && a.person._nursed !== s.day) { q = a.person; break; } }
      else q = s.people.find((z) => contagious(z) && seen(z, 30) && z._nursed !== s.day);
      if (!q) return null; const pos = game.scene ? game.scene.personPos(q) : [q.agent.x, q.agent.y];
      return { type: 'custom', d: 4, x: pos[0], y: pos[1] - 44, label: `Nurse ${q.first}`, act: () => {
        P.anim = 'serve'; P.ft = 0; P.locked = true;
        setTimeout(() => { P.locked = false; P.anim = 'idle'; q._nursed = s.day; q.health.illness.sev = Math.max(0, q.health.illness.sev - 0.2); s.relate(q, { id: 0 }, 0.1); s.remember(q, 'The stranger sat with me in my sickness and nursed me.', 'health', 1.4, 0); PS.rep.civilian = Math.min(1, PS.rep.civilian + 0.01); if (Math.random() < 0.15) playerCatch(q.health.illness.kind); say(`You sit with ${q.first}, cool their brow and get some broth into them.`); }, 3500);
      } };
    };
    (O.moreCandidates = O.moreCandidates || []).push(nurseCand); (O.sceneMore = O.sceneMore || []).push(nurseCand);
  }
  O.SicknessSetup = { setup };
})();
