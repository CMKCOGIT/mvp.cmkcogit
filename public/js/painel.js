// =====================================================================
// painel.js — painel do usuário: projetos, status do orçamento, PDF, crédito e compartilhar.
// Lê direto do banco com a sessão (RLS: só o que é da pessoa). Criar projeto e baixar PDF
// passam pelo app (rotas /api/jornada e /api/mvp).
// =====================================================================
(async function () {
  const perfil = await protegerPagina();
  if (!perfil) return;
  const lista = document.getElementById('lista-projetos');
  const dlgNovo = document.getElementById('dlg-novo');
  ligarFechar(dlgNovo);

  const STATUS_DOC = {
    pending_payment: ['Documento: aguardando pagamento', 'atencao'], paid: ['Documento: preparando', 'info'], generating: ['Documento: preparando', 'info'],
    ready: ['Documento pronto', 'ok'], failed: ['Documento: falhou', 'perigo'], refunded: ['Documento estornado', 'neutro']
  };

  let total = 9;
  try { total = (await api('jornada', null, 'GET')).definicao.length; } catch (_) { /* usa o padrão */ }

  async function carregar() {
    const [js, cfg] = await Promise.all([
      db.from('jornadas').select('id, titulo, status, created_at, updated_at').eq('cliente_id', perfil.id).order('updated_at', { ascending: false }),
      db.from('mvp_pricing_config').select('price_brl, credit_valid_days').eq('id', 1).maybeSingle()
    ]);
    lista.removeAttribute('aria-busy');
    if (js.error) { lista.innerHTML = ''; return mostrarErro('Não foi possível carregar seus projetos: ' + js.error.message); }
    const projetos = js.data;
    const ids = projetos.map((p) => p.id);
    const [mods, orcs, peds, shares] = ids.length ? await Promise.all([
      db.from('jornada_modulos').select('jornada_id, status').in('jornada_id', ids),
      db.from('jornada_orcamentos').select('jornada_id, valor_min, valor_max, created_at').in('jornada_id', ids),
      db.from('mvp_budget_orders').select('id, project_id, status, price_brl, paid_at, ready_at, valid_until, credito_usado_em, created_at').eq('user_id', perfil.id).order('created_at', { ascending: false }),
      db.from('mvp_project_shares').select('project_id, mentor_user_id').eq('owner_user_id', perfil.id)
    ]) : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }];

    desenharCredito(peds.data || [], projetos, cfg.data || { price_brl: 30, credit_valid_days: 90 });
    desenharMentor();

    if (!projetos.length) {
      lista.innerHTML = `<div data-vazio><p><strong>Você ainda não tem projetos.</strong></p><p>Comece pela sua ideia: são ${total} módulos curtos e tudo salva sozinho.</p>
        <button type="button" id="btn-primeiro">${icone('adicionar')} Começar meu primeiro projeto</button></div>`;
      document.getElementById('btn-primeiro').addEventListener('click', () => dlgNovo.showModal());
      return;
    }
    lista.innerHTML = projetos.map((p) => {
      const aprov = (mods.data || []).filter((m) => m.jornada_id === p.id && m.status === 'aprovado').length;
      const revisar = (mods.data || []).filter((m) => m.jornada_id === p.id && m.status === 'enviado').length;
      const orc = (orcs.data || []).filter((o) => o.jornada_id === p.id).pop();
      const ped = (peds.data || []).find((o) => o.project_id === p.id && !(o.status === 'failed' && !o.paid_at));
      const nMentores = (shares.data || []).filter((s) => s.project_id === p.id).length;
      const doc = ped && STATUS_DOC[ped.status];
      return `<article class="cartao projeto-cartao" data-projeto="${esc(p.id)}" data-titulo="${esc(p.titulo)}">
        ${anelHtml((aprov / total) * 100, aprov + ' de ' + total + ' módulos aprovados')}
        <div>
          <h3><a href="/projeto.html?id=${encodeURIComponent(p.id)}">${esc(p.titulo)}</a></h3>
          <p class="nota" style="margin:0">Atualizado ${esc(tempoRelativo(p.updated_at))} · ${aprov} de ${total} módulos aprovados</p>
          <p data-etiquetas>
            ${revisar ? `<span data-etiqueta="info">${revisar} com o mentor</span>` : ''}
            ${orc ? `<span data-etiqueta="ok">Resumo: ${brl(orc.valor_min)} a ${brl(orc.valor_max)}</span>` : '<span data-etiqueta="neutro">Resumo ao final</span>'}
            ${doc ? `<span data-etiqueta="${doc[1]}">${doc[0]}</span>` : ''}
            <span data-etiqueta="${nMentores ? 'info' : 'neutro'}">${nMentores ? 'Compartilhado com ' + nMentores + (nMentores > 1 ? ' mentores' : ' mentor') : 'Não compartilhado'}</span>
          </p>
          <p class="acoes">
            <a class="botao" href="/projeto.html?id=${encodeURIComponent(p.id)}">${aprov === total ? 'Ver orçamento' : 'Continuar'}</a>
            ${ped && ped.status === 'ready' ? `<button type="button" class="botao-secundario" data-pdf="${esc(ped.id)}">${icone('pdf')} Baixar PDF</button>` : ''}
            <button type="button" class="botao-secundario" data-compartilhar>${icone('equipe')} Compartilhar com mentor</button>
          </p>
        </div>
      </article>`;
    }).join('');
  }

  function desenharCredito(pedidos, projetos, cfg) {
    const caixa = document.getElementById('caixa-credito');
    const dias = Number(cfg.credit_valid_days) || 0;
    const validos = pedidos.filter((p) => p.paid_at && p.status !== 'refunded' && !p.credito_usado_em && dias > 0
      && new Date(p.paid_at).getTime() + dias * 86400000 > Date.now());
    const nome = (id) => (projetos.find((p) => p.id === id) || {}).titulo || 'projeto';
    const soma = validos.reduce((t, p) => t + Number(p.price_brl), 0);
    caixa.innerHTML = `<h2>Crédito disponível</h2>
      <p class="credito"><strong>${brl(soma)}</strong></p>
      ${validos.length ? `<ul class="lista-simples">${validos.map((p) => `<li>${brl(p.price_brl)} em <strong>${esc(nome(p.project_id))}</strong><br>
        <small class="nota">vale até ${esc(fmtData(new Date(new Date(p.paid_at).getTime() + dias * 86400000).toISOString()))} ao contratar a CMK Cogit para construir este projeto</small></li>`).join('')}</ul>`
        : `<p class="nota">Ao comprar o documento detalhado (${brl(cfg.price_brl)}), o valor vira crédito se você contratar a CMK Cogit para construir o mesmo projeto em até ${dias} dias.</p>`}`;
  }

  function desenharMentor() {
    const caixa = document.getElementById('caixa-mentor');
    caixa.innerHTML = perfil.mentor
      ? `<h2>Painel do mentor</h2><p>Veja os projetos que seus mentorados compartilharam com você.</p><p class="acoes"><a class="botao-secundario" href="/mentor.html">${icone('equipe')} Abrir painel do mentor</a></p>`
      : `<h2>Tem um mentor?</h2><p class="nota">Compartilhe um projeto com ele pelo e-mail da conta dele. Ele comenta e aprova cada módulo.</p>`;
  }

  lista.addEventListener('click', async (ev) => {
    const cartao = ev.target.closest('[data-projeto]');
    if (!cartao) return;
    if (ev.target.closest('[data-compartilhar]')) abrirCompartilhar(cartao.dataset.projeto, cartao.dataset.titulo, carregar);
    const pdf = ev.target.closest('[data-pdf]');
    if (pdf) {
      ocupado(pdf, true, 'Abrindo...');
      try { window.location.href = (await api('mvp?acao=pdf&pedido_id=' + encodeURIComponent(pdf.dataset.pdf), null, 'GET')).url; } catch (e) { toast(e.message, 'erro'); }
      ocupado(pdf, false);
    }
  });

  document.getElementById('btn-novo').addEventListener('click', () => dlgNovo.showModal());
  document.getElementById('form-novo').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const titulo = document.getElementById('novo-titulo').value.trim();
    if (titulo.length < 2) return toast('Dê um nome ao seu produto ou ideia.', 'erro');
    const botao = ev.target.querySelector('[type=submit]');
    ocupado(botao, true, 'Criando...');
    try {
      const r = await api('jornada', { acao: 'iniciar', titulo });
      window.location.href = '/projeto.html?id=' + encodeURIComponent(r.jornada.id);
    } catch (e) { ocupado(botao, false); toast(e.message, 'erro'); }
  });
  if (new URLSearchParams(window.location.search).has('novo')) dlgNovo.showModal();

  await carregar();
})();
