// Smoke test of US-009 against the LOCAL Supabase: trail (curriculum) and skill mastery.
// Usage: SUPABASE_URL=... SUPABASE_ANON_KEY=... node scripts/smoke-curriculum.mjs
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
const manager = await newUser('gestor');
const teacher = await newUser('professor');
const plainTeacher = await newUser('professor2');
const alice = await newUser('aluna');
const bob = await newUser('aluno');
const outsider = await newUser('externo');
execFileSync('node', ['scripts/make-platform-admin.mjs', admin.email], { stdio: 'pipe' });

assert.equal((await admin.client.rpc('grant_academy_creator', { p_email: manager.email })).error, null);
const academyId = (await manager.client.rpc('create_academy', {
  p_name: 'Academia Trilha', p_slug: `trilha-${run}`, p_idempotency_key: crypto.randomUUID(),
})).data;
for (const [u, role] of [[teacher, 'instructor'], [plainTeacher, 'instructor'], [alice, 'student'], [bob, 'student']]) {
  assert.equal((await manager.client.rpc('add_member', { p_academy_id: academyId, p_email: u.email, p_role: role })).error, null);
}

// The manager builds the trail from the imported catalog.
let r = await teacher.client.rpc('create_curriculum', { p_academy_id: academyId, p_title: 'X', p_level: null, p_idempotency_key: crypto.randomUUID() });
assert.equal(r.error?.code, '42501', 'instrutor não cria currículo');
r = await manager.client.rpc('create_curriculum', { p_academy_id: academyId, p_title: 'Faixa Branca', p_level: 'Básico', p_idempotency_key: crypto.randomUUID() });
assert.equal(r.error, null, 'gestor cria o currículo');
const curriculumId = r.data;
r = await manager.client.rpc('add_curriculum_items_from_level', { p_curriculum_id: curriculumId, p_level: 'Básico' });
assert.equal(r.data, 46, 'atalho adiciona as 46 técnicas do nível Básico');
r = await manager.client.rpc('add_curriculum_items_from_level', { p_curriculum_id: curriculumId, p_level: 'Básico' });
assert.equal(r.data, 0, 'repetir o atalho não duplica');

// Everyone approved reads the trail; outsiders do not.
r = await alice.client.from('curriculum_items').select('technique_id').eq('curriculum_id', curriculumId);
assert.equal(r.data.length, 46, 'aluna lê a trilha');
r = await outsider.client.from('curriculum_items').select('technique_id');
assert.equal(r.data?.length ?? 0, 0, 'externo não lê a trilha');

const tesoura = (await alice.client.rpc('search_techniques', { p_query: 'Tesoura', p_limit: 1 })).data[0].id;
const outOfTrail = (await alice.client.rpc('search_techniques', { p_query: 'Chave Botinha', p_limit: 1 })).data[0].id; // Avançado only

// The student declares progress, but never "validated" and not outside the trail.
r = await alice.client.rpc('declare_skill', { p_academy_id: academyId, p_technique_id: tesoura, p_status: 'studied' });
assert.equal(r.data, 'studied', 'aluna declara que estudou');
r = await alice.client.rpc('declare_skill', { p_academy_id: academyId, p_technique_id: tesoura, p_status: 'validated' });
assert.equal(r.error?.code, '22023', 'aluna não declara validated');
r = await alice.client.rpc('declare_skill', { p_academy_id: academyId, p_technique_id: outOfTrail, p_status: 'studied' });
assert.equal(r.error?.code, '22023', 'técnica fora da trilha não aceita progresso');
r = await outsider.client.rpc('declare_skill', { p_academy_id: academyId, p_technique_id: tesoura, p_status: 'studied' });
assert.equal(r.error?.code, '42501', 'externo não declara progresso');
r = await alice.client.from('skill_assessments').update({ status: 'validated' }).eq('technique_id', tesoura).select();
assert(r.error || r.data.length === 0, 'aluna não se valida por UPDATE');

