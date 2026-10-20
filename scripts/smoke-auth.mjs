// Smoke test of the real auth flow against the LOCAL Supabase (US-002).
// Usage: SUPABASE_URL=... SUPABASE_ANON_KEY=... node scripts/smoke-auth.mjs
// Uses only the anon key and a synthetic e-mail; the confirmation mail is read from local Mailpit.
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321';
const anonKey = process.env.SUPABASE_ANON_KEY;
const mailpit = process.env.MAILPIT_URL ?? 'http://127.0.0.1:54324';
assert(anonKey, 'Defina SUPABASE_ANON_KEY (npx supabase status).');
assert(/^https?:\/\/(127\.0\.0\.1|localhost)/.test(url), 'Este smoke test só roda contra o Supabase local.');

const email = `smoke-${Date.now()}@example.test`;
const password = 'senha-sintetica-123';
const supabase = createClient(url, anonKey, { auth: { persistSession: false } });

const up = await supabase.auth.signUp({ email, password, options: { data: { display_name: 'Smoke Teste', birth_date: '1990-01-01' } } });
assert.equal(up.error, null, 'cadastro');
assert.equal(up.data.session, null, 'sem sessão antes de confirmar o e-mail');

const early = await supabase.auth.signInWithPassword({ email, password });
assert(early.error, 'login deve falhar antes da confirmação');

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
assert(link, 'e-mail de confirmação não chegou ao Mailpit');
await fetch(link, { redirect: 'manual' });

const inn = await supabase.auth.signInWithPassword({ email, password });
assert.equal(inn.error, null, 'login após confirmação');

const own = await supabase.from('profiles').select('id, display_name');
assert.equal(own.error, null);
assert.equal(own.data.length, 1, 'vê somente o próprio perfil');
assert.equal(own.data[0].display_name, 'Smoke Teste');

const upd = await supabase.from('profiles').update({ display_name: 'Smoke Novo' }).eq('id', own.data[0].id).select();
assert.equal(upd.data?.[0]?.display_name, 'Smoke Novo', 'edita o próprio nome');

const bad = await supabase.from('profiles').update({ display_name: 'x' }).eq('id', own.data[0].id);
assert(bad.error, 'nome inválido rejeitado');

const ins = await supabase.from('profiles').insert({ id: crypto.randomUUID(), display_name: 'Fake' });
assert(ins.error, 'sem INSERT direto');

assert.equal((await supabase.auth.signOut()).error, null, 'logout');
const after = await supabase.from('profiles').select('id');
assert(after.error || after.data.length === 0, 'após logout (anon) não lê perfis');

console.log('smoke-auth: OK');
