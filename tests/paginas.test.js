// Conferências estáticas das páginas: scripts na ordem certa, nada de chave secreta no front,
// CSP liberando só o app, o Supabase e o captcha, e nenhuma escrita de pagamento/IA neste projeto.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const pub = new URL('../public/', import.meta.url);
const html = readdirSync(pub).filter((f) => f.endsWith('.html'));
const ler = (f) => readFileSync(new URL(f, pub), 'utf8');
// só o código: tira comentários de linha inteira e de bloco (os comentários explicam as regras)
const semComentarios = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');

test('toda página carrega supabase -> /config.js -> app.js antes do script dela', () => {
  for (const f of html.filter((x) => x !== '404.html')) {
    const s = ler(f);
    const ordem = ['/js/vendor/supabase-2.45.4.min.js', '/config.js', '/js/app.js'].map((x) => s.indexOf(x));
    assert.ok(ordem.every((i, n) => i > 0 && (n === 0 || i > ordem[n - 1])), f);
  }
});

test('o front não tem service_role, token do Mercado Pago nem chave de IA', () => {
  const js = readdirSync(new URL('js/', pub)).filter((f) => f.endsWith('.js')).map((f) => semComentarios(readFileSync(new URL('js/' + f, pub), 'utf8'))).join('\n');
  assert.doesNotMatch(js, /service_role|SERVICE_ROLE|MP_ACCESS_TOKEN|ANTHROPIC_API_KEY|GROQ_API_KEY|sk-ant-|APP_USR-/);
  const cfg = readFileSync(new URL('../api/config.js', import.meta.url), 'utf8');
  assert.doesNotMatch(cfg, /SERVICE_ROLE|MP_ACCESS|ANTHROPIC|GROQ/);
});

test('"Construir com a CMK Cogit" leva só o ID do projeto (nada de escopo na URL)', () => {
  const js = readFileSync(new URL('js/projeto.js', pub), 'utf8');
  assert.match(js, /CFG\.appUrl\)\}\/projeto\/\$\{esc\(E\.jornada\.id\)\}"/);
});

test('CSP: conexões só com o próprio site, Supabase, app e captcha; sem iframe de terceiros', () => {
  const v = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
  const csp = v.headers[0].headers.find((h) => h.key === 'Content-Security-Policy').value;
  assert.match(csp, /connect-src 'self' https:\/\/\*\.supabase\.co wss:\/\/\*\.supabase\.co https:\/\/app\.cmkcogit\.com\.br https:\/\/challenges\.cloudflare\.com;/);
  assert.match(csp, /frame-ancestors 'none'/);
});

test('mentor aparece só no mvp: pedido pelo banco (pedir_mentoria) e painel exige a permissão', () => {
  assert.match(readFileSync(new URL('js/mentoria.js', pub), 'utf8'), /db\.rpc\('pedir_mentoria'/);
  assert.match(readFileSync(new URL('js/mentor.js', pub), 'utf8'), /protegerPagina\(\{ mentor: true \}\)/);
  assert.match(ler('entrar.html') + readFileSync(new URL('js/entrar.js', pub), 'utf8'), /aceite_termos_em/);
  assert.doesNotMatch(semComentarios(readFileSync(new URL('js/entrar.js', pub), 'utf8')), /\brole\s*:|mentor/i); // login/cadastro iguais para todos (papel nunca vai no cadastro)
});
