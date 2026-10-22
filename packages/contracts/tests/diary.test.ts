import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAX_NOTES, saveTrainingLogSchema, trainedDateSchema, trainedDateToTimestamp } from '../src/diary.ts';

const base = () => ({ trainedDate: '2026-10-19', startTime: '07:00', notes: 'treino', techniqueIds: [], clientKey: crypto.randomUUID() });

test('trained date is a real calendar day and not in the future', () => {
  assert.equal(trainedDateSchema.safeParse('2026-10-19').success, true);
  assert.equal(trainedDateSchema.safeParse('2026-02-30').success, false);
  assert.equal(trainedDateSchema.safeParse('19/10/2026').success, false);
  assert.equal(trainedDateSchema.safeParse('2999-01-01').success, false);
  assert.equal(trainedDateToTimestamp('2026-10-19'), '2026-10-19T12:00:00Z');
});

test('log: academy and log id are optional uuids, notes are bounded', () => {
  assert.equal(saveTrainingLogSchema.safeParse(base()).success, true);
  assert.equal(saveTrainingLogSchema.parse({ ...base(), academyId: '' }).academyId, undefined);
  assert.equal(saveTrainingLogSchema.safeParse({ ...base(), academyId: 'nao-uuid' }).success, false);
  assert.equal(saveTrainingLogSchema.safeParse({ ...base(), notes: 'a'.repeat(MAX_NOTES + 1) }).success, false);
  assert.equal(saveTrainingLogSchema.parse({ trainedDate: '2026-10-19', startTime: '07:00', clientKey: crypto.randomUUID() }).notes, '');
});

test('log: techniques are uuids, at most 50, and a client key is required', () => {
  assert.equal(saveTrainingLogSchema.safeParse({ ...base(), techniqueIds: [crypto.randomUUID()] }).success, true);
  assert.equal(saveTrainingLogSchema.safeParse({ ...base(), techniqueIds: ['x'] }).success, false);
  assert.equal(
    saveTrainingLogSchema.safeParse({ ...base(), techniqueIds: Array.from({ length: 51 }, () => crypto.randomUUID()) }).success,
    false,
  );
  const { clientKey: _omit, ...withoutKey } = base();
  assert.equal(saveTrainingLogSchema.safeParse(withoutKey).success, false);
});

test('log: the start time is required (HH:MM) and the end must be after it', () => {
  assert.equal(saveTrainingLogSchema.safeParse({ ...base(), startTime: undefined }).success, false);
  assert.equal(saveTrainingLogSchema.safeParse({ ...base(), startTime: '7:00' }).success, false);
  assert.equal(saveTrainingLogSchema.safeParse({ ...base(), startTime: '24:00' }).success, false);
  assert.equal(saveTrainingLogSchema.safeParse({ ...base(), endTime: '08:30' }).success, true);
  assert.equal(saveTrainingLogSchema.parse({ ...base(), endTime: '' }).endTime, undefined);
  assert.equal(saveTrainingLogSchema.safeParse({ ...base(), endTime: '06:00' }).success, false);
  assert.equal(saveTrainingLogSchema.safeParse({ ...base(), endTime: '07:00' }).success, false);
});

test('formatTrainingTime shows the period or only the start', async () => {
  const { formatTrainingTime } = await import('../src/diary.ts');
  assert.equal(formatTrainingTime('07:00:00', '08:30:00'), '07:00 às 08:30');
  assert.equal(formatTrainingTime('07:00:00', null), '07:00');
  assert.equal(formatTrainingTime(null), null);
});
