import { test } from 'node:test';
import assert from 'node:assert/strict';
import { COMMENT_MAX, commentInputSchema, commentReportSchema, commentSchema, daysLeft, feedPostSchema, medalSchema } from '../src/feed.ts';

const ID = '11111111-1111-4111-8111-111111111111';
const KEY = '22222222-2222-4222-8222-222222222222';

test('comentário: 1 a 300 caracteres, com espaços das pontas removidos', () => {
  assert.equal(commentInputSchema.parse({ postId: ID, body: '  Osu!  ', clientKey: KEY }).body, 'Osu!');
  assert.equal(commentInputSchema.safeParse({ postId: ID, body: '   ', clientKey: KEY }).success, false);
  assert.equal(commentInputSchema.safeParse({ postId: ID, body: 'x'.repeat(COMMENT_MAX + 1), clientKey: KEY }).success, false);
  assert.equal(commentInputSchema.safeParse({ postId: ID, body: 'x'.repeat(COMMENT_MAX), clientKey: KEY }).success, true);
  assert.equal(commentInputSchema.safeParse({ postId: 'nao-e-id', body: 'oi', clientKey: KEY }).success, false);
});

test('denúncia de comentário exige motivo de 3 a 300 caracteres', () => {
  assert.equal(commentReportSchema.safeParse({ commentId: ID, reason: 'ab' }).success, false);
  assert.equal(commentReportSchema.safeParse({ commentId: ID, reason: 'ofensivo' }).success, true);
  assert.equal(commentReportSchema.safeParse({ commentId: ID, reason: 'x'.repeat(301) }).success, false);
});

test('o que o banco devolve é aceito: comentário, medalha e post com reações', () => {
  assert.equal(commentSchema.safeParse({ id: ID, author_name: 'Ana', body: 'oi', created_at: '2026-10-20T10:00:00Z', status: 'visible', mine: false, can_manage: false, reported_by_me: false }).success, true);
  assert.equal(medalSchema.safeParse({ code: 'attendance_10', title: '10 presenças', earned_on: '2026-10-19', challenge_id: null }).success, true);
  assert.equal(feedPostSchema.safeParse({
    id: ID, author_name: 'Ana', caption: null, created_at: '2026-10-20T10:00:00Z', expires_at: '2026-11-19T10:00:00Z', has_minors: false, status: 'visible',
    hidden_reason: null, width: 10, height: 10, tags: [], mine: false, can_manage: false, reported_by_me: false, social_ok: true, reactions: 2, reacted_by_me: true, comments: 1,
  }).success, true);
});

test('dias que faltam para a foto sumir nunca é negativo', () => {
  assert.equal(daysLeft('2026-10-21T00:00:00Z', new Date('2026-10-20T00:00:00Z')), 1);
  assert.equal(daysLeft('2026-10-01T00:00:00Z', new Date('2026-10-20T00:00:00Z')), 0);
});
