import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { attendanceSourceLabels, attendanceStatusLabels } from "@dojo/contracts/attendance";
import { formatSessionRange } from "@dojo/contracts/classes";
import { formatPhone, healthNoteSchema } from "@dojo/contracts/contacts";
import { getCaller } from "@/lib/context";
import { errorFromCode } from "@/lib/rpc-errors";
import { confirmAttendance, revokeAttendance } from "./actions";
import { QrBlock } from "./qr-block";

// Attendance of one lesson. Everything here is gated by the database (can_validate_session); this page only
// decides what to show.
export default async function PresencasPage({
  params,
  searchParams,
}: {
  params: Promise<{ classId: string; sessionId: string }>;
  searchParams: Promise<{ erro?: string }>;
}) {
  const { classId, sessionId } = await params;
  const { erro } = await searchParams;
  const { supabase } = await getCaller();

  const { data: session } = await supabase
    .from("sessions")
    .select("id, academy_id, class_id, starts_at, ends_at, status")
    .eq("id", sessionId)
    .eq("class_id", classId)
    .maybeSingle();
  if (!session) notFound();

  const { data: allowed } = await supabase.rpc("can_validate_session", { p_session_id: sessionId });
  if (allowed !== true) redirect("/aulas");

  const [{ data: klass }, { data: academy }, { data: rows }] = await Promise.all([
    supabase.from("classes").select("title").eq("id", classId).single(),
    supabase.from("academies").select("name, timezone").eq("id", session.academy_id).single(),
    supabase.from("attendances").select("id, user_id, status, source, revoked_reason, requested_at").eq("session_id", sessionId).order("requested_at"),
  ]);
  const attendances = rows ?? [];
  // Health notes of the people in this lesson; the database only answers to the manager and to teachers with the permission.
  const { data: healthRaw } = await supabase.rpc("session_health_notes", { p_session_id: sessionId });
  const health = ((healthRaw ?? []) as unknown[]).map((x) => healthNoteSchema.safeParse(x)).flatMap((r) => (r.success ? [r.data] : []));
  const userIds = attendances.map((a) => a.user_id as string);

  // Names come from the roster / attendance policies; whoever cannot see a name is shown as "Aluno".
  const { data: profiles } = userIds.length ? await supabase.from("profiles").select("id, display_name").in("id", userIds) : { data: [] };
  const nameOf = new Map((profiles ?? []).map((p) => [p.id as string, p.display_name as string]));

  // Members who could still be registered by hand (needs the roster permission to list them).
  const { data: members } = await supabase
    .from("memberships")
    .select("user_id")
    .eq("academy_id", session.academy_id)
    .eq("status", "approved");
  const memberIds = (members ?? []).map((m) => m.user_id as string).filter((id) => !userIds.includes(id));
  const { data: memberProfiles } = memberIds.length
    ? await supabase.from("profiles").select("id, display_name").in("id", memberIds)
    : { data: [] };
  const candidates = (memberProfiles ?? [])
    .map((p) => ({ id: p.id as string, name: p.display_name as string }))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

  const tz = (academy?.timezone as string) ?? "America/Sao_Paulo";
  const pending = attendances.filter((a) => a.status === "pending");
  const validated = attendances.filter((a) => a.status === "validated");
  const revoked = attendances.filter((a) => a.status === "revoked");
  const message = errorFromCode(erro, { conflict: "Esta presença foi revogada e não pode ser confirmada de novo." });

  return (
    <main style={{ padding: 16, display: "grid", gap: 16, maxWidth: 720 }}>
      <p><Link href={`/turmas/${classId}`}>← {klass?.title}</Link></p>
      <h1>Presenças</h1>
      <p>
        {klass?.title} — {academy?.name}
        <br />
        {formatSessionRange(session.starts_at as string, session.ends_at as string, tz)}
        {session.status === "cancelled" ? " (cancelada)" : ""}
      </p>
      {message && <p role="alert">{message}</p>}

      {health.length > 0 && (
        <section role="note">
          <h2>Atenção à saúde (alunos desta aula)</h2>
          <ul>
            {health.map((h) => (
              <li key={h.user_id}>
                <strong>{h.person_name}</strong>{h.attendance_status === "pending" ? " (presença ainda não confirmada)" : ""}: {h.health_notes}
                <br />
                Emergência: {h.emergency_name ?? "—"}{h.emergency_relationship ? ` (${h.emergency_relationship})` : ""} {h.emergency_phone ? formatPhone(h.emergency_phone) : ""}
              </li>
            ))}
          </ul>
          <p><small>Dados sensíveis, só para a segurança nos treinos. Cada consulta é registrada.</small></p>
        </section>
      )}

      {session.status === "scheduled" && (
        <section>
          <h2>QR de check-in</h2>
          <QrBlock classId={classId} sessionId={sessionId} />
        </section>
      )}

      <section>
        <h2>Aguardando confirmação ({pending.length})</h2>
        {pending.length === 0 ? <p>Nenhum pedido pendente.</p> : (
          <ul>
            {pending.map((a) => (
              <li key={a.id as string}>
                <strong>{nameOf.get(a.user_id as string) ?? "Aluno"}</strong> — {attendanceSourceLabels[a.source as string]}
                <form action={confirmAttendance.bind(null, classId, sessionId)} style={{ display: "inline", marginLeft: 8 }}>
                  <input type="hidden" name="userId" value={a.user_id as string} />
                  <input type="hidden" name="idempotencyKey" value={crypto.randomUUID()} />
                  <button type="submit">Confirmar presença</button>
                </form>
                <form action={revokeAttendance.bind(null, classId, sessionId)} style={{ display: "inline", marginLeft: 8 }}>
                  <input type="hidden" name="attendanceId" value={a.id as string} />
                  <input name="reason" placeholder="motivo da recusa" minLength={3} maxLength={500} required />
                  <button type="submit">Recusar</button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2>Presenças confirmadas ({validated.length})</h2>
        {validated.length === 0 ? <p>Nenhuma presença confirmada ainda.</p> : (
          <ul>
            {validated.map((a) => (
              <li key={a.id as string}>
                {nameOf.get(a.user_id as string) ?? "Aluno"} — {attendanceSourceLabels[a.source as string]}
                <form action={revokeAttendance.bind(null, classId, sessionId)} style={{ display: "inline", marginLeft: 8 }}>
                  <input type="hidden" name="attendanceId" value={a.id as string} />
                  <input name="reason" placeholder="motivo da revogação" minLength={3} maxLength={500} required />
                  <button type="submit">Revogar</button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      {session.status === "scheduled" && (
        <section>
          <h2>Lançar presença manualmente</h2>
          {candidates.length === 0 ? (
            <p>Todos os membros visíveis já têm registro nesta aula (ou você não tem permissão para ver a lista).</p>
          ) : (
            <form action={confirmAttendance.bind(null, classId, sessionId)}>
              <input type="hidden" name="idempotencyKey" value={crypto.randomUUID()} />
              <label>
                Aluno{" "}
                <select name="userId" required defaultValue="">
                  <option value="" disabled>Escolha…</option>
                  {candidates.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
              <button type="submit">Confirmar presença</button>
            </form>
          )}
        </section>
      )}

      {revoked.length > 0 && (
        <section>
          <h2>Revogadas ({revoked.length})</h2>
          <ul>
            {revoked.map((a) => (
              <li key={a.id as string}>
                {nameOf.get(a.user_id as string) ?? "Aluno"} — {attendanceStatusLabels.revoked}: {a.revoked_reason as string}
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
