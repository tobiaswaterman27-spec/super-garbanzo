import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 900, height: 640 } });
const errs = []; p.on('pageerror', e => errs.push(e.message + ' ' + e.stack.split('\n')[1]));
await p.goto('file://' + process.cwd() + '/dist/outlaw.html'); await p.waitForTimeout(500);
const list = process.argv.slice(2);
for (const spec of list) {
  const [type, floor, hour] = spec.split(':');
  await p.evaluate(([type, floor, hour]) => {
    const s = O.sim; while (Math.floor(s.minute / 60) !== +hour) s.tick(5);
    const b = s.world.buildings.find(x => x.type === type);
    O.game.enterBuilding(b, +floor); O.game.update(0.016); O.game.draw();
  }, [type, floor || 0, hour || 10]);
  await p.waitForTimeout(150);
  await p.screenshot({ path: `/tmp/claude-0/int-${type}-${floor}.png` });
}
console.log(errs.join('\n') || 'no errors');
await b.close();
