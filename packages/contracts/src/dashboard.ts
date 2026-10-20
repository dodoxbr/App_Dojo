import { z } from 'zod';

// Pilot indicators (docs/01). Measurement only: the system defines NO numeric goals.

export const dashboardPeriods = [7, 30, 90] as const;
export const DEFAULT_PERIOD_DAYS = 30;

const nullableNumber = z.number().nullable();

export const dashboardSchema = z.object({
  period_days: z.number(),
  privacy: z.object({ min_group_size: z.number(), enough_members: z.boolean(), students: z.number() }),
  activation: z.record(z.string(), z.number()),
  attendance: z.object({
    sessions_held: z.number(),
    sessions_cancelled: z.number(),
    validated: z.number(),
    pending: z.number(),
    revoked: z.number(),
    avg_validated_per_session: nullableNumber,
    median_minutes_to_validate: nullableNumber,
  }),
  by_class: z.array(
    z.object({
      class_id: z.string(),
      title: z.string(),
      sessions_held: z.number(),
      validated: z.number(),
      avg_validated_per_session: nullableNumber,
    }),
  ),
  retention: z.array(z.object({ week_start: z.string(), active: z.number(), retained_next_week: z.number() })),
  // null when the academy has fewer approved members than the minimum group size (privacy)
  diary: z.object({ students: z.number(), with_entry_last_7_days: z.number(), percent: z.number() }).nullable(),
  techniques: z
    .object({
      total_views: z.number(),
      top: z.array(z.object({ technique_id: z.string(), name: z.string(), category: z.string(), views: z.number() })),
    })
    .nullable(),
});
export type Dashboard = z.infer<typeof dashboardSchema>;

export function parsePeriod(value: unknown): number {
  const n = Number(value);
  return (dashboardPeriods as readonly number[]).includes(n) ? n : DEFAULT_PERIOD_DAYS;
}

export function retentionRate(entry: { active: number; retained_next_week: number }): number | null {
  return entry.active > 0 ? Math.round((100 * entry.retained_next_week) / entry.active) : null;
}

export const activationLabels: Record<string, string> = {
  approved: 'Aprovados',
  pending: 'Aguardando aprovação',
  rejected: 'Rejeitados',
  suspended: 'Suspensos',
  ended: 'Encerrados',
};
