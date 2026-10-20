/** Pure eligibility computation; never authorizes or grants promotion. */
export function calculateProgress({ requiredAttendances, validatedAttendances, minimumDays = 0, elapsedDays = 0 }) {
  if (!Number.isInteger(requiredAttendances) || requiredAttendances <= 0) throw new Error('Invalid rule');
  if (![validatedAttendances, minimumDays, elapsedDays].every(v => Number.isInteger(v) && v >= 0)) throw new Error('Invalid input');
  const remaining = Math.max(0, requiredAttendances - validatedAttendances);
  const eligible = remaining === 0 && elapsedDays >= minimumDays;
  return { validatedAttendances, requiredAttendances, remaining, percentage: Math.min(100, Math.round(100 * validatedAttendances / requiredAttendances)), eligible, pendingMinimumDays: Math.max(0, minimumDays - elapsedDays) };
}
