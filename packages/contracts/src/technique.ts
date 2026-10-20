import { z } from 'zod';

// Mirrors the limits enforced by public.create_technique / update_technique.
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : undefined));

export const techniqueInputSchema = z.object({
  name: z.string().trim().min(2).max(160),
  category: z.string().trim().min(2).max(80),
  level: optionalText(40),
  description: optionalText(4000),
  type: optionalText(60),
  position: optionalText(60),
});

export const createTechniqueSchema = techniqueInputSchema.extend({
  // empty/undefined = global catalog (platform admin only)
  academyId: z
    .string()
    .optional()
    .transform((v) => (v ? v : undefined))
    .pipe(z.uuid().optional()),
  idempotencyKey: z.uuid(),
});

export const aliasSchema = z.string().trim().min(2).max(120);

export const classificationStatusLabels: Record<string, string> = {
  proposed: 'proposta a partir de fontes públicas, ainda não validada',
  validated: 'validada',
};

export const PAGE_SIZE = 30;

export const techniqueSearchSchema = z.object({
  q: z.string().trim().max(100).optional().catch(undefined),
  category: z.string().trim().max(80).optional().catch(undefined),
  type: z.string().trim().max(60).optional().catch(undefined),
  position: z.string().trim().max(60).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(1000).catch(1),
});

export type TechniqueInput = z.infer<typeof techniqueInputSchema>;
