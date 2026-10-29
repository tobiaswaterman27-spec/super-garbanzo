// Courting and marrying. Talk someone round until they're fond of you, ask them to walk out with you,
// and if they love you, ask for their hand: the wedding is set at the chapel for the next morning, and
// if you come, you're wed before the priest with the town looking on. Then their home is yours too.
// Court someone else behind their back and they'll hear of it; miss your own wedding and you're jilted.
'use strict';
(function () {
  function setup(game) {
    const PS = O.PlayerState, cur = () => O.SimRef.cur, say = (t, k) => O.UI.say(t, k);
    const clamp = O.clamp;
    const mySex = () => (O.Forge && O.Forge.spec && O.Forge.spec().sex) || 'm';
    const mine = (s, q) => { const p = PS.partner; return !!(p && p.place === s.world.placeId && p.id === q.id); };
    const partner = (s) => { const p = PS.partner; return p && p.place === s.world.placeId ? s.byId.get(p.id) : null; };
    const relOf = (q) => { const r = q.rel.get(0) || { affinity: 0, familiar: 0 }; q.rel.set(0, r); return r; };

    // what the person themself knows of it, for their card
    O.romanceLine = (s, q) => {
      const p = PS.partner;
      if (mine(s, q)) {
        if (p.stage === 'courting') return `You are courting the player (walking out together since ${s.day - p.since < 1 ? 'today' : s.day - p.since + ' days ago'}). If they ask for your hand and you love them, you may say yes (betroth).`;
        if (p.stage === 'betrothed') return `You are betrothed to the player; the wedding is set for ${p.label || 'the chapel'}${(p.guests || []).length ? `, and ${(p.guests || []).length} guests are bidden` : ''}. You may move the day if you both agree (set_wedding).`;
        if (p.stage === 'married') return `You are married to the player${q.home != null ? ' and they share your home' : ''}. You are fond of them and speak to them as a spouse does.`;
      }
      if (q.age < 18 || q.royal) return '';
      if (q.spouse) return 'You are married, and would not be wooed by anyone.';
      if (q.sex === mySex()) return '';
      if (p && p.stage === 'married' && p.place === s.world.placeId) return `The player is married to ${p.full || p.name}; you would not be wooed by them.`;
      return 'You are unmarried. Only if you have come to like them a great deal might you agree to court (walk out with) them when asked; never if you hardly know them.';
    };

    function court(s, q) {
      const r = relOf(q), p = PS.partner;
      if (q.age < 18 || q.spouse || q.sex === mySex() || q.royal || r.affinity < 0.35) return null;
      if (p && p.stage !== 'courting') return null;
      if (mine(s, q)) return null;
      if (p) { // two at once: the first will hear of it
        const old = partner(s);
        if (old) { old.withPlayer = null; const ro = relOf(old); ro.affinity = clamp(ro.affinity - 0.45, -1, 1); ro.trust = clamp((ro.trust || 0) - 0.4, -1, 1); (old.beliefs = old.beliefs || []).unshift({ t: `The one I was courting has taken up with ${q.name}.`, src: 'heard', day: s.day }); s.remember(old, `Thrown over for ${q.name}.`, 'player', 1.2, -0.8); }
      }
      PS.partner = { place: s.world.placeId, id: q.id, name: q.first, full: q.name, stage: 'courting', since: s.day };
      q.withPlayer = 'courting'; r.affinity = clamp(r.affinity + 0.1, -1, 1);
      s.remember(q, `Began walking out with ${r.name || 'the stranger'}.`, 'player', 1.2, 0.6);
      return `You and ${q.first} are courting.`;
    }
    function betroth(s, q, a = {}) {
      const p = PS.partner, r = relOf(q);
      if (!mine(s, q) || p.stage !== 'courting' || r.affinity < 0.5) return null;
      const chapel = [...s.biz.values()].find((z) => z.type === 'chapel');
      if (!chapel) return null;
      const before = (PS.meets || []).length;
      O.NpcActs.meet(s, q, { place: chapel.b.name || chapel.name, hour: a.hour != null ? Math.max(8, Math.min(18, +a.hour || 11)) : 11, day: a.day || 'tomorrow', why: 'our wedding' });
      const m = (PS.meets || [])[before] || (PS.meets || []).filter((x) => x.who === q.id).pop(); if (!m) return null;
      m.flake = false; m.off = -10; // nobody is late to their own wedding
      p.stage = 'betrothed'; p.meetId = m.id; p.at = m.at; p.label = m.label; p.chapel = chapel.b.id; p.guests = p.guests || []; q.withPlayer = 'betrothed';
      s.remember(q, `Promised to marry ${r.name || 'the stranger'}; the wedding is tomorrow at the chapel.`, 'player', 1.5, 0.8);
      for (const id of [...(q.parents || []), ...(q.children || [])]) { const z = s.byId.get(id); if (z) (z.beliefs = z.beliefs || []).unshift({ t: `${q.first} is to marry the stranger tomorrow at the chapel.`, src: 'heard', day: s.day }); }
      s.log && s.log(`${q.name} is to be wed at the chapel tomorrow.`, 'life');
      return `You are betrothed to ${q.first}. The wedding: ${m.label}.`;
    }
    function part(s, q) {
      if (!mine(s, q)) return null;
      const r = relOf(q); r.affinity = clamp(r.affinity - 0.3, -1, 1);
      q.withPlayer = null; const was = PS.partner.stage; PS.partner = null;
      s.remember(q, was === 'married' ? 'Our marriage is over.' : 'We are no longer courting.', 'player', 1.3, -0.6);
      return `You and ${q.first} have parted.`;
    }
    function wed(s, q) {
      const p = PS.partner; p.stage = 'married'; p.wed = s.day; q.withPlayer = 'married';
      const r = relOf(q); r.affinity = clamp(r.affinity + 0.25, -1, 1); r.trust = clamp((r.trust || 0) + 0.2, -1, 1);
      s.remember(q, `Married ${r.name || 'the stranger'} at the chapel.`, 'player', 2, 1);
      const sc = game.scene, near = sc ? [...sc.actors.values()].map((a) => a.person) : s.people.filter((z) => z.agent && z.agent.inside == null && Math.hypot(z.agent.x - game.player.x, z.agent.y - game.player.y) < 220);
      const priest = near.find((z) => /priest|chaplain/.test(z.job?.role || ''));
      if (priest && O.Speech) O.Speech.say(priest, 'Before God and these witnesses, I pronounce you wed.', 4);
      setTimeout(() => { for (const z of near) if (z !== priest && z.alive !== false) O.gesture && O.gesture(z, z === q ? 'celebrate' : 'nod', 2.4); if (O.Speech) O.Speech.say(q, 'Wed at last. I can hardly believe it.', 3.5); }, 1600);
      for (const id of [...(q.parents || []), ...(q.children || [])]) { const z = s.byId.get(id); if (z) { const rz = relOf(z); rz.affinity = clamp(rz.affinity + 0.2, -1, 1); rz.familiar = Math.min(1, (rz.familiar || 0) + 0.3); } }
      if (PS.rep) PS.rep.town = (PS.rep.town || 0) + 0.04;
      s.log && s.log(`${q.name} was wed at the chapel to the newcomer.`, 'life');
      say(`You are married to ${q.full || q.name}.`);
    }
    // the wedding: did you both come
    let tick = 0;
    game.hooks.update.push((dt) => {
      tick -= dt; if (tick > 0) return; tick = 1;
      const s = cur(), p = PS.partner; if (!s || !p || p.stage !== 'betrothed' || p.place !== s.world.placeId) return;
      const q = s.byId.get(p.id), m = (PS.meets || []).find((x) => x.id === p.meetId);
      if (!q || q.alive === false) { PS.partner = null; return; }
      if (!m) return;
      if (m.state === 'met') wed(s, q);
      else if (m.state === 'missed' || m.state === 'stood-up') {
        const r = relOf(q); r.affinity = clamp(r.affinity - 0.6, -1, 1); r.trust = clamp((r.trust || 0) - 0.5, -1, 1);
        q.withPlayer = null; PS.partner = null;
        s.remember(q, 'Left waiting at the chapel on my wedding day.', 'player', 2, -1);
        for (const id of [...(q.parents || []), ...(q.children || [])]) { const z = s.byId.get(id); if (z) relOf(z).affinity = clamp(relOf(z).affinity - 0.4, -1, 1); }
        say(`${q.first} waited at the chapel, and you never came. The wedding is off.`, 'bad');
      }
    });
    // a spouse's home is yours to come and go from
    const iv = O.invitedTo;
    O.invitedTo = (b) => { const s = cur(), p = PS.partner, q = p && p.stage === 'married' && s ? partner(s) : null; if (q && b && q.home === b.id) return true; return iv ? iv(b) : false; };
    // the acts the talk can bring about
    // the wedding's guests: bidden in talk, by letter, or by word passed on
    O.weddingLine = (s, q) => { const p = PS.partner; if (!p || p.stage !== 'betrothed' || p.place !== s.world.placeId || mine(s, q)) return ''; const bidden = (p.guests || []).includes(q.id); return bidden ? `You are bidden to the player's wedding to ${p.full || p.name}: ${p.label}.` : `The player is to marry ${p.full || p.name} (${p.label}). If they ask you to come, you may accept (wedding_guest).`; };
    function guest(s, q, a) {
      const p = PS.partner; if (!p || p.stage !== 'betrothed' || p.place !== s.world.placeId) return null;
      const z = a.who ? O.NpcActs.personFor(s, a.who) : q; if (!z || z.id === p.id) return null;
      p.guests = p.guests || []; if (p.guests.includes(z.id)) return null; p.guests.push(z.id);
      s.remember(z, `Bidden to the stranger's wedding: ${p.label}.`, 'player', 1, 0.3);
      return `${z.first} will come to the wedding.`;
    }
    function reschedule(s, q, a) {
      const p = PS.partner; if (!mine(s, q) || p.stage !== 'betrothed') return null;
      PS.meets = (PS.meets || []).filter((m) => m.id !== p.meetId); p.stage = 'courting';
      const note = betroth(s, q, a); return note ? note.replace(/^You are betrothed to [^.]+\. /, '') : null;
    }
    // at the hour, the bidden go to the chapel and sit in the pews
    { const SP = O.Sim.prototype, _plan = SP.plan; SP.plan = function (pp) {
      const P = PS.partner; if (P && P.stage === 'betrothed' && P.place === this.world.placeId && (P.guests || []).includes(pp.id) && P.chapel != null) { const now = this.day * 1440 + this.minute; if (now >= P.at - 30 && now <= P.at + 75) return { act: 'wedding', b: P.chapel }; }
      return _plan.call(this, pp); }; }
    const base = O.NpcActs.apply;
    O.NpcActs.apply = function (s, q, a, main) {
      if (a && a.do === 'court') return court(s, q);
      if (a && a.do === 'betroth') return betroth(s, q, a);
      if (a && a.do === 'set_wedding') return reschedule(s, q, a);
      if (a && a.do === 'wedding_guest') return guest(s, q, a);
      if (a && a.do === 'part') return part(s, q);
      return base.apply(this, arguments);
    };
    O.Courtship = { partner, wed, court, betroth, part };
  }
  O.CourtshipSetup = { setup };
})();
