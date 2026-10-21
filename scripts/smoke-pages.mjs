// Renders the REAL admin pages (next start) against the LOCAL Supabase, logged in as each role, and checks that every
// page answers 200 with its content and without error markers; and that role gates redirect.
// Needs: a built admin app (npm run build -w @dojo/admin) and the local stack.
// Usage: SUPABASE_URL=... SUPABASE_ANON_KEY=... node scripts/smoke-pages.mjs
import assert from 'node:assert/strict';
import { spawn, execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { createServerClient } from '@supabase/ssr';
import { localDate, localEnv, makePlatformAdmin, newUser, PASSWORD, saveContact } from './lib/local.mjs';

const { url, anonKey } = localEnv();
const run = Date.now();
const PORT = Number(process.env.SMOKE_PAGES_PORT ?? 3199);
const BASE = `http://127.0.0.1:${PORT}`;
const ROOT = process.cwd();
const ADMIN_DIR = path.join(ROOT, 'apps', 'admin');
const childEnv = { ...process.env, NEXT_PUBLIC_SUPABASE_URL: url, NEXT_PUBLIC_SUPABASE_ANON_KEY: anonKey };

if (!existsSync(path.join(ADMIN_DIR, '.next', 'BUILD_ID'))) {
  console.log('build do painel não encontrado; compilando…');
  execSync('npm run build -w @dojo/admin', { cwd: ROOT, stdio: 'inherit', env: childEnv });
}

// ---- scenario (all through the real operations) -------------------------------------------------------------------
const owner = await newUser('dono', run);
const master = await newUser('mestre', run);
const teacher = await newUser('professor', run);
const student = await newUser('aluno', run);
const guardian = await newUser('responsavel', run);
makePlatformAdmin(owner.email);
assert.equal((await owner.client.rpc('grant_academy_creator', { p_email: master.email })).error, null);
const slug = `paginas-${run}`;
const academyId = (await master.client.rpc('create_academy', { p_name: 'Academia Páginas', p_slug: slug, p_idempotency_key: crypto.randomUUID() })).data;
assert.equal((await master.client.rpc('set_academy_legal', { p_academy_id: academyId, p_legal_name: 'Academia Páginas Ltda (teste)', p_cnpj: '11.222.333/0001-81' })).error, null);
assert.equal((await master.client.rpc('add_member', { p_academy_id: academyId, p_email: teacher.email, p_role: 'instructor' })).error, null);
for (const p of ['validate_attendance', 'recommend_graduation', 'assess_skills', 'view_progress']) {
  assert.equal((await master.client.rpc('set_instructor_permission', { p_academy_id: academyId, p_permission: p, p_granted: true })).error, null);
}
const request = await student.client.rpc('request_membership', { p_academy_id: academyId });
assert.equal((await master.client.rpc('decide_membership', { p_membership_id: request.data, p_decision: 'approved', p_reason: null, p_idempotency_key: crypto.randomUUID() })).data, 'approved');
// Health notes of the student (consent given): the teacher and the manager must see them
assert.equal((await saveContact(student.client, student.id, 'Smoke aluno', 'asma leve (dado de teste)')).error, null);
// Finance: a plan, the month's charge and a one-off charge for the student
assert.equal((await master.client.rpc('set_member_plan', { p_academy_id: academyId, p_user_id: student.id, p_amount_cents: 15000, p_due_day: 10, p_starts_on: localDate(30), p_active: true, p_discount_cents: 0, p_discount_note: null })).error, null);
assert.equal((await master.client.rpc('generate_monthly_charges', { p_academy_id: academyId, p_month: `${localDate(0).slice(0, 7)}-01`, p_idempotency_key: crypto.randomUUID() })).data, 1);
assert.equal((await master.client.rpc('create_charge', { p_academy_id: academyId, p_user_id: student.id, p_description: 'Taxa de exame de páginas', p_amount_cents: 5000, p_due_date: localDate(0), p_idempotency_key: crypto.randomUUID() })).error, null);
const tesoura = (await student.client.rpc('search_techniques', { p_query: 'tesoura', p_limit: 1 })).data[0].id;
const curriculumId = (await master.client.rpc('create_curriculum', { p_academy_id: academyId, p_title: 'Trilha de páginas', p_level: 'Básico', p_idempotency_key: crypto.randomUUID() })).data;
await master.client.rpc('add_curriculum_item', { p_curriculum_id: curriculumId, p_technique_id: tesoura, p_required: true });
const ruleId = (await master.client.rpc('create_promotion_rule', {
  p_academy_id: academyId, p_belt_code: 'Faixa Teste A', p_degree: 0, p_title: null, p_effective_from: localDate(60),
  p_criteria: [{ kind: 'min_days', label: 'Tempo (teste)', min_days: 3 }, { kind: 'manual', label: 'Comprometimento' }], p_idempotency_key: crypto.randomUUID(),
})).data;
await master.client.rpc('register_initial_rank', { p_academy_id: academyId, p_user_id: student.id, p_belt_code: 'Faixa Teste A', p_degree: 0, p_effective_date: localDate(10), p_reason: null, p_idempotency_key: crypto.randomUUID() });
const classId = (await master.client.rpc('create_class', { p_academy_id: academyId, p_title: 'Turma de páginas', p_instructor_user_id: teacher.id, p_idempotency_key: crypto.randomUUID() })).data;
const now = Date.now();
const local = (ms) => {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
};
const a = local(now - 5 * 60_000), b = local(now + 40 * 60_000);
const [d0, t0, t1] = a.date === b.date ? [a.date, a.time, b.time] : [local(now - 90 * 60_000).date, local(now - 90 * 60_000).time, local(now - 50 * 60_000).time];
const sessionId = (await teacher.client.rpc('create_session', { p_class_id: classId, p_date: d0, p_start: t0, p_end: t1, p_idempotency_key: crypto.randomUUID() })).data;
assert(sessionId, 'sessão criada');
await student.client.rpc('request_check_in', { p_session_id: sessionId });
const logId = (await student.client.rpc('save_training_log', { p_academy_id: academyId, p_trained_at: new Date().toISOString(), p_notes: 'nota de páginas', p_technique_ids: [tesoura], p_client_key: crypto.randomUUID() })).data;
assert(logId, 'registro do diário criado');
// A challenge that is already active (3 participants) with one entry
const challengeId = (await student.client.rpc('create_challenge', {
  p_academy_id: academyId, p_title: 'Desafio de páginas', p_description: null, p_metric: 'training', p_points_per_unit: 5, p_technique_id: null,
  p_max_units_per_day: null, p_starts_on: localDate(0), p_ends_on: localDate(-7), p_min_participants: 3, p_join: true, p_idempotency_key: crypto.randomUUID(),
})).data;
assert(challengeId, 'desafio criado');
await teacher.client.rpc('join_challenge', { p_challenge_id: challengeId });
await master.client.rpc('join_challenge', { p_challenge_id: challengeId });
await student.client.rpc('add_challenge_entry', { p_challenge_id: challengeId, p_local_date: localDate(0), p_local_time: '00:01', p_units: null, p_note: 'treino de páginas', p_client_key: crypto.randomUUID() });

// A guardian with a dependent whose consent is still waiting for the manager to check the document
const minorId = (await guardian.client.rpc('create_dependent', { p_display_name: 'Menor de páginas', p_birth_date: localDate(365 * 9), p_relationship: 'mãe', p_idempotency_key: crypto.randomUUID() })).data;
assert(minorId, 'dependente criado');
assert.equal((await saveContact(guardian.client, minorId, 'Menor de Páginas da Silva')).error, null, 'ficha do dependente');
assert((await guardian.client.rpc('request_dependent_membership', { p_minor_id: minorId, p_academy_id: academyId, p_photos: false })).data, 'vaga do dependente pedida');

// ---- sessions as the Next app expects them (cookies written by @supabase/ssr) ---------------------------------------
async function cookieHeader(email) {
  const jar = new Map();
  const client = createServerClient(url, anonKey, {
    cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: (list) => list.forEach(({ name, value }) => jar.set(name, value)) },
  });
  const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  assert.equal(error, null, `sessão de ${email}`);
  return [...jar].map(([n, v]) => `${n}=${v}`).join('; ');
}
const cookies = {
  student: await cookieHeader(student.email),
  teacher: await cookieHeader(teacher.email),
  manager: await cookieHeader(master.email),
  owner: await cookieHeader(owner.email),
  guardian: await cookieHeader(guardian.email),
};

