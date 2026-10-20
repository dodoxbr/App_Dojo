// Smoke test of US-013 (part 2) against the LOCAL Supabase: the guardian creates and answers for the minor.
// Journey: dependent created by the guardian -> consent -> manager checks the document in person -> approval ->
// validated attendance followed by the guardian -> financial responsible by code -> revocation suspends the minor.
// Usage: SUPABASE_URL=... SUPABASE_ANON_KEY=... node scripts/smoke-guardians.mjs
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { localDate, localEnv, makePlatformAdmin, newUser, TZ } from './lib/local.mjs';

const run = Date.now();
const { url, anonKey } = localEnv();

const master = await newUser('mestre', run);
const teacher = await newUser('professor', run);
const mother = await newUser('mae', run);
const uncle = await newUser('tio', run);
const stranger = await newUser('estranho', run);

const owner = await newUser('dono', run);
makePlatformAdmin(owner.email);
assert.equal((await owner.client.rpc('grant_academy_creator', { p_email: master.email })).error, null);
const academy = (await master.client.rpc('create_academy', { p_name: 'Academia Responsáveis', p_slug: `resp-${run}`, p_idempotency_key: crypto.randomUUID() })).data;
assert(academy, 'academia criada');
assert.equal((await master.client.rpc('add_member', { p_academy_id: academy, p_email: teacher.email, p_role: 'instructor' })).error, null);
assert.equal((await master.client.rpc('set_instructor_permission', { p_academy_id: academy, p_permission: 'validate_attendance', p_granted: true })).error, null);

// A minor cannot sign up alone into an academy and cannot be created by another minor or by an adult as "adult".
const key = crypto.randomUUID();
const make = (u, over = {}) => u.client.rpc('create_dependent', {
  p_display_name: 'Filha Teste', p_birth_date: localDate(365 * 9), p_relationship: 'mãe', p_idempotency_key: key, ...over,
});
assert.equal((await make(mother, { p_birth_date: localDate(365 * 30) })).error?.code, '22023', 'um adulto não vira dependente');
const created = await make(mother);
assert.equal(created.error, null, 'a mãe cadastra a filha');
const minorId = created.data;
assert.equal((await make(mother)).data, minorId, 'repetir a mesma requisição não duplica');

// The dependent has no credentials: nobody can sign in as the minor.
const anon = createClient(url, anonKey, { auth: { persistSession: false } });
const probe = await anon.auth.signInWithPassword({ email: 'filha-teste@example.test', password: 'qualquer-coisa-123' });
assert(probe.error, 'não existe login para o menor');

const deps = (await mother.client.rpc('list_my_dependents')).data;
assert.equal(deps.length, 1);
assert.equal(deps[0].kind, 'legal');
assert.equal((await stranger.client.rpc('list_my_dependents')).data.length, 0, 'terceiros não enxergam dependentes');

// Consent + request: the minor cannot be approved before the manager checks the guardian's document.
assert.equal((await stranger.client.rpc('request_dependent_membership', { p_minor_id: minorId, p_academy_id: academy, p_photos: false })).error?.code, '42501');
const membershipId = (await mother.client.rpc('request_dependent_membership', { p_minor_id: minorId, p_academy_id: academy, p_photos: false })).data;
assert(membershipId, 'pedido de vaga enviado');
const approve = () => master.client.rpc('decide_membership', { p_membership_id: membershipId, p_decision: 'approved', p_reason: null, p_idempotency_key: crypto.randomUUID() });
assert.equal((await approve()).error?.code, '22023', 'sem conferência do documento não aprova');

const consents = (await master.client.rpc('list_academy_guardian_consents', { p_academy_id: academy })).data;
assert.equal(consents.length, 1);
assert.equal(consents[0].minor_name, 'Filha Teste');
assert.equal(consents[0].consent_photos, false, 'fotos desligadas por padrão');
const flags = (await master.client.rpc('member_age_flags', { p_academy_id: academy })).data;
assert.equal(flags.find((f) => f.user_id === minorId)?.is_minor, true, 'a lista do gestor marca o menor');
assert.equal(flags.find((f) => f.user_id === minorId)?.guardian_ready, false);

