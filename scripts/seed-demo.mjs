// Dados de DEMONSTRAÇÃO (todos fictícios) no Supabase LOCAL, para apresentar o Dojo Platform no computador: uma academia com gestor,
// professores, alunos, um responsável com menor, turmas, aulas passadas e futuras, presenças validadas, graduações de TESTE,
// trilha, financeiro manual, feed com fotos geradas, reações, comentários, desafio, diário e medalhas.
// Tudo pelas operações reais do sistema (RLS e regras valendo); só o histórico de aulas e presenças vai direto no banco local.
// Seguro por construção: só roda contra 127.0.0.1/localhost. Não repete: se a academia de demonstração já existe, avisa e sai.
// Uso: SUPABASE_ANON_KEY=... node scripts/seed-demo.mjs
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';
import { localDate, localEnv, makePlatformAdmin, saveContact } from './lib/local.mjs';

const { url, anonKey, mailpit } = localEnv();
export const DEMO_PASSWORD = 'demo-senha-123';
const SLUG = 'demo-ficticia';
const key = () => crypto.randomUUID();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function confirmLink(email) {
  for (let i = 0; i < 40; i++) {
    const list = await (await fetch(`${mailpit}/api/v1/search?query=to:${encodeURIComponent(email)}`)).json();
    for (const m of list.messages ?? []) {
      const msg = await (await fetch(`${mailpit}/api/v1/message/${m.ID}`)).json();
      const link = /https?:\/\/[^\s"'<>]*verify[^\s"'<>]*type=signup[^\s"'<>]*/.exec(`${msg.HTML} ${msg.Text}`)?.[0];
      if (link) return link.replaceAll('&amp;', '&');
    }
    await sleep(400);
  }
  throw new Error(`e-mail de confirmação de ${email} não chegou`);
}

// Conta fictícia com e-mail fixo demo-<rótulo>@example.test e a senha de demonstração; entra se já existir.
async function demoUser(label, displayName, birthDate = '1990-01-01', withContact = true) {
  const email = `demo-${label}@example.test`;
  const client = createClient(url, anonKey, { auth: { persistSession: false } });
  let signed = await client.auth.signInWithPassword({ email, password: DEMO_PASSWORD });
  if (signed.error) {
    const up = await client.auth.signUp({ email, password: DEMO_PASSWORD, options: { data: { display_name: displayName, birth_date: birthDate } } });
    assert.equal(up.error, null, `cadastro de ${label}`);
    await fetch(await confirmLink(email), { redirect: 'manual' });
    signed = await client.auth.signInWithPassword({ email, password: DEMO_PASSWORD });
    assert.equal(signed.error, null, `entrada de ${label}`);
  }
  const id = signed.data.user.id;
  if (withContact) assert.equal((await saveContact(client, id, displayName, label === 'a3' ? 'Lesão antiga no joelho direito (dado fictício)' : null)).error, null, `ficha de ${label}`);
  return { client, email, id, name: displayName };
}

