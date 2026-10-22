// App mobile (Expo) rodando na versão WEB em Chrome REAL (390x844), contra o Supabase LOCAL, com contas sintéticas.
// Passeia pelo fluxo do aluno: entrar, início, registrar treino no diário (com técnica), ver o registro, buscar técnica,
// evolução, agenda com pedido de check-in, perfil. Confere erro de login e que o app não vaza para telas de outro papel.
// Pré-requisitos: `npx expo start --web --port 8081` em apps/mobile (com .env local) e o Supabase local.
// Uso: SUPABASE_ANON_KEY=... [MOBILE_URL=http://localhost:8081] [SHOTS_DIR=...] node scripts/e2e-mobile-web.mjs
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { localDate, localEnv, makePlatformAdmin, newUser, PASSWORD } from './lib/local.mjs';
import { openBrowser } from './lib/browser.mjs';

localEnv();
const BASE = process.env.MOBILE_URL ?? 'http://localhost:8081';
const SHOTS = process.env.SHOTS_DIR ?? path.join(process.cwd(), 'tmp-shots');
mkdirSync(SHOTS, { recursive: true });
const run = Date.now();
const findings = [];
const note = (what) => { findings.push(what); console.log(`  ! ${what}`); };
let shotN = 0;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- cenário (pelas operações reais) -----------------------------------------------------------------------------
const owner = await newUser('mdono', run);
const master = await newUser('mmestre', run);
const teacher = await newUser('mprofessor', run);
const student = await newUser('maluno', run);
makePlatformAdmin(owner.email);
assert.equal((await owner.client.rpc('grant_academy_creator', { p_email: master.email })).error, null);
const academyId = (await master.client.rpc('create_academy', { p_name: 'Academia Mobile', p_slug: `mobile-${run}`, p_idempotency_key: crypto.randomUUID() })).data;
assert(academyId);
assert.equal((await master.client.rpc('add_member', { p_academy_id: academyId, p_email: teacher.email, p_role: 'instructor' })).error, null);
const req = await student.client.rpc('request_membership', { p_academy_id: academyId });
assert.equal((await master.client.rpc('decide_membership', { p_membership_id: req.data, p_decision: 'approved', p_reason: null, p_idempotency_key: crypto.randomUUID() })).data, 'approved');
await master.client.rpc('register_initial_rank', { p_academy_id: academyId, p_user_id: student.id, p_belt_code: 'Faixa Teste A', p_degree: 0, p_effective_date: localDate(30), p_reason: null, p_idempotency_key: crypto.randomUUID() });
assert.equal((await master.client.rpc('create_promotion_rule', {
  p_academy_id: academyId, p_belt_code: 'Faixa Teste A', p_degree: 0, p_title: null, p_effective_from: localDate(60),
  p_criteria: [{ kind: 'min_days', label: 'Tempo (teste)', min_days: 3 }, { kind: 'manual', label: 'Comprometimento' }], p_idempotency_key: crypto.randomUUID(),
})).error, null);
const classId = (await master.client.rpc('create_class', { p_academy_id: academyId, p_title: 'Turma Mobile', p_instructor_user_id: teacher.id, p_idempotency_key: crypto.randomUUID() })).data;
// uma aula em andamento (check-in aberto) e uma futura
const now = Date.now();
const local = (ms) => {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
};
const a = local(now - 5 * 60_000), b = local(now + 40 * 60_000);
const [d0, t0, t1] = a.date === b.date ? [a.date, a.time, b.time] : [local(now - 90 * 60_000).date, local(now - 90 * 60_000).time, local(now - 50 * 60_000).time];
const sessionId = (await teacher.client.rpc('create_session', { p_class_id: classId, p_date: d0, p_start: t0, p_end: t1, p_idempotency_key: crypto.randomUUID() })).data;
assert(sessionId, 'aula criada');

// ---- navegador ---------------------------------------------------------------------------------------------------
const br = await openBrowser({ mobile: true, width: 390, height: 844, port: 9343 });
const shot = async (name) => br.screenshot(path.join(SHOTS, `${String(++shotN).padStart(2, '0')}-${name}.png`));
const text = () => br.text();
const clickLabel = (label) => br.eval(`(() => { const el = [...document.querySelectorAll('[aria-label]')].find((e) => e.getAttribute('aria-label') === ${JSON.stringify(label)} && e.offsetParent !== null); if (!el) return false; el.click(); return true; })()`);
const clickText = (t) => br.eval(`(() => { const el = [...document.querySelectorAll('[role=button],[role=tab],a')].find((e) => e.textContent.trim() === ${JSON.stringify(t)} && e.offsetParent !== null); if (!el) return false; el.click(); return true; })()`);
const field = (label) => `input[aria-label="${label}"],textarea[aria-label="${label}"]`;
const waitText = (t, ms = 15000) => br.waitFor(`document.body.innerText.toLowerCase().includes(${JSON.stringify(t.toLowerCase())})`, ms, `texto "${t}"`);

