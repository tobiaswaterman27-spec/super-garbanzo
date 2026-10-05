// How the posts nobody hands you are won. No master gives a stranger the captaincy of the watch, the
// stewardship of the castle or the magistrate's chair: they are climbed to, given by a patron, earned by
// a deed, voted for, vowed into, or seized.
//   Ladders: guard, sergeant, captain of the watch; a vouched-for sergeant into the royal guard, and its
//     captain; maid, page or groom, butler, steward, chamberlain; clerk (once you have your letters), the
//     magistrate's chair; gaoler to executioner; the chapel's servants to the priesthood, and bishop.
//   Learning: study the books (in the chapel, the town hall, the steward's hall) or pay the priest.
//   Patrons: a royal who likes you asks you to attend them (lady-in-waiting, page); perform at the tavern
//     and the herald hears (jester); carry the crown's letters (herald); a quiet offer to the sly (spy);
//     masters of their craft sent for (master of horse).
//   Deeds: win the tournament, or fight for the crown in a war, and you're knighted; a knight of good
//     name may have a lordship at half the price.
//   Elections and vows: stand for reeve in any town you live in; take holy vows.
//   Seizing it: rise against the crown with a gang and lords behind you; be chosen by the council when the
//     royal line fails; blackmail an official out of their post with a letter you've found.
// The Business tab shows the Ways up from every post you hold, the castle gate posts the court's places
// and what each needs, and the herald or the steward will tell you.
'use strict';
(function () {
  const T = 16;
  // the climbs: from these posts, at this kind of place, given enough service, favour, learning and a clean name
  const LADDER = [
    { role: 'sergeant', at: ['guard'], from: ['guard', 'bounty hunter'], shifts: 8, like: 0.15, clean: true },
    { role: 'guard captain', at: ['guard'], from: ['sergeant'], shifts: 10, like: 0.25, clean: true },
    { role: 'royal guard', at: ['palace'], from: ['sergeant', 'guard captain'], shifts: 6, vouch: 'royal guard', clean: true },
    { role: 'captain of the royal guard', at: ['palace'], from: ['royal guard'], shifts: 12, like: 0.3, clean: true },
    { role: 'butler', at: ['palace'], from: ['maid', 'page', 'groom', 'cook', 'scullion'], shifts: 8, like: 0.2 },
    { role: 'master cook', at: ['palace'], from: ['cook'], shifts: 8, like: 0.15 },
    { role: 'steward', at: ['palace', 'keep'], from: ['butler', 'clerk', 'maid', 'groom', 'cook'], shifts: 10, like: 0.3, learning: 0.3 },
    { role: 'chamberlain', at: ['palace'], from: ['steward'], shifts: 12, like: 0.35, learning: 0.45 },
    { role: 'magistrate', at: ['townhall'], from: ['clerk', 'bailiff'], shifts: 10, like: 0.2, learning: 0.5, clean: true },
    { role: 'executioner', at: ['palace'], from: ['gaoler', 'turnkey'], shifts: 6 },
    { role: 'priest', at: ['chapel', 'church'], from: ['bell-ringer', 'parish clerk', 'gravedigger', 'pilgrim guide'], shifts: 6, learning: 0.35, clean: true, vows: true },
    { role: 'bishop', at: ['chapel', 'church'], from: ['priest'], shifts: 25, like: 0, learning: 0.6, clean: true, rep: 0.4, capital: true },
    { role: 'knight', at: ['keep'], from: null, knight: true },
  ];
  const PATRON = ['lady-in-waiting', 'page', 'jester', 'herald', 'spy', 'master of horse', 'falconer'];
  const PRESTIGE = new Set([...LADDER.map((l) => l.role), ...PATRON]);
  O.Careers = { LADDER, PRESTIGE };

  function setup(game, npcUI) {
    const PS = O.PlayerState, cur = () => O.SimRef.cur, say = (t, k) => O.UI.say(t, k), esc = (t) => O.escape(String(t)), G = O.Data.GOODS;
    const posts = () => (O.Employment ? O.Employment.posts() : []);
    const sex = () => O.Forge.player?.sex || O.Forge.player?.a?.sex || 'm';
    const capital = () => O.SimRef.home.kingdom.places.find((x) => x.kind === 'capital');
    const clean = () => (PS.wantedLevel ? PS.wantedLevel() === 0 : true) && PS.rep.guard >= -0.05 && !PS.exiled;
    const inGang = () => (O.GangLife && O.GangLife.mine().length > 0) || (cur().playerGang && cur().playerGang());
    PS.learning = PS.learning || 0;
    // ---------------------------------------------------------------- taking up a post you've earned
    function takePost(s, bz, role, why) {
      if (!O.roleFits(role)) return say(`Only a ${O.ROLE_SEX[role] === 'f' ? 'woman' : 'man'} can be ${role}.`, 'bad');
      const holder = bz.workers.map((id) => s.byId.get(id)).find((q) => q && q.job?.role === role && !s.vacancies(bz).includes(role));
      if (holder) { bz.workers = bz.workers.filter((id) => id !== holder.id); holder.job = null; s.remember(holder, `Gave up my post as ${role}; ${why || 'the stranger has it now'}.`, 'work', 2); s.relate(holder, { id: 0 }, -0.3); }
      for (const e of posts().filter((x) => x.place === s.world.placeId && x.biz === bz.id)) O.Employment.quit(null, e);
      O.Employment.hire(s, bz, s.bossOf(bz), role, Math.max(5, bz.def.wage?.[role] || 8));
      if (PS.emp) PS.emp.firstDay = 0;
      s.log(`The stranger is now ${role} at ${bz.name}.`, 'politics');
      say(`You are made ${role} at ${bz.name}.`);
    }
    O.takeEarnedPost = takePost;
    const bizOfType = (s, types) => [...s.biz.values()].find((z) => types.includes(z.type) || (types.includes('palace') && z.b?.royal && z.type === 'palace')) || null;
    // what a step needs, and whether you have it
    function needs(L, e) {
      const s = cur(), out = [];
      const es = e ? (O.Travel?.visited.get(e.place)?.sim || s) : s, boss = e && e.master != null && es.byId.get(e.master), like = boss ? (boss.rel.get(0)?.affinity || 0) : 0;
      if (L.from && e) out.push([`Serve as ${e.role} for ${L.shifts} shifts (${e.stats?.shifts || 0} so far)`, (e.stats?.shifts || 0) >= L.shifts]);
      if (L.like && e) out.push([`${boss ? boss.first : 'Your master'} must think well of you`, like >= L.like]);
      if (L.learning) out.push([`Learning enough (${Math.round(PS.learning * 100)} of ${Math.round(L.learning * 100)}): study the books, or lessons from the priest`, PS.learning >= L.learning]);
      if (L.clean) out.push(['A clean name: nobody looking for you, the watch not against you', clean()]);
      if (L.vouch) out.push([`A ${L.vouch} to vouch for you (ask one who likes you)`, !!(PS.vouched || {})[L.role]]);
      if (L.vows) out.push(['Leave every gang: a priest takes vows (no gang, no marrying)', !inGang()]);
      if (L.knight) out.push(['Be knighted: win the tournament, or fight for the crown in a war', !!PS.knight]);
      if (L.rep) out.push(['Be well thought of across the realm', PS.rep.civilian >= L.rep]);
      if (L.capital) out.push(['Serve in the capital', s.world.placeId === capital()?.id]);
      return out;
    }
    O.waysUp = (e) => LADDER.filter((L) => L.from && L.from.includes(e.role)).map((L) => ({ L, need: needs(L, e) }));

    // ---------------------------------------------------------------- the Business tab: Ways up, and the other roads
    function waysHTML() {
      const s = cur(), rows = [];
      for (const [i, e] of posts().entries()) for (const { L, need } of O.waysUp(e)) {
        const ok = need.every((n) => n[1]), here = e.place === s.world.placeId;
        rows.push(`<tr><td><b>${esc(L.role)}</b> <small class="lbl">from ${esc(e.role)}</small><ul style="margin:2px 0 0 14px;padding:0">${need.map(([t, k]) => `<li style="list-style:none">${k ? '☑' : '☐'} ${esc(t)}</li>`).join('')}</ul></td><td>${ok ? (here ? `<button data-up="${i}:${L.role}">Ask for the post</button>` : '<small class="lbl">ask where you serve</small>') : ''}</td></tr>`);
      }
      const other = [
        ['Knighthood', PS.knight ? `You are ${sex() === 'f' ? 'Dame' : 'Sir'} ${O.Forge.player?.name || ''}.` : 'Win the spring tournament, or fight for the crown in a war (take the King\'s coin).'],
        ['A lordship', PS.knight ? 'As a knight of good name you may petition for a lordship at half the price (Holdings, P).' : 'Buy one from the crown (Holdings, P), or be knighted first and pay half.'],
        [sex() === 'f' ? 'Lady-in-waiting' : 'Page', 'Win the liking of one of the royal family; they may ask you to attend them.'],
        ['Jester', `Perform at the tavern or the fair (E by the hearth when you're not working). Performances so far: ${PS.performances || 0}.`],
        ['Herald', `Carry the crown's letters to other towns (the board at the castle gate). Letters carried: ${PS.lettersCarried || 0} of 4.`],
        ['Spy', 'Be sly (stealth), and not known for crime. Someone will be in touch.'],
        ['Master of horse', 'Become a fine horseman (ride, joust, work a stable).'],
        ['Reeve', 'Stand for reeve at the moot of a town you live in (below).'],
        ['Priest, then bishop', 'Serve the chapel (bell-ringer, parish clerk, gravedigger), learn, keep a clean name, take vows.'],
        ['The crown', 'Rise against it with a gang and lords behind you, or be chosen by the council if the royal line fails (be a knight or lord, well thought of, and campaign).'],
      ];
      return `<h3>Ways up</h3>${rows.length ? `<table><tbody>${rows.join('')}</tbody></table>` : '<p class="caption">No step up from the posts you hold. The other roads:</p>'}<table><tbody>${other.map(([a, b]) => `<tr><td><b>${esc(a)}</b></td><td><small>${esc(b)}</small></td></tr>`).join('')}</tbody></table>`;
    }
    O.careersHTML = () => waysHTML() + electionHTML() + seizeHTML();
    O.bindCareers = (r, reopen) => {
      r.querySelectorAll('[data-up]').forEach((b) => b.onclick = () => {
        const [i, role] = b.dataset.up.split(/:(.+)/); const e = posts()[+i], s = cur(), L = LADDER.find((x) => x.role === role);
        const bz = L.at.includes(s.biz.get(e.biz)?.type) ? s.biz.get(e.biz) : bizOfType(s, L.at);
        if (!bz) return say(`There's no ${L.at.join(' or ')} here for that post.`, 'bad');
        if (role === 'bishop') { e.role = 'bishop'; e.wage += 8; s.log('The stranger is raised to bishop.', 'politics'); say('You are raised to bishop. The mitre is heavy.'); return reopen(); }
        if (L.vows) PS.vows = true;
        takePost(s, bz, role, 'promoted over me'); reopen();
      });
      const st = r.querySelector('[data-stand]'); if (st) st.onclick = () => { const s = cur(); s.playerMoot = { day: s.day + 1 }; s.log(`The stranger will stand for reeve at a moot in the square tomorrow at five.`, 'politics'); for (const q of s.people) if (q.age >= 16 && Math.random() < 0.3) s.remember(q, 'The stranger is standing for reeve.', 'politics', 1, 0); say('You put your name forward. Be in the square tomorrow at five, and be liked.'); reopen(); };
      const cp = r.querySelector('[data-campaign]'); if (cp) cp.onclick = () => { if (PS.money < 50) return say('Gifts for the lords cost ₳50.', 'bad'); PS.money -= 50; PS.claim = (PS.claim || 0) + 1; say('Gifts and letters go out to the lords of the realm. They will remember your name if the line fails.'); reopen(); };
      if (O.bindRising) O.bindRising(r, reopen);
    };

    // ---------------------------------------------------------------- learning
    const studyAt = new Set(['chapel', 'church', 'townhall', 'stewardroom', 'castlechapel', 'library']);
    const prevStall = () => null; void prevStall;
    let hooked = false, prev = null;
    game.hooks.update.push(() => { if (hooked) return; hooked = true; prev = O.stallCandidate; O.stallCandidate = cand; });
    // indoors: study the books, perform for the room
    const prevScene = O.sceneCandidate;
    O.sceneCandidate = () => { const c = cand(); return c || (prevScene ? prevScene() : null); };
    function cand() {
      const sc = game.scene, p = game.player;
      if (sc) {
        // the books
        if (studyAt.has(sc.b.type) || sc.b.type === 'house' && sc.b.owner?.kind === 'player') for (const it of sc.L.items) if (it.kind === 'bookcase' || it.kind === 'altar' || (it.kind === 'desk' && studyAt.has(sc.b.type))) { const [x, y] = sc.anchor(it), d = Math.hypot(x - p.x, y + 10 - p.y); if (d < 30) return { type: 'custom', label: it.kind === 'altar' ? 'Read from the great Bible (an hour)' : 'Study the books (an hour)', act: study, d: d + 2, x, y: y - 40 }; }
        // the tavern's hearth: perform
        if (sc.b.type === 'tavern' && !(O.Employment?.here()?.onShift)) { const f = sc.L.items.find((i) => i.kind === 'fireplace') || sc.L.items.find((i) => i.kind === 'bar'); if (f) { const [x, y] = sc.anchor(f), d = Math.hypot(x - p.x, y + 26 - p.y); if (d < 30) return { type: 'custom', label: 'Perform for the room', act: perform, d: d + 3, x, y: y - 40 }; } }
      } else {
        // the castle gate's board of court positions
        const s = cur(); for (const b of s.world.buildings) { if (!(b.royal || b.type === 'keep') || b.doorX == null) continue; const x = b.doorX * T + 8 + 30, y = b.doorY * T + 6, d = Math.hypot(x - p.x, y - p.y); if (d < 22) return { type: 'custom', label: 'Read the notices of court positions', act: () => courtBoard(s, b), d: d + 4, x, y: y - 30 }; }
        if (O.Festivals && O.Festivals.today(s) === 'fair') { const sq = s.Z.square; if (sq && p.x / T > sq[0] && p.x / T < sq[2] && p.y / T > sq[1] && p.y / T < sq[3] && !(O.interactTarget && O.interactTarget.type === 'npc')) { /* performing at the fair: from the tavern too */ } }
      }
      return game.scene ? null : prev ? prev() : null;
    }
    function study() {
      const s = cur(); if ((PS.studiedAt || -1) === s.day * 24 + Math.floor(s.hour)) return say('Your eyes need a rest. Another hour, later.');
      PS.studiedAt = s.day * 24 + Math.floor(s.hour);
      const gain = 0.035 * (1 - PS.learning * 0.6); PS.learning = Math.min(1, PS.learning + gain);
      for (let k = 0; k < 30; k++) { s.tick(2); PS.tick(2, true); }
      say(`An hour over the books: Latin, letters and the reckoning of accounts. Learning ${Math.round(PS.learning * 100)}.`);
    }
    function perform() {
      const s = cur(), sc = game.scene; if ((PS.performedAt || -1) === s.day * 24 + Math.floor(s.hour)) return say('The room has had enough of you for one hour.');
      PS.performedAt = s.day * 24 + Math.floor(s.hour);
      const k = (PS.skills.performing = Math.min(1, (PS.skills.performing || 0.05) + 0.06)), crowd = sc ? sc.actors.size : 0;
      const tips = crowd ? Math.round(crowd * (0.3 + k)) : 0; PS.money += tips; PS.performances = (PS.performances || 0) + 1;
      if (sc) for (const a of sc.actors.values()) s.relate(a.person, { id: 0 }, 0.02 + k * 0.03);
      game.player.anim = 'celebrate'; setTimeout(() => { if (game.player.anim === 'celebrate') game.player.anim = 'idle'; }, 1600);
      say(crowd ? `You sing, juggle and tell a bawdy tale. ${k > 0.5 ? 'The room roars.' : k > 0.25 ? 'A few laugh.' : 'Some pity you.'} ₳${tips} in your cap.` : 'You perform to an empty room. Practice, at least.');
    }
    // ---------------------------------------------------------------- the priest's lessons, vouching, and asking about the court
    const prevExtra = npcUI.extraButtons, prevOn = npcUI.onExtra;
    npcUI.extraButtons = (q) => {
      const out = prevExtra ? prevExtra(q) : [], r = q.job?.role || '';
      if (/priest|chaplain/.test(r)) out.push(['lessons', 'Lessons in letters (₳4)']);
      if (/royal guard|captain of the royal guard/.test(r) && posts().some((e) => ['sergeant', 'guard captain'].includes(e.role)) && !(PS.vouched || {})['royal guard']) out.push(['vouch', 'Would you vouch for me to the royal guard?']);
      if (/herald|steward|chamberlain/.test(r)) out.push(['court', 'What would it take to serve at court?']);
      const sec = (PS.secrets || []).find((x) => x.place === cur().world.placeId && x.id === q.id); if (sec) out.push(['blackmail', 'I have a letter of yours...']);
      return out;
    };
    npcUI.onExtra = (q, key, render) => {
      const s = cur();
      if (key === 'lessons') { if (PS.lessonDay === s.day) return render('"Enough for today. Come back tomorrow."'); if (PS.money < 4) return render('"Four aurins, child. The Church must eat."'); PS.money -= 4; PS.lessonDay = s.day; PS.learning = Math.min(1, PS.learning + 0.06 * (1 - PS.learning * 0.5)); s.relate(q, { id: 0 }, 0.05); return render(`"Again: the letters, then the psalter." An hour of letters. Learning ${Math.round(PS.learning * 100)}.`); }
      if (key === 'vouch') { const aff = q.rel.get(0)?.affinity || 0; if (aff < 0.35) return render('"I hardly know you. Earn it first."'); (PS.vouched = PS.vouched || {})['royal guard'] = true; return render('"Aye. I\'ll put your name to the captain. Don\'t make a fool of me."'); }
      if (key === 'court') return render(`"The court takes no one off the street. A maid, a page or a groom may rise to butler and steward, and a steward with learning to chamberlain. The royal guard takes sergeants of the watch, if one of us vouches. The family choose their own pages and ladies. We have a jester when one is good enough to be talked of, and a herald who has carried the crown's letters faithfully. Read the notices at the gate."`);
      if (key === 'blackmail') return blackmail(s, q);
      return prevOn && prevOn(q, key, render);
    };
    // the posts the court doesn't give to the first who asks
    O.prestigeRefusal = (role) => PRESTIGE.has(role) ? `"${role[0].toUpperCase() + role.slice(1)}? That's not a post for someone who walks in off the street. Look at the ways up (Business, B)."` : null;

    // ---------------------------------------------------------------- the castle gate: positions at court, and the crown's letters
    function courtBoard(s, keep) {
      const bz = s.biz.get(keep.id), roles = bz ? bz.def.jobs.map(([r]) => r) : [];
      const holders = (r) => bz ? bz.workers.map((id) => s.byId.get(id)).filter((q) => q && q.job?.role === r).map((q) => q.first) : [];
      const rows = roles.map((r) => { const vac = bz && s.vacancies(bz).includes(r), L = LADDER.find((x) => x.role === r); return `<tr><td><b>${esc(r)}</b>${vac ? ' <span class="warn">wanted</span>' : ''}</td><td><small>${holders(r).join(', ') || 'none'}</small></td><td><small>${esc(L ? (L.from ? `from ${L.from.join(', ')}` : L.knight ? 'a knight' : '') : PRESTIGE.has(r) ? 'by the family\'s choice or the crown\'s' : 'ask the steward')}</small></td></tr>`; }).join('');
      const towns = O.SimRef.home.kingdom.places.filter((x) => x.id !== s.world.placeId && ['town', 'city', 'port', 'castle'].includes(x.kind));
      const t = towns[(s.day * 7) % Math.max(1, towns.length)];
      O.Panels.open('Positions at court', `<p class="speech">Pinned by the gate under the royal seal.</p><table><thead><tr><th>Post</th><th>Held by</th><th>How it's filled</th></tr></thead><tbody>${rows}</tbody></table>${t && keep.royal ? `<p>Wanted: a trusty hand to carry the crown's letters to ${esc(t.name)}. ₳20 on delivery to its town hall or castle.</p><div class="topics"><button data-courier="${t.id}" ${PS.contract ? 'disabled' : ''}>Carry the letters</button></div>` : ''}`, (r) => {
        const c = r.querySelector('[data-courier]'); if (c) c.onclick = () => { const tp = O.SimRef.home.kingdom.places.find((x) => x.id === c.dataset.courier); PS.contract = { kind: 'courier', place: tp.id, target: tp.id, reward: 20, text: `Carry the crown's letters to ${tp.name}`, until: s.day * 1440 + s.minute + 1440 * 6 }; PS.add && PS.add('letter'); O.Panels.close(); say(`You take the sealed letters for ${tp.name}. Deliver them to its town hall, castle or watch house.`); };
      });
    }
    game.hooks.update.push(() => {
      const s = cur(), C = PS.contract; if (!C || C.kind !== 'courier' || s.world.placeId !== C.place || !game.scene) return;
      if (!['townhall', 'keep', 'guard', 'palace'].includes(game.scene.b.type) && !game.scene.b.royal) return;
      PS.money += C.reward; PS.lettersCarried = (PS.lettersCarried || 0) + 1; PS.rep.guard = Math.min(1, PS.rep.guard + 0.05); PS.remove && PS.remove('letter'); PS.contract = null;
      say(`You hand over the crown's letters. ₳${C.reward} paid. (${PS.lettersCarried} carried.)`);
    });
    // the board drawn by the castle gate
    game.hooks.drawWorld.push((ctx, cam) => {
      if (game.scene) return; const s = cur();
      for (const b of s.world.buildings) { if (!(b.royal || b.type === 'keep') || b.doorX == null) continue; const x = Math.round(b.doorX * T + 8 + 30 - cam.x), y = Math.round(b.doorY * T - 2 - cam.y); if (x < -20 || y < -40 || x > game.vw + 20 || y > game.vh + 20) continue;
        ctx.fillStyle = '#4a3220'; ctx.fillRect(x - 1, y - 8, 2, 10); ctx.fillStyle = '#7a1a2a'; ctx.fillRect(x - 9, y - 24, 18, 16); ctx.fillStyle = '#c8a040'; ctx.fillRect(x - 9, y - 24, 18, 1); ctx.fillRect(x - 9, y - 9, 18, 1); ctx.fillStyle = '#efe6cc'; ctx.fillRect(x - 6, y - 21, 5, 8); ctx.fillRect(x + 1, y - 21, 5, 8); ctx.fillStyle = '#a8382f'; ctx.fillRect(x - 4, y - 15, 2, 2); ctx.fillRect(x + 3, y - 15, 2, 2); }
    });

    // ---------------------------------------------------------------- patrons: offers that come to you
    function offer(role, from, text) {
      if ((PS.offered || {})[role]) return; (PS.offered = PS.offered || {})[role] = true;
      O.UI.dialog.open({ name: from, color: '#7a1a2a', text, options: [{ key: 'y', label: 'Accept' }, { key: 'n', label: 'Decline' }], onPick: (k) => { O.UI.dialog.close(); if (k !== 'y') return say('You send your regrets.'); PS.appointment = role; const cap = capital(); O.addLead && cap && O.addLead({ place: cap.id, b: -1, until: 1e12, why: 'appointment', label: `Your appointment as ${role} at the castle` }); say(`You accept. Present yourself at the castle in ${cap ? cap.name : 'the capital'} to take up the post.`); } });
    }
    let ck = 0;
    game.hooks.update.push((dt) => {
      ck -= dt; if (ck > 0 || O.panelOpen || (O.UI.dialogOpen && O.UI.dialogOpen())) return; ck = 5;
      const s = cur(); if (!s || s.hour < 9 || s.hour > 19) return;
      // an appointment taken up when you reach the castle
      if (PS.appointment) { const keep = s.world.buildings.find((b) => b.royal), bz = keep && s.biz.get(keep.id); if (bz) { const role = PS.appointment; PS.appointment = null; O.dropLead((l) => l.why === 'appointment'); takePost(s, bz, role, 'the crown chose another'); } }
      if (posts().some((e) => O.crownPost && O.crownPost(e.role))) return;
      const royals = s.people.filter((q) => q.royal && q.alive !== false), fond = royals.find((q) => (q.rel.get(0)?.affinity || 0) >= 0.5);
      if (fond && PS.rep.civilian >= 0.1 && clean()) offer(sex() === 'f' ? 'lady-in-waiting' : 'page', `${fond.title || ''} ${fond.first}`, `${fond.title || ''} ${fond.first} has taken a liking to you, and asks that you attend at court as ${sex() === 'f' ? 'a lady-in-waiting' : 'a page'}.`);
      if ((PS.performances || 0) >= 6 && (PS.skills.performing || 0) >= 0.4) offer('jester', 'The herald', '"Word of your tales and tumbling has reached the castle. The court has need of a fool. Will you come?"');
      if ((PS.lettersCarried || 0) >= 4 && clean()) offer('herald', 'The chamberlain', '"You have carried the crown\'s letters faithfully. The court would have you as its herald."');
      if ((PS.skills.stealth || 0) >= 0.45 && PS.rep.criminal < 0.15 && clean()) offer('spy', 'A letter with no name', '"Quiet feet and a clean name are rare. The crown pays well for ears in the right places. Burn this."');
      if (Math.max(PS.skills.horsemanship || 0, PS.skills.riding || 0) >= 0.6) offer('master of horse', 'The chamberlain', '"Your way with horses is talked of. The royal stables want a master. Will you take it?"');
      // war service makes a knight
      if (!PS.knight && (PS.warWon || 0) >= 1 && (PS.warFought || 0) >= 2) knight(s, 'for service in the war');
    });
    function knight(s, why) {
      PS.knight = true; const title = sex() === 'f' ? 'Dame' : 'Sir'; PS.title = title;
      O.UI.dialog.open({ name: 'The herald', color: '#7a1a2a', text: `"Kneel." The flat of a sword on each shoulder. "Arise, ${title} ${O.Forge.player?.name || ''}!" You are knighted ${why}.`, options: [{ key: 'ok', label: 'Rise' }], onPick: () => O.UI.dialog.close() });
      s.log(`The stranger has been knighted ${why}.`, 'politics'); PS.rep.civilian = Math.min(1, PS.rep.civilian + 0.1);
    }
    O.knightPlayer = (why) => { if (!PS.knight) knight(cur(), why); };

    // ---------------------------------------------------------------- the reeve's moot, in any town you live in
    const livesHere = (s) => (PS.lease && PS.lease.place === s.world.placeId) || s.world.buildings.some((b) => b.owner?.kind === 'player' && ['house', 'townhouse', 'mansion', 'farmhouse', 'cottage'].includes(b.type));
    function electionHTML() {
      const s = cur(), reeve = (PS.reeveOf || {})[s.world.placeId];
      if (reeve) return `<h3>Reeve of ${esc(s.world.name)}</h3><p class="caption">You hold the office. Its powers are under Holdings (P).</p>`;
      if (!livesHere(s)) return '';
      if (s.playerMoot) return `<h3>The moot</h3><p class="caption">You stand for reeve of ${esc(s.world.name)} at the moot on day ${s.playerMoot.day} at five, in the square. Be there, and be liked.</p>`;
      return `<h3>The moot</h3><div class="topics"><button data-stand="1" ${clean() ? '' : 'disabled'}>Stand for reeve of ${esc(s.world.name)}</button></div>`;
    }
    game.hooks.update.push(() => {
      const s = cur(), M = s && s.playerMoot; if (!M || s.day < M.day || s.hour < 17) return;
      s.playerMoot = null; const sq = s.Z.square, p = game.player, there = !game.scene && sq && p.x / T >= sq[0] - 2 && p.x / T <= sq[2] + 2 && p.y / T >= sq[1] - 2 && p.y / T <= sq[3] + 2;
      if (!there) { say('The moot met without you, and chose another. You have to be there.', 'bad'); return; }
      const voters = s.people.filter((q) => q.age >= 18 && !q.visitor); let yes = 0;
      for (const q of voters) if ((q.rel.get(0)?.affinity || 0) * 0.8 + PS.rep.local * 0.4 + PS.rep.civilian * 0.2 + (Math.random() - 0.55) * 0.5 > 0) yes++;
      const won = yes > voters.length / 2;
      O.UI.dialog.open({ name: 'The moot', color: '#5a3a1a', text: `Hands are raised in the square. ${yes} for you, ${voters.length - yes} for the other. ${won ? `You are Reeve of ${s.world.name}!` : 'You lose. Make more friends, and stand again.'}`, options: [{ key: 'ok', label: 'Go on' }], onPick: () => O.UI.dialog.close() });
      if (won) { (PS.reeveOf = PS.reeveOf || {})[s.world.placeId] = true; if (s === O.SimRef.home) { PS.reeve = true; s.reeveId = 'player'; } s.log(`The moot has chosen the stranger as Reeve of ${s.world.name}.`, 'politics'); }
    });

    // ---------------------------------------------------------------- seizing it: rebellion and succession
    function seizeHTML() {
      if (O.crowned && O.crowned()) return '';
      let h = O.risingHTML ? O.risingHTML() : '';
      if (PS.knight || PS.lord) h += `<h3>A claim to the crown</h3><p class="caption">If the royal line fails, the council of the realm chooses. Gifts to the lords keep your name before them (favour: ${PS.claim || 0}).</p><div class="topics"><button data-campaign="1">Send gifts to the lords (₳50)</button></div>`;
      return h;
    }
    // the council chooses when the line fails
    const K = O.SimRef.home.kingdom, _succeed = K.succeed.bind(K);
    K.succeed = function () {
      const lost = !this.heirStore || Math.random() < 0.12;
      const eligible = (PS.knight || PS.lord) && PS.rep.civilian >= 0.3 && clean();
      if (lost && eligible && Math.random() < 0.15 + (PS.claim || 0) * 0.12 + PS.rep.civilian * 0.3) {
        this.heirStore = null; this.addNews('The royal line has failed. The council of the realm has chosen a new monarch: the stranger whose name was before every lord.', 'rulers');
        setTimeout(() => O.UI.dialog.open({ name: 'The council of the realm', color: '#7a1a2a', text: '"The line has failed, and the lords have chosen. Will you take the crown?"', options: [{ key: 'y', label: 'Take the crown' }, { key: 'n', label: 'Refuse it' }], onPick: (k) => { O.UI.dialog.close(); if (k === 'y') O.takeAnyPost('monarch'); else _succeed(); } }), 50);
        return;
      }
      return _succeed();
    };

    // ---------------------------------------------------------------- blackmail
    O.Data.GOODS.secret = O.Data.GOODS.secret || { name: 'Compromising letter', base: 0, slots: 1, quest: true };
    O.foundSecret = (s, hh) => { // called when you go through an official's things
      const q = hh.members.map((id) => s.byId.get(id)).find((x) => x && O.upright && O.upright(s, x) && x.job); if (!q || Math.random() > 0.3) return null;
      (PS.secrets = PS.secrets || []).push({ place: s.world.placeId, id: q.id, role: q.job.role }); PS.add && PS.add('secret');
      return `Among the papers: a letter that ${q.name} would very much not want read aloud.`;
    };
    function blackmail(s, q) {
      const sec = PS.secrets.find((x) => x.place === s.world.placeId && x.id === q.id);
      npcUI.closeTalk();
      O.UI.dialog.open({ name: q.first, color: '#4a2a2a', text: `You show ${q.first} the letter. ${q.sex === 'f' ? 'She' : 'He'} goes white. "What do you want?"`, options: [...(O.roleFits(sec.role) ? [{ key: 'post', label: `Your post as ${sec.role}. Step aside for me.` }] : []), { key: 'coin', label: '₳30, and it burns' }, { key: 'none', label: 'Nothing. Yet.' }], onPick: (k) => {
        O.UI.dialog.close(); if (k === 'none') return;
        const calls = Math.random() < (k === 'post' ? 0.3 : 0.2);
        PS.secrets = PS.secrets.filter((x) => x !== sec); PS.remove && PS.remove('secret');
        if (calls) { const cr = s.recordCrime({ kind: 'blackmail', perp: 'player', placeName: s.world.name, tile: [Math.floor(game.player.x / T), Math.floor(game.player.y / T)], seen: [q], victimPerson: q, severity: 3 }); PS.crimes.push(cr.id); return say(`${q.first} calls your bluff and goes to the watch.`, 'bad'); }
        if (k === 'coin') { const hh = s.household(q), n = Math.min(30, Math.floor(hh.money)); hh.money -= n; PS.money += n; s.relate(q, { id: 0 }, -0.8); return say(`${q.first} pays ₳${n}, and hates you for it.`); }
        const bz = s.biz.get(q.job.biz); if (!bz) return say('Their post is gone already.');
        s.relate(q, { id: 0 }, -1); takePost(s, bz, sec.role, 'for reasons I will not speak of');
      } });
    }
  }
  O.CareersSetup = { setup };
})();
