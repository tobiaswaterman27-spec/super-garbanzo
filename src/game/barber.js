// The barber-surgeon's chair. Ask for your hair or beard to be done and you choose from the same
// styles as when you were made; the barber says back what you've asked for and the price and asks if
// you're sure, and you answer in your own words. Then you sit, they walk round you with the shears or
// the razor, and the clippings fall to the floor in your own colour, among everyone else's, until the
// barber sweeps them up. No coin, no cut. Townsfolk come in for a trim too, and hair grows back.
'use strict';
(function () {
  const M_LEN = { bald: 0, crop: 1, short: 2, messy: 2, shaggy: 3 };
  const B_LEN = { none: 0, stubble: 1, moustache: 2, goatee: 2, full: 3, long: 4 };
  const SAY_HAIR = { short: 'cut short and neat', crop: 'cropped close to the head', messy: 'cut rough and tousled', bald: 'shaved clean off', shaggy: 'evened up and left long and shaggy',
    long: 'trimmed and left long', bun: 'put up in a bun', braid: 'braided', tied: 'tied back', curly: 'curled with the tongs', veil: 'dressed and put up under a veil' };
  const SAY_BEARD = { none: 'shaved clean off', stubble: 'cut down to stubble', moustache: 'shaved to a moustache', goatee: 'trimmed to a goatee', full: 'trimmed into a full beard', long: 'combed out long' };
  const CUT_SECS = 7;
  function setup(game) {
    const PS = O.PlayerState, cur = () => O.SimRef.cur, now = () => performance.now();
    const isBarber = (q) => q && q.job?.role === 'barber-surgeon' && q.activity?.act === 'work';
    const hairHex = (a) => { const r = O.Pal.mats[a.hair]; return (r && r.hex) || '#5a3a20'; };
    const chairOf = (sc) => { if (!sc) return null; const it = sc.L.items.filter((i) => i.kind === 'chair' || i.kind === 'stool'); return it[0] || null; };
    const spec = () => Object.assign({}, O.Forge.spec());
    const cap = (t) => t[0].toUpperCase() + t.slice(1);

    // ---------------------------------------------------------------- the menu, on the talk card
    const npcUI = O.npcUI, prevExtra = npcUI.extraButtons, prevOn = npcUI.onExtra;
    npcUI.extraButtons = (q) => { const out = prevExtra ? prevExtra(q) : []; if (isBarber(q) && game.scene) out.push(['hair', 'Have your hair or beard done']); return out; };
    npcUI.onExtra = (q, key, render) => { if (key === 'hair') return menu(q); return prevOn && prevOn(q, key, render); };
    function thumb(patch) {
      const sp = Object.assign(spec(), { hat: 'none' }, patch), a = O.Creator.appearanceFromSpec(sp), fr = O.Char.frame(a, 0, 'idle', 0);
      const c = document.createElement('canvas'); c.width = 60; c.height = 60; const x = c.getContext('2d'); x.imageSmoothingEnabled = false; x.drawImage(fr, 6, O.Char.FH - 48, 20, 20, 0, 0, 60, 60); return c.toDataURL();
    }
    function menu(q) {
      const sp = spec(), styles = sp.sex === 'f' ? O.Char.HAIR_STYLES_F : O.Char.HAIR_STYLES_M, beards = sp.sex === 'm' && sp.age >= 16 ? [...new Set(O.Char.BEARDS)] : [];
      const tile = (kind, v) => `<button class="cc-tile" data-k="${kind}" data-v="${v}" ${(kind === 'hair' ? sp.hairStyle : sp.beard) === v ? 'aria-pressed="true"' : ''}><img src="${thumb(kind === 'hair' ? { hairStyle: v } : { beard: v })}" width="60" height="60" style="image-rendering:pixelated" alt=""><br>${cap(v)}</button>`;
      O.Panels.open(`${q.first}'s chair`, `<div class="lbl">Hair <small>(₳3)</small></div><div class="cc-tiles">${styles.map((v) => tile('hair', v)).join('')}</div>${beards.length ? `<div class="lbl" style="margin-top:10px">Beard <small>(₳2)</small></div><div class="cc-tiles">${beards.map((v) => tile('beard', v)).join('')}</div>` : ''}`, (root) => {
        root.querySelectorAll('[data-k]').forEach((b) => { b.onclick = () => { O.Panels.close && O.Panels.close(); choose(q, b.dataset.k, b.dataset.v); }; });
      });
    }
    // they say back what you've asked for and ask if you're sure
    function choose(q, kind, v) {
      const sp = spec(), price = kind === 'hair' ? 3 : 2;
      const say = (t) => { if (npcUI.talking && npcUI.talking() === q) npcUI.speak(q, t); else npcUI.startFrom(q, t); };
      if (kind === 'hair' && sp.hairStyle === v) return say("It's that way already. I'll not take coin for cutting air.");
      if (kind === 'beard' && sp.beard === v) return say("That's how it is now. Nothing for me to do there.");
      if (kind === 'hair' && sp.sex === 'm' && (M_LEN[v] ?? 2) > (M_LEN[sp.hairStyle] ?? 2)) return say(`I can cut hair, not grow it. Let it come in a few weeks and I'll make it ${v} for you.`);
      if (kind === 'beard' && (B_LEN[v] ?? 0) > (B_LEN[sp.beard] ?? 0) && !(B_LEN[v] === 2 && B_LEN[sp.beard] === 2)) return say(`There's not enough there to make a ${v === 'none' ? 'clean chin' : v} of it yet. Give it time to grow.`);
      const desc = kind === 'hair' ? SAY_HAIR[v] || v : SAY_BEARD[v] || v;
      q._hairReq = { kind, v, price, desc };
      say(`Ah, so you'd have your ${kind === 'hair' ? 'hair' : 'beard'} ${desc}? That'll be ${price} aurins. You're sure?`);
    }
    // yes or no, in your own words
    O.addAsk && O.addAsk((q) => (q._hairReq ? { goal: `have their ${q._hairReq.kind} ${q._hairReq.desc} for ${q._hairReq.price} aurins (they chose it and you asked if they are sure: agree if they say yes in any words)`, why: '', onAgree: () => go(q) } : null));
    const YES = /^\s*(y|yes|yeah|yh|ye|yep|yup|aye|sure|ok|okay|go on|go ahead|do it|please|i'?m sure|certainly|of course|that'?s right|right)\b/i, NO = /^\s*(no|nah|nay|nope|wait|hold on|actually|not)\b/i;
    const _say = O.AIChat.say;
    O.AIChat.say = function (q, text, render, opt) {
      if (q && q._hairReq && typeof text === 'string') {
        if (YES.test(text)) { (q._conv = q._conv || []).push({ who: 'p', t: text }); go(q, render); return Promise.resolve(); }
        if (NO.test(text)) { q._hairReq = null; (q._conv = q._conv || []).push({ who: 'p', t: text }); const l = 'As you like. Another time.'; q._conv.push({ who: 'q', t: l }); render(l, false); return Promise.resolve(); }
      }
      return _say.apply(this, arguments);
    };
    // the cut itself
    function go(q, render) {
      const req = q._hairReq; if (!req) return; q._hairReq = null;
      const line = (t) => { (q._conv = q._conv || []).push({ who: 'q', t }); if (render) render(t, false); else npcUI.speak(q, t); };
      if (PS.money < req.price) {
        line(`${req.price} aurins, and you've not got them. No coin, no cut.`);
        const s = cur(); s && s.remember(q, 'Wanted a cut and had not the coin to pay.', 'player', 0.5, -0.05);
        O.noCoin && O.noCoin(q, req.price, 'a cut', () => { q._hairReq = req; go(q); });
        return;
      }
      const sc = game.scene, chair = chairOf(sc), P = game.player;
      line(pickOne(['Sit you down, then.', 'In the chair with you.', 'Right you are. Sit still, mind.']));
      setTimeout(() => {
        npcUI.closeTalk && npcUI.closeTalk();
        if (chair && sc === game.scene) { const pose = sc.seatPose(chair); P.sitting = Object.assign(pose, { it: chair, sx: P.x, sy: P.y, b: sc.b.id, floor: sc.floor }); P.x = pose.x; P.y = pose.y; P.dir = pose.dir; P.anim = 'sit'; }
        P.locked = true; const until = now() + CUT_SECS * 1000;
        q._snip = { until, x: P.x, y: P.y, who: 0, col: hairHex(P._baseA || P.a), b: sc && sc.b.id };
        setTimeout(() => finish(q, req), CUT_SECS * 1000);
      }, 900);
    }
    function finish(q, req) {
      const P = game.player, sp = spec(); q._snip = null; P.locked = false;
      if (req.kind === 'hair') sp.hairStyle = req.v; else sp.beard = req.v;
      const old = O.Forge.player, a = O.Creator.appearanceFromSpec(sp); if (old && old.outfit) a.outfit = old.outfit; if (old) a.age = old.age;
      O.Forge.setPlayer(a, sp); if (P._baseA) P._baseA = a; else game.setPlayerAppearance(a);
      PS.money -= req.price; const s = cur(), bz = s && q.job && s.biz.get(q.job.biz); if (bz) { bz.cash += req.price; bz.salesToday = (bz.salesToday || 0) + req.price; }
      if (req.kind === 'hair') PS.lastCut = s ? s.day : 0; else PS.lastShave = s ? s.day : 0;
      // a cheap or a drunk hand slips
      if ((q.tipsy || (q.skill ?? 0.5) < 0.3) && Math.random() < 0.3) { O.Panels.toast(`${q.first}'s blade slips. A nick, and a bead of blood.`, 'bad'); O.Speech && O.Speech.say(q, 'Ah. Sorry. Hold still.', 3); }
      else O.Speech && O.Speech.say(q, pickOne(['There. Look in the basin.', 'Done. Handsome as a lord.', 'There you are. Mind the draught on your neck.']), 4);
      O.Panels.toast(`Your ${req.kind} ${req.desc}. (₳${req.price})`); O.NpcActs && O.NpcActs.fly && setTimeout(() => O.NpcActs.fly('player', q, 'coin'), 500);
      if (P.sitting) { P.x = P.sitting.sx; P.y = P.sitting.sy; P.sitting = null; P.anim = 'idle'; }
      s && s.remember(q, `Cut the player's ${req.kind}.`, 'player', 0.4, 0.05);
    }
    const pickOne = (a) => a[Math.floor(Math.random() * a.length)];

    // ---------------------------------------------------------------- clippings on the floor, and the broom
    const clipsOf = (b) => (b.clippings = b.clippings || []);
    let dropT = 0, npcT = 8;
    game.hooks.update.push((dt) => {
      const sc = game.scene, s = cur(); if (!s) return;
      // snipping: hair falls round the chair
      dropT -= dt;
      if (sc && dropT <= 0) { dropT = 0.35;
        for (const a of sc.actors.values()) { const q = a.person, sn = q && q._snip; if (!sn || sn.until < now() || sn.b !== sc.b.id) continue;
          const c = clipsOf(sc.b); if (c.length < 140) c.push({ x: sn.x + (Math.random() - 0.5) * 22, y: sn.y + 2 + (Math.random() - 0.5) * 10, col: sn.col, r: Math.random() * Math.PI, l: 2 + Math.floor(Math.random() * 3) }); }
      }
      // townsfolk in for a trim
      npcT -= dt; if (npcT > 0) return; npcT = 9;
      if (sc && sc.b) {
        const barber = [...sc.actors.values()].map((a) => a.person).find((q) => isBarber(q) && q.job.biz === sc.b.id);
        if (!barber || barber._snip || barber._sweep) return;
        const chair = chairOf(sc); if (!chair) return;
        const c = clipsOf(sc.b);
        if (c.length > 24 && Math.random() < 0.5) { barber._sweep = now() + 8000; return; }
        const cust = [...sc.actors.values()].map((a) => a.person).find((q) => q && q !== barber && q.age >= 12 && q.activity?.act !== 'work' && !q.agent.frozen && (q._trimmed || -9) < s.day - 6);
        if (cust && Math.random() < 0.6) { const [ax, ay] = sc.anchor(chair); cust._trimmed = s.day; cust._inChair = { until: now() + CUT_SECS * 1000, it: chair, b: sc.b.id };
          barber._snip = { until: now() + CUT_SECS * 1000, x: ax, y: ay - 6, who: cust.id, col: hairHex(cust.app), b: sc.b.id };
          setTimeout(() => { barber._snip = null; trimNpc(cust); }, CUT_SECS * 1000); }
      }
    });
    // what a trim does to someone: a beard taken in, long hair evened
    function trimNpc(q) { const a = q.app; if (!a) return; if (a.beard === 'long' && Math.random() < 0.6) a.beard = 'full'; else if (a.beard === 'full' && Math.random() < 0.3) a.beard = 'goatee'; else if (a.hairStyle === 'shaggy' && Math.random() < 0.6) a.hairStyle = 'short'; else if (a.hairStyle === 'messy' && Math.random() < 0.5) a.hairStyle = 'crop'; O.Char.invalidate && O.Char.invalidate(a); }
    // the shop is never swept clean by magic: off-stage, the day's customers leave their hair and the barber sweeps of a morning
    const SP = O.Sim.prototype, _nd = SP.newDay;
    SP.newDay = function () {
      const r = _nd.apply(this, arguments);
      try {
        for (const bz of this.biz.values()) { if (bz.type !== 'barber' && !(bz.def && bz.def.jobs && bz.def.jobs.some(([x]) => x === 'barber-surgeon'))) continue; const b = this.building ? this.building(bz.id) : null; if (!b) continue; const c = clipsOf(b);
          c.splice(0, Math.ceil(c.length * 0.7));
          const men = this.people.filter((q) => q.app && q.age >= 14).sort(() => Math.random() - 0.5).slice(0, 2 + Math.floor(Math.random() * 3));
          for (const q of men) for (let k = 0; k < 6; k++) c.push({ x: null, y: null, rx: Math.random(), ry: Math.random(), col: hairHex(q.app), r: Math.random() * Math.PI, l: 2 + Math.floor(Math.random() * 3) });
        }
        growPlayer(this);
      } catch (e) { /* */ }
      return r;
    };
    // hair grows back
    function growPlayer(s) {
      const sp = spec(); if (sp.sex !== 'm') return; let changed = false;
      const LADDER = ['bald', 'crop', 'short', 'shaggy'];
      if (PS.lastCut == null) PS.lastCut = s.day; if (PS.lastShave == null) PS.lastShave = s.day;
      if (s.day - PS.lastCut >= 21) { const i = LADDER.indexOf(sp.hairStyle); if (i >= 0 && i < LADDER.length - 1) { sp.hairStyle = LADDER[i + 1]; changed = true; } PS.lastCut = s.day; }
      const sinceShave = s.day - PS.lastShave;
      if (sp.age >= 16 && ((sp.beard === 'none' && sinceShave >= 4) || (sp.beard === 'stubble' && sinceShave >= 28))) { sp.beard = sp.beard === 'none' ? 'stubble' : 'full'; PS.lastShave = s.day; changed = true; }
      if (!changed) return; const P = game.player, old = O.Forge.player, a = O.Creator.appearanceFromSpec(sp); if (old && old.outfit) a.outfit = old.outfit; if (old) a.age = old.age;
      O.Forge.setPlayer(a, sp); if (P._baseA) P._baseA = a; else game.setPlayerAppearance(a);
    }
    // the sweeping: the barber takes the broom to it, a little at a time
    game.hooks.update.push(() => {
      const sc = game.scene; if (!sc) return;
      for (const a of sc.actors.values()) { const q = a.person; if (!q || !q._sweep) continue; if (q._sweep < now()) { q._sweep = null; continue; } const c = clipsOf(sc.b); if (c.length && Math.random() < 0.12) { c.sort((u, v) => Math.hypot(u.x - a.x, u.y - a.y) - Math.hypot(v.x - a.x, v.y - a.y)); c.shift(); } }
    });
    const _ex = O.sceneExtras;
    O.sceneExtras = (sc, ctx, cam) => {
      const out = _ex ? _ex(sc, ctx, cam) : []; const c = sc.b.clippings; if (!c || !c.length) return out;
      const chair = chairOf(sc); let cx = 0, cy = 0; if (chair) [cx, cy] = sc.anchor(chair);
      for (const k of c) { if (k.x == null) { k.x = cx + (k.rx - 0.5) * 40; k.y = cy - 4 + (k.ry - 0.5) * 18; } }
      out.push({ y: -0.5, draw: () => { for (const k of c) { ctx.fillStyle = k.col; const x = Math.round(k.x - cam.x), y = Math.round(k.y - cam.y), dx = Math.round(Math.cos(k.r) * k.l), dy = Math.round(Math.sin(k.r) * k.l * 0.5); ctx.fillRect(x, y, 1, 1); ctx.fillRect(x + dx, y + dy, 1, 1); if (k.l > 2) ctx.fillRect(x + Math.round(dx / 2), y + Math.round(dy / 2), 1, 1); } } });
      return out;
    };
    O.Barber = { menu, choose, go };
  }
  O.BarberSetup = { setup };
})();
