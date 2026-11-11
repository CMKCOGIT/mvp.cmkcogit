# mvp.cmkcogit.com.br — Jornada MVP

Para quem está criando o MVP de um software e para quem orienta essa pessoa (mentores). A pessoa responde a
Jornada em módulos, compartilha com o mentor se quiser, recebe de graça o resumo do orçamento (escopo, prazo e faixa
de investimento) e pode comprar o documento detalhado em PDF por R$ 30. No fim, "Construir com a CMK Cogit" leva o
projeto, já montado, para o app.

**Mesmo Supabase do app.cmkcogit.com.br. Este repositório não tem migrations, pagamento nem IA:** o schema, o
Mercado Pago, o Claude/Groq e a geração do PDF ficam no repositório do app (`sql/31_mvp_orcamento_mentor.sql`,
`lib/mvp-rota.js`, `lib/jornada-rota.js`). Aqui só há telas.

## Stack

Igual à do app (confirmado no repositório dele): HTML, CSS e JavaScript sem framework e sem build, servidos pela
Vercel a partir de `public/`, com **uma** função (`api/config.js`, que entrega a configuração pública). supabase-js
2.45.4 copiado em `public/js/vendor/`. Fontes Clash Display e Satoshi servidas localmente. Node 20+ só para rodar
no computador e para os testes.

## Como funciona

```
navegador (mvp) ──leitura──> Supabase (RLS decide: dono, mentor com compartilhamento)
       │                        jornadas, módulos, resumo, pedidos, comentários, funções compartilhar/mentoria
       └──escrita/pagamento/IA──> app.cmkcogit.com.br/api/jornada e /api/mvp  (CORS só para este domínio,
                                  token do Supabase no cabeçalho Authorization)
"Construir com a CMK Cogit" ──> app.cmkcogit.com.br/projeto/{id}  (só o ID; o app monta a solicitação pelo banco)
login único: sessão do Supabase num cookie de .cmkcogit.com.br (mesmo código no js/app.js dos dois sites)
```

- **Papéis vêm do banco.** Toda conta é cliente. Mentor é uma permissão adicional (`user_roles`), pedida em "Quero
  ser mentor" (só aqui: boas-vindas e perfil) e aprovada por um admin no app. O painel do mentor aparece só com
  `is_mentor()` verdadeiro; e mesmo chamando o banco direto, o mentor só lê projetos compartilhados com ele.
- **Compartilhar** exige o consentimento explícito do dono (checkbox) e pode ser desfeito a qualquer hora.
- **Revisão:** com mentor no projeto, cada módulo enviado vai para ele aprovar ou pedir ajustes; sem mentor, o módulo
  completo já fica aprovado.
- **Pagamento (R$ 30, valor configurável no banco):** pelo fluxo do app (Mercado Pago, CPF/CNPJ obrigatório como nas
  outras compras). O documento só é gerado depois do pagamento confirmado; se falhar, há nova tentativa ou estorno.
  O valor vira crédito se a pessoa contratar a CMK Cogit para o mesmo projeto no prazo.

## Páginas (rotas)

| Rota | Quem | O que faz |
|---|---|---|
| `/` | todos | Apresentação. Logado: boas-vindas com "Começar meu projeto" e "Quero ser mentor" |
| `/entrar.html` (`?modo=cadastro`, `?volta=`) | todos | Entrar / criar conta (e-mail e senha ou Google), iguais para todos, com captcha |
| `/concluir-cadastro.html` | logado sem cadastro completo | Nome, CPF/CNPJ e aceite dos termos (função `concluir_cadastro`, a mesma do app) |
| `/redefinir-senha.html` | link do e-mail | Nova senha |
| `/painel.html` | cliente | Painel do usuário: projetos, status do orçamento, baixar PDF, crédito, compartilhar com mentor, novo projeto |
| `/projeto.html?id=` | dono ou mentor do projeto | A Jornada (trilha, módulos, resumo, documento pago, "Construir com a CMK Cogit") e a conversa com o mentor |
| `/mentor.html` | mentor | Painel do mentor: projetos compartilhados com ele, o que está para revisar |
| `/perfil.html` | cliente | Nome, WhatsApp, CPF/CNPJ, "Quero ser mentor", sair de todos os dispositivos |
| `/termos.html`, `/privacidade.html` | todos | Termos de uso e Política de Privacidade (LGPD). **Texto-base: passe por revisão jurídica** |

