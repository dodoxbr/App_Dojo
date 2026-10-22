import { z } from 'zod';

export const MAX_NOTES = 10000;
export const MAX_TECHNIQUES_PER_LOG = 50;
export const DIARY_PAGE_SIZE = 20;

// A calendar day ("YYYY-MM-DD"). Stored at 12:00 UTC so the day does not shift across time zones.
export const trainedDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((v) => {
    const d = new Date(`${v}T12:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(v);
  })
  .refine((v) => new Date(`${v}T12:00:00Z`).getTime() <= Date.now() + 24 * 60 * 60 * 1000, {
    message: 'A data não pode estar no futuro.',
  });

export function trainedDateToTimestamp(date: string): string {
  return `${date}T12:00:00Z`;
}

// Hora local do treino ("07:00"). O navegador manda HH:MM; vazio = sem horário.
export const trainingTimeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'Informe a hora no formato 07:00.' });

export function formatTrainingTime(start: string | null | undefined, end?: string | null): string | null {
  if (!start) return null;
  const hm = (t: string) => t.slice(0, 5);
  return end ? `${hm(start)} às ${hm(end)}` : hm(start);
}

export const saveTrainingLogSchema = z.object({
  logId: z
    .string()
    .optional()
    .transform((v) => (v ? v : undefined))
    .pipe(z.uuid().optional()),
  // empty = personal training (no academy)
  academyId: z
    .string()
    .optional()
    .transform((v) => (v ? v : undefined))
    .pipe(z.uuid().optional()),
  trainedDate: trainedDateSchema,
  // O horário de início é obrigatório na tela nova (o término é opcional e, se vier, tem de ser depois do início).
  startTime: trainingTimeSchema,
  endTime: z
    .string()
    .optional()
    .transform((v) => (v ? v : undefined))
    .pipe(trainingTimeSchema.optional()),
  notes: z.string().max(MAX_NOTES).default(''),
  techniqueIds: z.array(z.uuid()).max(MAX_TECHNIQUES_PER_LOG).default([]),
  clientKey: z.uuid(),
}).refine((v) => !v.endTime || v.endTime > v.startTime, {
  message: 'O término tem de ser depois do início.',
  path: ['endTime'],
});

export type SaveTrainingLogInput = z.infer<typeof saveTrainingLogSchema>;
