// Headless smoke test: loads the game, plays lines, checks rules, takes screenshots.
import { createRequire } from 'module';
import http from 'http';
import fs from 'fs';
import path from 'path';
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }

const root = path.resolve(new URL('../www', import.meta.url).pathname);
const out = path.resolve(new URL('./out', import.meta.url).pathname);
fs.mkdirSync(out, { recursive: true });
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.webmanifest': 'application/json' };
const server = http.createServer((req, res) => {
  const f = path.join(root, decodeURIComponent(req.url.split('?')[0]).replace(/\/$/, '/index.html'));
  if (!f.startsWith(root) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
}).listen(0);
const url = `http://localhost:${server.address().port}/`;

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
const fail = (msg) => { console.error('FAIL:', msg); process.exitCode = 1; };

await page.goto(url);
await page.waitForTimeout(600);
await page.screenshot({ path: `${out}/0-disclaimer.png` });
await page.click('#disclaimer-ok');
await page.waitForTimeout(1500);
await page.screenshot({ path: `${out}/1-title.png` });

await page.keyboard.press('Enter');
await page.waitForTimeout(1200); // ready -> live
const state = () => page.evaluate(() => { const g = HTN.game; return { phase: g.line.phase, target: g.line.target, pts: g.line.pts, result: g.line.result, health: g.health, out: g.out, pips: g.pips }; });

// Play the exact checkout for the first line.
let s = await state();
if (s.phase !== 'live') fail('line not live: ' + s.phase);
const h0 = s.health;
const plan = (left) => [...Array(Math.floor(left / 5)).fill('punch'), ...Array(left % 5).fill('slap')];
for (const k of plan(s.target)) { await page.evaluate((k) => HTN.act(k), k); await page.waitForTimeout(200); }
s = await state();
if (s.result !== 'exact') fail('expected exact, got ' + s.result);
if (!(s.health < h0)) fail('health did not drop on exact');
await page.waitForTimeout(150);
await page.screenshot({ path: `${out}/2-exact.png` });

// Next line: bust it on purpose.
await page.waitForTimeout(1900);
s = await state();
if (s.phase !== 'live') fail('second line not live: ' + s.phase);
const h1 = s.health;
while (s.pts <= s.target && s.phase === 'live') {
  const left = s.target - s.pts;
  await page.evaluate((k) => HTN.act(k), left % 5 === 0 ? 'slap' : 'punch');
  await page.waitForTimeout(200);
  s = await state();
}
s = await state();
if (s.result !== 'bust') fail('expected bust, got ' + s.result);
if (!(s.health > h1)) fail('health did not rise on bust');
await page.waitForTimeout(900);
await page.screenshot({ path: `${out}/3-snort.png` });

// Mid-line screenshot with the fist.
await page.waitForTimeout(2200);
await page.evaluate(() => HTN.act('punch'));
await page.waitForTimeout(40);
await page.screenshot({ path: `${out}/4-punch.png` });

// Force a win by playing exact lines (use BLOW when charged).
for (let n = 0; n < 40; n++) {
  s = await state();
  if (await page.evaluate(() => HTN.screen) !== 'play' || await page.evaluate(() => !!HTN.game.ending)) break;
  if (s.phase !== 'live') { await page.waitForTimeout(150); continue; }
  if (s.pips >= 2) { await page.evaluate(() => HTN.act('blow')); await page.waitForTimeout(300); await page.screenshot({ path: `${out}/5-blow.png` }); continue; }
  for (const k of plan(s.target - s.pts)) { await page.evaluate((k) => HTN.act(k), k); await page.waitForTimeout(190); }
}
await page.waitForTimeout(5500);
const scr = await page.evaluate(() => HTN.screen);
if (scr !== 'result') fail('expected result screen, got ' + scr);
if (await page.isVisible('#award')) { await page.screenshot({ path: `${out}/6-award.png` }); await page.click('#award-ok'); }
await page.screenshot({ path: `${out}/7-result.png` });

// Stats screen via result screen button (STATS at logical 30,284 88x26)
const box = await page.locator('#game').boundingBox();
await page.mouse.click(box.x + (74 / 240) * box.width, box.y + (297 / 426) * box.height);
await page.waitForTimeout(500);
if (await page.evaluate(() => HTN.screen) !== 'stats') fail('stats screen not opened');
await page.screenshot({ path: `${out}/8-stats.png` });

// Desktop landscape layout
await page.setViewportSize({ width: 1280, height: 720 });
await page.waitForTimeout(300);
await page.screenshot({ path: `${out}/9-desktop.png` });

if (errors.length) fail('page errors:\n' + errors.join('\n'));
await browser.close();
server.close();
console.log(process.exitCode ? 'SMOKE TEST FAILED' : 'SMOKE TEST PASSED', '- screenshots in tests/out');
