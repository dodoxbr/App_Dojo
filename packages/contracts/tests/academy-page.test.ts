import { test } from 'node:test';
import assert from 'node:assert/strict';
import { academyProfileSchema, addressLine, formatClock, formatDays, joinTimes, parseTimes, scheduleSchema, instagramLink, mapsSearchLink, phoneDigits, socialHandle, whatsappLink } from '../src/academy-page.ts';

test('profile: everything is optional and a page is hidden by default', () => {
  const p = academyProfileSchema.parse({ modalities: '' });
  assert.equal(p.isPublic, false);
  assert.deepEqual(p.modalities, []);
  assert.equal(p.phone, undefined);
});

test('phone: accepts masks and +55, rejects the wrong size', () => {
  assert.equal(phoneDigits('+55 (61) 99873-1958'), '61998731958');
  assert.equal(academyProfileSchema.parse({ modalities: '', whatsapp: '(61) 99873-1958' }).whatsapp, '61998731958');
  assert.equal(academyProfileSchema.safeParse({ modalities: '', phone: '123' }).success, false);
});

test('social: handle, @handle or full link all become the handle', () => {
  const host = /instagram\.com$/i;
  assert.equal(socialHandle('@gfteam_aguasclaras', host), 'gfteam_aguasclaras');
  assert.equal(socialHandle('https://www.instagram.com/gfteam_aguasclaras/', host), 'gfteam_aguasclaras');
  assert.equal(socialHandle('instagram.com/gfteam_aguasclaras?igsh=abc', host), 'gfteam_aguasclaras');
  assert.equal(academyProfileSchema.parse({ modalities: '', instagram: '@time.teste' }).instagram, 'time.teste');
  assert.equal(academyProfileSchema.safeParse({ modalities: '', instagram: 'nome com espaço' }).success, false);
  assert.equal(instagramLink('time.teste'), 'https://www.instagram.com/time.teste/');
});

test('links must be https; javascript: and http are refused', () => {
  assert.equal(academyProfileSchema.safeParse({ modalities: '', websiteUrl: 'https://exemplo.test' }).success, true);
  assert.equal(academyProfileSchema.safeParse({ modalities: '', websiteUrl: 'http://exemplo.test' }).success, false);
  assert.equal(academyProfileSchema.safeParse({ modalities: '', mapsUrl: 'javascript:alert(1)' }).success, false);
  assert.equal(academyProfileSchema.parse({ modalities: '', mapsUrl: '  ' }).mapsUrl, undefined);
});

test('modalities: split by comma or line, no repeats, at most 12', () => {
  assert.deepEqual(academyProfileSchema.parse({ modalities: 'Jiu-Jitsu, Kids\nJiu-Jitsu; Feminino' }).modalities, ['Jiu-Jitsu', 'Kids', 'Feminino']);
  assert.equal(academyProfileSchema.safeParse({ modalities: Array.from({ length: 13 }, (_, i) => `M${i}`).join(',') }).success, false);
});

test('state is a Brazilian UF (upper-cased)', () => {
  assert.equal(academyProfileSchema.parse({ modalities: '', state: 'df' }).state, 'DF');
  assert.equal(academyProfileSchema.safeParse({ modalities: '', state: 'XX' }).success, false);
});

test('link helpers', () => {
  assert.equal(whatsappLink('61998731958'), 'https://wa.me/5561998731958');
  assert.equal(whatsappLink('61998731958', 'Olá!'), 'https://wa.me/5561998731958?text=Ol%C3%A1!');
  assert.ok(mapsSearchLink('Quadra 1', 'Águas Claras', 'DF').startsWith('https://www.google.com/maps/search/?api=1&query='));
  assert.equal(addressLine({ address: 'Quadra 1', city: 'Águas Claras', state: 'DF' }), 'Quadra 1 · Águas Claras - DF');
  assert.equal(addressLine({ address: null, city: null, state: null }), null);
});

test('schedule: days and times are formatted like the posters', () => {
  assert.equal(formatClock('07:00'), '7h');
  assert.equal(formatClock('20:30'), '20h30');
  assert.equal(joinTimes(['07:00', '09:00', '12:00']), '7h, 9h e 12h');
  assert.equal(joinTimes(['10:00']), '10h');
  assert.equal(formatDays([3, 1]), 'Seg / Qua');
  assert.equal(formatDays([1, 2, 3, 4, 5]), 'Seg a Sex');
  assert.equal(formatDays([5]), 'Sex');
});

test('schedule: free text times are parsed, bad ones refused', () => {
  assert.deepEqual(parseTimes('7h, 9h e 12h'), ['07:00', '09:00', '12:00']);
  assert.deepEqual(parseTimes('20:30'), ['20:30']);
  assert.deepEqual(parseTimes('18h30; 16:30'), ['16:30', '18:30']);
  assert.equal(parseTimes('25h'), null);
  assert.equal(parseTimes('abc'), null);
});

test('schedule: groups need a title and at least one line with days and times', () => {
  const ok = [{ title: 'Adulto', lines: [{ days: [3, 1, 1], times: ['10:00'] }] }];
  assert.deepEqual(scheduleSchema.parse(ok)[0]?.lines[0]?.days, [1, 3]);
  assert.equal(scheduleSchema.safeParse([{ title: '', lines: ok[0]!.lines }]).success, false);
  assert.equal(scheduleSchema.safeParse([{ title: 'X', lines: [] }]).success, false);
  assert.equal(scheduleSchema.safeParse([{ title: 'X', lines: [{ days: [], times: ['10:00'] }] }]).success, false);
  assert.equal(scheduleSchema.safeParse([{ title: 'X', lines: [{ days: [9], times: ['10:00'] }] }]).success, false);
  assert.equal(scheduleSchema.safeParse(Array.from({ length: 13 }, () => ok[0])).success, false);
});
