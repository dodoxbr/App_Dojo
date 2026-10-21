// Smoke test of US-008 against the LOCAL Supabase: manual + QR check-in share one core; the teacher confirms.
// Usage: SUPABASE_URL=... SUPABASE_ANON_KEY=... node scripts/smoke-attendance.mjs
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
  // Registration form (US-016) is required to join an academy; synthetic data.
  const ficha = await client.rpc('save_contact', {
    p_user_id: inn.data.user.id, p_full_name: `Smoke ${label}`, p_phone: '(11) 99999-0000', p_postal_code: '01001-000',
    p_street: 'Rua Ficticia', p_number: '1', p_complement: null, p_neighborhood: 'Centro', p_city: 'Sao Paulo', p_state: 'SP',
    p_emergency_name: 'Contato de Emergencia', p_emergency_phone: '(11) 97777-6666', p_emergency_relationship: 'mae', p_health_notes: null, p_health_consent: false,
  });
  assert.equal(ficha.error, null, `ficha de ${label}`);
  return { client, email, id: inn.data.user.id };
}

// Local date/time in the academy time zone for "now + offset minutes".
function local(offsetMinutes) {
  const d = new Date(Date.now() + offsetMinutes * 60_000);
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(d).map((p) => [p.type, p.value]),
  );
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}

const admin = await newUser('admin');
const manager = await newUser('gestor');
const teacher = await newUser('professor');
const other = await newUser('professor2');
const s1 = await newUser('aluno1');
const s2 = await newUser('aluno2');
const s3 = await newUser('aluno3');
const outsider = await newUser('externo');
execFileSync('node', ['scripts/make-platform-admin.mjs', admin.email], { stdio: 'pipe' });

assert.equal((await admin.client.rpc('grant_academy_creator', { p_email: manager.email })).error, null);
const academyId = (await manager.client.rpc('create_academy', {
  p_name: 'Academia Presença', p_slug: `presenca-${run}`, p_idempotency_key: crypto.randomUUID(),
})).data;
for (const [u, role] of [[teacher, 'instructor'], [other, 'instructor'], [s1, 'student'], [s2, 'student'], [s3, 'student']]) {
  assert.equal((await manager.client.rpc('add_member', { p_academy_id: academyId, p_email: u.email, p_role: role })).error, null);
}
const classId = (await manager.client.rpc('create_class', {
  p_academy_id: academyId, p_title: 'Turma Presença', p_instructor_user_id: teacher.id, p_idempotency_key: crypto.randomUUID(),
})).data;

// A lesson that is happening now (keep it inside one local day).
const nowLocal = local(0);
const [h, m] = nowLocal.time.split(':').map(Number);
const [startOffset, endOffset] = h * 60 + m > 23 * 60 + 15 ? [-50, -5] : [-5, 40];
const start = local(startOffset);
const end = local(endOffset);
assert.equal(start.date, end.date, 'aula dentro do mesmo dia local');
let r = await teacher.client.rpc('create_session', {
  p_class_id: classId, p_date: start.date, p_start: start.time, p_end: end.time, p_idempotency_key: crypto.randomUUID(),
});
assert.equal(r.error, null, 'professor agenda a aula de agora');
const sessionId = r.data;

// Manual request.
r = await s1.client.rpc('request_check_in', { p_session_id: sessionId });
assert.equal(r.error, null, 'aluno pede check-in manual');
const a1 = r.data;
assert.equal((await s1.client.rpc('request_check_in', { p_session_id: sessionId })).data, a1, 'pedido idempotente');
r = await s1.client.from('attendances').select('status, source').eq('id', a1).single();
assert.deepEqual(r.data, { status: 'pending', source: 'manual' }, 'nasce pendente');

// QR: only the teacher gets a token; the token creates a PENDING request.
r = await s2.client.rpc('create_check_in_token', { p_session_id: sessionId });
assert.equal(r.error?.code, '42501', 'aluno não gera QR');
r = await other.client.rpc('create_check_in_token', { p_session_id: sessionId });
assert.equal(r.error?.code, '42501', 'professor de outra turma não gera QR');
r = await teacher.client.rpc('create_check_in_token', { p_session_id: sessionId });
assert.equal(r.error, null, 'professor gera o QR');
const { token, expires_at } = r.data[0];
assert.match(token, /^[0-9a-f]{64}$/, 'token de 64 caracteres hex');
assert((new Date(expires_at) - Date.now()) <= 15 * 60_000 + 5_000, 'expira em até 15 minutos');

