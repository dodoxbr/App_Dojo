import { z } from 'zod';

// Mirrors the database constraint on profiles.display_name (2..120).
export const displayNameSchema = z.string().trim().min(2).max(120);

export const passwordSchema = z.string().min(8).max(72);

export const signInSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email()),
  password: passwordSchema,
});

// Age of majority (premise to confirm, docs/11). Minors cannot join an academy until the guardian flow exists.
export const ADULT_AGE = 18;

export const birthDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((v) => {
    const d = new Date(`${v}T12:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(v);
  }, 'Data inválida.')
  .refine((v) => v >= '1900-01-01', 'Data inválida.')
  .refine((v) => new Date(`${v}T00:00:00Z`).getTime() <= Date.now() + 24 * 60 * 60 * 1000, 'A data não pode estar no futuro.');

// True when the person is at least ADULT_AGE on the given day (default: today, UTC).
export function isAdultOn(birthDate: string, today: Date = new Date()): boolean {
  const [y, m, d] = birthDate.split('-').map(Number) as [number, number, number];
  const t = [today.getUTCFullYear(), today.getUTCMonth() + 1, today.getUTCDate()] as const;
  const years = t[0] - y - (t[1] < m || (t[1] === m && t[2] < d) ? 1 : 0);
  return years >= ADULT_AGE;
}

// The checkbox "Esta conta é para cuidar de um menor": the adult fills in the minor's data, which is only a prefill for the
// dependent registration after the e-mail is confirmed (the database validates everything again).
export const signUpSchema = signInSchema.extend({
  displayName: displayNameSchema,
  birthDate: birthDateSchema,
  forMinor: z.preprocess((v) => v === 'on' || v === true, z.boolean()),
  dependentName: z.string().trim().max(120).optional().transform((v) => (v ? v : undefined)),
  dependentBirthDate: z.union([birthDateSchema, z.literal('')]).optional().transform((v) => (v ? v : undefined)),
});

// Post-login redirect target: internal paths only (prevents open redirects).
export function safeRedirectPath(value: unknown, fallback = '/perfil'): string {
  if (typeof value !== 'string') return fallback;
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\') || /[\u0000-\u001f]/.test(value)) {
    return fallback;
  }
  return value;
}

export type SignInInput = z.infer<typeof signInSchema>;
export type SignUpInput = z.infer<typeof signUpSchema>;
