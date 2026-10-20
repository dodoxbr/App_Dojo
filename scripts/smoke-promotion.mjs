// Smoke test of US-011 against the LOCAL Supabase: granting a promotion, history and rectification.
// All belt names and numbers are FICTITIOUS test data. The system recommends; only the manager decides.
// Usage: SUPABASE_URL=... SUPABASE_ANON_KEY=... node scripts/smoke-promotion.mjs
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
  p_name: 'Academia Promoções', p_slug: `promocoes-${run}`, p_idempotency_key: crypto.randomUUID(),
})).data;
for (const [u, role] of [[teacher, 'instructor'], [alice, 'student'], [bob, 'student']]) {
  assert.equal((await manager.client.rpc('add_member', { p_academy_id: academyId, p_email: u.email, p_role: role })).error, null);
}
assert.equal((await manager.client.rpc('set_instructor_permission', { p_academy_id: academyId, p_permission: 'recommend_graduation', p_granted: true })).error, null);

// The academy's own rules (fictitious): leaving "Faixa Teste A / 1" needs 5 days; "Faixa Teste A / 2" needs a manual OK.
const rule = (degree, criteria) => manager.client.rpc('create_promotion_rule', {
  p_academy_id: academyId, p_belt_code: 'Faixa Teste A', p_degree: degree, p_title: null, p_effective_from: localDate(60),
  p_criteria: criteria, p_idempotency_key: crypto.randomUUID(),
});
assert.equal((await rule(1, [{ kind: 'min_days', label: 'Tempo (teste)', min_days: 5 }])).error, null);
assert.equal((await rule(2, [{ kind: 'manual', label: 'Comprometimento' }])).error, null);

const initial = (who, daysAgo) => manager.client.rpc('register_initial_rank', {
  p_academy_id: academyId, p_user_id: who.id, p_belt_code: 'Faixa Teste A', p_degree: 1, p_effective_date: localDate(daysAgo),
  p_reason: null, p_idempotency_key: crypto.randomUUID(),
});
assert.equal((await initial(alice, 20)).error, null);
assert.equal((await initial(bob, 1)).error, null);

const evaluate = (u, who) => u.client.rpc('evaluate_promotion', { p_academy_id: academyId, p_user_id: who.id });
let r = await evaluate(alice, alice);
assert.equal(r.data.eligible, true, 'a aluna é elegível (recomendação)');
r = await manager.client.from('promotions').select('id').eq('user_id', alice.id);
assert.equal(r.data.length, 1, 'ser elegível não promove');

const grant = (u, who, { belt = 'Faixa Teste A', degree = 2, date = localDate(0), reason = 'avaliação do gestor (teste)', key = crypto.randomUUID() } = {}) =>
  u.client.rpc('grant_promotion', {
    p_academy_id: academyId, p_user_id: who.id, p_belt_code: belt, p_degree: degree, p_effective_date: date, p_reason: reason, p_idempotency_key: key,
  });

// Only the manager grants; nobody promotes themselves.
assert.equal((await grant(teacher, alice)).error?.code, '42501', 'instrutor não concede, mesmo com recommend_graduation');
assert.equal((await grant(alice, alice)).error?.code, '42501', 'aluna não se promove');
assert.equal((await grant(outsider, alice)).error?.code, '42501', 'externo não concede');
assert.equal((await grant(manager, alice, { reason: 'ok' })).error?.code, '22023', 'justificativa obrigatória');
assert.equal((await grant(manager, alice, { degree: 1 })).error?.code, '22023', 'destino igual ao atual');
assert.equal((await grant(manager, outsider)).error?.code, '22023', 'quem não é membro não é promovido');
assert.equal((await manager.client.rpc('register_initial_rank', {
  p_academy_id: academyId, p_user_id: manager.id, p_belt_code: 'Faixa Teste Z', p_degree: 1, p_effective_date: localDate(100),
  p_reason: null, p_idempotency_key: crypto.randomUUID(),
})).error, null, 'o mestre registra a própria graduação atual');
assert.equal((await grant(manager, manager, { belt: 'Faixa Teste Z', degree: 2, reason: 'o mestre se gradua (teste)' })).error, null, 'o mestre se gradua');

