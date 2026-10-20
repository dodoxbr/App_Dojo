// Smoke test of US-005 against the LOCAL Supabase: imported catalog, accent-insensitive search,
// academy techniques, aliases and review.
// Usage: SUPABASE_URL=... SUPABASE_ANON_KEY=... node scripts/smoke-catalog.mjs
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
const outsider = await newUser('externo');
execFileSync('node', ['scripts/make-platform-admin.mjs', admin.email], { stdio: 'pipe' });

assert.equal((await admin.client.rpc('grant_academy_creator', { p_email: manager.email })).error, null);
const created = await manager.client.rpc('create_academy', {
  p_name: 'Academia Catálogo', p_slug: `catalogo-${run}`, p_idempotency_key: crypto.randomUUID(),
});
assert.equal(created.error, null);
const academyId = created.data;
assert.equal((await manager.client.rpc('add_member', { p_academy_id: academyId, p_email: student.email, p_role: 'student' })).error, null);

// Imported catalog is visible to everyone signed in, even without an academy.
let r = await outsider.client.rpc('search_techniques', { p_query: 'SAÍDA de quadril' });
assert.equal(r.data?.[0]?.name, 'Saída de Quadril', 'busca sem acento/caixa encontra a técnica importada');
r = await outsider.client.rpc('search_techniques', { p_category: 'Fundamentos', p_limit: 100 });
assert.equal(r.data?.length, 10, '10 técnicas de Fundamentos');
r = await outsider.client.from('technique_sources').select('id');
assert.equal(r.data?.length ?? 0, 0, 'proveniência restrita ao super admin');

// Academy technique: manager creates, member sees, outsider does not.
r = await manager.client.rpc('create_technique', {
  p_academy_id: academyId, p_name: 'Raspagem da Casa', p_category: 'Raspagens', p_level: 'Básico',
  p_description: 'Variação sintética da academia', p_idempotency_key: crypto.randomUUID(),
});
assert.equal(r.error, null, 'gestor cria técnica da academia');
const techniqueId = r.data;

r = await manager.client.rpc('add_technique_alias', { p_technique_id: techniqueId, p_alias: 'Sweep da Casa' });
assert.equal(r.error, null, 'gestor cadastra sinônimo');

r = await student.client.rpc('search_techniques', { p_query: 'sweep da casa' });
assert.equal(r.data?.[0]?.id, techniqueId, 'aluno aprovado encontra pelo sinônimo');
assert.equal(r.data?.[0]?.matched_alias, 'Sweep da Casa');
r = await outsider.client.rpc('search_techniques', { p_query: 'raspagem da casa' });
assert.equal(r.data?.length, 0, 'quem não é da academia não vê a técnica');

r = await student.client.rpc('create_technique', {
  p_academy_id: academyId, p_name: 'Do Aluno', p_category: 'Teste', p_level: null, p_description: null,
  p_idempotency_key: crypto.randomUUID(),
});
assert.equal(r.error?.code, '42501', 'aluno não cadastra técnica');
r = await student.client.rpc('review_technique', { p_technique_id: techniqueId });
assert.equal(r.error?.code, '42501', 'aluno não revisa');

// Global content: only the platform admin edits it; editing invalidates the review.
// Never mutate the imported seed: the smoke test creates its own global technique.
const importedId = (await outsider.client.rpc('search_techniques', { p_query: 'Tesoura' })).data[0].id;
r = await admin.client.rpc('create_technique', {
  p_academy_id: null, p_name: `Global Smoke ${run}`, p_category: 'Teste', p_level: null, p_description: null,
  p_idempotency_key: crypto.randomUUID(), p_type: null, p_position: null,
});
assert.equal(r.error, null, 'super admin cria técnica global');
const globalId = r.data;
r = await manager.client.rpc('update_technique', { p_technique_id: globalId, p_name: 'Hack', p_category: 'Raspagens', p_level: null, p_description: null });
assert.equal(r.error?.code, '42501', 'gestor não edita técnica global');
r = await admin.client.rpc('update_technique', { p_technique_id: globalId, p_name: `Global Smoke ${run}`, p_category: 'Teste', p_level: 'Básico', p_description: 'Descrição sintética', p_type: 'Raspagem', p_position: 'Guarda fechada' });
assert.equal(r.error, null, 'super admin edita técnica global');
r = await admin.client.from('techniques').select('reviewed_at').eq('id', globalId).single();
assert.equal(r.data.reviewed_at, null, 'edição invalida a revisão');
assert.equal((await admin.client.rpc('review_technique', { p_technique_id: globalId })).error, null, 'super admin revisa');

r = await admin.client.from('technique_sources').select('sheet').eq('technique_id', importedId);
assert((r.data?.length ?? 0) >= 1, 'super admin lê a proveniência');

console.log('smoke-catalog: OK');
