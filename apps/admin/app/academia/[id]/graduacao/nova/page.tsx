import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { idSchema } from "@dojo/contracts/membership";
import { getCaller } from "@/lib/context";
import { RuleBuilder, type InitialCriterion } from "../rule-builder";

// New rule or NEW VERSION of an existing one (?de=<rule id> pre-fills the form). Old versions are never edited.
export default async function NovaRegraPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ de?: string }>;
}) {
  const { id } = await params;
  const { de } = await searchParams;
  const { supabase, isPlatformAdmin, managedAcademies } = await getCaller();
  if (!isPlatformAdmin && !managedAcademies.some((a) => a.id === id)) redirect("/perfil");

  const { data: academy } = await supabase.from("academies").select("id, name").eq("id", id).maybeSingle();
  if (!academy) notFound();
  const { data: curricula } = await supabase.from("curricula").select("id, title").eq("academy_id", id).eq("is_active", true).order("title");

  let initial: { beltCode: string; degree: number; title: string; criteria: InitialCriterion[] } | undefined;
  if (idSchema.safeParse(de).success) {
    const [{ data: rule }, { data: rows }] = await Promise.all([
      supabase.from("promotion_rules").select("belt_code, degree, title").eq("id", de).eq("academy_id", id).maybeSingle(),
      supabase.from("rule_criteria").select("kind, label, min_days, min_attendances, window_days, distinct_days, curriculum_id, min_percent").eq("rule_id", de).order("position"),
    ]);
    if (rule) {
      initial = {
        beltCode: rule.belt_code as string,
        degree: rule.degree as number,
        title: (rule.title as string | null) ?? "",
        criteria: (rows ?? []).map((c) => ({
          kind: c.kind as InitialCriterion["kind"],
          label: c.label as string,
          minDays: c.min_days != null ? String(c.min_days) : "",
          minAttendances: c.min_attendances != null ? String(c.min_attendances) : "",
          windowDays: c.window_days != null ? String(c.window_days) : "",
          distinctDays: c.distinct_days as boolean,
          curriculumId: (c.curriculum_id as string | null) ?? "",
          minPercent: c.min_percent != null ? String(c.min_percent) : "",
        })),
      };
    }
  }

  return (
    <main style={{ padding: 16, display: "grid", gap: 16, maxWidth: 720 }}>
      <p><Link href={`/academia/${id}/graduacao`}>← Graduação</Link></p>
      <h1>{initial ? "Nova versão da regra" : "Cadastrar regra"}</h1>
      <p>
        Combine os critérios que a sua academia usa. {initial ? "A versão atual é encerrada no dia anterior à data de início da nova." : ""}{" "}
        O sistema não traz nenhum valor oficial: tudo o que você cadastrar aqui é decisão da academia.
      </p>
      <RuleBuilder academyId={id} curricula={(curricula ?? []).map((c) => ({ id: c.id as string, title: c.title as string }))} initial={initial} />
    </main>
  );
}
