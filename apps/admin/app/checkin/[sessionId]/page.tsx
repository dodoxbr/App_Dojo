import Link from "next/link";
import { notFound } from "next/navigation";
import { checkInTokenSchema } from "@dojo/contracts/attendance";
import { formatSessionRange } from "@dojo/contracts/classes";
import { attendanceStatusLabels } from "@dojo/contracts/attendance";
import { idSchema } from "@dojo/contracts/membership";
import { getCaller } from "@/lib/context";
import { CheckInButton } from "../../aulas/check-in-button";

// Landing page of the QR code. Opening it never registers anything: the student must press the button,
// and even then the attendance is only PENDING until the teacher confirms it.
export default async function CheckInPage({
  params,
  searchParams,
}: {
  params: Promise<{ sessionId: string }>;
  searchParams: Promise<{ t?: string }>;
}) {
  const { sessionId } = await params;
  const { t } = await searchParams;
  if (!idSchema.safeParse(sessionId).success) notFound();
  const token = checkInTokenSchema.safeParse(t).success ? (t as string) : null;

  const { supabase, userId } = await getCaller();
  const { data: session } = await supabase
    .from("sessions")
    .select("id, academy_id, class_id, starts_at, ends_at, status")
    .eq("id", sessionId)
    .maybeSingle();

  if (!session) {
    return (
      <main style={{ padding: 16, display: "grid", gap: 16, maxWidth: 480 }}>
        <h1>Check-in</h1>
        <p role="alert">Não encontramos esta aula. Você precisa ser membro aprovado da academia para fazer check-in.</p>
        <p><Link href="/aulas">Ver minha agenda</Link></p>
      </main>
    );
  }

  const [{ data: klass }, { data: academy }, { data: mine }] = await Promise.all([
    supabase.from("classes").select("title").eq("id", session.class_id).single(),
    supabase.from("academies").select("name, timezone").eq("id", session.academy_id).single(),
    supabase.from("attendances").select("status").eq("session_id", sessionId).eq("user_id", userId).maybeSingle(),
  ]);

  return (
    <main style={{ padding: 16, display: "grid", gap: 16, maxWidth: 480 }}>
      <h1>Check-in</h1>
      <p>
        <strong>{klass?.title}</strong> — {academy?.name}
        <br />
        {formatSessionRange(session.starts_at as string, session.ends_at as string, (academy?.timezone as string) ?? "America/Sao_Paulo")}
        {session.status === "cancelled" ? " (cancelada)" : ""}
      </p>
      {mine ? (
        <p role="status">{attendanceStatusLabels[mine.status as string]}.</p>
      ) : (
        <>
          <CheckInButton sessionId={sessionId} token={token} />
          <p><small>O professor precisa confirmar a sua presença. O QR code sozinho não confirma nada.</small></p>
        </>
      )}
      <p><Link href="/aulas">Ver minha agenda</Link></p>
    </main>
  );
}
