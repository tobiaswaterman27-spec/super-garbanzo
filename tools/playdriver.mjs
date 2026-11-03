// A playtest driver: keeps one browser open on the built game and takes player inputs over HTTP, so a
// tester (person or agent) can play it one step at a time. NPC speech goes to a file queue so any
// model can answer it: the prompt lands in <dir>/q/<n>.txt and the game waits for <dir>/a/<n>.json.
//   node tools/playdriver.mjs <workdir> [port]
// GET  /look            screenshot + the words on screen
// POST /keys  {"seq":["press KeyE","hold KeyD 800","wait 1000"]}
// POST /type  {"text":"Good day to you"}   (types into the talk box and sends it)
// POST /click {"x":100,"y":200}
'use strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const { chromium } = await import(process.env.PLAYWRIGHT || '/opt/node22/lib/node_modules/playwright/index.mjs');
const dir = path.resolve(process.argv[2] || './playtest'), port = +(process.argv[3] || 8777);
for (const d of ['q', 'a', 'shots']) fs.mkdirSync(path.join(dir, d), { recursive: true });
const root = path.resolve(new URL('../dist', import.meta.url).pathname);
// the game is served over http so it doesn't take itself for an automated test
const files = http.createServer((req, res) => { const f = path.join(root, decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'outlaw.html'); if (!f.startsWith(root) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'Content-Type': f.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/octet-stream' }); fs.createReadStream(f).pipe(res); }).listen(port + 1, '127.0.0.1');
const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const p = await b.newPage({ viewport: { width: 1200, height: 800 } });
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
let n = 0;
await p.exposeFunction('__npcAsk', async (prompt) => {
  const id = String(++n).padStart(4, '0'), q = path.join(dir, 'q', id + '.txt'), a = path.join(dir, 'a', id + '.json');
  fs.writeFileSync(q, prompt);
  for (let t = 0; t < 600; t++) { if (fs.existsSync(a)) { const txt = fs.readFileSync(a, 'utf8'); return txt; } await new Promise((r) => setTimeout(r, 500)); }
  throw { code: 'upstream_error', message: 'no answer in time' };
});
await p.addInitScript(() => { window.claude = { use: async (nm) => (nm === 'sample' ? Object.assign(async (x) => ({ text: await window.__npcAsk(typeof x === 'string' ? x : JSON.stringify(x)) }), { json: async (x) => window.__npcAsk(typeof x === 'string' ? x : JSON.stringify(x)), limits: async () => ({}) }) : null) }; });
await p.goto(`http://127.0.0.1:${port + 1}/outlaw.html`); await p.waitForTimeout(1500);
let shot = 0;
async function look() {
  const f = path.join(dir, 'shots', String(++shot).padStart(4, '0') + '.png'); await p.screenshot({ path: f });
  const text = await p.evaluate(() => { const out = []; for (const el of document.querySelectorAll('body *')) { if (el.children.length && !['P', 'SPAN', 'B', 'BUTTON', 'LABEL', 'KBD', 'SMALL', 'I', 'EM'].includes(el.tagName)) continue; const s = getComputedStyle(el), r = el.getBoundingClientRect(); if (s.display === 'none' || s.visibility === 'hidden' || +s.opacity === 0 || r.width < 2 || r.bottom < 0 || r.top > innerHeight) continue; const t = (el.innerText || el.value || '').trim(); if (t) out.push(t.replace(/\s+/g, ' ')); } return [...new Set(out)].join(' | ').slice(0, 2500); });
  const e = errs.splice(0); return { shot: f, text, errors: e };
}
const body = (req) => new Promise((r) => { let d = ''; req.on('data', (c) => (d += c)); req.on('end', () => { try { r(JSON.parse(d || '{}')); } catch (e) { r({}); } }); });
http.createServer(async (req, res) => {
  try {
    const u = req.url.split('?')[0]; let out = {};
    if (u === '/keys') { for (const step of (await body(req)).seq || []) { const [op, k, ms] = step.split(' '); if (op === 'press') await p.keyboard.press(k); else if (op === 'hold') { await p.keyboard.down(k); await p.waitForTimeout(+ms || 500); await p.keyboard.up(k); } else if (op === 'wait') await p.waitForTimeout(+k || 500); await p.waitForTimeout(120); } out = await look(); }
    else if (u === '/type') { const { text } = await body(req); await p.keyboard.type(String(text || ''), { delay: 15 }); await p.keyboard.press('Enter'); await p.waitForTimeout(800); out = await look(); }
    else if (u === '/click') { const { x, y } = await body(req); await p.mouse.click(+x, +y); await p.waitForTimeout(400); out = await look(); }
    else out = await look();
    res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(out));
  } catch (e) { res.writeHead(500); res.end(String(e && e.message)); }
}).listen(port, '127.0.0.1');
console.log(`driver on ${port}, game on ${port + 1}, work dir ${dir}`);
process.on('SIGTERM', async () => { await b.close(); files.close(); process.exit(0); });
