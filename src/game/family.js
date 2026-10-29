// Children of your own. Married, in time you're expecting; the child is born into your household and
// takes after you both. Your husband or wife asks what to call the baby and you answer in your own
// words; the child grows up knowing who you are.
'use strict';
(function () {
  function setup(game) {
    const PS = O.PlayerState, cur = () => O.SimRef.cur, Ch = O.Char;
    const spec = () => (O.Forge && O.Forge.spec && O.Forge.spec()) || { sex: 'm', age: 27, surname: '' };
    const spouseIn = (s) => { const p = PS.partner; if (!p || p.stage !== 'married' || p.place !== s.world.placeId) return null; const q = s.byId.get(p.id); return q && q.alive !== false ? q : null; };
    const kids = () => (PS.children = PS.children || []);
    const youGenes = () => { const a = O.Forge && O.Forge.player; return (a && a.genes) || Ch.randomGenes(O.RNG(7), 'south'); };

    // a new day: perhaps a child on the way, perhaps one born
    { const SP = O.Sim.prototype, _nd = SP.newDay; SP.newDay = function () {
      const r = _nd.apply(this, arguments);
      if (this !== cur()) return r;
      const q = spouseIn(this); if (!q) return r;
      const E = PS.expecting;
      if (E && E.place === this.world.placeId && this.day >= E.due) { PS.expecting = null; born(this, q); return r; }
      if (!E) { const mumAge = spec().sex === 'f' ? spec().age : q.age; if (mumAge >= 18 && mumAge <= 42 && kids().length < 6 && Math.random() < 0.025) { PS.expecting = { place: this.world.placeId, due: this.day + 20, since: this.day }; this.remember(q, 'We are to have a child.', 'life', 3, 0); } }
      return r; }; }

    function born(s, q) {
      const hh = s.household(q); if (!hh) return;
      const sex = Math.random() < 0.5 ? 'm' : 'f', youF = spec().sex === 'f';
      const sur = youF ? q.sur : (spec().surname || q.sur);
      const genes = Ch.inheritGenes(s.rng, q.genes, youGenes());
      const c = s.newPerson({ sex, age: 0, first: s.rng.pick(O.Data.NAMES[sex]), sur, household: hh.id, home: q.home, genes, wealth: 0.4 });
      c.name = `${c.first} ${c.sur}`; c.birthday = ((s.day - 1) % 56) + 1; c.parents = [q.id]; c.playerChild = true; c.unnamed = true;
      c.app = Ch.makeAppearance(O.hash('person', c.id, c.first), { sex, age: 0, genes, role: 'child', wealth: 0.4 });
      c.agent = { x: q.agent.x, y: q.agent.y, dir: 0, anim: 'idle', ft: 0, a: c.app, hidden: true, inside: q.home, path: null, goal: null, person: c };
      c.activity = { act: 'home', b: q.home };
      hh.members.push(c.id); (q.children = q.children || []).push(c.id);
      kids().push({ place: s.world.placeId, id: c.id });
      q._askName = c.id; s.remember(q, `Our ${sex === 'm' ? 'son' : 'daughter'} was born.`, 'life', 3, c.id);
      s.log(`A ${sex === 'm' ? 'son' : 'daughter'} was born to ${q.first} and the newcomer.`, 'life');
      O.UI.say(`Your ${sex === 'm' ? 'son' : 'daughter'} is born.`);
    }
    // naming: whatever you say, if your spouse agrees
    function nameChild(s, q, a) {
      const id = q._askName ?? kids().map((k) => k.id).reverse().find((id0) => { const c = s.byId.get(id0); return c && c.unnamed; });
      const c = id != null && s.byId.get(id); const nm = String(a.name || '').trim().split(/\s+/)[0].replace(/[^A-Za-z'-]/g, ''); if (!c || !nm || nm.length > 14) return null;
      const first = nm[0].toUpperCase() + nm.slice(1).toLowerCase();
      if (O.Names) { O.Names.release(c.first, c.sur); const [f, su] = O.Names.claim(c.sex, first, c.sur, s.rng, true); c.first = f; c.sur = su; } else c.first = first;
      c.name = `${c.first} ${c.sur}`; c.unnamed = false; q._askName = null; O.Char.invalidate && c.app && O.Char.invalidate(c.app);
      return `Your ${c.sex === 'm' ? 'son' : 'daughter'} is named ${c.first}.`;
    }
    // what they know of it, for their cards
    O.familyLine = (s, q) => {
      const sp = spouseIn(s), out = [];
      if (sp === q) {
        if (PS.expecting && PS.expecting.place === s.world.placeId) out.push(`You and the player are expecting a child, due ${(() => { const n = Math.max(0, PS.expecting.due - s.day); return n === 0 ? 'any day now' : n === 1 ? 'tomorrow' : 'in ' + n + ' days'; })()}.`);
        const ch = kids().filter((k) => k.place === s.world.placeId).map((k) => s.byId.get(k.id)).filter(Boolean);
        if (ch.length) out.push(`Your children with the player: ${ch.map((c) => `${c.unnamed ? 'a baby not yet named' : c.first} (${c.age})`).join(', ')}.`);
        if (q._askName != null) out.push('The baby has no name yet: ask the player what to call them, and when they give a name you like, name_child.');
      }
      if (q.playerChild && q.age >= 3) out.push(`The player is your ${spec().sex === 'f' ? 'mother' : 'father'}.`);
      return out.join(' ');
    };
    // the spouse asks, when next you meet
    let at = 0;
    game.hooks.update.push((dt) => { at -= dt; if (at > 0) return; at = 3; const s = cur(); if (!s) return; const q = spouseIn(s); if (!q || q._askName == null || q._asked === s.day) return;
      const near = game.scene ? game.scene.actors.has(q.id) : !q.agent.hidden && Math.hypot(q.agent.x - game.player.x, q.agent.y - game.player.y) < 70;
      if (near && O.npcUI && !O.npcUI.talking() && !O.panelOpen) { q._asked = s.day; const c = s.byId.get(q._askName); O.npcUI.startFrom(q, `Our ${c && c.sex === 'f' ? 'daughter' : 'son'} needs a name. What shall we call ${c && c.sex === 'f' ? 'her' : 'him'}?`); } });
    const base = O.NpcActs.apply;
    O.NpcActs.apply = function (s, q, a, main) { if (a && a.do === 'name_child') return nameChild(s, q, a); return base.apply(this, arguments); };
    O.Family = { born, nameChild };
  }
  O.FamilySetup = { setup };
})();
