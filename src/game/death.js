// The end of a life, and the next one. You can die: beaten to death in a fight (more likely the more
// wounds you carry), of a fever left untended, of hunger, or of old age. Then the town buries you, and
// your heir comes to take up what you left: your house and lands, your businesses, your horses and dog,
// most of your money (the crown takes its tenth), and the crown itself if you wore it. Your crimes, your
// posts and your gang die with you; the heir is known in the town only as your child. Or begin anew.
'use strict';
(function () {
  function setup(game) {
    const PS = O.PlayerState, cur = () => O.SimRef.cur, esc = (t) => O.escape(String(t)), D = O.Data;
    let dead = false;
    const me = () => O.Forge.player || {};
    const fullName = () => `${me().name || 'The stranger'} ${me().surname || ''}`.trim();

    // ---------------------------------------------------------------- how it comes
    // a beating: called when you're knocked down; returns true if it was the end
    O.deathRoll = (by) => {
      if (dead || (by && /guard|sergeant|watch/.test(by.job?.role || ''))) return false; // (the watch take you alive)
      const w = (PS.wounds || []).length, armed = by && (by.agent?.weapon || by.armed || ['sword', 'axe', 'dagger'].includes(by.equipped));
      const p = Math.min(0.5, 0.03 + w * 0.1 + (armed ? 0.08 : 0) + (PS.ill ? 0.05 : 0));
      if (Math.random() >= p) return false;
      die(`was beaten to death by ${by ? by.first + ' ' + (by.sur || '') : 'an assailant'}`.replace(/ +/g, ' ').trim(), 'beaten');
      return true;
    };
    let tk = 0;
    game.hooks.update.push((dt) => {
      if (dead) return; tk -= dt; if (tk > 0) return; tk = 1;
      const s = cur(); if (!s) return;
      if (PS.hp <= 0.5 && PS.hunger <= 0) return die('starved to death', 'hunger');
      if (PS.ill && PS.ill.sev > 0.7 && PS.hp <= 9 && Math.random() < 0.01) return die(`died of ${PS.ill.kind === 'fever' ? 'a fever' : PS.ill.kind === 'flux' ? 'the flux' : 'a chill that went to the chest'}`, 'illness');
      // old age: from sixty, each birthday is a little more of a gamble
      const age = me().age || 30;
      if (age >= 60 && PS._ageChecked !== age) { PS._ageChecked = age; if (Math.random() < (age - 55) * 0.04) return die('died peacefully in old age', 'age'); }
    });
    O.die = die; O.playerDead = () => dead;

    // ---------------------------------------------------------------- the end
    function die(how, kind) {
      if (dead) return; dead = true;
      const s = cur(), p = game.player, H = O.SimRef.home;
      p.locked = true; p.anim = 'lie'; game.sleepState = null;
      const name = fullName(), age = me().age || 30;
      const days = (H.day - (PS.startDay || 1)) + 1;
      const posts = ((O.Employment && O.Employment.posts()) || []).map((e) => `${e.role} at ${e.bizName}`);
      const owned = [...(O.Travel?.visited.values() || [])].flatMap((v) => v.world.buildings.filter((b) => b.owner?.kind === 'player').map((b) => b.name || 'a house'));
      const crowned = O.crowned && O.crowned();
      const friends = s.people.filter((q) => (q.rel?.get(0)?.affinity || 0) > 0.3).length;
      // the town hears of it, and buries you
      s.log(`${name} ${how}.`, 'death');
      O.Chronicle && O.Chronicle.deed && O.Chronicle.deed(s, `${name} ${how}.`, `You ${how.replace(/^was /, 'were ').replace(/^died/, 'died')}.`, 'player', 3, true);
      for (const q of s.people) { const a = q.rel?.get(0)?.affinity || 0; if (a > 0.25) { s.remember(q, `${name} is dead. We buried ${me().sex === 'f' ? 'her' : 'him'} at the chapel.`, 'grief', 2, 0); q.mood -= 0.2; } }
      (PS.forebears = PS.forebears || []).push({ name, age, days, how, crowned: !!crowned, title: PS.title || null });
      const line = `<p class="speech">${esc(name)} ${esc(how)}, aged ${age}, after ${days} day${days === 1 ? '' : 's'} in Eldoria.</p>
        <div class="kv"><div><span class="lbl">Earned honestly</span><b>₳${Math.round(PS.earned || 0)}</b></div><div><span class="lbl">Left behind</span><b>₳${Math.round(PS.money)}</b><small>${owned.length ? owned.slice(0, 3).map(esc).join(', ') + (owned.length > 3 ? ` and ${owned.length - 3} more` : '') : 'no property'}</small></div><div><span class="lbl">Mourned by</span><b>${friends}</b><small>friends</small></div><div><span class="lbl">Was</span><b>${crowned ? (me().sex === 'f' ? 'Queen' : 'King') : esc(PS.title || (posts[0] || 'a stranger').split(' at ')[0])}</b></div></div>
        ${(PS.forebears || []).length > 1 ? `<p class="caption">Before you: ${PS.forebears.slice(0, -1).map((f) => `${esc(f.name)} (${f.how}, aged ${f.age})`).join('; ')}.</p>` : ''}`;
      const young = age < 36, kinM = young ? 'nephew' : 'son', kinF = young ? 'niece' : 'daughter';
      setTimeout(() => {
        O.Panels.open('Here lies ' + name, `${line}<p>Who comes after?</p><div class="topics"><button data-h="m">Play on as your ${kinM}</button><button data-h="f">Play on as your ${kinF}</button><button data-h="new">Begin a new life</button></div>`, (r) => {
          r.querySelectorAll('[data-h]').forEach((b) => b.onclick = () => { if (b.dataset.h === 'new') { O.Save.clear(); O.Names && O.Names.newLife(); try { localStorage.removeItem('outlaw.spec'); localStorage.removeItem('outlaw.created'); } catch (e) { /* ignore */ } window.__noAutosave = true; location.reload(); return; } heir(b.dataset.h, b.dataset.h === 'm' ? kinM : kinF, crowned); });
        });
        // the panel can't be shut without choosing
        const x = document.querySelector('.panel-modal .x'); if (x) x.style.display = 'none';
      }, 1600);
    }

    // ---------------------------------------------------------------- the heir
    function heir(sex, kin, crowned) {
      const s = cur(), H = O.SimRef.home, K = H.kingdom, old = O.Forge.spec ? O.Forge.spec() : {};
      const r = O.RNG(O.hash('heir', fullName(), H.day));
      const first = r.pick((D.NAMES && D.NAMES[sex]) || ['Wat']);
      const sp = Object.assign({}, old, { name: first, sex, age: r.int(18, 24), beard: sex === 'm' ? r.pick(['none', 'stubble', 'full']) : 'none', hairStyle: sex === 'f' ? r.pick(['long', 'braid', 'bun']) : r.pick(['short', 'messy', 'crop']), hairGrey: false });
      let a; try { a = O.Creator.appearanceFromSpec(sp); } catch (e) { a = O.Forge.player; }
      O.Forge.setPlayer && O.Forge.setPlayer(a, sp); game.setPlayerAppearance(a); game.player._baseA = a;
      PS.lineSpec = sp;
      // what is inherited, and what dies with the dead
      const duty = Math.floor(PS.money * 0.1); PS.money -= duty; if (K) K.treasury += duty;
      for (const e of ((O.Employment && O.Employment.posts()) || []).slice()) if (!(crowned && ['monarch'].includes(e.role))) O.Employment.quit(null, e);
      PS.crimes = []; PS.bounty = 0; PS.bountyAmount = 0; PS.gangRanks = []; PS.gangTrials = {}; PS.contract = null; PS.disguise = null; PS.gaol = null; PS.exiled = false; PS.stolen = {};
      PS.rep.criminal = 0; PS.rep.guard = 0; PS.rep.civilian *= 0.5; PS.rep.merchant *= 0.5; for (const k in PS.localRep || {}) PS.localRep[k] *= 0.5;
      for (const k in PS.skills || {}) PS.skills[k] = +(PS.skills[k] * 0.4).toFixed(3);
      PS.learning = (PS.learning || 0) * 0.3; PS.knight = false; if (!crowned) PS.title = null;
      PS.hp = 100; PS.energy = 90; PS.hunger = 80; PS.wounds = []; PS.ill = null; PS.tipsy = 0;
      PS.startDay = H.day; PS.yearsHere = 0; PS._ageChecked = null; PS.reeve = false; PS.reeveOf = {}; PS.plot = null; PS.anointed = crowned ? PS.anointed : false;
      if (crowned) PS.coronation = null, PS.anointed = false; // (the heir is crowned in turn)
      PS.leads = []; PS.roadLead = null; PS.mail = [];
      // the townsfolk know the heir only as the dead one's child; friends are warmer
      for (const v of [...(O.Travel?.visited.values() || [])]) for (const q of v.sim.people) { const rr = q.rel?.get(0); if (rr) { rr.affinity = (rr.affinity || 0) * 0.5; rr.familiar = (rr.familiar || 0) * 0.3; } }
      // the heir comes up the road to the family's door
      dead = false; game.player.locked = false; game.player.anim = 'idle';
      if (game.scene) game.exitBuilding();
      const res = PS.residence && s.world.placeId === PS.residence.place && s.world.buildings.find((b) => b.id === PS.residence.b);
      if (res && res.doorX != null) { game.player.x = res.doorX * 16 + 8; game.player.y = (res.doorY + 1) * 16 + 4; }
      else { const Z = s.Z.square; if (Z) { game.player.x = ((Z[0] + Z[2]) >> 1) * 16 + 8; game.player.y = (Z[3] + 1) * 16 + 6; } }
      O.Panels.close();
      const word = sex === 'm' ? (kin === 'son' ? 'son' : 'nephew') : (kin === 'daughter' ? 'daughter' : 'niece');
      s.log(`${first} ${sp.surname}, ${word} of the late ${(PS.forebears || []).slice(-1)[0]?.name || 'stranger'}, has come to take up the inheritance.`, 'life');
      O.UI.say(`You are ${first} ${sp.surname}, ${word} of the late ${(PS.forebears || []).slice(-1)[0]?.name}. ${duty ? `The crown has taken its tenth (₳${duty}); ` : ''}what was left is yours: the purse, ${crowned ? 'the crown, ' : ''}the house and whatever else was held. Your forebear's posts, debts of honour and sins were buried with them.`);
      O.Save && O.Save.save && setTimeout(() => { try { O.Save.save(); } catch (e) { /* ignore */ } }, 500);
    }
    // a reloaded heir keeps the heir's face
    let applied = false;
    game.hooks.update.push(() => { if (applied || !PS.lineSpec || !O.Creator) return; applied = true; try { const a = O.Creator.appearanceFromSpec(PS.lineSpec); O.Forge.setPlayer(a, PS.lineSpec); game.setPlayerAppearance(a); game.player._baseA = a; } catch (e) { /* ignore */ } });
  }
  O.DeathSetup = { setup };
})();
