// Servidor local que imita a Vercel: arquivos de /public + a função /api/config.
// Uso: npm run dev  ->  http://localhost:3001  (o app roda em http://localhost:3000)
// Lê .env.local (copie de .env.example). Não precisa de npm install.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const raiz = path.dirname(fileURLToPath(import.meta.url));
const publico = path.join(raiz, 'public');
for (const nome of ['.env.local', '.env']) {
  const arquivo = path.join(raiz, nome);
  if (!fs.existsSync(arquivo)) continue;
  for (const linha of fs.readFileSync(arquivo, 'utf8').replace(/^﻿/, '').split(/\r?\n/)) {
    const m = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*(?:#.*)?$/.exec(linha);
    if (!m || linha.trim().startsWith('#')) continue;
    const valor = m[2].replace(/^(['"])(.*)\1$/, '$2');
    if (valor && !/SEU-PROJETO/.test(valor) && !process.env[m[1]]) process.env[m[1]] = valor;
  }
}
const PORTA = Number(process.env.PORT || 3001);
if (!process.env.APP_URL) process.env.APP_URL = 'http://localhost:3000';

const vercel = JSON.parse(fs.readFileSync(path.join(raiz, 'vercel.json'), 'utf8'));
// mesmos cabeçalhos; no computador o app roda em outra porta, então ele entra no connect-src
const cabecalhos = vercel.headers.find((h) => h.source === '/(.*)').headers.map((h) => (h.key === 'Content-Security-Policy'
  ? { ...h, value: h.value.replace('connect-src ', 'connect-src ' + process.env.APP_URL + ' ') } : h));
const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8'
};

http.createServer(async (req, res) => {
  for (const h of cabecalhos) res.setHeader(h.key, h.value);
  const { pathname } = new URL(req.url, 'http://localhost');
  try {
    if (pathname === '/config.js' || pathname === '/api/config') {
      const fn = (await import(pathToFileURL(path.join(raiz, 'api', 'config.js')).href)).default;
      return fn(req, res);
    }
    let rel = decodeURIComponent(pathname);
    if (rel.endsWith('/')) rel += 'index.html';
    const arquivo = path.normalize(path.join(publico, rel));
    if (!arquivo.startsWith(publico + path.sep) || !fs.existsSync(arquivo) || fs.statSync(arquivo).isDirectory()) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.end(fs.readFileSync(path.join(publico, '404.html')));
    }
    res.setHeader('Content-Type', TIPOS[path.extname(arquivo)] || 'application/octet-stream');
    res.setHeader('Cache-Control', 'no-cache');
    fs.createReadStream(arquivo).pipe(res);
  } catch (e) {
    console.error(e);
    res.statusCode = 500;
    res.end('Erro interno');
  }
}).listen(PORTA, () => {
  console.log('\n  mvp.cmkcogit rodando em http://localhost:' + PORTA + '  (app em ' + process.env.APP_URL + ')');
  for (const k of ['SUPABASE_URL', 'SUPABASE_ANON_KEY']) console.log('    ' + (process.env[k] ? 'OK     ' : 'FALTA  ') + k);
  console.log('');
});
