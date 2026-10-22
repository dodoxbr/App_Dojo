// Smoke test of US-014 against the LOCAL Supabase: challenges between members (Gymrats-style), opt-in, adults only.
// Points are chosen by the creator (test values below); nothing official is built in.
// Usage: SUPABASE_URL=... SUPABASE_ANON_KEY=... node scripts/smoke-challenges.mjs
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { localDate, localEnv, makePlatformAdmin, newUser, TZ } from './lib/local.mjs';

const run = Date.now();
const { url, anonKey } = localEnv();

const owner = await newUser('dono', run);
const master = await newUser('mestre', run);
const teacher = await newUser('professor', run);
const alice = await newUser('aluna', run);
const bob = await newUser('aluno', run);
const carol = await newUser('aluna2', run);
const dave = await newUser('externo', run);
makePlatformAdmin(owner.email);

assert.equal((await owner.client.rpc('grant_academy_creator', { p_email: master.email })).error, null);
const academyId = (await master.client.rpc('create_academy', { p_name: 'Academia Desafios', p_slug: `desafios-${run}`, p_idempotency_key: crypto.randomUUID() })).data;
for (const [u, role] of [[teacher, 'instructor'], [alice, 'student'], [bob, 'student'], [carol, 'student']]) {
  assert.equal((await master.client.rpc('add_member', { p_academy_id: academyId, p_email: u.email, p_role: role })).error, null);
}
assert.equal((await master.client.rpc('set_instructor_permission', { p_academy_id: academyId, p_permission: 'validate_attendance', p_granted: true })).error, null);

// A minor cannot even enter the academy (age gate), so cannot take part in a challenge.
const minorClient = createClient(url, anonKey, { auth: { persistSession: false } });
const minorEmail = `menor-${run}@example.test`;
assert.equal((await minorClient.auth.signUp({ email: minorEmail, password: 'senha-sintetica-123', options: { data: { display_name: 'Menor Teste', birth_date: localDate(365 * 12) } } })).error, null);
// (account not confirmed: the gate is covered by the database tests; here we only check a non-member cannot see the academy's challenges)

const create = (u, over = {}) => u.client.rpc('create_challenge', {
  p_academy_id: academyId, p_title: 'Maratona de treinos (teste)', p_description: null, p_metric: 'training', p_points_per_unit: 5,
  p_technique_id: null, p_max_units_per_day: 1, p_starts_on: localDate(0), p_ends_on: localDate(-7), p_min_participants: 3, p_join: true,
  p_idempotency_key: crypto.randomUUID(), ...over,
});

// Students create challenges too; invalid ones are rejected; outsiders cannot.
assert.equal((await create(dave)).error?.code, '42501', 'quem não é membro não cria');
assert.equal((await create(alice, { p_points_per_unit: 0 })).error?.code, '22023', 'sem pontos definidos não cria');
assert.equal((await create(alice, { p_min_participants: 2 })).error?.code, '22023', 'mínimo abaixo de 3 é rejeitado');
let r = await create(alice);
assert.equal(r.error, null, 'a aluna cria o desafio');
const challengeId = r.data;

const list = async (u) => (await u.client.rpc('list_challenges', { p_academy_id: academyId })).data;
assert.equal((await list(alice))[0].state, 'open', 'aguardando participantes');
assert.equal((await list(alice))[0].participants, 1, 'a criadora já participa');
assert.equal((await dave.client.rpc('list_challenges', { p_academy_id: academyId })).error?.code, '42501', 'externo não lista os desafios');

// Opt-in; reaching the minimum activates the challenge on the spot.
assert.equal((await bob.client.rpc('join_challenge', { p_challenge_id: challengeId })).data, 'open', 'segundo participante: ainda aguardando');
const entry = (u, time, note = null, key = crypto.randomUUID()) =>
  u.client.rpc('add_challenge_entry', { p_challenge_id: challengeId, p_local_date: localDate(0), p_local_time: time, p_units: null, p_note: note, p_client_key: key });
assert.equal((await entry(bob, '00:01')).error?.code, '22023', 'antes de ativar não se registra treino');
assert.equal((await carol.client.rpc('join_challenge', { p_challenge_id: challengeId })).data, 'active', 'terceiro participante: ativou e já começou');

// A lesson happening now, attended by alice with a VALIDATED attendance: her entry becomes "confirmed".
const classId = (await master.client.rpc('create_class', { p_academy_id: academyId, p_title: 'Turma Desafios', p_instructor_user_id: teacher.id, p_idempotency_key: crypto.randomUUID() })).data;
const part = (ms) => Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(ms)).map((p) => [p.type, p.value]));
const startMs = Date.now() - 20 * 60_000;
const s = part(startMs), e = part(startMs + 60 * 60_000);
const sameDay = s.year === e.year && s.month === e.month && s.day === e.day;
const lesson = sameDay
  ? { date: `${s.year}-${s.month}-${s.day}`, start: `${s.hour}:${s.minute}`, end: `${e.hour}:${e.minute}` }
  : { date: `${s.year}-${s.month}-${s.day}`, start: `${s.hour}:${s.minute}`, end: '23:59' };
