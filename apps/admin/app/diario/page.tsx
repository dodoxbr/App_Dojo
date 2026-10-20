import Link from "next/link";
import { DIARY_PAGE_SIZE } from "@dojo/contracts/diary";
import { getCaller } from "@/lib/context";
import { approvedAcademies, techniquesByLog } from "@/lib/diary";

// The caller's OWN diary. Always filtered by user, even for the platform admin (who has a separate page).
export default async function DiarioPage({ searchParams }: { searchParams: Promise<{ pagina?: string }> }) {
  const { pagina } = await searchParams;
  const page = Math.min(Math.max(Number.parseInt(pagina ?? "1", 10) || 1, 1), 1000);
  const { supabase, userId } = await getCaller();

  const { data, error } = await supabase
    .from("training_logs")
    .select("id, academy_id, trained_at, notes")
    .eq("user_id", userId)
    .order("trained_at", { ascending: false })
    .range((page - 1) * DIARY_PAGE_SIZE, page * DIARY_PAGE_SIZE); // one extra row = next page exists
  const rows = data ?? [];
  const logs = rows.slice(0, DIARY_PAGE_SIZE);
  const hasNext = rows.length > DIARY_PAGE_SIZE;

  const [techniques, academies] = await Promise.all([
    techniquesByLog(supabase, logs.map((l) => l.id as string)),
    approvedAcademies(supabase, userId),
  ]);
  const academyName = new Map(academies.map((a) => [a.id, a.name]));

  return (
    <main style={{ padding: 16, display: "grid", gap: 16, maxWidth: 640 }}>
      <p><Link href="/perfil">← Meu perfil</Link></p>
      <h1>Meu diário</h1>
      <p>Somente você vê estes registros. Registrar um treino não conta como presença na academia.</p>
      <p><Link href="/diario/novo">Registrar treino</Link></p>

      {error ? (
        <p role="alert">Não foi possível carregar o diário.</p>
      ) : logs.length === 0 ? (
        <p>Você ainda não registrou nenhum treino.</p>
      ) : (
        <ul>
          {logs.map((l) => (
            <li key={l.id as string}>
              <Link href={`/diario/${l.id}`}>{new Date(l.trained_at as string).toLocaleDateString("pt-BR", { timeZone: "UTC" })}</Link>
              {" — "}
              {l.academy_id ? (academyName.get(l.academy_id as string) ?? "Academia") : "Treino pessoal"}
              {(techniques.get(l.id as string) ?? []).length > 0 && (
                <> · {(techniques.get(l.id as string) ?? []).map((t) => t.name).join(", ")}</>
              )}
              {l.notes ? <p>{(l.notes as string).slice(0, 140)}{(l.notes as string).length > 140 ? "…" : ""}</p> : null}
            </li>
          ))}
        </ul>
      )}

      <nav aria-label="Paginação">
        {page > 1 && <Link href={`/diario?pagina=${page - 1}`}>← Mais recentes</Link>}{" "}
        {hasNext && <Link href={`/diario?pagina=${page + 1}`}>Mais antigos →</Link>}
      </nav>
    </main>
  );
}
