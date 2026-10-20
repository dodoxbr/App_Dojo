import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { catalogLevels } from "@dojo/contracts/curriculum";
import { getCaller } from "@/lib/context";
import { errorFromCode } from "@/lib/rpc-errors";
import { addFromLevel, addItem, removeItem, toggleRequired } from "../actions";
import { EditCurriculumForm } from "../forms";

export default async function CurriculoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; curriculumId: string }>;
  searchParams: Promise<{ erro?: string; q?: string }>;
}) {
  const { id, curriculumId } = await params;
  const { erro, q } = await searchParams;
  const { supabase, isPlatformAdmin, managedAcademies } = await getCaller();
  if (!isPlatformAdmin && !managedAcademies.some((a) => a.id === id)) redirect("/perfil");

  const { data: curriculum } = await supabase
    .from("curricula")
    .select("id, title, level, is_active")
    .eq("id", curriculumId)
    .eq("academy_id", id)
    .maybeSingle();
  if (!curriculum) notFound();

  const { data: items } = await supabase
    .from("curriculum_items")
    .select("id, technique_id, required, position")
    .eq("curriculum_id", curriculumId)
    .order("position");
  const techniqueIds = (items ?? []).map((i) => i.technique_id as string);
  const { data: techniques } = techniqueIds.length
    ? await supabase.from("techniques").select("id, name, category").in("id", techniqueIds)
    : { data: [] };
  const byId = new Map((techniques ?? []).map((t) => [t.id as string, t]));

  const query = (q ?? "").trim().slice(0, 100);
  const { data: found } = query
    ? await supabase.rpc("search_techniques", { p_query: query, p_limit: 15, p_offset: 0 })
    : { data: [] };
  const inTrail = new Set(techniqueIds);
  const message = errorFromCode(erro);

  return (
    <main style={{ padding: 16, display: "grid", gap: 16, maxWidth: 720 }}>
      <p><Link href={`/academia/${id}/curriculos`}>← Currículos</Link></p>
      <h1>{curriculum.title}{curriculum.is_active ? "" : " (inativo)"}</h1>
      {message && <p role="alert">{message}</p>}

      <section>
        <h2>Técnicas da trilha ({(items ?? []).length})</h2>
        {(items ?? []).length === 0 ? <p>Nenhuma técnica ainda. Use os atalhos abaixo.</p> : (
          <ul>
            {(items ?? []).map((i) => {
              const t = byId.get(i.technique_id as string);
              return (
                <li key={i.id as string}>
                  {t ? <Link href={`/tecnicas/${t.id}`}>{t.name as string}</Link> : "Técnica"} — {t?.category as string} ·{" "}
                  {i.required ? "obrigatória" : "opcional"}
                  <form action={toggleRequired.bind(null, id, curriculumId)} style={{ display: "inline", marginLeft: 8 }}>
                    <input type="hidden" name="itemId" value={i.id as string} />
                    <input type="hidden" name="required" value={String(!i.required)} />
                    <button type="submit">{i.required ? "Tornar opcional" : "Tornar obrigatória"}</button>
                  </form>
                  <form action={removeItem.bind(null, id, curriculumId)} style={{ display: "inline", marginLeft: 8 }}>
                    <input type="hidden" name="itemId" value={i.id as string} />
                    <button type="submit">Remover</button>
                  </form>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <h2>Adicionar técnicas</h2>
        <p>Atalho: adiciona todas as técnicas que aparecem naquele nível da planilha importada.</p>
        <form action={addFromLevel.bind(null, id, curriculumId)}>
          <label>
            Nível{" "}
            <select name="level" defaultValue={curriculum.level ?? "Básico"}>
              {catalogLevels.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </label>
          <button type="submit">Adicionar técnicas do nível</button>
        </form>

        <form method="get" style={{ marginTop: 12 }}>
          <label>Buscar no catálogo <input name="q" defaultValue={query} maxLength={100} placeholder="nome ou sinônimo" /></label>
          <button type="submit">Buscar</button>
        </form>
        {query && (
          <ul>
            {((found ?? []) as { id: string; name: string; category: string }[]).map((t) => (
              <li key={t.id}>
                {t.name} — {t.category}{" "}
                {inTrail.has(t.id) ? (
                  <em>já está na trilha</em>
                ) : (
                  <form action={addItem.bind(null, id, curriculumId)} style={{ display: "inline" }}>
                    <input type="hidden" name="techniqueId" value={t.id} />
                    <label><input type="checkbox" name="required" defaultChecked /> obrigatória</label>
                    <button type="submit">Adicionar</button>
                  </form>
                )}
              </li>
            ))}
            {(found ?? []).length === 0 && <li>Nenhuma técnica encontrada.</li>}
          </ul>
        )}
      </section>

      <section>
        <h2>Dados do currículo</h2>
        <EditCurriculumForm
          curriculumId={curriculumId}
          title={curriculum.title as string}
          level={(curriculum.level as string | null) ?? ""}
          isActive={curriculum.is_active as boolean}
        />
      </section>
    </main>
  );
}
