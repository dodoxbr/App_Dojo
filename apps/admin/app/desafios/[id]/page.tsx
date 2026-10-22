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
import { Alert, Avatar, Badge, Button, Card, Page, PageHero } from "@/components/ui";
import { getCaller } from "@/lib/context";
import { errorFromCode } from "@/lib/rpc-errors";
import { cancelChallenge, joinChallenge, leaveChallenge, voidEntry } from "../actions";
import { EntryForm } from "../forms";
import styles from "./desafio.module.css";

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

  const podium = ranking.slice(0, 3);
  return (
    <Page width="narrow">
      <PageHero
        eyebrow={`${academy?.name ?? "Desafio"} · ${challengeStateLabels[c.state] ?? c.state}`}
        title={c.title}
        subtitle={c.description ?? (c.state === "open" ? `${c.participants} de ${c.min_participants} participantes; faltam ${missingParticipants(c)} para o desafio começar` : undefined)}
        actions={
          open && isAdult ? (
            c.joined ? (
              <form action={leaveChallenge.bind(null, id)}><Button type="submit" variant="secondary">Sair do desafio</Button></form>
            ) : (
              <form action={joinChallenge.bind(null, id)}><Button type="submit" variant="accent">Participar</Button></form>
            )
          ) : undefined
        }
      />
      {message && <Alert tone="danger">{message}</Alert>}
      {row.cancelled_reason && <Alert tone="info">Motivo do cancelamento: {row.cancelled_reason as string}</Alert>}

      <Card>
        <h2 style={{ margin: "0 0 12px", fontSize: "1.25rem" }}>As regras</h2>
        <ul className={styles.rules}>
          <li><span>O que vale ponto</span><strong>{challengeMetricLabels[c.metric]}{c.technique_name ? ` — ${c.technique_name}` : ""}</strong></li>
          <li><span>Pontuação</span><strong>{c.points_per_unit} ponto(s) por {unitLabel(c.metric)}{c.max_units_per_day ? ` · limite de ${c.max_units_per_day} por dia` : ""}</strong></li>
          <li><span>Período</span><strong>{fmt(c.starts_on)} a {fmt(c.ends_on)}</strong></li>
          <li><span>Participantes</span><strong>mínimo de {c.min_participants} · {c.participants} participando</strong></li>
        </ul>
      </Card>

      {c.joined && c.state === "active" && c.metric !== "attendance" && (
        <Card>
          <h2 style={{ margin: "0 0 8px", fontSize: "1.25rem" }}>Registrar {c.metric === "training" ? "treino" : "repetições"}</h2>
          <p style={{ margin: "0 0 16px", color: "var(--text-muted)" }}>Diga o dia e a hora em que você treinou. Vale ponto na hora; se o horário cair dentro de uma aula em que você teve presença confirmada, o registro aparece como <strong>confirmado</strong>.</p>
          <EntryForm challengeId={id} metric={c.metric} today={today} />
        </Card>
      )}
      {c.joined && c.state === "active" && c.metric === "attendance" && (
        <Alert tone="info">Neste desafio os pontos vêm sozinhos das suas presenças confirmadas pelo professor.</Alert>
      )}

      {(c.joined || canModerate) && (
        <Card>
          <h2 style={{ margin: "0 0 12px", fontSize: "1.25rem" }}>Ranking</h2>
          {c.state === "open" || c.state === "scheduled" ? (
            <p style={{ margin: 0, color: "var(--text-muted)" }}>O ranking aparece quando o desafio começar.</p>
          ) : rankingError || ranking.length === 0 ? (
            <p style={{ margin: 0, color: "var(--text-muted)" }}>Sem participantes no ranking.</p>
          ) : (
            <>
              <ol className={styles.podium} aria-label="Os três primeiros">
                {podium.map((r) => (
                  <li key={r.user_id} className={`${styles.step} ${styles[`p${Math.min(Number(r.rank), 3)}`] ?? ""}`}>
                    <span className={styles.medal} aria-hidden="true">{r.rank}</span>
                    <Avatar name={r.display_name} size="md" />
                    <strong>{r.display_name}{r.is_me ? " (você)" : ""}</strong>
                    <span className={styles.points}>{r.points} pts</span>
                  </li>
                ))}
              </ol>
              <ul className={styles.rows}>
                {ranking.map((r) => (
                  <li key={r.user_id} className={`${styles.row} ${r.is_me ? styles.me : ""}`}>
                    <span className={styles.pos}>{r.rank}</span>
                    <span className={styles.name}>{r.display_name}{r.is_me ? " (você)" : ""}</span>
                    <span className={styles.nums}>{r.points} pts · {r.entries} registros · {r.verified_entries} confirmados</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>
      )}
      {!c.joined && !canModerate && <Alert tone="info">Participe para ver o ranking.</Alert>}

      {c.joined && mine.length > 0 && (
        <Card>
          <h2 style={{ margin: "0 0 12px", fontSize: "1.25rem" }}>Meus registros</h2>
          <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 10 }}>
            {mine.map((e) => (
              <li key={e.id} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, ...(e.voided ? { textDecoration: "line-through" } : {}) }}>
                <span>{fmtWhen(e.occurred_at, tz)} · {e.units} {unitLabel(c.metric)}{e.units > 1 ? "s" : ""}{e.note ? ` · ${e.note}` : ""}</span>
                <Badge tone={e.verified ? "success" : "neutral"}>{e.verified ? "confirmado" : "não confirmado"}</Badge>
                {!e.voided && c.state === "active" && (
                  <form action={voidEntry.bind(null, id)}>
                    <input type="hidden" name="entryId" value={e.id} /><button type="submit">Anular</button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {canModerate && (
        <Card>
          <h2 style={{ margin: "0 0 12px", fontSize: "1.25rem" }}>Moderação</h2>
          {all.length === 0 ? <p style={{ margin: 0, color: "var(--text-muted)" }}>Nenhum registro ainda.</p> : (
            <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 10 }}>
              {all.map((e) => (
                <li key={e.id} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, ...(e.voided ? { textDecoration: "line-through" } : {}) }}>
                  <span>{e.display_name} · {fmtWhen(e.occurred_at, tz)} · {e.units}</span>
                  {e.verified && <Badge tone="success">confirmado</Badge>}
                  {!e.voided && (
                    <form action={voidEntry.bind(null, id)}>
                      <input type="hidden" name="entryId" value={e.id} /><button type="submit">Anular</button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          )}
          {open && (
            <form action={cancelChallenge.bind(null, id)} style={{ marginTop: 16 }}>
              <label>Motivo do cancelamento <input name="reason" minLength={3} maxLength={500} required /></label>
              <button type="submit">Cancelar desafio</button>
            </form>
          )}
        </Card>
      )}
    </Page>
  );
}
