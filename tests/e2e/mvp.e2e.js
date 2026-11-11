// Ponta a ponta no navegador (Playwright), com o Supabase e as rotas do app SIMULADOS por
// interceptação de rede: confere telas, papéis e chamadas, sem banco nem pagamento de verdade.
// As regras de acesso de verdade (RLS) são testadas no repositório do app (npm run test:sql).
// Uso: npm run test:e2e   (precisa do Playwright com Chromium instalado)
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { readFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const DEFINICAO = JSON.parse(readFileSync(path.join(raiz, 'tests/fixtures/definicao.json'), 'utf8'));
const SUPA = 'https://teste.supabase.co';
const APP = 'https://app.teste.cmkcogit.com.br';
const PORTA = 3000 + Math.floor(Math.random() * 900) + 100;
const BASE = 'http://localhost:' + PORTA;
const SHOTS = process.env.E2E_SCREENSHOTS;

const ANA = 'aaaaaaaa-0000-4000-8000-000000000001';
const MEN = 'dddddddd-0000-4000-8000-000000000004';
const J1 = '11111111-0000-4000-8000-000000000001';
let servidor, navegador;

before(async () => {
  servidor = spawn(process.execPath, ['dev-server.mjs'], {
    cwd: raiz, env: { ...process.env, PORT: String(PORTA), SUPABASE_URL: SUPA, SUPABASE_ANON_KEY: 'anon', APP_URL: APP, COOKIE_DOMAIN: '', TURNSTILE_SITE_KEY: '' }, stdio: 'ignore'
  });
  for (let i = 0; i < 50; i++) {
    try { if ((await fetch(BASE + '/config.js')).ok) break; } catch (_) { /* subindo */ }
    await new Promise((r) => setTimeout(r, 100));
  }
  navegador = await chromium.launch();
  if (SHOTS) mkdirSync(SHOTS, { recursive: true });
});
after(async () => { await navegador?.close(); servidor?.kill(); });

// ---------------------------------------------------------------- backend simulado
function cenario({ usuario = ANA, mentor = false, logado = true, logadoNoApp = false } = {}) {
  const chamadas = [];
  const perfis = {
    [ANA]: { id: ANA, nome: 'Ana Souza', email: 'ana@ex.com', telefone: null, role: 'cliente', documento: '52998224725', cadastro_concluido_em: '2026-01-01', aceite_termos_em: '2026-01-01' },
    [MEN]: { id: MEN, nome: 'Marta Mentora', email: 'marta@ex.com', telefone: null, role: 'cliente', documento: null, cadastro_concluido_em: '2026-01-01', aceite_termos_em: '2026-01-01' }
  };
  const modulos = DEFINICAO.map((m, i) => ({ jornada_id: J1, modulo: m.id, status: i < 2 ? 'aprovado' : i === 2 ? 'enviado' : 'aberto', respostas: {} }));
  const tabelas = {
    profiles: [perfis[usuario]],
    jornadas: usuario === ANA ? [{ id: J1, titulo: 'Agenda Salão', status: 'em_andamento', created_at: '2026-11-01', updated_at: new Date().toISOString(), cliente_id: ANA }] : [],
    jornada_modulos: usuario === ANA ? modulos : [],
    jornada_orcamentos: usuario === ANA ? [{ id: 'o1', jornada_id: J1, valor_min: 9600, valor_max: 12480, created_at: '2026-11-02' }] : [],
    mvp_budget_orders: usuario === ANA ? [{ id: 'p1', project_id: J1, status: 'ready', price_brl: 30, paid_at: new Date().toISOString(), ready_at: new Date().toISOString(), valid_until: '2026-12-11', credito_usado_em: null, created_at: '2026-11-02' }] : [],
    mvp_project_shares: [],
    mvp_pricing_config: [{ price_brl: 30, credit_valid_days: 90 }],
    mentor_requests: [],
    mvp_mentor_comments: []
  };
  const orcamento = {
    id: 'o1', created_at: '2026-11-02', resumo: 'Agenda online para salões de bairro.', valor_min: 9600, valor_max: 12480,
    mvp: { quantidade: 2, semanas: 6 }, evolucao: { quantidade: 0 }, premissas: ['O salão tem conta PJ.'], riscos: [], perguntas: [],
    itens: [{ nome: 'Agendamento online', descricao: 'Escolher horário', complexidade: 'media', prioridade: 'essencial' }]
  };
  const rpc = {
    is_mentor: () => mentor,
    garantir_perfil: () => null,
    mentor_projetos: () => (mentor ? [{ project_id: J1, titulo: 'Agenda Salão', status: 'em_andamento', updated_at: new Date().toISOString(), dono_nome: 'Ana Souza', compartilhado_em: '2026-11-03', total_modulos: 3, aprovados: 2, para_revisar: 1, tem_resumo: false }] : []),
    mentores_do_projeto: () => [],
    compartilhar_projeto: () => 'share-1',
    pedir_mentoria: () => 'req-1'
  };
  const sessao = {
    access_token: 'tok-' + usuario, refresh_token: 'r', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: usuario, email: perfis[usuario].email, aud: 'authenticated', role: 'authenticated', user_metadata: {} }
  };
  return { chamadas, tabelas, rpc, sessao, logado, logadoNoApp, orcamento, mentor, usuario };
}