const sql = (text) => execFileSync('docker', ['exec', '-i', 'supabase_db_dojo-platform-local', 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q', '-f', '-'], { input: text, encoding: 'utf8' });

// Foto fictícia (gradiente e texto, sem pessoas reais) como JPEG, entregue ao banco pela operação de postagem
async function demoPhoto(title, hue) {
  const svg = `<svg width="960" height="720" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hue},55%,32%)"/><stop offset="1" stop-color="hsl(${(hue + 40) % 360},60%,18%)"/></linearGradient></defs><rect width="960" height="720" fill="url(#g)"/><text x="480" y="340" font-family="Arial" font-size="64" font-weight="700" fill="#fff" text-anchor="middle">${title}</text><text x="480" y="410" font-family="Arial" font-size="30" fill="#ffffffb3" text-anchor="middle">imagem fictícia de demonstração</text></svg>`;
  const jpeg = await sharp(Buffer.from(svg)).jpeg({ quality: 70 }).toBuffer();
  assert(jpeg.length < 800_000);
  return { hex: `\\x${jpeg.toString('hex')}`, w: 960, h: 720 };
}

console.log('Criando as contas fictícias…');
const dono = await demoUser('dono', 'Dono da Plataforma (demo)', '1980-01-01', false);
const gestor = await demoUser('gestor', 'Mestre Rafael Lima (demo)', '1978-03-10');
const prof1 = await demoUser('prof1', 'Professora Camila Reis (demo)', '1988-07-21');
const prof2 = await demoUser('prof2', 'Professor Diego Costa (demo)', '1991-11-02');
const nomes = ['Ana Souza', 'Bruno Alves', 'Carla Mendes', 'Daniel Rocha', 'Eduarda Lima', 'Felipe Nunes', 'Gabriela Dias', 'Henrique Prado'];
const alunos = [];
for (const [i, n] of nomes.entries()) alunos.push(await demoUser(`a${i + 1}`, `${n} (demo)`, `${1985 + i}-0${(i % 9) + 1}-1${i % 9}`));
const [ana, bruno, carla, daniel, eduarda, felipe, gabriela, henrique] = alunos;
const responsavel = await demoUser('responsavel', 'Marcos Pereira (demo)', '1982-05-05');

makePlatformAdmin(dono.email);
assert.equal((await dono.client.rpc('grant_academy_creator', { p_email: gestor.email })).error, null);

const existing = await gestor.client.from('academies').select('id').eq('slug', SLUG).maybeSingle();
if (existing.data) {
  console.log(`\nA academia de demonstração já existe (${existing.data.id}). Nada foi duplicado.\nContas: demo-<papel>@example.test, senha ${DEMO_PASSWORD}.`);
  process.exit(0);
}

console.log('Academia, equipe e alunos…');
const academyId = (await gestor.client.rpc('create_academy', { p_name: 'Academia Demo (fictícia)', p_slug: SLUG, p_idempotency_key: key() })).data;
assert(academyId, 'academia criada');
assert.equal((await gestor.client.rpc('set_academy_legal', { p_academy_id: academyId, p_legal_name: 'Academia Demo Ltda (fictícia)', p_cnpj: '11.222.333/0001-81' })).error, null);
for (const p of [prof1, prof2]) assert.equal((await gestor.client.rpc('add_member', { p_academy_id: academyId, p_email: p.email, p_role: 'instructor' })).error, null);
for (const perm of ['validate_attendance', 'recommend_graduation', 'assess_skills', 'view_progress', 'view_roster']) {
  assert.equal((await gestor.client.rpc('set_instructor_permission', { p_academy_id: academyId, p_permission: perm, p_granted: true })).error, null);
}
for (const a of alunos) {
  const req = await a.client.rpc('request_membership', { p_academy_id: academyId });
  assert.equal(req.error, null, `pedido de ${a.name}`);
  assert.equal((await gestor.client.rpc('decide_membership', { p_membership_id: req.data, p_decision: 'approved', p_reason: null, p_idempotency_key: key() })).data, 'approved');
}

console.log('Responsável e menor…');
const minorId = (await responsavel.client.rpc('create_dependent', { p_display_name: 'Pedro Pereira (demo)', p_birth_date: localDate(365 * 9 + 60), p_relationship: 'pai', p_idempotency_key: key() })).data;
assert(minorId, 'menor criado');
assert.equal((await saveContact(responsavel.client, minorId, 'Pedro Pereira (demo)')).error, null);
const minorReq = await responsavel.client.rpc('request_dependent_membership', { p_minor_id: minorId, p_academy_id: academyId, p_photos: true });
assert(minorReq.data, 'vaga do menor pedida');
const consent = ((await gestor.client.rpc('list_academy_guardian_consents', { p_academy_id: academyId })).data ?? [])[0];
assert(consent, 'consentimento listado');
assert.equal((await gestor.client.rpc('verify_guardian_consent', { p_consent_id: consent.id, p_document_checked: true, p_note: 'conferido (demonstração)' })).error, null);
assert.equal((await gestor.client.rpc('decide_membership', { p_membership_id: minorReq.data, p_decision: 'approved', p_reason: null, p_idempotency_key: key() })).data, 'approved');

console.log('Turmas, aulas e presenças (histórico de 50 dias)…');
const classes = {};
for (const [title, teacher] of [['Fundamentos (demo)', prof1], ['Avançado (demo)', prof2]]) {
  classes[title] = (await gestor.client.rpc('create_class', { p_academy_id: academyId, p_title: title, p_instructor_user_id: teacher.id, p_idempotency_key: key() })).data;
  assert(classes[title], `turma ${title}`);
}
const [c1, c2] = [classes['Fundamentos (demo)'], classes['Avançado (demo)']];
const ids = alunos.map((a) => a.id);
const pct = [100, 80, 65, 55, 45, 35, 25, 15]; // frequência de cada aluno (Ana vai a todas as aulas)
sql(`
insert into public.sessions (id, academy_id, class_id, starts_at, ends_at)
select gen_random_uuid(), '${academyId}', '${c1}', ((d::date + time '19:00') at time zone 'America/Sao_Paulo'), ((d::date + time '20:00') at time zone 'America/Sao_Paulo')
from generate_series(current_date - 50, current_date + 14, interval '1 day') d where extract(isodow from d) between 1 and 5;
insert into public.sessions (id, academy_id, class_id, starts_at, ends_at)
select gen_random_uuid(), '${academyId}', '${c2}', ((d::date + time '20:15') at time zone 'America/Sao_Paulo'), ((d::date + time '21:15') at time zone 'America/Sao_Paulo')
from generate_series(current_date - 50, current_date + 14, interval '1 day') d where extract(isodow from d) in (2, 4);
insert into public.attendances (academy_id, session_id, user_id, source, status, validated_by, validated_at)
select '${academyId}', s.id, u.id, 'teacher', 'validated', case when s.class_id = '${c1}' then '${prof1.id}'::uuid else '${prof2.id}'::uuid end, s.starts_at + interval '1 hour'
from public.sessions s
cross join (values ${ids.map((id, i) => `('${id}'::uuid, ${pct[i]})`).join(', ')}) as u(id, p)
where s.academy_id = '${academyId}' and s.starts_at < now() - interval '2 hours'
  and (s.class_id = '${c1}' or u.p >= 35)
  and (u.p = 100 or abs(hashtext(s.id::text || u.id::text)) % 100 < u.p);
insert into public.attendances (academy_id, session_id, user_id, source, status, validated_by, validated_at)
select '${academyId}', s.id, '${minorId}', 'teacher', 'validated', '${prof1.id}', s.starts_at + interval '1 hour'
from public.sessions s where s.academy_id = '${academyId}' and s.class_id = '${c1}' and s.starts_at < now() - interval '2 hours' and abs(hashtext(s.id::text)) % 100 < 50;
`);

console.log('Graduação (valores de TESTE), trilha e habilidades…');
const faixas = ['Faixa Azul (teste)', 'Faixa Azul (teste)', 'Faixa Azul (teste)', 'Faixa Roxa (teste)', 'Faixa Roxa (teste)', 'Faixa Azul (teste)', 'Faixa Azul (teste)', 'Faixa Azul (teste)'];
for (const [i, a] of alunos.entries()) {
  assert.equal((await gestor.client.rpc('register_initial_rank', { p_academy_id: academyId, p_user_id: a.id, p_belt_code: faixas[i], p_degree: i === 0 ? 1 : 0, p_effective_date: localDate(i === 0 ? 55 : 30 + i * 3), p_reason: null, p_idempotency_key: key() })).error, null);
}
assert.equal((await gestor.client.rpc('register_initial_rank', { p_academy_id: academyId, p_user_id: minorId, p_belt_code: 'Faixa Azul (teste)', p_degree: 0, p_effective_date: localDate(45), p_reason: null, p_idempotency_key: key() })).error, null);
const curriculumId = (await gestor.client.rpc('create_curriculum', { p_academy_id: academyId, p_title: 'Trilha Básica (demo)', p_level: 'Básico', p_idempotency_key: key() })).data;
assert.equal((await gestor.client.rpc('add_curriculum_items_from_level', { p_curriculum_id: curriculumId, p_level: 'Básico' })).error, null);
// Regras de TESTE (números fictícios, só para demonstrar o cálculo): faixa A grau 0 e 1, faixa B grau 0
for (const [belt, degree, factor] of [['Faixa Azul (teste)', 0, 1], ['Faixa Azul (teste)', 1, 2], ['Faixa Roxa (teste)', 0, 3]]) {
  const criteria = [
    { kind: 'min_days', label: 'Tempo na faixa (teste)', min_days: 30 * factor },
    { kind: 'attendance', label: 'Presenças validadas (teste)', min_attendances: 20 * factor, window_days: 120 },
    { kind: 'curriculum', label: 'Trilha básica (teste)', curriculum_id: curriculumId, min_percent: 15 * factor },
    { kind: 'manual', label: 'Comprometimento e atitude' },
  ];
  const r = await gestor.client.rpc('create_promotion_rule', { p_academy_id: academyId, p_belt_code: belt, p_degree: degree, p_title: null, p_effective_from: localDate(120), p_criteria: criteria, p_idempotency_key: key() });
  assert.equal(r.error, null, `regra ${belt} grau ${degree}`);
}
const tec = async (q) => (await ana.client.rpc('search_techniques', { p_query: q, p_limit: 1, p_offset: 0 })).data[0].id;
const [tesoura, armlock, postura, americana] = [await tec('tesoura'), await tec('armlock'), await tec('postura'), await tec('americana')];
const trail = (await gestor.client.from('curriculum_items').select('technique_id').eq('curriculum_id', curriculumId)).data ?? [];
for (const [i, a] of [ana, bruno, carla].entries()) {
  for (const [j, item] of trail.slice(0, 6 - i * 2).entries()) {
    await a.client.rpc('declare_skill', { p_academy_id: academyId, p_technique_id: item.technique_id, p_status: j % 2 === 0 ? 'studied' : 'practicing' });
  }
}

// O professor valida o domínio de algumas técnicas (só o professor pode validar)
for (const [i, a] of [ana, bruno, carla].entries()) {
  for (const item of trail.slice(0, 4 - i)) {
    assert.equal((await prof1.client.rpc('assess_skill', { p_academy_id: academyId, p_user_id: a.id, p_technique_id: item.technique_id, p_status: 'validated', p_note: null, p_idempotency_key: key() })).error, null, 'domínio validado');
  }
}

console.log('Diário privado…');
const notes = ['Trabalhei passagem de guarda e pressão no quadril.', 'Rolamos bastante; preciso melhorar a base na meia-guarda.', 'Aula de raspagens: tesoura saiu bem no final.', 'Drilei a americana por 20 minutos.'];
for (const [i, a] of [ana, bruno, carla, daniel].entries()) {
  for (let d = 0; d < 3 + (3 - i); d++) {
    const r = await a.client.rpc('save_training_log', { p_academy_id: academyId, p_trained_at: `${localDate(d * 2 + 1)}T12:00:00Z`, p_notes: notes[(i + d) % notes.length], p_technique_ids: [[tesoura, armlock, postura, americana][(i + d) % 4]], p_client_key: key(), p_log_id: null });
    assert.equal(r.error, null, 'registro do diário');
  }
}

console.log('Feed, reações e comentários…');
const fotos = [['Aula de sexta', 200, ana], ['Treino de raspagens', 20, bruno], ['Graduação da turma', 150, prof1], ['Open mat de sábado', 280, carla]];
const posts = [];
for (const [title, hue, autor] of fotos) {
  const f = await demoPhoto(title, hue);
  const r = await autor.client.rpc('create_feed_post', { p_academy_id: academyId, p_caption: `${title} (foto fictícia)`, p_image: f.hex, p_width: f.w, p_height: f.h, p_has_minors: false, p_tag_ids: [], p_client_key: key() });
  assert(r.data, `post ${title}`);
  posts.push(r.data);
}
for (const [i, p] of posts.entries()) for (const a of [ana, bruno, carla, daniel, eduarda].slice(0, 2 + i)) await a.client.rpc('toggle_feed_reaction', { p_post_id: p });
await bruno.client.rpc('add_feed_comment', { p_post_id: posts[0], p_body: 'Foi uma ótima aula, osu!', p_client_key: key() });
await prof1.client.rpc('add_feed_comment', { p_post_id: posts[1], p_body: 'Boa evolução nas raspagens, pessoal.', p_client_key: key() });
await carla.client.rpc('add_feed_comment', { p_post_id: posts[0], p_body: 'Quero repetir esse treino semana que vem.', p_client_key: key() });

console.log('Desafio entre alunos…');
const challenge = (await ana.client.rpc('create_challenge', { p_academy_id: academyId, p_title: 'Presença do mês (demo)', p_description: 'Quem mais treina com presença confirmada.', p_metric: 'attendance', p_points_per_unit: 10, p_technique_id: null, p_max_units_per_day: null, p_starts_on: localDate(0), p_ends_on: localDate(-14), p_min_participants: 3, p_join: true, p_idempotency_key: key() })).data;
assert(challenge, 'desafio criado');
for (const a of [bruno, carla, daniel]) await a.client.rpc('join_challenge', { p_challenge_id: challenge });

console.log('Financeiro manual…');
const month = `${localDate(0).slice(0, 7)}-01`;
for (const [i, a] of alunos.entries()) {
  assert.equal((await gestor.client.rpc('set_member_plan', { p_academy_id: academyId, p_user_id: a.id, p_amount_cents: i % 3 === 0 ? 18000 : 15000, p_due_day: 5 + (i % 3) * 5, p_starts_on: localDate(60), p_active: true, p_discount_cents: i === 5 ? 3000 : 0, p_discount_note: i === 5 ? 'irmãos (demo)' : null })).error, null);
}
assert((await gestor.client.rpc('generate_monthly_charges', { p_academy_id: academyId, p_month: month, p_idempotency_key: key() })).data >= 1, 'mensalidades geradas');
const charges = (await gestor.client.rpc('list_academy_charges', { p_academy_id: academyId, p_month: month })).data ?? [];
for (const [i, c] of charges.entries()) if (i % 3 !== 2) await gestor.client.rpc('mark_charge_paid', { p_charge_id: c.id, p_method: i % 2 ? 'pix' : 'dinheiro', p_paid_on: localDate(0), p_note: null });

console.log(`
Pronto. Dados fictícios criados na academia "Academia Demo (fictícia)" (${academyId}).
Senha de todas as contas: ${DEMO_PASSWORD}
  super admin ........ ${dono.email}
  gestor (mestre) .... ${gestor.email}
  professores ........ ${prof1.email}, ${prof2.email}
  alunos ............. demo-a1@example.test (Ana, ~30+ treinos: aparece o aviso de marco) até demo-a8@example.test
  responsável ........ ${responsavel.email} (menor Pedro, com consentimento verificado)
Roteiro de apresentação: docs/17-roteiro-de-demonstracao.md`);
