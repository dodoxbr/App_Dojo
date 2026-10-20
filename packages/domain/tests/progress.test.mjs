import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateProgress } from '../src/progress.mjs';
test('partial progress', () => assert.deepEqual(calculateProgress({requiredAttendances:60,validatedAttendances:42}), {validatedAttendances:42,requiredAttendances:60,remaining:18,percentage:70,eligible:false,pendingMinimumDays:0}));
test('eligibility needs time too', () => assert.equal(calculateProgress({requiredAttendances:3,validatedAttendances:3,minimumDays:30,elapsedDays:10}).eligible,false));
test('eligible at threshold', () => assert.equal(calculateProgress({requiredAttendances:3,validatedAttendances:4,minimumDays:30,elapsedDays:30}).eligible,true));
test('invalid rule', () => assert.throws(() => calculateProgress({requiredAttendances:0,validatedAttendances:1})));
