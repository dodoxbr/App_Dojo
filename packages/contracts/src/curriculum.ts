import { z } from 'zod';

// Levels that exist in the imported catalog (technique_sources.level). A curriculum's level is free text.
export const catalogLevels = ['Básico', 'Intermediário', 'Avançado'] as const;

export const skillStatuses = ['not_started', 'studied', 'practicing', 'validated'] as const;
export type SkillStatus = (typeof skillStatuses)[number];
// What a student may declare about themselves. "validated" belongs to an authorised teacher.
export const selfSkillStatuses = ['not_started', 'studied', 'practicing'] as const;

export const skillStatusLabels: Record<SkillStatus, string> = {
  not_started: 'Não iniciada',
  studied: 'Estudada',
  practicing: 'Praticando',
  validated: 'Validada pelo professor',
};

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : undefined));

export const curriculumTitleSchema = z.string().trim().min(2).max(120);

export const createCurriculumSchema = z.object({
  academyId: z.uuid(),
  title: curriculumTitleSchema,
  level: optionalText(40),
  idempotencyKey: z.uuid(),
});

export const updateCurriculumSchema = z.object({
  title: curriculumTitleSchema,
  level: optionalText(40),
  isActive: z
    .string()
    .optional()
    .transform((v) => v === 'on' || v === 'true'),
});

export const levelShortcutSchema = z.enum(catalogLevels);

export const declareSkillSchema = z.object({
  academyId: z.uuid(),
  techniqueId: z.uuid(),
  status: z.enum(selfSkillStatuses),
});

export const assessSkillSchema = z.object({
  academyId: z.uuid(),
  userId: z.uuid(),
  techniqueId: z.uuid(),
  status: z.enum(skillStatuses),
  note: optionalText(500),
  idempotencyKey: z.uuid(),
});

export type TrailItem = { techniqueId: string; required: boolean };

// Summary of a trail for one person. Only teacher-validated skills count as mastered.
export function summarizeTrail(items: TrailItem[], statusByTechnique: Map<string, string>) {
  let required = 0;
  let requiredValidated = 0;
  let validated = 0;
  for (const item of items) {
    const ok = statusByTechnique.get(item.techniqueId) === 'validated';
    if (ok) validated += 1;
    if (item.required) {
      required += 1;
      if (ok) requiredValidated += 1;
    }
  }
  return { total: items.length, required, requiredValidated, validated };
}
