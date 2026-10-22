import { z } from 'zod';
import { birthDateSchema, displayNameSchema, isAdultOn } from '@dojo/contracts/auth';

// US-013 (part 2): the adult guardian creates and answers for the minor's account (dependent).
export const relationshipSchema = z.string().trim().min(2).max(40);

// Only minors are dependents; an adult must have their own account.
export const createDependentSchema = z.object({
  displayName: displayNameSchema,
  birthDate: birthDateSchema.refine((v) => !isAdultOn(v), 'Quem tem 18 anos ou mais deve ter a própria conta.'),
  relationship: relationshipSchema,
  idempotencyKey: z.uuid(),
});

export const requestDependentSchema = z.object({
  minorId: z.uuid(),
  academyId: z.uuid(),
  photos: z.boolean(),
  social: z.boolean().default(false),
  // Nome completo digitado: obrigatório quando se autoriza fotos (termo de uso de imagem).
  signature: z.string().trim().max(120).optional(),
});

export const verifyConsentSchema = z.object({
  consentId: z.uuid(),
  documentChecked: z.literal(true, { error: 'Confirme que o documento do responsável foi conferido pessoalmente.' }),
  note: z.string().trim().max(500).optional().transform((v) => (v ? v : undefined)),
});

// Invite code of the financial responsible (10 letters/digits; typed by hand, so case and spaces are forgiven).
export const inviteCodeSchema = z.string().trim().toUpperCase().regex(/^[A-Z0-9]{10}$/, 'Código inválido.');

export const acceptFinancialSchema = z.object({ code: inviteCodeSchema, relationship: relationshipSchema });

export const guardianKindLabels: Record<string, string> = {
  legal: 'Responsável legal',
  financial: 'Responsável financeiro',
};

export const dependentRowSchema = z.object({
  minor_user_id: z.uuid(),
  minor_name: z.string(),
  kind: z.enum(['legal', 'financial']),
  relationship: z.string(),
  minor_is_adult: z.boolean(),
});

export const consentRowSchema = z.object({
  id: z.uuid(),
  minor_user_id: z.uuid(),
  minor_name: z.string(),
  guardian_name: z.string(),
  relationship: z.string(),
  status: z.enum(['pending', 'verified']),
  consent_active: z.boolean(),
  consent_photos: z.boolean(),
  consent_social: z.boolean(),
  membership_status: z.string().nullable(),
  created_at: z.string(),
  photo_signed_name: z.string().nullable().optional(),
  photo_signed_at: z.string().nullable().optional(),
});

export const ageFlagSchema = z.object({ user_id: z.uuid(), is_minor: z.boolean(), guardian_ready: z.boolean() });

export const overviewSchema = z.object({
  minor: z.object({ id: z.uuid(), display_name: z.string() }).nullable(),
  academies: z.array(
    z.object({
      consent_id: z.uuid(),
      academy_id: z.uuid(),
      name: z.string(),
      consent_status: z.enum(['pending', 'verified']),
      consent_active: z.boolean(),
      consent_photos: z.boolean(),
      consent_social: z.boolean().default(false),
      membership_status: z.string().nullable(),
      validated_attendances_30_days: z.number().nullable(),
      rank: z.object({ belt_code: z.string(), degree: z.number(), since: z.string() }).nullable(),
      next_sessions: z.array(z.object({ title: z.string(), starts_at: z.string(), ends_at: z.string() })).nullable(),
    }),
  ),
});

// What the guardian is told about each academy: the next step in the paperwork.
export function consentStepLabel(a: { consent_status: string; consent_active: boolean; membership_status: string | null }): string {
  if (!a.consent_active) return 'Consentimento revogado. O menor está suspenso nesta academia.';
  if (a.consent_status === 'pending') return 'Aguardando o gestor conferir o seu documento pessoalmente na academia.';
  if (a.membership_status === 'approved') return 'Matrícula ativa.';
  if (a.membership_status === 'pending') return 'Documento conferido. Aguardando o gestor aprovar a matrícula.';
  return 'Sem matrícula ativa.';
}

export type CreateDependentInput = z.infer<typeof createDependentSchema>;
export type DependentRow = z.infer<typeof dependentRowSchema>;
export type ConsentRow = z.infer<typeof consentRowSchema>;
export type Overview = z.infer<typeof overviewSchema>;
