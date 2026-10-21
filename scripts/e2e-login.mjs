// Tela de login/cadastro em Chrome REAL, contra o painel em execução e o Supabase LOCAL: tamanhos 360, 390, 768 e 1280 px (sem rolagem
// horizontal, prints), abas por clique e teclado, erro de senha diferente, cadastro de verdade, confirmação pelo Mailpit e entrada.
// A conta criada é apagada do banco local no fim. Uso: [ADMIN_URL=http://localhost:3000] [SHOTS_DIR=...] node scripts/e2e-login.mjs
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { openBrowser } from './lib/browser.mjs';

const BASE = process.env.ADMIN_URL ?? 'http://localhost:3000';
const MAILPIT = process.env.MAILPIT_URL ?? 'http://127.0.0.1:54324';
const SHOTS = process.env.SHOTS_DIR ?? path.join(process.cwd(), 'tmp-shots');
const PASSWORD = 'senha-sintetica-123';
const email = `ui-login-${Date.now()}@example.test`;
mkdirSync(SHOTS, { recursive: true });
const findings = [];
const note = (where, what) => { findings.push(`${where}: ${what}`); console.log(`  ! ${where}: ${what}`); };

const sizes = [
  { name: '360', mobile: true, width: 360, height: 740 },
  { name: '390', mobile: true, width: 390, height: 844 },
  { name: '768', mobile: false, width: 768, height: 1024 },
  { name: '1280', mobile: false, width: 1280, height: 800 },
];

