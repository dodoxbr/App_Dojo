// Passeio pelas telas principais com as contas de DEMONSTRAÇÃO (scripts/seed-demo.mjs), em Chrome real: tira prints para conferir a
// apresentação (aluno e responsável em tela de celular; gestor, professor e super admin em tela de computador) e avisa se alguma tela
// falha ou vaza para os lados. Uso: SUPABASE_ANON_KEY=... [ADMIN_URL=http://localhost:3000] [SHOTS_DIR=...] node scripts/demo-tour.mjs
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { localEnv } from './lib/local.mjs';
import { openBrowser } from './lib/browser.mjs';

const { url, anonKey } = localEnv();
const BASE = process.env.ADMIN_URL ?? 'http://localhost:3000';
const SHOTS = process.env.SHOTS_DIR ?? path.join(process.cwd(), 'tmp-shots', 'demo');
const PASSWORD = 'demo-senha-123';
mkdirSync(SHOTS, { recursive: true });

const gestor = createClient(url, anonKey, { auth: { persistSession: false } });
await gestor.auth.signInWithPassword({ email: 'demo-gestor@example.test', password: PASSWORD });
const { data: academy } = await gestor.from('academies').select('id').eq('slug', 'demo-ficticia').maybeSingle();
if (!academy) { console.error('Rode antes: node scripts/seed-demo.mjs'); process.exit(2); }
const A = `/academia/${academy.id}`;
const findings = [];
let n = 0;

const tours = [
  { who: 'aluno-ana', email: 'demo-a1@example.test', mobile: true, routes: ['/inicio', '/diario', '/tecnicas', '/graduacao', '/medalhas', `/feed/${academy.id}`, '/desafios', '/financeiro', '/perfil'] },
  { who: 'responsavel', email: 'demo-responsavel@example.test', mobile: true, routes: ['/dependentes', '/financeiro'] },
  { who: 'gestor', email: 'demo-gestor@example.test', mobile: false, routes: [`${A}/inicio`, `${A}/membros`, `${A}/painel`, `${A}/financeiro`, `${A}/graduacao/alunos`, `${A}/saude`, `${A}/responsaveis`] },
  { who: 'professor', email: 'demo-prof1@example.test', mobile: false, routes: [`${A}/inicio`, '/aulas', `${A}/graduacao/alunos`] },
  { who: 'dono', email: 'demo-dono@example.test', mobile: false, routes: ['/plataforma'] },
];

for (const t of tours) {
  const b = await openBrowser({ mobile: t.mobile, port: 9344 });
  try {
    await b.goto(`${BASE}/login`);
    await b.fill('form[aria-label=Entrar] input[name=email]', t.email);
    await b.fill('form[aria-label=Entrar] input[name=password]', PASSWORD);
    await b.click('form[aria-label=Entrar] button[type=submit]');
    await b.waitFor("!location.pathname.startsWith('/login')", 20000, 'entrar');
    for (const r of t.routes) {
      const before = b.consoleErrors.length;
      await b.goto(`${BASE}${r}`);
      const text = await b.text();
      for (const bad of ['Application error', 'Internal Server Error', 'This page could not be found']) if (text.includes(bad)) findings.push(`${t.who} ${r}: "${bad}"`);
      if (t.mobile && (await b.overflowsHorizontally())) findings.push(`${t.who} ${r}: rolagem horizontal`);
      for (const e of b.consoleErrors.slice(before)) findings.push(`${t.who} ${r}: console: ${String(e).slice(0, 120)}`);
      await b.screenshot(path.join(SHOTS, `${String(++n).padStart(2, '0')}-${t.who}${r.replace(/[0-9a-f-]{36}/g, 'id').replace(/[^a-z0-9]+/gi, '_').slice(0, 40)}.png`));
    }
  } catch (e) {
    findings.push(`${t.who}: ${e.message}`);
  } finally {
    await b.close();
  }
}
for (const f of findings) console.log(`  ! ${f}`);
console.log(`\n${findings.length} achado(s). ${n} prints em ${SHOTS}`);
process.exit(findings.length ? 1 : 0);