try {
  // 1. login com senha errada, depois certo
  await br.goto(BASE);
  await waitText('Seu treino, sua evolução'); // a marca é uma imagem (sem texto)
  await br.fill(field('E-mail'), student.email);
  await br.fill(field('Senha'), 'senha-errada-123');
  assert(await clickLabel('Entrar'), 'botão Entrar');
  await waitText('E-mail ou senha inválidos');
  await shot('login-erro');
  await br.fill(field('Senha'), PASSWORD);
  assert(await clickLabel('Entrar'));
  await waitText('Oss, ');

  // 2. início
  await waitText('Meu progresso');
  const home = await text();
  for (const t of ['Academia Mobile', 'Faixa Teste A', 'Esta semana', 'Próximo treino', 'Diário recente', 'Registrar treino', 'Início', 'Diário', 'Técnicas', 'Evolução', 'Perfil']) {
    if (!home.toLowerCase().includes(t.toLowerCase())) note(`início: não mostra "${t}"`); // o nome da academia aparece em maiúsculas (estilo)
  }
  if (await br.overflowsHorizontally()) note('início: rolagem horizontal');
  await shot('inicio');

  // 3. registrar treino
  assert(await clickLabel('Registrar treino'), 'botão Registrar treino');
  await waitText('Técnicas praticadas');
  await br.fill(field('Horário de início'), '00:01'); // o horário do treino é obrigatório (migration 034)
  await br.fill(field('Anotações'), 'treino do app mobile (teste)');
  await br.fill(field('Buscar técnica'), 'tesoura');
  await br.waitFor("[...document.querySelectorAll('[aria-label]')].some((e) => e.getAttribute('aria-label').startsWith('Adicionar Tesoura'))", 10000, 'resultado da busca de técnica');
  await br.eval(`[...document.querySelectorAll('[aria-label]')].find((e) => e.getAttribute('aria-label').startsWith('Adicionar Tesoura')).click()`);
  await shot('diario-novo');
  assert(await clickLabel('Salvar no diário'));
  await waitText('treino do app mobile (teste)');
  if (!(await text()).includes('Tesoura')) note('registro: não mostra a técnica escolhida');
  await shot('diario-registro');

  // 4. diário (aba): o registro aparece; excluir pede confirmação
  await br.goto(`${BASE}/diario`);
  await waitText('Meu diário');
  await waitText('treino do app mobile (teste)');
  await shot('diario-lista');

  // 5. técnicas
  await br.goto(`${BASE}/tecnicas`);
  await waitText('Buscar');
  await br.fill(field('Buscar'), 'armlock');
  await waitText('Armlock');
  await shot('tecnicas');
  await br.eval(`[...document.querySelectorAll('[role=button]')].find((e) => e.textContent.includes('Armlock')).click()`);
  await waitText('← Voltar');
  await shot('tecnica-detalhe');

  // 6. evolução
  await br.goto(`${BASE}/evolucao`);
  await waitText('Minha evolução');
  await waitText('Tempo (teste)');
  const evo = await text();
  for (const t of ['Faixa Teste A', 'Isto é uma recomendação', 'Histórico de graduações']) if (!evo.includes(t)) note(`evolução: não mostra "${t}"`);
  await shot('evolucao');

  // 7. agenda e check-in (a aula está em andamento)
  await br.goto(`${BASE}/aulas`);
  await waitText('Agenda de aulas');
  await waitText('Turma Mobile');
  assert(await clickLabel('Fazer check-in'), 'botão Fazer check-in');
  await br.waitFor("document.body.innerText.includes('Aguardando confirmação') || document.body.innerText.includes('pedido enviado')", 15000, 'check-in pedido');
  await shot('aulas-checkin');
  const { data: att } = await student.client.from('attendances').select('status').eq('session_id', sessionId).eq('user_id', student.id).single();
  if (att?.status !== 'pending') note(`o check-in deveria ficar PENDENTE (só o professor valida), ficou ${att?.status}`);

  // 8. perfil e sair
  await br.goto(`${BASE}/perfil`);
  await waitText('Meu perfil');
  const prof = await text();
  for (const t of ['Academia Mobile', 'Aluno', 'Aprovado', 'No painel web']) if (!prof.includes(t)) note(`perfil: não mostra "${t}"`);
  await shot('perfil');
  assert(await clickLabel('Sair'));
  await waitText('Criar conta');
  if (!(await br.url()).includes('login')) note('depois de sair, não voltou ao login');

  // 9. criar conta: abas, senha diferente e termos
  assert(await clickText('Criar conta'));
  await waitText('Confirmar a senha');
  await br.fill(field('Nome'), 'Teste Mobile');
  await br.fill(field('Data de nascimento'), '1990-01-01');
  await br.fill(field('E-mail'), `mcadastro-${run}@example.test`);
  await br.fill(field('Senha'), PASSWORD);
  await br.fill(field('Confirmar a senha'), 'outra-senha-123');
  await br.eval(`[...document.querySelectorAll('[aria-label]')].filter((e) => e.getAttribute('aria-label') === 'Criar conta' && e.getAttribute('role') === 'button').pop().click()`);
  await waitText('As senhas não conferem');
  await shot('cadastro-erro');
  for (const e of br.consoleErrors) if (!/favicon|Failed to load resource/.test(String(e))) note(`erro no console: ${String(e).slice(0, 160)}`);
} catch (e) {
  note(`execução: ${e.message}; tela: ${(await text().catch(() => '')).slice(0, 300).replace(/\n/g, ' | ')}`);
  await shot('falha').catch(() => {});
} finally {
  await br.close();
}

console.log(`\n${findings.length} achado(s). Prints em ${SHOTS}`);
process.exit(findings.length ? 1 : 0);
