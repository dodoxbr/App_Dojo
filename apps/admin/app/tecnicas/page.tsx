import { PAGE_SIZE, techniqueSearchSchema } from "@dojo/contracts/technique";
import { Alert, Badge, Button, ButtonLink, Card, EmptyState, ItemLink, ItemList, Page, PageHeader, SelectField, TextField } from "@/components/ui";
import { getCaller } from "@/lib/context";
import styles from "./tecnicas.module.css";

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
    <Page width="narrow">
      <PageHeader
        title="Catálogo de técnicas"
        subtitle="Busca por nome ou sinônimo, sem diferenciar acentos nem maiúsculas."
        actions={isPlatformAdmin || managedAcademies.length > 0 ? <ButtonLink href="/tecnicas/nova" variant="secondary">Cadastrar técnica</ButtonLink> : undefined}
      />

      <Card>
        <form method="get" className={styles.filters}>
          <TextField label="Buscar" name="q" defaultValue={params.q ?? ""} maxLength={100} placeholder="nome ou sinônimo" />
          <div className={styles.selects}>
            <SelectField label="Categoria" name="categoria" defaultValue={params.category ?? ""}>
              <option value="">Todas</option>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </SelectField>
            <SelectField label="Tipo" name="tipo" defaultValue={params.type ?? ""}>
              <option value="">Todos</option>
              {types.map((c) => <option key={c} value={c}>{c}</option>)}
            </SelectField>
            <SelectField label="Posição" name="posicao" defaultValue={params.position ?? ""}>
              <option value="">Todas</option>
              {positions.map((c) => <option key={c} value={c}>{c}</option>)}
            </SelectField>
          </div>
          <Button type="submit">Buscar</Button>
        </form>
      </Card>

      {error ? (
        <Alert tone="danger">Não foi possível buscar as técnicas.</Alert>
      ) : results.length === 0 ? (
        <EmptyState title="Nenhuma técnica encontrada">Tente outro nome ou limpe os filtros.</EmptyState>
      ) : (
        <ItemList>
          {results.map((t) => (
            <li key={t.id}>
              <ItemLink
                href={`/tecnicas/${t.id}`}
                title={t.name}
                meta={t.matched_alias ? `sinônimo: ${t.matched_alias}` : undefined}
                badges={
                  <>
                    <Badge>{t.category}</Badge>
                    {t.level && <Badge tone="info">{t.level}</Badge>}
                    {t.technique_type && <Badge>{t.technique_type}</Badge>}
                    {t.technique_position && <Badge>{t.technique_position}</Badge>}
                    {t.academy_id && <Badge tone="accent">da academia</Badge>}
                    {t.classification_status === "proposed" && <Badge tone="info">classificação proposta</Badge>}
                    {!t.reviewed && <Badge tone="danger">aguardando revisão</Badge>}
                  </>
                }
              />
            </li>
          ))}
        </ItemList>
      )}

      {(params.page > 1 || hasNext) && (
        <nav aria-label="Paginação" className={styles.pager}>
          {params.page > 1 && <ButtonLink href={link(params.page - 1)} variant="secondary">← Anterior</ButtonLink>}
          {hasNext && <ButtonLink href={link(params.page + 1)} variant="secondary">Próxima →</ButtonLink>}
        </nav>
      )}
    </Page>
  );
}
