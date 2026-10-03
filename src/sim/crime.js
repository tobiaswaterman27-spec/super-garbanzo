// Crime, first layer: thefts and trespass leave witnesses and memories. Witnesses remember what they
// saw imperfectly (clothing, hair, build), and reputation changes per group, not globally.
// Guards, investigations and trials build on these records in a later phase.
'use strict';
(function () {
  const PS = O.PlayerState;
  function describePlayer(game, accuracy) {
    const a = game.player.a, o = a.outfit, P = O.Pal;
    const nameOf = (m) => { const hex = P.mats[m]?.hex; const e = Object.entries(P.cloth).find(([, h]) => h === hex); return e ? e[0].replace(/([A-Z])/g, ' $1').toLowerCase() : 'dark'; };
    const bits = [];
    if (o.hat === 'hood') bits.push(`a ${nameOf(o.hatMat)} hood`);
    if (o.cloak && accuracy > 0.3) bits.push(`a ${nameOf(o.cloak)} cloak`);
    if (accuracy > 0.5 && o.hat !== 'hood') bits.push(`${Object.entries(P.hair).find(([, h]) => h === P.mats[a.hair]?.hex)?.[0]?.replace(/([A-Z])/g, ' $1').toLowerCase() || 'dark'} hair`);
    if (accuracy > 0.7) bits.push(a.height > 0.4 ? 'tall' : a.height < -0.4 ? 'short' : 'middling height');
    return bits.length ? bits.join(', ') : 'a stranger, hard to say';
  }

  function witnessesIndoors(game, sim, b, floor) {
    const sc = game.scene;
    return sim.people.filter((q) => q.agent.inside === b.id && q.activity?.act !== 'sleep' && (!sc || sc.actors.has(q.id)))
      .concat(sim.people.filter((q) => q.agent.inside === b.id && q.activity?.act === 'sleep' && sim.rng.chance(0.15)));
  }

  function theft(game, sim, ev) {
    const ws = witnessesIndoors(game, sim, ev.building, ev.floor);
    const crime = { id: (sim.crimes = sim.crimes || []).length + 1, kind: 'theft', day: sim.day, minute: Math.floor(sim.minute), place: ev.building.name, what: ev.what, owner: ev.owner, witnesses: [], discovered: false, perpetrator: 'player' };
    sim.crimes.push(crime);
    PS.crimes.push(crime.id);
    PS.rep.criminal = Math.min(1, PS.rep.criminal + 0.03);
    if (!ws.length) { O.Panels.toast(`You pocket ${ev.what}. Nobody saw.`); return crime; }
    for (const w of ws) {
      const acc = O.clamp(0.4 + (w.traits.includes('curious') ? 0.25 : 0) + (w.traits.includes('suspicious') ? 0.15 : 0) - (w.age > 70 ? 0.2 : 0) + sim.rng.float(-0.2, 0.2), 0.1, 1);
      const desc = describePlayer(game, acc);
      crime.witnesses.push({ id: w.id, desc, accuracy: acc });
      sim.remember(w, `Saw a thief take ${ev.what} at ${ev.building.name}: ${desc}.`, 'crime', 1.5, 0);
      sim.relate(w, { id: 0 }, -0.6);
      w.agent.talking = 40;
    }
    crime.discovered = true;
    PS.rep.local = Math.max(-1, PS.rep.local - 0.15 * ws.length);
    PS.rep.civilian = Math.max(-1, PS.rep.civilian - 0.1);
    if (ev.building.type !== 'house') PS.rep.merchant = Math.max(-1, PS.rep.merchant - 0.15);
    sim.log(`Theft at ${ev.building.name}: ${ev.what} taken. Witnesses describe ${crime.witnesses[0].desc}.`, 'crime');
    const shout = ws[0];
    O.Panels.toast(`${shout.first} saw you! “Thief! Stop, thief!”`, 'bad');
    return crime;
  }

  function onEnter(game, sim, b) {
    if (b.type !== 'house' && b.type !== 'farmhouse') return;
    const inside = sim.people.filter((q) => q.agent.inside === b.id && q.activity?.act !== 'sleep' && q.age >= 13);
    if (!inside.length) return;
    const q = inside[0];
    const r = q.rel.get(0) || { affinity: 0, familiar: 0 };
    if (r.affinity > 0.4) { O.Panels.toast(`${q.first}: “Come in, come in.”`); return; }
    sim.relate(q, { id: 0 }, -0.08);
    sim.remember(q, 'A stranger walked into our house uninvited.', 'player', 0.8, 0);
    O.Panels.toast(`${q.first}: “${q.traits.includes('hostile') || q.traits.includes('suspicious') ? 'Get out of my house!' : 'Can I help you? This is a private house.'}”`, 'bad');
  }

  O.Crime = { theft, onEnter, describePlayer };
})();
