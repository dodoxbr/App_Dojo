import { z } from 'zod';

// Challenges between members (docs/features/F2-desafios.md). Points are defined by whoever creates the challenge:
// there are no default values here. Mirrors the limits enforced by the database (migration 020).

export const challengeMetrics = ['attendance', 'training', 'technique_reps'] as const;
export type ChallengeMetric = (typeof challengeMetrics)[number];

export const challengeMetricLabels: Record<ChallengeMetric, string> = {
  attendance: 'Presenças validadas (automático)',
  training: 'Treinos informados por você (dia e hora)',
  technique_reps: 'Golpe: repetições de uma técnica',
};

export const challengeStateLabels: Record<string, string> = {
  open: 'Aguardando participantes',
  scheduled: 'Ativado, começa em breve',
  active: 'Em andamento',
  finished: 'Encerrado',
  expired: 'Encerrado sem participantes suficientes',
  cancelled: 'Cancelado',
};

export const MIN_PARTICIPANTS_RANGE = { min: 3, max: 50 } as const;
export const MAX_CHALLENGE_DAYS = 366;

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((v) => {
    const d = new Date(`${v}T12:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(v);
  });

const intField = (min: number, max: number) => z.number().int().min(min).max(max);

export const createChallengeSchema = z
  .object({
    academyId: z.uuid(),
    title: z.string().trim().min(2).max(120),
    description: z
      .string()
      .trim()
      .max(1000)
      .optional()
      .transform((v) => (v ? v : undefined)),
    metric: z.enum(challengeMetrics),
    pointsPerUnit: intField(1, 1000),
    techniqueId: z
      .string()
      .optional()
      .transform((v) => (v ? v : undefined))
      .pipe(z.uuid().optional()),
    maxUnitsPerDay: intField(1, 10000).optional(),
    startsOn: isoDate,
    endsOn: isoDate,
    minParticipants: intField(MIN_PARTICIPANTS_RANGE.min, MIN_PARTICIPANTS_RANGE.max),
    join: z.boolean().default(true),
    idempotencyKey: z.uuid(),
  })
  .refine((c) => (c.metric === 'technique_reps') === (c.techniqueId !== undefined), {
    message: 'Escolha a técnica apenas em desafios de golpe.',
    path: ['techniqueId'],
  })
  .refine((c) => !(c.metric === 'attendance' && c.maxUnitsPerDay !== undefined), {
    message: 'Presença é automática e não tem limite diário.',
    path: ['maxUnitsPerDay'],
  })
  .refine((c) => c.endsOn >= c.startsOn, { message: 'O fim deve ser depois do início.', path: ['endsOn'] })
  .refine((c) => (new Date(`${c.endsOn}T00:00:00Z`).getTime() - new Date(`${c.startsOn}T00:00:00Z`).getTime()) / 86_400_000 <= MAX_CHALLENGE_DAYS, {
    message: `A duração máxima é de ${MAX_CHALLENGE_DAYS} dias.`,
    path: ['endsOn'],
  });
export type CreateChallengeInput = z.infer<typeof createChallengeSchema>;

export const addEntrySchema = z.object({
  challengeId: z.uuid(),
  date: isoDate,
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use o formato HH:MM.'),
  units: intField(1, 10000).optional(),
  note: z
    .string()
    .trim()
    .max(200)
    .optional()
    .transform((v) => (v ? v : undefined)),
  clientKey: z.uuid(),
});

export const cancelChallengeSchema = z.object({
  challengeId: z.uuid(),
  reason: z.string().trim().min(3, 'Informe o motivo.').max(500),
});

// Shapes returned by list_challenges / challenge_ranking / my_challenge_entries / list_challenge_entries.
export const challengeListItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  metric: z.enum(challengeMetrics),
  points_per_unit: z.number(),
  technique_id: z.string().nullable(),
  technique_name: z.string().nullable(),
  max_units_per_day: z.number().nullable(),
  starts_on: z.string(),
  ends_on: z.string(),
  min_participants: z.number(),
  participants: z.number(),
  state: z.string(),
  joined: z.boolean(),
  created_by_me: z.boolean(),
});
export type ChallengeListItem = z.infer<typeof challengeListItemSchema>;

export const rankingRowSchema = z.object({
  rank: z.number(),
  user_id: z.string(),
  display_name: z.string(),
  points: z.number(),
  entries: z.number(),
  verified_entries: z.number(),
  is_me: z.boolean(),
});
export type RankingRow = z.infer<typeof rankingRowSchema>;

export const myEntrySchema = z.object({
  id: z.string(),
  occurred_at: z.string(),
  units: z.number(),
  note: z.string().nullable(),
  verified: z.boolean(),
  voided: z.boolean(),
});

export function unitLabel(metric: ChallengeMetric): string {
  return metric === 'attendance' ? 'presença validada' : metric === 'training' ? 'treino' : 'repetição';
}

// "ainda faltam 2 participantes" while the challenge waits to reach its minimum.
export function missingParticipants(c: { participants: number; min_participants: number; state: string }): number {
  return c.state === 'open' ? Math.max(0, c.min_participants - c.participants) : 0;
}
