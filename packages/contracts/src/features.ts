import { z } from 'zod';

// Pacotes por academia: funcionalidades OPCIONAIS que cada pacote liga ou desliga. O núcleo (conta, filiação, turmas e aulas, presença,
// diário, técnicas, graduação, menores e responsáveis, saúde, termos) nunca depende de pacote. A mesma lista existe no banco
// (public.feature_catalog) e é conferida por teste.
export const featureKeys = ['finance', 'feed', 'challenges', 'medals', 'dashboard', 'curriculum', 'milestone'] as const;
export type FeatureKey = (typeof featureKeys)[number];

export const featureLabels: Record<FeatureKey, string> = {
  finance: 'Financeiro manual',
  feed: 'Feed de fotos, reações e comentários',
  challenges: 'Desafios entre alunos',
  medals: 'Medalhas',
  dashboard: 'Painel de frequência e indicadores',
  curriculum: 'Trilhas e avaliações de domínio',
  milestone: 'Aviso de treinos por professor',
};

export const isFeatureKey = (v: unknown): v is FeatureKey => typeof v === 'string' && (featureKeys as readonly string[]).includes(v);

export const planRowSchema = z.object({
  code: z.string(),
  name: z.string(),
  position: z.number(),
  features: z.array(z.string()),
});

export const academyFeaturesRowSchema = z.object({
  academy_id: z.uuid(),
  plan_code: z.string(),
  features: z.array(z.string()),
});

export const setPlanSchema = z.object({ academyId: z.uuid(), planCode: z.string().regex(/^[a-z_]{3,30}$/) });

/** Só as chaves conhecidas (o banco também confere). */
export function knownFeatures(list: readonly string[]): FeatureKey[] {
  return list.filter(isFeatureKey);
}

export const featureOffMessage = (feature: FeatureKey) => `${featureLabels[feature]} não está incluído no pacote desta academia.`;
