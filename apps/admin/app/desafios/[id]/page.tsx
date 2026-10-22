import Link from "next/link";
import { notFound } from "next/navigation";
import {
  challengeListItemSchema,
  challengeMetricLabels,
  challengeStateLabels,
  missingParticipants,
  myEntrySchema,
  rankingRowSchema,
  unitLabel,
} from "@dojo/contracts/challenges";
import { idSchema } from "@dojo/contracts/membership";
import { getCaller } from "@/lib/context";
import { errorFromCode } from "@/lib/rpc-errors";
import { cancelChallenge, joinChallenge, leaveChallenge, voidEntry } from "../actions";
import { EntryForm } from "../forms";

const fmt = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("pt-BR", { timeZone: "UTC" });
const fmtWhen = (iso: string, tz: string) =>
  new Intl.DateTimeFormat("pt-BR", { timeZone: tz, dateStyle: "short", timeStyle: "short" }).format(new Date(iso));

export default async function DesafioPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ erro?: string }>;
}) {
  const { id } = await params;
  const { erro } = await searchParams;
  if (!idSchema.safeParse(id).success) notFound();
  const { supabase, isPlatformAdmin, managedAcademies } = await getCaller();

  const { data: row } = await supabase.from("challenges").select("id, academy_id, cancelled_reason").eq("id", id).maybeSingle();
  if (!row) notFound();
  const academyId = row.academy_id as string;

  const [{ data: list }, { data: academy }, { data: ageStatus }] = await Promise.all([
    supabase.rpc("list_challenges", { p_academy_id: academyId }),
    supabase.from("academies").select("name, timezone").eq("id", academyId).single(),
    supabase.rpc("my_age_status"),
  ]);
  const c = ((list ?? []) as unknown[]).map((x) => challengeListItemSchema.safeParse(x)).flatMap((r) => (r.success ? [r.data] : [])).find((x) => x.id === id);
  if (!c) notFound();
  const tz = (academy?.timezone as string) ?? "America/Sao_Paulo";
  const isManager = isPlatformAdmin || managedAcademies.some((a) => a.id === academyId);
  const canModerate = isManager || c.created_by_me;
  const isAdult = ageStatus === "adult";
  const open = ["open", "scheduled", "active"].includes(c.state);

  const [{ data: rankingRaw, error: rankingError }, { data: mineRaw }, { data: allRaw }] = await Promise.all([
    c.joined || canModerate ? supabase.rpc("challenge_ranking", { p_challenge_id: id }) : Promise.resolve({ data: null, error: null }),
    c.joined ? supabase.rpc("my_challenge_entries", { p_challenge_id: id }) : Promise.resolve({ data: [] }),
    canModerate ? supabase.rpc("list_challenge_entries", { p_challenge_id: id }) : Promise.resolve({ data: [] }),
  ]);
  const ranking = ((rankingRaw ?? []) as unknown[]).map((x) => rankingRowSchema.safeParse(x)).flatMap((r) => (r.success ? [r.data] : []));
  const mine = ((mineRaw ?? []) as unknown[]).map((x) => myEntrySchema.safeParse(x)).flatMap((r) => (r.success ? [r.data] : []));
  const all = (allRaw ?? []) as { id: string; display_name: string; occurred_at: string; units: number; note: string | null; verified: boolean; voided: boolean }[];
  const message = errorFromCode(erro);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <main style={{ padding: 16, display: "grid", gap: 20, maxWidth: 960 }}>
      <p><Link href="/desafios">← Desafios</Link></p>
      <h1>{c.title}</h1>
      <p>
        {academy?.name} · <strong>{challengeStateLabels[c.state] ?? c.state}</strong>
        {c.state === "open" && <> — {c.participants} de {c.min_participants} participantes; faltam {missingParticipants(c)} para o desafio começar</>}
      </p>
      {message && <p role="alert">{message}</p>}
      {c.description && <p>{c.description}</p>}
      <ul>
        <li>O que vale ponto: {challengeMetricLabels[c.metric]}{c.technique_name ? ` — ${c.technique_name}` : ""}</li>
        <li>{c.points_per_unit} ponto(s) por {unitLabel(c.metric)}{c.max_units_per_day ? ` · limite de ${c.max_units_per_day} por dia` : ""}</li>
        <li>Período: {fmt(c.starts_on)} a {fmt(c.ends_on)} · mínimo de {c.min_participants} participantes · {c.participants} participando</li>
      </ul>
      {row.cancelled_reason && <p role="note">Motivo do cancelamento: {row.cancelled_reason as string}</p>}

      {open && isAdult && (
        <p>
          {c.joined ? (
            <form action={leaveChallenge.bind(null, id)}><button type="submit">Sair do desafio</button></form>
          ) : (
            <form action={joinChallenge.bind(null, id)}><button type="submit">Participar</button></form>
          )}
        </p>
      )}

      {c.joined && c.state === "active" && c.metric !== "attendance" && (
        <section>
          <h2>Registrar {c.metric === "training" ? "treino" : "repetições"}</h2>
          <p>Diga o dia e a hora em que você treinou. Vale ponto na hora; se o horário cair dentro de uma aula em que você teve presença confirmada, o registro aparece como <strong>confirmado</strong>.</p>
          <EntryForm challengeId={id} metric={c.metric} today={today} />
        </section>
      )}
      {c.joined && c.state === "active" && c.metric === "attendance" && (
        <p role="note">Neste desafio os pontos vêm sozinhos das suas presenças confirmadas pelo professor.</p>
      )}

      {(c.joined || canModerate) && (
        <section>
          <h2>Ranking</h2>
          {c.state === "open" || c.state === "scheduled" ? (
            <p>O ranking aparece quando o desafio começar.</p>
          ) : rankingError || ranking.length === 0 ? (
            <p>Sem participantes no ranking.</p>
          ) : (
            <table>
              <thead><tr><th>#</th><th>Nome</th><th>Pontos</th><th>Registros</th><th>Confirmados</th></tr></thead>
              <tbody>
                {ranking.map((r) => (
                  <tr key={r.user_id} style={r.is_me ? { fontWeight: 700 } : undefined}>
                    <td>{r.rank}</td><td>{r.display_name}{r.is_me ? " (você)" : ""}</td><td>{r.points}</td><td>{r.entries}</td><td>{r.verified_entries}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}
      {!c.joined && !canModerate && <p>Participe para ver o ranking.</p>}

      {c.joined && mine.length > 0 && (
        <section>
          <h2>Meus registros</h2>
          <ul>
            {mine.map((e) => (
              <li key={e.id} style={e.voided ? { textDecoration: "line-through" } : undefined}>
                {fmtWhen(e.occurred_at, tz)} · {e.units} {unitLabel(c.metric)}{e.units > 1 ? "s" : ""}{e.note ? ` · ${e.note}` : ""}
                {e.verified ? " · confirmado" : " · não confirmado"}
                {!e.voided && c.state === "active" && (
                  <form action={voidEntry.bind(null, id)} style={{ display: "inline", marginLeft: 8 }}>
                    <input type="hidden" name="entryId" value={e.id} /><button type="submit">Anular</button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {canModerate && (
        <section>
          <h2>Moderação</h2>
          {all.length === 0 ? <p>Nenhum registro ainda.</p> : (
            <ul>
              {all.map((e) => (
                <li key={e.id} style={e.voided ? { textDecoration: "line-through" } : undefined}>
                  {e.display_name} · {fmtWhen(e.occurred_at, tz)} · {e.units}{e.verified ? " · confirmado" : ""}
                  {!e.voided && (
                    <form action={voidEntry.bind(null, id)} style={{ display: "inline", marginLeft: 8 }}>
                      <input type="hidden" name="entryId" value={e.id} /><button type="submit">Anular</button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          )}
          {open && (
            <form action={cancelChallenge.bind(null, id)}>
              <label>Motivo do cancelamento <input name="reason" minLength={3} maxLength={500} required /></label>
              <button type="submit">Cancelar desafio</button>
            </form>
          )}
        </section>
      )}
    </main>
  );
}
