import Link from "next/link";
import { notFound } from "next/navigation";
import { formatSessionRange, sessionStatusLabels } from "@dojo/contracts/classes";
import { getCaller } from "@/lib/context";
import { instructorCandidates } from "@/lib/academy-people";
import { errorFromCode } from "@/lib/rpc-errors";
import { cancelSession } from "../actions";
import { CreateSessionForm, EditClassForm } from "../forms";

// Server-side clock read, kept out of the render body (react-hooks/purity).
const currentTimeMs = () => Date.now();

// Manage one class: sessions (manager, platform admin or the responsible instructor) and the class itself (manager/admin).
export default async function TurmaPage({
  params,
  searchParams,
}: {
  params: Promise<{ classId: string }>;
  searchParams: Promise<{ erro?: string }>;
}) {
  const { classId } = await params;
  const { erro } = await searchParams;
  const { supabase, userId, isPlatformAdmin, managedAcademies } = await getCaller();

  const { data: klass } = await supabase
    .from("classes")
    .select("id, academy_id, title, instructor_user_id, is_active")
    .eq("id", classId)
    .maybeSingle();
  if (!klass) notFound();

  const isManager = isPlatformAdmin || managedAcademies.some((a) => a.id === klass.academy_id);
  const isResponsible = klass.instructor_user_id === userId;
  const canManageSessions = isManager || isResponsible;

  const [{ data: academy }, { data: sessions }, instructors] = await Promise.all([
    supabase.from("academies").select("name, timezone").eq("id", klass.academy_id).single(),
    supabase.from("sessions").select("id, starts_at, ends_at, status, cancelled_reason").eq("class_id", classId).order("starts_at", { ascending: false }).limit(60),
    isManager ? instructorCandidates(supabase, klass.academy_id as string) : Promise.resolve([]),
  ]);
  const tz = (academy?.timezone as string) ?? "America/Sao_Paulo";
  const now = currentTimeMs();
  const upcoming = (sessions ?? []).filter((s) => new Date(s.ends_at as string).getTime() >= now).reverse();
  const past = (sessions ?? []).filter((s) => new Date(s.ends_at as string).getTime() < now);
  const message = errorFromCode(erro);

  const SessionItem = ({ s }: { s: NonNullable<typeof sessions>[number] }) => (
    <li key={s.id as string}>
      {formatSessionRange(s.starts_at as string, s.ends_at as string, tz)} — {sessionStatusLabels[s.status as string]}
      {s.cancelled_reason ? ` (${s.cancelled_reason})` : ""}
      {canManageSessions && <> · <Link href={`/turmas/${classId}/aulas/${s.id}`}>Presenças</Link></>}
      {canManageSessions && s.status === "scheduled" && (
        <form action={cancelSession.bind(null, classId)} style={{ display: "inline", marginLeft: 8 }}>
          <input type="hidden" name="sessionId" value={s.id as string} />
          <input name="reason" placeholder="motivo (opcional)" maxLength={500} />
          <button type="submit">Cancelar aula</button>
        </form>
      )}
    </li>
  );

  return (
    <main style={{ padding: 16, display: "grid", gap: 16, maxWidth: 640 }}>
      <p>
        <Link href={isManager ? `/academia/${klass.academy_id}/turmas` : "/aulas"}>← {isManager ? "Turmas" : "Agenda"}</Link>
      </p>
      <h1>{klass.title}{klass.is_active ? "" : " (inativa)"}</h1>
      <p>{academy?.name} · horários no fuso {tz}</p>
      {message && <p role="alert">{message}</p>}

      {canManageSessions && klass.is_active && (
        <section>
          <h2>Agendar aula</h2>
          <CreateSessionForm classId={classId} />
        </section>
      )}

      <section>
        <h2>Próximas aulas</h2>
        {upcoming.length === 0 ? <p>Nenhuma aula agendada.</p> : <ul>{upcoming.map((s) => <SessionItem key={s.id as string} s={s} />)}</ul>}
      </section>

      {past.length > 0 && (
        <section>
          <h2>Aulas anteriores</h2>
          <ul>{past.map((s) => <SessionItem key={s.id as string} s={s} />)}</ul>
        </section>
      )}

      {isManager && (
        <section>
          <h2>Editar turma</h2>
          <EditClassForm
            classId={classId}
            title={klass.title as string}
            instructorUserId={klass.instructor_user_id as string}
            isActive={klass.is_active as boolean}
            instructors={instructors}
          />
        </section>
      )}
    </main>
  );
}
