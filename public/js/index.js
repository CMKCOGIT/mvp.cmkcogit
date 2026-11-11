// =====================================================================
// index.js — página inicial pública. Logado: vira a boas-vindas, com "Começar meu projeto"
// e a opção "Quero ser mentor" (que também está no perfil).
// =====================================================================
(async function () {
  const sessao = await getSessao();
  if (!sessao) { montarTopo(null); return; }
  let perfil;
  try { perfil = await getPerfil(); } catch (e) { montarTopo(null); return; }
  if (!perfil.cadastro_concluido_em) { window.location.replace('/concluir-cadastro.html'); return; }
  montarTopo(perfil);
  const novo = new URLSearchParams(window.location.search).has('bem-vindo');
  document.getElementById('chamada-acoes').innerHTML = `<a class="botao" href="/painel.html">${icone('projetos')} Ir para meus projetos</a>`;
  const caixa = document.getElementById('boas-vindas');
  caixa.innerHTML = `<section class="duas-colunas" aria-label="Boas-vindas" style="margin-bottom:var(--s6)">
    <div class="cartao">
      <p class="rotulo">${novo ? 'Conta criada' : 'Boas-vindas'}</p>
      <h2>Olá, ${esc((perfil.nome || '').split(' ')[0] || 'tudo bem')}!</h2>
      <p>Comece um projeto para a sua ideia de software. Você pode ter vários e voltar quando quiser: tudo salva sozinho.</p>
      <p class="acoes"><a class="botao" href="/painel.html?novo=1">${icone('adicionar')} Começar meu projeto</a></p>
    </div>
    <div class="cartao cartao-azul" id="caixa-mentoria"></div>
  </section>`;
  desenharMentoria(document.getElementById('caixa-mentoria'), perfil, { titulo: 'Você orienta quem cria MVPs?' });
})();