const key = crypto.randomUUID();
r = await grant(manager, alice, { key });
assert.equal(r.error, null, 'gestor concede a graduação');
const promotionId = r.data;
assert.equal((await grant(manager, alice, { key })).data, promotionId, 'concessão idempotente');
assert.equal((await grant(manager, alice, { key, degree: 7 })).error?.code, '22023', 'mesma chave com outro destino é rejeitada');

r = await alice.client.from('current_ranks').select('belt_code, degree').eq('user_id', alice.id).single();
assert.deepEqual(r.data, { belt_code: 'Faixa Teste A', degree: 2 }, 'a graduação atual é a nova');
r = await evaluate(alice, alice);
assert.equal(r.data.rank.degree, 2, 'a avaliação passa a usar a nova graduação');
assert.equal(r.data.criteria[0].kind, 'manual', 'e a regra do novo ponto de partida');
assert.equal(r.data.eligible, false, 'a contagem recomeça: falta o critério manual');

// A promotion without recommendation is the manager's call, and the audit shows it.
assert.equal((await grant(manager, bob)).error, null, 'gestor concede mesmo sem recomendação');
r = await manager.client.from('audit_events').select('metadata').eq('academy_id', academyId).eq('action', 'promotion.grant');
const byUser = new Map(r.data.map((e) => [e.metadata.user_id, e.metadata]));
assert.equal(byUser.get(alice.id).recommended_at_grant, true, 'auditoria: havia recomendação para a aluna');
assert.equal(byUser.get(bob.id).recommended_at_grant, false, 'auditoria: NÃO havia recomendação para o aluno');
assert.equal(byUser.get(alice.id).from.degree, 1, 'auditoria guarda a graduação anterior');

// Rectification: a new event; history is kept.
const correct = (u, id, over = {}) => u.client.rpc('correct_promotion', {
  p_promotion_id: id, p_belt_code: 'Faixa Teste B', p_degree: 0, p_effective_date: localDate(0), p_reason: 'faixa digitada errada (teste)',
  p_idempotency_key: crypto.randomUUID(), ...over,
});
assert.equal((await correct(teacher, promotionId)).error?.code, '42501', 'instrutor não retifica');
assert.equal((await correct(alice, promotionId)).error?.code, '42501', 'aluna não retifica a própria graduação');
assert.equal((await correct(manager, promotionId, { p_reason: 'x' })).error?.code, '22023', 'retificação exige motivo');
r = await correct(manager, promotionId);
assert.equal(r.error, null, 'gestor retifica');
assert.equal((await correct(manager, promotionId)).error?.code, '23505', 'o mesmo registro não é retificado duas vezes');

r = await alice.client.from('current_ranks').select('belt_code, degree, event_type').eq('user_id', alice.id).single();
assert.deepEqual(r.data, { belt_code: 'Faixa Teste B', degree: 0, event_type: 'correction' }, 'vale a retificação');
r = await alice.client.from('promotions').select('id').eq('user_id', alice.id);
assert.equal(r.data.length, 3, 'o histórico completo permanece (inicial, promoção, retificação)');
r = await bob.client.from('promotions').select('id').eq('user_id', alice.id);
assert.equal(r.data?.length ?? 0, 0, 'outro aluno não vê o histórico dela');
r = await alice.client.from('promotions').update({ degree: 9 }).eq('id', promotionId).select();
assert(r.error || r.data.length === 0, 'histórico não é editável por clientes');
r = await alice.client.from('promotions').delete().eq('id', promotionId).select();
assert(r.error || r.data.length === 0, 'histórico não é apagável por clientes');

const actions = new Set((await manager.client.from('audit_events').select('action').eq('academy_id', academyId)).data.map((e) => e.action));
for (const a of ['promotion.grant', 'promotion.correct', 'rank.initial', 'promotion_rule.create']) assert(actions.has(a), `auditoria registra ${a}`);

console.log('smoke-promotion: OK');
