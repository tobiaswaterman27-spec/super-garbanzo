const { chromium } = await import(process.env.PLAYWRIGHT || '/opt/node22/lib/node_modules/playwright/index.mjs'); // (the pre-installed Playwright; set PLAYWRIGHT to use another)
export async function start(opts = {}) {
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] }); const p = await b.newPage({ viewport: { width: 1200, height: 800 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message + ' ' + (e.stack || '').split('\n').slice(1, 3).join(' ')));
  await p.goto(new URL('../dist/outlaw.html', import.meta.url).href); await p.waitForTimeout(1200);
  if (!opts.noBegin) { await p.click('#beginLife'); await p.waitForTimeout(900); await p.keyboard.press('Escape'); await p.waitForTimeout(300); await p.keyboard.press('Escape'); }
  return { b, p, errs, done: async () => { console.log(errs.slice(0, 5).join('\n') || 'no errors'); await b.close(); } };
}
