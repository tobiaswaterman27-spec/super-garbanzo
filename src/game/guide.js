// The guide (/ or the Guide button): controls, and the many ways to live in this world — honest
// work, trade, property, crime, gangs, politics, war — with where each starts.
'use strict';
(function () {
  const KEYS = [['WASD / arrows', 'walk'], ['Shift', 'run'], ['E', 'interact with whatever is nearest: talk, enter, work, buy, read, fight a fire…'], ['Q', 'steal: pickpocket, pick a lock, take a horse'], ['F', 'quick-loot a container or search someone beaten'], ['Space', 'strike'], ['R', 'change weapon'], ['H', 'mount or dismount your horse'], ['I', 'satchel, reputation and skills'], ['L', 'town ledger: people, families, businesses, news'], ['M', 'map of the realm'], ['G', 'your gang'], ['P', 'holdings: property, land, office'], ['C', 'the Chronicle: history, hearsay, your story'], ['/', 'this guide'], ['Esc', 'close a panel']];
  const WAYS = [
    ['Honest work', 'Talk to a master at their workplace during opening hours and ask for work. Work hour-long shifts at their benches for wages; skills grow; a good worker is offered an apprenticeship.'],
    ['Craft and sell', 'Once skilled, make goods from your own materials at a bench you may use (your property or your employer\'s). Mind a market stall in the square to sell to the townsfolk; market day is Freyday.'],
    ['Property and land', 'Buy houses or shops with For Sale signs, let them, open businesses. In Holdings (P), buy building plots, have a house built, buy strips of the common field. Enough land makes you gentry.'],
    ['Office', 'Stand for reeve at the moot (spring, or when the office is empty) — friendships and good standing win votes. Or petition for the lordship. In office you set taxes, the watch, works and Ashford\'s voice at the castle council.'],
    ['Crime', 'Pickpocket and burgle (Q), rob caravans on the King\'s Road, fence goods. Witnesses describe you imperfectly; the watch investigates; disguise helps. Get caught and you face trial.'],
    ['Gangs', 'Claim the abandoned camp in the woods, recruit the poor and the bitter, pay them, plan night jobs, grow the hideout. The Crows will not like it.'],
    ['War and politics', 'When war comes, a recruiting sergeant calls for men: take the King\'s shilling and march (or desert). In a rebellion, a rebel agent drinks in the tavern. Kings die; pretenders rise.'],
    ['Travel', 'Eldoria is an island of thirty-three settlements: the capital Aurelia on the River Aure, the port of Westhaven, Goldmere, Frostmere under the peaks, the farms of Greenvale and Sunfield, castles at Highmere, Eastmarch and Westcliff, and hamlets in the wild places. Leave by the road at the edge of a village. Each town lives its own life while you are away.'],
    ['Keep your ears open', 'Ask people for news: what they tell you is what they heard, from whom, and it may be wrong. The crier, bards in the tavern and the Aurelia broadsheet all tell it their own way. The Chronicle keeps the record.'],
    ['Disasters', 'Fires (grab a bucket), floods after heavy rain, pestilence with quarantines. Help, or profit, or flee.'],
  ];
  function open() {
    O.Panels.open('Guide', `<div class="lbl">Controls</div><table><tbody>${KEYS.map(([k, d]) => `<tr><td style="white-space:nowrap"><kbd style="font-family:var(--pix);font-size:10px;border:2px solid var(--line);padding:1px 5px">${k}</kbd></td><td>${d}</td></tr>`).join('')}</tbody></table>
      <div class="lbl" style="margin-top:12px">Ways to live</div><div class="kv">${WAYS.map(([t, d]) => `<div><span class="lbl">${t}</span><small style="color:var(--parch)">${d}</small></div>`).join('')}</div>
      <p class="caption" style="margin-top:12px">Time runs at the speed set top-right (1× to 240×). The game saves itself each dawn; Save and New life are top-right too. Nobody here is waiting for you: the village lives its life whether you act or not.</p>`);
    const inner = document.querySelector('.panel-modal .ledger-in'); if (inner) inner.classList.remove('narrow');
  }
  function setup(game) {
    game.keyHandlers.push((e) => { if ((e.code === 'Slash' || e.key === '?') && !O.panelOpen) { open(); return true; } return false; });
  }
  // first life: show the guide once, after the character is made
  function firstTime() { try { if (!localStorage.getItem('outlaw.guided')) { localStorage.setItem('outlaw.guided', '1'); open(); } } catch (e) { /* storage unavailable */ } }
  O.Guide = { setup, open, firstTime };
})();
