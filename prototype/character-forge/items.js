/* items.js — what people carry, where it goes, and how it gets there.
 *
 * An inventory here is eight general slots in a four-by-two block, plus a main
 * hand and a shield hand. The two hands are kept out of the block deliberately:
 * they are the only slots that change what a character can *do*, and a
 * left-handed character swaps which hand is which without the icons moving,
 * because moving them would mean relearning the grid for no reason.
 */
(function (global) {
  'use strict';

  const G = global.Geo;
  const C = global.Combat;

  const GRID_COLS = 4;
  const GRID_ROWS = 2;
  const GRID_SLOTS = GRID_COLS * GRID_ROWS;   // 8
  const TOTAL_SLOTS = GRID_SLOTS + 2;          // + main hand + shield
  const HAND = GRID_SLOTS;                     // index of the weapon hand
  const SHIELD = GRID_SLOTS + 1;
  const CHEST_SLOTS = 15;

  /* ---------- the things themselves ---------- */

  const DEFS = {};

  function define(id, label, opts) {
    DEFS[id] = Object.assign({ id: id, label: label, stack: 1, kind: 'thing' }, opts || {});
    return DEFS[id];
  }

  // weapons come straight out of the combat table, so there is one definition
  // of what a sword is rather than two that can drift apart
  for (let i = 0; i < C.ALL_IDS.length; i++) {
    const id = C.ALL_IDS[i];
    const w = C.WEAPONS[id];
    define(id, w.label, { kind: 'weapon', weapon: id, hand: true, twoHanded: w.twoHanded });
  }

  define('shield', 'Shield', { kind: 'shield', shield: true });
  define('buckler', 'Buckler', { kind: 'shield', shield: true, small: true });
  define('plank', 'Plank', { kind: 'material', stack: 12 });
  define('wheel', 'Cart wheel', { kind: 'material', stack: 4 });
  define('leather', 'Leather', { kind: 'material', stack: 8 });
  define('feather', 'Feathers', { kind: 'material', stack: 16 });
  define('arrow', 'Arrows', { kind: 'ammo', stack: 30 });
  define('bolt', 'Bolts', { kind: 'ammo', stack: 20 });
  define('coin', 'Coins', { kind: 'valuable', stack: 250 });
  define('bandage', 'Bandage', { kind: 'aid', stack: 5 });

  function def(id) { return DEFS[id] || null; }

  /* ---------- icons ----------
   *
   * Drawn as tiny 3D models rather than sprites, so an item in a slot is
   * visibly the same object that was lying on the grass a moment ago. */

  const STEEL = '#b9bec6', STEEL_DARK = '#7d838c';
  const WOOD = '#7d5c36', WOOD_DARK = '#5e441f';
  const HIDE = '#6b4526', BONE = '#e0d9c6', GOLD = '#c8a23c';

  function p(mesh, colour) { return { mesh: mesh, colour: colour }; }

  const ICONS = {
    shield: function () {
      return [
        p(G.taper(-4.6, -5.5, -0.9, 9.2, 10.5, 1.8, 0.55), WOOD),
        p(G.taper(-3.8, -4.6, -1.3, 7.6, 8.8, 1.0, 0.6), '#8d3a2e'),
        p(G.superellipsoid(0, 0.6, -1.5, 1.5, 1.5, 0.9, 0.5, 3, 8), STEEL)
      ];
    },
    buckler: function () {
      return [
        p(G.superellipsoid(0, 0, 0, 3.6, 3.6, 0.9, 0.5, 4, 10), WOOD_DARK),
        p(G.superellipsoid(0, 0, -0.9, 1.5, 1.5, 0.9, 0.5, 3, 8), STEEL)
      ];
    },
    plank: function () { return [p(G.box(-5, -0.6, -1.3, 10, 1.2, 2.6), WOOD)]; },
    wheel: function () {
      return global.Vehicle
        ? global.Vehicle.wheelParts(0, 0, 0, 4.4, 0.9, WOOD_DARK, STEEL_DARK)
        : [p(G.box(-4, -4, -0.8, 8, 8, 1.6), WOOD_DARK)];
    },
    leather: function () {
      return [p(G.box(-3.4, -0.5, -2.6, 6.8, 1.0, 5.2), HIDE),
        p(G.box(-3.0, 0.5, -2.2, 6.0, 0.5, 4.4), '#8a5c33')];
    },
    feather: function () {
      const out = [];
      for (let i = 0; i < 3; i++) {
        out.push(p(G.taper(-0.6 + i * 1.3, -2.6, -0.5, 1.2, 5.4, 1.0, 0.25), BONE));
      }
      return out;
    },
    arrow: function () {
      return [p(G.box(-0.35, -5.5, -0.35, 0.7, 11, 0.7), WOOD),
        p(G.taper(-0.6, 5.0, -0.6, 1.2, 2.0, 1.2, 0.1), STEEL),
        p(G.box(-0.25, -5.6, -1.0, 0.5, 2.4, 2.0), BONE)];
    },
    bolt: function () {
      return [p(G.box(-0.4, -3.2, -0.4, 0.8, 6.4, 0.8), WOOD_DARK),
        p(G.taper(-0.7, 2.8, -0.7, 1.4, 1.8, 1.4, 0.1), STEEL)];
    },
    coin: function () {
      const out = [];
      for (let i = 0; i < 3; i++) {
        out.push(p(G.superellipsoid((i - 1) * 1.4, -1.2 + i * 0.5, 0,
          1.7, 1.7, 0.35, 0.5, 3, 9), GOLD));
      }
      return out;
    },
    bandage: function () {
      return [p(G.slab(-2.2, -1.4, -1.4, 4.4, 2.8, 2.8, 0.8, 1), '#ddd6c2'),
        p(G.box(-2.4, -0.4, -1.5, 4.8, 0.8, 3.0), '#c4bda8')];
    }
  };

  const _icons = {};
  function iconParts(id) {
    if (_icons[id]) return _icons[id];
    let parts;
    if (DEFS[id] && DEFS[id].kind === 'weapon') parts = C.weaponParts(DEFS[id].weapon);
    else if (ICONS[id]) parts = ICONS[id]();
    else parts = [p(G.box(-2, -2, -2, 4, 4, 4), '#8a7f6d')];
    _icons[id] = parts;
    return parts;
  }

  /* How big each item draws in a slot and how it is turned, so a greatsword
   * and a coin both read at the same icon size. */
  const ICON_VIEW = {
    fists: { scale: 1, yaw: 0, pitch: 0 },
    sword: { scale: 0.60, yaw: 0.5, pitch: -0.9 },
    greatsword: { scale: 0.42, yaw: 0.5, pitch: -0.9 },
    poleaxe: { scale: 0.32, yaw: 0.5, pitch: -0.9 },
    spear: { scale: 0.33, yaw: 0.5, pitch: -0.9 },
    axe: { scale: 0.68, yaw: 0.7, pitch: -0.8 },
    mace: { scale: 0.72, yaw: 0.4, pitch: -0.85 },
    club: { scale: 0.85, yaw: 0.4, pitch: -0.85 },
    dagger: { scale: 1.05, yaw: 0.5, pitch: -0.85 },
    bow: { scale: 0.72, yaw: 0.9, pitch: -0.2 },
    crossbow: { scale: 0.62, yaw: 0.3, pitch: -0.7 },
    shield: { scale: 0.9, yaw: 0.4, pitch: 0.1 },
    buckler: { scale: 1.1, yaw: 0.4, pitch: 0.1 },
    wheel: { scale: 0.95, yaw: 1.1, pitch: 0.1 },
    plank: { scale: 0.85, yaw: 0.6, pitch: 0.5 },
    default: { scale: 1, yaw: 0.6, pitch: 0.35 }
  };
  function iconView(id) { return ICON_VIEW[id] || ICON_VIEW.default; }

  /* ---------- stacks and inventories ---------- */

  function stack(id, count) {
    const d = def(id);
    return d ? { id: id, count: Math.max(1, count || 1) } : null;
  }

  /* `hands` marks an inventory as belonging to a person, whose last two slots
   * are the weapon and shield hands. A container has none: every slot in a
   * chest is a general slot, however many there are. */
  function createInventory(slots, hands) {
    const n = slots === undefined ? TOTAL_SLOTS : slots;
    const a = new Array(n);
    for (let i = 0; i < n; i++) a[i] = null;
    Object.defineProperty(a, 'hands', {
      value: hands === undefined ? n >= TOTAL_SLOTS && slots === undefined : !!hands,
      enumerable: false, writable: true
    });
    return a;
  }

  function capacityOf(inv) { return inv.length; }

  /* Only the eight general slots take loose goods; the hands are for what you
   * are holding. Picking things up must never silently disarm you. */
  function generalRange(inv) {
    return inv.hands ? GRID_SLOTS : inv.length;
  }

  function add(inv, id, count) {
    const d = def(id);
    if (!d) return count || 1;
    let left = count === undefined ? 1 : count;
    const limit = generalRange(inv);
    // top up part-filled stacks before opening a new slot
    for (let i = 0; i < limit && left > 0; i++) {
      const s = inv[i];
      if (!s || s.id !== id || s.count >= d.stack) continue;
      const room = d.stack - s.count;
      const take = Math.min(room, left);
      s.count += take;
      left -= take;
    }
    for (let i = 0; i < limit && left > 0; i++) {
      if (inv[i]) continue;
      const take = Math.min(d.stack, left);
      inv[i] = { id: id, count: take };
      left -= take;
    }
    return left;   // what would not fit
  }

  function roomFor(inv, id, count) {
    const d = def(id);
    if (!d) return 0;
    let room = 0;
    const limit = generalRange(inv);
    for (let i = 0; i < limit; i++) {
      const s = inv[i];
      if (!s) room += d.stack;
      else if (s.id === id) room += Math.max(0, d.stack - s.count);
    }
    return Math.min(room, count === undefined ? 1 : count);
  }

  function countOf(inv, id) {
    let n = 0;
    for (let i = 0; i < inv.length; i++) if (inv[i] && inv[i].id === id) n += inv[i].count;
    return n;
  }

  function take(inv, id, count) {
    let left = count === undefined ? 1 : count;
    for (let i = 0; i < inv.length && left > 0; i++) {
      const s = inv[i];
      if (!s || s.id !== id) continue;
      const got = Math.min(s.count, left);
      s.count -= got;
      left -= got;
      if (s.count <= 0) inv[i] = null;
    }
    return (count === undefined ? 1 : count) - left;
  }

  /* Moving a stack between two slots, which may be in different inventories.
   * Same item merges up to its stack size; anything else swaps. */
  function move(fromInv, fromIdx, toInv, toIdx) {
    const src = fromInv[fromIdx];
    if (!src) return false;
    const dst = toInv[toIdx];
    const handSlot = !!toInv.hands && (toIdx === HAND || toIdx === SHIELD);
    if (handSlot) {
      const d = def(src.id);
      if (toIdx === HAND && !(d && d.hand)) return false;
      if (toIdx === SHIELD && !(d && d.shield)) return false;
    }
    if (dst && dst.id === src.id) {
      const d = def(src.id);
      const room = d.stack - dst.count;
      if (room > 0) {
        const take2 = Math.min(room, src.count);
        dst.count += take2;
        src.count -= take2;
        if (src.count <= 0) fromInv[fromIdx] = null;
        return true;
      }
    }
    fromInv[fromIdx] = dst || null;
    toInv[toIdx] = src;
    return true;
  }

  function held(inv) {
    const s = inv[HAND];
    return s ? def(s.id) : null;
  }

  function heldWeapon(inv) {
    const d = held(inv);
    return d && d.weapon ? C.weapon(d.weapon) : C.weapon('fists');
  }

  function shieldOf(inv) {
    const s = inv[SHIELD];
    return s ? def(s.id) : null;
  }

  /* Everything a body is carrying, flattened — used when someone is robbed or
   * dies and the lot goes on the floor. */
  function contents(inv) {
    const out = [];
    for (let i = 0; i < inv.length; i++) {
      if (inv[i]) out.push({ id: inv[i].id, count: inv[i].count, slot: i });
    }
    return out;
  }

  function clearAll(inv) {
    for (let i = 0; i < inv.length; i++) inv[i] = null;
  }

  /* Picks some of what someone is carrying, for a hit that shakes things
   * loose. Never the weapon in their hand unless it is a killing blow. */
  function shakeLoose(inv, rng, howMany, includeHands) {
    const out = [];
    const limit = includeHands ? inv.length : generalRange(inv);
    const order = [];
    for (let i = 0; i < limit; i++) if (inv[i]) order.push(i);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const t = order[i]; order[i] = order[j]; order[j] = t;
    }
    for (let k = 0; k < order.length && out.length < howMany; k++) {
      const i = order[k];
      const s = inv[i];
      const n = s.count > 1 ? 1 + Math.floor(rng() * Math.min(s.count, 3)) : 1;
      out.push({ id: s.id, count: n });
      s.count -= n;
      if (s.count <= 0) inv[i] = null;
    }
    return out;
  }

  global.Items = {
    GRID_COLS, GRID_ROWS, GRID_SLOTS, TOTAL_SLOTS, HAND, SHIELD, CHEST_SLOTS,
    DEFS, def, iconParts, iconView, stack, createInventory, capacityOf,
    add, roomFor, countOf, take, move, held, heldWeapon, shieldOf,
    contents, clearAll, shakeLoose, generalRange
  };
})(window);
