// GET /config.js  (vercel.json reescreve /config.js -> /api/config)
// Única função deste projeto. Entrega ao navegador SÓ configurações públicas:
// URL do Supabase + chave anon (a segurança é o RLS do banco), o endereço do app
// (pagamento, IA e escrita da Jornada ficam lá) e a chave pública do captcha.
export default function handler(req, res) {
  const env = process.env;
  const limpa = (u, padrao) => String(u || padrao).replace(/\/+$/, '');
  const config = {
    supabaseUrl: env.SUPABASE_URL || '',
    supabaseAnonKey: env.SUPABASE_ANON_KEY || '',
    appUrl: limpa(env.APP_URL, 'https://app.cmkcogit.com.br'),
    siteUrl: limpa(env.SITE_URL, 'https://www.cmkcogit.com.br'),
    // login único com o app: sessão em cookie do domínio pai (vazio = só neste endereço)
    cookieDomain: /^\.?[a-z0-9.-]+\.[a-z]{2,}$/i.test(env.COOKIE_DOMAIN || '') ? env.COOKIE_DOMAIN : '',
    turnstileSiteKey: env.TURNSTILE_SITE_KEY || '',
    whatsapp: String(env.WHATSAPP_SUPORTE || '5517981568889').replace(/\D/g, '')
  };
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=600, s-maxage=86400, stale-while-revalidate=604800');
  res.end('window.COGIT_CONFIG = Object.freeze(' + JSON.stringify(config) + ');\n');
}
