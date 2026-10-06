// The everyday things a life is made of, that were missing:
//   gifts: give anyone something from your satchel, or coin, and see how they take it;
//   the people you know (O): everyone who knows you, what they do, and how they feel about you; and a
//     page on your own life so far;
//   falling ill: a chill from the cold and wet, a fever in a sickly town; rest, a remedy, or the physician;
//   the cold: out in winter without a wool tunic it bites;
//   wells: draw water and drink;
//   foraging in the woods: berries, mushrooms, herbs, in their seasons;
//   the church: confession, alms for the poor, the tithe, and hearing mass on Sunday morning;
//   birthdays: a year goes by, and you're a year older.
'use strict';
(function () {
  const T = 16;
  function setup(game, npcUI) {
    const PS = O.PlayerState, cur = () => O.SimRef.cur, say = (t, k) => O.UI.say(t, k), esc = (t) => O.escape(String(t)), G = O.Data.GOODS;
    const nm = (k) => (G[k]?.name || k).toLowerCase();
    const he = (q, cap) => { const w = q.sex === 'f' ? 'she' : 'he'; return cap ? w[0].toUpperCase() + w.slice(1) : w; };
    const his = (q) => (q.sex === 'f' ? 'her' : 'his');
    const abs = (s) => s.day * 1440 + s.minute;

    // ================================================================ gifts
    const prevExtra = npcUI.extraButtons, prevOn = npcUI.onExtra;
    npcUI.extraButtons = (q) => { const out = prevExtra ? prevExtra(q) : []; if (q.age >= 5 && !q.visitor && q.alive !== false) out.push(['gift', 'Give them something']); if (['priest', 'chaplain', 'bishop'].includes(q.job?.role)) { out.push(['confess', 'Make your confession']); out.push(['alms', 'Give alms for the poor']); out.push(['tithe', 'Pay your tithe']); } if (['physician', 'barber-surgeon', 'nurse', 'midwife', 'herbalist', 'apothecary'].includes(q.job?.role) && (PS.ill || PS.hp < 80 || (PS.wounds || []).length)) out.push(['treat', `Ask to be seen to (₳${treatFee(q)})`]); return out; };
    npcUI.onExtra = (q, key, render) => {
      if (key === 'gift') { npcUI.closeTalk && npcUI.closeTalk(); return giftPanel(q); }
      if (key === 'confess') return render(confess(q));
      if (key === 'alms') return render(alms(q));
      if (key === 'tithe') return render(tithe(q));
      if (key === 'treat') return render(treat(q));
      return prevOn && prevOn(q, key, render);
    };
    function giftPanel(q) {
      const s = cur(), kinds = [...new Set(PS.items)].filter((k) => G[k] && k !== 'key' && !G[k].quest);
      O.Panels.open(`A gift for ${q.first}`, `<p class="caption">What will you give ${esc(q.first)}? A gift means more if it suits them, and the first of the day means most.</p>
        <div class="topics">${kinds.map((k) => `<button data-g="${k}"><img src="${O.icon(k)}" alt="" style="width:14px;vertical-align:middle"> ${esc(G[k].name)}</button>`).join('') || '<span class="caption">Your satchel is empty.</span>'}</div>
        <div class="lbl" style="margin-top:8px">Or coin</div><div class="topics">${[1, 5, 20, 50].map((n) => `<button data-m="${n}" ${PS.money < n ? 'disabled' : ''}>₳${n}</button>`).join('')}</div>`, (r) => {
        r.querySelectorAll('[data-g]').forEach((b) => b.onclick = () => give(s, q, b.dataset.g, 0));
        r.querySelectorAll('[data-m]').forEach((b) => b.onclick = () => give(s, q, null, +b.dataset.m));
      });
    }
    function give(s, q, k, coin) {
      if (k && !PS.items.includes(k)) return;
      if (coin && PS.money < coin) return say("You haven't that much.", 'bad');
      const hh = s.household(q), rich = q.gentry || q.royal || (hh && hh.money > 400), poor = hh && hh.money < 30;
      const today = q._giftDay === s.day ? (q._giftN || 0) : 0; q._giftDay = s.day; q._giftN = today + 1;
      const tire = today ? 1 / (1 + today * 1.5) : 1;
      let worth = coin || (G[k].base || 2), fit = 1, line = '';
      if (k) {
        if (G[k].food && (q.needs?.hunger ?? 60) < 40) { fit = 2; line = `"Bless you! I've not eaten since morning."`; }
        else if (G[k].food) line = `"That's kind of you. We'll have it with supper."`;
        else if (G[k].jewel) { fit = q.sex === 'f' ? 1.6 : 1.2; line = q.sex === 'f' ? `${q.first} turns it over in ${his(q)} hands, colouring. "For me?"` : `"That's a fine thing. Thank you."`; }
        else if (q.job && ((s.biz.get(q.job.biz)?.def.buys || {})[k] || (s.biz.get(q.job.biz)?.def.recipes || []).some((rc) => rc.inp && rc.inp[k]))) { fit = 1.4; line = `"I can use this at work. Thank you."`; }
        else if (k === 'ale' || k === 'wine') { fit = q.traits?.includes('pious') ? 0.5 : 1.3; line = `"Now that's a gift!"`; }
        else line = `"Thank you. I'll find a use for it."`;
      } else {
        if (rich && coin < 20) { fit = -0.5; line = `${q.first} looks at the coin and then at you. "Keep it. I've no need of alms."`; }
        else if (poor) { fit = 1.8; line = `"I... thank you. This will feed us for a while."`; }
        else line = coin >= 20 ? `"That's generous. Too generous. Are you sure?"` : `"Well, thank you."`;
      }
      // what it does: worth to them, the fit, and less for a third present in one day
      const d = O.clamp((0.02 + Math.sqrt(worth) / 40) * fit * tire, -0.08, 0.3);
      if (k) { PS.remove(k); if (G[k].food && hh) hh.pantry[k] = (hh.pantry[k] || 0) + 1; else if (G[k].jewel) { q.jewels = [...new Set([...(q.jewels || []), k])].slice(-3); if (q.app) { q.app.jewels = q.jewels.slice(); O.Char.invalidate(q.app); } } }
      else { PS.money -= coin; if (hh) hh.money += coin; }
      s.relate(q, { id: 0 }, d);
      if (d > 0) s.remember(q, `The stranger gave me ${k ? (/^[aeiou]/.test(nm(k)) ? 'an ' : 'a ') + nm(k) : '₳' + coin}.`, 'social', Math.min(2, 0.6 + d * 5), 0);
      if (today >= 2) line += ` ${he(q, true)} seems a little puzzled by so much giving.`;
      O.Panels.close(); say(`${q.first}: ${line}`, d < 0 ? 'bad' : '');
    }

    // ================================================================ the church
    function confess(q) {
      const s = cur();
      if ((PS.confessed ?? -99) > s.day - 7) return '"You were shriven only lately, child. Go and sin no more, and come back at the week\'s end."';
      PS.confessed = s.day;
      const sins = (PS.crimes || []).length;
      if (!sins && (PS.rep.criminal || 0) < 0.05) return '"A clean conscience is a rare thing. Say your prayers and go in peace."';
      PS.rep.criminal = Math.max(0, (PS.rep.criminal || 0) - 0.05); PS.rep.local = Math.min(1, (PS.rep.local || 0) + 0.01);
      s.relate(q, { id: 0 }, 0.04);
      return `${q.first} listens behind the grille, and is silent a long while. "Ten paternosters, and make amends where you can. What is said here goes no further." You come out lighter.`;
    }
    function alms(q) {
      const s = cur(); if (PS.money < 5) return '"Even a farthing\'s worth of kindness counts, but you\'ve nothing to spare."';
      PS.money -= 5;
      const poor = s.households.filter((h) => !h.gone && h.money < 30).sort((a, b) => a.money - b.money)[0];
      if (poor) poor.money += 5; else s.treasury.cash += 5;
      PS.rep.civilian = Math.min(1, PS.rep.civilian + 0.015); PS.rep.local = Math.min(1, (PS.rep.local || 0) + 0.015); s.relate(q, { id: 0 }, 0.03);
      if (poor) for (const id of poor.members) { const m = s.byId.get(id); if (m && m.age >= 12) s.remember(m, 'The priest brought us alms from the stranger.', 'hardship', 1, 0); }
      return `"God reward you. ${poor ? `The ${poor.surname} family will eat tonight because of you.` : 'It will go to whoever needs it next.'}"`;
    }
    function tithe(q) {
      const s = cur(), wk = Math.floor(s.day / 7);
      if (PS.tithedWeek === wk) return '"You have paid your tithe this week. The Church thanks you."';
      const owed = Math.max(1, Math.round(((PS.earned || 0) - (PS.titheBase || 0)) * 0.1));
      if (PS.money < owed) return `"A tenth of what you've earned since: ₳${owed}. Come back when you have it."`;
      PS.money -= owed; PS.tithedWeek = wk; PS.titheBase = PS.earned || 0; s.treasury.cash += Math.round(owed / 2);
      PS.rep.local = Math.min(1, (PS.rep.local || 0) + 0.02); s.relate(q, { id: 0 }, 0.03);
      return `"₳${owed}: a tenth of your earnings. The parish chest and the poor thank you."`;
    }
    // hearing mass: sit in a pew in the chapel on Sunday morning, or on the saint's day
    let heard = -1;
    game.hooks.update.push(() => {
      const s = cur(), p = game.player, sc = game.scene; if (!s || !sc || !p.sitting || heard === s.day) return;
      const chapel = sc.b.type === 'chapel' || sc.b.roomKey === 'chapel'; if (!chapel) return;
      const sun = s.weekday === 6 && s.hour >= 8.5 && s.hour < 11, saint = O.saintDay && O.saintDay(s).day === ((s.day - 1) % 56) + 1 && s.hour >= 9 && s.hour < 10.5;
      if (!sun && !saint) return;
      heard = s.day; PS.rep.local = Math.min(1, (PS.rep.local || 0) + 0.02); PS.energy = Math.min(100, PS.energy + 5);
      for (const a of sc.actors.values()) if (a.person && Math.random() < 0.4) s.relate(a.person, { id: 0 }, 0.02);
      say(saint ? 'You hear the saint\'s day mass among the townsfolk. The candles, the Latin, the bells: you come out the better for it.' : 'You hear mass with the town. Neighbours nod to you in the pews.');
    });

    // ================================================================ falling ill, and getting well
    const KINDS = { chill: { name: 'a chill', sev: 0.35 }, fever: { name: 'a fever', sev: 0.6 }, flux: { name: 'the flux', sev: 0.55 } };
    const warm = () => PS.items.includes('clothes') || PS.items.includes('disguise');
    let illT = 0, coldTold = -1;
    game.hooks.update.push((dt) => {
      const s = cur(); if (!s || game.sleepState) return;
      illT += dt * game.clock.speed; if (illT < 30) return; illT = 0; // (every half hour of game time)
      const out = !game.scene, cold = s.season === 'winter' || (s.season === 'autumn' && (s.hour < 7 || s.hour > 19)), wet = /rain|storm|snow|sleet|hail/.test(s.weather?.kind || '');
      // the cold
      if (out && cold && !warm()) { PS.energy = Math.max(0, PS.energy - 0.6); if (coldTold !== s.day) { coldTold = s.day; say('The cold bites through your clothes. A wool tunic from the tailor would keep it out.', 'bad'); } }
      if (!PS.ill) {
        let p = 0.0015; if (out && cold && !warm()) p *= 3; if (out && wet) p *= 2; if (PS.hunger < 20) p *= 2; if (s.quarantine) p *= 6; if (PS.energy < 15) p *= 1.5;
        if (Math.random() < p) { const k = s.quarantine ? 'fever' : PS.hunger < 20 ? 'flux' : 'chill'; PS.ill = { kind: k, sev: KINDS[k].sev, day: s.day }; say(`You've come down with ${KINDS[k].name}. Rest, a remedy, or the physician will see you right.`, 'bad'); }
      } else {
        const I = PS.ill;
        PS.energy = Math.max(0, PS.energy - I.sev * 1.2);
        if (I.sev > 0.5) PS.hp = Math.max(8, PS.hp - 0.4);
        I.sev -= 0.004 + (PS.hunger > 50 ? 0.004 : 0);
        if (I.sev <= 0) { PS.ill = null; say("You're over it: well again."); }
      }
    });
    // sleeping it off
    const _sleep = O.Sleep && O.Sleep.sleep;
    game.hooks.update.push(() => { if (PS.ill && game.sleepState) { PS.ill.sev -= 0.0008; if (PS.ill.sev <= 0) PS.ill = null; } });
    void _sleep;
    // a remedy
    G.medicine.drink = G.medicine.drink || 0.05; // (so it can be taken from the satchel)
    const _consume = O.consume;
    O.consume = (k) => { _consume(k); if (k === 'medicine') setTimeout(() => { if (PS.ill) { PS.ill.sev -= 0.45; if (PS.ill.sev <= 0) { PS.ill = null; say('The remedy does its work. You feel well again.'); } else say('Bitter stuff. You feel a little better.'); } PS.hp = Math.min(100, PS.hp + 10); }, 2000); };
    const treatFee = (q) => (q.job?.role === 'physician' ? 8 : q.job?.role === 'barber-surgeon' ? 5 : 3);
    function treat(q) {
      const s = cur(), fee = treatFee(q);
      if (PS.money < fee) return `"₳${fee} for my trouble. Come back when you have it."`;
      PS.money -= fee; const bz = q.job?.biz != null && s.biz.get(q.job.biz); if (bz) bz.cash += fee;
      const was = PS.ill ? KINDS[PS.ill.kind].name : null;
      if (PS.ill) PS.ill.sev -= 0.6; if (PS.ill && PS.ill.sev <= 0) PS.ill = null;
      PS.hp = Math.min(100, PS.hp + 35); PS.wounds = (PS.wounds || []).slice(0, Math.max(0, (PS.wounds || []).length - 2));
      s.relate(q, { id: 0 }, 0.03);
      return `${q.first} looks you over${was ? `: ${was}, sure enough` : ''}, ${(PS.wounds || []).length ? 'dresses your wounds, ' : ''}and sends you off with a draught. "Rest, and eat well."${PS.ill ? ' You feel better, though not yet well.' : ''}`;
    }

    // ================================================================ wells, and the woods
    let drankAt = -1e9, foragedN = 0, foragedDay = -1, busy = 0, after = null;
    game.hooks.update.push((dt) => { if (busy > 0) { busy -= dt; game.player.locked = true; game.player.anim = 'crouch'; if (busy <= 0) { game.player.locked = false; game.player.anim = 'idle'; const f = after; after = null; f && f(); } } });
    const inWoods = () => { const w = game.world, p = game.player; if (!w || game.scene) return false; const tx = Math.floor(p.x / T), ty = Math.floor((p.y - 2) / T); if (w.ter[ty * w.W + tx] === w.TER.FOREST) return true; let n = 0; for (const t of w.trees || []) if (Math.abs(t.x - p.x) < 40 && Math.abs(t.y - p.y) < 40 && ++n >= 3) return true; return false; };
    const hook = () => {
      const prev = O.stallCandidate;
      O.stallCandidate = () => {
        const base = prev ? prev() : null, s = cur(), p = game.player; if (game.scene || busy > 0 || !s || p.mount) return base;
        let c = null;
        const well = game.world.props.find((x) => x.kind === 'well' && Math.hypot(x.x - p.x, x.y - p.y) < 28);
        if (well) c = { type: 'custom', d: Math.hypot(well.x - p.x, well.y - p.y) + 1, label: 'Draw water and drink', act: () => drink(s), x: well.x, y: well.y - 30 };
        else if (inWoods() && !inTown(s)) c = { type: 'custom', d: 16, label: 'Forage (half an hour)', act: () => forage(s), x: p.x, y: p.y - 40 };
        return c && (!base || c.d < base.d) ? c : base;
      };
    };
    const inTown = (s) => { const Z = s.Z.square, p = game.player; if (!Z) return false; return Math.abs(p.x / T - (Z[0] + Z[2]) / 2) < 30 && Math.abs(p.y / T - (Z[1] + Z[3]) / 2) < 25; };
    let hooked = false; game.hooks.update.push(() => { if (!hooked) { hooked = true; hook(); } });
    function drink(s) {
      if (abs(s) - drankAt < 20) return say("You've had your fill of water for now.");
      drankAt = abs(s); game.player.anim = 'drink'; PS.energy = Math.min(100, PS.energy + 4); PS.hunger = Math.min(100, PS.hunger + 1);
      say(s.quarantine ? 'You draw a bucket and drink. In a sickly town, you wonder if that was wise.' : 'You haul up the bucket and drink. Cold and good.');
      if (s.quarantine && !PS.ill && Math.random() < 0.15) PS.ill = { kind: 'flux', sev: KINDS.flux.sev, day: s.day };
    }
    const FIND = { spring: [['herbs', 0.45], ['berries', 0.05]], summer: [['berries', 0.5], ['herbs', 0.35]], autumn: [['mushrooms', 0.45], ['berries', 0.3], ['herbs', 0.15]], winter: [['herbs', 0.06]] };
    function forage(s) {
      if (foragedDay !== s.day) { foragedDay = s.day; foragedN = 0; }
      if (foragedN >= 6) return say("You've picked these woods over today. Try again tomorrow.");
      foragedN++; busy = 2.6;
      after = () => {
        for (let i = 0; i < 15; i++) { s.tick(2); PS.tick(2, false); }
        const sk = PS.skills.foraging || 0; PS.skills.foraging = Math.min(1, sk + 0.01);
        const got = []; for (const [g, ch] of FIND[s.season] || []) if (G[g] && Math.random() < ch + sk * 0.3 && PS.canCarry(g)) { PS.add(g); got.push(g); }
        // a lord's woods: gathering is allowed, but the bailiff may still grumble
        say(got.length ? `You come back with ${got.map((g) => (g === 'herbs' ? 'a bunch of herbs' : g === 'berries' ? 'a handful of berries' : 'a basket of mushrooms')).join(' and ')}.` : s.season === 'winter' ? 'Nothing grows in the winter woods. You come back cold and empty-handed.' : 'You search a while, but find nothing worth the picking.');
      };
    }

    // ================================================================ the people you know, and your own life
    function people() {
      const sims = new Set([cur(), O.SimRef.home, ...[...(O.Travel?.visited.values() || [])].map((v) => v.sim)].filter(Boolean));
      const rows = [];
      for (const s of sims) for (const q of s.people) {
        const r = q.rel && q.rel.get(0); if (!r || q.alive === false || q.visitor) continue;
        if ((r.familiar || 0) < 0.05 && Math.abs(r.affinity || 0) < 0.06) continue;
        rows.push({ q, s, a: r.affinity || 0 });
      }
      rows.sort((x, y) => y.a - x.a);
      const word = (a) => (a > 0.6 ? 'a dear friend' : a > 0.35 ? 'a friend' : a > 0.12 ? 'friendly' : a > -0.12 ? 'knows you' : a > -0.35 ? 'cool towards you' : a > -0.6 ? 'dislikes you' : 'hates you');
      const life = `<div class="kv"><div><span class="lbl">Days in Eldoria</span><b>${cur().day - (PS.startDay || 1) + 1}</b></div><div><span class="lbl">Age</span><b>${O.Forge.player?.age || '?'}</b><small>${PS.ill ? 'ill: ' + KINDS[PS.ill.kind].name : 'in health'}</small></div><div><span class="lbl">Earned honestly</span><b>₳${Math.round(PS.earned || 0)}</b></div><div><span class="lbl">Goods made</span><b>${PS.made || 0}</b></div><div><span class="lbl">Crimes known</span><b>${(PS.crimes || []).length}</b></div><div><span class="lbl">People who know you</span><b>${rows.length}</b></div></div>`;
      O.Panels.open('People', `<h3>Your life</h3>${life}<h3>The people you know</h3>${rows.length ? `<table><tbody>${rows.slice(0, 60).map(({ q, s, a }) => `<tr><td><b>${esc(q.name)}</b><br><small class="lbl">${esc(q.job?.role || (q.age < 16 ? 'a child' : 'no trade'))}, ${esc(s.world.name)}</small></td><td><span class="${a < -0.12 ? 'warn' : ''}">${word(a)}</span></td></tr>`).join('')}</tbody></table>` : '<p class="caption">Nobody knows you yet. Talk to people.</p>'}`);
    }
    O.openPeople = people;
    game.keyHandlers.push((e) => { if (e.code === 'KeyO' && !e.ctrlKey && !e.metaKey) { if (O.panelOpen) O.Panels.close(); else people(); return true; } return false; });

    // ================================================================ a dog of your own
    // now and then a stray turns up in the street; feed it twice and it's yours, and follows you about
    const DOGNAMES = ['Bran', 'Gelert', 'Shep', 'Tray', 'Bob', 'Hob', 'Brindle', 'Fly', 'Nell', 'Juno', 'Ranger', 'Patch'];
    const ownDog = () => (O.fauna || []).find((f) => f.mine);
    const mkDog = (x, y, extra) => { const f = Object.assign({ world: game.world.placeId, kind: 'dog', seed: 1 + Math.floor(Math.random() * 9000), z: { x0: Math.floor(x / T) - 4, y0: Math.floor(y / T) - 3, x1: Math.floor(x / T) + 4, y1: Math.floor(y / T) + 3 }, x, y, dir: 0, ft: 0, tx: null, wait: 2, speed: 11 }, extra); (O.fauna = O.fauna || []).push(f); return f; };
    let strayDay = -1;
    game.hooks.update.push((dt) => {
      const s = cur(), p = game.player; if (!s || !O.fauna) return;
      // yours: brought back after a reload
      if (PS.dog && !ownDog()) mkDog(p.x - 16, p.y + 6, { mine: true, seed: PS.dog.seed, name: PS.dog.name });
      const d = ownDog();
      if (d) {
        if (!game.scene) {
          if (d.world !== game.world.placeId || Math.hypot(d.x - p.x, d.y - p.y) > 320) { d.world = game.world.placeId; d.x = p.x - 18; d.y = p.y + 8; }
          const tx = p.x - 16 * (p.dir === 1 ? 1 : p.dir === 2 ? -1 : 0.6), ty = p.y + 10, dd = Math.hypot(tx - d.x, ty - d.y);
          d.speed = dd > 60 ? 95 : dd > 24 ? 50 : 11; d.tx = dd > 10 ? tx : null; d.ty = ty; if (!d.tx) d.wait = 1;
          d.z = { x0: Math.floor(p.x / T) - 1, y0: Math.floor(p.y / T), x1: Math.floor(p.x / T) + 1, y1: Math.floor(p.y / T) + 1 };
        }
      }
      // a stray, once in a while
      if (!d && !game.scene && s.day !== strayDay && s.hour > 8 && s.hour < 18 && Math.random() < 0.002) {
        strayDay = s.day; if (!O.fauna.some((f) => f.stray && f.world === game.world.placeId)) mkDog(p.x + 90, p.y + 30, { stray: true, fed: 0 });
      }
    });
    const FOODS = ['meat', 'venison', 'bread', 'fish', 'meal'];
    const prevS = O.stallCandidate;
    let hooked2 = false; game.hooks.update.push(() => { if (hooked2) return; hooked2 = true; const prev = O.stallCandidate; O.stallCandidate = () => {
      const base = prev ? prev() : null, p = game.player; if (game.scene) return base;
      const f = (O.fauna || []).find((x) => (x.stray || x.mine) && x.world === game.world.placeId && Math.hypot(x.x - p.x, x.y - p.y) < 26); if (!f) return base;
      const c = f.mine ? { type: 'custom', d: 12, label: `Pat ${f.name}`, act: () => say(`${f.name} thumps ${['his', 'her'][f.seed % 2]} tail and leans against your leg.`), x: f.x, y: f.y - 22 }
        : { type: 'custom', d: 10, label: 'Feed the stray dog', act: () => feed(f), x: f.x, y: f.y - 22 };
      return !base || c.d < base.d ? c : base;
    }; });
    void prevS;
    function feed(f) {
      const s = cur(), k = FOODS.find((x) => PS.items.includes(x));
      if (!k) return say('The dog looks at you hopefully. You have nothing for it: bread or meat would do.');
      PS.remove(k); f.fed = (f.fed || 0) + 1;
      if (f.fed < 2) return say(`The dog wolfs down the ${nm(k)} and watches you, tail going.`);
      const name = DOGNAMES[f.seed % DOGNAMES.length]; f.stray = false; f.mine = true; f.name = name; PS.dog = { name, seed: f.seed, since: s.day };
      say(`The dog won't leave your side now. You call ${f.seed % 2 ? 'her' : 'him'} ${name}.`);
    }

    // ================================================================ birthdays
    game.hooks.update.push(() => {
      const s = O.SimRef.home; if (!s || !O.Forge.player) return;
      if (PS.startDay == null) PS.startDay = s.day;
      const years = Math.floor((s.day - PS.startDay) / 56);
      if ((PS.yearsHere ?? 0) < years) { PS.yearsHere = years; O.Forge.player.age = (O.Forge.player.age || 20) + 1; say(`A year has turned since you came to Eldoria. You are ${O.Forge.player.age} now.`); }
    });
  }
  O.BasicsSetup = { setup };
})();
