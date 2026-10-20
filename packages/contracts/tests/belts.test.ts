import { test } from 'node:test';
import assert from 'node:assert/strict';
import { adultBeltSuggestions, BELT_MAX_LENGTH, beltSuggestions, youthBeltSuggestions } from '../src/belts.ts';

test('belt suggestions are only names: unique, non-empty and within the database limit', () => {
  assert.equal(beltSuggestions.length, adultBeltSuggestions.length + youthBeltSuggestions.length);
  assert.equal(new Set(beltSuggestions.map((b) => b.toLowerCase())).size, beltSuggestions.length);
  for (const b of beltSuggestions) {
    assert(b.trim().length > 0 && b.length <= BELT_MAX_LENGTH, b);
  }
});

test('suggestions carry no numbers (ages, times and degrees are never imposed)', () => {
  for (const b of beltSuggestions) assert.equal(/\d/.test(b), false, b);
});
