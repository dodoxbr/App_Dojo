import { attendanceStatusLabels, isCheckInOpen } from "@dojo/contracts/attendance";
import { formatSessionRange } from "@dojo/contracts/classes";
import { Badge, ButtonLink, EmptyState, ItemLink, ItemList, Page, PageHeader } from "@/components/ui";
import { getCaller } from "@/lib/context";
import { CheckInButton } from "./check-in-button";
import styles from "./aulas.module.css";

// Server-side clock read, kept out of the render body (react-hooks/purity).
const currentTimeMs = () => Date.now();

// Agenda of the academies where the caller is an approved member (next 30 days), check-in and own attendance.
export default async function AulasPage() {
  const { supabase, userId } = await getCaller();

  const { data: mem } = await supabase.from("memberships").select("academy_id").eq("user_id", userId).eq("status", "approved");
  const academyIds = (mem ?? []).map((m) => m.academy_id as string);

  const nowMs = currentTimeMs();
  // Include today's earlier lessons: check-in stays open up to 1 hour after they end.
  const from = new Date(nowMs - 2 * 60 * 60 * 1000);
  const to = new Date(nowMs + 30 * 24 * 60 * 60 * 1000);
  const [{ data: sessions }, { data: classes }, { data: academies }, { data: mine }] = academyIds.length
    ? await Promise.all([
        supabase.from("sessions").select("id, academy_id, class_id, starts_at, ends_at, status")
          .in("academy_id", academyIds).gte("ends_at", from.toISOString()).lte("starts_at", to.toISOString())
          .order("starts_at").limit(100),
        supabase.from("classes").select("id, title").in("academy_id", academyIds),
        supabase.from("academies").select("id, name, timezone").in("id", academyIds),
        supabase.from("classes").select("id, title, academy_id").eq("instructor_user_id", userId).eq("is_active", true),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }];

  const sessionIds = (sessions ?? []).map((s) => s.id as string);
  const { data: myAttendance } = sessionIds.length
    ? await supabase.from("attendances").select("session_id, status").eq("user_id", userId).in("session_id", sessionIds)
    : { data: [] };
  const statusOf = new Map((myAttendance ?? []).map((a) => [a.session_id as string, a.status as string]));

  const titleOf = new Map((classes ?? []).map((c) => [c.id as string, c.title as string]));
  const academyOf = new Map((academies ?? []).map((a) => [a.id as string, a as { name: string; timezone: string }]));
  const runByMe = new Set((mine ?? []).map((c) => c.id as string));

  return (
    <Page width="narrow">
      <PageHeader title="Agenda de aulas" subtitle="Só a presença confirmada pelo professor conta. Registrar o treino no diário não conta como presença." />

      {(mine ?? []).length > 0 && (
        <section className={styles.section} aria-labelledby="minhas-turmas">
          <h2 id="minhas-turmas" className={styles.sectionTitle}>Turmas sob minha responsabilidade</h2>
          <ItemList>
            {(mine ?? []).map((c) => (
              <li key={c.id as string}><ItemLink href={`/turmas/${c.id as string}`} title={c.title as string} meta="Abrir a turma" /></li>
            ))}
          </ItemList>
        </section>
      )}

      <section className={styles.section} aria-labelledby="proximas-aulas">
        <h2 id="proximas-aulas" className={styles.sectionTitle}>Próximas aulas</h2>
        {academyIds.length === 0 ? (
          <EmptyState title="Você ainda não faz parte de nenhuma academia">Peça ao gestor da sua academia o link de entrada.</EmptyState>
        ) : (sessions ?? []).length === 0 ? (
          <EmptyState title="Nenhuma aula agendada nos próximos 30 dias">Quando o professor agendar, as aulas aparecem aqui.</EmptyState>
        ) : (
          <ul className={styles.sessions}>
            {(sessions ?? []).map((s) => {
              const a = academyOf.get(s.academy_id as string);
              const status = statusOf.get(s.id as string);
              const open = isCheckInOpen(s.starts_at as string, s.ends_at as string, s.status as string, nowMs);
              return (
                <li key={s.id as string} className={styles.session}>
                  <div className={styles.sessionInfo}>
                    <strong>{titleOf.get(s.class_id as string)}</strong>
                    <span className={styles.when}>{formatSessionRange(s.starts_at as string, s.ends_at as string, a?.timezone ?? "America/Sao_Paulo")}</span>
                    {academyIds.length > 1 && a && <span className={styles.when}>{a.name}</span>}
                  </div>
                  <div className={styles.sessionActions}>
                    {s.status === "cancelled" && <Badge tone="danger">cancelada</Badge>}
                    {status && <Badge tone={status === "validated" ? "success" : status === "revoked" ? "danger" : "info"}>{attendanceStatusLabels[status]}</Badge>}
                    {runByMe.has(s.class_id as string) && <ButtonLink href={`/turmas/${s.class_id as string}/aulas/${s.id as string}`} variant="secondary">Presenças</ButtonLink>}
                    {!status && open && <CheckInButton sessionId={s.id as string} />}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </Page>
  );
}