// ---- start the real app ---------------------------------------------------------------------------------------------
const nextBin = path.join(ROOT, 'node_modules', 'next', 'dist', 'bin', 'next');
const server = spawn(process.execPath, [nextBin, 'start', '-p', String(PORT)], { cwd: ADMIN_DIR, env: childEnv, stdio: ['ignore', 'pipe', 'pipe'] });
let serverLog = '';
server.stdout.on('data', (d) => (serverLog += d));
server.stderr.on('data', (d) => (serverLog += d));
const stop = () => { try { server.kill(); } catch { /* already gone */ } };
process.on('exit', stop);
process.on('SIGINT', () => { stop(); process.exit(130); });

const BAD = ['Application error', 'Internal Server Error', 'Não foi possível', 'Unhandled Runtime Error'];
const results = [];
const A = `/academia/${academyId}`;

try {
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch(`${BASE}/login`)).status === 200) break; } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 500));
    assert(i < 59, `o painel não subiu:\n${serverLog.slice(-1500)}`);
  }

  const check = async (role, route, expect) => {
    const res = await fetch(`${BASE}${route}`, { headers: cookies[role] ? { cookie: cookies[role] } : {}, redirect: 'manual' });
    const label = `${(role ?? 'anônimo').padEnd(8)} ${route}`;
    if (expect.redirect) {
      const loc = res.headers.get('location') ?? '';
      assert([301, 302, 303, 307, 308].includes(res.status) && loc.includes(expect.redirect), `${label}: esperava redirecionar para ${expect.redirect}, veio ${res.status} ${loc}`);
    } else {
      // React separates adjacent text nodes with <!-- -->; drop them so plain phrases match.
      const body = (await res.text()).replaceAll('<!-- -->', '');
      assert.equal(res.status, 200, `${label}: status ${res.status}\n${serverLog.slice(-800)}`);
      for (const text of [].concat(expect.has)) assert(body.includes(text), `${label}: não contém "${text}"`);
      for (const bad of BAD) assert(!body.includes(bad), `${label}: contém marca de erro "${bad}"`);
    }
    results.push(label);
  };

  // Not signed in
  await check(null, '/', { has: 'Painel' });
  await check(null, '/login', { has: ['Entrar', 'cuidar de um menor de idade', 'Li e aceito os'] });
  await check(null, `/termos/${slug}`, { has: ['Academia Páginas Ltda (teste)', '11.222.333/0001-81', 'Termos de uso'] });
  await check(null, '/termos', { has: ['Termos de uso', 'Política de privacidade', 'Rascunho em revisão jurídica', 'Crianças e adolescentes'] });
  await check(null, '/dependentes', { redirect: '/login?next=%2Fdependentes' });
  await check(null, '/perfil', { redirect: '/login?next=%2Fperfil' });
  await check(null, `/entrar/${slug}`, { redirect: '/login?next=' });

  // Student
  await check('student', '/perfil', { has: ['Meu perfil', 'Minhas academias', 'Academia Páginas', 'Minha ficha de cadastro', 'Li e aceito'] });
  await check('student', '/perfil/ficha', { has: ['Minha ficha de cadastro', 'Nome completo', 'Rua Ficticia', '(11) 99999-0000', '01001-000', 'Salvar ficha', 'Contato de emergência', 'Saúde (opcional)'] });
  await check('student', '/diario', { has: ['Meu diário', 'Tesoura'] });
  await check('student', '/diario/novo', { has: 'Registrar treino' });
  await check('student', `/diario/${logId}`, { has: ['Treino de', 'Excluir este registro'] });
  await check('student', '/tecnicas', { has: 'Catálogo de técnicas' });
  await check('student', '/tecnicas?q=tesoura', { has: 'Tesoura' });
  await check('student', `/tecnicas/${tesoura}`, { has: ['Tesoura', 'Raspagem'] });
  await check('student', '/aulas', { has: ['Agenda de aulas', 'Turma de páginas'] });
  await check('student', `/checkin/${sessionId}`, { has: ['Check-in', 'Turma de páginas'] });
  await check('student', '/trilha', { has: ['Minha trilha', 'Tesoura'] });
  await check('student', '/graduacao', { has: ['Minha graduação', 'Faixa Teste A', 'Histórico de graduações'] });
  await check('student', `/entrar/${slug}`, { has: 'Academia Páginas' });
  await check('student', '/desafios', { has: ['Desafios', 'Desafio de páginas', 'Em andamento'] });
  await check('student', '/desafios/novo', { has: ['Criar desafio', 'Mínimo de participantes'] });
  await check('student', `/desafios/${challengeId}`, { has: ['Desafio de páginas', 'Ranking', 'Registrar treino', 'Meus registros', 'Smoke aluno'] });
  await check('student', '/financeiro', { has: ['Meu financeiro', 'Minhas cobranças', 'Academia Páginas', 'Mensalidade', 'Taxa de exame de páginas', 'R$'] });
  await check('student', `${A}/financeiro`, { redirect: '/perfil' });
  await check('student', '/plataforma', { redirect: '/perfil' });
  await check('student', `${A}/painel`, { redirect: '/perfil' });
  await check('student', `${A}/membros`, { redirect: '/perfil' });
  await check('student', '/academias/nova', { redirect: '/perfil' });

  // Guardian (adult account that answers for the minor)
  await check('guardian', '/dependentes', { has: ['Meus dependentes', 'Menor de páginas', 'Responsável legal', 'Sou o responsável financeiro'] });
  await check('guardian', '/financeiro', { has: ['Meu financeiro', 'Menor de páginas'] });
  await check('guardian', '/dependentes/novo', { has: ['Cadastrar um menor', 'Seu parentesco'] });
  await check('guardian', `/dependentes/${minorId}/ficha`, { has: ['Ficha de Menor de páginas', 'Menor de Páginas da Silva', 'Salvar ficha'] });
  await check('guardian', `/dependentes/${minorId}`, { has: ['Menor de páginas', 'Academia Páginas', 'Aguardando o gestor conferir', 'Revogar consentimento', 'Responsável financeiro'] });
  await check('guardian', `/entrar/${slug}`, { has: ['Pedir vaga para um menor', 'Menor de páginas', 'termo de consentimento'] });
  await check('guardian', '/perfil', { has: ['Meus dependentes (menores de idade)'] });
  await check('guardian', `${A}/responsaveis`, { redirect: '/perfil' });

  // Teacher (permissions granted by the manager)
  await check('teacher', '/aulas', { has: ['Agenda de aulas', 'Turmas sob minha responsabilidade'] });
  await check('teacher', `/turmas/${classId}`, { has: ['Turma de páginas', 'Agendar aula'] });
  await check('teacher', `/turmas/${classId}/aulas/${sessionId}`, { has: ['Presenças', 'Aguardando confirmação', 'QR de check-in'] });
  await check('teacher', `${A}/avaliacoes`, { has: 'Avaliações de domínio' });
  await check('teacher', `${A}/avaliacoes/${student.id}`, { has: ['Smoke aluno', 'Tesoura'] });
  await check('teacher', `${A}/graduacao/alunos`, { has: 'Alunos e graduação atual' });
  await check('teacher', `${A}/graduacao/alunos/${student.id}`, { has: ['Smoke aluno', 'Progresso nos critérios', 'Comprometimento'] });
  await check('teacher', `${A}/painel`, { has: ['Painel de frequência', 'Frequência'] });

  await check('teacher', `${A}/financeiro`, { redirect: '/perfil' });
  await check('teacher', `/turmas/${classId}/aulas/${sessionId}`, { has: ['Atenção à saúde', 'asma leve (dado de teste)', 'Emergência: Contato de Emergencia'] });
  await check('teacher', `${A}/saude`, { redirect: '/perfil' });

  // Manager
  await check('manager', '/perfil', { has: ['Meu perfil', 'Gerenciar: Academia Páginas', 'Criar academia'] });
  await check('manager', A, { has: ['Academia Páginas', 'Identidade visual', 'O que o instrutor pode fazer', 'Dados da empresa', 'Academia Páginas Ltda (teste)', '11.222.333/0001-81', 'Ver observações de saúde e contato de emergência dos alunos', 'Saúde dos alunos'] });
  await check('manager', `${A}/membros`, { has: ['Membros', 'Cadastrar aluno ou colaborador'] });
  await check('manager', `${A}/membros`, { has: ['Menor de páginas', 'menor · falta conferir o responsável', 'Ficha'] });
  await check('manager', `${A}/membros/${student.id}`, { has: ['Ficha de Smoke aluno', 'Rua Ficticia', '(11) 99999-0000', 'registrada na auditoria', 'Contato de emergência', 'Contato de Emergencia', 'Observações de saúde'] });
  await check('manager', `${A}/responsaveis`, { has: ['Menores e responsáveis', 'Aguardando conferência', 'Menor de páginas', 'Smoke responsavel', 'Confirmar conferência'] });
  await check('manager', `${A}/financeiro`, { has: ['Financeiro —', 'Resumo do mês', 'Gerar as mensalidades do mês', 'Smoke aluno', 'Marcar como pago', 'Controle manual', 'Geração automática', 'Ligar a geração automática'] });
  await check('manager', `${A}/financeiro/planos`, { has: ['Planos dos alunos', 'Smoke aluno', 'Salvar plano', 'hoje:', 'Desconto (R$, opcional)', 'Motivo do desconto'] });
  await check('manager', `${A}/saude`, { has: ['Saúde e contato de emergência', 'Smoke aluno', 'asma leve (dado de teste)', 'Contato de Emergencia'] });
  await check('manager', `${A}/financeiro/alunos/${student.id}`, { has: ['Financeiro de Smoke aluno', 'Nova cobrança avulsa', 'Histórico de alterações', 'Taxa de exame de páginas'] });
  await check('manager', `${A}/turmas`, { has: ['Turmas', 'Turma de páginas', 'Nova turma'] });
  await check('manager', `/turmas/${classId}`, { has: ['Turma de páginas', 'Editar turma'] });
  await check('manager', `/turmas/${classId}/aulas/${sessionId}`, { has: ['Presenças', 'Smoke aluno'] });
  await check('manager', `${A}/curriculos`, { has: ['Currículos', 'Trilha de páginas'] });
  await check('manager', `${A}/curriculos/${curriculumId}`, { has: ['Trilha de páginas', 'Tesoura', 'Adicionar técnicas'] });
  await check('manager', `${A}/avaliacoes`, { has: ['Avaliações de domínio', 'Smoke aluno'] });
  await check('manager', `${A}/graduacao`, { has: ['Graduação', 'Faixa Teste A', 'recomendação'] });
  await check('manager', `${A}/graduacao/nova`, { has: ['Cadastrar regra', 'Critérios'] });
  await check('manager', `${A}/graduacao/nova?de=${ruleId}`, { has: ['Nova versão da regra', 'Faixa Teste A'] });
  await check('manager', `${A}/graduacao/alunos`, { has: ['Alunos e graduação atual', 'Smoke aluno'] });
  await check('manager', `${A}/graduacao/alunos/${student.id}`, { has: ['Conceder graduação', 'Retificar o último registro', 'Histórico de graduações'] });
  await check('manager', `${A}/painel`, { has: ['Painel de frequência', 'Ativação', 'Retenção semanal'] });
  await check('manager', `${A}/painel?dias=7`, { has: ['Painel de frequência', '7 dias'] });
  await check('manager', `/desafios/${challengeId}`, { has: ['Desafio de páginas', 'Ranking', 'Moderação'] });
  await check('manager', '/desafios', { has: ['Desafios', 'Desafio de páginas'] });
  await check('manager', '/tecnicas/nova', { has: 'Cadastrar técnica' });
  await check('manager', '/academias/nova', { has: ['Criar academia', 'Razão social', 'CNPJ'] });

  // Platform owner (test phase)
  await check('owner', '/plataforma', { has: ['Plataforma', 'Liberar criação de academias', 'Academia Páginas'] });
  await check('owner', '/plataforma/diarios', { has: ['Diários', 'nota de páginas'] });
  await check('owner', `${A}/painel`, { has: 'Painel de frequência' });

  console.log(`smoke-pages: OK (${results.length} páginas verificadas)`);
} finally {
  stop();
}
