import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { FeatureOff } from "@/components/feature-off";
import { academyHas } from "@/lib/features";
import { getCaller } from "@/lib/context";
import { CreateCurriculumForm } from "./forms";

export default async function CurriculosPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, isPlatformAdmin, managedAcademies } = await getCaller();
  if (!(await academyHas(supabase, id, "curriculum"))) return <FeatureOff feature="curriculum" />;
  if (!isPlatformAdmin && !managedAcademies.some((a) => a.id === id)) redirect("/perfil");

  const { data: academy } = await supabase.from("academies").select("id, name").eq("id", id).maybeSingle();
  if (!academy) notFound();

  const [{ data: curricula }, { data: items }] = await Promise.all([
    supabase.from("curricula").select("id, title, level, is_active").eq("academy_id", id).order("title"),
    supabase.from("curriculum_items").select("curriculum_id").eq("academy_id", id),
  ]);
  const countOf = new Map<string, number>();
  for (const i of items ?? []) countOf.set(i.curriculum_id as string, (countOf.get(i.curriculum_id as string) ?? 0) + 1);

  return (
    <main style={{ padding: 16, display: "grid", gap: 16, maxWidth: 640 }}>
      <p><Link href={`/academia/${id}`}>← {academy.name}</Link></p>
      <h1>Currículos (trilhas)</h1>
      <p>Um currículo é uma lista de técnicas do catálogo. Ele <strong>não</strong> define regras de graduação.</p>

      {(curricula ?? []).length === 0 ? (
        <p>Nenhum currículo criado ainda.</p>
      ) : (
        <ul>
          {(curricula ?? []).map((c) => (
            <li key={c.id as string}>
              <Link href={`/academia/${id}/curriculos/${c.id}`}>{c.title}</Link>
              {c.level ? ` · ${c.level}` : ""} · {countOf.get(c.id as string) ?? 0} técnicas{c.is_active ? "" : " (inativo)"}
            </li>
          ))}
        </ul>
      )}

      <section>
        <h2>Novo currículo</h2>
        <CreateCurriculumForm academyId={id} />
      </section>

      <p><Link href={`/academia/${id}/avaliacoes`}>Avaliar o domínio dos alunos</Link></p>
    </main>
  );
}
