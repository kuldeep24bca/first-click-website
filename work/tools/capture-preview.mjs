/**
 * Capture a full-page preview for the portfolio grid.
 *
 *   node tools/capture-preview.mjs <url> <slug> [--width 1440] [--max 5200]
 *
 * Loads the page in headless Chrome, scrolls to the bottom so scroll-triggered
 * animations have run, then captures the whole page and writes a PNG to
 * assets/previews/<slug>.png. Resize it (900px wide WebP) before shipping —
 * see tools/README.md.
 *
 * No dependencies: uses Chrome's DevTools Protocol over Node's built-in WebSocket.
 */

import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const here = dirname(fileURLToPath(import.meta.url));

const [url, slug, ...rest] = process.argv.slice(2);
if (!url || !slug) {
  console.error('usage: node tools/capture-preview.mjs <url> <slug> [--width N] [--max N]');
  process.exit(1);
}
const arg = (name, fallback) => {
  const i = rest.indexOf(`--${name}`);
  return i === -1 ? fallback : Number(rest[i + 1]);
};
const width = arg('width', 1440);
const maxHeight = arg('max', 5200);
const port = 9333 + Math.floor(Math.random() * 400);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const chrome = spawn(CHROME, [
  '--headless=new',
  '--disable-gpu',
  '--hide-scrollbars',
  `--remote-debugging-port=${port}`,
  `--user-data-dir=/tmp/capture-preview-${port}`,
  `--window-size=${width},900`,
  'about:blank',
], { stdio: 'ignore' });

const cleanup = () => chrome.kill();
process.on('exit', cleanup);

let ws;
let nextId = 1;
const pending = new Map();

const send = (method, params = {}, timeout = 20000) =>
  Promise.race([
    new Promise((resolveCall, rejectCall) => {
      const id = nextId++;
      pending.set(id, { resolveCall, rejectCall });
      ws.send(JSON.stringify({ id, method, params }));
    }),
    sleep(timeout).then(() => {
      throw new Error(`${method} timed out after ${timeout}ms`);
    }),
  ]);

const evaluate = (expression, awaitPromise = false) =>
  send('Runtime.evaluate', { expression, awaitPromise, returnByValue: true });

try {
  // Wait for the DevTools endpoint, then open a tab.
  let target;
  for (let i = 0; i < 40 && !target; i++) {
    await sleep(250);
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/list`);
      target = (await res.json()).find((t) => t.type === 'page');
    } catch {
      /* not up yet */
    }
  }
  if (!target) throw new Error('Chrome DevTools endpoint did not start');

  ws = new WebSocket(target.webSocketDebuggerUrl);
  ws.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolveCall, rejectCall } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? rejectCall(new Error(msg.error.message)) : resolveCall(msg.result);
    }
  });
  await new Promise((r) => ws.addEventListener('open', r, { once: true }));

  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', {
    width, height: 900, deviceScaleFactor: 1, mobile: false,
  });

  const loaded = new Promise((r) => {
    const onMessage = (event) => {
      if (JSON.parse(event.data).method === 'Page.loadEventFired') {
        ws.removeEventListener('message', onMessage);
        r();
      }
    };
    ws.addEventListener('message', onMessage);
  });
  await send('Page.navigate', { url });
  await Promise.race([loaded, sleep(25000)]);
  await sleep(2500);

  // Scroll through the page so lazy images and scroll animations fire.
  // The height is measured once and the step count capped: pages that grow as
  // they reveal (or hijack scrolling) would otherwise loop forever.
  const scrolled = evaluate(`(async () => {
    const scroller = document.scrollingElement || document.documentElement;
    const height = Math.min(scroller.scrollHeight, ${maxHeight * 2});
    const steps = Math.min(Math.ceil(height / 600), 40);
    for (let i = 1; i <= steps; i++) {
      const y = (height / steps) * i;
      window.scrollTo(0, y);
      scroller.scrollTop = y;
      await new Promise(r => setTimeout(r, 180));
    }
    await new Promise(r => setTimeout(r, 900));
    return true;
  })()`, true);
  await Promise.race([scrolled, sleep(30000)]);

  // Freeze animations so the compositor can settle, then grow the viewport to
  // the page height and shoot it in one frame. (captureBeyondViewport never
  // returns on pages that animate continuously.)
  await evaluate(`(() => {
    // Finish any GSAP/ScrollTrigger reveals rather than letting them rewind
    try {
      if (window.gsap) window.gsap.globalTimeline.progress(1);
      if (window.ScrollTrigger) {
        window.ScrollTrigger.getAll().forEach((t) => t.animation && t.animation.progress(1));
        window.ScrollTrigger.getAll().forEach((t) => t.kill && t.kill(false));
      }
    } catch (e) {}

    const style = document.createElement('style');
    style.textContent = '*,*::before,*::after{animation-play-state:paused !important;transition:none !important;scroll-behavior:auto !important}';
    document.head.appendChild(style);

    // Anything still fully transparent was waiting on a scroll trigger
    document.querySelectorAll('body *').forEach((el) => {
      const cs = getComputedStyle(el);
      if (cs.opacity !== '0') return;
      el.style.setProperty('opacity', '1', 'important');
      if (cs.transform !== 'none') el.style.setProperty('transform', 'none', 'important');
    });

    window.scrollTo(0, 0);
    document.scrollingElement.scrollTop = 0;
    return true;
  })()`).catch(() => {});
  await sleep(600);

  const measured = await evaluate(
    'Math.max(document.body.scrollHeight, document.documentElement.scrollHeight)'
  ).catch(() => null);
  const height = Math.min(measured?.result?.value || 3000, maxHeight);

  await send('Emulation.setDeviceMetricsOverride', {
    width, height, deviceScaleFactor: 1, mobile: false,
  });
  await sleep(1200);

  const shot = await send('Page.captureScreenshot', { format: 'png' }, 45000);

  const out = resolve(here, '..', 'assets', 'previews', `${slug}.png`);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, Buffer.from(shot.data, 'base64'));
  console.log(`${slug}: ${width}x${height} -> ${out}`);
} catch (error) {
  console.error(`${slug}: ${error.message}`);
  process.exitCode = 1;
} finally {
  ws?.close();
  chrome.kill();
}
