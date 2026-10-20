import { z } from 'zod';

// Check-in window around a session, enforced in the database (migration 012): 1 hour before the start
// until 1 hour after the end. Mirrored here only to decide when to SHOW the button.
export const CHECK_IN_BEFORE_MINUTES = 60;
export const CHECK_IN_AFTER_MINUTES = 60;
// A QR token lives at most this long (database: 15 minutes, never beyond the check-in window).
export const CHECK_IN_TOKEN_MINUTES = 15;

export function isCheckInOpen(startsAt: string, endsAt: string, status: string, nowMs: number): boolean {
  if (status !== 'scheduled') return false;
  return (
    nowMs >= new Date(startsAt).getTime() - CHECK_IN_BEFORE_MINUTES * 60_000 &&
    nowMs <= new Date(endsAt).getTime() + CHECK_IN_AFTER_MINUTES * 60_000
  );
}

// 64 hex characters = two random UUIDs without dashes (database: create_check_in_token).
export const checkInTokenSchema = z.string().regex(/^[0-9a-f]{64}$/);

export const validateAttendanceSchema = z.object({
  sessionId: z.uuid(),
  userId: z.uuid(),
  idempotencyKey: z.uuid(),
});

export const revokeAttendanceSchema = z.object({
  attendanceId: z.uuid(),
  reason: z.string().trim().min(3, 'Informe o motivo.').max(500),
});

export const attendanceStatusLabels: Record<string, string> = {
  pending: 'Aguardando confirmação do professor',
  validated: 'Presença confirmada',
  revoked: 'Presença revogada',
};

export const attendanceSourceLabels: Record<string, string> = {
  manual: 'pedido manual',
  qr: 'pedido por QR',
  teacher: 'lançada pelo professor',
};
