// =====================================================================
// mentor.js — painel do mentor. Só aparece para quem tem a permissão de mentor (is_mentor, no
// banco). A lista vem de mentor_projetos(): só projetos compartilhados com ele. Sem
// compartilhamento, o RLS não entrega nada, mesmo que alguém chame o banco direto.
// =====================================================================
(async function () {
  const perfil = await protegerPagina({ mentor: true });
  if (!perfil) return;
  const lista = document.getElementById('lista-mentor');
  let total = 9;
  try { total = (await api('jornada', null, 'GET')).definicao.length; } catch (_) { /* padrão */ }
  const { data, error } = await db.rpc('mentor_projetos');
  lista.removeAttribute('aria-busy');
  if (error) { lista.innerHTML = ''; return mostrarErro('Não foi possível carregar: ' + error.message); }
  if (!data.length) {
    lista.innerHTML = `<div data-vazio style="grid-column:1/-1"><p><strong>Nenhum projeto compartilhado com você ainda.</strong></p>
      <p>Peça ao seu mentorado para abrir o projeto e usar "Compartilhar com mentor" com o e-mail <strong>${esc(perfil.email)}</strong>.</p></div>`;
    return;
  }
  lista.innerHTML = data.map((p) => `
    <article class="cartao projeto-cartao">
      ${anelHtml((p.aprovados / total) * 100, p.aprovados + ' de ' + total + ' módulos aprovados')}
      <div>
        <h3><a href="/projeto.html?id=${encodeURIComponent(p.project_id)}">${esc(p.titulo)}</a></h3>
        <p class="nota" style="margin:0">${esc(p.dono_nome || 'Mentorado')} · compartilhado em ${esc(fmtData(p.compartilhado_em))} · atualizado ${esc(tempoRelativo(p.updated_at))}</p>
        <p data-etiquetas>
          ${p.para_revisar ? `<span data-etiqueta="atencao">${p.para_revisar} para você revisar</span>` : '<span data-etiqueta="neutro">Nada para revisar</span>'}
          <span data-etiqueta="${p.tem_resumo ? 'ok' : 'neutro'}">${p.tem_resumo ? 'Resumo do orçamento pronto' : p.aprovados + ' de ' + total + ' aprovados'}</span>
        </p>
        <p class="acoes"><a class="botao" href="/projeto.html?id=${encodeURIComponent(p.project_id)}">${p.para_revisar ? 'Revisar' : 'Acompanhar'}</a></p>
      </div>
    </article>`).join('');
})();
