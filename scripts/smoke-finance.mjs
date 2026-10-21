// Smoke test of US-017 against the LOCAL Supabase: manual financial control (no payment platform).
// Journey: plans -> monthly charges -> manual payment -> the student, the legal guardian and the financial responsible see
// their charges -> cancel / reopen -> the instructor and strangers see nothing.
// Usage: SUPABASE_URL=... SUPABASE_ANON_KEY=... node scripts/smoke-finance.mjs
import assert from 'node:assert/strict';
import { localDate, makePlatformAdmin, newUser, saveContact } from './lib/local.mjs';

const run = Date.now();
const owner = await newUser('dono', run);
const master = await newUser('mestre', run);
const teacher = await newUser('professor', run);
const alice = await newUser('aluna', run);
const mother = await newUser('mae', run);
const uncle = await newUser('tio', run);
const stranger = await newUser('estranho', run);
makePlatformAdmin(owner.email);

assert.equal((await owner.client.rpc('grant_academy_creator', { p_email: master.email })).error, null);
const academy = (await master.client.rpc('create_academy', { p_name: 'Academia Financeiro', p_slug: `fin-${run}`, p_idempotency_key: crypto.randomUUID() })).data;
assert(academy, 'academia criada');
for (const [u, role] of [[teacher, 'instructor'], [alice, 'student']]) {
  assert.equal((await master.client.rpc('add_member', { p_academy_id: academy, p_email: u.email, p_role: role })).error, null);
}

// A minor enrolled through the guardian flow, with a separate financial responsible
const minorId = (await mother.client.rpc('create_dependent', { p_display_name: 'Filha Financeiro', p_birth_date: localDate(365 * 9), p_relationship: 'mãe', p_idempotency_key: crypto.randomUUID() })).data;
assert.equal((await saveContact(mother.client, minorId, 'Filha Financeiro da Silva')).error, null);
const membershipId = (await mother.client.rpc('request_dependent_membership', { p_minor_id: minorId, p_academy_id: academy, p_photos: false })).data;
const consent = (await master.client.rpc('list_academy_guardian_consents', { p_academy_id: academy })).data[0];
assert.equal((await master.client.rpc('verify_guardian_consent', { p_consent_id: consent.id, p_document_checked: true, p_note: null })).error, null);
assert.equal((await master.client.rpc('decide_membership', { p_membership_id: membershipId, p_decision: 'approved', p_reason: null, p_idempotency_key: crypto.randomUUID() })).data, 'approved');
const code = (await mother.client.rpc('create_financial_invite', { p_minor_id: minorId })).data[0].code;
assert.equal((await uncle.client.rpc('accept_financial_invite', { p_code: code, p_relationship: 'tio' })).error, null);

// Plans (the academy chooses the values) and the monthly charges
const month = `${localDate(0).slice(0, 7)}-01`;
const plan = (user, amount, day) => master.client.rpc('set_member_plan', { p_academy_id: academy, p_user_id: user, p_amount_cents: amount, p_due_day: day, p_starts_on: localDate(30), p_active: true });
assert.equal((await plan(alice.id, 0, 10)).error?.code, '22023', 'plano sem valor é rejeitado');
assert.equal((await plan(alice.id, 15000, 10)).error, null, 'plano da aluna');
assert.equal((await plan(minorId, 9000, 5)).error, null, 'plano da menor');
assert.equal((await plan(teacher.id, 9000, 5)).error?.code, '22023', 'instrutor não tem plano');
assert.equal((await alice.client.rpc('set_member_plan', { p_academy_id: academy, p_user_id: alice.id, p_amount_cents: 1, p_due_day: 1, p_starts_on: localDate(0), p_active: true })).error?.code, '42501', 'aluna não define o próprio plano');

const key = crypto.randomUUID();
const gen = (k) => master.client.rpc('generate_monthly_charges', { p_academy_id: academy, p_month: month, p_idempotency_key: k });
assert.equal((await gen(key)).data, 2, 'gera 2 cobranças');
assert.equal((await gen(key)).data, 2, 'repetir a chave devolve o mesmo resultado');
assert.equal((await gen(crypto.randomUUID())).data, 0, 'outra chave no mesmo mês não duplica');

