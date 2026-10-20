import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dashboardSchema, parsePeriod, retentionRate } from '../src/dashboard.ts';

const base = {
  period_days: 30,
  privacy: { min_group_size: 5, enough_members: false, students: 2 },
  activation: { approved: 3, pending: 1 },
  attendance: {
    sessions_held: 0, sessions_cancelled: 0, validated: 0, pending: 0, revoked: 0,
    avg_validated_per_session: null, median_minutes_to_validate: null,
  },
  by_class: [],
  retention: [],
  diary: null,
  techniques: null,
};

test('the dashboard payload accepts hidden aggregates (small academies) and empty periods', () => {
  assert.equal(dashboardSchema.safeParse(base).success, true);
});

test('the dashboard payload accepts the aggregates when the academy is large enough', () => {
  const full = {
    ...base,
    privacy: { min_group_size: 5, enough_members: true, students: 6 },
    diary: { students: 6, with_entry_last_7_days: 2, percent: 33.3 },
    techniques: { total_views: 3, top: [{ technique_id: 'x', name: 'Tesoura', category: 'Raspagens', views: 2 }] },
  };
  assert.equal(dashboardSchema.safeParse(full).success, true);
  assert.equal(dashboardSchema.safeParse({ ...full, diary: { students: 6 } }).success, false);
});

test('the payload has no field that identifies a person', () => {
  const keys = JSON.stringify(Object.keys(dashboardSchema.shape));
  assert.equal(/user|person|viewer|email/i.test(keys), false);
});

test('period falls back to 30 days; retention is a rounded percentage or null', () => {
  assert.equal(parsePeriod('7'), 7);
  assert.equal(parsePeriod('90'), 90);
  assert.equal(parsePeriod('365'), 30);
  assert.equal(parsePeriod(undefined), 30);
  assert.equal(parsePeriod('abc'), 30);
  assert.equal(retentionRate({ active: 3, retained_next_week: 2 }), 67);
  assert.equal(retentionRate({ active: 0, retained_next_week: 0 }), null);
});