const sess = await teacher.client.rpc('create_session', { p_class_id: classId, p_date: lesson.date, p_start: lesson.start, p_end: lesson.end, p_idempotency_key: crypto.randomUUID() });
assert.equal(sess.error, null, 'professor agenda a aula');
assert.equal((await teacher.client.rpc('validate_attendance', { p_session_id: sess.data, p_user_id: alice.id, p_idempotency_key: crypto.randomUUID() })).data, 'validated');
const insideLesson = lesson.start; // she says she trained at the start of the lesson
assert.equal((await entry(alice, insideLesson, 'aula da turma')).error, null, 'alice registra o treino no horário da aula');
// Horários logo após a meia-noite local: nunca caem no futuro, seja qual for a hora em que o teste roda (CI roda de madrugada).
assert.equal((await entry(bob, '00:00', 'treino em casa')).error, null, 'bob registra um treino sem aula (vale ponto, não confirmado)');
assert.equal((await entry(bob, '00:01')).error?.code, '22023', 'limite de 1 treino por dia');
assert.equal((await entry(dave, '07:00')).error?.code, '42501', 'quem não participa não registra');
const future = await alice.client.rpc('add_challenge_entry', { p_challenge_id: challengeId, p_local_date: localDate(-1), p_local_time: '07:00', p_units: null, p_note: null, p_client_key: crypto.randomUUID() });
assert.equal(future.error?.code, '22023', 'dia futuro é rejeitado');

// Full ranking for participants; points and the confirmed badge.
r = await carol.client.rpc('challenge_ranking', { p_challenge_id: challengeId });
assert.equal(r.error, null);
assert.equal(r.data.length, 3, 'ranking completo com os 3 participantes');
const byName = Object.fromEntries(r.data.map((x) => [x.display_name, x]));
assert.equal(byName['Smoke aluna'].points, 5, 'alice: 1 treino x 5');
assert.equal(byName['Smoke aluna'].verified_entries, 1, 'o treino de alice é confirmado (presença validada na aula)');
assert.equal(byName['Smoke aluno'].points, 5, 'bob: 1 treino x 5');
assert.equal(byName['Smoke aluno'].verified_entries, 0, 'o treino de bob conta, mas não está confirmado');
assert.equal(byName['Smoke aluna2'].points, 0, 'carol aparece com 0');
assert.equal(byName['Smoke aluna'].rank, byName['Smoke aluno'].rank, 'empate divide a posição');
assert.equal((await dave.client.rpc('challenge_ranking', { p_challenge_id: challengeId })).error?.code, '42501', 'quem não participa não vê o ranking');
assert.equal((await dave.client.from('challenge_participants').select('user_id')).data?.length ?? 0, 0, 'nem a lista de participantes');
assert.equal((await bob.client.from('challenge_entries').select('id').eq('user_id', alice.id)).data?.length ?? 0, 0, 'nem os registros dos outros');

// The diary is untouched by challenges.
assert.equal((await master.client.from('training_logs').select('id')).data.length, 0);

// Moderation: creator and manager see every entry; a participant does not.
assert.equal((await bob.client.rpc('list_challenge_entries', { p_challenge_id: challengeId })).error?.code, '42501', 'participante comum não modera');
const all = await master.client.rpc('list_challenge_entries', { p_challenge_id: challengeId });
assert.equal(all.data.length, 2, 'gestor vê os 2 registros');
const bobEntry = all.data.find((x) => x.display_name === 'Smoke aluno').id;
assert.equal((await alice.client.rpc('void_challenge_entry', { p_entry_id: bobEntry })).error, null, 'a criadora anula um registro (moderação)');
r = await carol.client.rpc('challenge_ranking', { p_challenge_id: challengeId });
assert.equal(r.data.find((x) => x.display_name === 'Smoke aluno').points, 0, 'registro anulado não pontua');

// Leaving removes the person from the ranking; cancelling closes the challenge.
assert.equal((await carol.client.rpc('leave_challenge', { p_challenge_id: challengeId })).error, null);
assert.equal((await alice.client.rpc('challenge_ranking', { p_challenge_id: challengeId })).data.length, 2, 'quem saiu deixa o ranking');
assert.equal((await bob.client.rpc('cancel_challenge', { p_challenge_id: challengeId, p_reason: 'não sou o criador' })).error?.code, '42501', 'participante comum não cancela');
assert.equal((await alice.client.rpc('cancel_challenge', { p_challenge_id: challengeId, p_reason: 'fim do teste' })).error, null, 'a criadora cancela');
assert.equal((await list(alice))[0].state, 'cancelled');
assert.equal((await entry(alice, '08:00')).error?.code, '22023', 'desafio cancelado não recebe registros');

const actions = new Set((await master.client.from('audit_events').select('action').eq('academy_id', academyId)).data.map((x) => x.action));
for (const a of ['challenge.create', 'challenge.activate', 'challenge.void_entry', 'challenge.cancel']) assert(actions.has(a), `auditoria registra ${a}`);

console.log('smoke-challenges: OK');
