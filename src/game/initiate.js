// People speak first. Walk into a house uninvited and whoever is home comes up and tells you to go, and
// fetches the watch if you won't; a guest they expected is welcomed (the household was told you'd come).
// Out in the street friends call a greeting, someone who asked you for something wants to know if you
// brought it, stallholders cry their wares and children ask what children ask.
'use strict';
(function () {
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  function setup(game) {
    const cur = () => O.SimRef.cur, PS = O.PlayerState;
    const abs = (s) => s.day * 1440 + s.minute;
    const nameOf = (q) => (q.rel.get(0) || {}).name;
    // ---------------------------------------------------------------- your coming in at the door
    let intrusion = null; // { b, q, at, warned }
    O.Crime.onEnter = function (g, s, b) {
      if (!['house', 'farmhouse', 'cottage', 'townhouse', 'mansion', 'hovel', 'manor'].includes(b.type)) return;
      if (b.owner?.kind === 'player' || (PS.lease && PS.lease.b === b.id)) return;
      const inside = s.people.filter((q) => q.agent.inside === b.id && q.activity?.act !== 'sleep' && q.age >= 10);
      if (!inside.length) return;
      const invited = O.invitedTo && O.invitedTo(b);
      setTimeout(() => {
        if (!g.scene || g.scene.b.id !== b.id) return;
        const here = inside.filter((q) => g.scene.actors.has(q.id)).sort((x, y) => y.age - x.age);
        const host = here[0] || inside.sort((x, y) => y.age - x.age)[0], r = host.rel.get(0) || { affinity: 0, familiar: 0 }, fond = r.affinity > 0.4;
        if (!here.length) { // they're upstairs: a voice from above
          O.UI.say(`${host.first} calls from upstairs: "${invited || fond ? "Is that you? Come in, I'll be down." : "Who's there? Who's down there?"}"`, invited || fond ? '' : 'bad');
          if (!invited && !fond) intrusion = { b: b.id, q: host, at: abs(s), warned: false };
          return;
        }
        if (invited || fond) {
          const inviter = inside.find((q) => q.beliefs && q.beliefs.some((x) => /coming to the house/.test(x.t)));
          const line = invited && inviter && inviter !== host ? `Ah, you came! ${inviter.first} said you would. Come in.` : pick([`Come in, come in${nameOf(host) ? ', ' + nameOf(host) : ''}.`, 'Welcome. Mind the step.', 'There you are. Sit yourself down.']);
          if (!O.npcUI.startFrom(host, line)) O.Speech && O.Speech.say(host, line, 3);
          return;
        }
        s.relate(host, { id: 0 }, -0.08);
        s.remember(host, 'A stranger walked into our house uninvited.', 'player', 0.8, 0);
        for (const q of inside) if (q !== host) (q.beliefs = q.beliefs || []).unshift({ t: 'A stranger walked into the house uninvited.', src: 'saw', day: s.day });
        const harsh = host.traits.includes('hostile') || host.traits.includes('suspicious');
        const line = harsh ? pick(['Get out of my house!', 'Out! Who let you in?', 'What are you doing in here? Out!']) : pick(['Can I help you? This is a private house.', "Excuse me, you can't just walk in here.", 'Who are you? What do you want in my house?']);
        O.gesture && O.gesture(host, harsh ? 'shake' : 'point', 1.6);
        if (!O.npcUI.startFrom(host, line)) O.Speech && O.Speech.say(host, line, 3);
        intrusion = { b: b.id, q: host, at: abs(s), warned: false };
      }, 700);
    };
    // stay where you're not wanted and they lose patience: a warning, then the watch
    let it = 0;
    game.hooks.update.push((dt) => {
      it -= dt; if (it > 0) return; it = 1;
      const s = cur(); if (!intrusion) return;
      const sc = game.scene; if (!sc || (sc.b.parent || sc.b).id !== intrusion.b || O.invitedTo?.(sc.b)) { intrusion = null; return; }
      const q = intrusion.q, mins = abs(s) - intrusion.at, r = q.rel.get(0) || {};
      if ((r.affinity || 0) > 0.35) { intrusion = null; return; } // talked round
      if (!intrusion.warned && mins > 20) { intrusion.warned = true; const l = "I'll not tell you again. Get out, or I fetch the watch."; if (!O.npcUI.startFrom(q, l)) O.Speech && O.Speech.say(q, l, 3); return; }
      if (mins > 40 && !O.npcUI.talking()) {
        const b = s.building(intrusion.b), seen = s.people.filter((z) => z.agent.inside === intrusion.b && z.activity?.act !== 'sleep');
        const cr = s.recordCrime({ kind: 'trespass', perp: 'player', placeName: b?.name || 'a house', tile: [b.doorX, b.doorY], seen, victimPerson: q, severity: 1 });
        PS.crimes.push(cr.id); q.task = { act: 'report', b: s.guardId, crime: cr.id, woken: abs(s) + 120 };
        O.Speech && O.Speech.say(q, "Right. I'm fetching the watch!", 3, 'bad');
        intrusion = null;
      }
    });
    // an invitation is passed round the household, so nobody takes fright
    O.toldOfVisit = (s, q) => { const hh = s.household(q); if (!hh) return; for (const id of hh.members) { const z = s.byId.get(id); if (z && z !== q) (z.beliefs = z.beliefs || []).unshift({ t: `${q.first} says the ${nameOf(q) || 'stranger'} is coming to the house.`, src: 'friend', from: q.first, day: s.day }); } };

    // ---------------------------------------------------------------- the street speaks to you
    let at = 0; const greeted = new Map();
    game.hooks.update.push((dt) => {
      at -= dt; if (at > 0) return; at = 2.5;
      const s = cur(); if (!s || O.npcUI.talking() || O.panelOpen || O.UI.dialogOpen() || game.sleepState) return;
      const p = game.player, near = [];
      if (game.scene) { for (const a of game.scene.actors.values()) if (a.person && !a.hidden && !a.leaving && Math.hypot(a.x - p.x, a.y - p.y) < 70) near.push(a.person); }
      else for (const q of s.people) if (!q.agent.hidden && q.agent.inside == null && Math.hypot(q.agent.x - p.x, q.agent.y - p.y) < 70) near.push(q);
      const day = s.day;
      for (const q of near.sort(() => Math.random() - 0.5)) {
        if (q.agent.frozen || q.activity?.act === 'sleep' || q.age < 3) continue;
        const r = q.rel.get(0) || { affinity: 0, familiar: 0 }, k = q.id + ':' + day, gd = greeted.get(k) || 0;
        // someone who asked you for something
        if (q.wants && q.wants.until >= day && PS.items.includes(q.wants.g) && !(gd & 4)) { greeted.set(k, gd | 4); O.npcUI.startFrom(q, pick([`Did you bring the ${q.wants.name}?`, `Have you the ${q.wants.name} for me?`])); return; }
        // the one you're due to meet
        const m = (PS.meets || []).find((x) => x.who === q.id && x.state === 'set' && Math.abs(abs(s) - x.at) < 60);
        if (m && !(gd & 8)) { greeted.set(k, gd | 8); O.npcUI.startFrom(q, pick(['There you are!', 'You came!', "Ah, good. I'd wondered if you'd come."])); return; }
        // a friend calls a greeting
        if (r.affinity > 0.35 && r.familiar > 0.2 && !(gd & 1) && Math.random() < 0.6) { greeted.set(k, gd | 1); const h = s.hour; O.Speech && O.Speech.say(q, pick([`${h < 12 ? 'Morning' : h < 18 ? 'Good day' : 'Evening'}${r.name ? ', ' + r.name : ''}!`, `Well met${r.name ? ', ' + r.name : ''}!`, 'Hello again!']), 3); O.gesture && O.gesture(q, 'wave', 1.4); return; }
        // someone who dislikes you lets it show
        if (r.affinity < -0.4 && !(gd & 2) && Math.random() < 0.3) { greeted.set(k, gd | 2); O.Speech && O.Speech.say(q, pick(['Hmph.', 'You again.', "Don't you come near me."]), 2.5); return; }
        // a child's question
        if (q.age >= 5 && q.age < 11 && !(gd & 16) && Math.random() < 0.08) { greeted.set(k, gd | 16); O.Speech && O.Speech.say(q, pick(['Are you a knight?', 'Where are you from?', 'Have you got any sweets?', "What's your name?", 'Is that a real sword?']), 3); return; }
        // a stallholder or shopkeeper cries the wares
        const bz = q.job && s.biz.get(q.job.biz);
        if (bz && q.activity?.act === 'work' && bz.def.sells?.length && !(gd & 32) && Math.random() < 0.12) { const g = bz.def.sells.find((x) => (bz.stock[x] || 0) >= 1); if (g) { greeted.set(k, gd | 32); const nm = (O.Data.GOODS[g]?.name || g).toLowerCase(); O.Speech && O.Speech.say(q, pick([`Fresh ${nm}! Come and see!`, `${nm[0].toUpperCase() + nm.slice(1)}, the best in town!`, `Will you buy, friend? Good ${nm} here.`]), 3); return; } }
      }
    });
  }
  O.InitiateSetup = { setup };
})();
