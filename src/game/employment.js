// Holding down a job. Ask whoever runs a place for work (at work or not; they may say no). Once taken
// on you have a post, a wage, hours and a master. Your shift shows in the corner, and while you're on
// it so do your tasks: the real work of the trade, which takes time and keeps the place going. Bake
// the bread at the oven, keep its fire fed, fetch flour from the mill with the business's own money,
// serve whoever comes to the counter, sweep, patrol, hoe, fell, fish, carry, collect the tax...
// Come late and your master notices; miss a day and they mind more; send a letter if you can't come.
// Turn up and work well and you'll be put up a rank and paid more. Slack, and one day you'll find
// you don't work there any more, sometimes without anyone telling you.
'use strict';
(function () {
  const T = 16;
  function setup(game, home, npcUI) {
    const PS = O.PlayerState, D = O.Data, say = (t, k) => O.UI.say(t, k), cur = () => O.SimRef.cur;
    const now = (s) => s.day * 1440 + s.minute;
    // you may hold more than one post, as long as the hours don't clash (the potboy's evenings after a day's work)
    const posts = () => {
      if (!PS.posts) PS.posts = PS.emp ? [PS.emp] : [];
      if (PS.emp && !PS.posts.includes(PS.emp)) { const m = PS.posts.find((x) => x.place === PS.emp.place && x.biz === PS.emp.biz); if (m) PS.emp = m; else PS.posts.push(PS.emp); }
      return PS.posts;
    };
    const emp = () => (posts(), PS.emp || null);
    const here = () => { const pl = cur().world.placeId, ps = posts().filter((e) => e.place === pl); return ps.find((e) => e.onShift) || ps[0] || null; };
    const postAt = (s, bz) => posts().find((e) => e.biz === bz.id && e.place === s.world.placeId) || null;
    const bizOf = (e) => { const s = cur(); return e && e.place === s.world.placeId ? s.biz.get(e.biz) : null; };
    const COURT = new Set(['monarch', 'consort', 'heir', 'prince', 'princess', 'lord', 'lady', 'lady-in-waiting', 'jester', 'steward', 'chamberlain', 'captain of the royal guard']);
    O.crownPost = (r) => COURT.has(r);
    const hoursOf = (e, bz) => { const r = e.role || ''; if (COURT.has(r)) return [8, 20]; if (r === 'potboy' || r === 'potgirl') return [17, 21]; if (['night watchman', 'gaoler'].includes(r)) return [20, 30]; if (r.startsWith('guard') || r === 'sergeant') return [6, 18]; return bz ? bz.def.hours : [8, 17]; };
    const worksToday = (s, bz) => !(s.weekday === 6 && bz && !['tavern', 'chapel', 'guard', 'hospital', 'palace', 'keep', 'manor', 'posthouse'].includes(bz.type));
    // when the next shift is, worked out fresh from today's date (never left saying "tomorrow" once tomorrow has come)
    const nextShift = (e, s, bz, o, c) => {
      for (let k = 0; k < 8; k++) {
        if (s.day + k < (e.firstDay || 0)) continue;
        const wd = (s.weekday + k) % 7; if (wd === 6 && !(bz && ['tavern', 'chapel', 'guard', 'hospital', 'palace', 'keep', 'manor', 'posthouse'].includes(bz.type))) continue;
        if (k === 0 && s.hour >= c) continue;
        return k === 0 ? (s.hour >= o ? 'now' : 'today') : k === 1 ? 'tomorrow' : O.DAYNAMES[wd];
      }
      return 'tomorrow';
    };
    const fmtH = (h) => { h = ((h % 24) + 24) % 24; const hh = Math.floor(h), mm = Math.round((h - hh) * 60); return `${hh % 12 || 12}${mm ? ':' + String(mm).padStart(2, '0') : ''}${hh < 12 ? 'am' : 'pm'}`; };

    // ---------------------------------------------------------------- asking for work
    const prevExtra = npcUI.extraButtons, prevOn = npcUI.onExtra;
    npcUI.extraButtons = (q) => {
      const out = (prevExtra ? prevExtra(q) : []).filter(([k]) => k !== 'askwork' && k !== 'quit');
      const s = cur(), bz = q.job?.biz != null ? s.biz.get(q.job.biz) : null;
      // the high don't go asking for work: the crown, the court, a master with a business of their own
      const high = (O.crowned && O.crowned()) || posts().some((x) => COURT.has(x.role)) || (O.ownsBusiness && O.ownsBusiness());
      if (bz && s.bossOf && s.bossOf(bz) === q) {
        const e = postAt(s, bz);
        if (high && !e) return out;
        if (e) { out.push(['otherjob', 'Ask about other work here']); out.push(['notice', 'Hand in your notice']); }
        else if (O.knowsTrade && O.knowsTrade(q)) out.push(['askjob', `Ask for work at ${bz.name}`]);
      } else if (q.age >= 14 && !high) out.push(['whohires', "Who's taking on hands?"]);
      return out;
    };
    // anyone can tell you who is hiring: the place, who runs it, and what they want
    function whoHires(q) {
      const s = cur(), list = [];
      for (const bz of s.biz.values()) {
        const boss = s.bossOf && s.bossOf(bz); if (!boss || boss === q || boss.alive === false || postAt(s, bz)) continue;
        const v = s.vacancies(bz).filter((r) => (bz.def.wage[r] || 0) > 0); if (v.length) list.push({ bz, boss, role: v[v.length - 1] });
      }
      if (!list.length) return '"Nobody\'s short of hands that I know of. Try again in a few days."';
      // they know best the places near them and their own trade
      list.sort((a, b) => (a.bz.id === q.job?.biz ? -1 : 0) - (b.bz.id === q.job?.biz ? -1 : 0) || ((a.bz.id * 7 + q.id) % 13) - ((b.bz.id * 7 + q.id) % 13));
      const pick = list.slice(0, 3); PS.hiringLeads = pick.map((x) => x.boss.id); for (const x of pick) O.learnTrade && O.learnTrade(x.boss); O.addLead && O.addLead({ place: s.world.placeId, id: pick[0].boss.id, until: s.day * 1440 + s.minute + 240, why: 'work', label: `Ask ${pick[0].boss.first} for work` });
      return `"${pick.map((x, i) => `${i ? (i === pick.length - 1 ? 'and ' : '') : ''}${x.boss.first} at ${x.bz.name} wants ${/^[aeiou]/.test(x.role) ? 'an' : 'a'} ${x.role}`).join(', ')}. Go and ask ${pick.length > 1 ? 'them' : x0(pick)} yourself: talk to whoever runs the place."`;
    }
    const x0 = (p) => (p[0].boss.sex === 'f' ? 'her' : 'him');
    npcUI.onExtra = (q, key, render) => {
      if (key === 'whohires') return render(whoHires(q));
      if (key === 'askjob') return offer(q, render);
      if (key === 'otherjob') { // one post to a place: you can move to a different one there, not hold two
        const s = cur(), bz = s.biz.get(q.job.biz), e = postAt(s, bz), d = s.hireDecision(bz, q, 'player');
        if (!d.yes || d.role === e.role) return render(`"You've your place here already, as ${e.role}. Do it well and we'll see about more."`);
        npcUI.closeTalk && npcUI.closeTalk();
        O.Panels.open(`Other work at ${bz.name}`, `<p class="speech">“I could put you on as ${d.role} instead, at ₳${d.wage} a day. You'd give up being ${esc(e.role)}.”</p><div class="topics"><button data-y="1">Change to ${esc(d.role)}</button><button data-n="1">Stay as I am</button></div>`, (r) => {
          r.querySelector('[data-n]').onclick = () => O.Panels.close();
          r.querySelector('[data-y]').onclick = () => { quit(null, e); hire(s, bz, q, d.role, d.wage); PS.emp.firstDay = 0; O.Panels.close(); say(`You're ${d.role} at ${bz.name} now, at ₳${d.wage} a day.`); };
        });
        return null;
      }
      if (key === 'notice') { quit('You hand in your notice.', postAt(cur(), cur().biz.get(q.job.biz))); cur().remember(q, 'The stranger left my service.', 'work', 1); return render('Very well. I wish you luck.'); }
      return prevOn && prevOn(q, key, render);
    };
    function offer(q, render) {
      const s = cur(), bz = s.biz.get(q.job.biz);
      let d = s.hireDecision(bz, q, 'player');
      if (d.yes && !O.roleFits(d.role)) return render(`"I need a ${O.ROLE_SEX[d.role] === 'f' ? 'woman' : 'man'} for that post, and it's the only one going."`);
      if (d.yes && O.prestigeRefusal && O.prestigeRefusal(d.role)) return render(O.prestigeRefusal(d.role));
      if (d.yes && d.role === 'clerk' && (PS.learning || 0) < 0.15) return render('"A clerk must read and write a fair hand. Come back when you have your letters: the priest gives lessons, and there are books in the chapel."');
      if (!d.yes) return render(d.why === 'bad' ? "Work? For you? I know what's said of you. No." : d.why === 'dislike' ? "I'll not take you on. Try elsewhere." : "I've all the hands I need just now.");
      const [o, c] = hoursOf({ role: d.role }, bz);
      // a post whose hours clash with this one has to go; any other you keep
      const clash = posts().filter((x) => { const xb = (O.Travel?.visited.get(x.place)?.sim || s).biz.get(x.biz), [xo, xc] = hoursOf(x, xb); return (x.biz === bz.id && x.place === s.world.placeId) || (xo < c && o < xc); });
      const e = clash[0], keep = posts().filter((x) => !clash.includes(x));
      npcUI.closeTalk && npcUI.closeTalk();
      const shown = d.role === 'potboy' && (O.Forge.player?.sex || O.Forge.player?.a?.sex) === 'f' ? 'potgirl' : d.role;
      O.Panels.open(`Work at ${bz.name}`, `<p class="speech">“I could use a ${shown}.${d.role === 'potboy' ? ' Somebody has to gather the pots and wipe the tables of an evening.' : ''} ₳${d.wage} a day, ${fmtH(o)} till ${fmtH(c)}${['tavern', 'chapel', 'guard', 'hospital'].includes(bz.type) ? ', every day' : ', Sundays off'}. Will you take it?”</p>${clash.length ? `<p class="caption">The hours clash: you'd give up your post as ${clash.map((x) => `${esc(x.role)} at ${esc(x.bizName)}`).join(' and ')}.</p>` : keep.length ? `<p class="caption">You'd keep your post as ${keep.map((x) => `${esc(x.role)} at ${esc(x.bizName)}`).join(' and ')} as well: the hours don't clash.</p>` : ''}<div class="topics"><button data-y="1">Take the job</button><button data-n="1">Not now</button></div>`, (r) => {
        r.querySelector('[data-n]').onclick = () => O.Panels.close();
        r.querySelector('[data-y]').onclick = () => { for (const x of clash) quit(null, x); void e; hire(s, bz, q, d.role, d.wage); O.Panels.close(); say(`You're taken on as ${shown} at ${bz.name}. Your first shift is ${worksToday(s, bz) && s.hour < o ? 'today' : 'tomorrow'} at ${fmtH(o)}. When it starts, your tasks show in the corner and arrows show where to go.`); };
      });
      return null;
    }
    const esc = (t) => O.escape(String(t));
    function hire(s, bz, boss, role, wage, extra) {
      bz.playerRole = role;
      if (['monarch', 'consort', 'heir', 'prince', 'princess'].includes(role)) boss = null; // nobody is the crown's master
      posts().push(PS.emp = Object.assign({ place: s.world.placeId, placeName: s.world.name, biz: bz.id, bizName: bz.name, role, wage, master: boss ? boss.id : null, masterName: boss ? boss.name : ['monarch', 'consort', 'heir', 'prince', 'princess'].includes(role) ? null : 'the crown', since: s.day,
        stats: { shifts: 0, late: 0, missed: 0, tasks: 0, excused: 0 }, day: null, tasks: [], level: 0 }, extra || {}));
      { const [o0, c0] = hoursOf(PS.emp, bz), h0 = s.hour; if (h0 >= o0 && h0 < c0 && !COURT.has(role)) PS.emp.firstDay = s.day + 1; } // taken on mid-shift you start at the next one; a crown post starts at once
      if (boss) { s.relate(boss, { id: 0 }, 0.05); s.remember(boss, `Took the stranger on as ${role}.`, 'work', 1.2, 0); }
      O.Chronicle && O.Chronicle.deed(s, `A newcomer has been taken on as ${role} at ${bz.name}.`, `You were taken on as ${role} at ${bz.name}.`, 'player', 1, true);
    }
    function quit(msg, e = emp()) { if (!e) return; const s = cur(); const bz = s.world.placeId === e.place ? s.biz.get(e.biz) : null; if (bz && bz.playerRole === e.role) bz.playerRole = null; PS.posts = posts().filter((x) => x !== e); if (PS.emp === e) { PS.emp = PS.posts[0] || null; PS.carry = null; } if (msg) say(msg); }
    // things you do that count toward a task: hearing a petition, issuing a decree, speaking with someone, going to a floor
    O.jobEvent = (type, data = {}) => {
      const e = here(); if (!e || !e.onShift) return;
      const s = cur(), bz = bizOf(e);
      for (const t of e.tasks) {
        if (t.have >= t.need) continue;
        let hit = false;
        if (type === 'hear' && t.kind === 'hear') hit = true;
        if (type === 'decree' && t.kind === 'decree') hit = true;
        if (type === 'talk' && data.q) {
          const q = data.q, inKeep = game.scene && bz && (game.scene.b.parent || game.scene.b).id === bz.id;
          if (t.kind === 'talkto' && ((t.who != null && q.id === t.who) || (t.royal && q.royal) || (t.role && t.role.source !== '^$' && t.role.test(q.job?.role || '')))) hit = true;
          if (t.kind === 'talkmany' && !(t.seen || []).includes(q.id) && (!t.inKeep || inKeep) && (!t.inBiz || (game.scene && bz && game.scene.b.id === bz.id))) { (t.seen = t.seen || []).push(q.id); hit = true; }
        }
        if (type === 'floor' && t.kind === 'visit' && t.floors.includes(data.floor) && !(t.seenF || []).includes(data.floor)) { (t.seenF = t.seenF || []).push(data.floor); hit = true; }
        if (hit) { t.have++; e.stats.tasks++; e.todayTasks = (e.todayTasks || 0) + 1; if (t.have >= t.need) say(`Done: ${t.text.split(':')[0].toLowerCase()}.`); refresh(); if (type !== 'talk') break; }
      }
      void s;
    };
    O.Employment = { emp, hire, quit, here, posts };
    O.COURT = COURT;
    O.jobHours = (e) => { const s = O.Travel?.visited.get(e.place)?.sim || cur(), bz = s.world.placeId === e.place ? s.biz.get(e.biz) : null; return hoursOf(e, bz); };

    // ---------------------------------------------------------------- tasks
    const MAKERS = new Set(Object.keys(D.ROLE_ACTION));
    const ROLE_KIND = (role) => {
      if (['guard', 'sergeant', 'royal guard', 'captain of the royal guard', 'night watchman', 'gamekeeper', 'bounty hunter', 'knight', 'toll keeper', 'squire', 'spy', 'falconer'].includes(role)) return 'patrol';
      if (['farmhand', 'farmer', 'shepherd', 'vine-dresser', 'beekeeper', 'gardener', 'peat cutter', 'clay digger', 'dairymaid', 'maltster'].includes(role)) return 'field';
      if (['woodcutter', 'forester', 'charcoal burner'].includes(role)) return 'chop';
      if (['fisher', 'ferryman', 'salt boiler'].includes(role)) return 'fish';
      if (['tax collector', 'bailiff', 'market warden'].includes(role)) return 'collect';
      if (['messenger', 'mounted courier', 'carter', 'porter', 'docker', 'warehouse worker', 'page', 'herald', 'town crier', 'labourer', 'bearer', 'water carrier'].includes(role)) return 'deliver';
      if (['maid', 'scullion', 'chambermaid', 'potboy', 'laundress', 'sweeper', 'undertaker', 'chimney sweep', 'rat-catcher', 'lamplighter', 'groom', 'stablehand', 'gravedigger'].includes(role)) return 'sweep';
      if (['shopkeeper', 'server', 'innkeeper', 'postmaster', 'horse trader', 'butler'].includes(role)) return 'serve';
      if (['priest', 'bell-ringer', 'pilgrim guide'].includes(role)) return 'service';
      if (['teacher'].includes(role)) return 'teach';
      if (['physician', 'nurse', 'midwife', 'barber-surgeon'].includes(role)) return 'tend';
      if (['clerk', 'scribe', 'magistrate', 'steward', 'chamberlain', 'moneylender', 'house agent', 'parish clerk', 'ballot clerk', 'guard captain', 'warehouse master', 'mine foreman', 'quarry master', 'master builder', 'master of horse'].includes(role)) return 'write';
      if (['monarch', 'consort', 'lord', 'lady', 'heir', 'prince', 'princess', 'lady-in-waiting', 'jester', 'executioner'].includes(role)) return 'court';
      return 'make';
    };
    // two kinds of work: a day's quota (do the set tasks, each different, and your day is done whenever you
    // finish) and a shift (stay the hours; the work changes as the day goes on)
    const QUOTA_ROLES = new Set(['chimney sweep', 'rat-catcher', 'lamplighter', 'gravedigger', 'laundress', 'undertaker', 'peat cutter', 'clay digger']);
    const modeOf = (role) => (['make', 'chop', 'field', 'fish', 'deliver', 'collect'].includes(ROLE_KIND(role)) || QUOTA_ROLES.has(role)) && !['monarch', 'consort'].includes(role) ? 'quota' : 'shift';
    O.jobMode = modeOf;
    const recipeFor = (bz, role) => bz.def.recipes.find((rc) => rc.role === role) || bz.def.recipes.find((rc) => !rc.role) || bz.def.recipes[0] || null;
    const supplierFor = (s, bz, g) => { const opts = String(bz.def.buys?.[g] || '').split('|').filter((t) => t && t !== 'import' && t !== 'none'); for (const t of opts) { const sp = s.supplierOf(t, g); if (sp && sp.id !== bz.id && (sp.stock[g] || 0) >= 1) return sp; } return null; };
    function newTasks(s, bz, e) {
      const kind = ROLE_KIND(e.role), out = [], id = () => Math.random().toString(36).slice(2, 8);
      const n = 3;
      if (kind === 'make') { const rc = recipeFor(bz, e.role); if (rc) { const g = Object.keys(rc.out)[0]; out.push({ id: id(), kind: 'make', good: g, need: n, have: 0, text: `Make ${D.GOODS[g]?.name.toLowerCase() || g}` }); } else out.push({ id: id(), kind: 'sweep', need: n, have: 0, text: 'Tidy and sweep the place' }); }
      else if (kind === 'serve') out.push({ id: id(), kind: 'serve', need: n, have: 0, text: bz.type === 'tavern' ? 'Take orders and serve at the counter' : 'Serve at the counter' });
      else out.push({ id: id(), kind, need: n, have: 0, text: { patrol: 'Walk your beat', field: 'Work the ground', chop: 'Fell and cut timber', fish: 'Fish the water', collect: 'Collect what is owed', deliver: 'Carry goods where they are wanted', sweep: bz.type === 'stable' ? 'Muck out the stalls' : 'Clean and sweep', service: 'Lead the prayers', teach: 'Teach the children', tend: 'Tend the sick', write: 'Keep the books', court: 'Hold court' }[kind] || 'Work' });
      // the monarch presides over the council of the realm at the long table upstairs, Thursday afternoons
      if (kind === 'court' && ['monarch', 'consort', 'heir'].includes(e.role) && s.weekday === 3 && s.hour < 17) out.push({ id: id(), kind: 'attend', need: 1, have: 0, text: 'Preside at the council table upstairs (2pm)' });
      // the court's work is people and decisions, not pressing a button at a piece of furniture
      if (kind === 'court') {
        out.length = 0; const add = (t) => out.push(Object.assign({ id: id(), have: 0 }, t));
        if (e.role === 'monarch') { add({ kind: 'hear', need: 3, text: 'Sit on the throne and hear petitions' }); add({ kind: 'decree', need: 1, text: 'Issue a decree (Business, B: the Crown)' }); add({ kind: 'talkto', role: /captain of the royal guard|royal guard/, need: 1, text: 'Inspect the guard: speak with a royal guard' }); }
        else if (e.role === 'consort') { add({ kind: 'hear', need: 2, text: 'Sit at court and hear petitions' }); add({ kind: 'talkto', role: /lady-in-waiting|steward/, need: 1, text: 'See to the household: speak with the steward or a lady-in-waiting' }); }
        else if (e.role === 'heir' || e.role === 'prince' || e.role === 'princess') { add({ kind: 'talkmany', need: 3, text: 'Be seen at court: speak with three people in the castle', inKeep: true }); add({ kind: 'talkto', role: /master of horse|captain/, need: 1, text: 'Lessons in arms: speak with the master of horse or the captain' }); }
        else if (e.role === 'steward') { add({ kind: 'court', need: 2, text: "Keep the castle accounts at the steward's desk" }); add({ kind: 'talkto', role: /cook|master cook|butler/, need: 1, text: 'Settle the kitchen accounts with the cook or the butler' }); }
        else if (e.role === 'chamberlain') { add({ kind: 'visit', floors: [2, 3, 4], need: 3, text: 'Walk the household floors (second, third and fourth)' }); add({ kind: 'talkto', role: /maid|chambermaid/, need: 2, text: 'Give the maids their orders' }); }
        else if (e.role === 'jester') { add({ kind: 'talkmany', need: 4, text: 'Amuse the court: make four people laugh', inKeep: true }); }
        else if (e.role === 'lady-in-waiting') { add({ kind: 'talkto', role: /^$/, royal: true, need: 1, text: 'Attend the royal family: speak with one of them' }); add({ kind: 'talkmany', need: 2, text: 'Carry the court gossip: speak with two people in the castle', inKeep: true }); }
        else if (e.role === 'captain of the royal guard') { add({ kind: 'visit', floors: [0, 1, 2, 3, 4], need: 5, text: 'Inspect the posts on every floor' }); add({ kind: 'talkto', role: /royal guard/, need: 2, text: 'Drill the guard: speak with two of them' }); }
        else if (e.role === 'lord' || e.role === 'lady') { add({ kind: 'talkmany', need: 3, text: 'Hear your tenants: speak with three townsfolk' }); }
        else add({ kind: 'talkmany', need: 2, text: 'Attend the court', inKeep: true });
      }
      // most trades: a word with the master, or with the customers, besides the work itself
      if (kind === 'serve') out.push({ id: id(), kind: 'talkmany', need: 2, have: 0, text: 'Chat with the customers', inBiz: true });
      if (kind === 'patrol' && /guard|watch|sergeant/.test(e.role)) out.push({ id: id(), kind: 'talkmany', need: 2, have: 0, text: 'Question folk about the thieving' });
      if (kind === 'make' && e.master != null && s.day % 2 === 0) out.push({ id: id(), kind: 'talkto', who: e.master, need: 1, have: 0, text: 'Show your work to your master' });
      // a fire to keep in
      if (!COURT.has(e.role) && (bz.def.recipes.some((rc) => rc.inp.firewood) || ['bakery', 'smithy', 'tavern', 'kitchen'].includes(bz.type))) out.push({ id: id(), kind: 'fire', need: 1, have: 0, text: 'Keep the fire fed' });
      // at an inn the cook, the server and the chambermaid gather the pots and wipe the tables too
      if (bz.type === 'tavern' && ['cook', 'server', 'chambermaid', 'scullion'].includes(e.role)) out.push({ id: id(), kind: 'pots', need: 2, have: 0, text: 'Gather the pots and wipe the tables' });
      // the innkeeper looks over the rooms
      if (e.role === 'innkeeper') out.push({ id: id(), kind: 'rooms', need: 1, have: 0, text: 'Look over the rooms upstairs' });
      // fetch what's running short, with the business's money
      for (const [g, t] of Object.entries(bz.def.targets || {})) {
        if (out.filter((x) => x.kind === 'fetch').length >= 1 || !bz.def.buys?.[g]) continue;
        if ((bz.stock[g] || 0) < t * 0.35) { const sp = supplierFor(s, bz, g); if (sp) { const qty = Math.min(6, Math.ceil(t * 0.5 - (bz.stock[g] || 0))); out.push({ id: id(), kind: 'fetch', good: g, qty, from: sp.id, fromName: sp.name, need: 1, have: 0, text: `Buy ${qty} ${D.GOODS[g]?.name.toLowerCase() || g} at ${sp.name} (from the business purse)` }); } }
      }
      // a day's quota is several different tasks, not one thing over and over
      if (modeOf(e.role) === 'quota' && !COURT.has(e.role)) {
        const kinds = () => new Set(out.map((x) => x.kind));
        if (!kinds().has('sweep')) out.push({ id: id(), kind: 'sweep', need: 2, have: 0, text: 'Tidy the workplace' });
        if (e.master != null && e.master !== 0 && !out.some((x) => x.kind === 'talkto')) out.push({ id: id(), kind: 'talkto', who: e.master, need: 1, have: 0, text: `Tell ${e.masterName || 'your master'} how the work goes` });
        if (kinds().size < 3) out.push({ id: id(), kind: 'talkmany', need: 2, have: 0, text: 'Ask around for orders' });
      }
      return out;
    }

    // where a task is done (in the current world or the workplace scene); returns candidates for the player
    function spotsFor(t, s, bz, e) {
      const w = s.world, b = bz.b, inScene = game.scene && game.scene.b.id === bz.id;
      const near = (n, r0, r1, ok) => { const out = []; const rr = O.RNG(O.hash(t.id, s.day)); for (let k = 0; k < 120 && out.length < n; k++) { const a = rr.next() * 6.28, d = rr.float(r0, r1), x = Math.round(b.doorX + Math.cos(a) * d), y = Math.round(b.doorY + 1 + Math.sin(a) * d); if (x < 1 || y < 1 || x >= w.W - 1 || y >= w.H - 1 || w.solid[y * w.W + x]) continue; if (ok && !ok(x, y)) continue; out.push([x * T + 8, y * T + 10]); } return out; };
      if (t._spots && t._day === s.day) return t._spots;
      let spots = null;
      switch (t.kind) {
        case 'patrol': { const Z = w.zones || {}, k0 = s.day % 3; spots = bz.type === 'guard' && Z.patrol && Z.patrol.length >= k0 + 3 ? Z.patrol.slice(k0, k0 + 3).map(([x, y]) => [x * T + 8, y * T + 10]) : near(3, 8, 26); break; }
        case 'field': spots = near(3, 3, 10, (x, y) => w.ter[y * w.W + x] !== w.TER.ROAD); break;
        case 'chop': spots = near(3, 3, 14, (x, y) => w.trees.some((tr) => Math.abs(tr.x / T - x) < 2 && Math.abs((tr.y - 1) / T - y) < 2)); if (spots.length < 3) spots = near(3, 3, 10); break;
        case 'fish': spots = near(3, 2, 20, (x, y) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => w.ter[(y + dy) * w.W + x + dx] === w.TER.WATER)); if (spots.length < 1) spots = near(3, 3, 8); break;
        case 'collect': spots = w.buildings.filter((x) => x.type === 'house' && x.household && x.doorX != null).sort((a, c) => (a.id * 7 + s.day) % 13 - (c.id * 7 + s.day) % 13).slice(0, 3).map((x) => [x.doorX * T + 8, (x.doorY) * T + 10, x.id]); break;
        case 'deliver': { const tg = [...s.biz.values()].filter((x) => x.id !== bz.id && x.b.doorX != null).sort((a, c) => (a.id * 3 + s.day) % 11 - (c.id * 3 + s.day) % 11).slice(0, 3); spots = tg.map((x) => [x.b.doorX * T + 8, x.b.doorY * T + 10, x.id]); break; }
        case 'fetch': { const sp = s.biz.get(t.from); spots = sp ? [[sp.b.doorX * T + 8, sp.b.doorY * T + 10, sp.id]] : []; break; }
        default: spots = null; // done indoors at a station
      }
      if (spots) { t._spots = spots; t._day = s.day; }
      return spots;
    }
    // sweeping (and mucking out) is done on the open floor: three marked patches in the room
    function floorSpots(t) {
      const sc = game.scene; if (!sc) return [];
      const key = sc.b.id + ':' + sc.floor;
      if (t._fl && t._fl.key === key) return t._fl.pts;
      const pts = [], r = O.RNG(O.hash(t.id, key)), R = sc.R;
      for (let k = 0; k < 200 && pts.length < 3; k++) {
        const x = r.int(20, Math.max(21, R.W - 20)), y = r.int(R.WH + 24, Math.max(R.WH + 25, R.H - 14));
        if (sc.blocked(x, y) || sc.blocked(x - 6, y) || sc.blocked(x + 6, y) || pts.some(([px, py]) => Math.hypot(px - x, py - y) < 40)) continue;
        pts.push([x, y]);
      }
      t._fl = { key, pts }; return pts;
    }
    // indoor stations by task
    function stationOk(t, it, e) {
      switch (t.kind) {
        case 'make': return !!(it.work && (it.work.includes(e.role) || it.work.length)) || ['anvil', 'workbench', 'millstone', 'oven', 'forge', 'kiln', 'vat', 'loom', 'spinning', 'doughtable', 'butcherblock', 'cauldron'].includes(it.kind);
        case 'fire': return ['oven', 'forge', 'kiln', 'fireplace'].includes(it.kind);
        case 'serve': return !!(it.counter || it.kind === 'bar');
        case 'sweep': return it.kind !== 'stairs' && !it.partition;
        case 'service': return it.kind === 'altar';
        case 'teach': case 'write': return it.kind === 'desk' || it.kind === 'altar';
        case 'tend': return it.kind === 'medbed' || it.kind === 'desk' || it.kind === 'bed';
        case 'court': return e.role === 'steward' || e.role === 'chamberlain' ? it.kind === 'desk' : false; // the throne is sat on, not worked at
        case 'attend': return !!it.council || (it.kind === 'chair' && it.head);
        case 'pots': return it.kind === 'table' || it.kind === 'longtable';
        case 'rooms': return game.scene && game.scene.floor === 1 && (it.kind === 'bed' || it.rent);
        case 'unload': return !!(it.counter || ['crate', 'sack', 'barrel', 'shelf', 'chest'].includes(it.kind));
        default: return false;
      }
    }
    const ANIM_OF = (t, e) => ({ make: D.actionFor(e.role), fire: 'place', serve: e.role === 'innkeeper' ? 'pour' : 'serve', sweep: 'sweep', patrol: 'look', field: D.actionFor(e.role) === 'idle' ? 'hoe' : D.actionFor(e.role), chop: 'chop', fish: 'fish', collect: 'count', deliver: 'place', service: 'pray', teach: 'read', write: 'write', tend: 'serve', court: 'talk', rooms: 'look', fetch: 'count', unload: 'place' }[t.kind] || 'work');

    // the candidate for E: the task you can do where you stand
    O.jobCandidate = () => {
      const e = here(); if (!e || !e.onShift) return null;
      if (PS.emp !== e) PS.emp = e; // the post on shift here is the one you're working at
      const s = cur(), bz = bizOf(e); if (!bz) return null;
      const p = game.player, open = e.tasks.filter((t) => t.have < t.need);
      // carrying something back for the workplace
      if (PS.carry && game.scene && game.scene.b.id === bz.id) { const it = game.scene.L.items.find((i) => stationOk({ kind: 'unload' }, i, e)); if (it) { const [x, y] = game.scene.anchor(it); if (Math.hypot(x - p.x, y - 6 - p.y) < 40) return { type: 'job', t: { kind: 'unload', id: 'u' }, it, d: 4, x, y: y - 30 }; } }
      for (const t of open) {
        if (t.kind === 'unload') continue;
        const spots = spotsFor(t, s, bz, e);
        if (spots) {
          if (game.scene) { if (t.kind === 'fetch' && game.scene.b.id === t.from) { const c = game.scene.L.items.find((i) => i.counter || i.kind === 'bar'); if (c) { const [x, y] = game.scene.anchor(c); if (Math.hypot(x - p.x, y - p.y) < 50) return { type: 'job', t, d: 3, x, y: y - 30 }; } } continue; }
          for (let k = 0; k < spots.length; k++) { if ((t.done || []).includes(k)) continue; const [x, y] = spots[k]; if (Math.hypot(x - p.x, y - p.y) < 22) return { type: 'job', t, k, d: 2, x, y: y - 34 }; }
          continue;
        }
        if (!game.scene || game.scene.b.id !== bz.id) continue;
        if (t.kind === 'sweep') { const pts = floorSpots(t); for (let k = 0; k < pts.length; k++) { if ((t.done || []).includes('f' + k)) continue; const [x, y] = pts[k]; if (Math.hypot(x - p.x, y - p.y) < 20) return { type: 'job', t, k: 'f' + k, d: -10, x, y: y - 30 }; } continue; }
        for (const it of game.scene.L.items) {
          if (!stationOk(t, it, e)) continue;
          const [x, y] = game.scene.anchor(it); const d = Math.hypot(x - p.x, y + 8 - p.y);
          if (d < (t.kind === 'sweep' ? 26 : 36) && !((t.kind === 'sweep' || t.kind === 'pots') && (t.swept || []).includes(it.id))) return { type: 'job', t, it, d: -10 + d * 0.1, x, y: y - 30 }; // the work comes before the furniture
        }
      }
      return null;
    };
    const LABEL = { make: (t) => `Make ${D.GOODS[t.good]?.name.toLowerCase() || 'goods'} (${t.have + 1}/${t.need})`, fire: () => 'Feed the fire with firewood', serve: (t) => `Serve (${t.have + 1}/${t.need})`, sweep: (t) => `Sweep here (${t.have + 1}/${t.need})`, patrol: (t) => `Look about your beat (${t.have + 1}/${t.need})`,
      field: (t) => `Work the ground (${t.have + 1}/${t.need})`, chop: (t) => `Fell and cut (${t.have + 1}/${t.need})`, fish: (t) => `Cast a line (${t.have + 1}/${t.need})`, collect: (t) => `Collect the dues (${t.have + 1}/${t.need})`, deliver: (t) => `Deliver here (${t.have + 1}/${t.need})`,
      fetch: (t) => `Buy ${t.qty} ${D.GOODS[t.good]?.name.toLowerCase()} for ${emp().bizName}`, unload: () => `Put away the ${D.GOODS[PS.carry?.good]?.name.toLowerCase() || 'goods'}`, service: (t) => `Lead the prayers (${t.have + 1}/${t.need})`, teach: (t) => `Teach a lesson (${t.have + 1}/${t.need})`,
      write: (t) => `Write up the books (${t.have + 1}/${t.need})`, tend: (t) => `Tend the sick (${t.have + 1}/${t.need})`, court: (t) => `Hear petitions (${t.have + 1}/${t.need})`, rooms: () => 'Look over the rooms', attend: () => 'Take your seat at the head of the table', pots: (t) => `Gather the pots here (${t.have + 1}/${t.need})` };
    O.jobLabel = (c) => (LABEL[c.t.kind] || (() => 'Work'))(c.t);

    // doing it: the action plays, time passes, and the work is real
    let busy = 0, busyDone = null;
    game.hooks.update.push((dt) => {
      if (busy > 0) { busy -= dt; game.player.locked = true; if (busy <= 0) { game.player.locked = false; const f = busyDone; busyDone = null; game.player.anim = 'idle'; f && f(); } }
    });
    function act(anim, secs, minutes, done) { const p = game.player; p.anim = anim; p.ft = 0; busy = secs; busyDone = () => { const s = cur(); for (let i = 0; i < minutes / 2; i++) { s.tick(2); PS.tick(2, false); } PS.energy = Math.max(0, PS.energy - minutes / 20); done(); }; }
    O.jobAct = (c) => {
      const e = emp(), s = cur(), bz = bizOf(e), t = c.t; if (!bz) return;
      const tick = (msg) => { t.have++; e.stats.tasks++; e.todayTasks = (e.todayTasks || 0) + 1; if (c.k != null) (t.done = t.done || []).push(c.k); if (msg) say(msg); refresh(); };
      switch (t.kind) {
        case 'make': {
          const rc = recipeFor(bz, e.role); if (!rc) return;
          const lack = Object.entries(rc.inp).find(([g, q]) => (bz.stock[g] || 0) < q * 2);
          if (lack) {
            const g = lack[0], pending = e.tasks.some((x) => x.kind === 'fetch' && x.good === g && x.have < x.need), sp = !pending && supplierFor(s, bz, g);
            if (sp) { e.tasks.push({ id: Math.random().toString(36).slice(2, 8), kind: 'fetch', good: g, qty: 4, from: sp.id, fromName: sp.name, need: 1, have: 0, text: `Buy 4 ${D.GOODS[g]?.name.toLowerCase()} at ${sp.name} (from the business purse)` }); refresh(); say(`There's no ${D.GOODS[g]?.name.toLowerCase() || g} to work with. Go and buy some at ${sp.name}: it's on your list.`, 'bad'); return; }
            if (pending) { say(`There's no ${D.GOODS[g]?.name.toLowerCase() || g} to work with. Fetch it first: it's on your list.`, 'bad'); return; }
            // nothing to be had in town: the time goes on mending, sharpening and setting the place in order instead
            act(ANIM_OF(t, e), 2.2, 30, () => tick(`No ${D.GOODS[g]?.name.toLowerCase() || g} to be had, so you spend the half hour mending and setting things straight.`));
            return;
          }
          act(ANIM_OF(t, e), 2.2, 30, () => { const made = []; for (const [g, q] of Object.entries(rc.inp)) bz.stock[g] -= q * 2; for (const [g, q] of Object.entries(rc.out)) { bz.stock[g] = (bz.stock[g] || 0) + q * 2; made.push(`${+(q * 2).toFixed(1)} ${D.GOODS[g]?.name.toLowerCase() || g}`); } tick(`Half an hour's work: ${made.join(', ')}.`); });
          break;
        }
        case 'fire': {
          if ((bz.stock.firewood || 0) < 1) { say('No firewood left. Someone must fetch some.', 'bad'); if (!e.tasks.some((x) => x.kind === 'fetch' && x.good === 'firewood' && x.have < x.need)) { const sp = supplierFor(s, bz, 'firewood') || s.supplierOf('woodcutter', 'firewood') || s.supplierOf('store', 'firewood'); if (sp) e.tasks.push({ id: 'fw' + s.day, kind: 'fetch', good: 'firewood', qty: 4, from: sp.id, fromName: sp.name, need: 1, have: 0, text: `Buy 4 firewood at ${sp.name} (from the business purse)` }); refresh(); } return; }
          act('place', 1.2, 5, () => { bz.stock.firewood -= 1; bz.fireUntil = now(s) + 180; tick('You build up the fire. It roars.'); });
          break;
        }
        case 'serve': {
          const customers = s.people.filter((q) => q.agent.inside === bz.id && ['shop', 'eat-out', 'socialise', 'deliver', 'import'].includes(q.activity?.act)).length;
          act(ANIM_OF(t, e), 1.6, 15, () => { const sold = bz.def.sells[0]; if (customers && sold && (bz.stock[sold] || 0) >= 1) { const pr = s.price(bz, sold); bz.stock[sold] -= 1; bz.cash += pr; bz.salesToday += pr; tick(`You serve a customer: ${D.GOODS[sold]?.name.toLowerCase()} for ₳${pr} into the till.`); } else tick(customers ? 'You see to a customer.' : 'Nobody waiting; you set the counter straight and wait for trade.'); });
          break;
        }
        case 'sweep': act('sweep', 1.6, 15, () => { (t.swept = t.swept || []).push(c.it ? c.it.id : c.k); tick(t.have + 1 >= t.need ? (bz.type === 'stable' ? 'The stalls are mucked out and fresh straw down.' : 'Swept clean.') : null); }); break;
        case 'patrol': act('look', 1.4, 15, () => tick(t.have + 1 >= t.need ? 'Your round is walked. All quiet.' : null)); break;
        case 'field': act(ANIM_OF(t, e), 2.4, 40, () => { const rc = recipeFor(bz, e.role); if (rc && !Object.keys(rc.inp).length) for (const [g, q] of Object.entries(rc.out)) bz.stock[g] = (bz.stock[g] || 0) + q * 2; tick(null); }); break;
        case 'chop': act('chop', 2.4, 40, () => { const rc = recipeFor(bz, e.role); if (rc) for (const [g, q] of Object.entries(rc.out)) if (!Object.keys(rc.inp).length) bz.stock[g] = (bz.stock[g] || 0) + q * 2; else bz.stock.logs = (bz.stock.logs || 0) + 1; tick(null); }); break;
        case 'fish': act('fish', 3, 45, () => { const got = s.rng.chance(0.7); if (got) { const g = bz.type === 'saltworks' ? 'salt' : 'fish'; bz.stock[g] = (bz.stock[g] || 0) + (g === 'fish' ? 3 : 2); } tick(got ? (bz.type === 'saltworks' ? 'The pan boils down to salt.' : 'Three fish in the basket.') : 'Nothing biting.'); }); break;
        case 'collect': {
          const b = s.building(t._spots[c.k][2]), hh = b && s.households[b.household - 1];
          act('count', 1.6, 10, () => { if (!hh) return tick(null); const due = Math.max(1, Math.round(hh.members.length * 1.5)); if (hh.money >= due && s.rng.chance(0.8)) { hh.money -= due; if (bz.def.public) s.treasury.cash += due; else bz.cash += due; tick(`The ${hh.surname} household pays ₳${due}.`); } else { const q = s.byId.get(hh.members[0]); if (q) { q.agent.shockedUntil = s.minute + 2; s.relate(q, { id: 0 }, -0.05); } tick(`The ${hh.surname} household can't pay. You note it down for the bailiff.`); } });
          break;
        }
        case 'deliver': act('place', 1.4, 15, () => { const to = s.biz.get(t._spots[c.k][2]); const g = bz.def.sells[0]; if (to && g && (bz.stock[g] || 0) >= 1) { bz.stock[g] -= 1; to.stock[g] = (to.stock[g] || 0) + 1; const pr = s.price(bz, g); if (to.cash >= pr) { to.cash -= pr; bz.cash += pr; } } tick(to ? `Delivered to ${to.name}.` : null); }); break;
        case 'fetch': {
          const sp = s.biz.get(t.from), g = t.good; if (!sp) return;
          const qty = Math.min(t.qty, Math.floor(sp.stock[g] || 0)), cost = Math.round(s.price(sp, g) * qty);
          if (qty < 1) { say(`${sp.name} has no ${D.GOODS[g]?.name.toLowerCase()} to sell.`, 'bad'); return; }
          if (bz.cash < cost) { say(`The business purse holds ₳${Math.floor(bz.cash)}; that's ₳${cost} of ${D.GOODS[g]?.name.toLowerCase()}. Ask the master to put more in.`, 'bad'); return; }
          act('count', 1.4, 10, () => { sp.stock[g] -= qty; sp.cash += cost; bz.cash -= cost; PS.carry = { good: g, qty, for: bz.id }; e.tasks.push({ id: 'un' + t.id, kind: 'unload', need: 1, have: 0, text: `Bring the ${D.GOODS[g]?.name.toLowerCase()} back to ${bz.name}` }); tick(`You pay ₳${cost} of ${bz.name}'s money and take ${qty} ${D.GOODS[g]?.name.toLowerCase()}. Carry it back.`); });
          break;
        }
        case 'unload': act('place', 1.2, 5, () => { const cy = PS.carry; if (cy) { bz.stock[cy.good] = (bz.stock[cy.good] || 0) + cy.qty; PS.carry = null; } const u = e.tasks.find((x) => x.kind === 'unload' && x.have < x.need); if (u) { u.have = 1; } e.stats.tasks++; refresh(); say('Put away.'); }); break;
        case 'rooms': act('look', 1.6, 10, () => tick('The rooms are in order.')); break;
        case 'attend': { if (s.hour < 13.9) { say('The council sits at two. Come back then.'); return; } const n = s.people.filter((q) => q.councillor && q.agent.inside === bz.id).length; act('talk', 3, 120, () => tick(n ? `You preside over the council: ${n} of the realm's leaders have their say, and you give your answers.` : 'You wait at the head of the table, but the leaders are late.')); break; }
        case 'pots': act('scrub', 1.4, 10, () => { (t.swept = t.swept || []).push(c.it ? c.it.id : c.k); tick('You gather the pots and wipe the table down.'); }); break;
        case 'service': case 'teach': case 'write': case 'tend': case 'court': act(ANIM_OF(t, e), 2, 30, () => tick(null)); break;
        default: break;
      }
    };

    // ---------------------------------------------------------------- shifts, lateness, pay, promotion and the sack
    function atWork(s, bz, e) {
      if (game.scene && game.scene.b.id === bz.id) return true;
      const p = game.player; if (game.world !== s.world) return false;
      return Math.hypot(p.x - (bz.b.doorX * T + 8), p.y - bz.b.doorY * T) < 140 || e.tasks.some((t) => t._spots && t._spots.some(([x, y]) => Math.hypot(x - p.x, y - p.y) < 60));
    }
    game.hooks.update.push(() => {
      const all = posts(); if (!all.length) { panel(null); return; }
      for (const e of all.slice()) tickPost(e);
      // the post you're working at just now is the one in focus: on shift and here, else on shift, else the next
      const pl = cur().world.placeId;
      PS.emp = all.find((e) => e.onShift && e.place === pl) || all.find((e) => e.onShift) || all.slice().sort((a, b) => hoursOf(a, null)[0] - hoursOf(b, null)[0])[0] || null;
      panel(PS.emp);
    });
    function tickPost(e) {
      // the post is in another town: it waits for you (time passes there too)
      const visited = O.Travel && O.Travel.visited.get(e.place), s = visited ? visited.sim : cur();
      if (!s || s.world.placeId !== e.place) return;
      const bz = s.biz.get(e.biz); if (!bz) { quit(`${e.bizName} is gone, and your post with it.`, e); return; }
      if (['monarch', 'consort', 'heir', 'prince', 'princess'].includes(e.role) && e.master != null) { e.master = null; e.masterName = null; }
      if (bz.playerRole !== e.role) bz.playerRole = e.role;
      const m = Math.floor(now(s)); if (m === e._lm) return; e._lm = m;
      const [o, c] = hoursOf(e, bz), h = s.hour + (s.hour < 6 && c > 24 ? 24 : 0), day = s.day;
      if (e.day !== day) { // a new day
        if (e.day != null && e.dayInfo) settle(s, bz, e);
        e.day = day; e.dayInfo = { works: worksToday(s, bz) && day >= (e.firstDay || 0), arrived: null, excused: e.excuseDay === day };
        e.tasks = []; e.onShift = false;
      }
      const D0 = e.dayInfo; if (!D0.works && day >= (e.firstDay || 0) && worksToday(s, bz)) D0.works = true; // start day reached
      if (!D0.works) return;
      const on = h >= o && h < c;
      if (on && !e.onShift && !D0.dayDone) { e.onShift = true; e.tasks = newTasks(s, bz, e); e._rot = now(s); D0.mode = modeOf(e.role); D0.present = 0; refresh(); }
      if (on && e.onShift && atWork(s, bz, e)) D0.present = (D0.present || 0) + 1;
      if (!on && e.onShift && h >= c) { e.onShift = false; refresh(); }
      if (on && D0.arrived == null && atWork(s, bz, e)) { D0.arrived = h; if (h > o + 0.25 && !D0.excused) { e.stats.late++; const boss = s.byId.get(e.master); if (boss) s.relate(boss, { id: 0 }, -0.04); say(`You're late. ${e.masterName || 'Your master'} gives you a look.`, 'bad'); } }
      if (on && e.onShift && D0.mode === 'quota' && e.tasks.length && e.tasks.every((t) => t.have >= t.need) && !D0.dayDone) {
        D0.dayDone = true; e.onShift = false; refresh();
        say(`That's your day's work done at ${bz.name}. You can go: you'll be paid in full.`);
      }
      if (on && e.onShift && D0.mode === 'shift') {
        // the work changes as the day goes on: every hour and a half, something new needs doing
        if (now(s) - (e._rot || 0) >= 90 && h < c - 0.75) {
          e._rot = now(s);
          const open = e.tasks.filter((t) => t.have < t.need), done = e.tasks.filter((t) => t.have >= t.need);
          const pool = [...newTasks(s, bz, e), { id: 'sw' + now(s), kind: 'sweep', need: 2, have: 0, text: 'Sweep and tidy the place' }, { id: 'tm' + now(s), kind: 'talkmany', need: 2, have: 0, text: 'See to the folk who come in', inBiz: true }];
          if (e.master != null && e.master !== 0) pool.push({ id: 'tt' + now(s), kind: 'talkto', who: e.master, need: 1, have: 0, text: `Ask ${e.masterName || 'your master'} what wants doing` });
          const recent = new Set(done.slice(-4).map((x) => x.kind));
          const fresh = pool.filter((t) => t.kind !== 'rooms' && !open.some((x) => x.kind === t.kind) && !recent.has(t.kind));
          for (let i = fresh.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [fresh[i], fresh[j]] = [fresh[j], fresh[i]]; }
          const add = fresh.slice(0, Math.max(1, 3 - open.length));
          if (add.length) { e.tasks = [...done.slice(-3), ...open, ...add]; refresh(); if (atWork(s, bz, e)) say(`New work: ${add.map((x) => x.text.charAt(0).toLowerCase() + x.text.slice(1)).join('; ')}.`); }
        }
        if (e.tasks.every((t) => t.have >= t.need) && h < c - 1) e._rot = Math.min(e._rot || 0, now(s) - 70); // all done: something new comes along soon
      }
    }
    function settle(s, bz, e) {
      const D0 = e.dayInfo; if (!D0.works && day >= (e.firstDay || 0) && worksToday(s, bz)) D0.works = true; // start day reached
      if (!D0.works) return;
      const boss = s.byId.get(e.master), done = e.todayTasks || 0; e.todayTasks = 0;
      if (D0.arrived == null) {
        if (D0.excused) { e.stats.excused++; if (boss) s.relate(boss, { id: 0 }, -0.02); }
        else { e.stats.missed++; if (boss) { s.relate(boss, { id: 0 }, -0.12); s.remember(boss, 'The stranger never came to work.', 'work', 1.2, 0); } }
      } else {
        e.stats.shifts++;
        // the day's wage, less for a half-hearted day
        let pay;
        if (D0.walkedOut) pay = 0;
        else if (D0.mode === 'quota') { const tot = e.tasks.length || 1, fin = e.tasks.filter((t) => t.have >= t.need).length; pay = Math.round(e.wage * (D0.dayDone ? 1 : O.clamp(0.3 + 0.7 * fin / tot, 0.3, 1))); }
        else { const [o0, c0] = hoursOf(e, bz), len = Math.max(60, (c0 - o0) * 60); pay = Math.round(e.wage * O.clamp(0.25 + 0.75 * (D0.present || 0) / len + Math.min(0.15, done * 0.02), 0.25, 1.15)); }
        const purse = bz.def.public ? s.treasury : bz; const paid = Math.min(pay, Math.floor(purse.cash));
        purse.cash -= paid; PS.money += paid; PS.earned = (PS.earned || 0) + paid;
        if (boss) s.relate(boss, { id: 0 }, done >= 3 ? 0.04 : 0.01);
        if (pay) say(`Your day's pay from ${bz.name}: ₳${paid}${paid < pay ? ` (₳${pay - paid} owing: the purse is empty)` : ''}.`);
      }
      // the sack: lateness and absence against how much they like you and how badly they need you
      const like = boss ? (boss.rel.get(0)?.affinity || 0) : 0, des = s.desperation ? s.desperation(bz) : 0;
      const bad = e.stats.late * 0.08 + e.stats.missed * 0.3 + Math.max(0, e.stats.excused - 2) * 0.1;
      if (bad - like * 0.8 - des * 0.4 > 0.55) {
        bz.firedPlayer = true;
        const told = s.rng.chance(0.5);
        if (boss) s.remember(boss, 'Let the stranger go. Unreliable.', 'work', 1.5, 0);
        quit(told ? `${e.masterName || 'Your master'} sends word: you're not to come back to ${e.bizName}.` : null, e);
        if (!told) PS.firedSilently = { biz: bz.id, place: s.world.placeId, name: bz.name };
        return;
      }
      // a step up: good attendance, plenty done, a master who likes you and a business that can pay
      const sh = e.stats.shifts;
      if (sh > 0 && sh % 6 === 0 && e.stats.tasks / sh >= 3 && like > 0.2 && (bz.cash > 120 || bz.def.public)) {
        const roles = bz.def.jobs.map((j) => j[0]), i = roles.indexOf(e.role);
        if (i > 0 && bz.def.wage[roles[i - 1]] !== 0 && !(O.Careers && O.Careers.PRESTIGE.has(roles[i - 1]))) { /* the high posts are climbed to: see Ways up */ const nr = roles[i - 1]; bz.playerRole = nr; e.role = nr; e.wage = Math.max(e.wage + 1, bz.def.wage[nr] || e.wage + 2); say(`${e.masterName || 'Your master'} puts you up to ${nr}, at ₳${e.wage} a day.`); }
        else { e.wage += 1; say(`${e.masterName || 'Your master'} raises your pay to ₳${e.wage} a day.`); }
      }
    }
    // turning up after being quietly let go
    game.hooks.update.push(() => {
      const f = PS.firedSilently; if (!f || !game.scene || game.scene.b.id !== f.biz || cur().world.placeId !== f.place) return;
      PS.firedSilently = null; say(`Someone at ${f.name} tells you: “You don't work here any more. Didn't they say?”`, 'bad');
    });

    // ---------------------------------------------------------------- the checklist in the corner
    let el = null, sig = '';
    function refresh() { sig = ''; }
    function panel(e) {
      if (!el) { el = document.createElement('div'); el.className = 'joblist'; el.setAttribute('aria-live', 'polite'); (document.getElementById('tab-play') || document.body).appendChild(el); }
      if (!e || O.panelOpen) { if (!el.hidden) el.hidden = true; if (O.panelOpen) sig = ''; return; }
      const s = O.Travel?.visited.get(e.place)?.sim || cur();
      const bz = s.world.placeId === e.place ? s.biz.get(e.biz) : null, [o, c] = hoursOf(e, bz);
      const head = `<b>${esc(e.role)}</b> · ${esc(e.bizName)}${e.place !== cur().world.placeId ? `, ${esc(e.placeName)}` : ''}`;
      const crown = COURT.has(e.role);
      const shift = crown ? (e.onShift ? `${e.role === 'monarch' ? 'Your reign' : 'At court'}: the business of the day, till ${fmtH(c)}` : `At court from ${fmtH(o)}`) : e.onShift ? (modeOf(e.role) === 'quota' ? `The day's work: ${e.tasks.filter((t) => t.have >= t.need).length} of ${e.tasks.length} done (go when it's all done)` : `On shift till ${fmtH(c)} (stay the hours; the work changes)`) : e.dayInfo?.dayDone ? `Your day's work is done` : `Next shift: ${nextShift(e, s, bz, o, c)} ${fmtH(o)}-${fmtH(c)}`;
      const tasks = e.onShift ? e.tasks.map((t) => `<li class="${t.have >= t.need ? 'done' : ''}">${t.have >= t.need ? '■' : '□'} ${esc(t.text)}${t.need > 1 ? ` (${Math.min(t.have, t.need)}/${t.need})` : ''}</li>`).join('') : '';
      const carry = PS.carry ? `<div class="carry">Carrying: ${PS.carry.qty} ${esc(D.GOODS[PS.carry.good]?.name.toLowerCase() || PS.carry.good)}</div>` : '';
      const others = posts().filter((x) => x !== e).map((x) => { const xs = O.Travel?.visited.get(x.place)?.sim || cur(), xb = xs.world.placeId === x.place ? xs.biz.get(x.biz) : null, [xo, xc] = hoursOf(x, xb); return `<div class="js">Also: ${esc(x.role)} at ${esc(x.bizName)}, ${fmtH(xo)}-${fmtH(xc)}</div>`; }).join('');
      // what to do next, in plain words
      let hint = '';
      if (e.onShift && bz) {
        const t = e.tasks.find((x) => x.have < x.need);
        if (PS.carry) hint = game.scene && game.scene.b.id === bz.id ? 'Press E at the shelf or store marked in gold to put the goods away.' : `Carry the goods back to ${bz.name}.`;
        else if (t) hint = taskHow(t, e, bz, s);
        else hint = modeOf(e.role) === 'quota' ? "That's the day's work done." : 'All done for now. More work will come along before the shift ends.';
      } else if (!e.onShift) hint = e.dayInfo?.dayDone ? 'Your work is done for today.' : 'Come back when your shift starts. Being late or missing it counts against you.';
      const pay = crown ? `₳${e.wage} a day from the treasury` : `₳${e.wage} a day`;
      const html = `${crown && e.role === 'monarch' ? '<div class="jh" style="text-transform:none">Monarch of Eldoria</div>' : `<div class="jh">${head}</div>`}<div class="js">${shift} · ${pay}</div>${tasks ? `<ul>${tasks}</ul>` : ''}${carry}${hint ? `<div class="js" style="font-style:italic">${esc(hint)}</div>` : ''}${others}`;
      // folded into an icon in the corner until you press it
      const left = e.onShift ? e.tasks.filter((t) => t.have < t.need).length : 0;
      const shown = PS.jobCardOpen ? `<span class="fold">fold ▲</span>${html}` : `<div class="jicon" title="Your work: press to open"><img src="${O.icon('tools')}" alt="Your work">${left ? `<span class="badge">${left}</span>` : ''}</div>`;
      if (!el._bound) { el._bound = true; el.onclick = () => { PS.jobCardOpen = !PS.jobCardOpen; sig = ''; }; }
      el.classList.toggle('min', !PS.jobCardOpen);
      if (shown === sig) return; sig = shown; el.innerHTML = shown; el.hidden = false;
    }

    // ---------------------------------------------------------------- what the job is, and how to do each task, in plain words
    const NICE = { doughtable: 'dough table', butcherblock: "butcher's block", workbench: 'workbench', medbed: 'sick bed', candlestand: 'candle stand' };
    const stationsFor = (t, e, bz, s) => { try { const L = O.Interior.interior(bz.b, 0, s); return [...new Set(L.items.filter((it) => stationOk(t, it, e)).map((it) => NICE[it.kind] || it.kind))].slice(0, 2); } catch (er) { return []; } };
    function taskHow(t, e, bz, s) {
      const st = (t.kind === 'make' || t.kind === 'service' || t.kind === 'write' || t.kind === 'teach' || t.kind === 'tend' || t.kind === 'fire') ? stationsFor(t, e, bz, s) : [];
      const at = st.length ? `the ${st.join(' or the ')}` : 'your place of work';
      const G = D.GOODS[t.good]?.name.toLowerCase();
      switch (t.kind) {
        case 'make': return `Inside ${bz.name}, stand at ${at} and press E. Each press makes ${G ? 'some ' + G : 'a batch'}.`;
        case 'sweep': return `Inside ${bz.name}, the dusty patches are marked in gold: stand on each and press E to sweep it.`;
        case 'fire': return `Inside ${bz.name}, press E at ${at === 'your place of work' ? 'the hearth' : at} to put firewood on.`;
        case 'serve': return `Stand behind the counter inside ${bz.name} and press E to serve whoever is waiting.`;
        case 'pots': return `Go round the tables inside ${bz.name} and press E at each marked one to gather the pots.`;
        case 'rooms': return 'Go upstairs and press E at each guest bed to look the room over.';
        case 'fetch': return `Go to ${t.fromName}, stand at the counter and press E to buy ${t.qty || ''} ${G || 'the goods'}. Then carry them back.`;
        case 'unload': return `Back inside ${bz.name}, press E at the shelf or store marked in gold to put the goods away.`;
        case 'patrol': return 'Walk your beat: the posts are marked in gold around the town. Press E at each one.';
        case 'field': return 'Out in the fields: press E at each marked strip to work it.';
        case 'chop': return 'In the wood: press E at each marked tree to fell it and cut it up.';
        case 'fish': return "At the water's edge: press E at each marked spot to cast a line.";
        case 'collect': return 'Call at each marked door and press E to collect what is owed.';
        case 'deliver': return 'Carry the goods to each marked door and press E to hand them over.';
        case 'service': return `In the chapel, press E at ${at === 'your place of work' ? 'the altar' : at} to lead the prayers.`;
        case 'teach': return `Press E at ${at === 'your place of work' ? 'the desk' : at} to teach the children.`;
        case 'tend': return 'Press E at each sick bed to tend whoever lies in it.';
        case 'write': return `Press E at ${at === 'your place of work' ? 'the desk' : at} to write up the books.`;
        case 'talkto': return t.who != null ? `Find ${s.byId.get(t.who)?.first || 'them'} and talk to them (E).` : 'Find them and talk to them (E). In the castle, people keep to their own rooms and halls.';
        case 'talkmany': return t.inKeep ? 'Talk to people in the castle (E), one after another.' : t.inBiz ? `Talk to the people who come into ${bz.name} (E).` : 'Talk to people about the town (E).';
        case 'hear': return 'Sit on the throne in the throne room (E on it). Petitioners come up the hall one at a time; hear each one.';
        case 'decree': return 'Open Business (B) and the Crown section: set the tax, pardon, honour someone, order works or call a festivity.';
        case 'court': return "Work at the desk in the steward's hall, off the ground-floor hallway (E).";
        case 'attend': return 'The council sits in the great hall upstairs on Thursdays from two. Take your seat at the table (E).';
        case 'visit': return 'Climb the grand stairs and walk each of those floors.';
        default: return 'Press E at the marked places.';
      }
    }
    const SUMMARY = { make: (e, bz, s) => { const rc = recipeFor(bz, e.role); const g = rc && Object.keys(rc.out)[0]; return `You make ${D.GOODS[g]?.name.toLowerCase() || 'goods'} for ${bz.name}.`; }, patrol: () => 'You keep the peace: walk your beat and keep an eye on folk.', field: () => 'You work the land.', chop: () => 'You fell and cut timber.', fish: () => 'You fish for the market.', collect: () => 'You collect what is owed.', deliver: () => 'You carry goods and messages.', sweep: (e, bz) => `You keep ${bz.name} clean and in order.`, serve: (e, bz) => `You serve the customers at ${bz.name}.`, service: () => 'You lead the prayers and keep the chapel.', teach: () => 'You teach the children their letters.', tend: () => 'You care for the sick.', write: () => 'You keep the books and the records.', court: () => 'You serve at court.' };
    const ROLE_SUMMARY = { monarch: 'You rule the realm: hear petitions from the throne, issue decrees, and preside at the council on Thursdays.', consort: 'You share the throne: hear petitions and see to the household.', steward: "You run the castle: its accounts, its kitchens and its stores.", chamberlain: 'You keep the royal household: its floors, its rooms and its servants.', jester: 'You amuse the court.', 'lady-in-waiting': 'You attend the royal family.', executioner: 'You carry out the sentences of death, at the block in the square.', 'captain of the royal guard': 'You command the royal guard and see every post is kept.' };
    O.jobHow = (e) => {
      const s = O.Travel?.visited.get(e.place)?.sim || cur(), bz = s.world.placeId === e.place ? s.biz.get(e.biz) : null;
      if (!bz) return { mode: modeOf(e.role), summary: '', tasks: [] };
      const summary = ROLE_SUMMARY[e.role] || (SUMMARY[ROLE_KIND(e.role)] || (() => ''))(e, bz, s);
      return { mode: modeOf(e.role), summary, tasks: (e.tasks || []).map((t) => ({ text: t.text, have: Math.min(t.have, t.need), need: t.need, done: t.have >= t.need, how: taskHow(t, e, bz, s) })) };
    };
    // the way to work in the hour before a shift (the arrows themselves are drawn by the waypoints)
    O.preShiftTarget = () => {
      const s = cur(), e = here(); if (!e || e.onShift || e.place !== s.world.placeId) return null;
      const bz = s.biz.get(e.biz); if (!bz) return null; const [o] = hoursOf(e, bz);
      return s.hour >= o - 1 && s.hour < o && s.day >= (e.firstDay || 0) ? { b: bz.id, label: `Your shift at ${bz.name}` } : null;
    };
    // ---------------------------------------------------------------- markers over where the work is
    game.hooks.drawTop.push((ctx, cam, indoor) => {
      const e = here(); if (!e || !e.onShift) return;
      const s = cur(), bz = bizOf(e); if (!bz) return;
      const targets = [];
      const bob = Math.round(Math.sin(game.t * 4) * 2), mark = (x, y) => { if (PS.guides === 'off') return; targets.push([x, y + 2]); x = Math.round(x - cam.x); y = Math.round(y - cam.y) + bob; ctx.fillStyle = '#1b1424'; ctx.fillRect(x - 3, y - 1, 7, 5); ctx.fillRect(x - 1, y + 4, 3, 2); ctx.fillStyle = '#f0b45c'; ctx.fillRect(x - 2, y, 5, 3); ctx.fillRect(x, y + 3, 1, 2); };
      for (const t of e.tasks) {
        if (t.have >= t.need) continue;
        if (indoor) {
          if (!game.scene) continue;
          if (t.kind === 'fetch' && game.scene.b.id === t.from) { const c = game.scene.L.items.find((i) => i.counter || i.kind === 'bar'); if (c) { const [x, y] = game.scene.anchor(c); mark(x, y - 40); } continue; }
          if (game.scene.b.id !== bz.id) continue;
          // the way to the throne: down the stairs, into the throne room, the throne itself
          if (t.kind === 'hear' || (t.kind === 'court' && /steward|chamberlain/.test(e.role))) {
            const sc = game.scene, want = t.kind === 'hear' ? 'throne' : 'steward', inRoom = sc.b.roomKey === want;
            if (inRoom) { const it = sc.L.items.find((i) => i.kind === (t.kind === 'hear' ? 'throne' : 'desk')); if (it && !game.player.sitting) { const [x, y] = sc.anchor(it); mark(x, y - 44); } }
            else if (sc.b.parent || sc.floor !== 0) { const w = O.wayOut(); if (w) mark(w[0], w[1] - 30); }
            else { const d = sc.L.items.find((i) => i.kind === 'roomdoor' && i.room === want); if (d) { const [x, y] = sc.anchor(d); mark(x, (d.front ? y - 12 : y + 14) - 30); } }
            continue;
          }
          if (t.kind === 'unload') { const it = game.scene.L.items.find((i) => stationOk(t, i, e)); if (it) { const [x, y] = game.scene.anchor(it); mark(x, y - 40); } continue; }
          if (t.kind === 'sweep') { floorSpots(t).forEach(([x, y], k) => { if (!(t.done || []).includes('f' + k)) mark(x, y - 30); }); continue; }
          const it = game.scene.L.items.find((i) => stationOk(t, i, e) && !(t.swept || []).includes(i.id)); if (it) { const [x, y] = game.scene.anchor(it); mark(x, y - 40); }
        } else {
          const spots = spotsFor(t, s, bz, e);
          if (spots) spots.forEach(([x, y], k) => { if (!(t.done || []).includes(k)) mark(x, y - 40); });
          else if (t.kind !== 'unload') mark(bz.b.doorX * T + 8, bz.b.doorY * T - 50);
          else mark(bz.b.doorX * T + 8, bz.b.doorY * T - 50);
        }
      }
      // the arrow points the way to the nearest, shrinking as you near it until it's only the mark over it
      const P = game.player;
      if (indoor && game.scene && game.scene.b.id !== bz.id && !targets.length && PS.guides !== 'off') { const w = O.wayOut ? O.wayOut() : game.scene.wayIn(); if (w) targets.push([w[0], w[1] - 20]); } // the way out
      if (!targets.length) return;
      const [tx, ty] = targets.sort((a, b) => Math.hypot(a[0] - P.x, a[1] - P.y) - Math.hypot(b[0] - P.x, b[1] - P.y))[0];
      O.guideArrow && O.guideArrow(ctx, cam, tx, ty);
    });

    // ---------------------------------------------------------------- any post at all (for trying the jobs out)
    O.allRoles = () => {
      const seen = new Map();
      for (const [type, def] of Object.entries(D.BUSINESS)) for (const [role] of def.jobs) if (!seen.has(role)) seen.set(role, type);
      for (const r of ['monarch', 'consort', 'heir', 'lord', 'lady']) seen.set(r, 'crown');
      return seen;
    };
    // posts only a woman (or only a man) holds
    O.ROLE_SEX = { 'lady-in-waiting': 'f', lady: 'f', princess: 'f', prince: 'm' };
    O.roleFits = (role) => { const want = O.ROLE_SEX[role]; return !want || want === (O.Forge.player?.sex || O.Forge.player?.a?.sex || 'm'); };
    O.takeAnyPost = (role) => {
      if (!O.roleFits(role)) return say(`Only a ${O.ROLE_SEX[role] === 'f' ? 'woman' : 'man'} can be ${role}.`, 'bad');
      // a crown post is held at the capital's castle: you're taken there first
      if (['monarch', 'consort', 'heir'].includes(role) && !cur().world.buildings.some((b) => b.royal) && O.teleport) { const K = O.SimRef.home.kingdom, cap = K.places.find((x) => x.kind === 'capital'); if (cap) O.teleport(cap.id); }
      const s = cur(), type = O.allRoles().get(role);
      let bz = [...s.biz.values()].find((x) => x.type === type) || null;
      if (type === 'crown') { const all = [...s.biz.values()]; bz = all.find((x) => x.b && x.b.royal) || all.find((x) => x.type === 'palace' || x.type === 'keep') || all.find((x) => x.type === 'manor') || all.find((x) => x.type === 'townhall') || all[0]; }
      if (!bz) return say(`There's no ${D.BUSINESS[type]?.label.toLowerCase() || type} in ${s.world.name}. Try a bigger place.`, 'bad');
      // whoever held the post makes way (they find work elsewhere)
      const holder = bz.workers.map((id) => s.byId.get(id)).find((q) => q && q.job?.role === role);
      if (holder) { bz.workers = bz.workers.filter((id) => id !== holder.id); holder.job = null; }
      if (emp()) quit(null);
      hire(s, bz, s.bossOf(bz), role, Math.max(3, bz.def.wage?.[role] || (type === 'crown' ? 40 : 6)), { trial: true });
      say(`You take up the post of ${role} at ${bz.name}.`);
      if (['monarch', 'consort', 'heir'].includes(role) && bz.b && bz.b.royal) depose(s, bz.b, role);
      else if (['lord', 'lady'].includes(role)) unlord(s);
    };
    // a new monarch: the old royal family are royal no more. They lose their titles and leave the castle for
    // the best empty house in the town (or, with none to be had, for the road and a quieter life elsewhere)
    function depose(s, keep, role) {
      const fam = s.people.filter((q) => q.royal && q.alive !== false);
      if (role === 'monarch' || role === 'consort') {
        const hhs = [...new Set(fam.map((q) => q.household))].map((id) => s.households[id - 1]).filter(Boolean);
        // their royal posts go with the crown, and their crowns and robes with them
        for (const q of fam) if (q.job && ['monarch', 'consort', 'heir', 'prince', 'princess'].includes(q.job.role)) { const bz0 = s.biz.get(q.job.biz); if (bz0) bz0.workers = bz0.workers.filter((id) => id !== q.id); q.job = null; }
        for (const q of fam) { q.formerTitle = q.title; q.royal = false; if (q.name && q.title && q.name.startsWith(q.title + ' ')) q.name = q.name.slice(q.title.length + 1); q.title = null; s.remember(q, `Lost the crown. ${O.Forge.player?.name || 'The stranger'} sits on the throne now.`, 'politics', 3, 0); s.relate(q, { id: 0 }, -0.8); }
        for (const hh of hhs) {
          const house = s.emptyHouses().sort((a, b) => (b.wealth || 0) - (a.wealth || 0) || b.w * b.d - a.w * a.d)[0];
          if (house) s.moveHousehold(hh, house); else { hh.gone = true; for (const id of hh.members) { const q = s.byId.get(id); if (q) { q.agent.hidden = true; q.visitor = true; q.task = { act: 'leave', outdoor: true, zone: 'east' }; } } }
          if (O.Interior) O.Interior.invalidate(keep);
        }
        for (const q of fam) { try { s.refreshLook(q); } catch (e) { /* */ } }
        if (fam.length) { const old = fam.find((q) => q.formerTitle === 'King' || q.formerTitle === 'Queen'); s.log(`${old ? old.first + ', once ' + (old.formerTitle === 'King' ? 'king' : 'queen') + ',' : 'The old royal family'} has left the castle. ${O.Forge.player?.name || 'The stranger'} holds the crown.`, 'politics'); say('The old royal family pack their things and leave the castle. Their titles go with the crown: to you.'); }
        const K = O.SimRef.home.kingdom, R = K && K.rulers;
        if (R) { const me = O.Forge.player || {}; R.crown = { name: me.name || 'the stranger', sex: me.sex || me.a?.sex || 'm', age: 30, regnal: 'I', since: s.day, player: true, heir: R.crown && R.crown.heir }; R.reigns.push({ who: `${me.sex === 'f' ? 'Queen' : 'King'} ${me.name || ''}`, from: s.day, to: null, how: 'took the crown' }); }
      } else if (role === 'heir') { const h = fam.find((q) => q.title === 'Prince' || q.title === 'Princess'); if (h) { h.formerTitle = h.title; h.heirNoMore = true; } }
      PS.royal = role === 'monarch' || role === 'consort';
    }
    // the crown is yours wherever you took it: the old royal family steps down as soon as you're among them
    game.hooks.update.push(() => {
      const s = cur(); if (!s || !O.crowned || !O.crowned() || s._deposedFor === 'player') return;
      const keep = s.world.buildings.find((b) => b.royal); if (!keep) return;
      s._deposedFor = 'player';
      if (s.people.some((q) => q.royal && q.alive !== false)) depose(s, keep, posts().some((x) => x.role === 'monarch') ? 'monarch' : 'consort');
    });
    function unlord(s) {
      const l = s.people.find((q) => q.lordOf && q.alive !== false); if (!l) return;
      l.formerTitle = l.title; if (l.name && l.title && l.name.startsWith(l.title + ' ')) l.name = l.name.slice(l.title.length + 1); l.title = null; l.lordOf = null;
      s.log(`${l.first} is lord here no longer.`, 'politics');
    }

    // ---------------------------------------------------------------- the sim keeps its count of who works where
    const SP = O.Sim.prototype, _vac = SP.vacancies;
    void _vac; void home;
  }
  O.EmploymentSetup = { setup };
})();
