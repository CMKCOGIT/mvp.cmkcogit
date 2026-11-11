// =====================================================================
// app.js — base de todas as páginas do mvp.cmkcogit.com.br.
//   supabase-js -> /config.js -> js/app.js -> js/<página>.js
// - Mesmo Supabase do app.cmkcogit.com.br. Leitura direto no banco com a sessão do usuário: o RLS
//   decide o que cada um vê (dono, mentor com compartilhamento). Nada de service_role aqui.
// - Escrita da Jornada, pagamento e IA: rotas do app (CFG.appUrl + /api/jornada e /api/mvp).
// - Login único com o app sem cookie compartilhado (objeto SSO abaixo + sso.html).
// - Papel vem do banco: cliente sempre; mentor se is_mentor() (permissão adicional, sql/31 do app).
// =====================================================================
const CFG = window.COGIT_CONFIG || {};

(function diagnosticarConfig() {
  let problema = null;
  if (!window.COGIT_CONFIG) problema = 'O arquivo /config.js não carregou. Rode com <code>npm run dev</code> e abra <code>http://localhost:3001</code>.';
  else if (!CFG.supabaseUrl || !CFG.supabaseAnonKey) problema = 'Faltam SUPABASE_URL e/ou SUPABASE_ANON_KEY (.env.local no computador; Environment Variables na Vercel).';
  else if (!window.supabase) problema = 'A biblioteca do Supabase não carregou. Recarregue a página.';
  if (!problema) return;
  const mostrar = () => document.body.insertAdjacentHTML('afterbegin', '<p id="erro" role="alert"><strong>Site não configurado.</strong> ' + problema + '</p>');
  if (document.body) mostrar(); else document.addEventListener('DOMContentLoaded', mostrar);
  throw new Error('Configuração incompleta');
})();

// ---------------------------------------------------------------------
// Login único com o app.cmkcogit.com.br SEM cookie compartilhado: a sessão fica só neste endereço
// (padrão do supabase-js), então nenhum outro subdomínio (ex.: um site de cliente em
// xxx.cmkcogit.com.br) recebe ou lê a sessão. "Entrar direto" usa um código de uso único emitido pelo
// servidor do app (sso.html dos dois sites + /api/sso do app).
// ---------------------------------------------------------------------
const SSO = {
  TENTADO: 'cogit_sso_tentado',  // sessionStorage: já tentou nesta aba (evita ir e voltar sem fim)
  SAIU: 'cogit_sso_saiu',        // localStorage: clicou em "Sair" aqui; não entra sozinho até um login manual
  pode() {
    if (!CFG.appUrl) return false;
    try { return !sessionStorage.getItem(SSO.TENTADO) && !localStorage.getItem(SSO.SAIU); } catch (_) { return false; }
  },
  // O app está com o login único ligado? (versão nova publicada e MVP_URL configurado). Se não estiver,
  // ou não responder rápido, a pessoa fica no login daqui: nunca é mandada para o app e presa lá.
  async disponivel() {
    if (!SSO.pode()) return false;
    const controle = new AbortController();
    const timer = setTimeout(() => controle.abort(), 2500);
    try {
      const r = await fetch(CFG.appUrl + '/api/sso', { signal: controle.signal });
      const d = await r.json();
      return r.ok && d.disponivel === true;
    } catch (_) { return false; } finally { clearTimeout(timer); }
  },
  // Sem sessão aqui: pergunta ao app se a pessoa já está logada lá (ele devolve nos dois casos)
  tentar(volta) {
    try { sessionStorage.setItem(SSO.TENTADO, '1'); } catch (_) {}
    window.location.replace(CFG.appUrl + '/sso.html?para=mvp&volta=' + encodeURIComponent(volta || '/painel.html'));
  },
  entrou() { try { localStorage.removeItem(SSO.SAIU); sessionStorage.removeItem(SSO.TENTADO); } catch (_) {} },
  saiu() { try { localStorage.setItem(SSO.SAIU, '1'); } catch (_) {} }
};

const db = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
});

