// What a fight leaves behind, and who deals with it. Wounds are real marks on real people, a split
// lip from a fist, a stab from a dagger, a long cut from a sword, a gash from an axe, and they heal
// slowly. Blood stays where it fell. Anyone badly hurt collapses where they stand, and two stretcher-
// bearers come from the physician or the hospital to carry them in; when every bed is taken they
// carry them on to the next town. The dead are fetched by the undertakers on a covered stretcher and
// taken to the morgue (a puff of smoke, and they are gone), and a new grave is dug in the churchyard.
// The council's sweepers wash the blood away and pick up whatever was dropped in the street, and
// what they find is sold for the town purse.
'use strict';
(function () {
  const WOUND = { fists: 'bruise', hammer: 'bruise', dagger: 'stab', spear: 'stab', pitchfork: 'stab', sword: 'slash', scythe: 'slash', axe: 'gash', hoe: 'gash' };
  const BLOOD = { bruise: null, stab: 'drops', slash: 'streak', gash: 'splatter' };

  function installSim(Sim) {
    const S = Sim.prototype;
    const init = (s) => { s.marks = s.marks || []; s.dropped = s.dropped || []; s.bodies = s.bodies || []; s.carries = s.carries || []; s.puffs = s.puffs || []; };

    // ---- wounds and blood ----
    S.wound = function (p, weapon, dmg, x, y) {
      init(this);
      const kind = WOUND[weapon] || 'bruise';
      (p.wounds = p.wounds || []).push({ kind, sev: Math.min(1, dmg / 22), day: this.day, part: this.rng.pick(kind === 'bruise' ? ['face', 'face', 'torso'] : ['torso', 'torso', 'arm', 'face']), seed: this.rng.int(1, 999) });
      if (p.wounds.length > 6) p.wounds.shift();
      const bl = BLOOD[kind];
      if (bl && x != null) this.marks.push({ x: x + this.rng.int(-4, 4), y: y + this.rng.int(-2, 3), kind: bl, size: Math.min(1, dmg / 18), day: this.day, min: this.minute, seed: this.rng.int(1, 9999) });
      if (this.marks.length > 120) this.marks.shift();
    };
    S.bleed = function (x, y, kind, size) { init(this); this.marks.push({ x, y, kind, size, day: this.day, min: this.minute, seed: this.rng.int(1, 9999) }); };

    // ---- things dropped in the street ----
    S.drop = function (good, qty, x, y, from) { init(this); this.dropped.push({ id: this.rng.int(1, 1e9), good, qty, x, y, day: this.day, from: from || null }); };
    S.pickUpDropped = function (it) { init(this); this.dropped = this.dropped.filter((d) => d !== it); };

    // ---- care: where can a patient be carried? ----
    S.careBeds = function (b) {
      if (b._careBeds == null) { try { const L = O.Interior.layoutFor(b, 0, this); b._careBeds = Math.max(1, L.items.filter((i) => i.medbed).length); } catch (e) { b._careBeds = 2; } }
      return b._careBeds;
    };
    S.careDest = function (x, y) {
      init(this);
      const care = this.world.buildings.filter((b) => (b.type === 'hospital' || b.type === 'doctor') && this.biz.get(b.id) && !b.fire && !b.ruined);
      const using = (b) => this.people.filter((q) => q.agent.inside === b.id && (q.activity?.act === 'treated' || q.task?.act === 'treated')).length + this.carries.filter((c) => c.dest === b.id && c.kind === 'patient').length;
      const ok = care.filter((b) => using(b) < this.careBeds(b)).sort((a, b) => Math.hypot(a.doorX * this.T - x, a.doorY * this.T - y) - Math.hypot(b.doorX * this.T - x, b.doorY * this.T - y));
      return ok[0] || null;
    };
    S.morgue = function () { return this.world.buildings.find((b) => b.type === 'morgue' && !b.ruined) || this.building(this.chapelId); };

    // send two of `role` to fetch someone (a patient) or something (a body)
    S.sendStretcher = function (kind, target, x, y) {
      init(this);
      if (this.carries.some((c) => c.target === target && c.kind === kind)) return;
      const role = kind === 'body' ? 'undertaker' : 'bearer';
      let crew = this.people.filter((q) => q.job?.role === role && q.alive !== false && !q.task && q.activity?.act !== 'sleep' && q.health.hp > 40);
      if (crew.length < 2) crew = crew.concat(this.people.filter((q) => q.job?.role === role && q.alive !== false && !q.task && !crew.includes(q))); // wake them if need be
      if (crew.length < 2) return false;
      const c = { id: this.rng.int(1, 1e9), kind, target, stage: 'fetch', bearers: [crew[0].id, crew[1].id], x, y, dest: null, since: this.day * 1440 + this.minute };
      for (const q of crew.slice(0, 2)) q.task = { act: 'stretcher', outdoor: true, carry: c.id };
      this.carries.push(c);
      return true;
    };

    // the dead: the body lies where they fell (or at the door of the house they died in) until fetched
    const _die = S.die;
    S.die = function (p, cause) {
      init(this);
      const a = p.agent, inWorld = a && !p.visitor && (a.x || a.y);
      let x = a ? a.x : 0, y = a ? a.y : 0;
      if (a && a.inside != null) { const b = this.building(a.inside); if (b) { x = b.doorX * this.T + 8; y = (b.doorY + 1) * this.T + 2; } }
      _die.call(this, p, cause);
      if (a) a.hidden = true;
      for (const c of this.carries) if (c.kind === 'patient' && c.target === p.id) c.died = true;
      if (inWorld && this.world && !/far from home|abroad/.test(cause || '')) {
        const violent = /killed|murder|fell|stab|slain/.test(cause || '');
        const body = { id: p.id, name: p.name, app: p.app, x, y, day: this.day, violent, carried: false };
        this.bodies.push(body);
        if (violent) this.bleed(x, y + 1, 'pool', 1);
        // the body is dropped where it lay, with what they carried
        const it = p.app?.outfit?.item; if (it && O.Data.GOODS[it] && violent) this.drop(it, 1, x + 8, y + 2, p.id);
        if (!this.sendStretcher('body', p.id, x, y)) body.waiting = true;
      }
    };

    // stretcher-bearers instead of a passer-by when someone collapses in the street
    const _healthMinute = S.healthMinute;
    S.healthMinute = function (p) {
      const r = _healthMinute.call(this, p);
      if (r && r.act === 'collapsed' && !p._stretcherSent && p.agent.inside == null) {
        if (this.people.some((q) => q.job?.role === 'bearer')) {
          if (p.helper) { const h = this.byId.get(p.helper); if (h && h.task?.act === 'help') h.task = null; p.helper = null; }
          if (this.sendStretcher('patient', p.id, p.agent.x, p.agent.y)) p._stretcherSent = true;
        }
      }
      return r;
    };
    // the bearers are going to the patient: nobody else need help
    const _plan = S.plan;
    S.plan = function (p) {
      if (p.carriedBy) return { act: 'carried', outdoor: true };
      if (p.awayUntil) return { act: 'away', outdoor: true };
      return _plan.call(this, p);
    };

    const crewOf = (s, c) => c.bearers.map((id) => s.byId.get(id)).filter(Boolean);
    S.carryTick = function () {
      init(this);
      for (const c of [...this.carries]) {
        const crew = crewOf(this, c);
        if (crew.length < 2 || crew.some((q) => q.alive === false)) { this.endCarry(c, true); continue; }
        if (c.stage === 'fetch') {
          // they arrive when both stand by the patient
          const there = crew.every((q) => q.agent.inside == null && Math.hypot(q.agent.x - c.x, q.agent.y - c.y) < 22);
          const late = this.day * 1440 + this.minute - c.since > 180;
          if (there || (late && crew.some((q) => Math.hypot(q.agent.x - c.x, q.agent.y - c.y) < 40))) {
            if (c.kind === 'patient') {
              const p = this.byId.get(c.target);
              if (!p || p.alive === false || c.died) { this.endCarry(c, true); continue; }
              p.carriedBy = c.id; p.agent.hidden = true; p.collapsedAt = null; p.helper = null;
              const dest = this.careDest(c.x, c.y);
              c.dest = dest ? dest.id : 'away';
              if (!dest) this.log(`Every bed at the physician's is taken. The bearers are carrying ${p.name} on toward the next town.`, 'health');
              else this.log(`Stretcher-bearers are carrying ${p.name} to ${dest.name}.`, 'health');
            } else {
              const body = this.bodies.find((b) => b.id === c.target); if (!body) { this.endCarry(c, true); continue; }
              body.carried = c.id; const m = this.morgue(); c.dest = m ? m.id : null;
            }
            c.stage = 'carry';
            const lead = crew[0];
            lead.task = c.dest === 'away' || c.dest == null ? { act: 'stretcher-carry', outdoor: true, carry: c.id, away: true } : { act: 'stretcher-carry', b: c.dest, carry: c.id };
            crew[1].task = { act: 'stretcher-follow', outdoor: true, carry: c.id };
          }
        } else if (c.stage === 'carry') {
          const [lead, tail] = crew;
          // the second bearer keeps the far end of the stretcher
          if (lead.agent.inside == null && !lead.agent.hidden) {
            if (c.lx != null && Math.hypot(lead.agent.x - c.lx, lead.agent.y - c.ly) > 0.5) c.hd = Math.atan2(lead.agent.y - c.ly, lead.agent.x - c.lx);
            c.lx = lead.agent.x; c.ly = lead.agent.y;
            const dx = Math.cos(c.hd ?? Math.PI), dy = Math.sin(c.hd ?? Math.PI);
            tail.agent.hidden = false; tail.agent.inside = null; tail.agent.path = null;
            tail.agent.x = lead.agent.x - dx * 30; tail.agent.y = lead.agent.y - dy * 30; tail.agent.dir = lead.agent.dir; tail.agent.anim = 'stretcher'; lead.agent.anim = 'stretcher';
            c.x = (lead.agent.x + tail.agent.x) / 2; c.y = (lead.agent.y + tail.agent.y) / 2; c.dx = dx; c.dy = dy;
          }
          // carried out of the village to the next town
          if (c.dest === 'away' && lead.agent.inside == null && Math.hypot(lead.agent.x - this.Z.east[0] * this.T, lead.agent.y - this.Z.east[1] * this.T) < 30) {
            const p = this.byId.get(c.target);
            if (p) { p.carriedBy = null; p.awayUntil = this.day + 4; p.agent.hidden = true; p.agent.inside = null; this.remember(p, 'Carried to the next town when there was no bed at home.', 'health', 2); }
            for (const q of crew) { q.task = null; q.agent.anim = 'walk'; }
            this.carries = this.carries.filter((x) => x !== c);
          }
        }
      }
      // patients sent away come home healed
      for (const p of this.people) if (p.awayUntil && this.day >= p.awayUntil) {
        p.awayUntil = null; p.health.illness = null; p.health.hp = 80; p.health.state = 'healthy';
        p.agent.hidden = false; p.agent.inside = null; p.agent.x = this.Z.east[0] * this.T; p.agent.y = this.Z.east[1] * this.T; p.task = { act: 'move-in', b: p.home };
        this.log(`${p.name} has come home, mended, from the infirmary in the next town.`, 'health');
      }
      // errands that lost their stretcher (after a reload, say) are dropped
      if (this._m % 30 === 15) for (const q of this.people) if (q.task && /^stretcher/.test(q.task.act) && !this.carries.some((c) => c.id === q.task.carry)) q.task = null;
      // bodies nobody has yet fetched
      if (this._m % 30 === 0) for (const b of [...this.bodies]) if (!b.carried && !this.carries.some((c) => c.kind === 'body' && c.target === b.id)) {
        if (!this.sendStretcher('body', b.id, b.x, b.y) && (this.day * 1440 + this.minute) - (b.day * 1440) > 240 && !this.people.some((q) => q.job?.role === 'undertaker')) {
          // no undertaker in the town: the family carry their dead to the churchyard themselves
          this.bodies = this.bodies.filter((x) => x !== b); this.digGrave(b);
        }
      }
    };

    // arriving at the door with the stretcher
    S.deliverStretcher = function (lead, bid) {
      const c = this.carries.find((x) => x.id === lead.task.carry); if (!c) { lead.task = null; return; }
      const crew = crewOf(this, c);
      if (c.kind === 'patient') {
        const p = this.byId.get(c.target);
        if (p) { p.carriedBy = null; p.agent.inside = bid; p.agent.hidden = true; p.agent.x = lead.agent.x; p.agent.y = lead.agent.y; p.task = { act: 'to-doctor', b: bid }; this.docId = this.docId || bid; const old = this.docId; this.docId = bid; this.admit(p); this.docId = old; }
      } else {
        const body = this.bodies.find((b) => b.id === c.target);
        if (body) {
          this.bodies = this.bodies.filter((b) => b !== body);
          const b = this.building(bid);
          if (b) this.puffs.push({ x: b.doorX * this.T + 8, y: (b.doorY + 1) * this.T, t: 0 });
          this.digGrave(body);
          // the burial fee, from the family if they can pay it
          const dead = (this.dead || []).find((d) => d.id === body.id), hh = dead && this.households[dead.household - 1];
          const fee = 8; if (hh && !hh.gone && hh.money >= fee) { hh.money -= fee; this.treasury.cash += fee; this.treasury.income += fee; }
        }
      }
      for (const q of crew) { q.task = null; q.agent.anim = 'walk'; if (q !== lead) { q.agent.inside = bid; q.agent.hidden = true; } }
      this.carries = this.carries.filter((x) => x !== c);
    };
    S.endCarry = function (c, cancel) {
      for (const q of crewOf(this, c)) if (q.task?.carry === c.id) q.task = null;
      const p = c.kind === 'patient' ? this.byId.get(c.target) : null; if (p) { p.carriedBy = null; p._stretcherSent = false; if (p.agent.hidden && p.agent.inside == null) { p.agent.hidden = false; } }
      const body = c.kind === 'body' ? this.bodies.find((b) => b.id === c.target) : null; if (body) body.carried = false;
      this.carries = this.carries.filter((x) => x !== c);
      void cancel;
    };

    // a new grave in the churchyard
    S.digGrave = function (body) {
      const w = this.world, T = this.T;
      const ch = this.building(this.chapelId); if (!ch) return;
      const taken = new Set(w.props.filter((p) => p.kind === 'gravestone').map((p) => Math.floor(p.x / T) + ',' + Math.floor(p.y / T)));
      const isFree = (x, y) => x > 0 && y > 0 && x < w.W - 1 && y < w.H - 1 && !w.solid[y * w.W + x] && !taken.has(x + ',' + y) && !w.buildings.some((b) => x >= b.x - 1 && x < b.x + b.w + 1 && y >= b.y - 1 && y <= b.bottom + 1);
      for (let r = 1; r < 12; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const x = ch.x + ch.w + 1 + dx, y = ch.y + 2 + dy * 1;
        if ((x + y) % 2 || !isFree(x, y)) continue;
        w.props.push({ kind: 'gravestone', x: x * T + 8, y: y * T + 14, seed: body.id * 7 + 3, v: 0, solid: true, grave: body.name });
        w.solid[y * w.W + x] = 1; w.dirtyStatics = true;
        return;
      }
    };

    // the sweepers' round
    S.sweepTick = function () {
      init(this);
      // blood fades in the rain and in time; a sweeper washes it sooner
      const now = this.day * 1440 + this.minute;
      this.marks = this.marks.filter((m) => now - (m.day * 1440 + m.min) < 3 * 1440);
      const sweepers = this.people.filter((q) => q.job?.role === 'sweeper' && q.alive !== false && !q.task && q.activity?.act !== 'sleep' && this.hour >= 6 && this.hour < 19);
      for (const sw of sweepers) {
        const items = this.dropped.filter((d) => now - (d.day * 1440 + (d.min || 0)) > 120);
        const targets = [...this.marks.filter((m) => !this.bodies.some((b) => Math.hypot(b.x - m.x, b.y - m.y) < 10)), ...items];
        if (!targets.length) break;
        const t = targets.sort((a, b) => Math.hypot(a.x - sw.agent.x, a.y - sw.agent.y) - Math.hypot(b.x - sw.agent.x, b.y - sw.agent.y))[0];
        sw.task = { act: 'sweep', outdoor: true, x: t.x, y: t.y };
      }
    };
    S.sweepArrive = function (sw) {
      const { x, y } = sw.task; sw.task = null;
      const before = this.marks.length;
      this.marks = this.marks.filter((m) => Math.hypot(m.x - x, m.y - y) > 24);
      const found = this.dropped.filter((d) => Math.hypot(d.x - x, d.y - y) < 24);
      if (found.length) {
        this.dropped = this.dropped.filter((d) => !found.includes(d));
        const val = found.reduce((a, d) => a + (O.Data.GOODS[d.good]?.base || 1) * d.qty, 0), got = Math.max(1, Math.round(val * 0.6));
        this.treasury.cash += got; this.treasury.income = (this.treasury.income || 0) + got;
        this.log(`${sw.name} the sweeper handed in ${found.map((d) => O.Data.GOODS[d.good]?.name.toLowerCase() || d.good).join(', ')} found in the street; sold for ₳${got} for the town purse.`, 'politics');
      }
      if (before !== this.marks.length) this.remember(sw, 'Scrubbed blood off the street today.', 'work', 0.5);
    };

    // daily: wounds close up
    S.woundsDaily = function () {
      for (const p of this.people) if (p.wounds && p.wounds.length) {
        const treated = p.health.illness?.treated || p.activity?.act === 'treated';
        for (const w of p.wounds) { w.sev -= treated ? 0.16 : 0.09; if (treated) w.bandage = true; }
        p.wounds = p.wounds.filter((w) => w.sev > 0.05);
      }
    };

    const _speed = S.speedOf;
    S.speedOf = function (p) { const t = p.task?.act; if (t === 'stretcher-carry') return 16; if (t === 'stretcher') return 30; return _speed.call(this, p); };
    const _tick = S.minuteTick;
    S.minuteTick = function () { _tick.call(this); this.carryTick(); if (this._m % 15 === 0) this.sweepTick(); };
    const _nd = S.newDay;
    S.newDay = function () { _nd.call(this); this.woundsDaily(); };

    // routing for the new errands
    const _zone = S.zoneTile;
    S.zoneTile = function (p, zone) {
      const t = p.task;
      if (t?.act === 'stretcher') { const c = (this.carries || []).find((x) => x.id === t.carry); if (c) return [Math.floor(c.x / this.T), Math.floor((c.y - 1) / this.T)]; }
      if (t?.act === 'stretcher-carry' && t.away) return this.Z.east;
      if (t?.act === 'sweep') return [Math.floor(t.x / this.T), Math.floor((t.y - 1) / this.T)];
      if (t?.act === 'stretcher-follow') { const c = (this.carries || []).find((x) => x.id === t.carry); const lead = c && this.byId.get(c.bearers[0]); if (lead) return [Math.floor(lead.agent.x / this.T), Math.floor(lead.agent.y / this.T)]; }
      return _zone.call(this, p, zone);
    };
    const _onEnter = S.onEnter;
    S.onEnter = function (p, bid) {
      if (p.task?.act === 'stretcher-carry' && bid === p.task.b) { this.deliverStretcher(p, bid); return; }
      return _onEnter.call(this, p, bid);
    };
    const _doOutdoor = S.doOutdoor;
    S.doOutdoor = function (p, act) {
      if (act.act === 'sweep' && p.task?.act === 'sweep') { p.agent.anim = 'sweep'; if ((p.agent.wait || 0) > 8) this.sweepArrive(p); return; }
      if (act.act === 'stretcher-follow' || act.act === 'carried' || act.act === 'away') return;
      if (act.act === 'stretcher') return;
      return _doOutdoor.call(this, p, act);
    };
  }

  O.Aftermath = { installSim, WOUND, BLOOD };
})();
