// Renders the REAL admin pages (next start) against the LOCAL Supabase, logged in as each role, and checks that every
// page answers 200 with its content and without error markers; and that role gates redirect.
// Needs: a built admin app (npm run build -w @dojo/admin) and the local stack.
// Usage: SUPABASE_URL=... SUPABASE_ANON_KEY=... node scripts/smoke-pages.mjs
import assert from 'node:assert/strict';
import { spawn, execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { createServerClient } from '@supabase/ssr';
import { localDate, localEnv, makePlatformAdmin, newUser, PASSWORD } from './lib/local.mjs';

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
makePlatformAdmin(owner.email);
assert.equal((await owner.client.rpc('grant_academy_creator', { p_email: master.email })).error, null);
const slug = `paginas-${run}`;
const academyId = (await master.client.rpc('create_academy', { p_name: 'Academia Páginas', p_slug: slug, p_idempotency_key: crypto.randomUUID() })).data;
assert.equal((await master.client.rpc('add_member', { p_academy_id: academyId, p_email: teacher.email, p_role: 'instructor' })).error, null);
for (const p of ['validate_attendance', 'recommend_graduation', 'assess_skills', 'view_progress']) {
  assert.equal((await master.client.rpc('set_instructor_permission', { p_academy_id: academyId, p_permission: p, p_granted: true })).error, null);
}
const request = await student.client.rpc('request_membership', { p_academy_id: academyId });
assert.equal((await master.client.rpc('decide_membership', { p_membership_id: request.data, p_decision: 'approved', p_reason: null, p_idempotency_key: crypto.randomUUID() })).data, 'approved');
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
  await check(null, '/login', { has: 'Entrar' });
  await check(null, '/perfil', { redirect: '/login?next=%2Fperfil' });
  await check(null, `/entrar/${slug}`, { redirect: '/login?next=' });

  // Student
  await check('student', '/perfil', { has: ['Meu perfil', 'Minhas academias', 'Academia Páginas'] });
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
  await check('student', '/plataforma', { redirect: '/perfil' });
  await check('student', `${A}/painel`, { redirect: '/perfil' });
  await check('student', `${A}/membros`, { redirect: '/perfil' });
  await check('student', '/academias/nova', { redirect: '/perfil' });

  // Teacher (permissions granted by the manager)
  await check('teacher', '/aulas', { has: ['Agenda de aulas', 'Turmas sob minha responsabilidade'] });
  await check('teacher', `/turmas/${classId}`, { has: ['Turma de páginas', 'Agendar aula'] });
  await check('teacher', `/turmas/${classId}/aulas/${sessionId}`, { has: ['Presenças', 'Aguardando confirmação', 'QR de check-in'] });
  await check('teacher', `${A}/avaliacoes`, { has: 'Avaliações de domínio' });
  await check('teacher', `${A}/avaliacoes/${student.id}`, { has: ['Smoke aluno', 'Tesoura'] });
  await check('teacher', `${A}/graduacao/alunos`, { has: 'Alunos e graduação atual' });
  await check('teacher', `${A}/graduacao/alunos/${student.id}`, { has: ['Smoke aluno', 'Progresso nos critérios', 'Comprometimento'] });
  await check('teacher', `${A}/painel`, { has: ['Painel de frequência', 'Frequência'] });

  // Manager
  await check('manager', '/perfil', { has: ['Meu perfil', 'Gerenciar: Academia Páginas', 'Criar academia'] });
  await check('manager', A, { has: ['Academia Páginas', 'Identidade visual', 'O que o instrutor pode fazer'] });
  await check('manager', `${A}/membros`, { has: ['Membros', 'Cadastrar aluno ou colaborador'] });
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
  await check('manager', '/tecnicas/nova', { has: 'Cadastrar técnica' });
  await check('manager', '/academias/nova', { has: 'Criar academia' });

  // Platform owner (test phase)
  await check('owner', '/plataforma', { has: ['Plataforma', 'Liberar criação de academias', 'Academia Páginas'] });
  await check('owner', '/plataforma/diarios', { has: ['Diários', 'nota de páginas'] });
  await check('owner', `${A}/painel`, { has: 'Painel de frequência' });

  console.log(`smoke-pages: OK (${results.length} páginas verificadas)`);
} finally {
  stop();
}
