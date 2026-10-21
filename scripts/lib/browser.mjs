// Controle mínimo de um Chrome/Edge REAL (sem dependências): abre o painel em tela de celular ou de computador, preenche, clica,
// espera e tira prints. Usa o protocolo de depuração do navegador (CDP) pelo WebSocket nativo do Node. Só para uso local de teste.
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const CANDIDATES = [
  process.env.BROWSER_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function openBrowser({ mobile = true, width = mobile ? 390 : 1280, height = mobile ? 844 : 900, port = 9333 } = {}) {
  const exe = CANDIDATES.find((p) => existsSync(p));
  if (!exe) throw new Error('Chrome/Edge não encontrado. Defina BROWSER_PATH.');
  const profile = mkdtempSync(path.join(tmpdir(), 'dojo-browser-'));
  const proc = spawn(exe, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', '--disable-gpu', 'about:blank'], { stdio: 'ignore' });

  let target;
  for (let i = 0; i < 60 && !target; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      target = list.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
    } catch { /* ainda subindo */ }
    if (!target) await sleep(250);
  }
  if (!target) { proc.kill(); throw new Error('o navegador não abriu a porta de depuração'); }

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('falha ao conectar no navegador')); });
  let nextId = 1;
  const pending = new Map();
  const consoleErrors = [];
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { res, rej } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? rej(new Error(msg.error.message)) : res(msg.result);
    } else if (msg.method === 'Runtime.exceptionThrown') {
      consoleErrors.push(msg.params.exceptionDetails?.exception?.description ?? msg.params.exceptionDetails?.text);
    } else if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
      consoleErrors.push(msg.params.args?.map((a) => a.value ?? a.description).join(' '));
    }
  };
  const send = (method, params = {}) => new Promise((res, rej) => {
    const id = nextId++;
    pending.set(id, { res, rej });
    ws.send(JSON.stringify({ id, method, params }));
  });

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: mobile ? 2 : 1, mobile });
  if (mobile) await send('Emulation.setTouchEmulationEnabled', { enabled: true });

  const evaluate = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(`erro no navegador: ${r.exceptionDetails.exception?.description ?? r.exceptionDetails.text}`);
    return r.result.value;
  };

  const api = {
    consoleErrors,
    eval: evaluate,
    async goto(url) {
      await send('Page.navigate', { url });
      await sleep(300);
      await api.waitFor("document.readyState === 'complete'", 20000);
      await sleep(900); // hidratação do React
    },
    async waitFor(expression, timeout = 10000, label = expression) {
      const t = Date.now();
      while (Date.now() - t < timeout) {
        try { if (await evaluate(`Boolean(${expression})`)) return Date.now() - t; } catch { /* a página pode estar navegando */ }
        await sleep(150);
      }
      throw new Error(`tempo esgotado esperando: ${label}`);
    },
    // Preenche um campo como uma pessoa faria (dispara input/change).
    async fill(selector, value) {
      const ok = await evaluate(`(() => {
        const el = document.querySelector(${JSON.stringify(selector)});
        if (!el) return false;
        el.focus();
        const proto = el.tagName === 'SELECT' ? HTMLSelectElement.prototype : el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
        Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, ${JSON.stringify(value)});
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      })()`);
      if (!ok) throw new Error(`campo não encontrado: ${selector}`);
    },
    async click(selector) {
      const ok = await evaluate(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return false; el.click(); return true; })()`);
      if (!ok) throw new Error(`elemento não encontrado: ${selector}`);
    },
    // Clica no botão pelo texto visível.
    async clickButton(text) {
      const ok = await evaluate(`(() => { const el = [...document.querySelectorAll('button')].find((b) => b.textContent.trim().includes(${JSON.stringify(text)})); if (!el) return false; el.click(); return true; })()`);
      if (!ok) throw new Error(`botão não encontrado: ${text}`);
    },
    text: () => evaluate('document.body.innerText'),
    url: () => evaluate('location.href'),
    // true se a página tem rolagem horizontal (o que quebra o layout no celular)
    overflowsHorizontally: () => evaluate('document.documentElement.scrollWidth > document.documentElement.clientWidth + 1'),
    async screenshot(file, { fullPage = true } = {}) {
      const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: fullPage });
      writeFileSync(file, Buffer.from(r.data, 'base64'));
      return file;
    },
    async close() {
      try { ws.close(); } catch { /* já fechado */ }
      proc.kill();
      await sleep(400);
      try { rmSync(profile, { recursive: true, force: true }); } catch { /* arquivos em uso: o sistema limpa depois */ }
    },
  };
  return api;
}
