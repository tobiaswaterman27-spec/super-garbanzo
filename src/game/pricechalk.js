// The price on the slate. Every shop that sells to the street has a chalk slate on legs by its door with
// what it sells and what it asks, in real numbers: the same price you'd pay at the counter. When the price
// moves (stock runs low, a rival undercuts, the owner turns greedy) somebody from the shop comes out with a
// rag, rubs the old figure out and chalks the new one, and whoever is passing says what they think of it.
// Nobody minding the shop means the chalk goes stale, and the counter price may not match the slate.
// Townsfolk stop and read slates on their way past; your own shop has one too, and you chalk it yourself.
'use strict';
(function () {
  const T = 16;
  // a 3x5 chalk hand for figures
  const DIG = ['111101101101111', '010110010010111', '111001111100111', '111001111001111', '101101111001001', '111100111001111', '111100111101111', '111001010010010', '111101111101111', '111101111001111'];
  function chalk(ctx, x, y, n, col) { const s = String(n); ctx.fillStyle = col || '#e8e4d8'; for (let k = 0; k < s.length; k++) { const d = DIG[+s[k]]; if (!d) continue; for (let i = 0; i < 15; i++) if (d[i] === '1') ctx.fillRect(x + k * 4 + (i % 3), y + Math.floor(i / 3), 1, 1); } }
  function setup(game) {
    const cur = () => O.SimRef.cur, PS = O.PlayerState, G = O.Data && O.Data.GOODS || {};
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    const say = (q, t, secs) => O.Speech && O.Speech.say(q, t, secs || 2.2);
    const ui = (t, k) => O.UI && O.UI.say && O.UI.say(t, k || 'info');
    const near = (x, y, r) => Math.hypot(x - game.player.x, y - game.player.y) < r;
    const talking = (q) => O.npcUI && O.npcUI.talking && O.npcUI.talking() === q;
    const gname = (g) => ((G[g] && G[g].name) || g).toLowerCase();
    let acc = 0, readAcc = 4, rubbed = 0, read = 0, stale = 0, mine = 0, youChalked = 0; const going = new Set();
    // where a shop's slate stands: a free tile beside the door
    function spot(s, bz) { if (bz._slate !== undefined) return bz._slate; const b = bz.b; bz._slate = null; if (!b || b.doorX == null) return null; const W = s.world;
      for (const dx of [1, -1, 2, -2]) { const tx = b.doorX + dx, ty = b.doorY + 1; if (W.solid[ty * W.W + tx] || W.solid[(ty + 1) * W.W + tx]) continue; bz._slate = { tx, ty, x: tx * T + 8, y: ty * T + 12 }; break; }
      return bz._slate; }
    const goods = (bz) => (bz.def && bz.def.sells || []).filter((g) => G[g]).slice(0, 3);
    const priceNow = (s, bz, g) => { try { return s.price(bz, g); } catch (e) { return null; } };
    const ownedByYou = (bz) => bz.b && bz.b.owner && bz.b.owner.kind === 'player';
    const shown = (s) => [...(s.biz || new Map()).values()].filter((bz) => goods(bz).length && bz.b && bz.b.doorX != null && near(bz.b.doorX * T, bz.b.doorY * T, 420) && spot(s, bz));
    function keeperOf(s, bz) { const ids = [bz.owner, ...(bz.workers || [])].filter((x) => x != null && x !== 'player'); return ids.map((id) => s.byId.get(id)).find((q) => q && q.alive !== false && q.agent && !q.errand && !talking(q) && !q.jailUntil && q.activity?.act === 'work' && q.age >= 12) || null; }
    function rechalk(bz, now) { bz._chalk = Object.assign({}, now); bz._chalkDay = (cur() || {}).day; }
    game.hooks.update.push((dt) => { const s = cur(); if (!s || !s.world || !s.biz) return; acc += dt; if (acc < 1) return; acc = 0;
      for (const bz of shown(s)) { const now = {}; for (const g of goods(bz)) now[g] = priceNow(s, bz, g); if (!bz._chalk) { rechalk(bz, now); continue; }
        const diff = goods(bz).filter((g) => now[g] != null && bz._chalk[g] !== now[g]); if (!diff.length || going.has(bz.id)) continue;
        if (ownedByYou(bz)) continue; // yours is yours to chalk
        if (!near(bz.b.doorX * T, bz.b.doorY * T, 360) || game.scene) { rechalk(bz, now); continue; }
        const q = keeperOf(s, bz), sp = bz._slate; if (!q) { stale++; continue; }
        going.add(bz.id); const old = Object.assign({}, bz._chalk);
        O.Errands.send(s, q, [sp.tx, sp.ty + 1], { anim: 'scrub', secs: 1.8, face: 0, giveUp: game.t + 40, after: (ok) => { going.delete(bz.id); if (!ok) return; const fresh = {}; for (const g of goods(bz)) fresh[g] = priceNow(s, bz, g); rechalk(bz, fresh); rubbed++; O.gesture && O.gesture(q, 'point', 1);
          const up = goods(bz).find((g) => fresh[g] > (old[g] || 0)), down = goods(bz).find((g) => fresh[g] < (old[g] || 99));
          if (near(sp.x, sp.y, 320)) { if (up) say(q, pick([`${gname(up)[0].toUpperCase() + gname(up).slice(1)}'s gone up. Not my doing.`, 'There. Don\'t look at me like that.', 'Prices are prices.']), 2); else if (down) say(q, pick([`${gname(down)[0].toUpperCase() + gname(down).slice(1)}, cheaper today!`, 'Come and get it while it lasts.']), 2);
            const by = s.people.find((z) => z !== q && z.age >= 14 && z.agent && !z.agent.hidden && z.agent.inside == null && !z.errand && !talking(z) && Math.hypot(z.agent.x - sp.x, z.agent.y - sp.y) < 110);
            if (by && up) setTimeout(() => { say(by, pick([`${fresh[up]} for ${gname(up)}? Thieves, the lot of you.`, `Up again! My mother paid half that.`, `${fresh[up]} aurin. I'll go without.`]), 2.4); O.gesture && O.gesture(by, 'shake', 1.2); }, 1400);
            else if (by && down) setTimeout(() => { say(by, pick(['About time.', `${fresh[down]}? I'll have some of that.`]), 2); O.gesture && O.gesture(by, 'nod', 1); }, 1400); } } }); } });
    // folk stop to read the slate on their way past
    game.hooks.update.push((dt) => { readAcc -= dt; if (readAcc > 0) return; readAcc = 5 + Math.random() * 5; const s = cur(); if (!s || !s.biz || game.scene) return;
      for (const bz of shown(s)) { const sp = bz._slate; if (!bz._chalk || !near(sp.x, sp.y, 300)) continue; const q = s.people.find((z) => z.age >= 12 && z.agent && !z.agent.hidden && z.agent.inside == null && !z.errand && !z.agent.frozen && !talking(z) && !z._coup && Math.hypot(z.agent.x - sp.x, z.agent.y - sp.y) < 40 && ![bz.owner, ...(bz.workers || [])].includes(z.id)); if (!q) continue;
        O.Errands.send(s, q, [sp.tx, sp.ty + 1], { anim: 'idle', secs: 1.6, face: 0, giveUp: game.t + 12, after: (ok) => { if (!ok) return; read++; const g = goods(bz)[0], p = bz._chalk[g], base = (G[g] && G[g].base) || 3; if (near(sp.x, sp.y, 260)) { if (p > base * 1.4) { say(q, pick([`${p} for ${gname(g)}? Robbery.`, 'Not at that price.']), 2); O.gesture && O.gesture(q, 'shake', 1); } else if (p < base * 0.9) { say(q, pick([`${gname(g)[0].toUpperCase() + gname(g).slice(1)}'s cheap. I'll take some.`, 'Cheap today.']), 2); O.gesture && O.gesture(q, 'nod', 1); } } } }); break; } });
    // the slates themselves
    game.hooks.drawGround.push((ctx, cam) => { const s = cur(); if (!s || !s.biz || game.scene) return;
      for (const bz of shown(s)) { if (!bz._chalk) continue; const sp = bz._slate, gs = goods(bz), h = 6 + gs.length * 8, w = 24, x = Math.round(sp.x - w / 2 - cam.x), y = Math.round(sp.y - h - 6 - cam.y);
        ctx.fillStyle = '#5a3d26'; ctx.fillRect(x + 3, y + h - 1, 2, 8); ctx.fillRect(x + w - 5, y + h - 1, 2, 8); ctx.fillStyle = '#8a6239'; ctx.fillRect(x, y, w, h + 1); ctx.fillStyle = '#2a2e32'; ctx.fillRect(x + 1, y + 1, w - 2, h - 1); ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(x + 2, y + 2, w - 4, 1);
        gs.forEach((g, i) => { const yy = y + 3 + i * 8; try { ctx.drawImage(O.ItemArt.small(g), x + 2, yy - 1, 8, 8); } catch (e) { /* */ } const p = bz._chalk[g]; if (p != null) chalk(ctx, x + 12, yy + 1, Math.min(99, p), ownedByYou(bz) ? '#f2e2a0' : null); });
        if (going.has(bz.id)) { ctx.fillStyle = 'rgba(232,228,216,0.35)'; ctx.fillRect(x + 11, y + 3, 10, h - 5); } } });
    // read it; and if it's yours, chalk it
    const atSlate = (s) => shown(s).find((bz) => bz._chalk && near(bz._slate.x, bz._slate.y + 6, 26));
    (O.moreCandidates = O.moreCandidates || []).push(() => { const s = cur(), P = game.player; if (!s || game.scene || P.locked) return null; const bz = atSlate(s); if (!bz) return null; const sp = bz._slate;
      return { type: 'custom', d: 1, x: sp.x, y: sp.y - 34, label: `Read ${ownedByYou(bz) ? 'your' : 'the'} slate: ${goods(bz).map((g) => `${gname(g)} ₳${bz._chalk[g]}`).join(', ')}`, act: () => { P.dir = 0; P.anim = 'idle'; read++;
        const off = goods(bz).filter((g) => priceNow(s, bz, g) !== bz._chalk[g]); ui(`${bz.name}: ${goods(bz).map((g) => `${gname(g)}, ₳${bz._chalk[g]}`).join('; ')}.${off.length ? ` The chalk is smudged and old: inside, ${off.map((g) => `${gname(g)} is ₳${priceNow(s, bz, g)}`).join(', ')}.` : ''}`, 'info'); } }; });
    function chalkYours(bz, by) { const P = game.player; P.locked = true; P.dir = 0; P.anim = 'scrub'; going.add(bz.id); setTimeout(() => { const s = cur(); bz.markup = O.clamp((bz.markup || 1) + by, 0.7, 1.6); const now = {}; for (const g of goods(bz)) now[g] = priceNow(s, bz, g); rechalk(bz, now); going.delete(bz.id); youChalked++; P.locked = false; P.anim = 'idle';
        ui(`You rub out the old figures and chalk up ${goods(bz).map((g) => `${gname(g)} at ₳${now[g]}`).join(', ')}.`, 'info'); const by_ = s.people.find((z) => z.age >= 14 && z.agent && !z.agent.hidden && z.agent.inside == null && !talking(z) && near(z.agent.x, z.agent.y, 120)); if (by_) say(by_, by < 0 ? pick(['Now that\'s more like it.', 'Cheaper? I\'ll be in later.']) : pick(['Oh, come on.', 'Getting above yourself.']), 2); }, 1800); }
    (O.moreCandidates = O.moreCandidates || []).push(() => { const s = cur(), P = game.player; if (!s || game.scene || P.locked) return null; const bz = atSlate(s); if (!bz || !ownedByYou(bz) || going.has(bz.id) || (bz.markup || 1) <= 0.71) return null; mine++;
      return { type: 'custom', d: 2, x: bz._slate.x - 10, y: bz._slate.y - 46, label: 'Chalk your prices down a notch', act: () => chalkYours(bz, -0.1) }; });
    (O.moreCandidates = O.moreCandidates || []).push(() => { const s = cur(), P = game.player; if (!s || game.scene || P.locked) return null; const bz = atSlate(s); if (!bz || !ownedByYou(bz) || going.has(bz.id) || (bz.markup || 1) >= 1.59) return null;
      return { type: 'custom', d: 3, x: bz._slate.x + 10, y: bz._slate.y - 46, label: 'Chalk your prices up a notch', act: () => chalkYours(bz, 0.1) }; });
    // your own slate goes on chalked by you: refresh it when your stock alone moves the price and you're not looking
    game.hooks.update.push(() => { const s = cur(); if (!s || !s.biz || !game.scene) return; for (const bz of s.biz.values()) if (ownedByYou(bz) && bz._chalk && !going.has(bz.id)) { const now = {}; for (const g of goods(bz)) now[g] = priceNow(s, bz, g); if (goods(bz).some((g) => now[g] !== bz._chalk[g])) rechalk(bz, now); } });
    (O.extraLines = O.extraLines || []).push((s, q) => { if (!s || !s.biz || !q.job || q.job.biz == null) return ''; const bz = s.biz.get(q.job.biz); if (!bz || !bz._chalk) return ''; return `Your shop's slate by the door says: ${goods(bz).map((g) => `${gname(g)} ${bz._chalk[g]} aurin`).join(', ')}.`; });
    O.PriceChalk = { spot, shown, get rubbed() { return rubbed; }, get read() { return read; }, get stale() { return stale; }, get youChalked() { return youChalked; }, chalkYours, keeperOf, going };
  }
  O.PriceChalkSetup = { setup };
})();
