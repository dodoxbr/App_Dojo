// Smoke test of US-004 against the LOCAL Supabase: request -> approve/reject -> add/end members.
// Usage: SUPABASE_URL=... SUPABASE_ANON_KEY=... node scripts/smoke-membership.mjs
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
const student = await newUser('aluno');
const other = await newUser('outro');
const staff = await newUser('colaborador');
execFileSync('node', ['scripts/make-platform-admin.mjs', admin.email], { stdio: 'pipe' });

// Setup: the manager creates an academy.
assert.equal((await admin.client.rpc('grant_academy_creator', { p_email: manager.email })).error, null);
const created = await manager.client.rpc('create_academy', {
  p_name: 'Academia Filiação', p_slug: `filiacao-${run}`, p_idempotency_key: crypto.randomUUID(),
});
assert.equal(created.error, null, 'gestor cria academia');
const academyId = created.data;

// The student finds the academy by slug (link) and asks to join.
const found = await student.client.from('academies').select('id, name').eq('slug', `filiacao-${run}`).maybeSingle();
assert.equal(found.data?.id, academyId, 'aluno encontra a academia pelo link');

let r = await student.client.rpc('request_membership', { p_academy_id: academyId });
assert.equal(r.error, null, 'aluno solicita entrada');
const membershipId = r.data;
r = await student.client.rpc('request_membership', { p_academy_id: academyId });
assert.equal(r.data, membershipId, 'solicitação idempotente');

r = await student.client.from('memberships').insert({ academy_id: academyId, user_id: student.id, role: 'manager', status: 'approved' });
assert(r.error, 'sem INSERT direto em memberships');
r = await student.client.from('memberships').update({ status: 'approved' }).eq('id', membershipId).select();
assert(r.error || r.data.length === 0, 'aluno não se aprova por UPDATE');

r = await student.client.rpc('decide_membership', { p_membership_id: membershipId, p_decision: 'approved', p_reason: null, p_idempotency_key: crypto.randomUUID() });
assert.equal(r.error?.code, '42501', 'aluno não decide');
r = await other.client.rpc('decide_membership', { p_membership_id: membershipId, p_decision: 'approved', p_reason: null, p_idempotency_key: crypto.randomUUID() });
assert.equal(r.error?.code, '42501', 'usuário comum não decide');

// The manager sees the request (with the name) and approves it.
r = await manager.client.from('memberships').select('id, status, user_id').eq('academy_id', academyId).eq('status', 'pending');
assert.equal(r.data?.length, 1, 'gestor vê o pedido pendente');
r = await manager.client.from('profiles').select('display_name').eq('id', student.id).single();
assert.equal(r.data?.display_name, 'Smoke aluno', 'gestor vê o nome de quem pediu');
r = await manager.client.from('profiles').select('id').eq('id', other.id);
assert.equal(r.data?.length ?? 0, 0, 'gestor não vê perfis sem vínculo');

const key = crypto.randomUUID();
r = await manager.client.rpc('decide_membership', { p_membership_id: membershipId, p_decision: 'approved', p_reason: 'bem-vindo', p_idempotency_key: key });
assert.equal(r.data, 'approved', 'gestor aprova');
r = await manager.client.rpc('decide_membership', { p_membership_id: membershipId, p_decision: 'approved', p_reason: 'bem-vindo', p_idempotency_key: key });
assert.equal(r.data, 'approved', 'aprovação idempotente');
r = await manager.client.rpc('decide_membership', { p_membership_id: membershipId, p_decision: 'rejected', p_reason: null, p_idempotency_key: crypto.randomUUID() });
assert.equal(r.error?.code, '23505', 'já decidido = conflito');

r = await student.client.from('memberships').select('status').eq('id', membershipId).single();
assert.equal(r.data.status, 'approved', 'aluno vê o vínculo aprovado');

// The manager registers a collaborator directly and then ends the student's membership.
r = await manager.client.rpc('add_member', { p_academy_id: academyId, p_email: staff.email, p_role: 'instructor' });
assert.equal(r.error, null, 'gestor cadastra colaborador');
r = await staff.client.rpc('add_member', { p_academy_id: academyId, p_email: other.email, p_role: 'student' });
assert.equal(r.error?.code, '42501', 'instrutor não cadastra');
r = await manager.client.rpc('add_member', { p_academy_id: academyId, p_email: 'naoexiste@example.test', p_role: 'student' });
assert.equal(r.error?.code, 'P0002', 'e-mail sem conta');

r = await manager.client.rpc('end_membership', { p_membership_id: membershipId, p_reason: 'saiu' });
assert.equal(r.error, null, 'gestor encerra vínculo');
r = await student.client.rpc('request_membership', { p_academy_id: academyId });
assert.equal(r.error, null, 'encerrado pode pedir de novo');

r = await manager.client.from('audit_events').select('action').eq('academy_id', academyId);
const actions = new Set(r.data.map((e) => e.action));
for (const a of ['membership.request', 'membership.decide', 'membership.add', 'membership.end']) {
  assert(actions.has(a), `auditoria registra ${a}`);
}

console.log('smoke-membership: OK');
