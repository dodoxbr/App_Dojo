// Smoke test of US-010 against the LOCAL Supabase: academy-defined promotion rules and progress evaluation.
// All belt names and numbers are FICTITIOUS test data. Eligibility is a recommendation: nobody gets promoted here.
// Usage: SUPABASE_URL=... SUPABASE_ANON_KEY=... node scripts/smoke-graduation.mjs
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321';
const anonKey = process.env.SUPABASE_ANON_KEY;
const mailpit = process.env.MAILPIT_URL ?? 'http://127.0.0.1:54324';
assert(anonKey, 'Defina SUPABASE_ANON_KEY (npx supabase status).');
assert(/^https?:\/\/(127\.0\.0\.1|localhost)/.test(url), 'Este smoke test só roda contra o Supabase local.');

const run = Date.now();
const password = 'senha-sintetica-123';
const TZ = 'America/Sao_Paulo';

async function newUser(label) {
  const email = `${label}-${run}@example.test`;
  const client = createClient(url, anonKey, { auth: { persistSession: false } });
  const up = await client.auth.signUp({ email, password, options: { data: { display_name: `Smoke ${label}`, birth_date: '1990-01-01' } } });
  assert.equal(up.error, null, `cadastro ${label}`);
  let link;
  for (let i = 0; i < 20 && !link; i++) {
    const list = await (await fetch(`${mailpit}/api/v1/search?query=to:${encodeURIComponent(email)}`)).json();
    const id = list.messages?.[0]?.ID;
    if (id) {
      const msg = await (await fetch(`${mailpit}/api/v1/message/${id}`)).json();
      link = /https?:\/\/[^\s"'<>]*verify[^\s"'<>]*/.exec(`${msg.HTML} ${msg.Text}`)?.[0]?.replaceAll('&amp;', '&');
    }
    if (!link) await new Promise((r) => setTimeout(r, 500));
  }
  assert(link, `e-mail de confirmação de ${label}`);
  await fetch(link, { redirect: 'manual' });
  const inn = await client.auth.signInWithPassword({ email, password });
  assert.equal(inn.error, null, `login ${label}`);
  return { client, email, id: inn.data.user.id };
}

// Local calendar date (academy time zone) for "now minus N days".
const localDate = (daysAgo) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(Date.now() - daysAgo * 86_400_000));

const admin = await newUser('admin');
const manager = await newUser('gestor');
const teacher = await newUser('professor');
const alice = await newUser('aluna');
const bob = await newUser('aluno');
const outsider = await newUser('externo');
execFileSync('node', ['scripts/make-platform-admin.mjs', admin.email], { stdio: 'pipe' });

assert.equal((await admin.client.rpc('grant_academy_creator', { p_email: manager.email })).error, null);
const academyId = (await manager.client.rpc('create_academy', {
  p_name: 'Academia Graduação', p_slug: `graduacao-${run}`, p_idempotency_key: crypto.randomUUID(),
})).data;
for (const [u, role] of [[teacher, 'instructor'], [alice, 'student'], [bob, 'student']]) {
  assert.equal((await manager.client.rpc('add_member', { p_academy_id: academyId, p_email: u.email, p_role: role })).error, null);
}
const classId = (await manager.client.rpc('create_class', {
  p_academy_id: academyId, p_title: 'Turma Graduação', p_instructor_user_id: teacher.id, p_idempotency_key: crypto.randomUUID(),
})).data;
const curriculumId = (await manager.client.rpc('create_curriculum', {
  p_academy_id: academyId, p_title: 'Trilha de teste', p_level: 'Básico', p_idempotency_key: crypto.randomUUID(),
})).data;
const tesoura = (await alice.client.rpc('search_techniques', { p_query: 'Tesoura', p_limit: 1 })).data[0].id;
assert.equal((await manager.client.rpc('add_curriculum_item', { p_curriculum_id: curriculumId, p_technique_id: tesoura, p_required: true })).error, null);

