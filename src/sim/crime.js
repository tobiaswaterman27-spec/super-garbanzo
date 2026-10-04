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
    // only those in the same room as you, awake, and not on their way out; a sleeper in the room may stir
    const inRoom = (q) => q.agent.inside === b.id && (!sc || (sc.actors.has(q.id) && !sc.actors.get(q.id).leaving));
    return sim.people.filter((q) => inRoom(q) && q.activity?.act !== 'sleep')
      .concat(sim.people.filter((q) => inRoom(q) && q.activity?.act === 'sleep' && sim.rng.chance(0.08)));
  }

  function theft(game, sim, ev) {
    const ws = witnessesIndoors(game, sim, ev.building, ev.floor);
    PS.rep.criminal = Math.min(1, PS.rep.criminal + 0.03);
    const placeName = ev.building.type === 'house' ? `the ${sim.households[ev.building.household - 1]?.surname || ''} house` : ev.building.name;
    if (!ws.length) {
      // unwitnessed: discovered later by the owner, who reports it without a description
      const crime = sim.recordCrime({ kind: 'theft', perp: 'player', placeName, tile: [ev.building.doorX, ev.building.doorY], seen: [], severity: ev.value > 2 ? 2 : 1 });
      PS.crimes.push(crime.id);
      const owner = sim.people.find((q) => q.home === ev.building.id && q.age >= 16) || sim.people.find((q) => q.job?.biz === ev.building.id);
      if (owner && sim.rng.chance(0.7)) { sim.remember(owner, `Things have gone missing from ${placeName}.`, 'crime', 1.2); owner.task = owner.task || { act: 'report', b: sim.guardId, crime: crime.id }; }
      O.Panels.toast(`You pocket ${ev.what}. Nobody saw.`); return crime;
    }
    const crime = sim.recordCrime({ kind: 'theft', perp: 'player', placeName, tile: [ev.building.doorX, ev.building.doorY], seen: ws, severity: ev.value > 2 ? 2 : 1 });
    PS.crimes.push(crime.id);
    for (const w of ws) { sim.relate(w, { id: 0 }, -0.3); w.agent.talking = 40; }
    PS.rep.local = Math.max(-1, PS.rep.local - 0.15 * ws.length);
    PS.rep.civilian = Math.max(-1, PS.rep.civilian - 0.1);
    if (ev.building.type !== 'house') PS.rep.merchant = Math.max(-1, PS.rep.merchant - 0.15);
    sim.log(`Theft at ${placeName}: ${ev.what} taken. Witnesses describe ${O.Justice.describe(crime.witnesses[0].desc)}.`, 'crime');
    const shout = ws[0];
    O.Panels.toast(`${shout.first}${ws.length > 1 ? ` and ${ws.length - 1} other${ws.length > 2 ? 's' : ''}` : ''} saw you! “Thief! Stop, thief!”`, 'bad');
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