async function abrir(c, caminho) {
  const ctx = await navegador.newContext({ viewport: { width: 1280, height: 900 } });
  const erros = [];
  if (c.logado) {
    // sessão já guardada no localStorage deste site (uma vez por aba, para o "Sair" valer)
    await ctx.addInitScript(({ base, sessao }) => {
      if (location.origin === base && !sessionStorage.getItem('e2e')) {
        localStorage.setItem('sb-teste-auth-token', JSON.stringify(sessao));
        sessionStorage.setItem('e2e', '1');
      }
    }, { base: BASE, sessao: c.sessao });
  }
  await ctx.route(SUPA + '/**', async (rota) => {
    const req = rota.request();
    const u = new URL(req.url());
    c.chamadas.push({ metodo: req.method(), caminho: u.pathname, busca: u.search, corpo: req.postData() });
    const json = (d, s = 200) => rota.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(d) });
    if (u.pathname.startsWith('/auth/v1/')) {
      if (u.pathname === '/auth/v1/signup') return json({ id: 'novo', email: 'novo@ex.com', identities: [{ id: 'x' }] });
      if (u.pathname === '/auth/v1/token' || u.pathname === '/auth/v1/verify') return json(c.sessao);
      if (u.pathname === '/auth/v1/logout') return rota.fulfill({ status: 204 });
      return json(c.sessao.user);
    }
    if (u.pathname.startsWith('/rest/v1/rpc/')) {
      const nome = u.pathname.split('/').pop();
      return json(c.rpc[nome] ? c.rpc[nome](JSON.parse(req.postData() || '{}')) : null);
    }
    const tabela = u.pathname.replace('/rest/v1/', '');
    const linhas = c.tabelas[tabela] || [];
    if (req.method() !== 'GET') return json(req.method() === 'POST' ? [{}] : linhas);
    if ((req.headers().accept || '').includes('vnd.pgrst.object')) return json(linhas[0] || null);
    return json(linhas);
  });
  await ctx.route(APP + '/**', async (rota) => {
    const req = rota.request();
    const u = new URL(req.url());
    c.chamadas.push({ metodo: req.method(), caminho: u.pathname, busca: u.search, corpo: req.postData(), app: true, auth: req.headers().authorization });
    const json = (d, s = 200) => rota.fulfill({ status: s, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': BASE }, body: JSON.stringify(d) });
    // sso.html do app (simulado): logado lá -> manda o código; não logado -> devolve com ?sso=0
    if (u.pathname === '/sso.html') {
      const volta = u.searchParams.get('volta') || '/painel.html';
      const destino = c.logadoNoApp ? BASE + '/sso.html#token_hash=abc&volta=' + encodeURIComponent(volta) : BASE + '/entrar.html?sso=0&volta=' + encodeURIComponent(volta);
      return rota.fulfill({ status: 200, contentType: 'text/html', body: '<script>location.replace(' + JSON.stringify(destino) + ')</script>' });
    }
    if (u.pathname === '/login.html') return rota.fulfill({ status: 200, contentType: 'text/html', body: '<h1>login do app</h1>' });
    if (u.pathname === '/api/sso') return json({ ok: true, url: APP + '/sso.html#token_hash=xyz&volta=%2Finicio.html' });
    if (u.pathname === '/api/jornada' && req.method() === 'GET') {
      if (!u.searchParams.get('id')) return json({ ok: true, definicao: DEFINICAO, jornada: null, projetos: [] });
      const mods = c.tabelas.jornada_modulos.length ? c.tabelas.jornada_modulos : DEFINICAO.map((m, i) => ({ modulo: m.id, status: i < 2 ? 'aprovado' : i === 2 ? 'enviado' : 'aberto', respostas: {} }));
      return json({
        ok: true, papel: c.mentor && c.usuario === MEN ? 'mentor' : 'dono', tem_mentor: c.mentor, definicao: DEFINICAO,
        jornada: { id: J1, titulo: 'Agenda Salão', status: 'em_andamento' },
        modulos: mods.map((m) => ({ modulo: m.modulo, status: m.status, respostas: m.respostas || {}, comentario: null })),
        orcamento: c.orcamento, ...(c.usuario === MEN ? { cliente: { nome: 'Ana Souza', email: null } } : {})
      });
    }
    if (u.pathname === '/api/mvp' && u.searchParams.get('acao') === 'status') {
      return json({ ok: true, preco: 30, tem_resumo: true, pedido: null, credito: null });
    }
    if (req.method() === 'OPTIONS') return rota.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': BASE, 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' } });
    return json({ ok: true });
  });
  const pagina = await ctx.newPage();
  pagina.on('pageerror', (e) => erros.push(e.message));
  pagina.on('console', (m) => { if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) erros.push(m.text()); });
  await pagina.goto(BASE + caminho);
  return { pagina, ctx, erros };
}
const foto = async (pagina, nome) => { if (SHOTS) await pagina.screenshot({ path: path.join(SHOTS, nome + '.png'), fullPage: true }); };

