// What your life weighs in the town.
// - Folk see more than one side of you: honest or light-fingered, open-handed or tight, godly or not,
//   someone to fear or not, good at your trade or not, and how well-off. K shows it, with your skills
//   by rank; the people you talk to know it too.
// - Your skills come on by ranks (novice, apprentice, journeyman, master) and you're told when they do.
// - Gossip about you is said out loud: walk past two people talking and you may hear your own name.
// - Your house says who you are: visitors look about and remark on it (a tapestry, a dirty floor, a
//   sword hung up, a bare room), and those you talk to there take it in.
// - Your habits are noticed: be in the same place of an evening three days running and people know
//   where to find you, and so does anyone who'd like your house empty.
// - Old people remember: they talk of what happened here years since (fires, floods, reeves, hangings).
// - Families have stories, told to those who ask.
// - Friends are worth something: they come by with food when you're ill or hungry and penniless, and
//   they notice when you've stopped coming round.
// - Give a false name and that's the name they know you by, and say back to you.
// - Foxes take hens left out at night unless a dog keeps the yard.
'use strict';
(function () {
  const T = 16;
  const RANKS = [[0.75, 'master'], [0.5, 'journeyman'], [0.25, 'apprentice'], [0.08, 'novice']];
  const rankOf = (v) => (RANKS.find(([t]) => v >= t) || [0, null])[1];
  const SKILL_WORDS = { woodcraft: 'woodcraft', baking: 'baking', smithing: 'smithing', serving: 'cooking and serving', physic: 'physic', milling: 'milling', crafting: 'handwork', butchery: 'butchery', foraging: 'foraging', farming: 'farming', fishing: 'fishing', hunting: 'hunting', archery: 'the bow', swordplay: 'the sword', fighting: 'fighting', letters: 'letters', music: 'music', riding: 'riding', haggling: 'haggling', stealth: 'going unseen', lockpicking: 'locks', persuasion: 'talking folk round' };
  function setup(game) {
    const PS = O.PlayerState, cur = () => O.SimRef.cur, say = (t, k) => O.UI.say(t, k);
    const life = () => (PS.life = PS.life || {});
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    const pname = () => (life().alias && life().aliasAll) || (O.Forge && O.Forge.player && O.Forge.player.name) || 'the stranger';
    const near = (q, r) => { const a = q.agent, p = game.player; return a && !a.hidden && Math.hypot(a.x - p.x, a.y - p.y) < r; };
    const hour = () => game.clock.minute / 60;

    // ---------------- the sides of you ----------------
    function standing() {
      const crimes = Array.isArray(PS.crimes) ? PS.crimes.length : (PS.crimes || 0);
      const honest = O.clamp(0.3 + (PS.rep.civilian || 0) * 0.4 - Math.min(1, crimes / 6) * 0.8 - (PS.rep.criminal || 0) * 0.5, -1, 1);
      const generous = O.clamp(((PS.almsToPoor || 0) / 30) + (PS.robbedRich ? 0.1 : 0) + ((life().gave || 0) / 20) - ((life().refused || 0) / 10), -1, 1);
      const godly = O.clamp((PS.confessed != null ? 0.2 : -0.1) + (PS.tithedWeek != null ? 0.3 : -0.1) + (PS.vows ? 0.5 : 0) + (PS.blessed != null ? 0.1 : 0) - (PS.excommunicated ? 1 : 0), -1, 1);
      const wins = Object.values(PS.wins || {}).reduce((a, b) => a + (+b || 0), 0);
      const feared = O.clamp((life().fights || 0) / 8 + wins / 10 + (PS.rep.criminal || 0) * 0.6 + (PS.champion ? 0.4 : 0), 0, 1);
      const sk = Object.entries(PS.skills || {}).sort((a, b) => b[1] - a[1])[0];
      const homes = Object.keys(PS.homes || {}).length + (PS.estate ? 2 : 0);
      const wealth = O.clamp(Math.log10(Math.max(1, PS.money || 0)) / 4 + homes * 0.1, 0, 1);
      return { honest, generous, godly, feared, trade: sk ? { k: sk[0], v: sk[1], rank: rankOf(sk[1]) } : null, wealth };
    }
    const words = (st) => {
      const w = [];
      w.push(st.honest > 0.35 ? 'honest' : st.honest < -0.2 ? 'light-fingered' : 'not yet known to be honest or otherwise');
      if (st.generous > 0.3) w.push('open-handed'); else if (st.generous < -0.2) w.push('tight-fisted');
      if (st.godly > 0.4) w.push('godly'); else if (st.godly < -0.3) w.push('no churchgoer');
      if (st.feared > 0.5) w.push('dangerous to cross'); else if (st.feared > 0.25) w.push('handy with their fists');
      if (st.trade && st.trade.rank && st.trade.v >= 0.25) w.push(`a ${st.trade.rank} at ${SKILL_WORDS[st.trade.k] || st.trade.k}`);
      w.push(st.wealth > 0.7 ? 'well-off' : st.wealth < 0.25 ? 'poor' : 'getting by');
      return w;
    };
    O.standing = standing; O.standingWords = () => words(standing());
    (O.extraLines = O.extraLines || []).push((s, q) => {
      if (q.age < 12) return '';
      const fam = (q.rel && q.rel.get(0) && q.rel.get(0).familiar) || 0;
      if (fam < 0.1 && Math.random() < 0.5) return '';
      return `What folk say of the player: ${words(standing()).join(', ')}.`;
    });
    // how folk see you, and your skills by rank
    function panel() {
      const st = standing(), esc = (x) => O.escape(String(x));
      const bar = (label, v, lo, hi) => `<div style="display:flex;justify-content:space-between;gap:12px"><span>${label}</span><b>${v > 0.35 ? hi : v < -0.2 ? lo : 'middling'}</b></div>`;
      const sk = Object.entries(PS.skills || {}).filter(([, v]) => v >= 0.02).sort((a, b) => b[1] - a[1]);
      O.Panels.open('How folk see you', `<div class="reps">${bar('Honesty', st.honest, 'light-fingered', 'honest')}${bar('Hand', st.generous, 'tight-fisted', 'open-handed')}${bar('Church', st.godly, 'no churchgoer', 'godly')}${bar('To cross', st.feared * 2 - 0.6, 'mild', 'dangerous')}${bar('Means', st.wealth * 2 - 0.8, 'poor', 'well-off')}</div>
        <div class="lbl" style="margin-top:10px">Your skills</div>${sk.length ? sk.map(([k, v]) => `<div style="display:flex;justify-content:space-between;gap:12px"><span>${esc(SKILL_WORDS[k] || k)}</span><b>${esc(rankOf(v) || 'a beginner')}</b></div>`).join('') : '<p class="caption">Nothing yet. Work, make things, and practise.</p>'}
        <p class="caption">${esc(life().alias ? `Some here know you as ${life().alias}.` : '')}</p>`);
    }
    game.keyHandlers.push((e) => { if (e.code === 'KeyK' && !e.ctrlKey && !e.metaKey && !O.panelOpen && !(O.UI.dialogOpen && O.UI.dialogOpen())) { panel(); return true; } return false; });

    // ---------------- skills come on by ranks ----------------
    let rt = 0;
    game.hooks.update.push((dt) => {
      rt -= dt; if (rt > 0) return; rt = 3;
      const L = life(), R = (L.ranks = L.ranks || {});
      for (const [k, v] of Object.entries(PS.skills || {})) {
        const r = rankOf(v); if (!r || R[k] === r) continue;
        const first = R[k] === undefined && v < 0.12;
        R[k] = r; if (first) continue;
        say(`Your ${SKILL_WORDS[k] || k} has come on: you're ${r === 'apprentice' ? 'an' : 'a'} ${r} at it now.`, 'good');
        O.sfx && O.sfx('handbell', 0.25);
        const s = cur(); s && s.log && s.log(`${pname()} is ${r === 'apprentice' ? 'an' : 'a'} ${r} at ${SKILL_WORDS[k] || k} now.`, 'life');
      }
    });

    // ---------------- talk about you, out loud ----------------
    let gt = 20;
    function aboutYou(s, q) {
      const D = (PS.deeds || []).filter((d) => s.day - (d.day || 0) < 8 && d.place === s.world.placeId);
      const L = life(), n = pname(), fam = (q.rel && q.rel.get(0) && q.rel.get(0).familiar) || 0, who = fam > 0.2 ? n.split(' ')[0] : 'that stranger';
      const lines = [];
      if (D.length) { const d = pick(D); lines.push(`Did you hear? ${d.t.replace(/\.$/, '')}.`); }
      const st = standing();
      if (st.honest < -0.2) lines.push(`Keep your purse close when ${who} is about.`);
      if (st.honest > 0.4) lines.push(`${who}? Straight as a die, that one.`);
      if (st.generous > 0.3) lines.push(`${who} gave to the poor again. Free with their coin.`);
      if (st.feared > 0.5) lines.push(`Don't cross ${who}. I've seen what happens.`);
      if (st.trade && st.trade.v >= 0.5) lines.push(`${who} knows their ${SKILL_WORDS[st.trade.k] || st.trade.k}. Good work, that.`);
      if (L.routine && L.routine.days >= 3) lines.push(`You'll find ${who} at ${L.routine.name} of an evening, regular as the bell.`);
      const home = s.world.buildings.find((b) => b.owner && b.owner.kind === 'player' && b.doorX != null);
      if (home && home.decor && (home.decor.wall === 'tapestry' || home.decor.wall === 'panel')) lines.push(`${who} has a ${home.decor.wall === 'tapestry' ? 'tapestry' : 'panelled room'} in that house, I hear. Getting above themselves.`);
      return lines.length ? pick(lines) : null;
    }
    game.hooks.update.push((dt) => {
      gt -= dt; if (gt > 0) return; gt = 25 + Math.random() * 25;
      const s = cur(); if (!s || game.scene || (O.npcUI && O.npcUI.talking && O.npcUI.talking())) return;
      const close = s.people.filter((q) => q.age >= 14 && q.activity?.act !== 'sleep' && near(q, 150) && !near(q, 26) && !q.agent.frozen);
      for (const a of close) {
        const b = close.find((x) => x !== a && Math.hypot(x.agent.x - a.agent.x, x.agent.y - a.agent.y) < 40);
        if (!b) continue;
        const line = aboutYou(s, a); if (!line) return;
        O.Speech.say(a, line, 4); setTimeout(() => { if (Math.random() < 0.7) O.Speech.say(b, pick(['Is that so.', 'Never!', 'So I heard.', 'Hush, they can hear you.', 'Well, well.']), 3); }, 2200);
        // they glance your way
        a.agent.dir = Math.abs(game.player.x - a.agent.x) > Math.abs(game.player.y - a.agent.y) ? (game.player.x > a.agent.x ? 2 : 1) : (game.player.y > a.agent.y ? 0 : 3);
        return;
      }
    });

    // ---------------- your house says who you are ----------------
    function houseNotes(b, sc) {
      const n = [], d = b.decor || {}, L = sc && sc.L;
      if (d.wall === 'tapestry') n.push('a tapestry on the wall'); if (d.wall === 'panel') n.push('oak panelling');
      if (d.floor === 'tiles') n.push('a tiled floor'); if (d.floor === 'rushes') n.push('fresh rushes on the floor');
      const pieces = L ? L.items.filter((i) => O.Data.FURN[i.kind] && !['stairs', 'roomdoor'].includes(i.kind)) : [];
      if (L && pieces.length <= 3) n.push('hardly a stick of furniture');
      if (L && pieces.some((i) => i.kind === 'bookcase')) n.push('a bookcase');
      if (L && pieces.filter((i) => i.kind === 'rug').length >= 2) n.push('rugs underfoot');
      const shown = (b.placedItems || []).map((x) => x.good);
      for (const g of shown) if (/sword|helm|shield|crown|ring|brooch|chalice|book/.test(g)) n.push(`${(O.Data.GOODS[g]?.name || g).toLowerCase()} set out to be seen`);
      const dirt = b.dirt || b.grime || 0; if (dirt > 0.5) n.push('a floor that wants sweeping');
      if ((b.yard || []).length) n.push(`a yard laid out with ${b.yard.length} thing${b.yard.length > 1 ? 's' : ''}`);
      return [...new Set(n)];
    }
    (O.extraLines = O.extraLines || []).push((s, q) => {
      const sc = game.scene; if (!sc || !(sc.b.owner && sc.b.owner.kind === 'player') && !(PS.lease && PS.lease.b === sc.b.id)) return '';
      const n = houseNotes(sc.b, sc); return n.length ? `You are in the player's own house. You notice ${n.join(', ')}.` : "You are in the player's own house.";
    });
    const REMARK = {
      'a tapestry on the wall': ['Is that a tapestry? My word.', 'A tapestry! Like a lord.'], 'oak panelling': ['Panelled, and all. Very fine.'], 'a tiled floor': ['Tiles! You must be doing well.'],
      'fresh rushes on the floor': ['Fresh rushes. Smells sweet in here.'], 'hardly a stick of furniture': ['You might get a chair or two.', 'Bare as a barn in here.'], 'a bookcase': ['All those books. Can you read them all?'],
      'rugs underfoot': ['Rugs underfoot. Soft.'], 'a floor that wants sweeping': ['Your floor wants a broom.', 'Mind, it could do with a sweep in here.'],
    };
    let vt = 5;
    game.hooks.update.push((dt) => {
      vt -= dt; if (vt > 0) return; vt = 6;
      const sc = game.scene; if (!sc || !(sc.b.owner && sc.b.owner.kind === 'player')) return;
      const notes = houseNotes(sc.b, sc); if (!notes.length) return;
      for (const a of sc.actors.values()) {
        const q = a.person; if (!q || q.age < 8 || q.activity?.act === 'sleep') continue;
        const L = life(), seen = (L.remarked = L.remarked || {}), key = q.id + ':' + sc.b.id; if (seen[key] && cur().day - seen[key] < 5) continue;
        const note = notes.find((x) => REMARK[x] || /set out to be seen/.test(x)); if (!note) continue;
        seen[key] = cur().day;
        O.Speech.say(q, REMARK[note] ? pick(REMARK[note]) : `Is that ${note.replace(' set out to be seen', '')}? Where did you come by that?`, 4);
        cur().remember && cur().remember(q, `Visited ${pname()}'s house: ${notes.slice(0, 3).join(', ')}.`, 'life', 0.3);
        return;
      }
    });

    // ---------------- habits noticed ----------------
    let ht = 0;
    game.hooks.update.push((dt) => {
      ht -= dt; if (ht > 0) return; ht = 10;
      const s = cur(); if (!s) return; const h = hour(); if (h < 18 || h > 22) return;
      const L = life(), ev = (L.evenings = L.evenings || {});
      const b = game.scene ? game.scene.b : null; if (!b || (b.owner && b.owner.kind === 'player')) return;
      const k = s.world.placeId + ':' + b.id; const r = ev[k] || (ev[k] = { days: 0, last: -1, name: b.name || 'the ' + b.type });
      if (r.last === s.day) return;
      r.days = r.last === s.day - 1 ? r.days + 1 : 1; r.last = s.day;
      if (r.days >= 3) { L.routine = { key: k, name: r.name, days: r.days, place: s.world.placeId }; if (r.days === 3) say(`You've been at ${r.name} three evenings running. People will know where to find you.`); }
    });
    // anyone wanting your house empty knows when it is
    const SP = O.Sim.prototype, _nd = SP.newDay;
    SP.newDay = function () {
      const r = _nd.apply(this, arguments);
      try {
        const L = life(), rt2 = L.routine;
        if (rt2 && this.day - (L.burgled || -99) > 10 && rt2.days >= 3 && Math.random() < 0.25) {
          const st = PS.homes || {}, key = Object.keys(st).find((k) => k.startsWith(this.world.placeId + ':') && (st[k] || []).length);
          if (key) { const lst = st[key], took = lst.splice(Math.floor(Math.random() * lst.length), 1)[0]; L.burgled = this.day; L.burgledNote = { day: this.day, took, key }; this.log(`Someone got into ${pname()}'s house while they were at ${rt2.name}, as they are every evening.`, 'crime'); }
        }
        if (L.routine && this.day - (L.evenings?.[L.routine.key]?.last ?? -9) > 2) L.routine = null;
      } catch (e) { console.error(e); }
      return r;
    };
    game.hooks.update.push(() => {
      const L = life(), n = L.burgledNote; if (!n || !game.scene) return;
      const s = cur(); if (n.key !== s.world.placeId + ':' + game.scene.b.id) return;
      L.burgledNote = null;
      say(`Someone has been in here. The ${(O.Data.GOODS[n.took]?.name || n.took).toLowerCase()} is gone. Whoever it was knew you'd be out.`, 'bad');
    });

    // ---------------- old people remember; families have stories ----------------
    (O.extraLines = O.extraLines || []).push((s, q) => {
      const out = [];
      if (q.age >= 55) {
        const old = (s.history || []).filter((h) => /fire|flood|plague|hanged|reeve|died|born|built|war|storm|famine|wedding|married/i.test(h.text) && s.day - h.day > 3);
        const m = old.length ? old.slice(0, 3).map((h) => h.text).join(' ') : '';
        const yrs = Math.max(20, q.age - 15);
        out.push(`You are old and remember this place over ${yrs} years: who built what, the hard winters, the old reeve before this one, a great fire when you were young. ${m ? 'Things you remember well: ' + m : ''} You like to tell of it if anyone listens.`);
      }
      const kin = [...(q.parents || []), ...((s.household(q)?.members) || [])].filter((id) => id !== q.id).map((id) => s.byId.get(id)).filter(Boolean).slice(0, 3);
      if (kin.length) out.push(`Family stories you know: ${kin.map((k) => `${k.first}${k.job ? ' the ' + k.job.role : ''}${k.alive === false ? ' (gone now)' : ''}`).join(', ')}; you tell them fondly or not, as they deserve.`);
      return out.join(' ');
    });

    // ---------------- friends are worth something ----------------
    let ft = 30;
    game.hooks.update.push((dt) => {
      ft -= dt; if (ft > 0) return; ft = 40;
      const s = cur(); if (!s || game.scene) return;
      const L = life(), needy = PS.ill || PS.injury || (PS.hunger < 25 && PS.money < 3) || PS.hp < 35;
      if (!needy || s.day === L.friendHelped) return;
      const f = s.people.filter((q) => q.age >= 14 && q.activity?.act !== 'sleep' && q.rel && (q.rel.get(0)?.affinity || 0) > 0.45 && q.agent && !q.agent.hidden && !q.job?.onShift).sort((a, b) => (b.rel.get(0).affinity) - (a.rel.get(0).affinity))[0];
      if (!f) return;
      L.friendHelped = s.day;
      const p = game.player, tile = [Math.floor(p.x / T), Math.floor(p.y / T) + 1];
      const go = () => {
        O.Speech.say(f, PS.ill || PS.injury ? 'I heard you were laid low. I brought you something.' : 'You look half-starved. Here, take this.', 4);
        const g = PS.ill ? 'stew' : 'bread'; const good = O.Data.GOODS[g] ? g : 'bread';
        setTimeout(() => { if (PS.add(good)) { O.NpcActs && O.NpcActs.fly && O.NpcActs.fly(f, 'player', good); say(`${f.first} gives you ${good === 'stew' ? 'a pot of stew' : 'a loaf'}, and won't take a coin for it.`, 'good'); s.remember(f, `Brought ${pname()} food when they were in need.`, 'life', 0.5); } }, 1500);
      };
      if (O.Errands && O.Errands.send && Math.hypot(f.agent.x - p.x, f.agent.y - p.y) > 40) O.Errands.send(s, f, tile, { anim: 'give', secs: 2, after: go, giveUp: 60 }); else go();
    });
    (O.extraLines = O.extraLines || []).push((s, q) => {
      const r = q.rel && q.rel.get(0); if (!r || (r.affinity || 0) < 0.45) return '';
      const L = life(), seen = (L.lastSeen = L.lastSeen || {}), k = s.world.placeId + ':' + q.id, last = seen[k]; seen[k] = s.day;
      return `The player is your friend; you'd help them if they were in need.${last != null && s.day - last > 8 ? ` You haven't seen them in ${s.day - last} days and you say so.` : ''}`;
    });

    // ---------------- false names ----------------
    const _say = O.AIChat && O.AIChat.say;
    if (_say) O.AIChat.say = function (q, text, render, opt) {
      if (q && typeof text === 'string') {
        const m = text.match(/\b(?:my name is|my name's|call me|i am called|i'm called|they call me|the name'?s)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i);
        if (m) { const nm = m[1].replace(/\b\w/g, (c) => c.toUpperCase()), L = life(), real = O.Forge && O.Forge.player && O.Forge.player.name; (L.names = L.names || {})[cur().world.placeId + ':' + q.id] = nm; if (real && !real.toLowerCase().startsWith(nm.toLowerCase())) L.alias = nm; }
        if (/\b(gave|give|here'?s) (you |them )?(a |some )?(coin|alms|aurin)/i.test(text)) life().gave = (life().gave || 0) + 1;
      }
      return _say.apply(this, arguments);
    };
    (O.extraLines = O.extraLines || []).push((s, q) => {
      const nm = (life().names || {})[s.world.placeId + ':' + q.id]; if (!nm) return '';
      const real = O.Forge && O.Forge.player && O.Forge.player.name, falseN = real && !real.toLowerCase().startsWith(nm.toLowerCase());
      return `The player told you their name is ${nm}; that is what you call them${falseN && PS.disguise ? ' (they were wearing a hood and mask at the time)' : ''}.`;
    });
    // fights count toward being feared
    const _hit = O.Combat && O.Combat.onHit;
    if (O.Combat && typeof _hit === 'function') O.Combat.onHit = function () { life().fights = (life().fights || 0) + 0.2; return _hit.apply(this, arguments); };

    // ---------------- foxes ----------------
    let fx = 0;
    game.hooks.update.push((dt) => {
      fx -= dt; if (fx > 0) return; fx = 30;
      const s = cur(); if (!s) return; const h = hour(); if (h > 4 && h < 21) return;
      const L = life(); if (L.foxDay === s.day) return;
      const hens = (O.fauna || []).filter((f) => f.owner === 'player' && f.kind === 'chicken' && f.world === s.world.placeId && f.mode !== 'heel');
      if (!hens.length || PS.dog || Math.random() > 0.12) return;
      L.foxDay = s.day; const f = pick(hens); O.fauna.splice(O.fauna.indexOf(f), 1);
      L.foxNote = { name: f.name, day: s.day };
      O.animalCall && near({ agent: { x: f.x, y: f.y } }, 300) && O.animalCall('chicken', 0.5);
    });
    game.hooks.update.push(() => { const L = life(), n = L.foxNote; if (!n || hour() < 6 || hour() > 20) return; L.foxNote = null; say(`A fox has had ${n.name ? n.name : 'one of your hens'} in the night. Feathers all over the yard. A dog would keep it off.`, 'bad'); });
  }
  O.LifeWeightSetup = { setup };
})();
