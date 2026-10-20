// Makes an existing LOCAL account a platform super admin. Never exposed to the app/clients.
// Usage: node scripts/make-platform-admin.mjs seu-email@exemplo.com
// Local Supabase only: runs psql inside the local database container.
import { execFileSync } from 'node:child_process';

const email = process.argv[2]?.trim().toLowerCase();
if (!email || !/^[^\s'";\\]+@[^\s'";\\]+$/.test(email)) {
  console.error('Uso: node scripts/make-platform-admin.mjs <email-da-conta-existente>');
  process.exit(1);
}

const sql = `insert into public.platform_admins (user_id) select id from auth.users where lower(email) = '${email}' on conflict do nothing returning user_id;`;
const out = execFileSync(
  'docker',
  ['exec', 'supabase_db_dojo-platform-local', 'psql', '-U', 'postgres', '-d', 'postgres', '-tA', '-c', sql],
  { encoding: 'utf8' },
).trim();

console.log(out ? `Super admin criado: ${email}` : `Nada alterado (conta não encontrada ou já era super admin): ${email}`);