// Teachers: only with assess_skills (the manager decides).
const assess = (u, who, status, note = null, key = crypto.randomUUID()) =>
  u.client.rpc('assess_skill', { p_academy_id: academyId, p_user_id: who.id, p_technique_id: tesoura, p_status: status, p_note: note, p_idempotency_key: key });
assert.equal((await assess(teacher, alice, 'validated')).error?.code, '42501', 'instrutor sem a permissão não avalia');
r = await plainTeacher.client.from('skill_assessments').select('user_id');
assert.equal(r.data?.length ?? 0, 0, 'instrutor sem permissão não vê o progresso');
assert.equal((await manager.client.rpc('set_instructor_permission', { p_academy_id: academyId, p_permission: 'assess_skills', p_granted: true })).error, null);
const key = crypto.randomUUID();
r = await assess(teacher, alice, 'validated', 'controle excelente', key);
assert.equal(r.data, 'validated', 'instrutor com a permissão valida o domínio');
assert.equal((await assess(teacher, alice, 'validated', 'controle excelente', key)).data, 'validated', 'avaliação idempotente');
assert.equal((await assess(teacher, teacher, 'validated')).error?.code, '42501', 'ninguém valida a si mesmo');
assert.equal((await assess(teacher, outsider, 'studied')).error?.code, '22023', 'não avalia quem não é membro');
assert.equal((await assess(alice, bob, 'validated')).error?.code, '42501', 'aluno não avalia ninguém');

r = await alice.client.rpc('declare_skill', { p_academy_id: academyId, p_technique_id: tesoura, p_status: 'studied' });
assert.equal(r.error?.code, '23505', 'aluna não sobrescreve a validação do professor');
assert.equal((await assess(teacher, alice, 'practicing')).error?.code, '22023', 'tirar a validação exige motivo');
assert.equal((await assess(teacher, alice, 'practicing', 'precisa repetir a base')).data, 'practicing', 'com motivo a validação sai');

// Privacy of progress.
r = await bob.client.from('skill_assessments').select('user_id');
assert.equal(r.data?.length ?? 0, 0, 'aluno não vê o progresso de outro');
r = await teacher.client.from('skill_assessments').select('user_id, status, status_source').eq('user_id', alice.id);
assert.equal(r.data.length, 1, 'instrutor com a permissão vê o progresso');
assert.equal(r.data[0].status_source, 'teacher');
// The permission matrix is per ROLE: after the manager grants it, every instructor of the academy has it.
r = await plainTeacher.client.from('skill_assessments').select('user_id');
assert.equal(r.data.length, 1, 'a permissão vale para o papel instrutor (todos os instrutores da academia)');

// Mastery is independent of attendance.
r = await manager.client.from('attendances').select('id').eq('academy_id', academyId);
assert.equal(r.data?.length ?? 0, 0, 'avaliar domínio não cria presença');

// Removing the technique from the trail / deactivating it.
const item = (await manager.client.from('curriculum_items').select('id').eq('curriculum_id', curriculumId).eq('technique_id', tesoura).single()).data.id;
assert.equal((await manager.client.rpc('set_curriculum_item_required', { p_item_id: item, p_required: false })).error, null);
assert.equal((await manager.client.rpc('update_curriculum', { p_curriculum_id: curriculumId, p_title: 'Faixa Branca', p_level: 'Básico', p_is_active: false })).error, null);
r = await bob.client.rpc('declare_skill', { p_academy_id: academyId, p_technique_id: tesoura, p_status: 'studied' });
assert.equal(r.error?.code, '22023', 'currículo inativo não recebe progresso');

const actions = new Set((await manager.client.from('audit_events').select('action').eq('academy_id', academyId)).data.map((e) => e.action));
for (const a of ['curriculum.create', 'curriculum.items_from_level', 'curriculum.item_required', 'curriculum.update', 'skill.assess']) {
  assert(actions.has(a), `auditoria registra ${a}`);
}

console.log('smoke-curriculum: OK');
