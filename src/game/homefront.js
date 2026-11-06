// The war, at home.
// - When war threatens, the levy drills in the square of a morning: men with staves in a line, the
//   sergeant shouting the time.
// - In war, soldiers are billeted on the town: they walk the streets in the crown's colours, drink in
//   the tavern of an evening, and now and then start trouble.
// - Refugees come up the road from the burned places and camp at the edge of town, hungry; give them
//   food and they remember it.
// - A quartermaster sets up in the square and buys bread, ale, arrows and blades for the army at war
//   prices: tell him what you've got.
// - Families with a man at the war worry aloud; everyone talks of how it goes.
// - With peace the soldiers march away and the refugees go home, or stay.
'use strict';
(function () {
  const T = 16;
  function setup(game) {
    const PS = O.PlayerState, cur = () => O.SimRef.cur, say = (t, k) => O.UI.say(t, k || 'note'), G = O.Data.GOODS;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    const W = () => { const k = O.SimRef.home && O.SimRef.home.kingdom; return k && k.war; };
    const phase = () => (W() && W().phase) || 'peace';
    const near = (q, r) => q && q.agent && !q.agent.hidden && Math.hypot(q.agent.x - game.player.x, q.agent.y - game.player.y) < r;
    function visitor(s, o) {
      const D = O.Data, Ch = O.Char, r = O.RNG(O.hash('hf', s.day, o.role, Math.random() * 1e6 | 0)), sex = o.sex || (r.chance(o.role === 'soldier' || o.role === 'quartermaster' ? 0.95 : 0.5) ? 'm' : 'f');
      const q = s.newPerson({ sex, age: o.age || r.int(18, 45), first: r.pick(D.NAMES[sex]), sur: r.pick(['Fletcher', 'of Highmere', 'Marsh', 'Wright', 'Coombe', 'Ash', 'Thorne']), household: 0, home: null, genes: Ch.randomGenes(r, 'south'), wealth: o.role === 'refugee' ? 0.05 : 0.4, visitor: true });
      q.name = `${q.first} ${q.sur}`; q.job = { biz: null, role: o.role }; q.wake = 6; q.bed = 23;
      q.app = Ch.makeAppearance(O.hash('hf', q.id), { sex, age: q.age, genes: q.genes, role: o.role === 'soldier' ? 'guard' : o.role === 'refugee' ? 'beggar' : 'merchant', wealth: o.role === 'refugee' ? 0.05 : 0.5 });
      if (o.role === 'soldier' && q.app.outfit) { q.app.outfit.item = r.pick(['spear', 'sword', null]); O.Char.invalidate(q.app); }
      const [x, y] = o.at; q.agent = { x: x * T + 8, y: y * T + 12, dir: 0, anim: 'idle', ft: 0, a: q.app, hidden: false, inside: null, path: null, goal: null, person: q };
      q.homefront = o.role; return q;
    }
    const edge = (s) => { const w = s.world; return [Math.min(w.W - 3, w.ox + w.townW + 2), w.oy + Math.floor(w.townH / 2)]; };
    const sq = (s) => { const z = s.world.zones && s.world.zones.square; return z ? [Math.floor((z[0] + z[2]) / 2), Math.floor((z[1] + z[3]) / 2)] : edge(s); };

    // ---------------------------------------------------------------- each day: who comes, who goes
    const SP = O.Sim.prototype, _nd = SP.newDay;
    SP.newDay = function () {
      const r = _nd.apply(this, arguments);
      try {
        if (this !== O.SimRef.home && this !== O.SimRef.cur) return r;
        const ph = phase(), hf = this.people.filter((q) => q.homefront && q.alive !== false);
        const soldiers = hf.filter((q) => q.homefront === 'soldier'), refugees = hf.filter((q) => q.homefront === 'refugee'), qm = hf.find((q) => q.homefront === 'quartermaster');
        if (ph === 'war') {
          for (let k = soldiers.length; k < 4; k++) visitor(this, { role: 'soldier', at: edge(this) });
          if (!qm) { visitor(this, { role: 'quartermaster', at: sq(this), age: 46 }); this.log('A quartermaster of the King\'s host has set up in the square, buying for the army.', 'war'); }
          if (refugees.length < 8 && Math.random() < 0.45) { const n = 1 + Math.floor(Math.random() * 3); for (let k = 0; k < n; k++) visitor(this, { role: 'refugee', at: edge(this), age: 5 + Math.floor(Math.random() * 60) }); this.log(`Refugees have come up the road from the burned villages: ${n} more camp at the edge of ${this.world.name}.`, 'war'); }
        } else {
          // peace: the soldiers march off, the quartermaster packs up, most refugees go home
          for (const q of hf) { if (q.homefront === 'refugee' && ph !== 'truce' && Math.random() < 0.3 && !q._settled) { if (Math.random() < 0.15 && q.age >= 18) { q._settled = true; q.visitor = false; this.log(`${q.name}, who fled the war, means to stay in ${this.world.name}.`, 'social'); continue; } } if (q.homefront !== 'refugee' || (ph === 'peace' && Math.random() < 0.4)) { q.task = { act: 'leave', outdoor: true, zone: 'east', emigrating: true }; q.homefront = 'leaving'; } }
          if (soldiers.length) this.log(`The billeted soldiers have marched out of ${this.world.name}.`, 'war');
        }
        // refugees go hungry unless someone feeds them
        for (const q of refugees) { q.needs.hunger = Math.max(0, q.needs.hunger - 25); }
      } catch (e) { console.error(e); }
      return r;
    };
    // what they do with the day
    const _plan = SP.plan;
    SP.plan = function (p) {
      const h = this.minute / 60, ph = phase();
      try {
        if (p.homefront === 'soldier') { if (h >= 19 && h < 23 && this.tavernId != null) return { act: 'eat-out', b: this.tavernId }; if (h >= 23 || h < 6) return { act: 'stroll', outdoor: true, zone: 'edge:hf' }; return { act: 'stroll', outdoor: true, zone: (p.id + Math.floor(h / 2)) % 2 ? 'square' : 'edge:hf' }; }
        if (p.homefront === 'refugee') return { act: h >= 9 && h < 17 && p.age >= 10 ? 'beg' : 'rest', outdoor: true, zone: h >= 9 && h < 17 && p.id % 2 ? 'square' : 'edge:hf' };
        if (p.homefront === 'quartermaster') return { act: 'work', outdoor: true, zone: 'square' };
        // the levy drills of a morning while war threatens or is on
        if ((ph === 'tension' || ph === 'war') && h >= 7 && h < 8.5 && p.sex === 'm' && p.age >= 18 && p.age <= 40 && !p.visitor && !O.upright(this, p) && p.id % 3 === 0 && !p.job?.onShift) return { act: 'drill', outdoor: true, zone: 'square' };
      } catch (e) { /* */ }
      return _plan.apply(this, arguments);
    };
    const _zone = SP.zoneTile;
    SP.zoneTile = function (p, zone) { if (zone === 'edge:hf') { const [x, y] = edge(this); return [x + (p.id % 4) - 1, y + (Math.floor(p.id / 4) % 4) - 1]; } return _zone.call(this, p, zone); };
    // the drill and the begging, as you'd see them
    const _anim = O.Sim.prototype.idleAnim;
    if (_anim) O.Sim.prototype.idleAnim = function (p) { if (p.activity?.act === 'drill') return Math.floor(performance.now() / 700 + p.id) % 3 ? 'attack' : 'idle'; if (p.activity?.act === 'beg') return 'beg'; return _anim.apply(this, arguments); };
    let st = 5;
    game.hooks.update.push((dt) => {
      st -= dt; if (st > 0) return; st = 6 + Math.random() * 5;
      const s = cur(); if (!s || game.scene) return; const ph = phase(), h = s.minute / 60;
      const drillers = s.people.filter((q) => q.activity?.act === 'drill' && near(q, 260));
      if (drillers.length >= 2) { const g = s.people.find((q) => /sergeant|guard captain/.test(q.job?.role || '') && near(q, 400)) || drillers[0]; O.Speech && O.Speech.say(g, pick(['One! Two! Thrust! Again!', 'Shoulders square! Staves up!', 'You call that a line? Again!', 'Hold! Hold! Now, forward!']), 2.5); }
      const sol = s.people.filter((q) => q.homefront === 'soldier' && near(q, 200));
      if (sol.length && Math.random() < 0.5) { const q = pick(sol); O.Speech && O.Speech.say(q, pick(h >= 19 ? ['More ale, girl!', "We march for the King, and he can't pay us.", 'I saw the Varn ships burn at Ravenscar.', "Who'll stand a soldier a drink?"] : ["What are you looking at, peasant?", 'Our captain says we hold here till spring.', 'Mind the King\'s men.', 'They feed us worse than the horses.']), 2.8); }
      const ref = s.people.filter((q) => q.homefront === 'refugee' && near(q, 140));
      if (ref.length && Math.random() < 0.5) { const q = pick(ref); O.Speech && O.Speech.say(q, pick(['A crust, for the children?', 'They burned everything. Everything.', 'God bless you, if you have anything.', 'Is there work here? Any work?']), 3); }
      void ph;
      // a soldier's trouble: a scuffle with a local in the tavern hours
      if (sol.length && h >= 20 && Math.random() < 0.05) { const a = pick(sol), b = s.people.find((q) => !q.visitor && q.age >= 18 && q.sex === 'm' && near(q, 200)); if (b && O.Speech) { O.Speech.say(a, 'You looking at me?', 2); setTimeout(() => O.Speech.say(b, "Get out of our town, soldier.", 2.5), 1500); s.relate(b, a, -0.3); } }
    });
    // feeding a refugee: give them food in talk, or say you'll feed them
    (O.extraLines = O.extraLines || []).push((s, q) => {
      const ph = phase(), w = W();
      if (q.homefront === 'soldier') return `You are a soldier of the King's host, billeted on ${s.world.name} in the war with ${w && w.enemy}. You are rough, bored, owed pay, and like your drink.`;
      if (q.homefront === 'refugee') return `You fled the war: your village was burned by ${w && w.enemy}. You have nothing, you are hungry (hunger ${Math.round(q.needs.hunger)}), and you camp at the edge of town. You would be grateful beyond words for food or work.`;
      if (q.homefront === 'quartermaster') return `You are the King's quartermaster, buying for the army: bread at ₳5, ale ₳4, arrows ₳2 each, a sword ₳45, a spear ₳20. The player can sell you these in words ("I'll sell you 3 bread").`;
      if (ph === 'peace' && !(w && w.wars)) return '';
      const fam = (s.household(q)?.members || []).map((id) => s.byId.get(id)).filter((z) => z && z.away && /war|levy|host|soldier/.test(String(z.awayFor || z.away || '')));
      return `${ph === 'war' ? `There is war with ${w.enemy}: soldiers are billeted in town, refugees camp at the edge, prices are up, and everyone talks of the latest battle.` : ph === 'tension' ? `There is talk of war with ${w.enemy}; the levy drills in the square of a morning.` : `The war with ${w && w.enemy} is over, or paused; people talk of who came home and who did not.`}${fam.length ? ` ${fam.map((z) => z.first).join(' and ')} of your house went with the levy, and you worry for them every day.` : ''}`;
    });
    // selling to the quartermaster, in words
    const PRICE = { bread: 5, ale: 4, arrows: 2, sword: 45, spear: 20, dagger: 14, axe: 18, meal: 4, cheese: 5, salt: 6, firewood: 2 };
    const _say = O.AIChat && O.AIChat.say;
    if (_say) O.AIChat.say = function (q, text, render, opt) {
      if (q && q.homefront === 'quartermaster' && typeof text === 'string' && /\b(sell|have|got)\b/i.test(text) && O.AI && O.AI.ready) {
        const g = Object.keys(PRICE).find((k) => new RegExp('\\b' + k.replace(/s$/, '') + 's?\\b', 'i').test(text) && PS.items.includes(k));
        if (g) { const n = Math.min(PS.items.filter((k) => k === g).length, +((text.match(/\d+/) || [99])[0])); let done = 0; for (let i = 0; i < n; i++) if (PS.remove(g)) done++; const pay = done * PRICE[g]; PS.money += pay; O.NpcActs && O.NpcActs.fly && O.NpcActs.fly(q, 'player', 'coin'); const line = `${done} ${G[g].name.toLowerCase()} for the King's host. ₳${pay}, and God save the King.`; (q._conv = q._conv || []).push({ who: 'p', t: text }, { who: 'q', t: line }); render(line); return Promise.resolve(); }
      }
      if (q && q.homefront === 'refugee' && typeof text === 'string' && /\b(eat|food|bread|take this|here)\b/i.test(text) && O.AI && O.AI.ready) {
        const g = ['bread', 'meal', 'cheese', 'stew', 'pie', 'fish'].find((k) => PS.items.includes(k));
        if (g) { PS.remove(g); q.needs.hunger = Math.min(100, q.needs.hunger + 40); cur().relate(q, { id: 0 }, 0.4); cur().remember(q, `The stranger fed me when I had nothing.`, 'social', 3); PS.almsToPoor = (PS.almsToPoor || 0) + 2; O.NpcActs && O.NpcActs.fly && O.NpcActs.fly('player', q, g); const line = 'God keep you. God keep you. I will not forget this.'; (q._conv = q._conv || []).push({ who: 'p', t: text }, { who: 'q', t: line }); render(line); return Promise.resolve(); }
      }
      return _say.apply(this, arguments);
    };
    O.HomeFront = { phase, visitor };
  }
  O.HomeFrontSetup = { setup };
})();
