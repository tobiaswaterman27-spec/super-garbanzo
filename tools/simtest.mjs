import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const days = +(process.argv[2] || 3);
const b = await chromium.launch(); const p = await b.newPage();
const errs = []; p.on('pageerror', e => errs.push(e.message + '\n' + e.stack));
await p.goto('file://' + process.cwd() + '/dist/outlaw.html'); await p.waitForTimeout(500);
const r = await p.evaluate((days) => {
  const s = O.sim; O.game.stop(); const out = [];
  const snap = () => { const pop = s.people.filter(p=>!p.visitor);
    const acts = {}; pop.forEach(p => acts[p.activity?.act] = (acts[p.activity?.act]||0)+1);
    const bz = {}; for (const b of s.biz.values()) bz[b.type] = Object.fromEntries(Object.entries(b.stock).map(([k,v])=>[k,Math.floor(v)]).concat([['cash',Math.round(b.cash)]]));
    return { day: s.day, t: (s.minute/60).toFixed(1), hungry: pop.filter(p=>p.needs.hunger<25).length, outside: pop.filter(p=>!p.agent.hidden).length, purse: Math.round(s.households.reduce((a,h)=>a+h.money,0)), acts, bz, bread: s.price(s.supplierOf('bakery'),'bread') }; };
  try {
    for (let i = 0; i < days * 1440 / 2; i++) { s.tick(2); if (i % 360 === 0) out.push(snap()); }
  } catch (e) { out.push('ERR ' + e.message + e.stack); }
  // stuck check: agents not hidden with no path and no goal for activities with buildings
  const stuck = s.people.filter(p => !p.agent.hidden && p.activity?.b && !p.agent.path).map(p => p.name + ':' + p.activity.act);
  out.push({ stuck: stuck.slice(0, 10), nstuck: stuck.length, pop: s.people.length, hist: s.history.slice(-25).map(h => 'D'+h.day+' '+h.text) });
  return out;
}, days);
console.log(JSON.stringify(r, null, 0).replace(/\},\{"day"/g, '},\n{"day"'));
console.log(errs.join('\n') || 'no page errors');
await b.close();
