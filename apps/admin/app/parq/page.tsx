import { ButtonLink, Page, PageHeader } from "@/components/ui";
import { ParqSection } from "@/components/parq-section";
import { getCaller } from "@/lib/context";

// O PAR-Q da própria pessoa (adulta). Menores respondem pelo responsável, em /dependentes/{menor}/parq.
export default async function ParqPage() {
  const { supabase, userId } = await getCaller();
  return (
    <Page width="narrow">
      <PageHeader title="PAR-Q e termo de saúde" subtitle="Questionário de prontidão para atividade física" actions={<ButtonLink href="/perfil" variant="secondary">← Meu perfil</ButtonLink>} />
      <ParqSection supabase={supabase} userId={userId} revalidate="/parq" />
    </Page>
  );
}
