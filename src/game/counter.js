// Across the counter, in words. E at the counter is a talk with whoever is serving: ask for what you
// want in your own words, or pick it from their wares, and they answer as they would, hand it over and
// take your money. They may knock a little off for someone they like, or give it to you for nothing.
// The innkeeper lets you a bed the same way. Any bed will do to sleep in, if you dare, but if the
// household or the inn finds you in it, you're turfed out. And animals like a stroke.
'use strict';
(function () {
  function setup(game) {
    const PS = O.PlayerState, cur = () => O.SimRef.cur, clamp = O.clamp, G = () => O.Data.GOODS;
    const nm = (g) => (G()[g]?.name || g).toLowerCase();
    const an = (t) => (/^[aeiou]/i.test(t) ? 'an ' : 'a ') + t;
    const serving = (s, q) => { const bz = q.job && s.biz.get(q.job.biz); return bz && q.activity?.act === 'work' && bz.open !== false && !bz.def.public && bz.def.sells && bz.def.sells.length && q.agent.inside === bz.id ? bz : null; };
    const relOf = (q) => { const r = q.rel.get(0) || { affinity: 0, familiar: 0 }; q.rel.set(0, r); return r; };
    const usual = (s, bz, g, q) => (O.priceFor ? O.priceFor(s, bz, g, q) : s.price(bz, g));

    // buying from the wares: you ask, they answer and hand it over (or don't)
    O.buyByTalk = (s, bz, q, g, pr) => {
      if (!O.npcUI) return; if (O.npcUI.talking() !== q) O.npcUI.openTalk(q);
      q._buying = { g, pr, until: performance.now() + 60000 };
      const name = nm(g), unit = G()[g]?.unit;
      setTimeout(() => O.npcUI.playerSays(q, `I'll have ${unit && unit !== name && !/s$/.test(name) ? an(unit) + ' of ' + name : an(name)}, please.`), 350);
    };
    // what they sell, and what to do about it, for their card
    (O.extraLines = O.extraLines || []).push((s, q) => {
      const out = [], bz = serving(s, q);
      if (bz) {
        const wares = bz.def.sells.filter((g) => (bz.stock[g] || 0) >= 1).map((g) => `${nm(g)} (${Math.floor(bz.stock[g])} left, ₳${usual(s, bz, g, q)})`);
        out.push(`You are serving at the counter of ${bz.name}. Your wares: ${wares.join(', ') || 'nothing left today'}. When the player asks for something you sell, hand it over and take the money: sell {"item","price","qty"?}. The price is yours to set: the usual one, a little off for someone you like or are sorry for, or 0 to give it free. Never sell what you haven't got. If they want to look over everything, offer {"key":"trade"}.`);
        if (bz.type === 'tavern') out.push(`You let beds upstairs, usually ₳6 a night. If the player asks for a room or a bed, let it to them: rent_room {"price"} (less, or 0, for a friend).${PS.room && PS.room.b === bz.id && s.day <= PS.room.until ? ' The player already has a room here tonight.' : ''}`);
      }
      const B = q._buying; if (B && performance.now() < B.until) out.push(`The player is asking to buy ${nm(B.g)} (your usual price ₳${B.pr}): sell it to them (at that, at less, or free), or say why not.`);
      return out.join(' ');
    });
    const base = O.NpcActs.apply;
    O.NpcActs.apply = function (s, q, a, main) {
      if (a && a.do === 'sell') {
        const bz = serving(s, q), g = O.NpcActs.goodFor(a.item);
        if (bz && g && g !== 'coin' && (bz.stock[g] || 0) >= 1) {
          const want = clamp(Math.round(Number(a.qty) || 1), 1, 6), each = Math.max(0, Math.round(Number(a.price) || 0)), P = PS;
          let n = 0; while (n < want && (bz.stock[g] || 0) >= 1 && P.canCarry(g) && P.money >= each) { bz.stock[g] -= 1; P.money -= each; bz.cash += each; bz.salesToday = (bz.salesToday || 0) + each; P.add(g); n++; }
          q._buying = null; if (!n) return P.money < each ? `You haven't the ₳${each}.` : 'Your satchel is full.';
          O.NpcActs.fly && O.NpcActs.fly(q, 'player', g);
          const r = relOf(q); r.affinity = clamp(r.affinity + 0.02, -1, 1); r.familiar = Math.min(1, (r.familiar || 0) + 0.04);
          const full = usual(s, bz, g, q);
          return each === 0 ? `${q.first} gives you ${n > 1 ? n + ' ' : ''}${nm(g)} for nothing.` : each < full ? `You buy ${n > 1 ? n + ' ' : ''}${nm(g)} for ₳${each * n}, ${q.first} letting you have it cheap.` : `You buy ${n > 1 ? n + ' ' : ''}${nm(g)} for ₳${each * n}.`;
        }
      }
      if (a && a.do === 'rent_room') {
        const bz = serving(s, q); if (!bz || bz.type !== 'tavern') return null;
        const pr = clamp(Math.round(Number(a.price ?? 6) || 0), 0, 30); if (PS.money < pr) return `You haven't the ₳${pr} for a bed.`;
        PS.money -= pr; bz.cash += pr; PS.room = { b: bz.id, until: s.day + 1 }; if (!PS.items.includes('key')) PS.add('key');
        s.remember(q, 'Let a room to the stranger.', 'work', 0.5);
        return pr ? `You have a bed upstairs for the night (₳${pr}).` : `${q.first} lets you a bed upstairs for nothing.`;
      }
      return base.apply(this, arguments);
    };

    // ---------------------------------------------------------------- a bed that isn't yours
    let kt = 0;
    game.hooks.update.push((dt) => {
      const st = game.sleepState; if (!st || !st.trespass || !game.scene) return;
      kt -= dt; if (kt > 0) return; kt = 0.25;
      const s = cur(), b = game.scene.b.parent || game.scene.b, h = s.hour;
      const there = s.people.filter((z) => z.alive !== false && z.age >= 12 && z.agent.inside === b.id && (z.activity?.act !== 'sleep' || (h >= 20 && h < 23.5)));
      if (!there.length || Math.random() > 0.3) return;
      const q = there.find((z) => z.home === b.id) || there.find((z) => z.job && z.job.biz === b.id) || there[0];
      O.wakeUp && O.wakeUp();
      const mine = q.home === b.id, r = relOf(q); r.affinity = clamp(r.affinity - (mine ? 0.3 : 0.15), -1, 1);
      s.remember(q, mine ? 'Found the stranger asleep in our bed, bold as brass.' : `Found the stranger sleeping in a bed at ${b.name || 'the inn'} they never paid for.`, 'player', 1.2, mine ? -0.5 : -0.3);
      O.UI.say(`${q.first} finds you in the bed and turfs you out.`, 'bad');
      setTimeout(() => { if (game.scene) game.exitBuilding(); if (O.npcUI && !O.npcUI.talking()) setTimeout(() => O.npcUI.startFrom(q, mine ? 'What were you doing in my bed? Get out, and stay out!' : "That bed's paid for, and not by you. Out!"), 400); }, 300);
    });

    // ---------------------------------------------------------------- a stroke for the beasts
    const SOUND = { cow: 'Moo.', sheep: 'Baa.', pig: 'Oink.', chicken: 'Bawk!', goat: 'Meh-eh.', horse: 'Hrrmm.', dog: '♥', cat: 'Purr...' };
    const beast = () => {
      if (game.scene) return null; const P = game.player, s = cur(); let best = null, bd = 26;
      for (const f of O.fauna || []) { if (f.kind === 'dog' || f.kind === 'cat') continue; if (f.world && s && f.world !== s.world.placeId && f.world !== 'ashford') continue; const d = Math.hypot(f.x - P.x, f.y - P.y); if (d < bd) { bd = d; best = f; } }
      return best;
    };
    (O.moreCandidates = O.moreCandidates || []).push(() => {
      const f = beast(); if (!f) return null;
      return { type: 'custom', d: 1, x: f.x, y: f.y - 24, label: `Stroke the ${f.kind}`, act: () => stroke(f) };
    });
    function stroke(f) {
      const p = game.player; p.anim = ['chicken', 'pig', 'sheep', 'goat'].includes(f.kind) ? 'crouch' : 'point'; p.ft = 0;
      f.tx = null; f.wait = 2.5; O.Speech && O.Speech.say(f, SOUND[f.kind] || '♥', 1.6);
      PS.mood = Math.min(100, (PS.mood || 50) + 2);
      setTimeout(() => { if (['crouch', 'point'].includes(p.anim)) p.anim = 'idle'; }, 900);
    }
    O.strokeAnimal = stroke;
  }
  O.CounterSetup = { setup };
})();
