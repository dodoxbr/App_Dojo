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
  notes: z.string().max(MAX_NOTES).default(''),
  techniqueIds: z.array(z.uuid()).max(MAX_TECHNIQUES_PER_LOG).default([]),
  clientKey: z.uuid(),
});

export type SaveTrainingLogInput = z.infer<typeof saveTrainingLogSchema>;
