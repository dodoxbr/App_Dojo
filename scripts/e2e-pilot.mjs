// End-to-end journey of the pilot (docs/09), through the real API of the LOCAL Supabase:
// cadastro -> solicitação -> aprovação -> aula -> presença -> diário -> progresso -> graduação autorizada -> painel.
// All belt names and numbers are FICTITIOUS test data.
// Usage: SUPABASE_URL=... SUPABASE_ANON_KEY=... node scripts/e2e-pilot.mjs
import assert from 'node:assert/strict';
import { localDate, makePlatformAdmin, newUser } from './lib/local.mjs';

const run = Date.now();
const step = (n, text) => console.log(`  ${String(n).padStart(2, '0')}. ${text}`);

console.log('Jornada do piloto');
const owner = await newUser('dono', run); // platform owner
const master = await newUser('mestre', run); // future manager
const teacher = await newUser('professor', run);
const student = await newUser('aluno', run);
makePlatformAdmin(owner.email);

// 1. The owner lets the master create an academy; the master creates it and is its manager.
assert.equal((await owner.client.rpc('grant_academy_creator', { p_email: master.email })).error, null);
const created = await master.client.rpc('create_academy', { p_name: 'Academia Piloto', p_slug: `piloto-${run}`, p_idempotency_key: crypto.randomUUID() });
assert.equal(created.error, null);
const academyId = created.data;
step(1, 'academia criada; o mestre é o gestor');

// 2. The master registers the instructor and publishes the academy link.
assert.equal((await master.client.rpc('add_member', { p_academy_id: academyId, p_email: teacher.email, p_role: 'instructor' })).error, null);
for (const p of ['validate_attendance', 'recommend_graduation', 'assess_skills', 'view_progress']) {
  assert.equal((await master.client.rpc('set_instructor_permission', { p_academy_id: academyId, p_permission: p, p_granted: true })).error, null);
}
step(2, 'instrutor cadastrado e permissões liberadas pelo gestor');

// 3. Sign-up -> membership request through the academy link -> approval.
const found = await student.client.from('academies').select('id').eq('slug', `piloto-${run}`).maybeSingle();
assert.equal(found.data?.id, academyId, 'o aluno encontra a academia pelo link');
const request = await student.client.rpc('request_membership', { p_academy_id: academyId });
assert.equal(request.error, null);
const pending = await student.client.from('memberships').select('status').eq('academy_id', academyId).single();
assert.equal(pending.data.status, 'pending');
assert.equal((await student.client.from('curricula').select('id')).data.length, 0, 'pendente não vê dados internos');
const decided = await master.client.rpc('decide_membership', { p_membership_id: request.data, p_decision: 'approved', p_reason: 'bem-vindo', p_idempotency_key: crypto.randomUUID() });
assert.equal(decided.data, 'approved');
step(3, 'aluno solicitou entrada pelo link e o gestor aprovou');

// 4. Trail, rules and the student's current rank, all defined by the academy.
const curriculumId = (await master.client.rpc('create_curriculum', { p_academy_id: academyId, p_title: 'Trilha do piloto', p_level: 'Básico', p_idempotency_key: crypto.randomUUID() })).data;
const tesoura = (await student.client.rpc('search_techniques', { p_query: 'tesoura', p_limit: 1 })).data[0].id;
assert.equal((await master.client.rpc('add_curriculum_item', { p_curriculum_id: curriculumId, p_technique_id: tesoura, p_required: true })).error, null);
const rule = await master.client.rpc('create_promotion_rule', {
  p_academy_id: academyId, p_belt_code: 'Faixa Teste A', p_degree: 0, p_title: 'Regra do piloto (fictícia)', p_effective_from: localDate(60),
  p_criteria: [
    { kind: 'min_days', label: 'Tempo (teste)', min_days: 3 },
    { kind: 'attendance', label: 'Presenças (teste)', min_attendances: 1 },
    { kind: 'curriculum', label: 'Técnicas (teste)', curriculum_id: curriculumId, min_percent: 100 },
    { kind: 'manual', label: 'Comprometimento' },
  ],
  p_idempotency_key: crypto.randomUUID(),
});
assert.equal(rule.error, null);
assert.equal((await master.client.rpc('register_initial_rank', {
  p_academy_id: academyId, p_user_id: student.id, p_belt_code: 'Faixa Teste A', p_degree: 0, p_effective_date: localDate(10), p_reason: null, p_idempotency_key: crypto.randomUUID(),
})).error, null);
step(4, 'trilha, regra (4 critérios) e graduação atual cadastradas pelo gestor');

