import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Badge, ButtonLink, EmptyState, ItemLink, ItemList, Page, PageHeader, Section } from "@/components/ui";
import { getCaller } from "@/lib/context";
import { instructorCandidates } from "@/lib/academy-people";
import { CreateClassForm } from "../../../turmas/forms";

export default async function TurmasDaAcademiaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, isPlatformAdmin, managedAcademies } = await getCaller();
  if (!isPlatformAdmin && !managedAcademies.some((a) => a.id === id)) redirect("/perfil");

  const { data: academy } = await supabase.from("academies").select("id, name").eq("id", id).maybeSingle();
  if (!academy) notFound();

  const [{ data: classes }, instructors] = await Promise.all([
    supabase.from("classes").select("id, title, instructor_user_id, is_active").eq("academy_id", id).order("title"),
    instructorCandidates(supabase, id),
  ]);
  const nameOf = new Map(instructors.map((p) => [p.id, p.name]));

  return (
    <Page width="narrow">
      <PageHeader
        title="Turmas"
        subtitle={academy.name}
        actions={<ButtonLink href={`/academia/${id}`} variant="secondary">← {academy.name}</ButtonLink>}
      />

      {(classes ?? []).length === 0 ? (
        <EmptyState title="Nenhuma turma criada ainda">Crie a primeira turma abaixo para poder agendar aulas.</EmptyState>
      ) : (
        <ItemList>
          {(classes ?? []).map((c) => (
            <li key={c.id as string}>
              <ItemLink
                href={`/turmas/${c.id}`}
                title={c.title as string}
                meta={nameOf.get(c.instructor_user_id as string) ?? "Instrutor"}
                badges={c.is_active ? undefined : <Badge tone="neutral">Inativa</Badge>}
              />
            </li>
          ))}
        </ItemList>
      )}

      <Section title="Nova turma">
        {instructors.length === 0 ? (
          <p>Cadastre antes um instrutor em <Link href={`/academia/${id}/membros`}>Membros</Link>.</p>
        ) : (
          <CreateClassForm academyId={id} instructors={instructors} />
        )}
      </Section>
    </Page>
  );
}
