import { z } from 'zod';

// US-020: aviso quando o aluno chega a 30 treinos desde a última graduação (calculado pelo banco; o valor 30 vem do professor).
export const MILESTONE_THRESHOLD = 30;

const milestoneBase = {
  academy_id: z.uuid(),
  academy_name: z.string(),
  attendances: z.number(),
  belt_code: z.string().nullable(),
  degree: z.number().nullable(),
  rank_since: z.string().nullable(),
};
export const myMilestoneSchema = z.object(milestoneBase);
export const staffMilestoneSchema = z.object({ academy_id: z.uuid(), academy_name: z.string(), students: z.number() });
export const milestoneStudentSchema = z.object({
  user_id: z.uuid(),
  person_name: z.string(),
  is_minor: z.boolean(),
  belt_code: z.string().nullable(),
  degree: z.number().nullable(),
  rank_since: z.string().nullable(),
  attendances: z.number(),
});
export const milestoneSummarySchema = z.object({
  person_name: z.string(),
  is_minor: z.boolean(),
  belt_code: z.string().nullable(),
  degree: z.number().nullable(),
  rank_since: z.string().nullable(),
  attendances: z.number(),
  threshold: z.number(),
  health_visible: z.boolean(),
  health_notes: z.string().nullable(),
});

// Cada professor decide o seu número (padrão 30) ou desliga o aviso.
export const MILESTONE_MAX = 1000;
export const milestoneSettingInputSchema = z.object({
  threshold: z.coerce.number().int('Use um número inteiro.').min(1, 'O número de treinos vai de 1 a 1000.').max(MILESTONE_MAX, 'O número de treinos vai de 1 a 1000.'),
  enabled: z.boolean(),
});
export const milestoneSettingSchema = z.object({ threshold: z.number(), enabled: z.boolean(), is_default: z.boolean() });

export type MyMilestone = z.infer<typeof myMilestoneSchema>;
export type MilestoneStudent = z.infer<typeof milestoneStudentSchema>;

export function rankLabel(belt: string | null, degree: number | null, since: string | null): string {
  if (!belt) return 'sem graduação registrada';
  const date = since ? ` (desde ${new Date(`${since}T12:00:00Z`).toLocaleDateString('pt-BR', { timeZone: 'UTC' })})` : '';
  return `${belt}, grau ${degree ?? 0}${date}`;
}
