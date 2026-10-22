import { notFound } from "next/navigation";
import { formatTrainingTime } from "@dojo/contracts/diary";
import { Button, ButtonLink, Page, PageHeader, Section } from "@/components/ui";
import { getCaller } from "@/lib/context";
import { approvedAcademies, techniquesByLog } from "@/lib/diary";
import { deleteLog } from "../actions";
import { LogForm } from "../log-form";

export default async function RegistroPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, userId } = await getCaller();

  // Own entries only: the owner filter also keeps the platform admin out of this editor.
  const { data: log } = await supabase
    .from("training_logs")
    .select("id, academy_id, trained_at, start_time, end_time, notes")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  if (!log) notFound();

  const [techniques, academies] = await Promise.all([techniquesByLog(supabase, [id]), approvedAcademies(supabase, userId)]);
  const day = new Date(log.trained_at as string).toLocaleDateString("pt-BR", { timeZone: "UTC" });
  const period = formatTrainingTime(log.start_time as string | null, log.end_time as string | null);

  return (
    <Page width="narrow">
      <PageHeader
        title={`Treino de ${day}`}
        subtitle={period ? `Horário: ${period}` : undefined}
        actions={<ButtonLink href="/diario" variant="secondary">← Meu diário</ButtonLink>}
      />
      <Section title="Dados do treino">
        <LogForm
          logId={id}
          academies={academies}
          initial={{
            academyId: (log.academy_id as string | null) ?? "",
            trainedDate: (log.trained_at as string).slice(0, 10),
            startTime: ((log.start_time as string | null) ?? "").slice(0, 5),
            endTime: ((log.end_time as string | null) ?? "").slice(0, 5),
            notes: log.notes as string,
            techniques: techniques.get(id) ?? [],
          }}
        />
      </Section>
      <form action={deleteLog.bind(null, id)}>
        <Button type="submit" variant="secondary">Excluir este registro</Button>
      </form>
    </Page>
  );
}