// The manager registers each academy's own rule. Nothing official is built in: the app starts with no rules.
let r = await alice.client.from('promotion_rules').select('id');
assert.equal(r.data.length, 0, 'o sistema não traz nenhuma regra pronta');
const criteria = [
  { kind: 'min_days', label: 'Tempo mínimo (teste)', min_days: 5 },
  { kind: 'attendance', label: 'Assiduidade (teste)', min_attendances: 2, distinct_days: true },
  { kind: 'curriculum', label: 'Nível técnico (teste)', curriculum_id: curriculumId, min_percent: 100 },
  { kind: 'manual', label: 'Comprometimento' },
];
const createRule = (u, from, list = criteria, key = crypto.randomUUID()) =>
  u.client.rpc('create_promotion_rule', {
    p_academy_id: academyId, p_belt_code: 'Faixa Teste A', p_degree: 1, p_title: null, p_effective_from: from, p_criteria: list, p_idempotency_key: key,
  });
assert.equal((await createRule(teacher, localDate(30))).error?.code, '42501', 'instrutor não cadastra regra');
assert.equal((await createRule(manager, localDate(30), [])).error?.code, '22023', 'regra sem critérios é rejeitada');
r = await createRule(manager, localDate(30));
assert.equal(r.error, null, 'gestor cadastra a regra combinando os 4 tipos de critério');
const ruleV1 = r.data;

// The manager registers where the student stands; the student cannot.
const rankArgs = (who, belt = 'Faixa Teste A') => ({
  p_academy_id: academyId, p_user_id: who.id, p_belt_code: belt, p_degree: 1, p_effective_date: localDate(10), p_reason: null,
  p_idempotency_key: crypto.randomUUID(),
});
assert.equal((await alice.client.rpc('register_initial_rank', rankArgs(alice))).error?.code, '42501', 'aluna não altera a própria graduação');
assert.equal((await manager.client.rpc('register_initial_rank', rankArgs(alice))).error, null, 'gestor registra a graduação da aluna');
assert.equal((await manager.client.rpc('register_initial_rank', rankArgs(alice))).error?.code, '23505', 'só uma graduação inicial');

const evaluate = (u, who) => u.client.rpc('evaluate_promotion', { p_academy_id: academyId, p_user_id: who.id });
r = await evaluate(alice, alice);
assert.equal(r.data.eligible, false, 'ainda não elegível');
assert.equal(r.data.recommendation_only, true);
assert.equal(r.data.criteria[0].met, true, 'tempo: 10 dias >= 5');
assert.equal(r.data.criteria[1].current, 0, 'sem presenças validadas');
assert.equal((await evaluate(bob, alice)).error?.code, '42501', 'outro aluno não vê a avaliação');
assert.equal((await evaluate(outsider, alice)).error?.code, '42501', 'externo não vê a avaliação');

// Attendance: two lessons on different days, validated by the teacher (granted by the manager).
for (const p of ['validate_attendance', 'recommend_graduation', 'assess_skills']) {
  assert.equal((await manager.client.rpc('set_instructor_permission', { p_academy_id: academyId, p_permission: p, p_granted: true })).error, null);
}
const sessionIds = [];
for (const daysAgo of [3, 2]) {
  r = await teacher.client.rpc('create_session', {
    p_class_id: classId, p_date: localDate(daysAgo), p_start: '19:00', p_end: '20:00', p_idempotency_key: crypto.randomUUID(),
  });
  assert.equal(r.error, null, 'professor agenda aula passada');
  sessionIds.push(r.data);
}
// A pending request and a revoked one never count.
r = await teacher.client.rpc('validate_attendance', { p_session_id: sessionIds[0], p_user_id: alice.id, p_idempotency_key: crypto.randomUUID() });
assert.equal(r.data, 'validated');
r = await evaluate(alice, alice);
assert.equal(r.data.criteria[1].current, 1, 'uma presença validada');
r = await teacher.client.rpc('validate_attendance', { p_session_id: sessionIds[1], p_user_id: alice.id, p_idempotency_key: crypto.randomUUID() });
const attId = (await teacher.client.from('attendances').select('id').eq('session_id', sessionIds[1]).eq('user_id', alice.id).single()).data.id;
assert.equal((await teacher.client.rpc('revoke_attendance', { p_attendance_id: attId, p_reason: 'lançada por engano' })).error, null);
r = await evaluate(alice, alice);
assert.equal(r.data.criteria[1].current, 1, 'presença revogada não conta');
// Re-register the second day by a new lesson (a revoked attendance is final).
r = await teacher.client.rpc('create_session', {
  p_class_id: classId, p_date: localDate(1), p_start: '19:00', p_end: '20:00', p_idempotency_key: crypto.randomUUID(),
});
await teacher.client.rpc('validate_attendance', { p_session_id: r.data, p_user_id: alice.id, p_idempotency_key: crypto.randomUUID() });
r = await evaluate(alice, alice);
assert.equal(r.data.criteria[1].current, 2, 'dois dias com presença validada');
assert.equal(r.data.criteria[1].met, true);

