// =====================================================================
// compartilhar.js — o dono compartilha um projeto com um mentor (consentimento explícito, LGPD).
// Tudo pelo banco: compartilhar_projeto (só o dono; só com quem é mentor aprovado),
// mentores_do_projeto e revogar_compartilhamento. Sem compartilhamento o mentor não lê nada (RLS).
// =====================================================================
function ligarFechar(dlg) {
  dlg.querySelectorAll('[data-fechar]').forEach((b) => b.addEventListener('click', () => dlg.close()));
}

async function abrirCompartilhar(projetoId, titulo, aoMudar) {
  const dlg = document.getElementById('dlg-compartilhar');
  const caixa = document.getElementById('compartilhar-conteudo');
  ligarFechar(dlg);
  async function desenhar() {
    const { data: mentores, error } = await db.rpc('mentores_do_projeto', { p_projeto: projetoId });
    if (error) { caixa.innerHTML = `<p id="erro" role="alert">${esc(error.message)}</p>`; return; }
    caixa.innerHTML = `
      <p><strong>${esc(titulo)}</strong></p>
      ${mentores.length ? `<h3>Compartilhado com</h3><ul class="lista-simples">${mentores.map((m) => `
        <li><div class="acoes" style="margin:0;justify-content:space-between">
          <span>${esc(m.nome || m.email)}<br><small class="nota">${esc(m.email || '')} · desde ${esc(fmtData(m.compartilhado_em))}</small></span>
          <button type="button" class="botao-secundario" data-revogar="${esc(m.mentor_user_id)}">Deixar de compartilhar</button></div></li>`).join('')}</ul>` : ''}
      <form id="form-compartilhar" novalidate>
        <h3>${mentores.length ? 'Adicionar outro mentor' : 'Com quem compartilhar'}</h3>
        <div class="campo"><label for="mentor-email">E-mail da conta do mentor</label>
          <input type="email" id="mentor-email" required autocomplete="off" placeholder="mentor@exemplo.com"></div>
        <div class="cartao cartao-azul" style="padding:var(--s3) var(--s4);margin-bottom:var(--s3)">
          <p style="margin:0 0 var(--s2)"><strong>O que o mentor vai ver</strong></p>
          <ul style="margin:0;padding-left:1.2em">
            <li>As respostas de todos os módulos deste projeto e o resumo do orçamento.</li>
            <li>Os comentários de vocês dois. Ele também pode aprovar ou pedir ajustes nos módulos.</li>
            <li>Ele <strong>não</strong> vê seus pagamentos, seu CPF/CNPJ, seu e-mail nem o documento em PDF.</li>
          </ul>
          <p class="nota" style="margin:var(--s2) 0 0">Você pode deixar de compartilhar quando quiser; o acesso acaba na hora.</p>
        </div>
        <label class="aceite campo"><input type="checkbox" id="consentimento" required> <span>Autorizo compartilhar os dados deste projeto com este mentor, nos termos da <a href="/privacidade.html" target="_blank" rel="noopener">Política de Privacidade</a>.</span></label>
        <button type="submit">${icone('equipe')} Compartilhar</button>
      </form>`;
    caixa.querySelector('#form-compartilhar').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const email = caixa.querySelector('#mentor-email').value.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return toast('Informe o e-mail do mentor.', 'erro');
      if (!caixa.querySelector('#consentimento').checked) return toast('Para compartilhar, marque a autorização.', 'erro');
      const botao = ev.target.querySelector('[type=submit]');
      ocupado(botao, true, 'Compartilhando...');
      const { error: e } = await db.rpc('compartilhar_projeto', { p_projeto: projetoId, p_email: email });
      ocupado(botao, false);
      if (e) return toast(e.message, 'erro');
      toast('Projeto compartilhado.');
      await desenhar();
      if (aoMudar) aoMudar();
    });
    caixa.querySelectorAll('[data-revogar]').forEach((b) => b.addEventListener('click', async () => {
      if (!window.confirm('Deixar de compartilhar com este mentor? Ele perde o acesso na hora.')) return;
      ocupado(b, true);
      const { error: e } = await db.rpc('revogar_compartilhamento', { p_projeto: projetoId, p_mentor: b.dataset.revogar });
      if (e) { ocupado(b, false); return toast(e.message, 'erro'); }
      toast('Compartilhamento encerrado.');
      await desenhar();
      if (aoMudar) aoMudar();
    }));
  }
  caixa.innerHTML = carregandoCogit();
  dlg.showModal();
  await desenhar();
}
