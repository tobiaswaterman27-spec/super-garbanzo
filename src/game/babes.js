// Babes in arms. A mother with a baby and nobody at home to mind it doesn't leave it: when she goes out
// she carries it, swaddled, against her shoulder, and now and then she jiggles it and hushes it, and
// neighbours stop to coo at it. Indoors she sets it down again.
'use strict';
(function () {
  function setup(game) {
    const cur = () => O.SimRef.cur, Ch = O.Char;
    const carrying = new Set(); let t = 0, coo = 8;
    const near = (x, y, r) => Math.hypot(x - game.player.x, y - game.player.y) < r;
    const setBabe = (q, on) => { if (!!q.app.babe === on) return; q.app.babe = on; if (on) q.agent.carrying = 'babe'; else if (q.agent.carrying === 'babe') q.agent.carrying = null; try { Ch.invalidate(q.app); } catch (e) { /* */ } if (on) carrying.add(q); else carrying.delete(q); };
    game.hooks.update.push((dt) => {
      t += dt; if (t < 1) return; t = 0;
      const s = cur(); if (!s || !s.people) return;
      for (const q of carrying) if (!s.people.includes(q) || q.alive === false) { carrying.delete(q); }
      for (const q of s.people) {
        if (q.sex !== 'f' || q.age < 15 || q.alive === false || !q.agent || !q.children || !q.children.length) continue;
        if (q.task?.babe != null) continue; // carried home from her lying-in: rites.js has her
        const baby = q.children.map((id) => s.byId.get(id)).find((c) => c && c.alive !== false && c.stage === 'baby');
        const out = !q.agent.hidden && q.agent.inside == null && q.agent.inside !== q.home;
        let want = false;
        if (baby && out && !q.agent.mount && !['fight', 'work', 'build', 'fieldwork', 'chop', 'labour'].includes(q.activity?.act) && !q._fighting) {
          const minder = s.people.some((x) => x !== q && x !== baby && x.alive !== false && x.agent && x.agent.inside === q.home && x.age >= 10 && x.household === q.household);
          want = !minder;
        }
        if (want && q.agent.carrying && q.agent.carrying !== 'babe') want = false; // her hands are full
        setBabe(q, want);
      }
      // a neighbour stops to coo
      coo -= 1; if (coo > 0) return; coo = 6 + Math.random() * 6;
      for (const q of carrying) { if (!near(q.agent.x, q.agent.y, 260)) continue; const nb = s.people.find((x) => x !== q && x.agent && !x.agent.hidden && x.agent.inside == null && x.age >= 12 && !x.agent.frozen && Math.hypot(x.agent.x - q.agent.x, x.agent.y - q.agent.y) < 40); if (nb && Math.random() < 0.5) { O.Speech && O.Speech.say(nb, ['Oh, the little lamb!', 'Look at those cheeks!', 'Isn\'t she bonny.', 'He has your eyes.'][Math.floor(Math.random() * 4)], 2.4); O.gesture && O.gesture(nb, 'laugh', 1.2); setTimeout(() => O.Speech && O.Speech.say(q, ['Bless you.', 'She kept me up all night.', 'Shh, don\'t wake him.'][Math.floor(Math.random() * 3)], 2.2), 1800); } else if (Math.random() < 0.3) { O.Speech && O.Speech.say(q, 'Hush, hush now...', 2); } break; }
    });
    (O.extraLines = O.extraLines || []).push((s, q) => carrying.has(q) ? 'You are carrying your baby in your arms; there was nobody at home to mind it.' : '');
    O.Babes = { carrying };
  }
  O.BabesSetup = { setup };
})();
