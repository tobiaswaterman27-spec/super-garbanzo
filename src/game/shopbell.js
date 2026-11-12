// The bell on the door. Walk into a shop or workshop in its hours and it rings; and if nobody's minding the
// place just then (the smith out at the horse trough, the butcher at the yard, the brewer round the back),
// someone comes hurrying in a moment later wiping their hands, "Coming, coming!", to serve you. An open
// shop is never a dead room.
'use strict';
(function () {
  function setup(game) {
    const cur = () => O.SimRef.cur;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    const talking = (q) => O.npcUI && O.npcUI.talking && O.npcUI.talking() === q;
    let sc = null, t = 0, summoned = null, rung = 0, came = 0;
    const SKIP = /^(house|barn|hideout|morgue|chapel|guard|lodge|claypit|peatcut|charcoal|vineyard|saltworks|farmhouse)$/;
    const bizOf = (s, b) => [...s.biz.values()].find((z) => (z.b?.id ?? z.id) === b.id);
    const openNow = (s, bz) => { if (!bz || !bz.open) return false; const h = s.minute / 60, hr = bz.def && bz.def.hours; return hr ? h >= hr[0] && h < hr[1] : h >= 8 && h < 18; };
    function release() { if (!summoned) return; const q = summoned; summoned = null; q._shopbell = false; if (q.agent && !talking(q)) q.agent.frozen = false; }
    game.hooks.update.push((dt) => { const s = cur(); if (!s) return;
      if (game.scene !== sc) { release(); sc = game.scene; t = 0; if (sc && sc.b && !SKIP.test(sc.b.type || '')) { const bz = bizOf(s, sc.b); if (openNow(s, bz)) { rung++; O.sfx && O.sfx('handbell', 0.12); } } return; }
      if (!sc || !sc.b || SKIP.test(sc.b.type || '')) return; t += dt;
      if (summoned) { if (t > 600) release(); return; }
      if (t < 1.6 || sc._bellTried) return; sc._bellTried = true;
      const bz = bizOf(s, sc.b); if (!openNow(s, bz) || !bz.workers || !bz.workers.length) return;
      const ws = bz.workers.map((id) => s.byId.get(id)).filter((q) => q && q.alive !== false && q.agent);
      if (ws.some((q) => q.agent.inside === sc.b.id)) return; // somebody's in
      const q = ws.find((q) => !q.agent.frozen && !q.errand && !q._scene && !q.jailUntil && !q.visitor && !(q.health && q.health.illness && q.health.illness.sev > 0.4) && !talking(q)); if (!q) return;
      const a = q.agent; a.inside = sc.b.id; a.hidden = true; a.path = null; a.goal = null; a.enteredAt = s.minute; a.frozen = true; q._shopbell = true; summoned = q; came++;
      setTimeout(() => { if (summoned === q && game.scene === sc) O.Speech && O.Speech.say(q, pick(['Coming, coming! I was round the back.', 'Sorry, sorry! I heard the bell.', 'There you are. What can I do for you?', 'One moment! Wiping my hands.']), 2.4); }, 900); });
    (O.extraLines = O.extraLines || []).push((s, q) => q === summoned ? 'You were out at the back of your place of work and came hurrying in when the door bell rang, to serve the player.' : '');
    O.ShopBell = { get rung() { return rung; }, get came() { return came; }, get summoned() { return summoned; } };
  }
  O.ShopBellSetup = { setup };
})();
