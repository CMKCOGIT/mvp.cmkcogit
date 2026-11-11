// =====================================================================
// mentoria.js — "Quero ser mentor". Existe SÓ no mvp (boas-vindas e perfil).
// Cria um pedido pendente (função pedir_mentoria do banco). A permissão só vale depois que um
// admin aprova no app; até lá o painel do mentor não aparece (o banco confere com is_mentor()).
// =====================================================================
async function desenharMentoria(caixa, perfil, { titulo = 'Quero ser mentor' } = {}) {
  if (!caixa) return;
  if (perfil.mentor) {
    caixa.innerHTML = `<h2>Você é mentor</h2><p>Os projetos que seus mentorados compartilharem aparecem no painel do mentor.</p>
      <p class="acoes"><a class="botao" href="/mentor.html">${icone('equipe')} Abrir painel do mentor</a></p>`;
    return;
  }
  const { data, error } = await db.from('mentor_requests').select('id, status, created_at, reviewed_at')
    .eq('user_id', perfil.id).order('created_at', { ascending: false }).limit(1);
  const ultimo = !error && data && data[0];
  if (ultimo && ultimo.status === 'pending') {
    caixa.innerHTML = `<h2>${esc(titulo)}</h2><p><span data-etiqueta="info">Em análise</span></p>
      <p class="nota">Pedido enviado em ${esc(fmtData(ultimo.created_at))}. A equipe da CMK Cogit vai analisar; quando aprovar, o painel do mentor aparece no menu.</p>`;
    return;
  }
  caixa.innerHTML = `<h2>${esc(titulo)}</h2>
    <p>Mentores acompanham os projetos que os mentorados compartilham: leem as respostas, comentam e aprovam cada módulo.</p>
    ${ultimo && ultimo.status === 'rejected' ? `<p class="nota">Seu pedido anterior não foi aprovado em ${esc(fmtData(ultimo.reviewed_at))}. Você pode pedir de novo contando mais sobre você.</p>` : ''}
    <form id="form-mentoria" novalidate>
      <div class="campo"><label for="mentoria-msg">Conte sobre você <small>(opcional)</small></label>
        <textarea id="mentoria-msg" rows="3" maxlength="1000" placeholder="Programa ou aceleradora, área de atuação, quantas pessoas você orienta..."></textarea></div>
      <button type="submit">${icone('equipe')} Pedir para ser mentor</button>
    </form>`;
  caixa.querySelector('#form-mentoria').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const botao = ev.target.querySelector('button');
    ocupado(botao, true, 'Enviando...');
    const { error: e } = await db.rpc('pedir_mentoria', { p_mensagem: caixa.querySelector('#mentoria-msg').value });
    if (e) { ocupado(botao, false); return toast(e.message, 'erro'); }
    toast('Pedido enviado. Avisaremos quando for analisado.');
    desenharMentoria(caixa, perfil, { titulo });
  });
}
