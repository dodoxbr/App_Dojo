import Link from "next/link";
import { PAGE_SIZE, techniqueSearchSchema } from "@dojo/contracts/technique";
import { getCaller } from "@/lib/context";
import { AppShell } from "@/components/shell/AppShell";

// Catalog search: tolerant to accents, case and synonyms (docs/05). Visibility is decided by RLS.
export default async function TecnicasPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const params = techniqueSearchSchema.parse({
    q: typeof raw.q === "string" ? raw.q : undefined,
    category: typeof raw.categoria === "string" ? raw.categoria : undefined,
    type: typeof raw.tipo === "string" ? raw.tipo : undefined,
    position: typeof raw.posicao === "string" ? raw.posicao : undefined,
    page: typeof raw.pagina === "string" ? raw.pagina : undefined,
  });
  const { supabase, isPlatformAdmin, managedAcademies } = await getCaller();

  const [{ data: found, error }, { data: categoryRows }] = await Promise.all([
    supabase.rpc("search_techniques", {
      p_query: params.q ?? null,
      p_category: params.category ?? null,
      p_limit: PAGE_SIZE + 1, // one extra row tells us whether there is a next page
      p_offset: (params.page - 1) * PAGE_SIZE,
      p_type: params.type ?? null,
      p_position: params.position ?? null,
    }),
    supabase.from("techniques").select("category, technique_type, technique_position"),
  ]);
  const distinct = (values: (string | null)[]) =>
    [...new Set(values.filter((v): v is string => !!v))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  const categories = distinct((categoryRows ?? []).map((c) => c.category as string));
  const types = distinct((categoryRows ?? []).map((c) => c.technique_type as string | null));
  const positions = distinct((categoryRows ?? []).map((c) => c.technique_position as string | null));
  const rows = (found ?? []) as {
    id: string; academy_id: string | null; name: string; category: string; level: string | null; reviewed: boolean; matched_alias: string | null;
    technique_type: string | null; technique_position: string | null; classification_status: string | null;
  }[];
  const results = rows.slice(0, PAGE_SIZE);
  const hasNext = rows.length > PAGE_SIZE;

  const link = (page: number) => {
    const p = new URLSearchParams();
    if (params.q) p.set("q", params.q);
    if (params.category) p.set("categoria", params.category);
    if (params.type) p.set("tipo", params.type);
    if (params.position) p.set("posicao", params.position);
    if (page > 1) p.set("pagina", String(page));
    const s = p.toString();
    return `/tecnicas${s ? `?${s}` : ""}`;
  };

  return (
<AppShell>
    <main style={{ padding: 16, display: "grid", gap: 16, maxWidth: 720 }}>
      <p><Link href="/perfil">← Meu perfil</Link></p>
      <h1>Catálogo de técnicas</h1>

      <form method="get">
        <label>Buscar <input name="q" defaultValue={params.q ?? ""} maxLength={100} placeholder="nome ou sinônimo" /></label>
        <label>
          Categoria{" "}
          <select name="categoria" defaultValue={params.category ?? ""}>
            <option value="">Todas</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <label>
          Tipo{" "}
          <select name="tipo" defaultValue={params.type ?? ""}>
            <option value="">Todos</option>
            {types.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <label>
          Posição{" "}
          <select name="posicao" defaultValue={params.position ?? ""}>
            <option value="">Todas</option>
            {positions.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <button type="submit">Buscar</button>
      </form>

      {(isPlatformAdmin || managedAcademies.length > 0) && <p><Link href="/tecnicas/nova">Cadastrar técnica</Link></p>}

      {error ? (
        <p role="alert">Não foi possível buscar as técnicas.</p>
      ) : results.length === 0 ? (
        <p>Nenhuma técnica encontrada.</p>
      ) : (
        <ul>
          {results.map((t) => (
            <li key={t.id}>
              <Link href={`/tecnicas/${t.id}`}>{t.name}</Link> — {t.category}
              {t.level ? ` · ${t.level}` : ""}
              {t.technique_type ? ` · ${t.technique_type}` : ""}
              {t.technique_position ? ` · ${t.technique_position}` : ""}
              {t.classification_status === "proposed" ? " (classificação proposta)" : ""}
              {t.academy_id ? " · da academia" : ""}
              {!t.reviewed ? " · aguardando revisão" : ""}
              {t.matched_alias ? ` (sinônimo: ${t.matched_alias})` : ""}
            </li>
          ))}
        </ul>
      )}

      <nav aria-label="Paginação">
        {params.page > 1 && <Link href={link(params.page - 1)}>← Anterior</Link>}{" "}
        {hasNext && <Link href={link(params.page + 1)}>Próxima →</Link>}
      </nav>
    </main>
    </AppShell>
  );
}
