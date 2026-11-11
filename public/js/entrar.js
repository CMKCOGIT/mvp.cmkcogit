// =====================================================================
// entrar.js — entrar e criar conta. Iguais para todos: o papel (cliente, mentor) vem do
// banco depois do login, nunca de uma escolha aqui. O cadastro sempre cria cliente.
// Mesma conta do app.cmkcogit.com.br (mesmo Supabase). Logado no app? Entra direto (login único).
// =====================================================================
(async function () {
  const params = new URLSearchParams(window.location.search);
  const destino = destinoSeguro(params.get('volta')) || '/painel.html';
  const formLogin = document.getElementById('form-login');
  const formCadastro = document.getElementById('form-cadastro');
  const msg = document.getElementById('mensagem');
  const enviado = document.getElementById('enviado');
  const abas = { login: document.getElementById('aba-entrar'), cadastro: document.getElementById('aba-cadastro') };

  const mensagem = (texto, erro) => { msg.textContent = texto || ''; msg.setAttribute('role', erro ? 'alert' : 'status'); if (erro) msg.style.color = 'var(--perigo)'; else msg.style.color = ''; };
  const volta = (caminho) => window.location.origin + caminho;

  // já logado aqui: segue direto
  const sessao = await getSessao();
  if (sessao) { SSO.entrou(); window.location.replace(destino); return; }
  // login único: logado no app? Entra direto (o app devolve para cá com ?sso=0 se não estiver)
  if (!params.has('sso') && !params.get('error_description') && !/error_description/.test(window.location.hash) && (await SSO.disponivel())) {
    try { sessionStorage.setItem('cogit_entrar_modo', params.get('modo') || ''); } catch (_) {} // volta na mesma aba
    SSO.tentar(destino);
    return;
  }
  let modoPedido = params.get('modo');
  try { modoPedido = modoPedido || sessionStorage.getItem('cogit_entrar_modo'); sessionStorage.removeItem('cogit_entrar_modo'); } catch (_) {}
  montarTopo(null);

  function modo(qual) {
    formLogin.hidden = qual !== 'login';
    formCadastro.hidden = qual !== 'cadastro';
    enviado.hidden = true;
    abas.login.setAttribute('aria-selected', String(qual === 'login'));
    abas.cadastro.setAttribute('aria-selected', String(qual === 'cadastro'));
    mensagem('');
  }
  abas.login.addEventListener('click', () => modo('login'));
  abas.cadastro.addEventListener('click', () => modo('cadastro'));
  modo(modoPedido === 'cadastro' ? 'cadastro' : 'login');

  // erro devolvido pelo Supabase/Google na URL (link vencido, Google cancelado)
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const erroUrl = params.get('error_description') || hash.get('error_description');
  if (erroUrl) mensagem(/expired|invalid/i.test(erroUrl) ? 'O link expirou ou já foi usado. Entre ou peça outro.' : 'Não foi possível concluir: ' + erroUrl, true);

  captcha.montar(formLogin);
  captcha.montar(formCadastro);

  function traduzir(m) {
    const t = String(m || '').toLowerCase();
    if (t.includes('invalid login credentials')) return 'E-mail ou senha incorretos.';
    if (t.includes('email not confirmed')) return 'Confirme seu e-mail antes de entrar (procure o link na caixa de entrada e no spam).';
    if (t.includes('password should be at least') || t.includes('weak')) return 'Escolha uma senha mais forte (mínimo 8 caracteres).';
    if (t.includes('rate limit') || t.includes('too many')) return 'Muitas tentativas. Aguarde um pouco e tente de novo.';
    if (t.includes('captcha')) return 'A verificação de segurança falhou ou expirou. Tente de novo.';
    if (t.includes('invalid email') || t.includes('unable to validate email')) return 'E-mail inválido.';
    if (t.includes('for security purposes') || t.includes('only request this after')) return 'Por segurança, aguarde alguns segundos antes de pedir outro e-mail.';
    return m || 'Não foi possível concluir agora.';
  }

  formLogin.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const senha = document.getElementById('login-senha').value;
    if (!email || !senha) return mensagem('Preencha e-mail e senha.', true);
    const captchaToken = captcha.token(formLogin);
    if (captchaToken === null) return mensagem(AVISO_CAPTCHA, true);
    const botao = formLogin.querySelector('[type=submit]');
    ocupado(botao, true, 'Entrando...');
    const { error } = await db.auth.signInWithPassword({ email, password: senha, options: { captchaToken } });
    captcha.reiniciar(formLogin);
    if (error) {
      ocupado(botao, false);
      mensagem(traduzir(error.message), true);
      document.getElementById('reenviar').hidden = !/not confirmed/i.test(error.message);
      return;
    }
    SSO.entrou();
    window.location.href = destino;
  });

  const telefone = document.getElementById('cad-telefone');
  telefone.addEventListener('input', () => { telefone.value = formatarTelefone(telefone.value); });

  let emailEnviado = null;
  formCadastro.addEventListener('submit', async (e) => {
    e.preventDefault();
    const nome = document.getElementById('cad-nome').value.trim();
    const email = document.getElementById('cad-email').value.trim();
    const fone = telefone.value.replace(/\D/g, '');
    const senha = document.getElementById('cad-senha').value;
    if (nome.length < 2) return mensagem('Informe seu nome.', true);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return mensagem('Informe um e-mail válido.', true);
    if (fone && !/^\d{10,11}$/.test(fone)) return mensagem('WhatsApp com DDD: 10 ou 11 números.', true);
    if (senha.length < 8) return mensagem('A senha precisa ter pelo menos 8 caracteres.', true);
    if (senha !== document.getElementById('cad-senha2').value) return mensagem('As senhas não conferem.', true);
    if (!document.getElementById('cad-aceite').checked) return mensagem('Para criar a conta, aceite os Termos de Uso e a Política de Privacidade.', true);
    const captchaToken = captcha.token(formCadastro);
    if (captchaToken === null) return mensagem(AVISO_CAPTCHA, true);
    const botao = formCadastro.querySelector('[type=submit]');
    ocupado(botao, true, 'Criando conta...');
    // mesmos metadados do cadastro do app: o banco cria o perfil (sempre cliente) e registra o aceite
    const { data, error } = await db.auth.signUp({
      email, password: senha,
      options: {
        data: { nome, telefone: fone, aceite_termos_em: new Date().toISOString(), aceite_navegador: navigator.userAgent.slice(0, 400) },
        emailRedirectTo: volta('/?bem-vindo=1'),
        captchaToken
      }
    });
    captcha.reiniciar(formCadastro);
    ocupado(botao, false);
    if (error) return mensagem(traduzir(error.message), true);
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      return mensagem('Este e-mail já tem conta (aqui ou no app). Use "Entrar" ou "Esqueci minha senha".', true);
    }
    if (!data.session) {
      emailEnviado = email;
      formCadastro.hidden = true;
      enviado.hidden = false;
      document.getElementById('enviado-email').textContent = email;
      return;
    }
    SSO.entrou();
    window.location.href = '/?bem-vindo=1';
  });

  async function reenviar(form, status) {
    const email = emailEnviado || document.getElementById('login-email').value.trim();
    if (!email) return;
    const captchaToken = captcha.token(form);
    if (captchaToken === null) { status(AVISO_CAPTCHA); return; }
    const { error } = await db.auth.resend({ type: 'signup', email, options: { emailRedirectTo: volta('/?bem-vindo=1'), captchaToken } });
    captcha.reiniciar(form);
    status(error ? traduzir(error.message) : 'Enviamos um novo link para ' + email + '.');
  }
  document.getElementById('btn-reenviar').addEventListener('click', () => reenviar(formLogin, (t) => mensagem(t)));
  document.getElementById('btn-reenviar-cadastro').addEventListener('click', () => reenviar(formCadastro, (t) => { document.getElementById('status-enviado').textContent = t; }));
  document.getElementById('btn-enviado-voltar').addEventListener('click', () => modo('cadastro'));

  document.getElementById('esqueci-senha').addEventListener('click', async () => {
    const email = document.getElementById('login-email').value.trim();
    if (!email) return mensagem('Digite seu e-mail acima e clique de novo em "Esqueci minha senha".', true);
    const captchaToken = captcha.token(formLogin);
    if (captchaToken === null) return mensagem(AVISO_CAPTCHA, true);
    const { error } = await db.auth.resetPasswordForEmail(email, { redirectTo: volta('/redefinir-senha.html'), captchaToken });
    captcha.reiniciar(formLogin);
    if (error) return mensagem(traduzir(error.message), true);
    mensagem('Se este e-mail tiver conta, você receberá um link para criar uma nova senha.');
  });

  document.getElementById('btn-google').addEventListener('click', async (ev) => {
    ocupado(ev.currentTarget, true, 'Abrindo o Google...');
    const { error } = await db.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: volta('/entrar.html?volta=' + encodeURIComponent(destino)) } });
    if (error) { ocupado(ev.currentTarget, false); mensagem('Não foi possível abrir o login do Google agora.', true); }
  });
})();
