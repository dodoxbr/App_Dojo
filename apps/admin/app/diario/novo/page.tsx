import { ButtonLink, Page, PageHeader, Section } from "@/components/ui";
import { getCaller } from "@/lib/context";
import { approvedAcademies } from "@/lib/diary";
import { LogForm } from "../log-form";

export default async function NovoRegistroPage() {
  const { supabase, userId } = await getCaller();
  const academies = await approvedAcademies(supabase, userId);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <Page width="narrow">
      <PageHeader
        title="Registrar treino"
        subtitle="Anote quando e o que você treinou. O diário é só seu."
        actions={<ButtonLink href="/diario" variant="secondary">← Meu diário</ButtonLink>}
      />
      <Section title="Dados do treino">
        <LogForm academies={academies} initial={{ academyId: "", trainedDate: today, startTime: "", endTime: "", notes: "", techniques: [] }} />
      </Section>
    </Page>
  );
}
