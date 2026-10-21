// Smoke test of US-006 against the LOCAL Supabase: private diary, atomic save, admin test-phase switch.
// Usage: SUPABASE_URL=... SUPABASE_ANON_KEY=... node scripts/smoke-diary.mjs
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
  // Registration form (US-016) is required to join an academy; synthetic data.
  const ficha = await client.rpc('save_contact', {
    p_user_id: inn.data.user.id, p_full_name: `Smoke ${label}`, p_phone: '(11) 99999-0000', p_postal_code: '01001-000',
    p_street: 'Rua Ficticia', p_number: '1', p_complement: null, p_neighborhood: 'Centro', p_city: 'Sao Paulo', p_state: 'SP',
  });
  assert.equal(ficha.error, null, `ficha de ${label}`);
  return { client, email, id: inn.data.user.id };
}

const switchDiaryAccess = (mode) => execFileSync('node', ['scripts/set-admin-diary-access.mjs', mode], { stdio: 'pipe' });

const admin = await newUser('admin');
const manager = await newUser('gestor');
const alice = await newUser('aluna');
const bob = await newUser('aluno');
const outsider = await newUser('externo');
execFileSync('node', ['scripts/make-platform-admin.mjs', admin.email], { stdio: 'pipe' });

assert.equal((await admin.client.rpc('grant_academy_creator', { p_email: manager.email })).error, null);
const created = await manager.client.rpc('create_academy', {
  p_name: 'Academia Diário', p_slug: `diario-${run}`, p_idempotency_key: crypto.randomUUID(),
});
assert.equal(created.error, null);
const academyId = created.data;
for (const u of [alice, bob]) {
  assert.equal((await manager.client.rpc('add_member', { p_academy_id: academyId, p_email: u.email, p_role: 'student' })).error, null);
}

const tesoura = (await alice.client.rpc('search_techniques', { p_query: 'Tesoura' })).data[0].id;
const key = crypto.randomUUID();
const save = (client, extra = {}) =>
  client.rpc('save_training_log', {
    p_academy_id: academyId, p_trained_at: '2026-10-19T12:00:00Z', p_notes: 'rolei bem hoje',
    p_technique_ids: [tesoura], p_client_key: key, ...extra,
  });

try {
  switchDiaryAccess('on');

  let r = await save(alice.client);
  assert.equal(r.error, null, 'aluna salva registro');
  const logId = r.data;
  r = await save(alice.client);
  assert.equal(r.data, logId, 'repetir a mesma chave é idempotente');

  r = await alice.client.from('training_logs').select('id').eq('user_id', alice.id);
  assert.equal(r.data.length, 1, 'um único registro');
  r = await alice.client.from('training_log_techniques').select('technique_id').eq('log_id', logId);
  assert.deepEqual(r.data.map((x) => x.technique_id), [tesoura], 'técnica vinculada');

  // Privacy: nobody else sees it.
  for (const [who, u] of [['colega da mesma academia', bob], ['gestor', manager], ['usuário externo', outsider]]) {
    r = await u.client.from('training_logs').select('id');
    assert.equal(r.data?.length ?? 0, 0, `${who} não lê o diário`);
    r = await u.client.from('training_log_techniques').select('log_id');
    assert.equal(r.data?.length ?? 0, 0, `${who} não lê os vínculos`);
  }
  r = await bob.client.rpc('save_training_log', {
    p_academy_id: null, p_trained_at: '2026-10-19T12:00:00Z', p_notes: 'invasão', p_technique_ids: [],
    p_client_key: crypto.randomUUID(), p_log_id: logId,
  });
  assert.equal(r.error?.code, 'P0002', 'não edita registro alheio');
  r = await bob.client.from('training_logs').delete().eq('id', logId).select();
  assert.equal(r.data?.length ?? 0, 0, 'não exclui registro alheio');

  // Atomicity: a technique outside the caller's reach aborts the whole save.
  const foreign = (await manager.client.rpc('create_technique', {
    p_academy_id: academyId, p_name: `Interna ${run}`, p_category: 'Teste', p_level: null, p_description: null,
    p_idempotency_key: crypto.randomUUID(), p_type: null, p_position: null,
  })).data;
  r = await outsider.client.rpc('save_training_log', {
    p_academy_id: null, p_trained_at: '2026-10-19T12:00:00Z', p_notes: 'x', p_technique_ids: [foreign],
    p_client_key: crypto.randomUUID(),
  });
  assert.equal(r.error?.code, '42501', 'técnica de outra academia não pode ser vinculada');
  r = await outsider.client.from('training_logs').select('id');
  assert.equal(r.data?.length ?? 0, 0, 'falha desfaz o registro inteiro');

  // Test-phase switch for the platform admin.
  r = await admin.client.from('training_logs').select('id, notes').eq('id', logId);
  assert.equal(r.data?.length, 1, 'super admin lê o diário com a chave ligada');
  switchDiaryAccess('off');
  r = await admin.client.from('training_logs').select('id').eq('id', logId);
  assert.equal(r.data?.length ?? 0, 0, 'com a chave desligada o super admin não lê');
  r = await alice.client.from('training_logs').select('id').eq('id', logId);
  assert.equal(r.data?.length, 1, 'a dona continua lendo');
  r = await admin.client.from('platform_settings').update({ admin_diary_access: true }).eq('id', true).select();
  assert(r.error || r.data.length === 0, 'super admin não religa pelo app');
} finally {
  switchDiaryAccess('on'); // restore the test-phase default
}

console.log('smoke-diary: OK');
