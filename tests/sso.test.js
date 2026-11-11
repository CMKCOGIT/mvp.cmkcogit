// Login único sem cookie compartilhado: conferências do código (o fluxo completo roda no e2e).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const js = (f) => readFileSync(new URL('../public/js/' + f, import.meta.url), 'utf8');

test('nenhum cookie de domínio pai: a sessão fica só neste endereço', () => {
  const tudo = readdirSync(new URL('../public/js/', import.meta.url)).filter((f) => f.endsWith('.js')).map(js).join('\n');
  assert.doesNotMatch(tudo, /document\.cookie|Domain=|cookieDomain/);
  assert.doesNotMatch(readFileSync(new URL('../api/config.js', import.meta.url), 'utf8'), /COOKIE_DOMAIN/);
  assert.doesNotMatch(js('app.js'), /storage:\s*\w/); // armazenamento padrão do supabase-js
});

test('sso.js recebe o código só pelo fragmento (#), limpa a URL antes de usar e só volta para caminho deste site', () => {
  const s = js('sso.js');
  assert.match(s, /window\.location\.hash/);
  assert.ok(s.indexOf('history.replaceState(') < s.indexOf('db.auth.verifyOtp('));
  assert.match(s, /destinoSeguro\(hash\.get\('volta'\)\)/);
  assert.match(s, /startsWith\(CFG\.appUrl \+ '\/sso\.html#'\)/); // só segue para o sso do app
});

test('"Sair" impede de entrar sozinho de novo; login manual libera', () => {
  assert.match(js('app.js'), /async function sair[\s\S]*?SSO\.saiu\(\)/);
  assert.match(js('entrar.js'), /SSO\.entrou\(\);\s*window\.location\.href = destino/);
});
