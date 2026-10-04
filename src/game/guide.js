// The guide (/ or the Guide button): controls, and the many ways to live in this world, honest
// work, trade, property, crime, gangs, politics, war, with where each starts.
'use strict';
(function () {
  const KEYS = [['WASD / arrows', 'walk'], ['Shift', 'run'], ['E', 'interact with whatever is nearest: talk, enter, work, buy, read, fight a fire, wake someone asleep in a bed…'], ['Q', 'steal: pickpocket, pick a lock, take a horse'], ['F', 'quick-loot a container or search someone beaten'], ['Space', 'strike'], ['R', 'change weapon'], ['H', 'mount or dismount your horse'], ['I', 'satchel, reputation and skills'], ['L', 'town ledger: people, families, businesses, news'], ['M', 'map of the realm'], ['G', 'your gang'], ['P', 'holdings: property, land, office'], ['C', 'the Chronicle: history, hearsay, your story'], ['B', 'Business: your work, your businesses, and the Crown if you wear it'], ['J', 'your undertakings: jobs, bounties, gang tasks, arrows (give them up here)'], ['/', 'this guide'], ['Esc', 'close a panel']];
  const WAYS = [
    ['Honest work', 'Ask anyone "Who\'s taking on hands?" and they\'ll name the places that want workers and who runs them. Talk to that master at their workplace and ask for work. On shift your tasks are in the corner (press the icon to open them) and arrows show the way, inside buildings too. Business (B) shows your wage, your master and fellow workers; ask for a raise there or in person. Bounty boards at the watch house and hired work at the tavern pay too.'],
    ['Craft and sell', 'Once skilled, make goods from your own materials at a bench you may use (your property or your employer\'s). Mind a market stall in the square to sell to the townsfolk. On Sunday mornings travelling merchants set up at the stalls.'],
    ['Property and land', 'Buy houses or shops with For Sale signs, let them, open businesses. In Holdings (P), buy building plots, have a house built, buy strips of the common field. Enough land makes you gentry.'],
    ['Office and the crown', 'A town chooses its reeve at a moot, or you may petition for its lordship (Holdings, P). In office you set the town\'s taxes, the watch and its works, and speak for it at the council of the realm. The monarch rules from the Business tab (B): the crown tax, pardons, honours, works, festivities, the castle\'s guest list, war and peace; and hears petitions on the throne.'],
    ['Crime', 'Pickpocket and burgle (Q), rob caravans on the King\'s Road, fence goods. Witnesses describe you imperfectly; the watch investigates; disguise helps. Get caught and you face trial.'],
    ['Gangs', 'Ask about town "Know anyone who works outside the law?": the shady and the poor may name a gang hand and where to find them; ask that one to run with their gang. Or claim the abandoned camp in the woods, recruit the poor and the bitter, pay them, plan night jobs, grow the hideout. The Crows will not like it.'],
    ['War and politics', 'When war comes, a recruiting sergeant calls for men: take the King\'s shilling and march (or desert). In a rebellion, a rebel agent drinks in the tavern. Kings die; pretenders rise.'],
    ['Travel', 'Eldoria is an island of thirty-three settlements: the capital Aurelia on the River Aure, the port of Westhaven, Goldmere, Frostmere under the peaks, the farms of Greenvale and Sunfield, castles at Highmere, Eastmarch and Westcliff, and hamlets in the wild places. There is no shortcut: walk off the edge of town onto a road, the King\'s Road, a farm lane, a forest track, and follow it to the next place. Signposts and milestones mark the way; travellers, carts and caravans share it, ruins stand beside it, and in the wild country rival gangs camp by the road and may stop you. Each town lives its own life while you are away.'],
    ['Keep your ears open', 'Ask people for news: what they tell you is what they heard, from whom, and it may be wrong. The crier, bards in the tavern and the Aurelia broadsheet all tell it their own way. The Chronicle keeps the record.'],
    ['Festivals', 'The spring tournament (bet, or ride in the lists), the harvest fair (archery for a purse), the midwinter feast. Throw a party at your own house and invite a few friends.'],
    ['Disasters', 'Fires (grab a bucket), floods after heavy rain, pestilence with quarantines, failed harvests. When one strikes you choose: help, or profit, or flee.'],
  ];
  function open() {
    O.Panels.open('Guide', `<div class="lbl">Controls</div><table><tbody>${KEYS.map(([k, d]) => `<tr><td style="white-space:nowrap"><kbd style="font-family:var(--pix);font-size:10px;border:2px solid var(--line);padding:1px 5px">${k}</kbd></td><td>${d}</td></tr>`).join('')}</tbody></table>
      <div class="lbl" style="margin-top:12px">Ways to live</div><div class="kv">${WAYS.map(([t, d]) => `<div><span class="lbl">${t}</span><small style="color:var(--parch)">${d}</small></div>`).join('')}</div>
      <p class="caption" style="margin-top:12px">The game saves itself each dawn; saves, time speed and the rest are under Esc. Nobody here is waiting for you: the realm lives its life whether you act or not.</p>`);
    const inner = document.querySelector('.panel-modal .ledger-in'); if (inner) inner.classList.remove('narrow');
  }
  function setup(game) {
    game.keyHandlers.push((e) => { if ((e.code === 'Slash' || e.key === '?') && !O.panelOpen) { open(); return true; } return false; });
  }
  // first life: show the guide once, after the character is made
  function firstTime() { try { if (!localStorage.getItem('outlaw.guided')) { localStorage.setItem('outlaw.guided', '1'); open(); } } catch (e) { /* storage unavailable */ } }
  O.Guide = { setup, open, firstTime };
})();
