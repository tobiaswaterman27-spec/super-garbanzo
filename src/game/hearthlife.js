// Small life in and about the house. Fires are lit and banked by somebody: when a hearth comes alight
// or is put to bed you see them kneel to it, and at your own hearth you light it or bank it yourself.
// After rain the ruts and cobbles hold puddles, which dry off in the sun and freeze in winter. People
// lose things in the street (a purse, a key, a ring, gloves), and you can pick them up and keep them or
// give them back; anyone else who finds them does one or the other too. Children who know your name
// beg a story, and folk at work hum the songs they know.
'use strict';
(function () {
  const T = 16;
  function setup(game) {
    const PS = O.PlayerState, cur = () => O.SimRef.cur, say = (t, k) => O.UI.say(t, k), G = O.Data.GOODS;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    const sp = (q, t, secs = 2.4) => O.Speech && O.Speech.say(q, t, secs);

    // ---------------------------------------------------------------- fires lit and banked, in view
    let prevLit = null, ht = 0;
    game.hooks.update.push((dt) => {
      ht -= dt; if (ht > 0) return; ht = 1; const lit = game.lit; if (!lit) return;
      const now = new Set(lit); if (!prevLit) { prevLit = now; return; }
      const sc = game.scene, b = sc && (sc.b.parent || sc.b);
      if (b && now.has(b.id) !== prevLit.has(b.id)) {
        const on = now.has(b.id), fp = sc.L && sc.L.items.find((i) => ['fireplace', 'oven', 'forge', 'cauldron'].includes(i.kind));
        let who = null, bd = 1e9;
        if (fp) { const [fx, fy] = sc.anchor(fp); for (const a of sc.actors.values()) { if (!a.person || a.hidden || a.person.age < 10) continue; const d = Math.hypot(a.x - fx, a.y - fy); if (d < bd) { bd = d; who = a.person; } } }
        if (who) { O.gesture(who, 'crouch', 2.6); sp(who, on ? pick(['(blows the kindling into flame)', '(strikes the flint, and the tinder catches)', '(lays on a log and coaxes it up)']) : pick(['(rakes the ashes over the coals)', '(covers the fire for the night)', '(lets the fire die down)']), 2.6); }
      }
      prevLit = now;
    });
    // your own hearth: light it or bank it
    const isMine = (b) => b && (b.owner?.kind === 'player' || (PS.residence && PS.residence.b === b.id) || (PS.lease && PS.lease.b === b.id) || (PS.room && PS.room.b === b.id));
    (O.sceneMore = O.sceneMore || []).push(() => {
      const sc = game.scene, P = game.player, s = cur(); if (!sc || !s || P.locked) return null; const b = sc.b.parent || sc.b; if (!isMine(b)) return null;
      const fp = sc.L && sc.L.items.find((i) => i.kind === 'fireplace'); if (!fp) return null;
      const [x, y] = sc.anchor(fp); if (Math.hypot(x - P.x, y + 16 - P.y) > 55) return null;
      const on = game.lit && game.lit.has(b.id);
      return { type: 'custom', d: -4, x, y: y - 30, label: on ? 'Bank the fire' : 'Light the fire', act: () => {
        P.anim = 'crouch'; P.ft = 0; P.locked = true;
        setTimeout(() => {
          P.locked = false; P.anim = 'idle'; const now = s.day * 1440 + s.minute;
          if (!on && PS.items.includes('firewood')) PS.remove('firewood', 1);
          b.fireSet = { on: !on, until: now + (on ? 8 * 60 : 5 * 60) };
          if (game.updateHearths) game.updateHearths();
          say(on ? 'You rake the ashes over the embers. It will keep till morning.' : PS.items.includes('firewood') ? 'You lay a log on and blow the fire up. Warmth comes into the room.' : 'You blow the fire up with what was in the woodbox.');
        }, 2400);
      } };
    });
    // a campfire of your own can be put out
    (O.moreCandidates = O.moreCandidates || []).push(() => {
      const w = game.world, P = game.player; if (game.scene || P.locked || !w.props) return null;
      const f = w.props.find((p) => p.campfire && Math.hypot(p.x - P.x, p.y - P.y) < 30); if (!f) return null;
      return { type: 'custom', d: 4, x: f.x, y: f.y - 36, label: 'Put out the fire', act: () => { P.anim = 'crouch'; P.locked = true; setTimeout(() => { P.locked = false; P.anim = 'idle'; w.props = w.props.filter((p) => p !== f); w.dirtyStatics = true; say('You kick earth over the fire till it stops smoking.'); }, 1800); } };
    });

    // ---------------------------------------------------------------- puddles
    game.hooks.drawGround.push((ctx, cam) => {
      if (game.scene) return; const s = cur(), w = game.world; if (!s || !s.weather || !w.ter) return; const wet = s.weather.wet || 0; if (wet < 0.08) return;
      const frozen = s.season === 'winter' && (s.weather.kind === 'snow' || s.hour < 9);
      const x0 = Math.floor(cam.x / T), y0 = Math.floor(cam.y / T), x1 = Math.ceil((cam.x + game.vw) / T), y1 = Math.ceil((cam.y + game.vh) / T);
      const a = Math.min(0.55, wet * 0.7);
      for (let ty = Math.max(0, y0); ty <= Math.min(w.H - 1, y1); ty++) for (let tx = Math.max(0, x0); tx <= Math.min(w.W - 1, x1); tx++) {
        const t = w.ter[ty * w.W + tx]; if (t !== w.TER.ROAD && t !== w.TER.COBBLE && t !== w.TER.YARD) continue;
        const hsh = (tx * 73856093) ^ (ty * 19349663); if (((hsh >>> 0) % 19) !== 0) continue;
        const sz = 0.5 + ((hsh >>> 5) % 5) / 8, rw = Math.round(6 * sz * (0.5 + wet / 2)), rh = Math.max(1, Math.round(rw * 0.45));
        const cx = Math.round(tx * T + 8 + ((hsh >>> 9) % 7) - 3 - cam.x), cy = Math.round(ty * T + 9 + ((hsh >>> 12) % 5) - 2 - cam.y);
        ctx.fillStyle = frozen ? `rgba(200,220,236,${a.toFixed(2)})` : `rgba(70,92,120,${a.toFixed(2)})`;
        for (let yy = -rh; yy <= rh; yy++) { const ww = Math.round(rw * Math.sqrt(1 - (yy * yy) / (rh * rh || 1))); ctx.fillRect(cx - ww, cy + yy, ww * 2, 1); }
        ctx.fillStyle = frozen ? `rgba(255,255,255,${(a * 0.9).toFixed(2)})` : `rgba(190,210,230,${(a * 0.8).toFixed(2)})`; ctx.fillRect(cx - Math.round(rw / 2), cy - Math.round(rh / 2), Math.max(1, Math.round(rw / 2)), 1);
        if (s.raining && Math.floor(performance.now() / 250 + hsh) % 7 === 0) { ctx.fillStyle = 'rgba(220,235,250,0.7)'; ctx.fillRect(cx + ((hsh >>> 3) % 5) - 2, cy, 1, 1); }
      }
    });

    // ---------------------------------------------------------------- lost and found
    G.purse = G.purse || { name: 'Purse', base: 2, unit: 'purse', slots: 1 };
    G.gloves = G.gloves || { name: 'Pair of gloves', base: 4, unit: 'pair', slots: 1 };
    G.comb = G.comb || { name: 'Bone comb', base: 2, unit: 'comb', slots: 1 };
    G.beads = G.beads || { name: 'Prayer beads', base: 3, unit: 'string', slots: 1 };
    G.knife = G.knife || { name: 'Knife', base: 3, unit: 'knife', slots: 1 };
    const LOSABLE = ['purse', 'purse', 'key', 'gloves', 'comb', 'beads', 'knife', 'ring', 'brooch', 'spoon'];
    const found = () => (PS.found = PS.found || []);
    let lt = 0;
    game.hooks.update.push((dt) => {
      lt -= dt; if (lt > 0) return; lt = 40 + Math.random() * 40; const s = cur(); if (!s || game.scene || s.hour < 8 || s.hour > 19) return;
      if ((s.dropped || []).filter((d) => d.lost).length >= 3 || Math.random() > 0.35) return;
      const P = game.player, q = s.people.find((z) => z.age >= 14 && !z.agent.hidden && z.agent.inside == null && z.agent.path && !z.lost && Math.hypot(z.agent.x - P.x, z.agent.y - P.y) < 380 && Math.hypot(z.agent.x - P.x, z.agent.y - P.y) > 60);
      if (!q) return; let g = pick(LOSABLE); if (g === 'ring' && !(q.gentry || s.household(q)?.money > 60)) g = 'gloves';
      s.drop(g, 1, q.agent.x + (Math.random() - 0.5) * 6, q.agent.y + 2, q.id); const d = s.dropped[s.dropped.length - 1];
      d.lost = true; d.owner = q.id; if (g === 'purse') d.coins = Math.max(1, Math.round(Math.min(40, (s.household(q)?.money || 20) * 0.15)));
      q.lost = { good: g, day: s.day, coins: d.coins || 0, id: d.id };
    });
    // (installed on the first frame: the street's pick-up is set up after this)
    const wrapPick = () => { if (!O.pickUp || O.pickUp._lost) return; const _pick = O.pickUp;
    O.pickUp = function (it) {
      const s = cur(), had = s.dropped.includes(it); const r = _pick.apply(this, arguments);
      if (it.lost && had && !s.dropped.includes(it)) {
        const q = s.byId.get(it.owner); found().push({ good: it.good, owner: it.owner, coins: it.coins || 0, day: s.day });
        if (it.coins) { PS.money += it.coins; say(`Inside the purse: ₳${it.coins}.`); }
        if (q) { const seen = s.people.filter((z) => z !== q && !z.agent.hidden && z.agent.inside == null && Math.hypot(z.agent.x - it.x, z.agent.y - it.y) < 90); for (const z of seen.slice(0, 3)) (z.beliefs = z.beliefs || []).unshift({ t: `I saw the stranger pick up something ${q.first} ${q.sur || ''} dropped in the street`, src: 'saw', day: s.day }); }
      }
      return r;
    }; O.pickUp._lost = true; };
    game.hooks.update.push(wrapPick);

    // others find what's lost, if it lies long enough
    const SP = O.Sim.prototype, _nd = SP.newDay;
    SP.newDay = function () {
      const r = _nd.apply(this, arguments);
      for (const d of (this.dropped || []).filter((x) => x.lost && x.day < this.day)) {
        const q = this.byId.get(d.owner); this.dropped = this.dropped.filter((x) => x !== d);
        const finder = this.people.find((z) => z !== q && z.age >= 12 && Math.random() < 0.05); if (!finder || !q) continue;
        const honest = (finder.traits || []).some((t) => ['generous', 'friendly', 'loyal'].includes(t)) || Math.random() < 0.4;
        if (honest) { q.lost = null; this.relate(q, finder, 0.08); (q.beliefs = q.beliefs || []).unshift({ t: `${finder.first} found my lost ${G[d.good]?.name.toLowerCase() || d.good} and brought it back. Honest soul.`, src: 'self', day: this.day }); }
        else (finder.beliefs = finder.beliefs || []).unshift({ t: `I found ${q.first}'s ${G[d.good]?.name.toLowerCase() || d.good} in the street and kept it. I'll say nothing.`, src: 'self', day: this.day });
      }
      for (const q of this.people) if (q.lost && this.day - q.lost.day > 6) q.lost = null;
      return r;
    };
    // giving it back
    const base = O.NpcActs.apply;
    O.NpcActs.apply = function (s, q, a) {
      if (a && a.do === 'take_back') {
        const f = found().find((x) => x.owner === q.id && PS.items.includes(x.good)); if (!f) return null;
        if (f.coins && PS.money < f.coins) return `The purse had ₳${f.coins} in it, and you haven't that now.`;
        PS.remove(f.good, 1); if (f.coins) PS.money -= f.coins; PS.found = found().filter((x) => x !== f); q.lost = null;
        s.relate(q, { id: 0 }, 0.18); PS.rep.civilian = Math.min(1, PS.rep.civilian + 0.01);
        const rw = O.clamp(Math.round(Number(a.reward) || 0), 0, 20); let rt = ''; if (rw) { const hh = s.household(q); if (hh && hh.money >= rw) { hh.money -= rw; PS.money += rw; rt = ` and presses ₳${rw} on you for your honesty`; } }
        return `${q.first} takes back the ${G[f.good]?.name.toLowerCase() || f.good}${f.coins ? ` with its ₳${f.coins}` : ''}${rt}.`;
      }
      return base.apply(this, arguments);
    };
    (O.extraActs = O.extraActs || []).push('take_back {"reward"} (when the player returns something you lost: you take it back, and may give a small reward of a few aurins)');
    (O.extraLines = O.extraLines || []).push((s, q) => {
      if (!q.lost) return ''; const nm = (G[q.lost.good]?.name || q.lost.good).toLowerCase(), mine = found().some((x) => x.owner === q.id && PS.items.includes(x.good));
      return `You lost your ${nm}${q.lost.coins ? ` with ₳${q.lost.coins} in it` : ''} in the street ${s.day - q.lost.day === 0 ? 'today' : 'lately'} and are upset about it.${mine ? ' You notice the player has it! Ask for it back; if they hand it over, take_back.' : ''}`;
    });
    (O.extraLines = O.extraLines || []).push((s, q) => (q.beliefs || []).some((b) => /pick up something/.test(b.t) && s.day - b.day < 3) ? 'You saw the player pick up something someone dropped; you wonder if they gave it back.' : '');

    // ---------------------------------------------------------------- a story for the children
    const famous = () => (O.crowned && O.crowned()) || PS.title || (PS.rep && (PS.rep.local || 0) > 0.35) || (PS.rep && PS.rep.civilian > 0.7);
    let asked = 0;
    game.hooks.update.push(() => {
      const s = cur(); if (!s || game.scene || !famous() || game.t < asked) return; const P = game.player;
      const k = s.people.find((z) => z.age >= 5 && z.age < 12 && !z.agent.hidden && z.agent.inside == null && Math.hypot(z.agent.x - P.x, z.agent.y - P.y) < 50);
      if (!k) return; asked = game.t + 120; O.gesture(k, 'wave', 1.5); sp(k, pick(['Tell us a story!', 'Is it true what they say about you? Tell us!', 'A story, a story!']), 2.6);
    });
    O.moreCandidates.push(() => {
      const s = cur(), P = game.player; if (!s || game.scene || P.locked) return null;
      const kids = s.people.filter((z) => z.age >= 4 && z.age < 13 && !z.agent.hidden && z.agent.inside == null && Math.hypot(z.agent.x - P.x, z.agent.y - P.y) < 70); if (!kids.length) return null;
      if (kids[0]._story === s.day) return null;
      return { type: 'custom', d: 20, x: kids[0].agent.x, y: kids[0].agent.y - 44, label: kids.length > 1 ? 'Tell the children a story' : `Tell ${kids[0].first} a story`, act: () => {
        P.anim = 'gesture'; P.ft = 0; P.locked = true; for (const k of kids) { k._story = s.day; k.agent.frozen = true; O.gesture(k, 'sit', 6); }
        const tale = pick(['the giant of the western hills', 'the fox who outwitted the bishop', 'the ghost of the old mill', 'the knight who lost his horse to a goose', PS.title || (O.crowned && O.crowned()) ? 'how you came to where you are' : 'your own travels']);
        setTimeout(() => sp(kids[0], pick(['And then what?', 'Was he really that big?', 'No! He never!']), 2), 2500);
        setTimeout(() => { P.locked = false; P.anim = 'idle'; for (const k of kids) { k.agent.frozen = false; O.gesture(k, 'celebrate', 1.6); s.relate(k, { id: 0 }, 0.05); (k.beliefs = k.beliefs || []).unshift({ t: `The stranger told us the story of ${tale}`, src: 'player', day: s.day }); } PS.mood = Math.min(100, (PS.mood || 50) + 3); say(`You tell ${kids.length > 1 ? 'the children' : kids[0].first} the tale of ${tale}. They hang on every word.`); }, 6000);
      } };
    });

    // ---------------------------------------------------------------- humming at work, out of doors
    let hum = 0;
    game.hooks.update.push((dt) => {
      hum -= dt; if (hum > 0 || game.scene) return; hum = 18 + Math.random() * 20; const s = cur(); if (!s || !PS.songBook) return; const P = game.player;
      const q = s.people.find((z) => z.age >= 10 && (z.songs || []).length && !z.agent.hidden && z.agent.inside == null && ['work', 'labour', 'chore', 'errand', 'stroll'].includes(z.activity?.act) && Math.hypot(z.agent.x - P.x, z.agent.y - P.y) < 160 && !(O.npcUI && O.npcUI.talking() === z));
      if (!q) return; const song = PS.songBook.find((x) => x.id === pick(q.songs)); if (!song) return;
      sp(q, Math.random() < 0.5 ? `♪ ${song.lines[Math.floor(Math.random() * song.lines.length)]} ♪` : '♪ hm hm, hmm hm... ♪', 3);
      O.Music && O.Music.hum && O.Music.hum(q, song);
    });
  }
  O.HearthLifeSetup = { setup };
})();
