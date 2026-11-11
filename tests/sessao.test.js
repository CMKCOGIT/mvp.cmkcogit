// Adaptador de sessão em cookie (login único app <-> mvp), rodando o código de public/js/app.js
// num contexto isolado com um document.cookie simulado.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const fonte = readFileSync(new URL('../public/js/app.js', import.meta.url), 'utf8');
const ini = fonte.indexOf('const armazenamentoSessao = (function () {');
const fim = fonte.indexOf('})();', ini) + 5;
const codigo = fonte.slice(ini, fim) + '\nthis.armazenamento = armazenamentoSessao;';

function criar({ hostname = 'mvp.cmkcogit.com.br', protocolo = 'https:', cookieDomain = '.cmkcogit.com.br', local = {} } = {}) {
  const potes = new Map();
  const gravados = [];
  const document = {
    get cookie() { return [...potes].map(([k, v]) => k + '=' + v).join('; '); },
    set cookie(linha) {
      gravados.push(linha);
      const [par, ...attrs] = linha.split('; ');
      const i = par.indexOf('=');
      const nome = par.slice(0, i);
      const idade = attrs.find((a) => a.startsWith('Max-Age='));
      if (idade && Number(idade.slice(8)) <= 0) potes.delete(nome); else potes.set(nome, par.slice(i + 1));
    }
  };
  const localStorage = { getItem: (k) => (k in local ? local[k] : null), removeItem: (k) => { delete local[k]; } };
  const ctx = { document, localStorage, window: { location: { hostname } }, location: { protocol: protocolo }, CFG: { cookieDomain }, encodeURIComponent, decodeURIComponent, Math, Number, String };
  vm.runInNewContext(codigo, ctx);
  return { s: ctx.armazenamento, potes, gravados, local };
}

test('sessão grande é dividida em pedaços de até 3000 caracteres e volta igual', () => {
  const { s, potes } = criar();
  const sessao = JSON.stringify({ access_token: 'x'.repeat(7000), user: { id: 'u', nome: 'Ação' } });
  s.setItem('sb-ref-auth-token', sessao);
  assert.equal(potes.get('sb-ref-auth-token.n'), '3');
  assert.ok([...potes.keys()].filter((k) => /\.\d$/.test(k)).every((k) => potes.get(k).length <= 3000));
  assert.equal(s.getItem('sb-ref-auth-token'), sessao);
});

test('no domínio cmkcogit.com.br o cookie vale para app. e mvp. (Domain, Secure, SameSite=Lax)', () => {
  const { s, gravados } = criar();
  s.setItem('k', 'v');
  assert.match(gravados.at(-1), /; Path=\/; SameSite=Lax; Domain=\.cmkcogit\.com\.br; Secure$/);
});

test('fora do domínio (localhost, preview) o cookie fica só no endereço atual', () => {
  const { s, gravados } = criar({ hostname: 'localhost', protocolo: 'http:' });
  s.setItem('k', 'v');
  assert.doesNotMatch(gravados.at(-1), /Domain=|Secure/);
  const preview = criar({ hostname: 'mvp-git-x.vercel.app' });
  preview.s.setItem('k', 'v');
  assert.doesNotMatch(preview.gravados.at(-1), /Domain=/);
});

test('sessão antiga do localStorage migra para o cookie (ninguém é deslogado)', () => {
  const local = { 'sb-ref-auth-token': '{"access_token":"antigo"}' };
  const { s, potes } = criar({ local });
  assert.equal(s.getItem('sb-ref-auth-token'), '{"access_token":"antigo"}');
  assert.equal(local['sb-ref-auth-token'], undefined);
  assert.equal(potes.get('sb-ref-auth-token.n'), '1');
});

test('sair (removeItem) apaga todos os pedaços; pedaço faltando = sem sessão', () => {
  const { s, potes } = criar();
  s.setItem('k', 'y'.repeat(6500));
  s.removeItem('k');
  assert.equal([...potes.keys()].filter((k) => k.startsWith('k.')).length, 0);
  assert.equal(s.getItem('k'), null);
  s.setItem('k', 'z'.repeat(6500));
  potes.delete('k.1');
  assert.equal(s.getItem('k'), null);
});