try {
  // 1. Layout em cada tamanho
  for (const size of sizes) {
    const b = await openBrowser({ mobile: size.mobile, width: size.width, height: size.height, port: 9340 });
    try {
      await b.goto(`${BASE}/login`);
      if (await b.overflowsHorizontally()) note(size.name, 'rolagem horizontal');
      const tabs = await b.eval(`document.querySelectorAll('[role=tab]').length`);
      if (tabs !== 2) note(size.name, `esperava 2 abas, achou ${tabs}`);
      const visibleForms = await b.eval(`[...document.querySelectorAll('form')].filter((f) => f.offsetParent !== null).length`);
      if (visibleForms !== 1) note(size.name, `esperava 1 formulário visível (login e cadastro não empilhados), achou ${visibleForms}`);
      const brandVisible = await b.eval(`getComputedStyle(document.querySelector('aside')).display !== 'none'`);
      if ((size.width >= 960) !== brandVisible) note(size.name, `painel da marca ${brandVisible ? 'visível' : 'oculto'} no tamanho errado`);
      await b.screenshot(path.join(SHOTS, `login-${size.name}-entrar.png`));
      await b.clickButton('Criar conta');
      await b.waitFor("document.querySelector('[role=tab][aria-selected=true]').textContent.includes('Criar conta')");
      if (await b.overflowsHorizontally()) note(size.name, 'rolagem horizontal na aba de cadastro');
      await b.screenshot(path.join(SHOTS, `login-${size.name}-criar.png`));
      for (const e of b.consoleErrors) note(size.name, `erro no console: ${String(e).slice(0, 140)}`);
    } finally { await b.close(); }
  }

  // 2. Fluxo completo em 390 px
  const b = await openBrowser({ mobile: true, width: 390, height: 844, port: 9341 });
  try {
    await b.goto(`${BASE}/login`);
    // teclado: seta para a direita troca de aba; seta para a esquerda volta
    await b.eval(`document.querySelector('[role=tab][aria-selected=true]').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))`);
    await b.waitFor("document.querySelector('[role=tab][aria-selected=true]').textContent.includes('Criar conta')", 3000, 'seta direita');
    await b.eval(`document.querySelector('[role=tab][aria-selected=true]').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }))`);
    await b.waitFor("document.querySelector('[role=tab][aria-selected=true]').textContent.includes('Entrar')", 3000, 'seta esquerda');

    // login com senha errada: erro claro
    await b.fill('form[aria-label=Entrar] input[name=email]', 'ninguem@example.test');
    await b.fill('form[aria-label=Entrar] input[name=password]', 'senha-errada-123');
    await b.click('form[aria-label=Entrar] button[type=submit]');
    await b.waitFor("document.querySelector('[role=alert]')", 8000, 'erro de login');
    await b.screenshot(path.join(SHOTS, 'login-390-erro.png'));

    // mostrar/ocultar a senha
    await b.eval(`document.querySelector('form[aria-label=Entrar] button[aria-pressed]').click()`);
    assert.equal(await b.eval(`document.querySelector('form[aria-label=Entrar] input[name=password]').type`), 'text', 'senha visível');
    await b.eval(`document.querySelector('form[aria-label=Entrar] button[aria-pressed]').click()`);
    assert.equal(await b.eval(`document.querySelector('form[aria-label=Entrar] input[name=password]').type`), 'password', 'senha oculta de novo');

    // cadastro: senhas diferentes
    await b.clickButton('Criar conta');
    const f = (name) => `form[aria-label="Criar conta"] [name=${name}]`;
    await b.fill(f('displayName'), 'Teste de Interface');
    await b.fill(f('birthDate'), '1990-01-01');
    await b.fill(f('email'), email);
    await b.fill(f('password'), PASSWORD);
    await b.fill(f('confirmPassword'), 'outra-senha-123');
    await b.eval(`document.querySelector('${f('acceptTerms')}').click()`);
    await b.eval(`[...document.querySelectorAll('form[aria-label="Criar conta"] button[type=submit]')][0].click()`);
    await b.waitFor("[...document.querySelectorAll('[role=alert]')].some((a) => a.offsetParent !== null && a.textContent.includes('As senhas não conferem'))", 5000, 'senhas diferentes');
    // o que não é senha continua preenchido depois do erro (nada de digitar tudo de novo)
    assert.equal(await b.eval(`document.querySelector('${f('email')}').value`), email, 'e-mail mantido depois do erro');
    assert.equal(await b.eval(`document.querySelector('${f('displayName')}').value`), 'Teste de Interface', 'nome mantido depois do erro');
    assert.equal(await b.eval(`document.querySelector('${f('password')}').value`), '', 'a senha volta vazia');
    // cadastro de verdade
    await b.fill(f('password'), PASSWORD);
    await b.fill(f('confirmPassword'), PASSWORD);
    await b.eval(`[...document.querySelectorAll('form[aria-label="Criar conta"] button[type=submit]')][0].click()`);
    try {
      await b.waitFor("[...document.querySelectorAll('[role=status]')].some((a) => a.offsetParent !== null && a.textContent.includes('Cadastro recebido'))", 10000, 'cadastro recebido');
    } catch (e) {
      await b.screenshot(path.join(SHOTS, 'login-390-cadastro-falhou.png'));
      throw new Error(`${e.message}; avisos visíveis: ${await b.eval(`[...document.querySelectorAll('[role=alert],[role=status]')].filter((a) => a.offsetParent !== null).map((a) => a.textContent).join(' | ')`)}`);
    }
    await b.screenshot(path.join(SHOTS, 'login-390-cadastro-ok.png'));

    // confirma o e-mail pelo Mailpit e entra
    let link;
    for (let i = 0; i < 20 && !link; i++) {
      const list = await (await fetch(`${MAILPIT}/api/v1/search?query=to:${encodeURIComponent(email)}`)).json();
      const id = list.messages?.[0]?.ID;
      if (id) {
        const msg = await (await fetch(`${MAILPIT}/api/v1/message/${id}`)).json();
        link = /https?:\/\/[^\s"'<>]*verify[^\s"'<>]*/.exec(`${msg.HTML} ${msg.Text}`)?.[0]?.replaceAll('&amp;', '&');
      }
      if (!link) await new Promise((r) => setTimeout(r, 500));
    }
    assert(link, 'e-mail de confirmação');
    await fetch(link, { redirect: 'manual' });
    await b.goto(`${BASE}/login`);
    await b.fill('form[aria-label=Entrar] input[name=email]', email);
    await b.fill('form[aria-label=Entrar] input[name=password]', PASSWORD);
    await b.click('form[aria-label=Entrar] button[type=submit]');
    await b.waitFor("!location.pathname.startsWith('/login')", 15000, 'sair da tela de login');
    const where = await b.url();
    await b.screenshot(path.join(SHOTS, 'login-390-depois-do-login.png'));
    if (!where.includes('/perfil')) note('fluxo', `entrou, mas foi para ${where}`);
    for (const e of b.consoleErrors) note('fluxo', `erro no console: ${String(e).slice(0, 140)}`);
  } finally { await b.close(); }
} catch (e) {
  note('execução', e.message);
} finally {
  try {
    execFileSync('docker', ['exec', 'supabase_db_dojo-platform-local', 'psql', '-U', 'postgres', '-d', 'postgres', '-c', `delete from auth.users where email = '${email}'`], { stdio: 'pipe' });
  } catch { console.log('  (não foi possível apagar a conta de teste; apague manualmente: ' + email + ')'); }
}

console.log(`\n${findings.length} achado(s). Prints em ${SHOTS}`);
process.exit(findings.length ? 1 : 0);
