// Taking a room: only from the innkeeper, at the counter. They tell you if the beds are all taken.
'use strict';
(function () {
  function setup(game, sim, npcUI) {
    const PS = O.PlayerState;
    // the innkeeper (or whoever keeps the inn) lets a bed wherever you find them, at the counter or not
    const atCounter = (q) => O.knowsTrade && O.knowsTrade(q) && q.job && q.job.biz != null && sim.biz.get(q.job.biz)?.type === 'tavern' && (q.job.role === 'innkeeper' || sim.bossOf(sim.biz.get(q.job.biz)) === q) && q.activity?.act !== 'sleep' && q.age >= 16;
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
      if (!sim.innCapacity(bid).beds) { const other = sim.world.buildings.find((x) => x.type === 'tavern' && x.id !== bid && x.floors >= 2); return render(`"We've no rooms here, only the taproom. ${other ? `${other.name} lets beds upstairs.` : 'You could ask about a house to let.'}"`); }
      if (PS.room && PS.room.b === bid && PS.room.until >= sim.day) { return render(`"Your bed's upstairs, made up and waiting. Sleep well."`); }
      const cap = sim.innCapacity(bid).beds, taken = sim.innBedsTaken(bid);
      if (taken >= cap) { return render(`"I'm sorry, every bed's taken tonight. Try again tomorrow."`); }
      if (PS.money < 6) { return render(`"Six aurins a night, and I'll need it before you go up."`); }
      PS.money -= 6; const bz = sim.biz.get(bid); if (bz) bz.cash += 6;
      PS.room = { b: bid, until: sim.day + (sim.hour >= 12 ? 1 : 0) };
      game.player.anim = 'count'; game.player.ft = 0; setTimeout(() => { if (game.player.anim === 'count') game.player.anim = 'idle'; }, 900);
      PS.add && !PS.items.includes('key') && PS.add('key');
      void b;
      return render('"Six aurins. Thank you." (You count the coins onto the counter.) "Up the stairs, any bed with the blanket turned down. It\'s yours till morning."');
    };
  }
  O.InnUI = { setup };
})();
