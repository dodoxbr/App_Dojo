import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  checkInTokenSchema,
  isCheckInOpen,
  revokeAttendanceSchema,
  validateAttendanceSchema,
} from '../src/attendance.ts';

const start = '2026-11-02T22:00:00Z';
const end = '2026-11-02T23:00:00Z';
const at = (iso: string) => new Date(iso).getTime();

test('check-in window: 1h before the start until 1h after the end, scheduled only', () => {
  assert.equal(isCheckInOpen(start, end, 'scheduled', at('2026-11-02T20:59:59Z')), false);
  assert.equal(isCheckInOpen(start, end, 'scheduled', at('2026-11-02T21:00:00Z')), true);
  assert.equal(isCheckInOpen(start, end, 'scheduled', at('2026-11-02T22:30:00Z')), true);
  assert.equal(isCheckInOpen(start, end, 'scheduled', at('2026-11-03T00:00:00Z')), true);
  assert.equal(isCheckInOpen(start, end, 'scheduled', at('2026-11-03T00:00:01Z')), false);
  assert.equal(isCheckInOpen(start, end, 'cancelled', at('2026-11-02T22:30:00Z')), false);
});

test('QR token format', () => {
  assert.equal(checkInTokenSchema.safeParse('a'.repeat(64)).success, true);
  assert.equal(checkInTokenSchema.safeParse('A'.repeat(64)).success, false);
  assert.equal(checkInTokenSchema.safeParse('a'.repeat(63)).success, false);
  assert.equal(checkInTokenSchema.safeParse('../../etc').success, false);
});

test('validate and revoke inputs', () => {
  const ids = { sessionId: crypto.randomUUID(), userId: crypto.randomUUID(), idempotencyKey: crypto.randomUUID() };
  assert.equal(validateAttendanceSchema.safeParse(ids).success, true);
  assert.equal(validateAttendanceSchema.safeParse({ ...ids, userId: 'x' }).success, false);
  assert.equal(revokeAttendanceSchema.safeParse({ attendanceId: crypto.randomUUID(), reason: 'ok' }).success, false);
  assert.equal(revokeAttendanceSchema.parse({ attendanceId: crypto.randomUUID(), reason: '  lançada por engano ' }).reason, 'lançada por engano');
});
