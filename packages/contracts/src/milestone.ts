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

export type MyMilestone = z.infer<typeof myMilestoneSchema>;
export type MilestoneStudent = z.infer<typeof milestoneStudentSchema>;

export function rankLabel(belt: string | null, degree: number | null, since: string | null): string {
  if (!belt) return 'sem graduação registrada';
  const date = since ? ` (desde ${new Date(`${since}T12:00:00Z`).toLocaleDateString('pt-BR', { timeZone: 'UTC' })})` : '';
  return `${belt}, grau ${degree ?? 0}${date}`;
}
