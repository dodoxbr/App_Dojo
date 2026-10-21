// Passeio em Chrome REAL (tela de celular) pelo painel em execução (dev ou start), contra o Supabase LOCAL, com contas sintéticas.
// Para cada papel: entra pelo formulário de login, abre as telas principais e confere erros do servidor/console, rolagem horizontal
// e texto esperado; depois preenche e envia formulários de verdade (os que usam useActionState). Prints vão para SHOTS_DIR.
// Uso: SUPABASE_ANON_KEY=... [ADMIN_URL=http://localhost:3000] [SHOTS_DIR=...] [DESKTOP=1] node scripts/e2e-browser.mjs
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { localDate, localEnv, makePlatformAdmin, newUser, PASSWORD } from './lib/local.mjs';
import { openBrowser } from './lib/browser.mjs';

localEnv();
const BASE = process.env.ADMIN_URL ?? 'http://localhost:3000';
const SHOTS = process.env.SHOTS_DIR ?? path.join(process.cwd(), 'tmp-shots');
const mobile = !process.env.DESKTOP;
mkdirSync(SHOTS, { recursive: true });
const run = Date.now();

// ---- cenário (pelas operações reais) ----------------------------------------------------------------------------
const owner = await newUser('dono', run);
const master = await newUser('mestre', run);
const teacher = await newUser('professor', run);
const student = await newUser('aluno', run);
const guardian = await newUser('responsavel', run);
makePlatformAdmin(owner.email);
assert.equal((await owner.client.rpc('grant_academy_creator', { p_email: master.email })).error, null);
const slug = `navegador-${run}`;
const academyId = (await master.client.rpc('create_academy', { p_name: 'Academia Navegador', p_slug: slug, p_idempotency_key: crypto.randomUUID() })).data;
assert(academyId, 'academia criada');
assert.equal((await master.client.rpc('add_member', { p_academy_id: academyId, p_email: teacher.email, p_role: 'instructor' })).error, null);
const request = await student.client.rpc('request_membership', { p_academy_id: academyId });
assert.equal((await master.client.rpc('decide_membership', { p_membership_id: request.data, p_decision: 'approved', p_reason: null, p_idempotency_key: crypto.randomUUID() })).data, 'approved');
const minorId = (await guardian.client.rpc('create_dependent', { p_display_name: 'Menor Navegador', p_birth_date: localDate(365 * 9), p_relationship: 'mãe', p_idempotency_key: crypto.randomUUID() })).data;
assert(minorId, 'dependente criado');
const classId = (await master.client.rpc('create_class', { p_academy_id: academyId, p_title: 'Turma Navegador', p_instructor_user_id: teacher.id, p_idempotency_key: crypto.randomUUID() })).data;

const A = `/academia/${academyId}`;
const findings = [];
const note = (who, where, what) => { findings.push(`${who} ${where}: ${what}`); console.log(`  ! ${who} ${where}: ${what}`); };
let shotN = 0;

async function login(b, user) {
  await b.goto(`${BASE}/login`);
  await b.fill('form:first-of-type input[name=email]', user.email);
  await b.fill('form:first-of-type input[name=password]', PASSWORD);
  await b.click('form:first-of-type button[type=submit]');
  await b.waitFor("!location.pathname.startsWith('/login')", 20000, 'sair da tela de login');
}

async function visit(b, who, route, expectText = []) {
  const before = b.consoleErrors.length;
  await b.goto(`${BASE}${route}`);
  const text = await b.text();
  for (const t of [].concat(expectText)) if (!text.includes(t)) note(who, route, `não mostra "${t}"`);
  for (const bad of ['Application error', 'Internal Server Error', 'Unhandled Runtime Error', 'This page could not be found']) {
    if (text.includes(bad)) note(who, route, `marca de erro "${bad}"`);
  }
  if (mobile && (await b.overflowsHorizontally())) note(who, route, 'rolagem horizontal no celular (conteúdo vaza da tela)');
  for (const e of b.consoleErrors.slice(before)) note(who, route, `erro no console: ${String(e).slice(0, 160)}`);
  const small = await b.eval(`[...document.querySelectorAll('button,a,input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=file]),select')].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.height < 28 && e.tagName !== 'A'; }).length`);
  if (mobile && small) note(who, route, `${small} controle(s) com menos de 28px de altura (difícil de tocar)`);
  const file = path.join(SHOTS, `${String(++shotN).padStart(2, '0')}-${who}${route.replace(/[^a-z0-9]+/gi, '_').slice(0, 50)}.png`);
  await b.screenshot(file);
}

async function pass(who, user, routes) {
  console.log(`\n== ${who} ==`);
  const b = await openBrowser({ mobile });
  try {
    await login(b, user);
    for (const [route, expectText] of routes) await visit(b, who, route, expectText);
    return b;
  } catch (e) {
    note(who, 'passeio', e.message);
    await b.close();
    return null;
  }
}

