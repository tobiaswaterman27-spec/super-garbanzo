// What townsfolk do with an hour to themselves, the same things you can: on Sunday afternoon and on
// long summer evenings some go down to the water and fish (and bring home supper if they're lucky),
// dig their bit of garden by the door, wash clothes at the well, sit on the step whittling or mending,
// read on a bench if they have their letters, or play a tune on the doorstep. Each to their temper:
// the patient fish, the industrious dig, the social play, the scholarly read.
'use strict';
(function () {
  const T = 16;
  const ANIM = { fish: 'fish', garden: 'hoe', wash: 'scrub', whittle: 'work', read: 'read', tune: 'lute' };
  function setup(game) {
    const cur = () => O.SimRef.cur;
    const SP = O.Sim.prototype, _plan = SP.plan;
    // land tiles beside water, near the town: where you'd sit with a line
    function shore(s) {
      const w = s.world; if (w._shoreList) return w._shoreList; const TR = w.TER, out = [];
      if (TR && w.ter) { const x0 = Math.max(1, w.ox - 25), x1 = Math.min(w.W - 2, w.ox + w.townW + 25), y0 = Math.max(1, w.oy - 25), y1 = Math.min(w.H - 2, w.oy + w.townH + 25);
        for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const i = y * w.W + x; if (w.ter[i] === TR.WATER || w.solid[i]) continue; if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => w.ter[(y + dy) * w.W + x + dx] === TR.WATER)) out.push([x, y]); } }
      w._shoreList = out.filter((_, i) => i % 3 === 0).slice(0, 400); return w._shoreList;
    }
    function choose(s, p) {
      const t = p.traits || [], r = p.job?.role || '', k = (p.id * 7 + s.day) % 10;
      if ((t.includes('patient') || /fisher|ferry|boat/.test(r) || k < 2) && shore(s).length) return 'fish';
      if (t.includes('industrious') || /farm|garden|herb/.test(r) || k < 4) return 'garden';
      if ((t.includes('scholarly') || /clerk|priest|scribe|teacher|physician/.test(r) || (p.skills && p.skills.letters > 0.3)) && k < 7) return 'read';
      if ((t.includes('social') || /minstrel|bard/.test(r)) && k < 8) return 'tune';
      if (p.sex === 'f' && k < 8) return 'wash';
      return 'whittle';
    }
    SP.plan = function (p) {
      const r = _plan.apply(this, arguments);
      try {
        if (!r || p.visitor || p.age < 13 || p.job?.onShift || p.homefront || p.errand || p._fighting || (p.needs && p.needs.hunger < 60)) return r; // (fed first: nobody goes fishing on an empty belly)
        if (!['home', 'rest', 'stroll', 'socialise', 'idle'].includes(r.act)) return r;
        const h = this.minute / 60, sunday = this.weekday === 6, summer = this.season === 'summer' || this.season === 'spring';
        const leisure = (sunday && h >= 13 && h < 18) || (summer && h >= 19 && h < 20.75) || (h >= 15 && h < 17 && p.age >= 60);
        if (!leisure || this.weather && /rain|heavy|storm|snow|blizzard/.test(this.weather.kind || '')) return r;
        if (((p.id * 31 + this.day * 3 + Math.floor(h)) % 7) > 1) return r; // (only some, and not every hour)
        const kind = choose(this, p);
        return { act: 'pastime', kind, outdoor: true, zone: kind === 'fish' ? 'shore:pt' : kind === 'wash' ? 'well:pt' : kind === 'read' ? 'bench' : 'doorstep:pt' };
      } catch (e) { return r; }
    };
    const _zone = SP.zoneTile;
    SP.zoneTile = function (p, zone) {
      try {
        if (zone === 'shore:pt') { const L = shore(this); if (L.length) return L[(p.id * 13) % L.length]; }
        if (zone === 'well:pt') { const w = this.world.props.find((x) => x.kind === 'well'); if (w) return [Math.floor(w.x / T) - 1 + (p.id % 3), Math.floor(w.y / T) + 1 + (p.id % 2)]; }
        if (zone === 'doorstep:pt') { const b = this.building(p.home); if (b && b.doorX != null) return [b.doorX + ((p.id % 2) ? 1 : -1), b.doorY + 1]; }
      } catch (e) { /* */ }
      return _zone.call(this, p, zone === 'shore:pt' || zone === 'well:pt' || zone === 'doorstep:pt' ? 'home' : zone);
    };
    const _anim = SP.idleAnim;
    SP.idleAnim = function (p) { if (p.activity?.act === 'pastime') { if (p.agent.talking) return 'talk'; return ANIM[p.activity.kind] || 'idle'; } return _anim.apply(this, arguments); };
    // what comes of it
    let at = 0;
    game.hooks.update.push((dt) => {
      at -= dt; if (at > 0) return; at = 20;
      const s = cur(); if (!s) return;
      for (const p of s.people) {
        const a = p.activity; if (!a || a.act !== 'pastime' || p.agent.path) continue;
        const hh = s.household(p); if (!hh) continue;
        if (a.kind === 'fish' && Math.random() < 0.18 + ((p.skills && p.skills.fishing) || 0) * 0.3) { hh.pantry.fish = (hh.pantry.fish || 0) + 1; p.skills.fishing = Math.min(1, (p.skills.fishing || 0) + 0.02); if (O.Speech && Math.hypot(p.agent.x - game.player.x, p.agent.y - game.player.y) < 200) O.Speech.say(p, ['Got one!', 'Supper!', 'A fine perch, that.'][p.id % 3], 2); }
        if (a.kind === 'garden' && Math.random() < 0.1) hh.pantry.cabbage = (hh.pantry.cabbage || 0) + 1;
        if (a.kind === 'whittle' && Math.random() < 0.05 && O.Data.GOODS.cup) hh.pantry.cup = (hh.pantry.cup || 0) + 1;
        if (a.kind === 'read') p.skills.letters = Math.min(1, (p.skills.letters || 0) + 0.005);
        if (a.kind === 'tune' && O.Speech && Math.random() < 0.3 && Math.hypot(p.agent.x - game.player.x, p.agent.y - game.player.y) < 220) O.Speech.say(p, '♪', 2);
      }
    });
    (O.extraLines = O.extraLines || []).push((s, q) => { const a = q.activity; if (!a || a.act !== 'pastime') return ''; return { fish: 'You are sitting by the water with a line out, in your own time; you\'d rather the fish didn\'t hear you talking.', garden: 'You are digging your bit of garden by the door, in your own time.', wash: 'You are washing clothes at the well.', whittle: 'You are sitting on your step whittling or mending, in your own time.', read: 'You are reading on a bench, in your own time; you have your letters and are proud of it.', tune: 'You are playing a tune on your doorstep for the pleasure of it.' }[a.kind] || ''; });
  }
  O.Pastimes2Setup = { setup };
})();
