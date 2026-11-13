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
    const homeHH = (sc) => { const s = cur(); if (!s || !sc || !sc.b) return null; if (s.biz && s.biz.get(sc.b.id)) return null; const q = s.people.find((z) => z.home === sc.b.id && z.alive !== false); return q ? s.household(q) : null; };
    let shown = 0;
    function plan(sc) { // where things go in this room: table tops, dresser tops, floor by the stores, the hearth
      const k = sc.b.id + ':' + sc.floor; if (sc._pplan && sc._pplan.k === k) return sc._pplan; const P = { k, table: [], shelf: [], floor: [], hearth: null };
      for (const it of sc.L.items) { if (it.floor != null && it.floor !== sc.floor) continue; let sp; try { sp = sc.sprite(it, it.v); } catch (e) { continue; } const [ax, ay] = sc.anchor(it), top = ay - (sp.oy || 16);
        if (it.kind === 'table' || it.kind === 'longtable') P.table.push({ x: ax, y: top + 5, w: Math.max(12, (sp.canvas?.width || 24) - 10), sy: ay - 1 });
        else if (['dresser', 'cupboard', 'chest', 'crate'].includes(it.kind)) P.shelf.push({ x: ax, y: top + (it.kind === 'dresser' || it.kind === 'cupboard' ? 15 : 4), w: Math.max(8, (sp.canvas?.width || 16) - 8), sy: ay - 1 });
        else if (it.kind === 'fireplace') P.hearth = { x: ax - 8, y: ay + 14 };
        if (['chest', 'barrel', 'crate', 'dresser', 'cupboard'].includes(it.kind)) P.floor.push({ x: ax + 14, y: ay + 8 }); }
      sc._pplan = P; return P; }
    const _extras0 = O.sceneExtras;
    O.sceneExtras = (sc, ctx, cam) => { const out = _extras0 ? _extras0(sc, ctx, cam) : []; try { const hh = homeHH(sc); if (!hh || !hh.pantry) return out; const P = plan(sc), pan = hh.pantry; const small = (g) => O.ItemArt.small(g);
        const put = (g, x, y, sy) => out.push({ y: sy, draw: () => { ctx.drawImage(small(g), Math.round(x - 6 - cam.x), Math.round(y - 10 - cam.y)); } });
        // on the table, then the dresser tops
        let n = 0; const surf = (list, goods) => { for (const g of goods) { let q = Math.min(3, Math.floor(pan[g] || 0)); for (const S of list) { const slots = Math.max(1, Math.floor(S.w / 9)); S.used = S.used || 0; while (q > 0 && S.used < slots) { put(g, S.x - S.w / 2 + 6 + S.used * 9, S.y + (S.used % 2), S.sy); S.used++; q--; n++; } } } };
        for (const S of [...P.table, ...P.shelf]) S.used = 0;
        surf(P.table, TABLE.filter((g) => !SHELF.includes(g) || P.shelf.length === 0)); surf(P.shelf, SHELF); surf(P.table, ['cabbage', 'eggs', 'honey']);
        // sacks and casks on the floor
        let f = 0; for (const g of FLOOR) { const q = Math.min(2, Math.ceil(pan[g] || 0)); for (let i = 0; i < q && f < P.floor.length * 2; i++, f++) { const F = P.floor[Math.floor(f / 2)]; if (!F) break; put(g, F.x + (f % 2) * 10, F.y, F.y); n++; } }
        // the woodpile by the hearth: a log for every bundle, stacked
        const wood = Math.min(8, Math.ceil((pan.firewood || 0) + (pan.logs || 0) * 0)); if (P.hearth && wood > 0) { const H = P.hearth; out.push({ y: H.y, draw: () => { for (let i = 0; i < wood; i++) { const row = i < 4 ? 0 : i < 7 ? 1 : 2, col = i < 4 ? i : i < 7 ? i - 4 : 0, x = Math.round(H.x - cam.x + col * 5 + row * 2.5), y = Math.round(H.y - cam.y - row * 4); ctx.fillStyle = '#5a3d26'; ctx.fillRect(x - 2, y - 3, 5, 4); ctx.fillStyle = '#c89a62'; ctx.fillRect(x - 1, y - 2, 3, 2); ctx.fillStyle = '#8a6239'; ctx.fillRect(x - 1, y - 2, 1, 1); } } }); n += wood; }
        shown = n; } catch (e) { console.error(e); } return out; };
    O.PantryShow = { get shown() { return shown; }, plan };
  }
  O.PantryShowSetup = { setup };
})();
