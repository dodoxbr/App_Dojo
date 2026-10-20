import { z } from 'zod';

// Each academy registers its own rules (CLAUDE.md rule 2): nothing here carries official graduation numbers.

export const criterionKinds = ['min_days', 'attendance', 'curriculum', 'manual'] as const;
export type CriterionKind = (typeof criterionKinds)[number];

export const criterionKindLabels: Record<CriterionKind, string> = {
  min_days: 'Tempo desde a última graduação',
  attendance: 'Assiduidade (presenças validadas)',
  curriculum: 'Nível técnico (currículo)',
  manual: 'Avaliação do professor (ex.: comprometimento)',
};

const label = z.string().trim().min(2).max(120);

export const ruleCriterionSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('min_days'), label, minDays: z.number().int().min(1).max(3650) }),
  z.object({
    kind: z.literal('attendance'),
    label,
    minAttendances: z.number().int().min(1).max(5000),
    windowDays: z.number().int().min(1).max(3650).optional(),
    // count distinct days instead of sessions (two lessons on the same day count once)
    distinctDays: z.boolean().default(false),
  }),
  z.object({ kind: z.literal('curriculum'), label, curriculumId: z.uuid(), minPercent: z.number().int().min(1).max(100) }),
  z.object({ kind: z.literal('manual'), label }),
]);
export type RuleCriterion = z.infer<typeof ruleCriterionSchema>;

const normalizeLabel = (v: string) =>
  v.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((v) => {
    const d = new Date(`${v}T12:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(v);
  });

export const createRuleSchema = z.object({
  academyId: z.uuid(),
  beltCode: z.string().trim().min(1).max(40),
  degree: z.number().int().min(0).max(20),
  title: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform((v) => (v ? v : undefined)),
  effectiveFrom: isoDate,
  criteria: z
    .array(ruleCriterionSchema)
    .min(1)
    .max(20)
    .refine((list) => new Set(list.map((c) => normalizeLabel(c.label))).size === list.length, {
      message: 'Os critérios precisam ter nomes diferentes.',
    }),
  idempotencyKey: z.uuid(),
});
export type CreateRuleInput = z.infer<typeof createRuleSchema>;

// Shape expected by public.create_promotion_rule (snake_case jsonb).
export function toDbCriteria(criteria: RuleCriterion[]) {
  return criteria.map((c) => {
    switch (c.kind) {
      case 'min_days':
        return { kind: c.kind, label: c.label, min_days: c.minDays };
      case 'attendance':
        return {
          kind: c.kind,
          label: c.label,
          min_attendances: c.minAttendances,
          ...(c.windowDays ? { window_days: c.windowDays } : {}),
          distinct_days: c.distinctDays,
        };
      case 'curriculum':
        return { kind: c.kind, label: c.label, curriculum_id: c.curriculumId, min_percent: c.minPercent };
      case 'manual':
        return { kind: c.kind, label: c.label };
    }
  });
}

export const registerRankSchema = z.object({
  academyId: z.uuid(),
  userId: z.uuid(),
  beltCode: z.string().trim().min(1).max(40),
  degree: z.number().int().min(0).max(20),
  effectiveDate: isoDate.refine((v) => new Date(`${v}T00:00:00Z`).getTime() <= Date.now() + 24 * 60 * 60 * 1000, {
    message: 'A data não pode estar no futuro.',
  }),
  reason: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((v) => (v ? v : undefined)),
  idempotencyKey: z.uuid(),
});

export const assessManualSchema = z.object({
  academyId: z.uuid(),
  userId: z.uuid(),
  label,
  met: z.boolean(),
  note: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((v) => (v ? v : undefined)),
  idempotencyKey: z.uuid(),
});

// Result of public.evaluate_promotion. It is a RECOMMENDATION; promoting is a separate, authorised decision.
export const evaluationSchema = z.object({
  has_rank: z.boolean(),
  has_rule: z.boolean(),
  eligible: z.boolean(),
  recommendation_only: z.literal(true),
  rank: z.object({ belt_code: z.string(), degree: z.number(), effective_date: z.string() }).optional(),
  rule: z.object({ id: z.string(), version: z.number(), title: z.string().nullable(), effective_from: z.string() }).optional(),
  criteria: z
    .array(
      z.object({
        id: z.string(),
        label: z.string(),
        kind: z.enum(criterionKinds),
        met: z.boolean(),
        current: z.number().nullable(),
        target: z.number().nullable(),
        detail: z.string().nullable(),
      }),
    )
    .optional(),
});
export type Evaluation = z.infer<typeof evaluationSchema>;

export function progressText(c: { kind: CriterionKind; current: number | null; target: number | null; detail: string | null }): string {
  if (c.kind === 'manual') return c.detail ?? '';
  const unit = c.kind === 'curriculum' ? '%' : '';
  return `${c.current ?? 0}${unit} de ${c.target ?? 0}${unit} — ${c.detail ?? ''}`;
}
