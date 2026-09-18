/**
 * Capture a scroll-driven site as stitched viewport frames.
 *
 *   node tools/capture-scroll.mjs <url> <slug> [--frames 7] [--width 1440] [--height 900]
 *
 * Some sites (GSAP/ScrollTrigger, pinned sections, smooth-scroll libraries)
 * only render as you scroll, so one tall screenshot comes out blank or full of
 * gaps. This scrolls a viewport-sized window down the page and writes one PNG
 * per step to tools/frames/<slug>-N.png; stitch them into the preview image.
 */
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const here = dirname(fileURLToPath(import.meta.url));
const [url, slug, ...rest] = process.argv.slice(2);
const arg = (n, d) => { const i = rest.indexOf(`--${n}`); return i === -1 ? d : Number(rest[i + 1]); };
const frames = arg('frames', 7), width = arg('width', 1440), height = arg('height', 900);
const port = 9740 + Math.floor(Math.random() * 200);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const chrome = spawn(CHROME, ['--headless=new','--disable-gpu','--hide-scrollbars',
  `--remote-debugging-port=${port}`,`--user-data-dir=/tmp/capture-scroll-${port}`,
  `--window-size=${width},${height}`,'about:blank'], { stdio: 'ignore' });
process.on('exit', () => chrome.kill());

let ws, nextId = 1; const pending = new Map();
const send = (method, params = {}, timeout = 25000) => Promise.race([
  new Promise((res, rej) => { const id = nextId++; pending.set(id, { res, rej }); ws.send(JSON.stringify({ id, method, params })); }),
  sleep(timeout).then(() => { throw new Error(`${method} timed out`); }),
]);
const evaluate = (expression, awaitPromise = false) =>
  send('Runtime.evaluate', { expression, awaitPromise, returnByValue: true });

try {
  let target;
  for (let i = 0; i < 40 && !target; i++) {
    await sleep(250);
    try { target = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find((t) => t.type === 'page'); } catch {}
  }
  ws = new WebSocket(target.webSocketDebuggerUrl);
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { const { res, rej } = pending.get(m.id); pending.delete(m.id); m.error ? rej(new Error(m.error.message)) : res(m.result); }
  });
  await new Promise((r) => ws.addEventListener('open', r, { once: true }));
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url });
  await sleep(6000);

  const { result } = await evaluate('Math.max(document.body.scrollHeight, document.documentElement.scrollHeight)');
  const pageHeight = result.value || height * frames;
  const step = Math.max(height, Math.floor((pageHeight - height) / (frames - 1)));
  const dir = resolve(here, 'frames');
  mkdirSync(dir, { recursive: true });

  for (let i = 0; i < frames; i++) {
    const y = Math.min(i * step, Math.max(0, pageHeight - height));
    await evaluate(`window.scrollTo({top:${y},behavior:'instant'}); document.scrollingElement.scrollTop=${y}; true`);
    await sleep(1400);
    const shot = await send('Page.captureScreenshot', { format: 'png' }, 30000);
    writeFileSync(resolve(dir, `${slug}-${i}.png`), Buffer.from(shot.data, 'base64'));
  }
  console.log(`${slug}: ${frames} frames of ${width}x${height} (page ${pageHeight})`);
} catch (error) {
  console.error(`${slug}: ${error.message}`);
  process.exitCode = 1;
} finally { ws?.close(); chrome.kill(); }