// ---------------------------------------------------------------- testes
test('página inicial pública: chamada para cadastro, termos e privacidade no rodapé', async () => {
  const c = cenario({ logado: false });
  const { pagina, ctx, erros } = await abrir(c, '/');
  await pagina.getByRole('heading', { name: /Do problema ao orçamento/ }).waitFor();
  assert.ok(await pagina.getByRole('link', { name: 'Criar conta grátis' }).first().isVisible());
  assert.ok(await pagina.locator('#rodape a[href="/privacidade.html"]').isVisible());
  await foto(pagina, '01-inicio');
  assert.deepEqual(erros, []);
  await ctx.close();
});

test('cadastro: mesmos dados do app (nome, aceite) e sempre cliente; exige aceite', async () => {
  const c = cenario({ logado: false });
  const { pagina, ctx, erros } = await abrir(c, '/entrar.html?modo=cadastro');
  await pagina.waitForURL(/[?&]sso=0/);   // não logado no app: o app devolve para cá
  await pagina.locator('#form-cadastro').waitFor();
  await pagina.fill('#cad-nome', 'Nova Pessoa');
  await pagina.fill('#cad-email', 'novo@ex.com');
  await pagina.fill('#cad-senha', 'senhaforte1');
  await pagina.fill('#cad-senha2', 'senhaforte1');
  await pagina.click('#form-cadastro [type=submit]');
  assert.match(await pagina.textContent('#mensagem'), /aceite os Termos/);
  await pagina.check('#cad-aceite');
  await foto(pagina, '02-cadastro');
  await pagina.click('#form-cadastro [type=submit]');
  await pagina.waitForSelector('#enviado:not([hidden])');
  const signup = c.chamadas.find((x) => x.caminho === '/auth/v1/signup');
  const corpo = JSON.parse(signup.corpo);
  assert.equal(corpo.data.nome, 'Nova Pessoa');
  assert.ok(corpo.data.aceite_termos_em);
  assert.equal(corpo.data.role, undefined); // papel nunca vem do cadastro
  assert.deepEqual(erros, []);
  await ctx.close();
});