const list = (await master.client.rpc('list_academy_charges', { p_academy_id: academy, p_month: month })).data;
assert.equal(list.length, 2);
assert.equal(list.find((c) => c.user_id === minorId).financial_name, 'Smoke tio', 'a lista mostra o responsável financeiro do menor');
const summary = (await master.client.rpc('finance_summary', { p_academy_id: academy, p_month: month })).data[0];
assert.equal(Number(summary.billed_cents), 24000);
assert.equal(Number(summary.received_cents), 0);

// Manual payment
const aliceCharge = list.find((c) => c.user_id === alice.id);
assert.equal((await alice.client.rpc('mark_charge_paid', { p_charge_id: aliceCharge.id, p_method: 'pix', p_paid_on: localDate(0), p_note: null })).error?.code, '42501', 'a aluna não marca o próprio pagamento');
assert.equal((await master.client.rpc('mark_charge_paid', { p_charge_id: aliceCharge.id, p_method: 'pix', p_paid_on: localDate(0), p_note: 'recebido no balcão (teste)' })).error, null, 'gestor marca como pago');
assert.equal(Number((await master.client.rpc('finance_summary', { p_academy_id: academy, p_month: month })).data[0].received_cents), 15000, 'recebido atualiza o resumo');

// Who sees what
const mine = (await alice.client.rpc('my_charges')).data;
assert.equal(mine.length, 1);
assert.equal(mine[0].status, 'paid');
assert.equal((await alice.client.rpc('my_charges', { p_user_id: minorId })).error?.code, '42501', 'a aluna não vê a cobrança de outra pessoa');
assert.equal((await mother.client.rpc('my_charges', { p_user_id: minorId })).data.length, 1, 'o responsável legal vê as cobranças da menor');
assert.equal((await uncle.client.rpc('my_charges', { p_user_id: minorId })).data.length, 1, 'o responsável financeiro também');
assert.equal((await stranger.client.rpc('my_charges', { p_user_id: minorId })).error?.code, '42501', 'terceiros não veem');
assert.equal((await teacher.client.from('charges').select('id')).data.length, 0, 'o instrutor não vê financeiro');
assert.equal((await teacher.client.rpc('list_academy_charges', { p_academy_id: academy, p_month: month })).error?.code, '42501');
assert.equal((await owner.client.rpc('list_academy_charges', { p_academy_id: academy, p_month: month })).error?.code, '42501', 'nem o super admin');
assert.equal((await alice.client.from('charges').update({ status: 'paid' }).eq('id', aliceCharge.id)).error?.code, '42501', 'sem escrita direta');

// Cancel + reopen (correction) and a one-off charge, all with history
const minorCharge = list.find((c) => c.user_id === minorId);
assert.equal((await master.client.rpc('cancel_charge', { p_charge_id: minorCharge.id, p_reason: 'cobrança duplicada (teste)' })).error, null);
assert.equal((await master.client.rpc('reopen_charge', { p_charge_id: minorCharge.id, p_reason: 'cancelada por engano (teste)' })).error, null);
const extraKey = crypto.randomUUID();
const extra = await master.client.rpc('create_charge', { p_academy_id: academy, p_user_id: alice.id, p_description: 'Taxa de exame (teste)', p_amount_cents: 5000, p_due_date: localDate(-7), p_idempotency_key: extraKey });
assert.equal(extra.error, null, 'cobrança avulsa');
assert.equal((await master.client.rpc('create_charge', { p_academy_id: academy, p_user_id: alice.id, p_description: 'Taxa de exame (teste)', p_amount_cents: 5000, p_due_date: localDate(-7), p_idempotency_key: extraKey })).data, extra.data, 'repetir não duplica');

const sf = (await master.client.rpc('student_finance', { p_academy_id: academy, p_user_id: alice.id })).data;
assert.equal(sf.plan.amount_cents, 15000);
assert(sf.charges.length >= 2, 'a ficha financeira lista as cobranças');
assert(sf.history.length >= 3, 'e o histórico');
assert.equal((await master.client.rpc('student_finance', { p_academy_id: academy, p_user_id: minorId })).data.financial.name, 'Smoke tio');

const actions = new Set((await master.client.from('audit_events').select('action').eq('academy_id', academy)).data.map((x) => x.action));
for (const a of ['finance.plan', 'finance.generate', 'finance.paid', 'finance.cancelled', 'finance.reopened', 'finance.create_charge']) assert(actions.has(a), `auditoria registra ${a}`);

console.log('smoke-finance: OK');
