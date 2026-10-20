import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { criterionKindLabels, type CriterionKind } from "@dojo/contracts/graduation";
import { getCaller } from "@/lib/context";

function describe(c: Record<string, unknown>): string {
  switch (c.kind as CriterionKind) {
    case "min_days": return `${c.min_days} dias desde a última graduação`;
    case "attendance":
      return `${c.min_attendances} ${c.distinct_days ? "dias com presença validada" : "presenças validadas"}${c.window_days ? ` nos últimos ${c.window_days} dias` : ""}`;
    case "curriculum": return `${c.min_percent}% das técnicas obrigatórias validadas`;
    default: return "avaliação do professor";
  }
}

export default async function GraduacaoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, isPlatformAdmin, managedAcademies } = await getCaller();
  const isManager = isPlatformAdmin || managedAcademies.some((a) => a.id === id);
  const { data: canView } = await supabase.rpc("has_academy_permission", { p_academy_id: id, p_permission: "view_progress" });
  const { data: canRecommend } = await supabase.rpc("has_academy_permission", { p_academy_id: id, p_permission: "recommend_graduation" });
  if (!isManager && canView !== true && canRecommend !== true) redirect("/perfil");

  const { data: academy } = await supabase.from("academies").select("id, name").eq("id", id).maybeSingle();
  if (!academy) notFound();

  const [{ data: rules }, { data: criteria }] = await Promise.all([
    supabase.from("promotion_rules").select("id, belt_code, degree, title, version, effective_from, effective_to").eq("academy_id", id)
      .order("belt_code").order("degree").order("version", { ascending: false }),
    supabase.from("rule_criteria").select("rule_id, position, kind, label, min_days, min_attendances, window_days, distinct_days, min_percent").eq("academy_id", id).order("position"),
  ]);

  return (
    <main style={{ padding: 16, display: "grid", gap: 16, maxWidth: 760 }}>
      <p><Link href={`/academia/${id}`}>← {academy.name}</Link></p>
      <h1>Graduação</h1>
      <p role="note">
        As regras são definidas por esta academia. O resultado é uma <strong>recomendação</strong>: quem promove é o gestor,
        nunca o sistema. Só contam presenças <strong>validadas e não revogadas</strong>.
      </p>
      <p><Link href={`/academia/${id}/graduacao/alunos`}>Alunos e graduação atual</Link></p>

      <section>
        <h2>Regras</h2>
        {isManager && <p><Link href={`/academia/${id}/graduacao/nova`}>Cadastrar regra</Link></p>}
        {(rules ?? []).length === 0 ? (
          <p>Nenhuma regra cadastrada. Sem regra, ninguém recebe recomendação.</p>
        ) : (
          <ul>
            {(rules ?? []).map((r) => (
              <li key={r.id as string}>
                <strong>{r.belt_code} · grau {r.degree}</strong>{r.title ? ` — ${r.title}` : ""} · versão {r.version} · vale de{" "}
                {new Date(`${r.effective_from}T12:00:00Z`).toLocaleDateString("pt-BR", { timeZone: "UTC" })}
                {r.effective_to
                  ? ` até ${new Date(`${r.effective_to}T12:00:00Z`).toLocaleDateString("pt-BR", { timeZone: "UTC" })} (substituída)`
                  : " (vigente)"}
                <ul>
                  {(criteria ?? []).filter((c) => c.rule_id === r.id).map((c) => (
                    <li key={`${r.id}-${c.position}`}>
                      {c.label} — {criterionKindLabels[c.kind as CriterionKind]}: {describe(c)}
                    </li>
                  ))}
                </ul>
                {isManager && !r.effective_to && (
                  <Link href={`/academia/${id}/graduacao/nova?de=${r.id}`}>Criar nova versão a partir desta</Link>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
