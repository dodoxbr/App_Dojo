// Turns the TEST-PHASE platform-admin access to every diary on or off (platform_settings.admin_diary_access).
// Usage: node scripts/set-admin-diary-access.mjs on|off|status
// Local Supabase only (runs psql in the local database container). Turn it OFF before any real data / pilot.
import { execFileSync } from 'node:child_process';

const mode = process.argv[2];
if (!['on', 'off', 'status'].includes(mode)) {
  console.error('Uso: node scripts/set-admin-diary-access.mjs on|off|status');
  process.exit(1);
}

const sql =
  mode === 'status'
    ? 'select admin_diary_access from public.platform_settings;'
    : `update public.platform_settings set admin_diary_access = ${mode === 'on'} returning admin_diary_access;`;

const out = execFileSync(
  'docker',
  ['exec', 'supabase_db_dojo-platform-local', 'psql', '-U', 'postgres', '-d', 'postgres', '-tA', '-c', sql],
  { encoding: 'utf8' },
).trim();

console.log(`Acesso do super admin aos diários: ${out === 't' ? 'LIGADO (fase de teste)' : 'DESLIGADO'}`);
