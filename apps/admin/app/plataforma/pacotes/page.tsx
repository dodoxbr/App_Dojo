import { redirect } from "next/navigation";
import { featureKeys, featureLabels, planRowSchema } from "@dojo/contracts/features";
import { Alert, Button, ButtonLink, Card, Page, PageHero } from "@/components/ui";
import { getCaller } from "@/lib/context";
import { savePlanFeatures } from "../actions";
import styles from "./pacotes.module.css";

// Super admin: o que cada pacote inclui. Os pacotes de hoje são valores de TESTE (o dono do produto define os finais).
export default async function PacotesPage({ searchParams }: { searchParams: Promise<{ ok?: string; erro?: string }> }) {
  const { ok, erro } = await searchParams;
  const { supabase, isPlatformAdmin } = await getCaller();
  if (!isPlatformAdmin) redirect("/perfil");

  const [{ data: plansRaw }, { data: academies }] = await Promise.all([
    supabase.from("plans").select("code, name, position, features").order("position"),
    supabase.from("academies").select("plan_code"),
  ]);
  const plans = ((plansRaw ?? []) as unknown[]).map((x) => planRowSchema.safeParse(x)).flatMap((r) => (r.success ? [r.data] : []));
  const inPlan = (code: string) => (academies ?? []).filter((a) => a.plan_code === code).length;

  return (
    <Page>
      <PageHero
        eyebrow="Plataforma"
        title="Pacotes"
        subtitle="Cada academia tem um pacote que liga ou desliga funcionalidades opcionais. O núcleo (conta, filiação, turmas e aulas, presença, diário, técnicas, graduação, menores e responsáveis, saúde e termos) nunca depende de pacote."
        actions={<ButtonLink href="/plataforma" variant="secondary">Voltar à plataforma</ButtonLink>}
      />
      {ok && <Alert tone="success">Pacote salvo.</Alert>}
      {erro && <Alert tone="danger">Não foi possível salvar o pacote.</Alert>}
      <Alert tone="info">Os conteúdos abaixo são valores de TESTE até o dono do produto definir os pacotes finais e os preços. Desligar uma funcionalidade impede que a academia crie dados novos dela (o banco barra); o que já existe fica guardado, e apagar e moderar continuam permitidos.</Alert>

      <div className={styles.grid}>
        {plans.map((p) => (
          <Card key={p.code} className={styles.plan}>
            <form action={savePlanFeatures} className={styles.form}>
              <input type="hidden" name="planCode" value={p.code} />
              <h2 className={styles.name}>{p.name}</h2>
              <p className={styles.meta}>{inPlan(p.code)} academia(s) neste pacote</p>
              <fieldset className={styles.features}>
                <legend>Funcionalidades incluídas</legend>
                {featureKeys.map((f) => (
                  <label key={f} className={styles.check}>
                    <input type="checkbox" name="features" value={f} defaultChecked={p.features.includes(f)} /> {featureLabels[f]}
                  </label>
                ))}
              </fieldset>
              <Button type="submit">Salvar {p.name}</Button>
            </form>
          </Card>
        ))}
      </div>
    </Page>
  );
}
