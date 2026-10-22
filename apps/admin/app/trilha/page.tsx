import Link from "next/link";
import { skillStatusLabels, summarizeTrail, type SkillStatus } from "@dojo/contracts/curriculum";
import { Badge, Card, EmptyState, Page, PageHeader, ProgressBar } from "@/components/ui";
import { academiesWith, myFeatureMap } from "@/lib/features";
import { getCaller } from "@/lib/context";
import { SkillSelect } from "./skill-select";
import styles from "./trilha.module.css";

// The student's trail: the academy's curricula with the student's own progress. Only the teacher can validate.
export default async function TrilhaPage() {
  const { supabase, userId } = await getCaller();

  const { data: mem } = await supabase.from("memberships").select("academy_id").eq("user_id", userId).eq("status", "approved");
  const features = await myFeatureMap(supabase);
  const academyIds = academiesWith(features, (mem ?? []).map((m) => m.academy_id as string), "curriculum");

  const [{ data: academies }, { data: curricula }, { data: items }, { data: mine }] = academyIds.length
    ? await Promise.all([
        supabase.from("academies").select("id, name").in("id", academyIds),
        supabase.from("curricula").select("id, academy_id, title, level").in("academy_id", academyIds).eq("is_active", true).order("title"),
        supabase.from("curriculum_items").select("curriculum_id, technique_id, required, position").in("academy_id", academyIds).order("position"),
        supabase.from("skill_assessments").select("academy_id, technique_id, status").eq("user_id", userId),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }];

  const techniqueIds = [...new Set((items ?? []).map((i) => i.technique_id as string))];
  const { data: techniques } = techniqueIds.length
    ? await supabase.from("techniques").select("id, name, category").in("id", techniqueIds)
    : { data: [] };
  const techniqueOf = new Map((techniques ?? []).map((t) => [t.id as string, t]));
  const academyName = new Map((academies ?? []).map((a) => [a.id as string, a.name as string]));
  const statusFor = (academyId: string) =>
    new Map((mine ?? []).filter((m) => m.academy_id === academyId).map((m) => [m.technique_id as string, m.status as string]));

  return (
    <Page width="narrow">
      <PageHeader
        title="Minha trilha"
        subtitle="Marque o que você já estudou ou está praticando. A validação do domínio é feita pelo professor e é independente da presença nas aulas."
      />

      {(curricula ?? []).length === 0 && <EmptyState title="Sua academia ainda não publicou um currículo">Quando o professor publicar uma trilha, ela aparece aqui.</EmptyState>}

      {(curricula ?? []).map((c) => {
        const cItems = (items ?? []).filter((i) => i.curriculum_id === c.id);
        const status = statusFor(c.academy_id as string);
        const summary = summarizeTrail(
          cItems.map((i) => ({ techniqueId: i.technique_id as string, required: i.required as boolean })),
          status,
        );
        return (
          <Card key={c.id as string}>
            <h2 style={{ margin: "0 0 4px", fontSize: "1.25rem" }}>{c.title}{c.level ? ` · ${c.level}` : ""}</h2>
            <p style={{ margin: "0 0 12px", fontSize: "0.875rem", color: "var(--text-muted)" }}>
              {academyName.get(c.academy_id as string)} — validadas pelo professor: {summary.requiredValidated} de {summary.required} obrigatórias
              ({summary.validated} de {summary.total} no total)
            </p>
            {summary.required > 0 && <ProgressBar value={summary.requiredValidated} max={summary.required} label={`Obrigatórias validadas em ${c.title as string}`} />}
            <ul className={styles.items}>
              {cItems.map((i) => {
                const t = techniqueOf.get(i.technique_id as string);
                const current = (status.get(i.technique_id as string) ?? "not_started") as SkillStatus;
                return (
                  <li key={`${c.id}-${i.technique_id}`} className={styles.item}>
                    <div>
                      {t ? <Link href={`/tecnicas/${t.id}`}>{t.name as string}</Link> : "Técnica"}
                      {i.required ? null : <> <Badge>opcional</Badge></>}
                    </div>
                    {current === "validated" ? (
                      <Badge tone="success">{skillStatusLabels.validated}</Badge>
                    ) : (
                      <SkillSelect academyId={c.academy_id as string} techniqueId={i.technique_id as string} current={current} />
                    )}
                  </li>
                );
              })}
            </ul>
          </Card>
        );
      })}
    </Page>
  );
}
