// What a household has in, you can see. Step into a cottage and its larder is laid out where it would be:
// loaves and a cabbage or two on the table, fish and a joint of meat on the dresser, sacks of flour and
// grain on the floor by the chest, a cask of ale beside the barrel, the woodpile stacked by the hearth.
// It is the household's real pantry: it fills on market day and empties as they eat, so a poor house
// looks bare and a hungry one has nothing on the table at all.
'use strict';
(function () {
  function setup(game) {
    const cur = () => O.SimRef.cur;
    const TABLE = ['bread', 'meal', 'cabbage', 'eggs', 'honey', 'cheese', 'apples'], SHELF = ['fish', 'meat', 'herbs', 'medicine', 'cabbage', 'honey', 'eggs'], FLOOR = ['flour', 'wheat', 'ale', 'logs', 'wool'];
    const homeHH = (sc) => { const s = cur(); if (!s || !sc || !sc.b) return null; if (s.biz && s.biz.get(sc.b.id) && !sc.L.items.some((i) => /bed|double/.test(i.kind) && (i.floor == null || i.floor === sc.floor))) return null; const q = s.people.find((z) => z.home === sc.b.id && z.alive !== false); return q ? s.household(q) : null; };
    let shown = 0;
    function plan(sc) { // where things go in this room: table tops, dresser tops, floor by the stores, the hearth
      const k = sc.b.id + ':' + sc.floor; if (sc._pplan && sc._pplan.k === k) return sc._pplan; const P = { k, table: [], shelf: [], floor: [], hearth: null };
      for (const it of sc.L.items) { if (it.floor != null && it.floor !== sc.floor) continue; let sp; try { sp = sc.sprite(it, it.v); } catch (e) { continue; } const [ax, ay] = sc.anchor(it), top = ay - (sp.oy || 16);
        if (it.kind === 'table' || it.kind === 'longtable') P.table.push({ x: ax, y: top + 5, w: Math.max(12, (sp.canvas?.width || 24) - 10), sy: ay + 0.5 });
        else if (['dresser', 'cupboard', 'chest', 'crate'].includes(it.kind)) P.shelf.push({ x: ax, y: top + (it.kind === 'dresser' || it.kind === 'cupboard' ? 15 : 4), w: Math.max(8, (sp.canvas?.width || 16) - 8), sy: ay + 0.5 });
        else if (it.kind === 'fireplace') P.hearth = { x: ax - 8, y: ay + 14 };
        if (['chest', 'barrel', 'crate', 'dresser', 'cupboard'].includes(it.kind)) P.floor.push({ x: ax + 14, y: ay + 8 }); }
      sc._pplan = P; return P; }
    // coins: a stack is a dozen aurin or so; a fat purse beside a big pile
    function coins(ctx, x, y, n, bag) { for (let i = 0; i < n; i++) { const h = 2 + ((i * 7) % 3), cx = x + i * 4; for (let k = 0; k < h; k++) { ctx.fillStyle = k === h - 1 ? '#f2d878' : '#b8902e'; ctx.fillRect(cx, y - k * 1.5 - 1, 3, 1); ctx.fillStyle = '#7a5a1a'; ctx.fillRect(cx, y - k * 1.5, 3, 1); } } if (bag) { ctx.fillStyle = '#6a4a2a'; ctx.fillRect(x + n * 4 + 1, y - 5, 5, 5); ctx.fillStyle = '#8a6a3a'; ctx.fillRect(x + n * 4 + 2, y - 4, 3, 3); ctx.fillStyle = '#3a2a1a'; ctx.fillRect(x + n * 4 + 2, y - 6, 3, 1); } }
    const band = (m) => m <= 0 ? 0 : m < 20 ? 1 : m < 60 ? 2 : m < 150 ? 3 : 4;
    let till = 0, pot = 0, messy = false, tidied = 0;
    const _extras0 = O.sceneExtras;
    O.sceneExtras = (sc, ctx, cam) => { const out = _extras0 ? _extras0(sc, ctx, cam) : []; try { const s0 = cur(), bz = s0 && s0.biz && s0.biz.get(sc.b.id);
        // the till: coin on the counter, as much as the business really holds
        if (bz && bz.cash != null) { const ct = sc.L.items.find((i) => ['counter', 'bar', 'desk'].includes(i.kind) && (i.floor == null || i.floor === sc.floor)); if (ct) { let sp; try { sp = sc.sprite(ct, ct.v); } catch (e) { sp = null; } const [ax, ay] = sc.anchor(ct), n = band(bz.cash); till = n; if (sp && n) out.push({ y: ay + 0.5, draw: () => coins(ctx, Math.round(ax - 10 - cam.x), Math.round(ay - (sp.oy || 16) + 9 - cam.y), Math.min(3, n), n >= 4) }); } else till = 0; }
        const mess = sc.b._burgled != null && s0 && s0.day - sc.b._burgled <= 4 && !sc.b._tidied && sc.floor === 0;
        if (mess) { const P0 = plan(sc), F = P0.floor[0] || { x: sc.anchor(sc.L.items[0])[0], y: sc.anchor(sc.L.items[0])[1] + 10 }; const bits = ['spoon', 'cloth', 'candlestick', 'bread']; bits.forEach((g, i) => { const x = F.x - 20 + i * 11, y = F.y + 6 + (i % 2) * 5; out.push({ y: y - 8, draw: () => { ctx.save(); ctx.translate(Math.round(x - cam.x), Math.round(y - cam.y)); ctx.rotate((i % 2 ? 1 : -1) * 0.9); ctx.drawImage(O.ItemArt.small(g), -6, -6); ctx.restore(); } }); }); out.push({ y: F.y, draw: () => { ctx.fillStyle = '#c8b070'; for (let k = 0; k < 14; k++) ctx.fillRect(Math.round(F.x - 26 + ((k * 37) % 50) - cam.x), Math.round(F.y + 2 + ((k * 13) % 12) - cam.y), 3, 1); } }); messy = true; } else messy = false;
        let hh = homeHH(sc);
        // your own house: what you've put by in the chest is laid out like any household's larder
        if (!hh && sc.b.owner && sc.b.owner.kind === 'player' && s0) { const st = (O.PlayerState.homes || {})[s0.world.placeId + ':' + sc.b.id] || []; const pan = {}; for (const k of st) pan[k] = (pan[k] || 0) + 1; hh = { pantry: pan, money: 0, mine: true }; }
        if (!hh) return out;
        // the household's savings: a clay pot on the chest, coins heaped in it, or an empty pot
        if (!hh.mine) { const ch = sc.L.items.find((i) => ['chest', 'dresser', 'cupboard'].includes(i.kind) && (i.floor == null || i.floor === sc.floor)); if (ch) { const [ax, ay] = sc.anchor(ch); let sp; try { sp = sc.sprite(ch, ch.v); } catch (e) { sp = null; } const n = band(hh.money || 0); pot = n; const top = ay - ((sp && sp.oy) || 14) + (ch.kind === 'chest' ? 4 : 15);
          out.push({ y: ay + 0.5, draw: () => { const x = Math.round(ax + 6 - cam.x), y = Math.round(top - cam.y); ctx.fillStyle = '#7a4a2e'; ctx.fillRect(x - 3, y - 6, 7, 6); ctx.fillStyle = '#9a5e3a'; ctx.fillRect(x - 2, y - 5, 2, 4); ctx.fillStyle = '#5a3420'; ctx.fillRect(x - 2, y - 7, 5, 1); if (n >= 1) { ctx.fillStyle = '#e8c860'; ctx.fillRect(x - 1, y - 7, 3, 1); } if (n >= 3) { ctx.fillStyle = '#f2d878'; ctx.fillRect(x, y - 8, 2, 1); } if (n >= 4) coins(ctx, x + 6, y, 1, false); } }); } }
        if (!hh.pantry) return out; const P = plan(sc), pan = hh.pantry; const small = (g) => O.ItemArt.small(g);
        const put = (g, x, y, sy) => out.push({ y: sy, draw: () => { ctx.drawImage(small(g), Math.round(x - 6 - cam.x), Math.round(y - 10 - cam.y)); } });
        // on the table, then the dresser tops
        let n = 0; const surf = (list, goods) => { for (const g of goods) { let q = Math.min(3, Math.floor(pan[g] || 0)); for (const S of list) { const slots = Math.max(1, Math.floor(S.w / 9)); S.used = S.used || 0; while (q > 0 && S.used < slots) { put(g, S.x - S.w / 2 + 6 + S.used * 9, S.y + (S.used % 2), S.sy); S.used++; q--; n++; } } } };
        for (const S of [...P.table, ...P.shelf]) S.used = 0;
        surf(P.table, TABLE.filter((g) => !SHELF.includes(g) || P.shelf.length === 0)); surf(P.shelf, SHELF); surf(P.table, ['cabbage', 'eggs', 'honey']); if (hh.mine) { const rest = Object.keys(pan).filter((g) => !TABLE.includes(g) && !SHELF.includes(g) && !FLOOR.includes(g) && g !== 'firewood' && g !== 'key'); surf([...P.shelf, ...P.table], rest); }
        // sacks and casks on the floor
        let f = 0; for (const g of FLOOR) { const q = Math.min(2, Math.ceil(pan[g] || 0)); for (let i = 0; i < q && f < P.floor.length * 2; i++, f++) { const F = P.floor[Math.floor(f / 2)]; if (!F) break; put(g, F.x + (f % 2) * 10, F.y, F.y); n++; } }
        // the woodpile by the hearth: a log for every bundle, stacked
        const wood = Math.min(8, Math.ceil((pan.firewood || 0) + (pan.logs || 0) * 0)); if (P.hearth && wood > 0) { const H = P.hearth; out.push({ y: H.y, draw: () => { for (let i = 0; i < wood; i++) { const row = i < 4 ? 0 : i < 7 ? 1 : 2, col = i < 4 ? i : i < 7 ? i - 4 : 0, x = Math.round(H.x - cam.x + col * 5 + row * 2.5), y = Math.round(H.y - cam.y - row * 4); ctx.fillStyle = '#5a3d26'; ctx.fillRect(x - 2, y - 3, 5, 4); ctx.fillStyle = '#c89a62'; ctx.fillRect(x - 1, y - 2, 3, 2); ctx.fillStyle = '#8a6239'; ctx.fillRect(x - 1, y - 2, 1, 1); } } }); n += wood; }
        shown = n; } catch (e) { console.error(e); } return out; };
    // set the place to rights after a break-in
    (O.moreCandidates = O.moreCandidates || []).push(() => { const sc = game.scene, P = game.player; if (!sc || !messy || P.locked || !sc.b.owner || sc.b.owner.kind !== 'player') return null;
      return { type: 'custom', d: 3, x: P.x, y: P.y - 40, label: 'Set the place to rights after the break-in', act: () => { P.locked = true; P.anim = 'sweep'; setTimeout(() => { P.locked = false; P.anim = 'idle'; sc.b._tidied = true; tidied++; O.UI && O.UI.say && O.UI.say('You pick it all up, sweep out the straw and wedge the shutter. It doesn\'t feel quite the same.', 'info'); }, 3000); } }; });
    (O.extraLines = O.extraLines || []).push((s, q) => { if (!s || !q.home) return ''; const b = s.building(q.home); return b && b._burgled != null && s.day - b._burgled <= 4 ? 'Your house was broken into a few nights ago and things were taken. You are shaken and angry, and warier of strangers.' : ''; });
    O.PantryShow = { get shown() { return shown; }, get messy() { return messy; }, get tidied() { return tidied; }, get till() { return till; }, get pot() { return pot; }, plan };
  }
  O.PantryShowSetup = { setup };
})();