// ---- aluno -------------------------------------------------------------------------------------------------------
let b = await pass('aluno', student, [
  ['/perfil', ['Meu perfil']], ['/perfil/ficha', ['Minha ficha de cadastro']], ['/diario', ['Meu diário']], ['/diario/novo', ['Registrar treino']],
  ['/tecnicas', ['Catálogo']], ['/aulas', ['Agenda']], ['/trilha', []], ['/graduacao', []], ['/desafios', ['Desafios']], ['/desafios/novo', ['Criar desafio']],
  ['/financeiro', ['Meu financeiro']], [`/feed/${academyId}`, ['Feed']], ['/termos', ['Termos de uso']], [`/entrar/${slug}`, ['Academia Navegador']],
]);
if (b) {
  // Ficha: preencher e salvar (useActionState com closure)
  await b.goto(`${BASE}/perfil/ficha`);
  const fields = { fullName: 'Aluno Navegador', phone: '(11) 98888-7777', postalCode: '01001-000', street: 'Rua Ficticia', number: '10', neighborhood: 'Centro', city: 'Sao Paulo', emergencyName: 'Contato', emergencyPhone: '(11) 97777-6666', emergencyRelationship: 'mae' };
  for (const [name, value] of Object.entries(fields)) { try { await b.fill(`[name=${name}]`, value); } catch { note('aluno', '/perfil/ficha', `campo ${name} não encontrado`); } }
  try { await b.fill('[name=state]', 'SP'); } catch { /* nome pode variar */ }
  await b.clickButton('Salvar ficha');
  try { await b.waitFor("document.body.innerText.includes('salv')", 8000); } catch { note('aluno', '/perfil/ficha', 'depois de salvar não apareceu confirmação'); }
  await b.screenshot(path.join(SHOTS, `${String(++shotN).padStart(2, '0')}-aluno-ficha-salva.png`));
  await b.close();
}

// ---- responsável -------------------------------------------------------------------------------------------------
b = await pass('responsavel', guardian, [
  ['/dependentes', ['Meus dependentes']], ['/dependentes/novo', ['Cadastrar um menor']], [`/dependentes/${minorId}`, ['Menor Navegador']],
  [`/dependentes/${minorId}/ficha`, ['Ficha de Menor Navegador']], [`/dependentes/${minorId}/feed`, []], ['/financeiro', []], [`/entrar/${slug}`, ['Pedir vaga para um menor']],
]);
if (b) await b.close();

// ---- professor ---------------------------------------------------------------------------------------------------
b = await pass('professor', teacher, [
  ['/aulas', ['Agenda']], [`/turmas/${classId}`, ['Turma Navegador']], [`${A}/avaliacoes`, []], [`${A}/graduacao/alunos`, []], [`${A}/painel`, []], [`/feed/${academyId}`, ['Feed']],
]);
if (b) await b.close();

// ---- gestor ------------------------------------------------------------------------------------------------------
b = await pass('gestor', master, [
  ['/perfil', ['Meu perfil']], [A, ['Academia Navegador']], [`${A}/membros`, ['Membros']], [`${A}/responsaveis`, []], [`${A}/financeiro`, ['Financeiro']],
  [`${A}/financeiro/planos`, ['Planos']], [`${A}/saude`, []], [`${A}/turmas`, ['Turmas']], [`${A}/curriculos`, []], [`${A}/graduacao`, []], [`${A}/graduacao/nova`, []],
  [`${A}/painel`, []], ['/academias/nova', ['Criar academia']], ['/tecnicas/nova', []], [`/feed/${academyId}`, ['Feed']],
]);
if (b) {
  // Dados da empresa (LegalForm) e cadastro de membro (AddMemberForm) em formulário de verdade
  await b.goto(`${BASE}${A}`);
  try {
    await b.fill('[name=legalName]', 'Academia Navegador Ltda (teste)');
    await b.fill('[name=cnpj]', '11.222.333/0001-81');
    await b.clickButton('Salvar dados da empresa');
    await b.waitFor("document.body.innerText.includes('salv') || document.body.innerText.includes('Dados da empresa salvos')", 8000);
  } catch (e) { note('gestor', `${A} (dados da empresa)`, e.message); }
  await b.screenshot(path.join(SHOTS, `${String(++shotN).padStart(2, '0')}-gestor-empresa.png`));
  await b.goto(`${BASE}${A}/membros`);
  try {
    await b.fill('[name=email]', student.email);
    await b.clickButton('Cadastrar');
    await b.waitFor("document.body.innerText.includes('já') || document.body.innerText.includes('cadastrad') || document.body.innerText.includes('adicionad')", 8000);
  } catch (e) { note('gestor', `${A}/membros (cadastrar membro)`, e.message); }
  await b.screenshot(path.join(SHOTS, `${String(++shotN).padStart(2, '0')}-gestor-membro.png`));
  await b.close();
}

// ---- dono da plataforma ------------------------------------------------------------------------------------------
b = await pass('dono', owner, [['/plataforma', ['Plataforma']], ['/plataforma/diarios', []]]);
if (b) await b.close();

console.log(`\n${findings.length} achado(s). Prints em ${SHOTS}`);
process.exit(findings.length ? 1 : 0);
