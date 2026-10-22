// Semana (segunda a domingo) no fuso da academia, para o "resumo semanal" da home do aluno.

const ymd = (date: Date, timeZone: string): string =>
  new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);

/** Dia local (AAAA-MM-DD) de um instante no fuso informado. */
export function localDay(iso: string | Date, timeZone: string): string {
  return ymd(typeof iso === "string" ? new Date(iso) : iso, timeZone);
}

/** Segunda-feira (AAAA-MM-DD) da semana local do instante `now`. */
export function weekStartLocal(now: Date, timeZone: string): string {
  const today = ymd(now, timeZone);
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" }).format(now); // Mon, Tue...
  const back = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(weekday);
  const d = new Date(`${today}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - Math.max(back, 0));
  return d.toISOString().slice(0, 10);
}

/** Quantos dos instantes caem na semana local de `now` (segunda a domingo). */
export function countInWeek(instants: string[], now: Date, timeZone: string): number {
  const start = weekStartLocal(now, timeZone);
  const end = new Date(`${start}T12:00:00Z`);
  end.setUTCDate(end.getUTCDate() + 6);
  const last = end.toISOString().slice(0, 10);
  return instants.filter((i) => {
    const day = localDay(i, timeZone);
    return day >= start && day <= last;
  }).length;
}

export type WeekDay = { date: string; label: string; isToday: boolean; isFuture: boolean };

/** Os 7 dias (segunda a domingo) da semana local de `now`, para a faixa "Esta semana" da home. */
export function weekDays(now: Date, timeZone: string): WeekDay[] {
  const start = weekStartLocal(now, timeZone);
  const today = localDay(now, timeZone);
  const labels = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
  return labels.map((label, i) => {
    const d = new Date(`${start}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + i);
    const date = d.toISOString().slice(0, 10);
    return { date, label, isToday: date === today, isFuture: date > today };
  });
}

/** Dias locais (AAAA-MM-DD) em que houve algum dos instantes. */
export function trainedDays(instants: string[], timeZone: string): Set<string> {
  return new Set(instants.map((i) => localDay(i, timeZone)));
}
