// War made visible: the King's host marching down the King's Road in column behind its banner, the
// recruiting sergeant in the square (take the coin and march, or take it and run), and the
// armies and battles on the kingdom map.
'use strict';
(function () {
  const PS = O.PlayerState, esc = (s) => O.escape(String(s));

  function setup(game, home, npcUI) {
    const K = home.kingdom, T = home.T, Ch = O.Char, live = [];
    const banner = O.Env.prop('banner', 3, 0);

    // ---------------- the column on the King's Road ----------------
    home.onArmyPasses = (a) => {
      if (live.length) return;
      const n = O.clamp(Math.round(a.men / 10), 8, 26), y0 = (home.world.roadY || 30) * T + 22, x0 = (home.Z.east[0] + 3) * T;
      const men = [];
      for (let i = 0; i < n; i++) {
        const row = Math.floor(i / 2), col = i % 2;
        const ap = Ch.makeAppearance(O.hash('soldier', a.id, i), { role: i === 1 ? 'noble' : 'guard', sex: 'm', age: 18 + (i * 7) % 26, wealth: i === 1 ? 0.9 : 0.4 });
        men.push({ a: ap, x: x0 + row * 26 + (col ? 9 : 0), y: y0 - col * 13, dir: 1, anim: 'walk', ft: i * 0.17, army: a, banner: i === 0 });
      }
      live.push({ a, men });
      home.log(`${a.name.charAt(0).toUpperCase() + a.name.slice(1)} marched through ${home.world.name}, ${a.men} strong, bound for the north.`, 'war');
      if (game.world === home.world && !game.scene) O.Panels.toast(`Drums on the King's Road: ${a.name} is marching through ${home.world.name}.`);
    };
    game.hooks.update.push((dt) => {
      const dtm = Math.min(dt * game.clock.speed, 4);
      for (const L of live) { for (const m of L.men) { m.x -= 30 * dtm; m.ft += dt; } if (L.men.every((m) => m.x < -40)) L.done = true; }
      for (let i = live.length - 1; i >= 0; i--) if (live[i].done) live.splice(i, 1);
      if (!game.scene && game.world === home.world) game.actors = [...game.actors.filter((x) => !x.army), ...live.flatMap((L) => L.men)];
    });
    // the standard-bearer's banner rides above the column
    game.hooks.drawTop && game.hooks.drawTop.push((ctx, cam) => {
      if (game.scene || game.world !== home.world) return;
      for (const L of live) for (const m of L.men) if (m.banner) ctx.drawImage(banner.canvas, Math.round(m.x - banner.ox - cam.x + 5), Math.round(m.y - banner.oy - cam.y - 18));
    });

    // ---------------- the recruiting sergeant ----------------
    const prevExtra = npcUI.extraButtons, prevOn = npcUI.onExtra;
    npcUI.extraButtons = (q) => { const out = prevExtra ? prevExtra(q) : []; if (q.job?.role === 'recruiting sergeant' && !PS.enlisted) out.push(['shilling', "Take the King's coin"]); if (q.job?.role === 'rebel agent' && !PS.enlisted) out.push(['rebel', 'Join the rebellion']); return out; };
    npcUI.onExtra = (q, key, render) => { if (key === 'shilling') { npcUI.closeTalk(); return enlist(q); } if (key === 'rebel') { npcUI.closeTalk(); return joinRebels(q); } return prevOn && prevOn(q, key, render); };
    function joinRebels(q) {
      const P = K.rulers?.pretender;
      O.Panels.open('The rebellion', `<p class="speech">“${esc(P ? P.name : 'The Duke')} is the rightful king, and he remembers his friends. Ten aurins now, a knighthood if we win. If we lose…” He shrugs. “Then we hang together.”</p>
        <p class="caption">Fighting for the rebels is treason if they lose: the crown will hunt you. If they win, you'll be rewarded.</p>
        <div class="topics"><button data-a="join" class="hot">March with the rebels</button><button data-a="no">Say nothing, and leave</button></div>`, (r) => {
        r.querySelector('[data-a=no]').onclick = () => O.Panels.close();
        r.querySelector('[data-a=join]').onclick = () => { O.Panels.close(); PS.money += 10; PS.side = { war: K.war.wars, side: 'rebel' }; campaign('rebel'); };
      });
    }
    // the reckoning when a civil war ends
    const _civ = K.onCivilEnd.bind(K);
    K.onCivilEnd = (winner) => {
      _civ(winner);
      const S = PS.side; if (!S || S.war !== K.war.wars) return; PS.side = null;
      const won = (S.side === 'rebel') === (winner === 'enemy');
      if (won && S.side === 'rebel') { PS.knight = true; PS.money += 150; PS.rep.guard = 0.2; O.Chronicle.deed(home, `The new king has knighted a commoner who fought for him in ${home.world.name}'s country.`, 'The new king knighted you for fighting in the rebellion.', 'rulers', 4, true); O.Panels.toast('A royal messenger: the new king has knighted you, with ₳150 and his thanks. Sir, now.'); }
      else if (won) { PS.money += 40; PS.rep.guard = Math.min(1, PS.rep.guard + 0.2); O.Panels.toast('The crown thanks its loyal volunteers: ₳40 from the treasury, and the watch salutes you.'); }
      else if (S.side === 'rebel') {
        const cr = home.recordCrime({ kind: 'treason', perp: 'player', placeName: 'the rebel host', tile: [0, 0], seen: [], severity: 5 });
        cr.reported = true; cr.investigated = true; cr.evidence = 2; PS.crimes.push(cr.id); PS.bounty = true; PS.bountyAmount = (PS.bountyAmount || 0) + 120; PS.rep.guard = -0.8;
        O.Panels.toast('The rebellion is broken, and the crown has your name. Treason. A bounty of ₳120 is posted.', 'bad');
      }
    };
    function enlist(q) {
      if (PS.wantedLevel && PS.wantedLevel() >= 2) return O.Panels.toast(`${q.first} looks at you hard. “I know a wanted face. The army's no hiding place for your sort.”`, 'bad');
      PS.money += 12; PS.enlisted = { day: home.day };
      O.Panels.open("The King's coin", `<p class="speech">“${(O.Forge.player?.sex || O.Forge.player?.a?.sex) === 'f' ? 'Good lass' : 'Good lad'}. Twelve aurins now, three a day on the march, and a share of whatever we take off ${esc(K.war?.enemy || 'the enemy')}. We go north with the levy at four o'clock.”</p>
        <p class="caption">Marching with the levy means about four days away from ${esc(home.world.name)}. Taking the coin and slipping away is desertion: a crime, and the sergeant has seen your face.</p>
        <div class="topics"><button data-a="march" class="hot">March north with the levy</button><button data-a="run">Pocket the coin and slip away</button></div>`, (r) => {
        r.querySelector('[data-a=march]').onclick = () => { O.Panels.close(); if (K.war?.civil) PS.side = { war: K.war.wars, side: 'crown' }; campaign('crown'); };
        r.querySelector('[data-a=run]').onclick = () => {
          O.Panels.close(); PS.enlisted = null;
          const cr = home.recordCrime({ kind: 'desertion', perp: 'player', placeName: home.world.name, tile: [Math.floor(game.player.x / T), Math.floor(game.player.y / T)], seen: [q], severity: 2 });
          PS.crimes.push(cr.id); PS.rep.guard = Math.max(-1, PS.rep.guard - 0.2);
          O.Panels.toast('You melt into the crowd with the King\'s coin. The sergeant will remember you.', 'bad');
        };
      });
    }
    function campaign(side = 'crown') {
      const W = K.war, startDay = home.day, battles0 = W ? W.battles.length : 0;
      O.Panels.toast(side === 'rebel' ? 'You slip away north to the rebel camp…' : 'You march north with the levy…');
      for (let i = 0; i < 720 * 4; i++) { home.tick(2); PS.tick(2, i % 3 === 0); if (PS.hunger < 30) PS.hunger += 25; }
      const fought = W ? W.battles.slice(battles0) : [];
      const lost = fought.filter((b) => (side === 'rebel' ? b.crownWins : !b.crownWins)).length, won = fought.length - lost;
      const pay = 3 * (home.day - startDay) + (won ? 10 + home.rng.int(0, 30) : 0);
      const hurt = fought.length ? (lost ? home.rng.int(20, 45) : home.rng.int(0, 20)) : 0;
      PS.money += pay; PS.hp = Math.max(10, PS.hp - hurt); PS.enlisted = null;
      if (side !== 'rebel') { PS.warWon = (PS.warWon || 0) + won; PS.warFought = (PS.warFought || 0) + fought.length; } // (enough of it, and you're knighted)
      if (side !== 'rebel') PS.rep.guard = Math.min(1, PS.rep.guard + 0.2); PS.rep.civilian = Math.min(1, PS.rep.civilian + 0.08); PS.rep.local = Math.min(1, PS.rep.local + 0.1);
      const where = fought.length ? K.place(fought[fought.length - 1].at).name : null;
      const host = side === 'rebel' ? 'the rebel host' : "the King's host";
      O.Chronicle.deed(home, where ? `A volunteer from ${home.world.name} fought with ${host} at ${where}.` : `A volunteer from ${home.world.name} marched with ${host}.`, where ? `You fought at ${where} with ${host}${lost ? ' and saw the line break' : ' and saw the enemy run'}.` : `You marched with ${host}; you saw no battle.`, 'war', where ? 3 : 2, side !== 'rebel');
      game.player.x = (home.Z.east[0] - 3) * T; game.player.y = (home.world.roadY || 30) * T + 10; if (game.scene) game.exitBuilding();
      const homePanel = () => O.Panels.open('Home from the north', `<p class="caption">${fought.length ? `You were in ${fought.length} fight${fought.length > 1 ? 's' : ''}: ${won} won, ${lost} lost. ` : 'Four days of marching, digging and waiting; the enemy never came.'}${hurt ? ` You took a wound (−${hurt} health).` : ''}</p><p>The paymaster counts out <b>${O.money(pay)}</b>. Back in ${esc(home.world.name)}, people look at you differently.</p>`);
      // the fighting itself, seen: one of the battles you were in, fought out on the road
      if (fought.length && O.Battle && O.Battle.start({ ours: 14, theirs: lost > won ? 17 : 12, ourLook: 'guard', theirLook: side === 'rebel' ? 'guard' : 'outlaw', ourBanner: side === 'rebel' ? '#2a2a2a' : '#b8352a', theirBanner: side === 'rebel' ? '#b8352a' : '#2a2a2a', title: `The battle at ${where}, as you remember it: press E near one of theirs to strike.`, onEnd: (w, info) => { if (info.kills) { PS.money += 2 * info.kills; } homePanel(); } })) return;
      homePanel();
    }

    // ---------------- the war on the map ----------------
    const _open = O.openMap;
    O.openMap = () => {
      _open();
      const W = K.war, cv = document.getElementById('kmap'); if (!cv || !W) return;
      const ctx = cv.getContext('2d'), sx = cv.width / 64, sy = cv.height / 40;
      if (W.phase === 'war' || W.phase === 'tension') {
        // the northern border, smoking
        const g = K.place('ravenscar'); ctx.fillStyle = 'rgba(160,40,30,.35)'; ctx.beginPath(); ctx.arc(g.x * sx, g.y * sy, 34, 0, Math.PI * 2); ctx.fill();
      }
      for (const a of W.armies || []) {
        if (a.men <= 0) continue; const p = K.place(a.at); if (!p) continue;
        const x = Math.round(p.x * sx) + (a.side === 'crown' ? -14 : 8), y = Math.round(p.y * sy) - 18;
        ctx.fillStyle = '#2a2018'; ctx.fillRect(x, y, 2, 16);
        ctx.fillStyle = a.side === 'crown' ? '#b8352a' : '#2a2a2a'; ctx.fillRect(x + 2, y, 9, 6);
        ctx.fillStyle = a.side === 'crown' ? '#e0c040' : '#7a2a6a'; ctx.fillRect(x + 5, y + 2, 3, 2);
      }
      for (const b of (W.battles || []).slice(-4)) { const p = K.place(b.at); ctx.fillStyle = '#f0e0c0'; const x = Math.round(p.x * sx), y = Math.round(p.y * sy) + 8; ctx.fillRect(x - 3, y, 7, 1); ctx.fillRect(x, y - 3, 1, 7); }
      const cap = document.querySelector('.mapwrap + .caption');
      if (cap) cap.insertAdjacentHTML('beforeend', W.phase === 'war' ? ` <b class="warn">At war with ${esc(W.enemy)}</b> since day ${W.since}: red flags are the King's hosts, black ${esc(W.enemy)}'s; crosses mark battles. Battles won ${W.battles.filter((b) => b.crownWins).length}, lost ${W.battles.filter((b) => !b.crownWins).length}.` : W.phase === 'tension' ? ` <b class="warn">Raiders are troubling the north.</b>` : W.phase === 'truce' ? ` A truce holds with ${esc(W.enemy)}.` : '');
    };
  }

  O.WarUI = { setup };
})();