// ---------------------------------------------------------------------
// Captcha (Cloudflare Turnstile) — mesmo comportamento do app
// ---------------------------------------------------------------------
const captcha = (function () {
  let carregando = null;
  const widgets = new Map();
  function carregar() {
    if (window.turnstile) return Promise.resolve(window.turnstile);
    carregando = carregando || new Promise((ok, falha) => {
      const s = document.createElement('script');
      s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      s.async = true;
      s.onload = () => ok(window.turnstile);
      s.onerror = () => falha(new Error('Não foi possível carregar a verificação de segurança.'));
      document.head.appendChild(s);
    });
    return carregando;
  }
  async function montar(form) {
    if (!CFG.turnstileSiteKey || !form || widgets.has(form)) return;
    const caixa = document.createElement('div');
    caixa.className = 'captcha';
    (form.querySelector('[type=submit]') || form.lastElementChild).before(caixa);
    try {
      const t = await carregar();
      widgets.set(form, t.render(caixa, { sitekey: CFG.turnstileSiteKey, language: 'pt-br', appearance: 'interaction-only' }));
    } catch (e) { console.warn(e.message); }
  }
  return {
    montar,
    token(form) {
      if (!CFG.turnstileSiteKey) return undefined;
      const id = widgets.get(form);
      return id !== undefined && window.turnstile ? window.turnstile.getResponse(id) || null : null;
    },
    reiniciar(form) {
      const id = widgets.get(form);
      if (id !== undefined && window.turnstile) window.turnstile.reset(id);
    }
  };
})();
const AVISO_CAPTCHA = 'Aguarde a verificação de segurança terminar e tente de novo.';

