// Taking a room: only from the innkeeper, at the counter. They tell you if the beds are all taken.
'use strict';
(function () {
  function setup(game, sim, npcUI) {
    const PS = O.PlayerState;
    const atCounter = (q) => q.job && q.job.role === 'innkeeper' && q.agent.inside === q.job.biz && q.activity?.act === 'work' && !q.activity.upstairs && game.scene && game.scene.b.id === q.job.biz;
    const prevExtra = npcUI.extraButtons, prevOn = npcUI.onExtra;
    npcUI.extraButtons = (q) => {
      const out = prevExtra ? prevExtra(q) : [];
      if (atCounter(q) && !sim.innCapacity(q.job.biz).beds) out.push(['room', 'A bed for the night?']);
      else if (atCounter(q)) { const has = PS.room && PS.room.b === q.job.biz && PS.room.until >= sim.day; out.push(['room', has ? 'Ask about your room' : 'A bed for the night (₳6)']); }
      return out;
    };
    npcUI.onExtra = (q, key, render) => {
      if (key !== 'room') return prevOn && prevOn(q, key, render);
      const bid = q.job.biz, b = sim.building(bid);
      if (!sim.innCapacity(bid).beds) { const other = sim.world.buildings.find((x) => x.type === 'tavern' && x.id !== bid && x.floors >= 2); O.UI.say(`${q.first}: “We've no rooms here, only the taproom. ${other ? `${other.name} lets beds upstairs.` : 'You could ask about a house to let.'}”`); return; }
      if (PS.room && PS.room.b === bid && PS.room.until >= sim.day) { O.UI.say(`${q.first}: “Your bed's upstairs, made up and waiting. Sleep well.”`); return; }
      const cap = sim.innCapacity(bid).beds, taken = sim.innBedsTaken(bid);
      if (taken >= cap) { O.UI.say(`${q.first}: “I'm sorry, every bed's taken tonight. Try again tomorrow.”`, 'bad'); return; }
      if (PS.money < 6) { O.UI.say(`${q.first}: “Six aurins a night, and I'll need it before you go up.”`, 'bad'); return; }
      PS.money -= 6; const bz = sim.biz.get(bid); if (bz) bz.cash += 6;
      PS.room = { b: bid, until: sim.day + (sim.hour >= 12 ? 1 : 0) };
      game.player.anim = 'count'; game.player.ft = 0; setTimeout(() => { if (game.player.anim === 'count') game.player.anim = 'idle'; }, 900);
      O.UI.say(`You count sixpence onto the counter. ${q.first}: “Up the stairs, any bed with the blanket turned down. It's yours till morning.”`); PS.add && !PS.items.includes('key') && PS.add('key');
      void b;
    };
  }
  O.InnUI = { setup };
})();
