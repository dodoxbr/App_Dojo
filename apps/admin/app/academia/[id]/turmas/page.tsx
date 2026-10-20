import Link from "next/link";
import { notFound, redirect } from "next/navigation";
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
    <main style={{ padding: 16, display: "grid", gap: 16, maxWidth: 640 }}>
      <p><Link href={`/academia/${id}`}>← {academy.name}</Link></p>
      <h1>Turmas</h1>

      {(classes ?? []).length === 0 ? (
        <p>Nenhuma turma criada ainda.</p>
      ) : (
        <ul>
          {(classes ?? []).map((c) => (
            <li key={c.id as string}>
              <Link href={`/turmas/${c.id}`}>{c.title}</Link> — {nameOf.get(c.instructor_user_id as string) ?? "Instrutor"}
              {c.is_active ? "" : " (inativa)"}
            </li>
          ))}
        </ul>
      )}

      <section>
        <h2>Nova turma</h2>
        {instructors.length === 0 ? (
          <p>Cadastre antes um instrutor em <Link href={`/academia/${id}/membros`}>Membros</Link>.</p>
        ) : (
          <CreateClassForm academyId={id} instructors={instructors} />
        )}
      </section>
    </main>
  );
}
