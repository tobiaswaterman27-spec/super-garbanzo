// The Church. Out in the quiet country round many towns stands an abbey of monks or a priory of nuns:
// a stone church below with its relic on the altar, and above, the dormitory and the scriptorium. They
// brew, keep bees and herbs, copy books, pray the hours, and take in those who'd join them. Each holds a
// relic of its saint, and pilgrims walk the roads to pray before it; so can you, and come away blessed,
// the lighter of your sins. The bishop's word is law in the Church: a great enough sinner is cast out
// (excommunicated), and then no priest will marry or bless them, and the devout keep their distance,
// until they do penance (a pilgrimage, and a gift to the Church) and are absolved.
'use strict';
(function () {
  const D = O.Data, B = (o) => Object.assign({ hours: [5, 20], recipes: [], sells: [], buys: {}, targets: {}, wage: {} }, o);
  const look = { wall: 'stone', stoneMat: 'stoneWarm', roof: 'slate', roofType: 'gable', chimney: true, sign: 'cross', noFlowers: false };
  D.BUSINESS.abbey = D.BUSINESS.abbey || B({ label: 'Abbey', jobs: [['abbot', 1], ['monk', 4], ['lay brother', 2]], site: 'fields', w: 8, d: 5, floors: 2, look,
    recipes: [{ out: { ale: 1.5 }, inp: {}, role: 'lay brother' }, { out: { herbs: 0.5, candles: 0.6 }, inp: {}, role: 'monk' }, { out: { letter: 0.5, honey: 0.2 }, inp: {}, role: 'monk' }],
    sells: ['ale', 'herbs', 'candles', 'honey'], targets: { ale: 20, herbs: 10, candles: 16, honey: 6, letter: 6 }, wage: { abbot: 0, monk: 1, 'lay brother': 3 } });
  D.BUSINESS.priory = D.BUSINESS.priory || B({ label: 'Priory', jobs: [['prioress', 1], ['nun', 4], ['lay sister', 2]], site: 'woods', w: 8, d: 5, floors: 2, look,
    recipes: [{ out: { cheese: 0.8, eggs: 1 }, inp: {}, role: 'lay sister' }, { out: { herbs: 0.6, medicine: 0.2 }, inp: {}, role: 'nun' }, { out: { cloth: 0.15, candles: 0.4 }, inp: {}, role: 'nun' }],
    sells: ['cheese', 'herbs', 'medicine', 'candles'], targets: { cheese: 12, herbs: 10, medicine: 6, candles: 12, eggs: 10, cloth: 4 }, wage: { prioress: 0, nun: 1, 'lay sister': 3 } });
  D.GOODS.badge = D.GOODS.badge || { name: 'Pilgrim badge', base: 2, unit: 'badge', slots: 1 };
  const SAINTS = ['Aldric', 'Wenna', 'Cuthred', 'Hild', 'Oswy', 'Frideswide', 'Brannoc', 'Edburga', 'Petroc', 'Milburga', 'Guthlac', 'Werburgh'];
  const PARTS = ['finger', 'jawbone', 'sandal', 'girdle', 'cloak', 'tooth', 'hair', 'staff', 'cup', 'skull'];
  O.relicOf = (b) => { if (!b) return null; const h = O.hash('relic', b.id, b.x, b.y); return { saint: SAINTS[h % SAINTS.length], part: PARTS[(h >> 4) % PARTS.length] }; };

  function setup(game) {
    const PS = O.PlayerState, cur = () => O.SimRef.cur, say = (t, k) => O.UI.say(t, k), clamp = O.clamp;
    const relOf = (q) => { const r = q.rel.get(0) || { affinity: 0, familiar: 0 }; q.rel.set(0, r); return r; };
    const holy = (q) => /priest|bishop|chaplain|abbot|abbess|prioress|monk|nun|friar|hermit|lay brother|lay sister/.test(q.job?.role || '');
    const isHouse = (b) => b && (b.type === 'abbey' || b.type === 'priory');
    // ---------------------------------------------------------------- before the relic
    O.sceneMore = O.sceneMore || [];
    O.sceneMore.push(() => {
      const sc = game.scene, s = cur(); if (!sc || !isHouse(sc.b) || sc.floor !== 0) return null;
      const alt = sc.L.items.find((i) => i.kind === 'altar'); if (!alt) return null;
      const [x, y] = sc.anchor(alt), P = game.player; if (Math.hypot(x - P.x, y + 18 - P.y) > 60) return null;
      const R = O.relicOf(sc.b);
      return { type: 'custom', d: -5, x, y: y - 30, label: `Pray before the ${R.part} of St. ${R.saint}`, act: () => pray(s, sc.b, R) };
    });
    function pray(s, b, R) {
      const P = game.player; P.anim = 'pray'; P.ft = 0; P.locked = true;
      setTimeout(() => {
        P.locked = false; if (P.anim === 'pray') P.anim = 'idle';
        const key = s.world.placeId + ':' + b.id, done = (PS.pilgrimages = PS.pilgrimages || {});
        if (done[key] && s.day - done[key] < 28) return say(`You pray before the ${R.part} of St. ${R.saint}. It is quiet here.`);
        done[key] = s.day;
        PS.rep.civilian = Math.min(1, (PS.rep.civilian || 0) + 0.05); PS.rep.criminal = Math.max(-1, (PS.rep.criminal || 0) - 0.06);
        PS.hp = Math.min(100, (PS.hp || 0) + 20); if (PS.wounds && PS.wounds.length) PS.wounds = PS.wounds.slice(1);
        if (PS.canCarry('badge')) PS.add('badge');
        if (PS.excommunicated) PS.excommunicated.penance = (PS.excommunicated.penance || 0) + 1;
        say(`You kneel before the ${R.part} of St. ${R.saint} and pray. You come away lighter, with a pilgrim's badge for your hat.`);
        s.log(`The stranger made pilgrimage to St. ${R.saint} at ${b.name}.`, 'event');
      }, 3000);
    }
    // ---------------------------------------------------------------- pilgrims on the road
    const _plan = O.Sim.prototype.plan;
    O.Sim.prototype.plan = function (p) {
      if (p.visitor && p.id % 5 === 0 && this.hour >= 9 && this.hour < 15) { const ab = this.world.buildings.find((b) => isHouse(b)); if (ab) { p.pilgrim = true; return { act: 'visit', b: ab.id }; } }
      if (PS.excommunicated && this === O.SimRef.cur && p.activity?.act === 'worship') { /* the devout keep apart from you at mass */ }
      return _plan.call(this, p);
    };

    // ---------------------------------------------------------------- the bishop's word
    let ed = -1;
    game.hooks.update.push(() => {
      const s = cur(); if (!s || ed === s.day) return; ed = s.day;
      if (!PS.excommunicated && (PS.rep.criminal || 0) > 0.7 && !(O.crowned && O.crowned())) {
        PS.excommunicated = { day: s.day, penance: 0 };
        s.log('The bishop has cast out the stranger from the Church: bell, book and candle. No priest will marry or bless them.', 'politics');
        say('You are excommunicated: cast out of the Church. No priest will marry or bless you, and the devout will keep their distance.', 'bad');
      }
      if (PS.excommunicated) for (const q of s.people) if (s.has(q, 'pious') && Math.random() < 0.2) relOf(q).affinity = clamp(relOf(q).affinity - 0.02, -1, 1);
    });
    const A = {
      absolve(s, q, a) {
        if (!PS.excommunicated || !/bishop|priest|abbot|abbess|prioress/.test(q.job?.role || '')) return null;
        const gift = clamp(Math.round(Number(a.gift) || 0), 0, 500); if (PS.money < gift) return `You haven't ₳${gift}.`;
        if (!PS.excommunicated.penance && gift < 50) return null;
        PS.money -= gift; const bz = q.job && s.biz.get(q.job.biz); if (bz) bz.cash += gift; PS.excommunicated = null;
        s.log('The stranger has done penance and been taken back into the Church.', 'politics');
        return `${q.first} absolves you${gift ? ` (₳${gift} to the Church)` : ''}. You are taken back into the Church.`;
      },
      take_vows(s, q) {
        if (!/abbot|abbess|prioress/.test(q.job?.role || '')) return null;
        const bz = q.job && s.biz.get(q.job.biz); if (!bz || !O.Employment || !O.Employment.hireByTalk) return null;
        return O.Employment.hireByTalk(s, q);
      },
    };
    const base = O.NpcActs.apply;
    O.NpcActs.apply = function (s, q, a, main) {
      if (a && A[a.do]) return A[a.do](s, q, a);
      if (a && (a.do === 'betroth' || a.do === 'bless') && PS.excommunicated) return 'No priest will do that for one cast out of the Church.';
      return base.apply(this, arguments);
    };
    (O.extraActs = O.extraActs || []).push('absolve {"gift"} (a bishop, priest or head of a religious house taking back one who was excommunicated, after penance: a pilgrimage, or a large gift)', 'take_vows (an abbot, abbess or prioress taking the player into their house as a monk, nun or lay brother or sister)');
    (O.extraLines = O.extraLines || []).push((s, q) => {
      const out = [], b = q.job && s.building(q.job.biz);
      if (isHouse(b)) { const R = O.relicOf(b); out.push(`Your house, ${b.name}, keeps the relic of St. ${R.saint} (the saint's ${R.part}) on the altar; pilgrims come to pray before it. You keep the hours of prayer, and live by the rule.`); }
      if (q.pilgrim) out.push('You are a pilgrim, come a long way to pray before the relic at the abbey.');
      if (PS.excommunicated) out.push(holy(q) ? `The player is excommunicated, cast out of the Church by the bishop${PS.excommunicated.penance ? ', though they have since made pilgrimage' : ''}. You may not marry or bless them; you could absolve them, if they show true penance.` : s.has(q, 'pious') ? 'The player is excommunicated, and you would rather not be seen with them.' : 'You have heard the player was cast out of the Church.');
      return out.join(' ');
    });
  }
  O.ChurchSetup = { setup };
})();
