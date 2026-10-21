// Shared helpers for the LOCAL end-to-end scripts (Supabase CLI stack + Mailpit). Local only, synthetic accounts.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';

export const TZ = 'America/Sao_Paulo';
export const PASSWORD = 'senha-sintetica-123';

export function localEnv() {
  const url = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321';
  const anonKey = process.env.SUPABASE_ANON_KEY;
  const mailpit = process.env.MAILPIT_URL ?? 'http://127.0.0.1:54324';
  assert(anonKey, 'Defina SUPABASE_ANON_KEY (npx supabase status).');
  assert(/^https?:\/\/(127\.0\.0\.1|localhost)/.test(url), 'Estes scripts só rodam contra o Supabase local.');
  return { url, anonKey, mailpit };
}

// Local calendar date (academy time zone) for "now minus N days".
export const localDate = (daysAgo = 0) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(Date.now() - daysAgo * 86_400_000));

export function makePlatformAdmin(email) {
  execFileSync('node', ['scripts/make-platform-admin.mjs', email], { stdio: 'pipe' });
}

// Sign up, confirm the e-mail through Mailpit and sign in. Returns the client plus the account data.
export async function newUser(label, run = Date.now()) {
  const { url, anonKey, mailpit } = localEnv();
  const email = `${label}-${run}@example.test`;
  const client = createClient(url, anonKey, { auth: { persistSession: false } });
  const up = await client.auth.signUp({ email, password: PASSWORD, options: { data: { display_name: `Smoke ${label}`, birth_date: '1990-01-01' } } });
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
  const inn = await client.auth.signInWithPassword({ email, password: PASSWORD });
  assert.equal(inn.error, null, `login ${label}`);
  const id = inn.data.user.id;
  // The registration form (US-016) is required to join an academy; synthetic data.
  const saved = await saveContact(client, id, `Smoke ${label}`);
  assert.equal(saved.error, null, `ficha de ${label}`);
  return { client, email, id };
}

// Fills the registration form of a person (own or dependent) with synthetic data.
export function saveContact(client, userId, fullName, healthNotes = null) {
  return client.rpc('save_contact', {
    p_user_id: userId, p_full_name: fullName, p_phone: '(11) 99999-0000', p_postal_code: '01001-000', p_street: 'Rua Ficticia',
    p_number: '1', p_complement: null, p_neighborhood: 'Centro', p_city: 'Sao Paulo', p_state: 'SP',
    p_emergency_name: 'Contato de Emergencia', p_emergency_phone: '(11) 97777-6666', p_emergency_relationship: 'mae', p_health_notes: healthNotes, p_health_consent: healthNotes !== null,
  });
}
