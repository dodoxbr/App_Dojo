import Link from "next/link";
import { notFound } from "next/navigation";
import { getCaller } from "@/lib/context";
import { approvedAcademies, techniquesByLog } from "@/lib/diary";
import { deleteLog } from "../actions";
import { LogForm } from "../log-form";

export default async function RegistroPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, userId } = await getCaller();

  // Own entries only: the owner filter also keeps the platform admin out of this editor.
  const { data: log } = await supabase
    .from("training_logs")
    .select("id, academy_id, trained_at, notes")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  if (!log) notFound();

  const [techniques, academies] = await Promise.all([techniquesByLog(supabase, [id]), approvedAcademies(supabase, userId)]);

  return (
    <main style={{ padding: 16, display: "grid", gap: 16, maxWidth: 640 }}>
      <p><Link href="/diario">← Meu diário</Link></p>
      <h1>Treino de {new Date(log.trained_at as string).toLocaleDateString("pt-BR", { timeZone: "UTC" })}</h1>
      <LogForm
        logId={id}
        academies={academies}
        initial={{
          academyId: (log.academy_id as string | null) ?? "",
          trainedDate: (log.trained_at as string).slice(0, 10),
          notes: log.notes as string,
          techniques: techniques.get(id) ?? [],
        }}
      />
      <form action={deleteLog.bind(null, id)}>
        <button type="submit">Excluir este registro</button>
      </form>
    </main>
  );
}
