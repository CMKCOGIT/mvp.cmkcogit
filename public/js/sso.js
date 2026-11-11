// =====================================================================
// sso.js — login único com o app.cmkcogit.com.br (sem cookie compartilhado). Dois papéis:
//
// 1. RECEBER (#token_hash=...&volta=...): o app mandou um código de uso único para a pessoa que já
//    está logada lá. Troca o código por uma sessão própria deste site (verifyOtp) e segue.
// 2. EMITIR (?para=app&volta=...): o app quer saber se a pessoa está logada aqui. Logada: pede o código
//    ao servidor do app (/api/sso, que só aceita destinos do ambiente) e manda para o app. Não logada:
//    devolve ao login do app com ?sso=0.
// =====================================================================
(async function () {
  const estado = document.getElementById('sso-estado');
  estado.innerHTML = carregandoCogit('Entrando...');
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));

  if (hash.get('token_hash')) {
    history.replaceState(null, '', window.location.pathname);   // o código some da barra e do histórico
    const volta = destinoSeguro(hash.get('volta')) || '/painel.html';
    const { error } = await db.auth.verifyOtp({ token_hash: hash.get('token_hash'), type: 'magiclink' });
    if (error) { window.location.replace('/entrar.html?sso=0&volta=' + encodeURIComponent(volta)); return; }
    SSO.entrou();
    window.location.replace(volta);
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const volta = /^\/(?!\/)[\w./%-]*(\?[\w=&%.-]*)?$/.test(params.get('volta') || '') ? params.get('volta') : '/inicio.html';
  if (params.get('para') !== 'app') { window.location.replace('/'); return; }
  const voltarSemLogin = () => window.location.replace(CFG.appUrl + '/login.html?sso=0');
  let saiu = false;
  try { saiu = Boolean(localStorage.getItem(SSO.SAIU)); } catch (_) {}
  if (saiu || !(await getSessao())) { voltarSemLogin(); return; }
  try {
    const r = await api('sso', { para: 'app', volta });
    if (!String(r.url).startsWith(CFG.appUrl + '/sso.html#')) throw new Error('destino inesperado');
    window.location.replace(r.url);
  } catch (_) {
    voltarSemLogin();
  }
})();
