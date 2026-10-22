// Recuperação de senha em Chrome REAL, contra o painel em execução e o Supabase LOCAL (e-mails no Mailpit):
// "Esqueci minha senha" → e-mail → link → nova senha (com erro de senhas diferentes) → entrar com a senha nova.
// Confere também: e-mail inexistente recebe a MESMA resposta, a senha antiga deixa de valer e o link não vale duas vezes.
// A conta de teste é sintética e é apagada no fim. Uso: SUPABASE_ANON_KEY=... [ADMIN_URL=http://localhost:3000] node scripts/e2e-reset-password.mjs
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
import { localEnv } from './lib/local.mjs';
import { openBrowser } from './lib/browser.mjs';

const { url, anonKey, mailpit } = localEnv();
const BASE = process.env.ADMIN_URL ?? 'http://localhost:3000';
const OLD = 'senha-antiga-123';
const NEW = 'senha-nova-456';
const email = `reset-${Date.now()}@example.test`;
const findings = [];
const note = (what) => { findings.push(what); console.log(`  ! ${what}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function link(kind) {
  for (let i = 0; i < 30; i++) {
    const list = await (await fetch(`${mailpit}/api/v1/search?query=to:${encodeURIComponent(email)}`)).json();
    for (const m of list.messages ?? []) {
      const msg = await (await fetch(`${mailpit}/api/v1/message/${m.ID}`)).json();
      const found = new RegExp(`https?://[^\\s"'<>]*verify[^\\s"'<>]*type=${kind}[^\\s"'<>]*`).exec(`${msg.HTML} ${msg.Text}`)?.[0];
      if (found) return found.replaceAll('&amp;', '&');
    }
    await sleep(500);
  }
  throw new Error(`e-mail de ${kind} não chegou`);
}

// Conta de teste: cadastro pela API e confirmação pelo e-mail (sem ficha, para poder apagar a conta no fim)
const client = createClient(url, anonKey, { auth: { persistSession: false } });
assert.equal((await client.auth.signUp({ email, password: OLD, options: { data: { display_name: 'Teste Redefinir', birth_date: '1990-01-01' } } })).error, null);
await fetch(await link('signup'), { redirect: 'manual' });
assert.equal((await client.auth.signInWithPassword({ email, password: OLD })).error, null, 'a conta de teste entra com a senha antiga');

const b = await openBrowser({ mobile: true, width: 390, height: 844, port: 9342 });
try {
  const text = async () => b.text();
  const submit = (form) => b.eval(`document.querySelector('form[aria-label="${form}"] button[type=submit]').click()`);

  // 1. do login até o pedido
  await b.goto(`${BASE}/login`);
  await b.eval(`[...document.querySelectorAll('a')].find((a) => a.textContent.includes('Esqueci minha senha')).click()`);
  await b.waitFor("location.pathname === '/recuperar-senha'", 8000, 'tela de recuperar senha');

  // 2. e-mail inexistente: mesma resposta (não revela quem tem conta)
  await b.fill('input[name=email]', `ninguem-${Date.now()}@example.test`);
  await submit('Recuperar senha');
  await b.waitFor("[...document.querySelectorAll('[role=status]')].some((a) => a.textContent.includes('Se este e-mail tiver cadastro'))", 10000, 'resposta para e-mail inexistente');

  // 3. e-mail real
  await b.goto(`${BASE}/recuperar-senha`);
  await b.fill('input[name=email]', email);
  await submit('Recuperar senha');
  await b.waitFor("[...document.querySelectorAll('[role=status]')].some((a) => a.textContent.includes('Se este e-mail tiver cadastro'))", 10000, 'resposta para e-mail real');
  const resetLink = await link('recovery');

  // 4. o link abre a tela da nova senha
  await b.goto(resetLink);
  await b.waitFor("location.pathname === '/redefinir-senha'", 15000, 'tela de redefinir senha (link do e-mail)');
  if (!(await text()).includes('Escolha uma nova senha')) note('a tela da nova senha não mostrou o título');

  // 5. senhas diferentes: erro e nada muda
  await b.fill('input[name=password]', NEW);
  await b.fill('input[name=confirmPassword]', 'outra-senha-789');
  await submit('Nova senha');
  await b.waitFor("[...document.querySelectorAll('[role=alert]')].some((a) => a.textContent.includes('As senhas não conferem'))", 8000, 'erro de senhas diferentes');
  assert.notEqual((await client.auth.signInWithPassword({ email, password: NEW })).error, null, 'a senha nova ainda não vale');

  await sleep(500);
  // 6. senha curta: erro
  await b.fill('input[name=password]', '123');
  await b.fill('input[name=confirmPassword]', '123');
  await b.eval(`document.querySelector('form[aria-label="Nova senha"]').noValidate = true`);
  await submit('Nova senha');
  await b.waitFor("[...document.querySelectorAll('[role=alert]')].some((a) => a.textContent.includes('de 8 a 72 caracteres'))", 8000, 'erro de senha curta em português');

  await sleep(500); // o React limpa o formulário depois do envio
  // 7. senhas iguais: salva, vai para o login com aviso
  await b.fill('input[name=password]', NEW);
  await b.fill('input[name=confirmPassword]', NEW);
  await submit('Nova senha');
  try {
    await b.waitFor("location.pathname === '/login' && location.search.includes('senha=ok')", 15000, 'voltar ao login depois de salvar');
  } catch (e) {
    throw new Error(`${e.message}; em ${await b.url()}; avisos: ${await b.eval(`[...document.querySelectorAll('[role=alert],[role=status]')].map((a) => a.textContent).join(' | ')`)}`);
  }
  if (!(await text()).includes('Senha alterada')) note('o login não avisou "Senha alterada"');

  // 8. a senha antiga deixou de valer e a nova vale; entra pela tela
  assert.notEqual((await client.auth.signInWithPassword({ email, password: OLD })).error, null, 'a senha antiga não vale mais');
  await b.fill('form[aria-label=Entrar] input[name=email]', email);
  await b.fill('form[aria-label=Entrar] input[name=password]', NEW);
  await b.click('form[aria-label=Entrar] button[type=submit]');
  await b.waitFor("location.pathname.startsWith('/inicio')", 15000, 'entrar com a senha nova');

  // 9. o mesmo link não vale duas vezes
  await b.eval(`fetch('/perfil')`);
  await b.goto(resetLink);
  await b.waitFor("location.pathname === '/recuperar-senha' || location.pathname === '/redefinir-senha' || location.pathname === '/inicio'", 15000, 'segundo uso do link');
  const where = await b.url();
  if (where.includes('/redefinir-senha')) note('o link do e-mail abriu a tela da nova senha uma segunda vez');
  for (const e of b.consoleErrors) note(`erro no console: ${String(e).slice(0, 140)}`);
} catch (e) {
  note(`execução: ${e.message}`);
} finally {
  await b.close();
  try {
    execFileSync('docker', ['exec', 'supabase_db_dojo-platform-local', 'psql', '-U', 'postgres', '-d', 'postgres', '-c', `delete from auth.users where email = '${email}'`], { stdio: 'pipe' });
  } catch { console.log(`  (não foi possível apagar a conta de teste: ${email})`); }
}

console.log(`\n${findings.length} achado(s).`);
process.exit(findings.length ? 1 : 0);
