// =====================================================================
// concluir-cadastro.js — conta criada pelo Google (ou antiga) sem os dados obrigatórios.
// Quem grava é o banco (concluir_cadastro, a mesma função do app): nome, aceite dos termos
// e CPF/CNPJ. Só depois disso as telas e as rotas liberam o uso.
// =====================================================================
(async function () {
  if (!(await getSessao())) { irParaEntrar(); return; }
  const sessao = await getSessao();
  const { data: p } = await db.from('profiles').select('nome, telefone, documento, aceite_termos_em, cadastro_concluido_em').eq('id', sessao.user.id).maybeSingle();
  if (p && p.cadastro_concluido_em) { window.location.replace('/painel.html'); return; }
  montarTopo(null);
  const nome = document.getElementById('c-nome');
  const tel = document.getElementById('c-telefone');
  const doc = document.getElementById('c-documento');
  nome.value = (p && p.nome) || (sessao.user.user_metadata && (sessao.user.user_metadata.full_name || sessao.user.user_metadata.name)) || '';
  tel.value = formatarTelefone((p && p.telefone) || '');
  if (p && p.documento) document.getElementById('campo-documento').hidden = true;
  if (p && p.aceite_termos_em) document.getElementById('campo-aceite').hidden = true;
  tel.addEventListener('input', () => { tel.value = formatarTelefone(tel.value); });
  doc.addEventListener('input', () => { doc.value = formatarDocumento(doc.value); });

  document.getElementById('form-concluir').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    mostrarErro('');
    const documento = doc.value.replace(/\D/g, '');
    if (nome.value.trim().length < 2) return mostrarErro('Informe seu nome.');
    if (!document.getElementById('campo-documento').hidden && !documentoValido(documento)) return mostrarErro('CPF ou CNPJ inválido. Confira os números.');
    const aceite = document.getElementById('c-aceite').checked;
    if (!document.getElementById('campo-aceite').hidden && !aceite) return mostrarErro('Para continuar, aceite os Termos de Uso e a Política de Privacidade.');
    const botao = ev.target.querySelector('[type=submit]');
    ocupado(botao, true, 'Salvando...');
    const { error } = await db.rpc('concluir_cadastro', {
      p_nome: nome.value.trim(), p_telefone: tel.value.replace(/\D/g, '') || null, p_aceite: aceite, p_documento: documento || null
    });
    if (error) { ocupado(botao, false); return mostrarErro(error.message); }
    window.location.replace('/?bem-vindo=1');
  });
})();
