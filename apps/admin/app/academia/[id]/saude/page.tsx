import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { formatPhone, healthNoteSchema } from "@dojo/contracts/contacts";
import { getCaller } from "@/lib/context";

// Everyone in the academy who has health notes, with the emergency contact (manager). Teachers see the same data per lesson.
export default async function SaudePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, managedAcademies } = await getCaller();
  if (!managedAcademies.some((a) => a.id === id)) redirect("/perfil");
  const { data: academy } = await supabase.from("academies").select("id, name").eq("id", id).maybeSingle();
  if (!academy) notFound();
  const { data: raw } = await supabase.rpc("list_health_notes", { p_academy_id: id });
  const rows = ((raw ?? []) as unknown[]).map((x) => healthNoteSchema.safeParse(x)).flatMap((r) => (r.success ? [r.data] : []));

  return (
    <main style={{ padding: 16, display: "grid", gap: 16, maxWidth: 960 }}>
      <p><Link href={`/academia/${id}`}>← {academy.name}</Link></p>
      <h1>Saúde e contato de emergência</h1>
      <p role="note"><small>Dados sensíveis informados pelos próprios alunos (ou pelos responsáveis dos menores) com consentimento. Os instrutores com a permissão &quot;ver observações de saúde&quot; veem estes dados na tela da aula. Cada consulta é registrada.</small></p>
      {rows.length === 0 ? (
        <p>Nenhum aluno informou observações de saúde.</p>
      ) : (
        <ul>
          {rows.map((r) => (
            <li key={r.user_id}>
              <strong>{r.person_name}</strong>{r.is_minor ? " (menor)" : ""}: {r.health_notes}
              <br />
              Emergência: {r.emergency_name ?? "—"}{r.emergency_relationship ? ` (${r.emergency_relationship})` : ""} {r.emergency_phone ? formatPhone(r.emergency_phone) : ""}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
