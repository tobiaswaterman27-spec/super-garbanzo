// The gangs at their own business. Once a week the enforcers go round the shops for protection money,
// door by door: most pay, some refuse, and a shop that refused has its shutters smashed in the night.
// Smugglers run goods by night where there's water, and are sometimes taken. When a boss is gaoled or
// dies, the most trusted takes over, and a rival may walk out. In hard times the desperate young join
// up. Those who talk to the watch about a gang are paid a visit; and when you've made a gang your
// enemy, they come for you after dark.
'use strict';
(function () {
  const T = 16;
  function setup(game) {
    const PS = O.PlayerState, cur = () => O.SimRef.cur, say = (t, k) => O.UI.say(t, k), SP = O.Sim.prototype;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    const sp = (q, t, secs = 2.6) => O.Speech && O.Speech.say(q, t, secs);
    const npcGangs = (s) => (s.npcGangs ? s.npcGangs() : []).filter((g) => g.members && g.members.length);
    const shops = (s) => [...s.biz.values()].filter((z) => !z.def.public && z.type !== 'site' && z.def.sells && z.def.sells.length && z.owner !== 'player' && !z.closedDown);
    const collectDay = (s) => s.weekday === 2;
    const enforcers = (s, g) => g.members.filter((m) => ['thug', 'enforcer', 'leader', 'lieutenant'].includes(m.role) || g.speciality === 'protection').map((m) => s.byId.get(m.id)).filter((p) => p && !p.jailUntil && p.alive !== false);

    // ---------------------------------------------------------------- the rounds
    const _plan = SP.plan;
    SP.plan = function (p) {
      const a = _plan.call(this, p);
      if (p.gang && collectDay(this) && this.hour >= 10 && this.hour < 14 && a && !['jailed', 'sleep', 'sick'].includes(a.act)) {
        const g = this.gang(p.gang); if (!g || g.id === 'player' || (g.influence || 0) < 0.2) return a;
        const es = enforcers(this, g); if (!es.includes(p)) return a;
        const list = shops(this); if (!list.length) return a;
        const k = (Math.floor((this.hour - 10) * 2) + es.indexOf(p) * 3) % list.length; return { act: 'visit', b: list[k].b.id ?? list[k].id, collecting: g.id };
      }
      return a;
    };
    // what's paid and what isn't (at the end of the round)
    const _nd = SP.newDay;
    SP.newDay = function () {
      const r = _nd.apply(this, arguments);
      for (const g of npcGangs(this)) {
        // the take from yesterday's round
        if (this.weekday === 3 && (g.influence || 0) >= 0.2) {
          let took = 0; g.refused = [];
          for (const bz of shops(this)) {
            const owner = this.byId.get(bz.owner) || this.byId.get(bz.workers[0]); const toll = 2 + (g.level || 1) * 2;
            const brave = owner && (owner.traits || []).some((t) => ['brave', 'hostile'].includes(t)), refuse = brave && this.rng.chance(0.4);
            if (refuse || (bz.cash || 0) < toll) { g.refused.push(bz.id); if (owner) this.remember(owner, `Told ${g.name} where to put their protection money.`, 'gang', 1.4); continue; }
            bz.cash -= toll; took += toll; if (owner && this.rng.chance(0.3)) this.remember(owner, `Paid ${g.name} their ₳${toll} again. Robbery by another name.`, 'gang', 1);
          }
          g.purse += took; g.recentJobs = (g.recentJobs || 0) + 0.5;
        }
        // the shutters of those who refused
        if (this.weekday === 4 && g.refused && g.refused.length) {
          const id = g.refused.shift(), bz = this.biz.get(id), b = bz && (bz.b && bz.b.id != null ? bz.b : this.building(id));
          if (b) { b.condition = Math.max(0.2, (b.condition ?? 1) - 0.15); b.dirty = true; this.log(`The shutters of ${bz.name} were smashed in the night. Everyone knows who did it, and nobody says.`, 'crime'); const owner = this.byId.get(bz.owner) || this.byId.get(bz.workers[0]); if (owner) this.remember(owner, `${g.name} smashed my shutters for not paying.`, 'gang', 2); this.recordCrime && this.recordCrime({ kind: 'vandalism', perp: this.byId.get(pick(g.members).id), gang: g.id, placeName: bz.name, tile: [b.doorX, b.doorY], seen: [], severity: 1 }); }
        }
        // smuggling by night, where there's water
        if ((g.speciality === 'smuggling' || this.rng.chance(0.1)) && this.weekday === 5 && this.world.ter && this.rng.chance(0.6)) {
          if (this.rng.chance(0.2)) { const m = this.byId.get(pick(g.members).id); if (m && !m.jailUntil) { const c = this.recordCrime({ kind: 'smuggling', perp: m, gang: g.id, placeName: 'the waterside', tile: [this.Z.east[0], this.Z.east[1]], seen: [], severity: 2 }); this.arrestNPC && this.arrestNPC(m, c, false); this.log(`The watch caught ${m.name} running casks off a boat by night.`, 'crime'); } }
          else g.purse += 15 + this.rng.int(0, 20);
        }
        // a boss gone: the most trusted takes over, and a rival may walk out
        const L = g.members.find((m) => m.role === 'leader'), lp = L && this.byId.get(L.id);
        if (!L || !lp || lp.alive === false || (lp.jailUntil && lp.jailUntil - this.day > 3)) {
          const heir = g.members.filter((m) => m !== L && this.byId.get(m.id) && !this.byId.get(m.id).jailUntil).sort((a, b) => (b.loyalty || 0) - (a.loyalty || 0))[0];
          if (heir) {
            if (L) L.role = 'member'; heir.role = 'leader'; g.leader = heir.id; const hp = this.byId.get(heir.id);
            this.log(`${hp.name} has taken charge of ${g.name}${lp ? ` with ${lp.first} ${lp.alive === false ? 'dead' : 'in the cells'}` : ''}.`, 'gang');
            const rival = g.members.find((m) => m !== heir && m.role !== 'leader' && (m.loyalty || 0) > 0.5 && this.rng.chance(0.3));
            if (rival) this.leaveGang(rival, g, `wouldn't take orders from ${hp.first}`);
          }
        }
        // hard times make recruits
        if (this.dearth && this.day <= this.dearth.until && this.rng.chance(0.25)) {
          const p = this.people.find((z) => !z.gang && !z.job && z.age >= 16 && z.age < 26 && this.recruitChance && this.recruitChance(z) > 0.3 && this.household(z) && this.household(z).money < 20);
          if (p) { this.joinGang(p, g.id, 2); this.log(`Hungry and out of work, ${p.name} has fallen in with ${g.name}.`, 'gang'); }
        }
        // those who talked to the watch
        for (const c of (this.crimes || []).filter((c) => c.gang === g.id && c.day >= this.day - 2 && !c._paid)) {
          c._paid = true; const perp = typeof c.perp === 'object' ? c.perp : this.byId.get(c.perp); if (!perp || !perp.jailUntil) continue;
          const w = (c.seen || []).map((x) => (typeof x === 'object' ? x : this.byId.get(x))).find((x) => x && x.alive !== false && !x.gang && x.id !== 0);
          if (w && this.rng.chance(0.5)) { if (w.health) w.health.hp = Math.max(30, w.health.hp - 30); this.remember(w, `${g.name} beat me in the lane for speaking to the watch.`, 'gang', 2.5); this.log(`${w.name} was beaten in a lane after dark. ${g.name} don't forgive a loose tongue.`, 'crime'); }
        }
      }
      return r;
    };
    // the round, as you see it
    const seenRound = new Set();
    let rt = 0;
    game.hooks.update.push((dt) => {
      rt -= dt; if (rt > 0) return; rt = 2; const s = cur(); if (!s || !collectDay(s)) return; const sc = game.scene; if (!sc) return;
      const b = sc.b.parent || sc.b, key = s.day + ':' + b.id; if (seenRound.has(key)) return;
      const actors = [...sc.actors.values()].map((a) => a.person).filter(Boolean), thug = actors.find((q) => q.activity?.collecting), bz = s.biz.get(b.id); if (!thug || !bz) return;
      const owner = actors.find((q) => q.id === bz.owner || q.id === bz.workers[0]); if (!owner) return; seenRound.add(key);
      const g = s.gang(thug.activity.collecting), brave = (owner.traits || []).some((t) => ['brave', 'hostile'].includes(t));
      O.gesture(thug, 'gesture', 2); sp(thug, pick(['The usual, if you please.', `${g ? g.name.replace(/^the /, 'The ') : 'We'} send their regards. And their hand.`, 'Nice place. Shame if anything happened to it.']));
      setTimeout(() => { if (brave) { O.gesture(owner, 'point', 2); sp(owner, pick(['Get out of my shop.', 'Not one penny more.', 'I\'ll see you hang first.'])); setTimeout(() => sp(thug, 'You\'ll be sorry for that.'), 2200); } else { O.gesture(owner, 'count', 2); sp(owner, pick(['(hands over the coins without a word)', 'Here. Now go.', 'Take it, and leave my customers be.'])); } }, 2400);
    });
    (O.extraLines = O.extraLines || []).push((s, q) => {
      if (q.activity?.collecting) return 'You are going round the shops collecting protection money for your gang today. You are polite and menacing.';
      const bz = q.job && s.biz.get(q.job.biz); if (!bz || bz.def.public) return ''; const g = npcGangs(s).find((x) => (x.influence || 0) >= 0.2); if (!g) return '';
      return (g.refused || []).includes(bz.id) ? `You refused to pay ${g.name} their protection, and you are afraid of what they will do.` : `You pay ${g.name} protection every week, and resent it.`;
    });

    // ---------------------------------------------------------------- the gang that wants you
    let gt = 0;
    game.hooks.update.push((dt) => {
      gt -= dt; if (gt > 0) return; gt = 45; const s = cur(); if (!s || game.scene || O.panelOpen || !(s.hour >= 21 || s.hour < 4)) return;
      const g = npcGangs(s).find((x) => x.rel && x.rel.player === 'enemy'); if (!g || (g._cameFor || -1) >= s.day - 1 || Math.random() > 0.35) return;
      g._cameFor = s.day; const n = Math.min(4, Math.max(2, g.members.length));
      O.Panels.open(g.name.replace(/^the /, 'The '), `<p class="speech">“You've been making trouble for us. Time to settle it.”</p><p class="caption">${n} of ${g.name} step out of the dark between two houses.</p><div class="topics"><button data-b="pay">Pay them off (₳${20 + (g.level || 1) * 10})</button><button data-b="fight">Fight</button><button data-b="run">Run</button></div>`, (r) => {
        const done = (m, bad) => { O.Panels.close(); say(m, bad ? 'bad' : ''); };
        r.querySelector('[data-b=pay]').onclick = () => { const pr = 20 + (g.level || 1) * 10, p = Math.min(PS.money, pr); PS.money -= p; g.purse += p; if (p >= pr) g.rel.player = 'rival'; done(p >= pr ? '“Wise.” They take it and the matter is closed, for now.' : `They take your ₳${p} and promise to be back for the rest.`, true); };
        r.querySelector('[data-b=fight]').onclick = () => { const armed = O.Combat && O.Combat.armed && O.Combat.armed(), win = Math.random() < 0.25 + (armed ? 0.2 : 0) + (PS.hp > 70 ? 0.1 : 0); game.player.anim = 'attack'; setTimeout(() => { game.player.anim = 'idle'; }, 900); PS.hp = Math.max(5, PS.hp - (win ? 15 : 40)); if (win) { PS.rep.criminal = Math.min(1, PS.rep.criminal + 0.05); done('You put two of them on the ground and the rest scatter. They\'ll think twice now.'); } else { const lost = Math.floor(PS.money * 0.4); PS.money -= lost; done(`They give you a beating to remember and take ₳${lost}.`, true); } };
        r.querySelector('[data-b=run]').onclick = () => { if (Math.random() < 0.55) done('You run, and lose them in the lanes.'); else { PS.hp = Math.max(5, PS.hp - 20); done('They catch you at the corner. Fists and boots, then gone.', true); } };
      });
    });
  }
  O.GangWorkSetup = { setup };
})();
