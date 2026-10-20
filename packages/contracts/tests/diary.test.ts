import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAX_NOTES, saveTrainingLogSchema, trainedDateSchema, trainedDateToTimestamp } from '../src/diary.ts';

const base = () => ({ trainedDate: '2026-10-19', notes: 'treino', techniqueIds: [], clientKey: crypto.randomUUID() });

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
  assert.equal(saveTrainingLogSchema.parse({ trainedDate: '2026-10-19', clientKey: crypto.randomUUID() }).notes, '');
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
