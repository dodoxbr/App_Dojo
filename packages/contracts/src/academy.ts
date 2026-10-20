import { z } from 'zod';

// Proposed catalog (docs/features/US-003.md). The diary is intentionally NOT grantable.
export const instructorPermissions = [
  'view_roster',
  'validate_attendance',
  'assess_skills',
  'recommend_graduation',
  'view_progress',
] as const;
export type InstructorPermission = (typeof instructorPermissions)[number];

export const instructorPermissionLabels: Record<InstructorPermission, string> = {
  view_roster: 'Ver a lista de alunos da turma',
  validate_attendance: 'Validar presença',
  assess_skills: 'Avaliar domínio técnico',
  recommend_graduation: 'Recomendar graduação',
  view_progress: 'Ver o progresso dos alunos',
};

export const academyNameSchema = z.string().trim().min(2).max(160);
export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(2)
  .max(63)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/);
export const hexColorSchema = z.string().regex(/^#[0-9A-Fa-f]{6}$/);

// WCAG 2.x. Must match public.contrast_ratio in the database (enforced there as well).
export const MIN_THEME_CONTRAST = 4.5;

function channel(hex: string, index: number) {
  const v = parseInt(hex.slice(1 + index * 2, 3 + index * 2), 16) / 255;
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}
function luminance(hex: string) {
  return 0.2126 * channel(hex, 0) + 0.7152 * channel(hex, 1) + 0.0722 * channel(hex, 2);
}
export function contrastRatio(a: string, b: string) {
  const [x, y] = [luminance(a), luminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

export const themeSchema = z
  .object({
    name: academyNameSchema,
    themePrimary: hexColorSchema,
    themeSecondary: hexColorSchema,
  })
  .refine((t) => contrastRatio(t.themePrimary, t.themeSecondary) >= MIN_THEME_CONTRAST, {
    message: 'Contraste insuficiente entre as cores.',
    path: ['themeSecondary'],
  });

export const createAcademySchema = z.object({
  name: academyNameSchema,
  slug: slugSchema,
  idempotencyKey: z.uuid(),
});

export const grantCreatorSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email()),
});

export const instructorPermissionSchema = z.enum(instructorPermissions);

export type ThemeInput = z.infer<typeof themeSchema>;
export type CreateAcademyInput = z.infer<typeof createAcademySchema>;
