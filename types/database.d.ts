// Tipos do banco (mesmo Supabase do app.cmkcogit.com.br) usados pelo mvp.
// Escritos À MÃO a partir de sql/01..31 do repositório do app, no formato do `supabase gen types`,
// só com as tabelas e funções que o mvp usa. Rode `npm run tipos` (README) para trocar pelo arquivo
// gerado do banco real. Uso no editor: /** @type {import('../../types/database').Database} */
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type Tabela<Row, Insert = never, Update = never> = { Row: Row; Insert: Insert; Update: Update; Relationships: [] };

export interface Database {
  public: {
    Tables: {
      profiles: Tabela<{
        id: string; nome: string | null; email: string | null; telefone: string | null;
        role: 'cliente' | 'admin'; documento: string | null; aceite_termos_em: string | null;
        cadastro_concluido_em: string | null; created_at: string;
      }, never, { nome?: string | null; telefone?: string | null }>;
      user_roles: Tabela<{ user_id: string; role: 'mentor'; granted_by: string | null; granted_at: string }>;
      mentor_requests: Tabela<{
        id: string; user_id: string; status: 'pending' | 'approved' | 'rejected'; message: string | null;
        created_at: string; reviewed_by: string | null; reviewed_at: string | null;
      }>;
      jornadas: Tabela<{ id: string; cliente_id: string; titulo: string; status: 'em_andamento' | 'concluida'; origem: 'app' | 'mvp'; created_at: string; updated_at: string }>;
      jornada_modulos: Tabela<{
        id: string; jornada_id: string; modulo: string; respostas: Json; status: 'aberto' | 'enviado' | 'ajustes' | 'aprovado';
        comentario: string | null; enviado_em: string | null; avaliado_em: string | null; avaliado_por: string | null;
        created_at: string; updated_at: string;
      }>;
      jornada_orcamentos: Tabela<{
        id: string; jornada_id: string; dados: Json; valor_min: number; valor_max: number; horas: number; gerado_por: string | null; created_at: string;
      }>;
      mvp_project_shares: Tabela<{ id: string; project_id: string; owner_user_id: string; mentor_user_id: string; created_at: string }>;
      mvp_mentor_comments: Tabela<{
        id: string; project_id: string; author_id: string; author_nome: string | null; modulo: string | null; body: string; created_at: string;
      }, { project_id: string; modulo?: string | null; body: string }>;
      mvp_pricing_config: Tabela<{
        id: number; price_brl: number; usd_brl: number; max_output_tokens: number; credit_valid_days: number;
        max_tentativas: number; validade_orcamento_dias: number; updated_at: string;
      }>;
      mvp_budget_orders: Tabela<{
        id: string; user_id: string; project_id: string; orcamento_id: string | null;
        status: 'pending_payment' | 'paid' | 'generating' | 'ready' | 'failed' | 'refunded';
        price_brl: number; pagamento_id: string | null; mp_payment_id: string | null; document_path: string | null;
        tentativas: number; tentativas_liberadas: number; erro: string | null; gerando_desde: string | null;
        paid_at: string | null; ready_at: string | null; refunded_at: string | null; valid_until: string | null;
        credito_pagamento_id: string | null; credito_usado_em: string | null; created_at: string; updated_at: string;
      }>;
    };
    Views: Record<string, never>;
    Functions: {
      is_mentor: { Args: { p_user?: string }; Returns: boolean };
      garantir_perfil: { Args: Record<string, never>; Returns: unknown };
      concluir_cadastro: { Args: { p_nome: string; p_telefone?: string | null; p_aceite?: boolean; p_documento?: string | null }; Returns: string };
      salvar_documento: { Args: { p_documento: string }; Returns: unknown };
      pedir_mentoria: { Args: { p_mensagem?: string | null }; Returns: string };
      compartilhar_projeto: { Args: { p_projeto: string; p_email: string }; Returns: string };
      revogar_compartilhamento: { Args: { p_projeto: string; p_mentor: string }; Returns: undefined };
      mentores_do_projeto: { Args: { p_projeto: string }; Returns: { mentor_user_id: string; nome: string | null; email: string | null; compartilhado_em: string }[] };
      mentor_projetos: {
        Args: Record<string, never>;
        Returns: { project_id: string; titulo: string; status: string; updated_at: string; dono_nome: string | null; compartilhado_em: string;
          total_modulos: number; aprovados: number; para_revisar: number; tem_resumo: boolean }[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
