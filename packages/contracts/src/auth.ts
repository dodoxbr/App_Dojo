import { z } from 'zod';

// Mirrors the database constraint on profiles.display_name (2..120).
export const displayNameSchema = z.string().trim().min(2).max(120);

export const passwordSchema = z.string().min(8).max(72);

export const signInSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email()),
  password: passwordSchema,
});

export const signUpSchema = signInSchema.extend({
  displayName: displayNameSchema,
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
