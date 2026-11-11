// Gera types/database.d.ts a partir do banco (mesmo Supabase do app), com a CLI oficial.
// Precisa (só no seu computador, nunca na Vercel):
//   SUPABASE_PROJECT_ID   Supabase > Project Settings > General > Reference ID (o "xxxx" de xxxx.supabase.co)
//   SUPABASE_ACCESS_TOKEN supabase.com/dashboard/account/tokens > Generate new token
// Uso: npm run tipos   (lê .env.local; o schema é do repositório do app: rode depois de cada sql/ novo lá)
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

for (const f of ['.env.local', '.env']) {
  if (!existsSync(f)) continue;
  for (const l of readFileSync(f, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z_]+)\s*=\s*([^#\s]+)/.exec(l);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}
const id = process.env.SUPABASE_PROJECT_ID || (/https:\/\/([a-z0-9]+)\.supabase\.co/.exec(process.env.SUPABASE_URL || '') || [])[1];
if (!id || !process.env.SUPABASE_ACCESS_TOKEN) {
  console.error('Defina SUPABASE_PROJECT_ID (ou SUPABASE_URL) e SUPABASE_ACCESS_TOKEN no .env.local. Veja o README.');
  process.exit(1);
}
const saida = execFileSync('npx', ['--yes', 'supabase', 'gen', 'types', 'typescript', '--project-id', id, '--schema', 'public'], {
  encoding: 'utf8', env: process.env, maxBuffer: 20 * 1024 * 1024
});
writeFileSync('types/database.d.ts', '// GERADO por `npm run tipos` a partir do banco em ' + new Date().toISOString().slice(0, 10) + '. Não edite à mão.\n' + saida);
console.log('types/database.d.ts atualizado.');
