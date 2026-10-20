import { z } from 'zod';

export const idSchema = z.uuid();

export const memberRoleSchema = z.enum(['student', 'instructor']);

export const addMemberSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email()),
  role: memberRoleSchema,
});

export const decideMembershipSchema = z.object({
  membershipId: z.uuid(),
  decision: z.enum(['approved', 'rejected']),
  reason: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((v) => (v ? v : undefined)),
  idempotencyKey: z.uuid(),
});

export const endMembershipSchema = z.object({
  membershipId: z.uuid(),
  reason: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((v) => (v ? v : undefined)),
});

export const membershipStatusLabels: Record<string, string> = {
  pending: 'Aguardando aprovação',
  approved: 'Aprovado',
  rejected: 'Rejeitado',
  suspended: 'Suspenso',
  ended: 'Encerrado',
};

export const membershipRoleLabels: Record<string, string> = {
  student: 'Aluno',
  instructor: 'Instrutor',
  manager: 'Gestor',
};
