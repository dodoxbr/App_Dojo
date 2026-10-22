import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ButtonLink, Page, PageHeader, Section } from "@/components/ui";
import { getCaller } from "@/lib/context";
import { scheduleSchema } from "@dojo/contracts/academy-page";
import { PageForm, type PageValues } from "./page-form";
import { ScheduleForm } from "./schedule-form";

// Edição da página pública da academia (/a/{slug}): só gestor e super admin.
export default async function PaginaPublicaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, isPlatformAdmin, managedAcademies } = await getCaller();
  if (!isPlatformAdmin && !managedAcademies.some((a) => a.id === id)) redirect("/perfil");
  const { data: academy } = await supabase.from("academies").select("id, name, slug").eq("id", id).maybeSingle();
  if (!academy) notFound();
  const { data: values } = await supabase.rpc("get_academy_profile", { p_academy_id: id });
  const v = (values ?? {}) as PageValues & { schedule?: unknown };
  const schedule = scheduleSchema.safeParse(v.schedule ?? []);

  return (
    <Page width="narrow">
      <PageHeader
        title="Página pública da academia"
        subtitle={academy.name}
        actions={<ButtonLink href={`/academia/${id}`} variant="secondary">← {academy.name}</ButtonLink>}
      />
      <Section
        title="Informações da academia"
        hint={
          <>
            Endereço da página: <code>/a/{academy.slug}</code>{" "}
            {v.is_public ? <>· <Link href={`/a/${academy.slug}`} target="_blank">abrir a página</Link></> : <>(oculta até você publicar)</>}. Coloque só dados da academia, nunca de alunos.
          </>
        }
      >
        <PageForm academyId={id} values={v} />
      </Section>

      <Section title="Grade de horários" hint="Aparece na página pública, agrupada como você montar (Adulto, Infantil, Feminino…). É divulgação: as turmas e aulas de verdade continuam em Turmas e aulas.">
        <ScheduleForm academyId={id} saved={schedule.success ? schedule.data : []} />
      </Section>
    </Page>
  );
}
