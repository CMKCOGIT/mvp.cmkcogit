// =====================================================================
// perfil.js — dados (nome e WhatsApp: as únicas colunas que o cliente altera no banco),
// CPF/CNPJ (função salvar_documento, validada no banco) e "Quero ser mentor".
// =====================================================================
(async function () {
  const perfil = await protegerPagina();
  if (!perfil) return;
  const { data: p } = await db.from('profiles').select('nome, telefone, email, documento').eq('id', perfil.id).maybeSingle();
  const nome = document.getElementById('p-nome');
  const tel = document.getElementById('p-telefone');
  const doc = document.getElementById('p-documento');
  nome.value = (p && p.nome) || '';
  tel.value = formatarTelefone((p && p.telefone) || '');
  document.getElementById('p-email').value = (p && p.email) || perfil.email || '';
  const mascara = (d) => (d && d.length === 11 ? '***.' + d.slice(3, 6) + '.' + d.slice(6, 9) + '-**' : d && d.length === 14 ? '**.' + d.slice(2, 5) + '.' + d.slice(5, 8) + '/' + d.slice(8, 12) + '-**' : '');
  document.getElementById('doc-atual').textContent = p && p.documento ? 'Cadastrado: ' + mascara(p.documento) : 'Ainda não informado.';
  if (new URLSearchParams(window.location.search).get('falta') === 'documento') { avisar('Informe seu CPF ou CNPJ para continuar com o pagamento.'); doc.focus(); }
  tel.addEventListener('input', () => { tel.value = formatarTelefone(tel.value); });
  doc.addEventListener('input', () => { doc.value = formatarDocumento(doc.value); });

  document.getElementById('form-dados').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const fone = tel.value.replace(/\D/g, '');
    if (nome.value.trim().length < 2) return toast('Informe seu nome.', 'erro');
    if (fone && !/^\d{10,11}$/.test(fone)) return toast('WhatsApp com DDD: 10 ou 11 números.', 'erro');
    const botao = ev.target.querySelector('[type=submit]');
    ocupado(botao, true, 'Salvando...');
    const { error } = await db.from('profiles').update({ nome: nome.value.trim(), telefone: fone || null }).eq('id', perfil.id);
    ocupado(botao, false);
    if (error) return toast(error.message, 'erro');
    toast('Dados salvos.');
  });

  document.getElementById('form-documento').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const d = doc.value.replace(/\D/g, '');
    if (!documentoValido(d)) return toast('CPF ou CNPJ inválido. Confira os números.', 'erro');
    const botao = ev.target.querySelector('[type=submit]');
    ocupado(botao, true, 'Salvando...');
    const { error } = await db.rpc('salvar_documento', { p_documento: d });
    ocupado(botao, false);
    if (error) return toast(error.message, 'erro');
    document.getElementById('doc-atual').textContent = 'Cadastrado: ' + mascara(d);
    doc.value = '';
    toast('Documento salvo.');
    const volta = destinoSeguro(new URLSearchParams(window.location.search).get('volta'));
    if (volta) window.location.href = volta;
  });

  document.getElementById('btn-sair-todos').addEventListener('click', () => {
    if (window.confirm('Sair de todos os dispositivos (aqui e no app)?')) sair(true);
  });
  desenharMentoria(document.getElementById('mentoria'), perfil);
})();