// ---------------------------------------------------------------------
// Formatação e utilidades
// ---------------------------------------------------------------------
function esc(v) {
  return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
const brl = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
function fmtData(d) {
  if (!d) return '-';
  return (/^\d{4}-\d{2}-\d{2}$/.test(d) ? new Date(d + 'T12:00:00') : new Date(d)).toLocaleDateString('pt-BR');
}
const fmtDataHora = (d) => (d ? new Date(d).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '-');
function tempoRelativo(d) {
  const min = Math.round((Date.now() - new Date(d).getTime()) / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return 'há ' + min + ' min';
  const h = Math.round(min / 60);
  if (h < 24) return 'há ' + h + ' h';
  const dias = Math.round(h / 24);
  return dias < 7 ? 'há ' + dias + (dias === 1 ? ' dia' : ' dias') : fmtData(d);
}
function formatarTelefone(v) {
  const d = String(v || '').replace(/\D/g, '').slice(0, 11);
  if (d.length > 10) return '(' + d.slice(0, 2) + ') ' + d.slice(2, 7) + '-' + d.slice(7);
  if (d.length > 6) return '(' + d.slice(0, 2) + ') ' + d.slice(2, 6) + '-' + d.slice(6);
  if (d.length > 2) return '(' + d.slice(0, 2) + ') ' + d.slice(2);
  return d;
}
// CPF/CNPJ: a mesma regra roda no banco (documento_valido)
function documentoValido(v) {
  const d = String(v || '').replace(/\D/g, '');
  if (!/^(\d{11}|\d{14})$/.test(d) || /^(\d)\1+$/.test(d)) return false;
  const n = [...d].map(Number);
  const dv = (pesos) => { const s = pesos.reduce((t, p, i) => t + n[i] * p, 0) % 11; return s < 2 ? 0 : 11 - s; };
  if (d.length === 11) { const p = [10, 9, 8, 7, 6, 5, 4, 3, 2]; return dv(p) === n[9] && dv([11, ...p]) === n[10]; }
  const p = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  return dv(p) === n[12] && dv([6, ...p]) === n[13];
}
function formatarDocumento(v) {
  const d = String(v || '').replace(/\D/g, '').slice(0, 14);
  const partes = d.length <= 11 ? [[3, ''], [3, '.'], [3, '.'], [2, '-']] : [[2, ''], [3, '.'], [3, '.'], [4, '/'], [2, '-']];
  let i = 0;
  return partes.map(([q, sep]) => { const p = d.slice(i, i += q); return p ? sep + p : ''; }).join('');
}
const urlMercadoPagoValida = (u) => /^https:\/\/([a-z0-9-]+\.)*mercadopago\.com(\.[a-z]{2})?\//i.test(u || '');
const MOVIMENTO_REDUZIDO = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function icone(nome, classe = '') {
  return `<svg class="i${classe ? ' ' + classe : ''}" aria-hidden="true" focusable="false"><use href="/assets/icons/bi.svg#${nome}"></use></svg>`;
}
// anel de progresso em SVG (sem degradê)
function anelHtml(pct, rotulo, grande = false) {
  const n = Math.max(0, Math.min(100, Math.round(Number(pct) || 0)));
  const c = 2 * Math.PI * 18;
  return `<span class="anel"${grande ? ' data-grande' : ''} role="img" aria-label="${esc(rotulo || n + '% concluído')}">
    <svg viewBox="0 0 40 40" aria-hidden="true"><circle class="trilho" cx="20" cy="20" r="18"/><circle class="feito" cx="20" cy="20" r="18" stroke-dasharray="${c.toFixed(2)}" stroke-dashoffset="${(c * (1 - n / 100)).toFixed(2)}"/></svg>
    <span aria-hidden="true">${n}%</span></span>`;
}
function animarNumeros() { /* sem animação de números no mvp: o valor final já nasce no HTML */ }

const SVG_CARREGANDO = '<svg viewBox="0 0 1010 1000" aria-hidden="true" focusable="false"><path class="arco" d="M815.5 781.5A438 438 0 1 1 815.5 218.5"/><g class="mk"><path d="M230 750V250L450 470L670 250V750H590V431.8L450 571.8L310 431.8V750Z"/><path d="M670 469.1L889.1 250H990.9L740.9 500L990.9 750H889.1L690 550.9L670 570.9Z"/></g></svg>';
const carregandoCogit = (t) => `<div class="cogit-carregando" role="status">${SVG_CARREGANDO}<span>${esc(t || 'Carregando...')}</span></div>`;

function toast(texto, tipo = 'ok') {
  let caixa = document.querySelector('.toasts');
  if (!caixa) { caixa = document.createElement('div'); caixa.className = 'toasts'; caixa.setAttribute('aria-live', 'polite'); document.body.appendChild(caixa); }
  const t = document.createElement('div');
  t.className = 'toast';
  t.dataset.tipo = tipo;
  t.setAttribute('role', tipo === 'erro' ? 'alert' : 'status');
  t.textContent = texto;
  caixa.appendChild(t);
  setTimeout(() => t.remove(), tipo === 'erro' ? 7000 : 4000);
}
const CONTEUDO_BOTAO = new WeakMap();
function ocupado(botao, sim, texto) {
  if (!botao) return;
  if (sim) {
    if (!CONTEUDO_BOTAO.has(botao)) CONTEUDO_BOTAO.set(botao, botao.innerHTML);
    botao.disabled = true;
    botao.setAttribute('aria-busy', 'true');
    if (texto) botao.textContent = texto;
  } else {
    botao.disabled = false;
    botao.removeAttribute('aria-busy');
    if (CONTEUDO_BOTAO.has(botao)) { botao.innerHTML = CONTEUDO_BOTAO.get(botao); CONTEUDO_BOTAO.delete(botao); }
  }
}
function mostrarErro(texto) { const el = document.getElementById('erro'); if (el) { el.textContent = texto || ''; if (texto) el.scrollIntoView({ block: 'nearest' }); } else if (texto) toast(texto, 'erro'); }
function avisar(texto) { const el = document.getElementById('aviso'); if (el) el.textContent = texto || ''; else if (texto) toast(texto); }

// ---------------------------------------------------------------------
// Sessão, perfil e papel (do banco)
// ---------------------------------------------------------------------
async function getSessao() {
  const { data } = await db.auth.getSession();
  return data.session;
}
async function getPerfil() {
  const sessao = await getSessao();
  if (!sessao) return null;
  const consultar = () => db.from('profiles').select('id, nome, email, telefone, role, cadastro_concluido_em').eq('id', sessao.user.id).maybeSingle();
  let { data, error } = await consultar();
  if (!error && !data) {
    const criado = await db.rpc('garantir_perfil');   // conta criada pelo Google ainda sem perfil
    if (!criado.error) ({ data, error } = await consultar());
  }
  if (error || !data) throw new Error('Não foi possível carregar seu cadastro agora. Verifique sua conexão e tente de novo.');
  const mentor = await db.rpc('is_mentor', {});
  return { ...data, mentor: mentor.data === true };
}

// Para onde voltar depois de entrar: só caminhos deste site
function destinoSeguro(v) {
  return /^\/[a-z0-9-]*(\.html)?([?#][\w=&%#.-]*)?$/i.test(v || '') && !/^\/\//.test(v) ? v : null;
}
function irParaEntrar() {
  const volta = window.location.pathname + window.location.search + window.location.hash;
  window.location.replace('/entrar.html?volta=' + encodeURIComponent(volta));
}

/**
 * Chame no começo de toda página logada. Sem sessão -> entrar; cadastro incompleto -> concluir;
 * { mentor: true } e sem permissão -> painel. O banco (RLS) protege os dados de qualquer jeito.
 */
async function protegerPagina({ mentor = false } = {}) {
  if (!(await getSessao())) { irParaEntrar(); return null; }
  let perfil;
  try { perfil = await getPerfil(); } catch (e) { mostrarErro(e.message); return null; }
  if (!perfil.cadastro_concluido_em) { window.location.replace('/concluir-cadastro.html'); return null; }
  if (mentor && !perfil.mentor) { window.location.replace('/painel.html'); return null; }
  montarTopo(perfil);
  return perfil;
}

// "Sair" vale para este site (o app continua logado). "Sair de todos" encerra todas as sessões.
async function sair(global = false) {
  SSO.saiu();
  await db.auth.signOut(global ? { scope: 'global' } : undefined);
  window.location.href = '/entrar.html';
}

// ---------------------------------------------------------------------
// Rotas do app (pagamento, IA, escrita da Jornada). CORS liberado lá para este domínio.
// ---------------------------------------------------------------------
async function api(caminho, corpo, metodo = 'POST') {
  const sessao = await getSessao();
  if (!sessao) { irParaEntrar(); throw Object.assign(new Error('Sua sessão expirou. Entre novamente.'), { status: 401 }); }
  let resp;
  try {
    resp = await fetch(CFG.appUrl + '/api/' + caminho, metodo === 'GET'
      ? { method: 'GET', headers: { Authorization: 'Bearer ' + sessao.access_token } }
      : { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + sessao.access_token }, body: JSON.stringify(corpo || {}) });
  } catch (_) {
    // fetch só falha assim sem resposta legível: internet caiu OU o app recusou/não tem a rota (CORS, versão antiga)
    const msg = navigator.onLine === false
      ? 'Sem conexão. Verifique sua internet e tente de novo.'
      : 'Não foi possível falar com o servidor da CMK Cogit (' + new URL(CFG.appUrl).host + '). Tente de novo em instantes; se continuar, avise a equipe.';
    console.error('Falha ao chamar ' + CFG.appUrl + '/api/' + caminho.split('?')[0] + ': confira se o app está atualizado, o APP_URL deste site e o MVP_ORIGENS do app.');
    throw Object.assign(new Error(msg), { status: 0 });
  }
  const dados = await resp.json().catch(() => ({}));
  if (resp.status === 403 && dados.codigo === 'cadastro_incompleto') window.location.replace('/concluir-cadastro.html');
  if (!resp.ok || dados.ok === false) throw Object.assign(new Error(dados.erro || 'Não foi possível concluir agora.'), { status: resp.status, codigo: dados.codigo, dados });
  return dados;
}

// ---------------------------------------------------------------------
// Topo e rodapé (as páginas só têm <header id="topo"> e <footer id="rodape">)
// ---------------------------------------------------------------------
function montarTopo(perfil) {
  const topo = document.getElementById('topo');
  if (!topo) return;
  const atual = window.location.pathname;
  const link = (href, texto, ic, longo) => `<a href="${href}"${atual === href ? ' aria-current="page"' : ''}>${icone(ic)}<span class="${longo ? 'rotulo-longo' : ''}">${texto}</span></a>`;
  topo.className = 'topo';
  topo.innerHTML = `<div class="topo-dentro">
    <a class="marca" href="${perfil ? '/painel.html' : '/'}"><img src="/assets/marca/cogit-logo-grafite.svg" alt="CMK COGIT" width="104" height="29"><span>Jornada MVP</span></a>
    <nav class="nav" aria-label="Menu principal">
      ${perfil ? `
        ${link('/painel.html', 'Jornada MVP', 'projetos', true)}
        ${perfil.mentor ? link('/mentor.html', 'Painel do mentor', 'equipe', true) : ''}
        ${link('/perfil.html', esc((perfil.nome || 'Perfil').split(' ')[0]), 'perfil')}
        <button type="button" id="btn-sair">${icone('sair')}<span class="rotulo-longo">Sair</span></button>`
      : `<a href="/entrar.html">${icone('perfil')} Entrar</a><a class="botao" href="/entrar.html?modo=cadastro">Criar conta grátis</a>`}
    </nav></div>`;
  document.getElementById('btn-sair')?.addEventListener('click', () => sair());
}
(function rodape() {
  const el = document.getElementById('rodape');
  if (!el) return;
  el.className = 'rodape';
  el.innerHTML = `<div><span>CMK COGIT · Jornada MVP</span>
    <nav aria-label="Rodapé"><a href="/termos.html">Termos de uso</a><a href="/privacidade.html">Privacidade e LGPD</a><a href="${esc(CFG.siteUrl || 'https://www.cmkcogit.com.br')}">cmkcogit.com.br</a></nav></div>`;
})();