test('login: sessão só neste endereço (localStorage), nenhum cookie que outro subdomínio leria', async () => {
  const c = cenario({ logado: false });
  const { pagina, ctx } = await abrir(c, '/entrar.html');   // não logado no app: volta com ?sso=0
  await pagina.waitForURL(/entrar\.html\?sso=0/);
  await pagina.fill('#login-email', 'ana@ex.com');
  await pagina.fill('#login-senha', 'senhaforte1');
  await pagina.click('#form-login [type=submit]');
  await pagina.waitForURL(BASE + '/painel.html');
  assert.equal((await ctx.cookies()).length, 0);
  assert.ok(await pagina.evaluate(() => localStorage.getItem('sb-teste-auth-token')));
  await ctx.close();
});

test('login único: logado no app, abrir o mvp entra direto (código de uso único, sem digitar nada)', async () => {
  const c = cenario({ logado: false, logadoNoApp: true });
  const { pagina, ctx, erros } = await abrir(c, '/projeto.html?id=' + J1);
  await pagina.waitForURL(BASE + '/projeto.html?id=' + J1);
  await pagina.locator('.jm-trilha').waitFor();
  const verificar = c.chamadas.find((x) => x.caminho === '/auth/v1/verify');
  assert.deepEqual(JSON.parse(verificar.corpo).token_hash, 'abc');
  assert.ok(await pagina.evaluate(() => localStorage.getItem('sb-teste-auth-token')));
  assert.equal((await ctx.cookies()).length, 0);
  assert.deepEqual(erros, []);
  await ctx.close();
});

test('login único: depois de "Sair" aqui, não entra sozinho pelo app de novo', async () => {
  const c = cenario({ logadoNoApp: true });
  const { pagina, ctx } = await abrir(c, '/painel.html');
  await pagina.getByRole('button', { name: /Sair/ }).click();
  await pagina.waitForURL(/entrar\.html/);
  await pagina.locator('#form-login').waitFor();
  assert.equal(c.chamadas.filter((x) => x.app && x.caminho === '/sso.html').length, 0);
  await ctx.close();
});

