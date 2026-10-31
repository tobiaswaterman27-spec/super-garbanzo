// Finishing touches that sit over everything else. Whatever a person agrees to do in talk, they do it
// with their body as well as their words: they hand a thing over, count out coins, shake on a bargain,
// bow, laugh, cross themselves, wag a finger. And when something passes into your hands, or out of your
// purse, you move too.
'use strict';
(function () {
  // what a person does with their hands for each thing they agree to (and what you do, if anything)
  const MOVES = {
    give: ['place', 'pickup'], sell: ['place', 'count'], give_pet: ['place', 'crouch'], lend: ['count', 'pickup'], repay: ['count', null], hand_over: ['place', null],
    rent_room: ['point', 'count'], buy: ['count', 'place'], take_gift: ['pickup', 'place'], refuse_gift: ['shake', null], bet: ['count', 'count'], raise: ['count', null],
    betroth: ['celebrate', 'celebrate'], set_wedding: ['nod', null], wedding_guest: ['nod', null], court: ['laugh', null], part: ['shake', null],
    bless: ['pray', 'bow'], absolve: ['pray', 'bow'], pardon: ['nod', null], forgive: ['nod', null], make_peace: ['bow', 'bow'], grudge: ['shake', null],
    odd_job: ['gesture', null], do_job: ['nod', null], retain: ['nod', null], dismiss: ['shake', null], hire_on: ['nod', null], take_job: ['nod', null], seek_job: ['gesture', null], hire_player: ['gesture', null],
    errand: ['gesture', null], want: ['gesture', null], invite: ['wave', null], direct: ['point', null], call: ['wave', null], introduce: ['gesture', null], tell: ['gesture', null], like: ['nod', null],
    teach: ['gesture', 'look'], teach_recipe: ['gesture', 'look'], teach_song: ['celebrate', null], sing: ['celebrate', null], make_song: ['write', null], fit_clothes: ['work', null], name_child: ['nod', null],
    enter_tourney: ['bow', null], set_prices: ['write', null], gang_in: ['nod', null], gang_work: ['gesture', null], join_gang: ['nod', null], offer: ['gesture', null], ask: ['scratch', null],
    recommend: ['gesture', null], swear_friendship: ['celebrate', 'celebrate'], confide: ['look', null], spread: ['gesture', null], borrow: ['pickup', 'count'], heal: ['work', null], contest: ['laugh', null],
    day_off: ['nod', null], hours: ['nod', null], start_now: ['point', null], release: ['nod', null], inform: ['look', null], settle_will: ['write', null], claim_will: ['count', null], duel: ['attack', null],
    drink_with: ['drink', 'drink'], dance_with: ['dance', 'dance'], embrace: ['celebrate', 'celebrate'], play_game: ['laugh', null], pray_with: ['pray', 'pray'],
  };
  const REFUSED = /^(You haven'?t|You have no|Not |No\b|.{0,40} won'?t|.{0,40} would, but|.{0,40} can'?t|.{0,40} refuses)/i;
  const TALKY = new Set(['like', 'tell', 'direct', 'call', 'invite', 'introduce', 'ask', 'want', 'errand', 'offer', 'recommend', 'confide', 'spread']);
  function setup(game) {
    const base = O.NpcActs.apply;
    O.NpcActs.apply = function (s, q, a) {
      const r = base.apply(this, arguments);
      try {
        const mv = a && MOVES[a.do]; if (!mv || !q || !q.agent || (r == null && !TALKY.has(a.do)) || (typeof r === 'string' && REFUSED.test(r))) return r;
        const now = performance.now();
        if (!(q.agent.gest && q.agent.gest.until > now) && O.gesture) O.gesture(q, mv[0], 1.8);
        const P = game.player; if (mv[1] && P && !P.locked && (!P.anim || P.anim === 'idle')) { P.anim = mv[1]; P.ft = 0; setTimeout(() => { if (P.anim === mv[1]) P.anim = 'idle'; }, 1500); }
      } catch (e) { console.error(e); }
      return r;
    };
  }
  O.PolishSetup = { setup };
})();
