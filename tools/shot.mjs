// Headless screenshot helper: node tools/shot.mjs <html> <out.png> [w] [h] [evalJs]
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const [,, page, out, w = 1200, h = 900, js] = process.argv;
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: +w, height: +h } });
const errs = [];
p.on('console', m => { if (m.type() === 'error' || m.type()==='warning') errs.push(m.text()); });
p.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
await p.goto('file://' + process.cwd() + '/' + page);
await p.waitForTimeout(600);
if (js) { const r = await p.evaluate(js); if (r !== undefined) console.log('eval:', JSON.stringify(r)); await p.waitForTimeout(400); }
await p.screenshot({ path: out });
console.log(errs.length ? errs.join('\n') : 'no errors');
await b.close();
