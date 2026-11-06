// Keeping the beasts. Dawn and dusk, the dairymaid or a farm hand goes out to each cow with a pail and
// stool and milks her where she stands; in the morning someone scatters grain for the hens and gathers
// the eggs; in late spring the sheep are caught and sheared one by one; in winter hay is pitched out to
// the beasts, who come to it. The animal holds still while it's tended. The milk, eggs and wool go to
// the farm. Ask the farmer to let you lend a hand and they'll put you to it for a coin or two.
'use strict';
(function () {
  const T = 16;
  function setup(game) {
    const PS = O.PlayerState, cur = () => O.SimRef.cur;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    const HANDS = /farmer|farmhand|dairymaid|shepherd|milkmaid|herd/;
    const TASK = {
      milk: { kinds: ['cow'], hours: [[5.5, 7], [17, 18.5]], anim: 'crouch', secs: 7, good: 'milk', qty: 2, carry: 'bucket', line: ['Steady, girl.', 'There now. Good girl.', 'Full pail this morning.'] },
      eggs: { kinds: ['chicken', 'hen'], hours: [[6, 8]], anim: 'pickup', secs: 4, good: 'eggs', qty: 3, line: ['Chook chook chook!', 'Six this morning.', 'Get off, you broody thing.'] },
      shear: { kinds: ['sheep'], hours: [[8, 16]], seasons: ['spring'], anim: 'shear', secs: 9, good: 'wool', qty: 2, line: ['Hold her! Hold her still.', 'There\'s a good fleece.', 'Mind her legs.'] },
      fodder: { kinds: ['cow', 'sheep', 'horse', 'pig', 'goat'], hours: [[7, 9], [15, 16]], seasons: ['winter'], anim: 'pitch', secs: 5, line: ['Come on, then. Come on.', 'Hay\'s short this year.'] },
    };
    const nearBeasts = (s, kinds) => (O.fauna || []).filter((f) => f.world === s.world.placeId && kinds.includes(f.kind) && !f.dead && f.owner !== 'player' && !f.wild);
    const farmFor = (s, f) => [...s.biz.values()].filter((z) => z.type === 'farmhouse' && z.b).sort((a, b) => Math.hypot(a.b.doorX * T - f.x, a.b.doorY * T - f.y) - Math.hypot(b.b.doorX * T - f.x, b.b.doorY * T - f.y))[0];
    let next = 6; const doneToday = new Map();
    game.hooks.update.push((dt) => {
      next -= dt; if (next > 0) return; next = 8 + Math.random() * 6;
      const s = cur(); if (!s || !O.Errands) return; const h = s.minute / 60, key = s.day;
      for (const [name, t] of Object.entries(TASK)) {
        if (t.seasons && !t.seasons.includes(s.season)) continue;
        if (!t.hours.some(([a, b]) => h >= a && h < b)) continue;
        const done = doneToday.get(name + key) || new Set(); doneToday.set(name + key, done);
        const beast = nearBeasts(s, t.kinds).find((f) => !done.has(f.seed + ':' + Math.floor(h / 6)) && !f._tended);
        if (!beast) continue;
        const farm = farmFor(s, beast); if (!farm) continue;
        const hand = farm.workers.map((id) => s.byId.get(id)).find((q) => q && HANDS.test(q.job?.role || '') && !q.errand && q.agent && !q.agent.hidden && q.alive !== false && q.age >= 9 && !q._scene) || s.people.find((q) => q.household === farm.b.household && q.age >= 9 && q.age < 16 && !q.errand && q.agent && !q.agent.hidden);
        if (!hand) continue;
        done.add(beast.seed + ':' + Math.floor(h / 6)); beast._tended = true;
        const tile = [Math.floor(beast.x / T) + (name === 'eggs' ? 0 : 1), Math.floor(beast.y / T)];
        O.Errands.send(s, hand, tile, { anim: t.anim, secs: t.secs, face: 1, giveUp: 60, carry: t.carry ? { good: t.carry, qty: 1 } : null,
          at: () => { beast.wait = t.secs + 2; beast.tx = null; beast.dir = 2; beast._held = game.t + t.secs; if (Math.random() < 0.5 && O.Speech && Math.hypot(hand.agent.x - game.player.x, hand.agent.y - game.player.y) < 260) O.Speech.say(hand, pick(t.line), 2.2); if (O.animalCall && Math.random() < 0.4 && Math.hypot(beast.x - game.player.x, beast.y - game.player.y) < 260) O.animalCall(beast.kind === 'hen' ? 'chicken' : beast.kind, 0.5); },
          after: () => { beast._tended = false; if (t.good && O.Data.GOODS[t.good]) farm.stock[t.good] = (farm.stock[t.good] || 0) + t.qty; if (hand.skills) hand.skills[hand.job?.role || 'farmhand'] = Math.min(1, (hand.skills[hand.job?.role || 'farmhand'] || 0.3) + 0.002); } });
        break;
      }
    });
    // the beast stands still while it's being seen to
    game.hooks.update.push(() => { for (const f of O.fauna || []) if (f._held && game.t < f._held) { f.tx = null; f.moving = false; } });
    // lending a hand, by asking
    const _say = O.AIChat && O.AIChat.say;
    if (_say) O.AIChat.say = function (q, text, render, opt) {
      if (q && typeof text === 'string' && /farmer|farmhand|dairymaid|shepherd/.test(q.job?.role || '') && /\b(lend a hand|help (you )?with the (cows|milking|sheep|hens|beasts|animals)|can i help)\b/i.test(text) && O.AI && O.AI.ready) {
        const s = cur(), h = s.minute / 60, which = Object.entries(TASK).find(([, t]) => (!t.seasons || t.seasons.includes(s.season)) && t.hours.some(([a, b]) => h >= a && h < b));
        if (!which) { const l = 'Not now. Come at milking, dawn or dusk.'; render(l); return Promise.resolve(); }
        const [name, t] = which, beast = nearBeasts(s, t.kinds)[0]; if (!beast) { const l = 'The beasts are seen to already.'; render(l); return Promise.resolve(); }
        PS.helpBeast = { name, f: beast.seed, q: q.id, pay: 2 }; O.addLead && O.addLead({ place: s.world.placeId, x: beast.x, y: beast.y, until: s.day * 1440 + s.minute + 120, why: 'beast', label: `${name === 'milk' ? 'Milk the cow' : name === 'eggs' ? 'Gather the eggs' : name === 'shear' ? 'Shear the sheep' : 'Pitch the hay'}` });
        const l = { milk: 'Here\'s a pail. Sit to her on the near side and don\'t pull.', eggs: 'Basket\'s by the coop. Mind the cockerel.', shear: 'Shears are on the post. Hold her firm between your knees.', fodder: 'Fork\'s in the barn. Spread it, don\'t dump it.' }[name];
        (q._conv = q._conv || []).push({ who: 'p', t: text }, { who: 'q', t: l }); render(l); return Promise.resolve();
      }
      return _say.apply(this, arguments);
    };
    (O.moreCandidates = O.moreCandidates || []).push(() => {
      const H = PS.helpBeast, s = cur(); if (!H || !s || game.scene) return null; const f = (O.fauna || []).find((x) => x.seed === H.f && x.world === s.world.placeId); if (!f) return null;
      const P = game.player; if (Math.hypot(f.x - P.x, f.y - P.y) > 30) return null; const t = TASK[H.name];
      return { type: 'custom', d: 6, x: f.x, y: f.y - 20, label: H.name === 'milk' ? 'Milk her' : H.name === 'eggs' ? 'Gather the eggs' : H.name === 'shear' ? 'Shear her' : 'Pitch the hay', act: () => {
        P.locked = true; P.anim = t.anim; P.ft = 0; f._held = game.t + t.secs; f.dir = 2;
        setTimeout(() => { P.locked = false; P.anim = 'idle'; PS.helpBeast = null; O.dropLead && O.dropLead((l) => l.why === 'beast'); const q = s.byId.get(H.q), farm = farmFor(s, f); if (farm && t.good) farm.stock[t.good] = (farm.stock[t.good] || 0) + t.qty; PS.money += H.pay; if (q) { s.relate(q, { id: 0 }, 0.08); O.NpcActs && O.NpcActs.fly && O.NpcActs.fly(q, 'player', 'coin'); } PS.skills.farming = Math.min(1, (PS.skills.farming || 0) + 0.02); O.UI.say(`Done. ₳${H.pay} for your trouble.`, 'good'); }, t.secs * 1000);
      } };
    });
  }
  O.AnimalCareSetup = { setup };
})();
