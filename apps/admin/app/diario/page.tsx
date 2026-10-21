import { Alert, Badge, ButtonLink, EmptyState, ItemLink, ItemList, Page, PageHeader } from "@/components/ui";
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
    <Page width="narrow">
      <PageHeader
        title="Meu diário"
        subtitle="Somente você vê estes registros. Registrar um treino não conta como presença na academia."
        actions={<ButtonLink href="/diario/novo">Registrar treino</ButtonLink>}
      />

      {error ? (
        <Alert tone="danger">Não foi possível carregar o diário.</Alert>
      ) : logs.length === 0 ? (
        <EmptyState title="Você ainda não registrou nenhum treino" action={<ButtonLink href="/diario/novo" variant="secondary">Registrar o primeiro treino</ButtonLink>}>
          O diário é só seu: anote o que treinou e as técnicas que praticou.
        </EmptyState>
      ) : (
        <ItemList>
          {logs.map((l) => {
            const names = (techniques.get(l.id as string) ?? []).map((t) => t.name);
            const notes = (l.notes as string | null) ?? "";
            return (
              <li key={l.id as string}>
                <ItemLink
                  href={`/diario/${l.id as string}`}
                  title={new Date(l.trained_at as string).toLocaleDateString("pt-BR", { timeZone: "UTC" })}
                  meta={l.academy_id ? (academyName.get(l.academy_id as string) ?? "Academia") : "Treino pessoal"}
                  badges={names.length > 0 ? names.map((n) => <Badge key={n} tone="accent">{n}</Badge>) : undefined}
                >
                  {notes ? `${notes.slice(0, 140)}${notes.length > 140 ? "…" : ""}` : null}
                </ItemLink>
              </li>
            );
          })}
        </ItemList>
      )}

      {(page > 1 || hasNext) && (
        <nav aria-label="Paginação" style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {page > 1 && <ButtonLink href={`/diario?pagina=${page - 1}`} variant="secondary">← Mais recentes</ButtonLink>}
          {hasNext && <ButtonLink href={`/diario?pagina=${page + 1}`} variant="secondary">Mais antigos →</ButtonLink>}
        </nav>
      )}
    </Page>
  );
}
