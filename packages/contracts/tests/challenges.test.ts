import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  addEntrySchema,
  cancelChallengeSchema,
  challengeListItemSchema,
  createChallengeSchema,
  missingParticipants,
  rankingRowSchema,
  unitLabel,
} from '../src/challenges.ts';

const uuid = () => crypto.randomUUID();
// All values are test data: the system ships no default points or minimums.
const base = () => ({
  academyId: uuid(),
  title: 'Maratona de treinos',
  metric: 'training' as const,
  pointsPerUnit: 5,
  startsOn: '2026-11-01',
  endsOn: '2026-11-30',
  minParticipants: 3,
  join: true,
  idempotencyKey: uuid(),
});

test('a challenge needs the points chosen by its creator and 3 to 50 participants', () => {
  assert.equal(createChallengeSchema.safeParse(base()).success, true);
  assert.equal(createChallengeSchema.safeParse({ ...base(), pointsPerUnit: 0 }).success, false);
  assert.equal(createChallengeSchema.safeParse({ ...base(), pointsPerUnit: 1001 }).success, false);
  assert.equal(createChallengeSchema.safeParse({ ...base(), minParticipants: 2 }).success, false);
  assert.equal(createChallengeSchema.safeParse({ ...base(), minParticipants: 51 }).success, false);
  assert.equal(createChallengeSchema.safeParse({ ...base(), minParticipants: 50 }).success, true);
  assert.equal(createChallengeSchema.safeParse({ ...base(), title: 'x' }).success, false);
});

test('dates: end not before start and at most 366 days', () => {
  assert.equal(createChallengeSchema.safeParse({ ...base(), endsOn: '2026-10-31' }).success, false);
  assert.equal(createChallengeSchema.safeParse({ ...base(), endsOn: '2026-11-01' }).success, true);
  assert.equal(createChallengeSchema.safeParse({ ...base(), startsOn: '2026-01-01', endsOn: '2027-01-02' }).success, true);
  assert.equal(createChallengeSchema.safeParse({ ...base(), startsOn: '2026-01-01', endsOn: '2027-01-03' }).success, false);
  assert.equal(createChallengeSchema.safeParse({ ...base(), startsOn: '2026-02-30' }).success, false);
});

test('only technique challenges name a technique; attendance has no daily cap', () => {
  assert.equal(createChallengeSchema.safeParse({ ...base(), metric: 'technique_reps' }).success, false);
  assert.equal(createChallengeSchema.safeParse({ ...base(), metric: 'technique_reps', techniqueId: uuid() }).success, true);
  assert.equal(createChallengeSchema.safeParse({ ...base(), techniqueId: uuid() }).success, false);
  assert.equal(createChallengeSchema.safeParse({ ...base(), metric: 'attendance', maxUnitsPerDay: 2 }).success, false);
  assert.equal(createChallengeSchema.safeParse({ ...base(), maxUnitsPerDay: 2 }).success, true);
  // an empty select (form) means "no technique": fine for training, an error for a technique challenge
  assert.equal(createChallengeSchema.parse({ ...base(), techniqueId: '' as never }).techniqueId, undefined);
  assert.equal(createChallengeSchema.safeParse({ ...base(), metric: 'technique_reps', techniqueId: '' as never }).success, false);
});

test('an entry carries the day and the time the person trained', () => {
  const e = { challengeId: uuid(), date: '2026-11-03', time: '19:30', clientKey: uuid() };
  assert.equal(addEntrySchema.safeParse(e).success, true);
  assert.equal(addEntrySchema.safeParse({ ...e, time: '7:30' }).success, false);
  assert.equal(addEntrySchema.safeParse({ ...e, time: '24:00' }).success, false);
  assert.equal(addEntrySchema.safeParse({ ...e, date: '03/11/2026' }).success, false);
  assert.equal(addEntrySchema.safeParse({ ...e, units: 0 }).success, false);
  assert.equal(addEntrySchema.safeParse({ ...e, units: 10001 }).success, false);
  assert.equal(addEntrySchema.safeParse({ ...e, note: 'x'.repeat(201) }).success, false);
});

test('cancelling needs a reason', () => {
  assert.equal(cancelChallengeSchema.safeParse({ challengeId: uuid(), reason: 'ok' }).success, false);
  assert.equal(cancelChallengeSchema.safeParse({ challengeId: uuid(), reason: 'desafio duplicado' }).success, true);
});

test('server payloads parse and the ranking row carries no identifying field beyond the display name', () => {
  const row = { rank: 1, user_id: 'u', display_name: 'Aluno Um', points: 10, entries: 2, verified_entries: 1, is_me: false };
  assert.equal(rankingRowSchema.safeParse(row).success, true);
  assert.equal(/email|birth|phone/i.test(Object.keys(rankingRowSchema.shape).join()), false);
  const item = {
    id: 'a', title: 'T', description: null, metric: 'training', points_per_unit: 5, technique_id: null, technique_name: null,
    max_units_per_day: 1, starts_on: '2026-11-01', ends_on: '2026-11-30', min_participants: 3, participants: 1, state: 'open',
    joined: true, created_by_me: true,
  };
  assert.equal(challengeListItemSchema.safeParse(item).success, true);
  assert.equal(missingParticipants(challengeListItemSchema.parse(item)), 2);
  assert.equal(missingParticipants({ participants: 5, min_participants: 3, state: 'active' }), 0);
  assert.equal(unitLabel('technique_reps'), 'repetição');
});
