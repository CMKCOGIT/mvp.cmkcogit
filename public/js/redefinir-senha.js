// redefinir-senha.js — volta do e-mail "Esqueci minha senha" (o Supabase abre a sessão pelo link).
(async function () {
  montarTopo(null);
  const form = document.getElementById('form-senha');
  // o link do e-mail traz a sessão na URL; o supabase-js lê ao iniciar
  await new Promise((ok) => setTimeout(ok, 300));
  if (!(await getSessao())) { mostrarErro('O link expirou ou já foi usado. Peça outro em "Esqueci minha senha".'); form.hidden = true; return; }
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const s1 = document.getElementById('nova-senha').value;
    if (s1.length < 8) return mostrarErro('A senha precisa ter pelo menos 8 caracteres.');
    if (s1 !== document.getElementById('nova-senha2').value) return mostrarErro('As senhas não conferem.');
    const botao = form.querySelector('[type=submit]');
    ocupado(botao, true, 'Salvando...');
    const { error } = await db.auth.updateUser({ password: s1 });
    if (error) { ocupado(botao, false); return mostrarErro(error.message); }
    toast('Senha alterada.');
    window.location.replace('/painel.html');
  });
})();
