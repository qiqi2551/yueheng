/**
 * 用 Chrome DevTools Protocol 精确控制视口并截图。
 * 用法：node tools/shot.mjs spec.json
 * spec: [{ out, url, w, h, dpr?, full?, wait?, eval? }]
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9411;
const BASE = `http://127.0.0.1:${PORT}`;

const specPath = process.argv[2];
if (!specPath) { console.error('缺少 spec 文件'); process.exit(1); }
const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function launch() {
  const profile = path.join(os.tmpdir(), 'dsh-shot-' + Date.now());
  const args = [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    '--hide-scrollbars',
    '--force-device-scale-factor=1',
    '--remote-debugging-port=' + PORT,
    '--user-data-dir=' + profile,
    'about:blank'
  ];
  const p = spawn(CHROME, args, { stdio: 'ignore', detached: false });
  return p;
}

async function waitForPort(timeout = 20000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    try {
      const r = await fetch(`${BASE}/json/version`);
      if (r.ok) return await r.json();
    } catch { /* not up yet */ }
    await sleep(200);
  }
  throw new Error('Chrome 调试端口没有起来');
}

class CDP {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    this.listeners = new Map();
    ws.addEventListener('message', (ev) => {
      let msg;
      try { msg = JSON.parse(ev.data); } catch { return; }
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
      } else if (msg.method) {
        const arr = this.listeners.get(msg.method) || [];
        arr.forEach((fn) => fn(msg.params));
      }
    });
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  once(method) {
    return new Promise((resolve) => {
      const arr = this.listeners.get(method) || [];
      const fn = (params) => {
        const i = arr.indexOf(fn);
        if (i >= 0) arr.splice(i, 1);
        resolve(params);
      };
      arr.push(fn);
      this.listeners.set(method, arr);
    });
  }
}

async function openTarget() {
  const r = await fetch(`${BASE}/json/new?about:blank`, { method: 'PUT' });
  if (!r.ok) throw new Error('无法新建标签页: ' + r.status);
  return await r.json();
}

async function main() {
  const chrome = launch();
  try {
    await waitForPort();
    const target = await openTarget();

    const ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((res, rej) => {
      ws.addEventListener('open', res, { once: true });
      ws.addEventListener('error', () => rej(new Error('WS 连接失败')), { once: true });
    });
    const cdp = new CDP(ws);

    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');

    for (const s of spec) {
      const w = s.w || 390;
      const h = s.h || 844;
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width: w,
        height: h,
        deviceScaleFactor: s.dpr || 2,
        mobile: true,
        screenWidth: w,
        screenHeight: h
      });

      const loaded = cdp.once('Page.loadEventFired');
      await cdp.send('Page.navigate', { url: s.url });
      await Promise.race([loaded, sleep(8000)]);
      await sleep(s.wait || 450);

      if (s.eval) {
        const r = await cdp.send('Runtime.evaluate', {
          expression: s.eval, returnByValue: true, awaitPromise: true
        });
        console.log('EVAL ' + s.out + ': ' + JSON.stringify(r.result && r.result.value));
      }

      let clip;
      if (s.full) {
        const m = await cdp.send('Page.getLayoutMetrics');
        const cs = m.cssContentSize || m.contentSize;
        clip = { x: 0, y: 0, width: w, height: Math.ceil(Math.min(cs.height, 6000)), scale: 1 };
      }

      const shot = await cdp.send('Page.captureScreenshot', {
        format: 'png',
        captureBeyondViewport: !!s.full,
        ...(clip ? { clip } : {})
      });
      const outPath = path.resolve(s.out);
      fs.mkdirSync(path.dirname(outPath), { recursive: true });
      fs.writeFileSync(outPath, Buffer.from(shot.data, 'base64'));
      console.log('SHOT ' + outPath);
    }

    ws.close();
  } finally {
    chrome.kill();
  }
}

main().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
