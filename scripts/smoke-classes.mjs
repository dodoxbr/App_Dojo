// Smoke test of US-007 against the LOCAL Supabase: classes, sessions, schedule visibility.
// Usage: SUPABASE_URL=... SUPABASE_ANON_KEY=... node scripts/smoke-classes.mjs
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

const admin = await newUser('admin');
const manager = await newUser('gestor');
const teacher = await newUser('professor');
const other = await newUser('professor2');
const student = await newUser('aluno');
const outsider = await newUser('externo');
execFileSync('node', ['scripts/make-platform-admin.mjs', admin.email], { stdio: 'pipe' });

assert.equal((await admin.client.rpc('grant_academy_creator', { p_email: manager.email })).error, null);
const academyId = (await manager.client.rpc('create_academy', {
  p_name: 'Academia Turmas', p_slug: `turmas-${run}`, p_idempotency_key: crypto.randomUUID(),
})).data;
for (const [u, role] of [[teacher, 'instructor'], [other, 'instructor'], [student, 'student']]) {
  assert.equal((await manager.client.rpc('add_member', { p_academy_id: academyId, p_email: u.email, p_role: role })).error, null);
}

// Class creation: manager only.
let r = await teacher.client.rpc('create_class', {
  p_academy_id: academyId, p_title: 'Turma do Professor', p_instructor_user_id: teacher.id, p_idempotency_key: crypto.randomUUID(),
});
assert.equal(r.error?.code, '42501', 'instrutor não cria turma');
r = await manager.client.rpc('create_class', {
  p_academy_id: academyId, p_title: 'Turma Noite', p_instructor_user_id: student.id, p_idempotency_key: crypto.randomUUID(),
});
assert.equal(r.error?.code, '22023', 'aluno não pode ser o instrutor responsável');
const classKey = crypto.randomUUID();
r = await manager.client.rpc('create_class', {
  p_academy_id: academyId, p_title: 'Turma Noite', p_instructor_user_id: teacher.id, p_idempotency_key: classKey,
});
assert.equal(r.error, null, 'gestor cria a turma');
const classId = r.data;
r = await manager.client.rpc('create_class', {
  p_academy_id: academyId, p_title: 'Turma Noite', p_instructor_user_id: teacher.id, p_idempotency_key: classKey,
});
assert.equal(r.data, classId, 'criação idempotente');

// Sessions: responsible instructor yes, other instructor no.
const key = crypto.randomUUID();
const schedule = (u, date = '2026-11-02', start = '19:00', end = '20:00', k = key) =>
  u.client.rpc('create_session', { p_class_id: classId, p_date: date, p_start: start, p_end: end, p_idempotency_key: k });
r = await schedule(teacher);
assert.equal(r.error, null, 'instrutor responsável agenda a aula');
const sessionId = r.data;
assert.equal((await schedule(teacher)).data, sessionId, 'agendamento idempotente');
assert.equal((await schedule(teacher, '2026-11-02', '19:00', '20:30', crypto.randomUUID())).error?.code, '23505', 'mesmo horário = conflito');
assert.equal((await schedule(other, '2026-11-03', '19:00', '20:00', crypto.randomUUID())).error?.code, '42501', 'outro instrutor não agenda');
assert.equal((await schedule(student, '2026-11-03', '19:00', '20:00', crypto.randomUUID())).error?.code, '42501', 'aluno não agenda');
assert.equal((await schedule(outsider, '2026-11-03', '19:00', '20:00', crypto.randomUUID())).error?.code, '42501', 'externo não agenda');
assert.equal((await schedule(teacher, '2026-11-03', '20:00', '19:00', crypto.randomUUID())).error?.code, '22023', 'fim antes do início');

r = await teacher.client.from('sessions').select('starts_at, ends_at, status').eq('id', sessionId).single();
assert.equal(r.data.starts_at, '2026-11-02T22:00:00+00:00', '19:00 em São Paulo = 22:00 UTC');

// Direct writes are denied.
r = await teacher.client.from('sessions').insert({ academy_id: academyId, class_id: classId, starts_at: '2026-12-01T10:00:00Z', ends_at: '2026-12-01T11:00:00Z' });
assert(r.error, 'sem INSERT direto em sessions');
r = await manager.client.from('classes').update({ title: 'Hack' }).eq('id', classId).select();
assert(r.error || r.data.length === 0, 'sem UPDATE direto em classes');

// Visibility.
r = await student.client.from('sessions').select('id').eq('class_id', classId);
assert.equal(r.data.length, 1, 'aluno aprovado vê a agenda');
r = await outsider.client.from('sessions').select('id');
assert.equal(r.data?.length ?? 0, 0, 'externo não vê a agenda');
r = await outsider.client.from('classes').select('id');
assert.equal(r.data?.length ?? 0, 0, 'externo não vê turmas');

// Cancel and replace the instructor.
assert.equal((await other.client.rpc('cancel_session', { p_session_id: sessionId, p_reason: null })).error?.code, '42501', 'outro instrutor não cancela');
assert.equal((await teacher.client.rpc('cancel_session', { p_session_id: sessionId, p_reason: 'feriado' })).error, null, 'responsável cancela');
r = await student.client.from('sessions').select('status, cancelled_reason').eq('id', sessionId).single();
assert.equal(r.data.status, 'cancelled');
assert.equal((await manager.client.rpc('update_class', { p_class_id: classId, p_title: 'Turma Noite', p_instructor_user_id: other.id, p_is_active: true })).error, null, 'gestor troca o instrutor');
assert.equal((await schedule(teacher, '2026-11-04', '19:00', '20:00', crypto.randomUUID())).error?.code, '42501', 'instrutor antigo perde o direito');
assert.equal((await schedule(other, '2026-11-04', '19:00', '20:00', crypto.randomUUID())).error, null, 'novo instrutor agenda');

r = await manager.client.from('audit_events').select('action').eq('academy_id', academyId);
const actions = new Set(r.data.map((e) => e.action));
for (const a of ['class.create', 'class.update', 'session.create', 'session.cancel']) assert(actions.has(a), `auditoria registra ${a}`);

console.log('smoke-classes: OK');
