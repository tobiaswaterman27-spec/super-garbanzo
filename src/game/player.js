// The player's own state: purse, 10-slot inventory, needs, and separate reputations per group.
'use strict';
(function () {
  const G = O.Data.GOODS;
  const SLOTS = 10;
  const P = {
    money: 30, items: ['bread', 'bread', 'dagger'],
    hp: 100, energy: 90, hunger: 75,
    // reputation is never one number: towns, trades and the underworld each judge you separately
    rep: { civilian: 0, criminal: 0, guard: 0, merchant: 0, local: 0 },
    crimes: [], room: null, wanted: 0,
    slotsUsed() { return this.items.reduce((s, k) => s + (G[k]?.slots || 1), 0); },
    canCarry(k, n = 1) { return this.slotsUsed() + (G[k]?.slots || 1) * n <= SLOTS; },
    add(k, n = 1) { let added = 0; for (let i = 0; i < n && this.canCarry(k); i++) { this.items.push(k); added++; } return added; },
    remove(k, n = 1) { let r = 0; for (let i = 0; i < n; i++) { const j = this.items.indexOf(k); if (j < 0) break; this.items.splice(j, 1); r++; } return r; },
    count(k) { return this.items.filter((x) => x === k).length; },
    eat(k) {
      const food = G[k]?.food; if (!food) return false;
      this.remove(k); this.hunger = Math.min(100, this.hunger + 35 * food); this.hp = Math.min(100, this.hp + 3); return true;
    },
    tick(dtm, sleeping) {
      this.hunger = Math.max(0, this.hunger - 0.05 * dtm);
      this.energy = sleeping ? Math.min(100, this.energy + 0.2 * dtm) : Math.max(0, this.energy - 0.035 * dtm);
      if (this.hunger <= 0) this.hp = Math.max(1, this.hp - 0.02 * dtm);
      else if (this.hunger > 50 && this.hp < 100) this.hp = Math.min(100, this.hp + 0.01 * dtm);
    },
    SLOTS,
  };
  O.PlayerState = P;
})();
