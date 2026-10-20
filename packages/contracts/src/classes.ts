import { z } from 'zod';

export const classTitleSchema = z.string().trim().min(2).max(120);

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use o formato HH:MM.');

export const createClassSchema = z.object({
  academyId: z.uuid(),
  title: classTitleSchema,
  instructorUserId: z.uuid(),
  idempotencyKey: z.uuid(),
});

export const updateClassSchema = z.object({
  title: classTitleSchema,
  instructorUserId: z.uuid(),
  // HTML checkbox: present ("on") when ticked, absent otherwise
  isActive: z
    .string()
    .optional()
    .transform((v) => v === 'on' || v === 'true'),
});

// A calendar day and local times in the academy's time zone. The database converts them.
export const createSessionSchema = z
  .object({
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .refine((v) => {
        const d = new Date(`${v}T12:00:00Z`);
        return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(v);
      }),
    start: time,
    end: time,
    idempotencyKey: z.uuid(),
  })
  .refine((s) => s.end > s.start, { message: 'O fim deve ser depois do início.', path: ['end'] });

export const cancelSessionSchema = z.object({
  sessionId: z.uuid(),
  reason: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((v) => (v ? v : undefined)),
});

export const sessionStatusLabels: Record<string, string> = {
  scheduled: 'Agendada',
  cancelled: 'Cancelada',
};

// "seg., 02/11 · 19:00–20:00" in the academy's time zone.
export function formatSessionRange(startsAt: string, endsAt: string, timeZone: string): string {
  const day = new Intl.DateTimeFormat('pt-BR', { timeZone, weekday: 'short', day: '2-digit', month: '2-digit' }).format(new Date(startsAt));
  const hm = new Intl.DateTimeFormat('pt-BR', { timeZone, hour: '2-digit', minute: '2-digit', hour12: false });
  return `${day} · ${hm.format(new Date(startsAt))}–${hm.format(new Date(endsAt))}`;
}
