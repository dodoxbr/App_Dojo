import Link from "next/link";
import { formatSessionRange } from "@dojo/contracts/classes";
import { getCaller } from "@/lib/context";

// Agenda of the academies where the caller is an approved member (next 30 days), plus the classes they run.
export default async function AulasPage() {
  const { supabase, userId } = await getCaller();

  const { data: mem } = await supabase.from("memberships").select("academy_id").eq("user_id", userId).eq("status", "approved");
  const academyIds = (mem ?? []).map((m) => m.academy_id as string);

  const from = new Date();
  const to = new Date(from.getTime() + 30 * 24 * 60 * 60 * 1000);
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
        <h2>Próximos 30 dias</h2>
        {academyIds.length === 0 ? (
          <p>Você ainda não faz parte de nenhuma academia.</p>
        ) : (sessions ?? []).length === 0 ? (
          <p>Nenhuma aula agendada nos próximos 30 dias.</p>
        ) : (
          <ul>
            {(sessions ?? []).map((s) => {
              const a = academyOf.get(s.academy_id as string);
              const cancelled = s.status === "cancelled";
              return (
                <li key={s.id as string}>
                  {formatSessionRange(s.starts_at as string, s.ends_at as string, a?.timezone ?? "America/Sao_Paulo")} —{" "}
                  {runByMe.has(s.class_id as string) ? (
                    <Link href={`/turmas/${s.class_id}`}>{titleOf.get(s.class_id as string)}</Link>
                  ) : (
                    titleOf.get(s.class_id as string)
                  )}
                  {academyIds.length > 1 && a ? ` · ${a.name}` : ""}
                  {cancelled ? " (cancelada)" : ""}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