// 5. Class and a lesson happening now; the student checks in; the teacher confirms.
const classId = (await master.client.rpc('create_class', { p_academy_id: academyId, p_title: 'Turma do piloto', p_instructor_user_id: teacher.id, p_idempotency_key: crypto.randomUUID() })).data;
const now = new Date();
const startMs = now.getTime() - 5 * 60_000;
const local = (ms) => {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(ms)).map((p) => [p.type, p.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
};
const s = local(startMs);
const e = local(startMs + 45 * 60_000);
// keep the lesson inside one local day; late at night, schedule it as already finished (check-in stays open for 1 hour)
const sameDay = s.date === e.date;
const session = await teacher.client.rpc('create_session', {
  p_class_id: classId, p_date: s.date, p_start: sameDay ? s.time : local(startMs - 90 * 60_000).time,
  p_end: sameDay ? e.time : local(startMs - 50 * 60_000).time, p_idempotency_key: crypto.randomUUID(),
});
assert.equal(session.error, null, 'professor agenda a aula');
const checkIn = await student.client.rpc('request_check_in', { p_session_id: session.data });
assert.equal(checkIn.error, null, 'aluno faz check-in');
const attBefore = await student.client.from('attendances').select('status').eq('id', checkIn.data).single();
assert.equal(attBefore.data.status, 'pending', 'o check-in sozinho não conta');
assert.equal((await master.client.rpc('evaluate_promotion', { p_academy_id: academyId, p_user_id: student.id })).data.criteria[1].current, 0, 'presença pendente não conta');
assert.equal((await teacher.client.rpc('validate_attendance', { p_session_id: session.data, p_user_id: student.id, p_idempotency_key: crypto.randomUUID() })).data, 'validated');
step(5, 'aula agendada; check-in do aluno; presença confirmada pelo professor');

// 6. The student writes in the private diary; nobody else can read it (but the owner, in the test phase).
const diary = await student.client.rpc('save_training_log', {
  p_academy_id: academyId, p_trained_at: new Date().toISOString(), p_notes: 'registro privado do aluno', p_technique_ids: [tesoura], p_client_key: crypto.randomUUID(),
});
assert.equal(diary.error, null);
assert.equal((await master.client.from('training_logs').select('id')).data.length, 0, 'o gestor não lê o diário do aluno');
assert.equal((await teacher.client.from('training_logs').select('id')).data.length, 0, 'o professor não lê o diário do aluno');
step(6, 'diário registrado e privado');

// 7. Progress: the student declares, the teacher validates, the manual criterion is assessed.
assert.equal((await student.client.rpc('declare_skill', { p_academy_id: academyId, p_technique_id: tesoura, p_status: 'practicing' })).data, 'practicing');
assert.equal((await teacher.client.rpc('assess_skill', { p_academy_id: academyId, p_user_id: student.id, p_technique_id: tesoura, p_status: 'validated', p_note: null, p_idempotency_key: crypto.randomUUID() })).data, 'validated');
let evaluation = (await student.client.rpc('evaluate_promotion', { p_academy_id: academyId, p_user_id: student.id })).data;
assert.equal(evaluation.eligible, false, 'ainda falta o critério manual');
assert.equal((await teacher.client.rpc('assess_manual_criterion', { p_academy_id: academyId, p_user_id: student.id, p_label: 'Comprometimento', p_met: true, p_note: null, p_idempotency_key: crypto.randomUUID() })).data, true);
evaluation = (await student.client.rpc('evaluate_promotion', { p_academy_id: academyId, p_user_id: student.id })).data;
assert.equal(evaluation.eligible, true, 'todos os critérios atendidos');
assert.equal(evaluation.recommendation_only, true);
step(7, 'progresso calculado: elegível (apenas recomendação)');

// 8. The dashboard lists the student as eligible; only the manager grants the promotion.
const list = await master.client.rpc('eligible_students', { p_academy_id: academyId });
assert.deepEqual(list.data.map((x) => x.user_id), [student.id], 'o painel lista o aluno como elegível');
assert.equal((await teacher.client.rpc('grant_promotion', { p_academy_id: academyId, p_user_id: student.id, p_belt_code: 'Faixa Teste A', p_degree: 1, p_effective_date: localDate(0), p_reason: 'tentativa do professor', p_idempotency_key: crypto.randomUUID() })).error?.code, '42501', 'o professor não concede');
assert.equal((await student.client.from('promotions').select('id')).data.length, 1, 'nada foi promovido sozinho');
const granted = await master.client.rpc('grant_promotion', { p_academy_id: academyId, p_user_id: student.id, p_belt_code: 'Faixa Teste A', p_degree: 1, p_effective_date: localDate(0), p_reason: 'avaliação do mestre (teste)', p_idempotency_key: crypto.randomUUID() });
assert.equal(granted.error, null, 'o gestor concede a graduação');
const rank = await student.client.from('current_ranks').select('belt_code, degree').single();
assert.deepEqual(rank.data, { belt_code: 'Faixa Teste A', degree: 1 });
step(8, 'graduação concedida pelo gestor; o aluno vê a nova graduação');

// 9. The dashboard shows the lesson, with only validated attendance.
const dash = (await master.client.rpc('academy_dashboard', { p_academy_id: academyId, p_days: 7 })).data;
assert.equal(dash.attendance.validated, 1, 'uma presença validada no painel');
assert.equal(dash.attendance.pending, 0);
assert.equal(dash.privacy.enough_members, false, 'academia pequena: diário e técnicas ficam ocultos');
assert.equal(dash.diary, null);
step(9, 'painel confere os números e esconde agregados de dados privados em academia pequena');

// 10. Audit trail of the whole journey.
const actions = new Set((await master.client.from('audit_events').select('action').eq('academy_id', academyId)).data.map((x) => x.action));
for (const a of ['academy.create', 'membership.request', 'membership.decide', 'promotion_rule.create', 'rank.initial', 'session.create',
  'attendance.request', 'attendance.validate', 'skill.assess', 'criterion.assess', 'promotion.grant']) {
  assert(actions.has(a), `auditoria registra ${a}`);
}
step(10, `${actions.size} tipos de evento auditados`);

console.log('e2e-pilot: OK');
