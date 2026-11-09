// Your work, felt. Whatever the post, the doing of it is no longer just time passing: the trade's own
// stuff flies from your hands while you're at it (sparks at the forge, flour at the trough, chips from the
// axe, suds at the tub), your fellows call across to you in their trade's talk, and how good you are shows.
// Green hands slip (a burnt finger at the oven, a dropped tray, a crooked seam to unpick) and lose a little
// time; a sure hand turns out a piece so good the master comes over to look, nods, and slips you a penny. Now
// and then the master just comes and stands behind you to watch you work, and says what they think.
'use strict';
(function () {
  function setup(game) {
    const cur = () => O.SimRef.cur, PS = O.PlayerState;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    const parts = []; let was = false, acc = 0, tasks = 0; const log = { slips: 0, fine: 0, watched: 0, chat: 0 };
    // what each trade throws off, and what is said and goes wrong in it
    const FX = { baking: ['#f4f0e6', '#e8dcc0', -10, 1.0], smithing: ['#ffe080', '#ffa030', -60, 0.45], woodcraft: ['#d8b880', '#c8a070', -30, 0.7], building: ['#a8a49c', '#c8a070', -30, 0.6], mining: ['#7a6a5a', '#8a8680', -40, 0.5], butchery: ['#a04040', '#c87070', -20, 0.4], weaving: ['#ece8dc', '#d8d0c0', -6, 1.4], crafting: ['#b08a5a', '#8a6a44', -20, 0.6], milling: ['#f4f0e6', '#e0d8c8', -8, 1.2], farming: ['#6a4a30', '#8a6a44', -30, 0.5], serving: ['#c8a050', '#e8d8b0', -20, 0.4], physic: ['#7aa060', '#c8d8a0', -10, 0.8], fishing: ['#c8d8e8', '#a8c0d8', -40, 0.5], letters: ['#2a2a3a', '#4a4a5a', -4, 0.6], trading: ['#d8b040', '#c8a040', -20, 0.4], fighting: ['#e8e8f0', '#c8c8d0', -30, 0.3], riding: ['#c8b090', '#8a6a4a', -10, 0.8] };
    const TALK = {
      baking: ['Mind the oven door, it\'s scorching.', 'Knock the loaf. Hollow? Then it\'s done.', 'More flour on the board, it\'s sticking.', 'The early batch is always the best.'],
      smithing: ['Strike while it\'s red, not after!', 'Quench it slow or it\'ll crack.', 'Feel the weight of that? That\'s good iron.', 'Keep the bellows going, the fire\'s dropping.'],
      woodcraft: ['Saw on the line, not beside it.', 'Oak\'s a beast to plane.', 'Measure twice.', 'Mind the knot there.'],
      building: ['Plumb it, or it\'ll lean like a drunk.', 'More mortar!', 'Pass up the pegs.', 'That beam\'ll outlast us all.'],
      mining: ['Listen to the rock. If it talks, run.', 'Good seam, this.', 'Watch the props.', 'Dark as a cow\'s belly down here.'],
      butchery: ['Clean cuts, or the goodwives complain.', 'Save the fat for the chandler.', 'Sharpen that cleaver.', 'Nothing wasted but the squeal.'],
      weaving: ['Keep the weft tight.', 'You\'ve dropped a thread there.', 'Lovely colour, that.', 'Pass the shuttle back.'],
      crafting: ['Slow hands make good work.', 'That one\'s not fit to sell.', 'Steady. Steady.', 'Our name\'s on that, remember.'],
      milling: ['Watch the stones don\'t run dry!', 'Flour in your hair again.', 'Heavy sacks today.', 'Hear that grind? Sweet as a song.'],
      farming: ['Straight rows, mind!', 'Back-breaking, this.', 'Rain\'s coming, look at those clouds.', 'Good earth, this.'],
      serving: ['Two ales for the corner!', 'Don\'t spill it on the reeve.', 'Wipe that table.', 'Smile. They tip if you smile.'],
      physic: ['Boil the cloths first.', 'Gently. Gently.', 'Feverfew for that one.', 'Wash your hands, and again.'],
      fishing: ['They\'re rising.', 'Mend that net tonight.', 'Feel that pull!', 'Wind\'s from the east, poor fishing.'],
      letters: ['Blot it, or it\'ll smudge.', 'Your hand\'s improving.', 'Mind your spelling.', 'Trim the quill.'],
      trading: ['Count it twice.', 'Weigh it honest.', 'That\'s a fair price, that.', 'Write it in the book.'],
      fighting: ['Eyes open, lad.', 'Anything moving?', 'Keep your guard up.', 'Quiet tonight.'],
      riding: ['Easy with her mouth.', 'Check the shoes.', 'Lovely gait on that one.', 'Rub him down well.'],
    };
    const SLIP = {
      baking: ['You burn your fingers on the oven door.', 'A loaf catches and comes out black.', 'The dough sticks to the board and tears.'],
      smithing: ['A spark lands on your arm. You yelp.', 'The piece cools before you\'ve shaped it; back in the fire.', 'You strike off-true and spoil the edge.'],
      woodcraft: ['The saw jumps and nicks your knuckle.', 'You cut a hair too short.', 'A split runs along the grain.'],
      building: ['A stone slips and nearly takes your toe.', 'The course is crooked; you knock it down and lay it again.'],
      mining: ['Grit in your eye. You stop to rub it.', 'Your pick skids off the rock and jars your arms.'],
      butchery: ['The cleaver slips. Close.', 'You spoil a good joint with a bad cut.'],
      weaving: ['You drop a thread and have to unpick a row.', 'The yarn snaps.'],
      crafting: ['It comes out crooked; you start again.', 'You cut yourself, a little.'],
      milling: ['A sack splits and flour goes everywhere.', 'You strain your back with the sack.'],
      farming: ['You hoe up a seedling with the weeds.', 'Your back twinges.'],
      serving: ['You slop ale down your front.', 'A cup slips and smashes.'],
      physic: ['You spill the tincture.', 'You fumble the bandage.'],
      fishing: ['The fish flips back into the water.', 'Your line tangles.'],
      letters: ['A blot on the page. Start again.', 'You misspell the lord\'s own name.'],
      trading: ['You count wrong and have to start over.', 'You drop the coins and chase them across the floor.'],
      fighting: ['You trip on a cobble.', 'You doze on your feet and jerk awake.'],
      riding: ['The horse steps on your foot.', 'It shies and you nearly lose it.'],
    };
    const FINE = { baking: 'A beautiful batch, crust like gold.', smithing: 'A clean, true piece; it rings like a bell.', woodcraft: 'Joints so tight you can\'t see the line.', building: 'Dead straight and true.', mining: 'A rich lump of ore.', butchery: 'A perfect joint.', weaving: 'Even and fine, fit for a lady.', crafting: 'Fine work, good enough for the gentry.', milling: 'Flour as fine as dust.', farming: 'Rows as straight as a ruler.', serving: 'Not a drop spilt, and a smile for everyone.', physic: 'Neatly done; the patient breathes easier.', fishing: 'A great fat fish!', letters: 'A fair hand, clean and clear.', trading: 'Every coin in its place.', fighting: 'Sharp-eyed; nothing gets past you.', riding: 'The horse goes like silk for you.' };
    const MASTER = { good: ['Now that\'s work. Here, for your trouble.', 'Good. Very good. Keep it so.', 'I could not have done better myself.'], ok: ['Fair enough. Keep at it.', 'Not bad. Not good, but not bad.', 'You\'ll do.'], bad: ['Is that how I showed you? Again.', 'Slower, and do it right.', 'I\'ve seen better from a child.'] };
    const masterOf = (s, bz) => { const id = bz.owner || (bz.workers || [])[0]; const m = typeof id === 'number' ? s.byId.get(id) : null; return m && m.alive !== false && m.agent && !m.agent.frozen && !m.errand && m !== null ? m : null; };
    const fellow = (s, bz) => (bz.workers || []).map((id) => s.byId.get(id)).filter((q) => q && q.alive !== false && q.agent && !q.agent.frozen && Math.hypot(q.agent.x - game.player.x, q.agent.y - game.player.y) < 160)[0];
    function emit(trade) { const f = FX[trade]; if (!f) return; const P = game.player, d = O.Char.DIRV ? O.Char.DIRV[P.dir] || [0, 1] : [0, 1]; for (let i = 0; i < (trade === 'smithing' ? 3 : 1); i++) parts.push({ x: P.x + d[0] * 9 + (Math.random() - 0.5) * 4, y: P.y - 10 + d[1] * 4, vx: (Math.random() - 0.5) * 50 + d[0] * 10, vy: f[2] * (0.6 + Math.random() * 0.6), t: 0, life: f[3] * (0.7 + Math.random() * 0.6), c: Math.random() < 0.5 ? f[0] : f[1], g: f[2] < -20 ? 160 : -4 }); }
    function spill(c) { const P = game.player; for (let i = 0; i < 8; i++) parts.push({ x: P.x, y: P.y - 12, vx: (Math.random() - 0.5) * 70, vy: -40 - Math.random() * 30, t: 0, life: 0.9, c, g: 180 }); }
    function finish(s, e, bz, trade) {
      tasks++; const sk = (PS.skills && PS.skills[trade]) || 0, r = Math.random();
      // a fellow calls across
      if (Math.random() < 0.28) { const f = fellow(s, bz); if (f && TALK[trade]) { O.Speech && O.Speech.say(f, pick(TALK[trade]), 2.6); log.chat++; } }
      // a slip, for green hands
      if (r < 0.14 * (1 - sk)) { log.slips++; const t = pick(SLIP[trade] || SLIP.crafting); O.UI && O.UI.say && O.UI.say(t, 'bad'); game.player.anim = 'hurt'; spill(FX[trade] ? FX[trade][0] : '#c8a070'); O.sfx && O.sfx('hurt', 0.4); return; }
      // a fine piece, for sure hands: the master comes to look
      if (r > 1 - 0.12 * sk) { log.fine++; O.UI && O.UI.say && O.UI.say(FINE[trade] || 'Fine work.', 'good'); for (let i = 0; i < 10; i++) parts.push({ x: game.player.x + (Math.random() - 0.5) * 20, y: game.player.y - 20 - Math.random() * 10, vx: 0, vy: -10, t: 0, life: 1, c: '#fff4b0', g: -2 }); const m = masterOf(s, bz); if (m) comeAndSee(s, m, 'good', bz); return; }
      // and every so often the master just comes to watch
      if (tasks % 6 === 0) { const m = masterOf(s, bz); if (m) comeAndSee(s, m, sk > 0.6 ? 'good' : sk > 0.3 ? 'ok' : 'bad', bz); }
    }
    function comeAndSee(s, m, how, bz) {
      if (m.agent.inside != null && m.agent.inside !== game.scene?.b?.id && game.scene) return; log.watched++;
      const P = game.player, inScene = !!game.scene;
      const say = () => { O.Speech && O.Speech.say(m, pick(MASTER[how]), 3); O.gesture && O.gesture(m, how === 'good' ? 'nod' : how === 'bad' ? 'shake' : 'look', 1.6); if (how === 'good' && (bz.cash || 0) > 5) { bz.cash -= 1; PS.money = (PS.money || 0) + 1; O.sfx && O.sfx('coins', 0.6, inScene); } };
      if (inScene) { setTimeout(say, 400); return; }
      O.Errands.send(s, m, [Math.floor((P.x + 18) / 16), Math.floor(P.y / 16)], { anim: 'look', secs: 1.4, face: 1, giveUp: game.t + 25, after: (ok) => { if (ok) say(); } });
    }
    game.hooks.update.push((dt) => {
      for (const p of parts.slice()) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += p.g * dt; if (p.t > p.life) parts.splice(parts.indexOf(p), 1); }
      const s = cur(); if (!s || !O.Employment) return; const e = O.Employment.here && O.Employment.here(); const working = !!(e && e.onShift && game.player.locked && e.place === s.world.placeId);
      const bz = e ? s.biz.get(e.biz) : null, trade = bz && O.tradeOf ? O.tradeOf(e, bz) : null;
      if (working && trade) { acc += dt; if (acc > 0.18) { acc = 0; emit(trade); } }
      if (was && !working && bz && trade) finish(s, e, bz, trade);
      was = working;
    });
    const draw = (ctx, cam) => { for (const p of parts) { ctx.globalAlpha = Math.max(0, 1 - p.t / p.life); ctx.fillStyle = p.c; ctx.fillRect(Math.round(p.x - cam.x), Math.round(p.y - cam.y), 1, 1); } ctx.globalAlpha = 1; };
    game.hooks.drawWorld.push((ctx, cam) => { if (!game.scene) draw(ctx, cam); });
    game.hooks.drawTop.push((ctx, cam, inScene) => { if (inScene) draw(ctx, cam); });
    O.WorkMoments = { log, get tasks() { return tasks; }, finish: (trade) => { const s = cur(), e = O.Employment.here(); const bz = e && s.biz.get(e.biz); if (bz) finish(s, e, bz, trade || O.tradeOf(e, bz)); } };
  }
  O.WorkMomentsSetup = { setup };
})();