r = await s2.client.rpc('request_check_in', { p_session_id: sessionId, p_token: 'a'.repeat(64) });
assert.equal(r.error?.code, '22023', 'token errado rejeitado');
r = await outsider.client.rpc('request_check_in', { p_session_id: sessionId, p_token: token });
assert.equal(r.error?.code, '42501', 'externo não faz check-in nem com token');
r = await s2.client.rpc('request_check_in', { p_session_id: sessionId, p_token: token });
assert.equal(r.error, null, 'aluno faz check-in pelo QR');
r = await s2.client.from('attendances').select('status, source').eq('id', r.data).single();
assert.deepEqual(r.data, { status: 'pending', source: 'qr' }, 'QR não valida sozinho: continua pendente');
r = await s2.client.from('check_in_tokens').select('*');
assert(r.error, 'tokens não são legíveis por clientes');

// Students cannot validate; other class' teacher cannot validate; privacy between students.
r = await s1.client.rpc('validate_attendance', { p_session_id: sessionId, p_user_id: s1.id, p_idempotency_key: crypto.randomUUID() });
assert.equal(r.error?.code, '42501', 'aluno não valida a si mesmo');
r = await other.client.rpc('validate_attendance', { p_session_id: sessionId, p_user_id: s1.id, p_idempotency_key: crypto.randomUUID() });
assert.equal(r.error?.code, '42501', 'professor de outra turma não valida');
r = await s2.client.from('attendances').select('user_id').eq('session_id', sessionId);
assert.deepEqual(r.data.map((x) => x.user_id), [s2.id], 'aluno vê só a própria presença');

// The responsible teacher confirms both requests and registers a third student by hand.
r = await teacher.client.from('attendances').select('user_id, status').eq('session_id', sessionId);
assert.equal(r.data.length, 2, 'professor vê os pedidos da aula');
for (const u of [s1, s2]) {
  r = await teacher.client.rpc('validate_attendance', { p_session_id: sessionId, p_user_id: u.id, p_idempotency_key: crypto.randomUUID() });
  assert.equal(r.data, 'validated', 'professor confirma o pedido');
}
r = await teacher.client.rpc('validate_attendance', { p_session_id: sessionId, p_user_id: s3.id, p_idempotency_key: crypto.randomUUID() });
assert.equal(r.data, 'validated', 'professor lança presença manualmente');
r = await teacher.client.rpc('validate_attendance', { p_session_id: sessionId, p_user_id: outsider.id, p_idempotency_key: crypto.randomUUID() });
assert.equal(r.error?.code, '22023', 'não lança presença de quem não é membro');

// Names are visible to the teacher (roster permission).
r = await teacher.client.from('profiles').select('display_name').eq('id', s3.id);
assert.equal(r.data?.[0]?.display_name, 'Smoke aluno3', 'professor vê o nome de quem tem presença');

// Revocation needs a reason, is final for the student, and is audited.
const att1 = (await teacher.client.from('attendances').select('id').eq('user_id', s1.id).eq('session_id', sessionId).single()).data.id;
r = await teacher.client.rpc('revoke_attendance', { p_attendance_id: att1, p_reason: 'x' });
assert.equal(r.error?.code, '22023', 'revogar exige justificativa');
r = await teacher.client.rpc('revoke_attendance', { p_attendance_id: att1, p_reason: 'lançada por engano' });
assert.equal(r.error, null, 'professor revoga com justificativa');
r = await s1.client.rpc('request_check_in', { p_session_id: sessionId });
assert.equal(r.error?.code, '23505', 'presença revogada não pode ser pedida de novo');
r = await s1.client.from('attendances').select('status').eq('id', att1).single();
assert.equal(r.data.status, 'revoked', 'aluno vê que foi revogada');
r = await s3.client.from('attendances').select('status, source').eq('session_id', sessionId).single();
assert.deepEqual(r.data, { status: 'validated', source: 'teacher' });

// The diary is not attendance.
assert.equal((await outsider.client.rpc('save_training_log', {
  p_academy_id: null, p_trained_at: new Date().toISOString(), p_notes: 'treino', p_technique_ids: [], p_client_key: crypto.randomUUID(),
})).error, null);
r = await outsider.client.from('attendances').select('id');
assert.equal(r.data?.length ?? 0, 0, 'registro no diário não gera presença');

// The manager controls what the instructor may do.
assert.equal((await manager.client.rpc('set_instructor_permission', { p_academy_id: academyId, p_permission: 'validate_attendance', p_granted: false })).error, null);
r = await teacher.client.rpc('validate_attendance', { p_session_id: sessionId, p_user_id: s2.id, p_idempotency_key: crypto.randomUUID() });
assert.equal(r.error?.code, '42501', 'sem a permissão, o professor da turma não valida');
r = await manager.client.from('attendances').select('status').eq('session_id', sessionId);
assert.equal(r.data.filter((x) => x.status === 'validated').length, 2, 'gestor vê 2 presenças confirmadas (s2 e s3)');

const actions = new Set((await manager.client.from('audit_events').select('action').eq('academy_id', academyId)).data.map((e) => e.action));
for (const a of ['attendance.request', 'attendance.validate', 'attendance.revoke', 'check_in_token.create']) assert(actions.has(a), `auditoria registra ${a}`);

console.log('smoke-attendance: OK');
