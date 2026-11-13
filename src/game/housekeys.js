// The key to the door. Taking a house isn't a line in a register: whoever lets or sells it to you puts a
// heavy iron key in your hand, then walks you round to the door and stands by while you turn it in the lock
// for the first time. Every house you hold is a key in your satchel; sell it or give up the lease and you
// hand the key back. Lose it (a cutpurse, a tumble in the mud) and your own door is shut to you: climb in
// at the back window, which the neighbours may take amiss, or ask a smith in your own words to fit a new lock.
'use strict';
(function () {
  const T = 16;
  function setup(game) {
    const cur = () => O.SimRef.cur, PS = O.PlayerState;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    const say = (q, t, secs) => O.Speech && O.Speech.say(q, t, secs || 2.2);
    const ui = (t, k) => O.UI && O.UI.say && O.UI.say(t, k || 'info');
    const near = (x, y, r) => Math.hypot(x - game.player.x, y - game.player.y) < r;
    const talking = (q) => O.npcUI && O.npcUI.talking && O.npcUI.talking() === q;
    const keys = () => (PS.houseKeys = PS.houseKeys || {});
    const mineIn = (s) => s.world.buildings.filter((b) => b.doorX != null && ((b.owner && b.owner.kind === 'player') || (PS.lease && PS.lease.place === s.world.placeId && PS.lease.b === b.id && b.leasedToPlayer)));
    const keyFor = (s, b) => s.world.placeId + ':' + b.id;
    const nKeys = () => (PS.items || []).filter((k) => k === 'key').length;
    let known = null, H = null, handed = 0, unlocked = 0, climbed = 0, refitted = 0, back = 0;
    const rel_ = (q) => { if (!q || !q._hkey) return; q._hkey = false; if (q.agent) { q.agent.forceAnim = null; if (!talking(q)) q.agent.frozen = false; } };
    function giver(s, b) { // the clerk you were just talking to, the seller, or anyone official close by
      const P = game.player; const cands = s.people.filter((q) => q.alive !== false && q.agent && !q.agent.hidden && q.age >= 16 && (talking(q) || Math.hypot(q.agent.x - P.x, q.agent.y - P.y) < 140));
      return cands.find((q) => talking(q)) || cands.find((q) => /clerk|reeve|steward|agent|priest|bailiff/.test(q.job?.role || '')) || cands.filter((q) => Math.hypot(q.agent.x - P.x, q.agent.y - P.y) < 60).sort((a, c) => Math.hypot(a.agent.x - P.x, a.agent.y - P.y) - Math.hypot(c.agent.x - P.x, c.agent.y - P.y))[0] || null; }
    function handOver(s, b) { const k = keys(); k[keyFor(s, b)] = true; PS.add ? PS.add('key') : PS.items.push('key'); handed++;
      const q = giver(s, b); if (!q || game.scene) { ui(`A boy runs up with the key to ${b.name && !/^House$/.test(b.name) ? b.name : 'your house'}: heavy iron, warm from his hand.`, 'good'); return; }
      O.gesture && O.gesture(q, 'give', 1.2); O.NpcActs && O.NpcActs.fly && O.NpcActs.fly(q, 'player', 'key'); O.sfx && O.sfx('coins', 0.15);
      H = { s, b, q, t: 0, at: false }; q._hkey = true;
      setTimeout(() => { if (!H || H.q !== q) return; O.npcUI && O.npcUI.closeTalk && talking(q) && O.npcUI.closeTalk(); say(q, 'Come, I\'ll walk you round to it.', 2); O.Errands.send(s, q, [b.doorX + 1, b.doorY + 1], { anim: 'idle', secs: 0.2, face: 2, giveUp: game.t + 90, after: (ok) => { if (!H || H.q !== q) return; if (!ok) { rel_(q); H = null; return; } q.agent.frozen = true; q.agent.path = null; H.at = true; say(q, 'Here she is. Go on, it\'s your key.', 2.4); } }); }, 1600); }
    function takeBack(s, id) { const i = PS.items.indexOf('key'); if (i >= 0) PS.items.splice(i, 1); delete keys()[id]; back++; ui('You hand over the key.', 'info'); }
    game.hooks.update.push((dt) => { const s = cur(); if (!s || !s.world) return;
      // a house newly yours: a key in the hand; a house gone: the key handed back
      const now = new Set(mineIn(s).map((b) => keyFor(s, b))); if (known && known.place === s.world.placeId) { for (const id of now) if (!known.set.has(id) && !keys()[id]) { const b = s.building(+id.split(':')[1]); if (b) handOver(s, b); } for (const id of known.set) if (!now.has(id) && keys()[id]) takeBack(s, id); }
      known = { place: s.world.placeId, set: now };
      // old saves: a key for every house already held
      for (const id of now) if (keys()[id] == null) { keys()[id] = true; if (nKeys() < now.size) PS.items.push('key'); }
      if (H) { H.t += dt; if (H.s !== s || H.t > 120 || H.q.alive === false) { rel_(H.q); H = null; } } });
    // the first turn of the key
    (O.moreCandidates = O.moreCandidates || []).push(() => { const P = game.player; if (!H || !H.at || game.scene || P.locked) return null; const b = H.b; if (!near(b.doorX * T + 8, (b.doorY + 1) * T + 4, 36)) return null;
      return { type: 'custom', d: 1, x: b.doorX * T + 8, y: b.doorY * T - 18, label: 'Turn your new key in the lock', act: () => { const q = H.q, s = cur(); P.anim = 'take'; P.dir = 0; O.sfx && O.sfx('door', 0.5); unlocked++; ui('The key grinds round, the bolt shoots back. Your own door.', 'good'); say(q, pick(['Welcome home.', 'There. May you be happy in it.', 'Mind the step, it\'s worn.']), 2.2); try { s.remember(q, 'Walked the stranger round to their new house and watched them turn the key.', 'social', 0.5); const r = q.rel.get(0) || { affinity: 0, familiar: 0 }; r.familiar = Math.min(1, (r.familiar || 0) + 0.1); q.rel.set(0, r); } catch (e) { /* */ } setTimeout(() => { P.anim = 'idle'; rel_(q); H = null; }, 1200); } }; });
    // locked out: no key, no way in by the door
    const _enter = game.enterBuilding.bind(game);
    game.enterBuilding = function (b, floor, fromStairs) { try { const s = cur(); if (!fromStairs && !game.scene && s && b && keys()[keyFor(s, b)] === true && mineIn(s).includes(b) && nKeys() === 0 && !b._open) { ui('Your door is locked, and your key is gone. Climb in at the back window, or have a smith fit a new lock.', 'warn'); O.sfx && O.sfx('door', 0.2); return; } } catch (e) { console.error(e); } return _enter(b, floor, fromStairs); };
    (O.moreCandidates = O.moreCandidates || []).push(() => { const P = game.player, s = cur(); if (game.scene || P.locked || !s || !s.world || nKeys() > 0) return null; const b = mineIn(s).find((b) => near(b.doorX * T + 8 + 22, (b.doorY + 1) * T, 26)); if (!b) return null;
      return { type: 'custom', d: 2, x: b.doorX * T + 30, y: b.doorY * T - 16, label: 'Climb in at your own back window', act: () => { P.locked = true; P.anim = 'climb' in (O.Char.ANIMS || {}) ? 'climb' : 'hammer'; P.lift = 10; climbed++;
        const w = s.people.find((q) => q.alive !== false && q.agent && !q.agent.hidden && q.agent.inside == null && q.age >= 12 && near(q.agent.x, q.agent.y, 200) && !talking(q));
        if (w) { O.gesture && O.gesture(w, 'shocked', 1.5); say(w, pick(['Oi! Thief! ...Oh. It\'s you. Lost your key, have you?', 'Hey! Get down from there! ...Oh, it\'s your own house.']), 2.6); }
        setTimeout(() => { P.lift = 0; P.locked = false; P.anim = 'idle'; b._open = true; ui('You squeeze through the shutter and drop onto your own floor. The door can be unbolted from inside.', 'info'); _enter(b, 0); }, 2600); } }; });
    // a new lock, in your own words, from a smith
    const respond = (q, t, line, render) => { (q._conv ||= []).push({ who: 'p', t }, { who: 'q', t: line }); render(line); return Promise.resolve(); };
    const _say = O.AIChat && O.AIChat.say;
    if (_say) O.AIChat.say = function (q, text, render) { try { const s = cur(), t = String(text || '');
      if (s && /smith|locksmith|carpenter/.test(q.job?.role || '') && /\b(key|lock)\b/i.test(t) && /\b(lost|new|make|fit|cut|need|gone|stolen)\b/i.test(t)) { const mine = mineIn(s); if (!mine.length) return respond(q, t, 'A key for what? You\'ve no door here that I know of.', render); if (nKeys() >= mine.length) return respond(q, t, 'You\'ve a key already, by the look of that satchel.', render);
        if ((PS.money || 0) < 2) return respond(q, t, 'Two aurin for a new lock and key. Come back when you have it.', render);
        PS.money -= 2; const hh = s.household(q); if (hh) hh.money = (hh.money || 0) + 2; refitted++; PS.items.push('key'); for (const b of mine) b._open = false; setTimeout(() => { O.gesture && O.gesture(q, 'give', 1); O.NpcActs && O.NpcActs.fly && O.NpcActs.fly(q, 'player', 'key'); O.sfx && O.sfx('smack', 0.2); }, 900);
        return respond(q, t, 'Two aurin. I\'ve a lock and key here that\'ll fit your door; I\'ll be round to change it. Here, take the key.', render); } } catch (e) { console.error(e); } return _say.apply(this, arguments); };
    (O.extraLines = O.extraLines || []).push((s, q) => H && q === H.q ? 'You have just handed the player the key to their new house and are walking them round to it.' : '');
    O.HouseKeys = { get hand() { return H; }, get handed() { return handed; }, get unlocked() { return unlocked; }, get climbed() { return climbed; }, get refitted() { return refitted; }, get back() { return back; }, mineIn };
  }
  O.HouseKeysSetup = { setup };
})();
