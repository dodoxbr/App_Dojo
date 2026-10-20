import Link from "next/link";
import { attendanceStatusLabels, isCheckInOpen } from "@dojo/contracts/attendance";
import { formatSessionRange } from "@dojo/contracts/classes";
import { getCaller } from "@/lib/context";
import { CheckInButton } from "./check-in-button";

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
    <main style={{ padding: 16, display: "grid", gap: 16, maxWidth: 640 }}>
      <p><Link href="/perfil">← Meu perfil</Link></p>
      <h1>Agenda de aulas</h1>

      {(mine ?? []).length > 0 && (
        <section>
          <h2>Turmas sob minha responsabilidade</h2>
          <ul>{(mine ?? []).map((c) => <li key={c.id as string}><Link href={`/turmas/${c.id}`}>{c.title}</Link></li>)}</ul>
        </section>
      )}

      <section>
        <h2>Próximas aulas</h2>
        <p><small>Só a presença confirmada pelo professor conta. Registrar o treino no diário não conta como presença.</small></p>
        {academyIds.length === 0 ? (
          <p>Você ainda não faz parte de nenhuma academia.</p>
        ) : (sessions ?? []).length === 0 ? (
          <p>Nenhuma aula agendada nos próximos 30 dias.</p>
        ) : (
          <ul>
            {(sessions ?? []).map((s) => {
              const a = academyOf.get(s.academy_id as string);
              const status = statusOf.get(s.id as string);
              const open = isCheckInOpen(s.starts_at as string, s.ends_at as string, s.status as string, nowMs);
              return (
                <li key={s.id as string}>
                  {formatSessionRange(s.starts_at as string, s.ends_at as string, a?.timezone ?? "America/Sao_Paulo")} —{" "}
                  {titleOf.get(s.class_id as string)}
                  {academyIds.length > 1 && a ? ` · ${a.name}` : ""}
                  {s.status === "cancelled" ? " (cancelada)" : ""}
                  {runByMe.has(s.class_id as string) && (
                    <> · <Link href={`/turmas/${s.class_id}/aulas/${s.id}`}>Presenças</Link></>
                  )}
                  {status ? <> · <strong>{attendanceStatusLabels[status]}</strong></> : null}
                  {!status && open && <> · <CheckInButton sessionId={s.id as string} /></>}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