// Technical level and the manual criterion.
assert.equal((await teacher.client.rpc('assess_skill', {
  p_academy_id: academyId, p_user_id: alice.id, p_technique_id: tesoura, p_status: 'validated', p_note: null, p_idempotency_key: crypto.randomUUID(),
})).error, null);
assert.equal((await alice.client.rpc('assess_manual_criterion', {
  p_academy_id: academyId, p_user_id: alice.id, p_label: 'Comprometimento', p_met: true, p_note: null, p_idempotency_key: crypto.randomUUID(),
})).error?.code, '42501', 'aluna não avalia o próprio critério');
r = await evaluate(alice, alice);
assert.equal(r.data.eligible, false, 'falta o critério manual');
assert.equal((await teacher.client.rpc('assess_manual_criterion', {
  p_academy_id: academyId, p_user_id: alice.id, p_label: 'Comprometimento', p_met: true, p_note: 'frequente e dedicada', p_idempotency_key: crypto.randomUUID(),
})).data, true, 'professor avalia o critério manual');
r = await evaluate(alice, alice);
assert.equal(r.data.eligible, true, 'todos os critérios atendidos: elegível (recomendação)');

// Eligibility promotes nobody; versions are immutable history.
r = await manager.client.from('promotions').select('id').eq('user_id', alice.id);
assert.equal(r.data.length, 1, 'elegibilidade não promove');
assert.equal((await createRule(manager, localDate(30))).error?.code, '22023', 'nova versão precisa começar depois da atual');
r = await createRule(manager, localDate(0), [{ kind: 'min_days', label: 'Tempo v2 (teste)', min_days: 365 }]);
assert.equal(r.error, null, 'gestor cadastra a versão 2');
r = await manager.client.from('promotion_rules').select('version, effective_to').eq('academy_id', academyId).order('version');
assert.equal(r.data.length, 2, 'as duas versões ficam registradas');
assert.notEqual(r.data[0].effective_to, null, 'a versão 1 foi encerrada, não apagada');
r = await evaluate(alice, alice);
assert.equal(r.data.rule.version, 2, 'a avaliação usa a versão vigente');
assert.equal(r.data.eligible, false, 'pela versão 2 (365 dias) ela ainda não é elegível');
r = await alice.client.from('promotion_rules').update({ title: 'hack' }).eq('id', ruleV1).select();
assert(r.error || r.data.length === 0, 'regras não são editáveis por clientes');
r = await bob.client.rpc('evaluate_promotion', { p_academy_id: academyId, p_user_id: bob.id });
assert.equal(r.data.has_rank, false, 'sem graduação registrada: sem avaliação');

const actions = new Set((await manager.client.from('audit_events').select('action').eq('academy_id', academyId)).data.map((e) => e.action));
for (const a of ['promotion_rule.create', 'rank.initial', 'criterion.assess']) assert(actions.has(a), `auditoria registra ${a}`);

console.log('smoke-graduation: OK');
