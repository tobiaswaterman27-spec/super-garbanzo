// More of the world's life, and more to do in it.
// - Recipes are learned: the everyday ones anyone grown can show you, the trade's own only those who work it.
// - Champions: challenge someone to a duel to first blood, or a match at the butts or the wrestling ring;
//   win often and you're a champion, and your name goes round the realm with it.
// - Eyes and ears: pay someone to be your informant and a letter comes each week with what they've heard:
//   the houses' plotting, a rising brewing, a siege, a gang's work, who bears you a grudge.
// - The Great Pestilence: very rarely, a sickness runs through the whole land.
// - When someone with money dies, their heirs quarrel over it; you can be asked to witness, to settle it,
//   or to put in a claim yourself.
// - The year's own feast days, kept here and nowhere else: Seedwake, Fireleap, Hob's Eve, Wending Day,
//   Lanternmas and Brightfast, each with what people do and want that day.
// - Your village: on the map, with its own market day.
'use strict';
(function () {
  const T = 16;
  // the feast days of Eldoria's year: [season, day of season, name, what's done, from, to, effect]
  const FEASTS = [
    ['spring', 3, 'Seedwake', 'the fields are blessed: a procession to the edge of town with green boughs, and seed thrown for luck', 9, 13],
    ['summer', 7, 'Fireleap', 'bonfires in the square at dusk, and the young leap the flames for luck in love', 18, 23],
    ['autumn', 4, "Hob's Eve", 'masks and turnip lanterns, and children go door to door for apples and mischief', 17, 21],
    ['autumn', 13, 'Wending Day', 'old debts are paid and quarrels made up; it is ill luck to carry a grudge past sunset', 10, 18],
    ['winter', 3, 'Lanternmas', 'a lantern in every window and small gifts given, and the long night kept with songs', 16, 22],
    ['winter', 12, 'Brightfast', 'a fast day: no meat sold or eaten till sundown, then bread and honey for all', 6, 19],
  ];
  function setup(game) {
    const PS = O.PlayerState, cur = () => O.SimRef.cur, say = (t, k) => O.UI.say(t, k), clamp = O.clamp, G = () => O.Data.GOODS;
    const relOf = (q) => { const r = q.rel.get(0) || { affinity: 0, familiar: 0 }; q.rel.set(0, r); return r; };
    const SPEC = () => (O.Forge && O.Forge.spec && O.Forge.spec()) || {};

    // ---------------------------------------------------------------- recipes taught
    const R = () => O.Recipes;
    const canTeach = (q, rc) => { if (!R() || q.age < 14) return false; if (R().UNIVERSAL.has(rc[0])) return q.age >= 18; const re = R().TEACH[rc[3]]; return !!(re && re.test(q.job?.role || '')); };
    const teachable = (q) => (R() ? R().all().filter((rc) => !R().known(rc[0]) && canTeach(q, rc)) : []);
    function teach(s, q, a) {
      const want = String(a.recipe || '').toLowerCase(), list = teachable(q); if (!list.length) return null;
      const rc = list.find((x) => x[0].toLowerCase().includes(want) || want.includes(x[0].toLowerCase().split(' ').slice(-1)[0])) || list[0];
      (PS.recipes = PS.recipes || []).push(rc[0]); O.gesture && O.gesture(q, 'point', 2); relOf(q).familiar = Math.min(1, (relOf(q).familiar || 0) + 0.05);
      return `${q.first} shows you how: ${rc[0].toLowerCase()}. You'll need ${Object.entries(rc[1]).map(([g, n]) => `${n} ${(G()[g]?.name || g).toLowerCase()}`).join(', ')}, at ${((st) => (/^[aeiou]/.test(st) ? 'an ' : 'a ') + (st === 'fireplace' ? 'hearth' : st))(Object.entries(R().RECIPES).find(([, l]) => l.includes(rc))?.[0] || 'bench')}.`;
    }

    // ---------------------------------------------------------------- champions: duels and matches
    function duel(s, q, a) {
      const kind = /archery|butt|bow/.test(String(a.kind || '')) ? 'archery' : /wrestl/.test(String(a.kind || '')) ? 'wrestling' : 'duel';
      const stake = clamp(Math.round(Number(a.stake) || 0), 0, 200); if (PS.money < stake) return `You haven't ₳${stake} to stake.`;
      const P = game.player, sk = (PS.skills && (kind === 'archery' ? PS.skills.archery : PS.skills.fighting)) || 0.2;
      const mine = sk + ((PS.hp || 60) / 200) + Math.random() * 0.8, theirs = (/guard|knight|soldier|squire|sergeant/.test(q.job?.role || '') ? 0.6 : 0.3) + (q.age > 18 && q.age < 45 ? 0.2 : 0) + Math.random() * 0.8;
      const anim = kind === 'archery' ? 'point' : 'attack';
      O.gesture && O.gesture(q, anim, 3); P.anim = anim; P.ft = 0; setTimeout(() => { if (P.anim === anim) P.anim = 'idle'; }, 2600);
      const won = mine > theirs; const hh = s.household(q);
      if (stake) { if (won && hh && hh.money >= stake) { hh.money -= stake; PS.money += stake; } else if (!won) { PS.money -= stake; if (hh) hh.money += stake; } }
      PS.wins = PS.wins || {}; PS.wins[kind] = (PS.wins[kind] || 0) + (won ? 1 : 0);
      PS.skills = PS.skills || {}; const key = kind === 'archery' ? 'archery' : 'fighting'; PS.skills[key] = Math.min(1, (PS.skills[key] || 0) + 0.01);
      if (kind === 'duel' && !won) PS.hp = Math.max(10, (PS.hp || 60) - 12);
      relOf(q).affinity = clamp(relOf(q).affinity + (won ? -0.02 : 0.04), -1, 1);
      if (won && PS.wins[kind] === 5) { PS.champion = Object.assign(PS.champion || {}, { [kind]: s.day }); s.log(`The stranger is the champion of ${kind === 'duel' ? 'the sword' : kind} in ${s.world.name}: five bouts and never bested.`, 'event'); }
      return won ? `You best ${q.first} at ${kind === 'duel' ? 'swords, to first blood' : kind}${stake ? ` and take the ₳${stake}` : ''}.` : `${q.first} bests you at ${kind === 'duel' ? 'swords, to first blood' : kind}${stake ? `, and the ₳${stake} is theirs` : ''}.`;
    }

    // ---------------------------------------------------------------- eyes and ears
    const informants = () => (PS.informants = PS.informants || []);
    function inform(s, q, a) { if (informants().some((x) => x.id === q.id) || q.age < 14) return null; const pay = clamp(Math.round(Number(a.pay) || 3), 1, 20); informants().push({ id: q.id, name: q.first, place: s.world.placeId, pay, since: s.day }); return `${q.first} will keep their ears open for you, for ₳${pay} a week.`; }
    let wk = -1;
    game.hooks.update.push(() => {
      const H = O.SimRef.home; if (!H || !informants().length) return; const w = Math.floor(H.day / 7); if (w === wk) return; const first = wk < 0; wk = w; if (first) return;
      const K = H.kingdom, news = [];
      for (const I of informants().slice()) {
        if (PS.money < I.pay) { PS.informants = informants().filter((x) => x !== I); say(`${I.name} stops sending word: you didn't pay.`, 'bad'); continue; }
        PS.money -= I.pay;
        const plots = (PS.plots2 || []).filter((p) => !p.done).length, houses = K.houses ? Object.values(K.houses).filter((h) => Object.values(h.stance).includes('feud')).map((h) => h.name).slice(0, 2) : [];
        const brewing = K.places.filter((p) => (p.happiness ?? 0.5) < 0.28 && p.kind !== 'capital').map((p) => p.name).slice(0, 2);
        const sieges = (K.conflicts || []).filter((c) => !c.done && c.kind === 'siege').map((c) => K.place(c.b)?.name).filter(Boolean);
        const s = O.Travel?.visited.get(I.place)?.sim || H, grudges = s.people.filter((p) => p.grudge && p.grudge.level > 0.3).map((p) => p.first).slice(0, 3);
        const gang = (s.gangs || []).find((g) => g.id !== 'player' && g.purse > 100);
        const lines = [houses.length ? `${houses.join(' and ')} are at feud and hiring swords.` : '', brewing.length ? `There's angry talk in ${brewing.join(' and ')}: a rising wouldn't surprise me.` : '', sieges.length ? `${sieges.join(', ')} still holds out under siege.` : '', gang ? `${gang.name} are flush with coin and planning more of their night work.` : '', grudges.length ? `Watch out for ${grudges.join(', ')}: they've no love for you.` : '', plots ? 'Your own business with the great houses is talked of in low voices.' : ''].filter(Boolean);
        const text = lines.length ? lines.join(' ') : 'All quiet this week. Nothing worth the ink.';
        (PS.letters = PS.letters || []).push({ from: I.name, text, day: H.day, place: s.world.name }); news.push(I.name);
      }
      if (news.length) say(`Word comes in from ${news.join(' and ')}: a letter of what they've heard (read it in your letters).`);
    });

    // ---------------------------------------------------------------- the Great Pestilence (rare)
    let pd = -1;
    game.hooks.update.push(() => {
      const s = cur(); if (!s || pd === s.day) return; const first = pd < 0; pd = s.day; if (first) return;
      const H = O.SimRef.home, K = H.kingdom;
      if (!K.greatPest && Math.random() < 0.0015) { K.greatPest = { since: H.day, until: H.day + 18 }; K.addNews && K.addNews('THE GREAT PESTILENCE. A sickness out of the south runs from town to town. Doors are chalked, carts go round for the dead, and the bells toll every day.', 'health'); say('The Great Pestilence has come to Eldoria.', 'bad'); }
      if (K.greatPest && H.day > K.greatPest.until) { K.addNews && K.addNews('The Great Pestilence is passing. Those who are left go back to the fields, and hands are scarce: wages rise.', 'health'); K.greatPest = null; K.afterPest = H.day + 40; }
      if (K.greatPest) { s.quarantine = s.quarantine || { since: s.day }; for (const p of s.people) if (!p.health.illness && !p.visitor && Math.random() < 0.025) s.fallIll && s.fallIll(p, 'pestilence', 0.3); }
    });

    // ---------------------------------------------------------------- the will, and the heirs who quarrel over it
    { const SP = O.Sim.prototype, _die = SP.die;
      SP.die = function (p, cause) {
        const hh = this.household(p), rich = hh && hh.money > 120 && p.age >= 40;
        const r = _die.apply(this, arguments);
        if (rich && this === O.SimRef.cur) {
          const kids = (p.children || []).map((id) => this.byId.get(id)).filter((z) => z && z.alive !== false && z.age >= 16);
          if (kids.length >= 2 && Math.random() < 0.7) {
            (this.wills = this.wills || []).push({ id: p.id, name: p.name, estate: Math.round(hh.money * 0.6), heirs: kids.map((z) => z.id), day: this.day, settled: false });
            for (const z of kids) { (z.beliefs = z.beliefs || []).unshift({ t: `${p.first}'s will is in dispute between ${kids.map((x) => x.first).join(' and ')}.`, src: 'life', day: this.day }); for (const y of kids) if (y !== z) this.relate(z, y, -0.25); }
            this.log(`${p.name}'s heirs ${kids.map((x) => x.first).join(' and ')} are quarrelling over the estate: ₳${Math.round(hh.money * 0.6)} and the house.`, 'life');
          }
        }
        return r;
      }; }
    function settle(s, q, a) {
      const W = (s.wills || []).find((w) => !w.settled && w.heirs.includes(q.id)); if (!W) return null;
      const to = O.NpcActs.personFor(s, a.to) || q; const fee = Math.round(W.estate * 0.1);
      W.settled = true; const winner = W.heirs.includes(to.id) ? to : q; const hh = s.household(winner); if (hh) hh.money += W.estate - fee; PS.money += fee;
      for (const id of W.heirs) { const z = s.byId.get(id); if (!z) continue; if (z === winner) { relOf(z).affinity = clamp(relOf(z).affinity + 0.3, -1, 1); } else O.grudge && O.grudge(s, z, `you settled my father's will against me`, 0.35); }
      s.log(`The stranger settled ${W.name}'s will: the estate goes to ${winner.name}.`, 'life');
      return `You settle ${W.name}'s will in ${winner.first}'s favour, and take ₳${fee} for your trouble.`;
    }
    function claim(s, q) { const W = (s.wills || []).find((w) => !w.settled && w.heirs.includes(q.id)); if (!W || relOf(q).affinity < 0.6) return null; W.settled = true; const share = Math.round(W.estate * 0.3); PS.money += share; for (const id of W.heirs) { const z = s.byId.get(id); if (z && z !== q) O.grudge && O.grudge(s, z, 'you took a share of our father\'s estate', 0.5); } return `${q.first} names you in their claim, and a third of the estate, ₳${share}, comes to you.`; }

    // ---------------------------------------------------------------- the feast days
    const feastToday = (s) => { const W = s.weather; if (!W) return null; return FEASTS.find(([se, d]) => s.season === se && W.dayOfSeason === d) || null; };
    O.feastToday = feastToday;
    const SP = O.Sim.prototype, _plan = SP.plan;
    SP.plan = function (p) {
      const F = feastToday(this); if (F && !p.task && !p.visitor && p.age >= 4 && this.hour >= F[4] && this.hour < F[5] && (p.id % 3 !== 0 || p.age < 16)) { const a = _plan.call(this, p); if (!a || a.act !== 'work' || p.id % 2) return { act: 'festival', outdoor: true, zone: 'square', feast: F[2] }; return a; }
      return _plan.call(this, p);
    };
    let fd = -1, fx = 0;
    game.hooks.update.push((dt) => {
      const s = cur(); if (!s || !s.weather) return; const F = feastToday(s);
      if (fd !== s.day) { fd = s.day; if (F) say(`Today is ${F[2]}: ${F[3]}.`); const w = s.world; w.props = w.props.filter((p) => !p.feast); if (F && F[2] === 'Fireleap' && s.Z && s.Z.square) { const [x0, y0, x1, y1] = s.Z.square; for (let i = 0; i < 3; i++) w.props.push({ kind: 'firepit', x: (x0 + 3 + i * 4) * T + 8, y: (y0 + 2) * T + 15, seed: i, v: 0, solid: false, feast: true }); w.dirtyStatics = true; } if (F && F[2] === 'Wending Day') { for (const p of s.people) if (p.grudge && Math.random() < 0.5) p.grudge.level *= 0.4; } }
      fx -= dt; if (fx > 0 || !F || game.scene || s.hour < F[4] || s.hour >= F[5]) return; fx = 3;
      const P = game.player, near = s.people.filter((q) => q.activity?.feast && !q.agent.hidden && Math.hypot(q.agent.x - P.x, q.agent.y - P.y) < 220);
      const q = near[Math.floor(Math.random() * near.length)]; if (!q) return;
      const anim = { Fireleap: 'celebrate', Seedwake: 'pray', "Hob's Eve": 'laugh', 'Wending Day': 'nod', Lanternmas: 'dance', Brightfast: 'pray' }[F[2]] || 'dance';
      O.gesture && O.gesture(q, anim, 2.5);
      if (Math.random() < 0.3 && O.Speech) O.Speech.say(q, { Fireleap: 'Over the fire, for luck!', Seedwake: 'Bless the seed and the furrow.', "Hob's Eve": 'Apples, or a trick!', 'Wending Day': 'No grudges past sunset.', Lanternmas: 'A light for the long night.', Brightfast: 'Not long till honey bread.' }[F[2]], 2.5);
    });
    // a fast day: no meat bought
    { const _need = SP.shoppingNeed; SP.shoppingNeed = function (hh) { const n = _need.call(this, hh); const F = feastToday(this); if (n && F && F[2] === 'Brightfast' && n.good === 'meat') return null; return n; }; }

    // ---------------------------------------------------------------- your village, on the map, with a market day
    let mapped = false;
    game.hooks.update.push(() => {
      if (mapped || !O.openMap) return; mapped = true; const _o = O.openMap;
      O.openMap = () => { _o(); const v = PS.village, cv = document.getElementById('kmap'), wrap = cv && cv.parentElement, E = O.Eldoria; if (!v || !wrap || !E) return; const K = O.SimRef.home.kingdom, pl = K.place(v.place); if (!pl) return; const m = document.createElement('span'); m.className = 'maplabel city'; m.textContent = v.name; m.style.left = (pl.x / E.W * 100 + 1.4) + '%'; m.style.top = ((pl.y + 1.6) / E.H * 100) + '%'; wrap.appendChild(m); };
    });
    let md = -1;
    game.hooks.update.push(() => {
      const s = cur(), v = PS.village; if (!s || !v || s.world.placeId !== v.place || md === s.day) return; md = s.day; const w = s.world;
      w.props = w.props.filter((p) => !p.villageMarket);
      if (s.weekday === 2) { for (let i = 0; i < 3; i++) { const x = v.cx - 4 + i * 4, y = v.cy + 3; if (!w.solid[y * w.W + x]) w.props.push({ kind: 'stall', x: x * T + 8, y: y * T + 14, seed: i, v: i % 4, solid: false, villageMarket: true }); } say(`It's market day in ${v.name}: stalls are up by the signpost.`); }
      w.dirtyStatics = true;
    });

    // ---------------------------------------------------------------- the acts, and what people know
    // ---------------------------------------------------------------- small things to do together
    const together = (q, anim, secs = 2.6) => { O.gesture && O.gesture(q, anim, secs); const P = game.player; P.anim = anim; P.ft = 0; setTimeout(() => { if (P.anim === anim) P.anim = 'idle'; }, secs * 1000); };
    function danceWith(s, q) { together(q, 'dance', 4); relOf(q).affinity = clamp(relOf(q).affinity + 0.05, -1, 1); return null; }
    function prayWith(s, q) { together(q, 'pray', 3); PS.rep.civilian = Math.min(1, (PS.rep.civilian || 0) + 0.005); return null; }
    function embrace(s, q) { if (relOf(q).affinity < 0.4) return null; together(q, 'celebrate', 2); relOf(q).affinity = clamp(relOf(q).affinity + 0.04, -1, 1); return null; }
    function playGame(s, q, a) {
      const stake = clamp(Math.round(Number(a.stake) || 1), 0, 50), kind = /merel|morris/.test(String(a.kind || '')) ? "nine men's morris" : /chess/.test(String(a.kind || '')) ? 'chess' : 'dice';
      if (PS.money < stake) return `You haven't ₳${stake}.`; const hh = s.household(q); if (stake && (!hh || hh.money < stake)) return `${q.first} hasn't the coin for that stake.`;
      together(q, 'shake', 2.4); const won = Math.random() < (kind === 'dice' ? 0.5 : 0.45 + ((PS.skills && PS.skills.letters) || 0) * 0.3);
      if (stake) { if (won) { hh.money -= stake; PS.money += stake; } else { PS.money -= stake; hh.money += stake; } }
      relOf(q).familiar = Math.min(1, (relOf(q).familiar || 0) + 0.05);
      return won ? `You win at ${kind}${stake ? `, ₳${stake} to you` : ''}.` : `${q.first} wins at ${kind}${stake ? `, and takes your ₳${stake}` : ''}.`;
    }
    function teachSong(s, q) { const k = (q.songs || []).find((id) => !(PS.songs || []).includes(id)); if (!k) return null; (PS.songs = PS.songs || []).push(k); const sg = (PS.songBook || []).find((x) => x.id === k); return sg ? `You learn "${sg.title}" from ${q.first}.` : null; }
    // the townsfolk at their own games: dice in the tavern of an evening
    let dg = 0;
    game.hooks.update.push((dt) => {
      dg -= dt; if (dg > 0) return; dg = 18 + Math.random() * 12; const s = cur(); if (!s || !game.scene || (s.hour < 18 && s.hour > 1)) return;
      const b = game.scene.b; if (b.type !== 'tavern' && (s.biz.get(b.id) || {}).type !== 'tavern') return;
      const there = [...game.scene.actors.values()].map((a) => a.person).filter((z) => z && z.age >= 16 && !(O.npcUI && O.npcUI.talking() === z)); if (there.length < 2) return;
      const [x, y] = there.sort(() => Math.random() - 0.5); O.gesture && O.gesture(x, 'shake', 2); setTimeout(() => { O.gesture && O.gesture(y, Math.random() < 0.5 ? 'laugh' : 'shrug', 2); }, 1200);
      O.Speech && O.Speech.say(x, ['Sevens! Pay up.', 'Come on, come on...', 'Double sixes, by God!', 'Your throw.'][Math.floor(Math.random() * 4)], 2.5);
      const hx = s.household(x), hy = s.household(y); if (hx && hy && hy.money > 2) { hy.money -= 1; hx.money += 1; }
    });
    const A = { teach_recipe: teach, duel, inform, settle_will: settle, claim_will: claim, dance_with: danceWith, pray_with: prayWith, embrace, play_game: playGame, teach_song: teachSong };
    const base = O.NpcActs.apply;
    O.NpcActs.apply = function (s, q, a, main) { if (a && A[a.do]) return A[a.do](s, q, a); return base.apply(this, arguments); };
    (O.extraActs = O.extraActs || []).push('teach_recipe {"recipe"} (you show the player how to make something you know)', 'duel {"kind":"duel"|"archery"|"wrestling","stake"?} (you accept or make a challenge)', 'inform {"pay"} (you agree to be the player\'s eyes and ears, for a weekly sum)', 'settle_will {"to"} (an heir in a quarrel over a will agrees to let the player settle it)', 'claim_will (an heir who loves the player names them in their claim)', 'dance_with | pray_with | embrace (you do it together with the player, if you are willing)', 'play_game {"kind":"dice"|"merels"|"chess","stake"} (a game with the player)', 'teach_song (you teach the player a song you know)');
    (O.extraLines = O.extraLines || []).push((s, q) => {
      const out = [], t = teachable(q).slice(0, 4).map((x) => x[0].toLowerCase()); if (t.length) out.push(`You know how to ${t.join('; ')}, and could show the player (teach_recipe).`);
      const F = feastToday(s); if (F) out.push(`Today is ${F[2]}, a feast day: ${F[3]}.`); else { const next = FEASTS.find(([se, d]) => s.season === se && d > (s.weather?.dayOfSeason || 0)); if (next) out.push(`${next[2]} is coming, on day ${next[1]} of ${next[0]}.`); }
      const W = (s.wills || []).find((w) => !w.settled && w.heirs.includes(q.id)); if (W) out.push(`Your late parent ${W.name}'s estate (₳${W.estate}) is in dispute between the heirs. You might ask the player to settle it (settle_will), or name them in your claim if you trust them (claim_will).`);
      if (informants().some((x) => x.id === q.id)) out.push('You are the player\'s informant, paid by the week to pass on what you hear.');
      const champ = PS.champion && Object.keys(PS.champion); if (champ && champ.length) out.push(`The player is known as a champion (${champ.join(', ')}).`);
      const K = O.SimRef.home.kingdom; if (K.greatPest) out.push('The Great Pestilence is in the land: everyone is afraid.');
      if (PS.marks) { const best = Object.entries(PS.marks).sort((a, b) => b[1].sold - a[1].sold)[0]; if (best && best[1].sold >= 10) out.push(`The player's mark is known on their ${(G()[best[0]]?.name || best[0]).toLowerCase()}: good work, folk say.`); }
      return out.join(' ');
    });
    // a few more menus asked for in words
    { const npcUI = O.npcUI, prevB = npcUI.extraButtons, prevOn = npcUI.onExtra;
      npcUI.extraButtons = (q) => { const out = prevB ? prevB(q) : []; if (/guard captain|sergeant/.test(q.job?.role || '')) out.push(['bounties', 'Any bounties posted?']); if (/innkeeper/.test(q.job?.role || '')) out.push(['hiredwork', 'Any hired work going?']); return out; };
      npcUI.onExtra = (q, key, render) => { if (key === 'bounties' && O.openBoard) { npcUI.closeTalk(); return O.openBoard('watch'); } if (key === 'hiredwork' && O.openBoard) { npcUI.closeTalk(); return O.openBoard('tavern'); } return prevOn && prevOn(q, key, render); }; }
  }
  O.WorldLifeSetup = { setup, FEASTS };
})();