## Pastas

```
api/config.js            única função: configuração pública (/config.js)
public/                  páginas (HTML), css/ (mvp.css + jornada.css vindo do app), js/, assets/
  js/app.js              base: sessão em cookie, captcha, cliente da API do app, proteção por papel, topo
  js/projeto.js          a Jornada (veio do public/js/jornada.js do app) + conversa com o mentor
  js/compartilhar.js     compartilhar/revogar com consentimento
  js/mentoria.js         "Quero ser mentor"
types/database.d.ts      tipos do banco (npm run tipos para gerar do banco)
tests/                   unidade (sessão em cookie, páginas) e e2e/ (Playwright com Supabase e app simulados)
tools/                   versionar.mjs (cache dos CSS/JS), gerar-tipos.mjs
dev-server.mjs           roda no computador como a Vercel (porta 3001)
```

## Rodar no computador

```bash
cp .env.example .env.local   # SUPABASE_URL e SUPABASE_ANON_KEY (os mesmos do app), APP_URL=http://localhost:3000
npm run dev                  # http://localhost:3001  (rode o app em http://localhost:3000 ao mesmo tempo)
npm test                     # unidade + conferências (sem internet)
npm run test:e2e             # navegador (Playwright + Chromium), com Supabase e app simulados
npm run versionar            # depois de mudar qualquer CSS/JS em public/
```

No computador o login único entre as duas portas não acontece (cookies de `localhost` sem domínio pai): entre nos dois.

## Tipos do Supabase

`types/database.d.ts` foi escrito a partir dos `sql/` do app. Para gerar do banco de verdade:

1. Supabase > Project Settings > General > **Reference ID** -> `SUPABASE_PROJECT_ID` no `.env.local`.
2. supabase.com/dashboard/account/tokens > **Generate new token** -> `SUPABASE_ACCESS_TOKEN` no `.env.local`
   (fica só no seu computador; não vai para a Vercel nem para o Git).
3. `npm run tipos`. Repita sempre que o app ganhar um `sql/` novo.

## Publicar (Vercel + DNS + Supabase)

1. **App primeiro:** rode `sql/31_mvp_orcamento_mentor.sql` no Supabase e publique a versão do app que tem
   `/api/mvp`, CORS (`MVP_ORIGENS=https://mvp.cmkcogit.com.br`) e `COOKIE_DOMAIN=.cmkcogit.com.br`.
2. vercel.com > Add New > Project > este repositório. Framework: **Other** (o `vercel.json` já define `public/`).
3. Environment Variables: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `APP_URL=https://app.cmkcogit.com.br`,
   `SITE_URL`, `COOKIE_DOMAIN=.cmkcogit.com.br`, `TURNSTILE_SITE_KEY`, `WHATSAPP_SUPORTE`. **Nenhuma chave secreta.**
4. Settings > Domains > `mvp.cmkcogit.com.br`; no DNS: `CNAME mvp -> cname.vercel-dns.com` (o valor que a Vercel mostrar).
5. **Supabase > Authentication > URL Configuration > Redirect URLs:** acrescente `https://mvp.cmkcogit.com.br/**`
   (e `http://localhost:3001/**`). Sem isso, confirmação de e-mail, Google e "esqueci a senha" voltam para o app.
6. **Google (login):** no Google Cloud, Authorized JavaScript origins: acrescente `https://mvp.cmkcogit.com.br`.
7. **Captcha:** widget do Cloudflare Turnstile com os domínios `app.` e `mvp.cmkcogit.com.br`; a chave pública em
   `TURNSTILE_SITE_KEY` (app e mvp) e a secreta em Supabase > Authentication > Attack Protection. Publique os dois
   sites com a chave **antes** de ligar o captcha no Supabase.
8. **Rate limit do cadastro:** Supabase > Authentication > Rate Limits (o cadastro vai direto ao Supabase). As ações
   pagas e de IA têm limite por usuário no app.

Se um dia o app mudar de endereço, acrescente-o no `connect-src` do `vercel.json`.
