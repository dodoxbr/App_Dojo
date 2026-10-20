import Link from "next/link";
import { notFound } from "next/navigation";
import { classificationStatusLabels } from "@dojo/contracts/technique";
import { getCaller } from "@/lib/context";
import { removeAlias, reviewTechnique } from "../actions";
import { AliasForm, EditForm } from "./technique-forms";

export default async function TecnicaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, isPlatformAdmin, managedAcademies } = await getCaller();

  const { data: t } = await supabase
    .from("techniques")
    .select("id, academy_id, name, category, level, description, source, reviewed_at, technique_type, technique_position, classification_status, classification_source")
    .eq("id", id)
    .maybeSingle();
  if (!t) notFound();

  const canEdit = isPlatformAdmin || (t.academy_id !== null && managedAcademies.some((a) => a.id === t.academy_id));
  const [{ data: aliases }, { data: sources }] = await Promise.all([
    supabase.from("technique_aliases").select("id, alias").eq("technique_id", id).order("alias"),
    // Provenance is visible to the platform admin only (RLS); empty for everyone else.
    supabase.from("technique_sources").select("sheet, source_row, source_number, level, belt").eq("technique_id", id),
  ]);

  return (
    <main style={{ padding: 16, display: "grid", gap: 16, maxWidth: 640 }}>
      <p><Link href="/tecnicas">← Catálogo</Link></p>
      <h1>{t.name}</h1>
      <p>
        {t.category}
        {t.level ? ` · ${t.level}` : ""} · {t.academy_id ? "técnica da academia" : "catálogo global"} ·{" "}
        {t.reviewed_at ? `revisada em ${new Date(t.reviewed_at).toLocaleDateString("pt-BR")}` : "aguardando revisão"}
      </p>
      <p>
        Tipo: <strong>{t.technique_type ?? "não informado"}</strong> · Posição: <strong>{t.technique_position ?? "não informada"}</strong>
        {t.classification_status && <> — {classificationStatusLabels[t.classification_status]}</>}
      </p>
      {isPlatformAdmin && t.classification_source && <p><small>{t.classification_source}</small></p>}
      {t.description ? <p>{t.description}</p> : <p>Sem descrição ainda.</p>}

      <section>
        <h2>Sinônimos</h2>
        {(aliases ?? []).length === 0 ? (
          <p>Nenhum sinônimo cadastrado.</p>
        ) : (
          <ul>
            {(aliases ?? []).map((a) => (
              <li key={a.id as string}>
                {a.alias}
                {canEdit && (
                  <form action={removeAlias.bind(null, id)} style={{ display: "inline", marginLeft: 8 }}>
                    <input type="hidden" name="aliasId" value={a.id as string} />
                    <button type="submit">Remover</button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {isPlatformAdmin && (sources ?? []).length > 0 && (
        <section>
          <h2>Origem (planilha)</h2>
          <ul>
            {(sources ?? []).map((s, i) => (
              <li key={i}>
                {s.sheet}, linha {s.source_row}, nº {s.source_number} ({s.belt})
              </li>
            ))}
          </ul>
        </section>
      )}

      {canEdit && (
        <>
          <section>
            <h2>Editar</h2>
            <EditForm techniqueId={t.id} name={t.name} category={t.category} level={t.level ?? ""} description={t.description ?? ""} type={t.technique_type ?? ""} position={t.technique_position ?? ""} />
          </section>
          <section>
            <h2>Sinônimos e revisão</h2>
            <AliasForm techniqueId={t.id} />
            {!t.reviewed_at && (
              <form action={reviewTechnique.bind(null, t.id)}>
                <button type="submit">Marcar como revisada</button>
              </form>
            )}
          </section>
        </>
      )}
    </main>
  );
}