assert.equal((await mother.client.rpc('verify_guardian_consent', { p_consent_id: consents[0].id, p_document_checked: true, p_note: null })).error?.code, '42501', 'o responsável não se verifica');
assert.equal((await master.client.rpc('verify_guardian_consent', { p_consent_id: consents[0].id, p_document_checked: false, p_note: null })).error?.code, '22023');
assert.equal((await master.client.rpc('verify_guardian_consent', { p_consent_id: consents[0].id, p_document_checked: true, p_note: 'conferido (teste)' })).error, null, 'gestor confere pessoalmente');
assert.equal((await approve()).data, 'approved', 'agora o menor é aprovado');

// Attendance validated by the teacher is what the guardian follows; a pending one does not count.
const classId = (await master.client.rpc('create_class', { p_academy_id: academy, p_title: 'Turma Infantil', p_instructor_user_id: teacher.id, p_idempotency_key: crypto.randomUUID() })).data;
const part = (ms) => Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(ms)).map((p) => [p.type, p.value]));
const s = part(Date.now() - 20 * 60_000), e = part(Date.now() + 40 * 60_000);
const same = s.year === e.year && s.month === e.month && s.day === e.day;
const sessionId = (await teacher.client.rpc('create_session', {
  p_class_id: classId, p_date: `${s.year}-${s.month}-${s.day}`, p_start: `${s.hour}:${s.minute}`, p_end: same ? `${e.hour}:${e.minute}` : '23:59', p_idempotency_key: crypto.randomUUID(),
})).data;
assert(sessionId, 'aula criada');
const att = await teacher.client.rpc('validate_attendance', { p_session_id: sessionId, p_user_id: minorId, p_idempotency_key: crypto.randomUUID() });
assert.equal(att.data, 'validated', 'o professor valida a presença do menor');

const overview = (await mother.client.rpc('guardian_overview', { p_minor_id: minorId })).data;
assert.equal(overview.academies[0].validated_attendances_30_days, 1, 'a mãe acompanha a presença validada');
assert.equal(overview.academies[0].membership_status, 'approved');
assert.equal((await stranger.client.rpc('guardian_overview', { p_minor_id: minorId })).error?.code, '42501', 'terceiros não acompanham o menor');
assert.equal((await mother.client.from('training_logs').select('id')).data.length, 0, 'o diário não é aberto ao responsável');

// Financial responsible by code: sees the dependent but never the progress.
const invite = await mother.client.rpc('create_financial_invite', { p_minor_id: minorId });
assert.equal(invite.error, null);
const code = invite.data[0].code;
assert.equal((await mother.client.from('guardian_invites').select('id')).error?.code, '42501', 'o convite (hash) não é legível');
assert.equal((await stranger.client.rpc('accept_financial_invite', { p_code: 'CODIGOERRADO'.slice(0, 10), p_relationship: 'tio' })).error?.code, '22023', 'código errado');
assert.equal((await uncle.client.rpc('accept_financial_invite', { p_code: code.toLowerCase(), p_relationship: 'tio' })).error, null, 'o tio vira responsável financeiro');
assert.equal((await stranger.client.rpc('accept_financial_invite', { p_code: code, p_relationship: 'amigo' })).error?.code, '22023', 'código vale uma vez só');
assert.equal((await uncle.client.rpc('list_my_dependents')).data[0].kind, 'financial');
assert.equal((await uncle.client.rpc('guardian_overview', { p_minor_id: minorId })).error?.code, '42501', 'o financeiro não acompanha a frequência');

// Revoking the consent suspends the minor; a new consent must be verified again.
assert.equal((await uncle.client.rpc('revoke_guardian_consent', { p_consent_id: consents[0].id })).error?.code, '42501', 'o financeiro não revoga');
assert.equal((await mother.client.rpc('revoke_guardian_consent', { p_consent_id: consents[0].id })).error, null, 'a mãe revoga o consentimento');
const after = (await master.client.rpc('member_age_flags', { p_academy_id: academy })).data.find((f) => f.user_id === minorId);
assert.equal(after.guardian_ready, false, 'sem consentimento ativo o menor não está em dia');
assert.equal((await master.client.from('memberships').select('status').eq('id', membershipId).single()).data.status, 'suspended', 'o menor foi suspenso');

const actions = new Set((await master.client.from('audit_events').select('action').eq('academy_id', academy)).data.map((x) => x.action));
for (const a of ['guardian.consent', 'guardian.verify', 'guardian.revoke', 'membership.decide']) assert(actions.has(a), `auditoria registra ${a}`);

console.log('smoke-guardians: OK');