test('login único ao contrário: o app pergunta, o mvp (logado) pede o código ao app e manda de volta', async () => {
  const c = cenario();
  const { pagina, ctx } = await abrir(c, '/sso.html?para=app&volta=%2Finicio.html');
  await pagina.waitForURL(/app\.teste\.cmkcogit\.com\.br\/sso\.html#token_hash=xyz/);
  const pedido = c.chamadas.find((x) => x.app && x.caminho === '/api/sso');
  assert.deepEqual(JSON.parse(pedido.corpo), { para: 'app', volta: '/inicio.html' });
  assert.match(pedido.auth, /^Bearer tok-/);
  await ctx.close();
});

test('painel do usuário (cliente): projetos, status do documento, PDF, crédito; sem painel do mentor', async () => {
  const c = cenario();
  const { pagina, ctx, erros } = await abrir(c, '/painel.html');
  await pagina.getByRole('link', { name: 'Agenda Salão' }).waitFor();
  assert.ok(await pagina.getByText('Documento pronto').isVisible());
  assert.ok(await pagina.getByRole('button', { name: /Baixar PDF/ }).isVisible());
  assert.match(await pagina.textContent('#caixa-credito'), /R\$\s?30,00/);
  assert.equal(await pagina.getByRole('link', { name: /Painel do mentor/ }).count(), 0);
  await foto(pagina, '03-painel');
  assert.deepEqual(erros, []);
  await ctx.close();
});

test('compartilhar com mentor exige consentimento explícito e usa a função do banco', async () => {
  const c = cenario();
  const { pagina, ctx } = await abrir(c, '/painel.html');
  await pagina.getByRole('button', { name: /Compartilhar com mentor/ }).click();
  await pagina.fill('#mentor-email', 'marta@ex.com');
  await pagina.click('#form-compartilhar [type=submit]');
  assert.equal(c.chamadas.filter((x) => x.caminho === '/rest/v1/rpc/compartilhar_projeto').length, 0);
  await pagina.check('#consentimento');
  await foto(pagina, '04-compartilhar');
  await pagina.click('#form-compartilhar [type=submit]');
  await pagina.waitForTimeout(300);
  const ch = c.chamadas.find((x) => x.caminho === '/rest/v1/rpc/compartilhar_projeto');
  assert.deepEqual(JSON.parse(ch.corpo), { p_projeto: J1, p_email: 'marta@ex.com' });
  await ctx.close();
});

test('painel do mentor: cliente sem permissão volta ao painel; mentor vê só os compartilhados', async () => {
  const semPermissao = cenario();
  const a = await abrir(semPermissao, '/mentor.html');
  await a.pagina.waitForURL(/painel\.html/);
  await a.ctx.close();

  const c = cenario({ usuario: MEN, mentor: true });
  const { pagina, ctx, erros } = await abrir(c, '/mentor.html');
  await pagina.getByRole('link', { name: 'Agenda Salão' }).waitFor();
  assert.ok(await pagina.getByText('1 para você revisar').isVisible());
  assert.ok(await pagina.getByRole('link', { name: /Painel do mentor/ }).isVisible()); // o menu mostra para mentor
  await foto(pagina, '05-mentor');
  assert.deepEqual(erros, []);
  await ctx.close();
});

test('projeto (dono): trilha, módulo editável, resumo grátis, documento por R$ 30 e "Construir" para o app', async () => {
  const c = cenario();
  const { pagina, ctx, erros } = await abrir(c, '/projeto.html?id=' + J1);
  await pagina.locator('.jm-trilha').waitFor();
  await foto(pagina, '06-projeto-modulo');
  await pagina.locator('.jm-no[data-modulo="orcamento"]').click();
  await pagina.getByText('Investimento estimado do MVP').waitFor();
  await pagina.getByRole('button', { name: /Gerar documento por R\$\s?30,00/ }).waitFor();
  const construir = pagina.getByRole('link', { name: /Construir com a CMK Cogit/ });
  assert.equal(await construir.getAttribute('href'), APP + '/projeto/' + J1); // só o ID, nada de parâmetros
  const jornadaGet = c.chamadas.find((x) => x.app && x.caminho === '/api/jornada' && /id=/.test(x.busca));
  assert.match(jornadaGet.auth, /^Bearer tok-/);
  await foto(pagina, '07-projeto-orcamento');
  assert.deepEqual(erros, []);
  await ctx.close();
});

test('projeto (mentor): lê, revisa o módulo enviado e conversa; não vê compra nem "Construir"', async () => {
  const c = cenario({ usuario: MEN, mentor: true });
  const { pagina, ctx, erros } = await abrir(c, '/projeto.html?id=' + J1);
  await pagina.locator('#jm-revisao').waitFor(); // abre no módulo "enviado"
  assert.match(await pagina.textContent('.jm-topo'), /Projeto de Ana Souza/);
  assert.ok(await pagina.locator('#jm-form-conversa').isVisible());
  await pagina.locator('.jm-no[data-modulo="orcamento"]').click();
  assert.equal(await pagina.getByRole('link', { name: /Construir com a CMK Cogit/ }).count(), 0);
  assert.equal(await pagina.locator('#jm-detalhado').count(), 0);
  await foto(pagina, '08-projeto-mentor');
  assert.deepEqual(erros, []);
  await ctx.close();
});

test('perfil: "Quero ser mentor" cria o pedido pelo banco', async () => {
  const c = cenario();
  const { pagina, ctx, erros } = await abrir(c, '/perfil.html');
  await pagina.getByRole('button', { name: /Pedir para ser mentor/ }).waitFor();
  await pagina.fill('#mentoria-msg', 'Mentora na aceleradora X');
  await pagina.getByRole('button', { name: /Pedir para ser mentor/ }).click();
  await pagina.waitForTimeout(300);
  const ch = c.chamadas.find((x) => x.caminho === '/rest/v1/rpc/pedir_mentoria');
  assert.deepEqual(JSON.parse(ch.corpo), { p_mensagem: 'Mentora na aceleradora X' });
  await foto(pagina, '09-perfil');
  assert.deepEqual(erros, []);
  await ctx.close();
});

test('celular (390 px): sem rolagem horizontal no painel e no projeto', async () => {
  for (const caminho of ['/painel.html', '/projeto.html?id=' + J1, '/']) {
    const c = cenario();
    const { pagina, ctx } = await abrir(c, caminho);
    await pagina.setViewportSize({ width: 390, height: 844 });
    await pagina.waitForTimeout(400);
    const largura = await pagina.evaluate(() => document.documentElement.scrollWidth);
    assert.ok(largura <= 392, caminho + ' rola na horizontal: ' + largura);
    await ctx.close();
  }
});
