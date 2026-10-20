// Smoke test of US-003 against the LOCAL Supabase: super admin -> creator -> academy -> theme/permissions.
// Usage: SUPABASE_URL=... SUPABASE_ANON_KEY=... node scripts/smoke-academy.mjs
// Uses the anon key and synthetic accounts; confirmation mails come from local Mailpit.
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
  const up = await client.auth.signUp({ email, password, options: { data: { display_name: `Smoke ${label}` } } });
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
const creator = await newUser('criador');
const student = await newUser('aluno');

// Bootstrap the first super admin by SQL on the local DB (never through the app).
execFileSync('node', ['scripts/make-platform-admin.mjs', admin.email], { stdio: 'pipe' });

const slug = `smoke-${run}`;
const key = crypto.randomUUID();

let r = await creator.client.rpc('create_academy', { p_name: 'Academia Smoke', p_slug: slug, p_idempotency_key: key });
assert.equal(r.error?.code, '42501', 'criador não liberado não cria academia');

r = await student.client.rpc('grant_academy_creator', { p_email: student.email });
assert.equal(r.error?.code, '42501', 'aluno não libera criador');

r = await admin.client.rpc('grant_academy_creator', { p_email: creator.email });
assert.equal(r.error, null, 'super admin libera criador');

r = await creator.client.rpc('create_academy', { p_name: 'Academia Smoke', p_slug: slug, p_idempotency_key: key });
assert.equal(r.error, null, 'criador cria academia');
const academyId = r.data;

r = await creator.client.rpc('create_academy', { p_name: 'Academia Smoke', p_slug: slug, p_idempotency_key: key });
assert.equal(r.data, academyId, 'idempotente');

r = await creator.client.rpc('update_academy_settings', {
  p_academy_id: academyId, p_name: 'Academia Smoke', p_theme_primary: '#163A64', p_theme_secondary: '#FFFFFF',
});
assert.equal(r.error, null, 'gestor altera o tema');

r = await creator.client.rpc('update_academy_settings', {
  p_academy_id: academyId, p_name: 'Academia Smoke', p_theme_primary: '#777777', p_theme_secondary: '#888888',
});
assert.equal(r.error?.code, '22023', 'contraste insuficiente rejeitado');

r = await student.client.rpc('update_academy_settings', {
  p_academy_id: academyId, p_name: 'Invasão', p_theme_primary: '#163A64', p_theme_secondary: '#FFFFFF',
});
assert.equal(r.error?.code, '42501', 'aluno não altera tema');

r = await student.client.from('academies').update({ name: 'Invasão' }).eq('id', academyId);
assert(r.error, 'sem UPDATE direto em academies');

r = await student.client.from('audit_events').select('id');
assert.equal(r.data?.length ?? 0, 0, 'aluno não lê auditoria');

r = await creator.client.rpc('set_instructor_permission', { p_academy_id: academyId, p_permission: 'assess_skills', p_granted: true });
assert.equal(r.error, null, 'gestor habilita permissão do instrutor');
r = await creator.client.rpc('set_instructor_permission', { p_academy_id: academyId, p_permission: 'read_diary', p_granted: true });
assert.equal(r.error?.code, '22023', 'diário não é permissão liberável');

r = await creator.client.from('audit_events').select('action').eq('academy_id', academyId);
assert(r.data.length >= 3, 'gestor lê a auditoria da própria academia');

r = await admin.client.rpc('revoke_academy_creator', { p_user_id: creator.id });
assert.equal(r.error, null, 'super admin revoga');
r = await creator.client.rpc('create_academy', { p_name: 'Segunda', p_slug: `${slug}-2`, p_idempotency_key: crypto.randomUUID() });
assert.equal(r.error?.code, '42501', 'criador revogado não cria novas academias');

console.log('smoke-academy: OK');
