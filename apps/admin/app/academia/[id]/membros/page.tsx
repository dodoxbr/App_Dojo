import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { contactStatusSchema } from "@dojo/contracts/contacts";
import { ageFlagSchema } from "@dojo/contracts/guardians";
import { membershipRoleLabels, membershipStatusLabels } from "@dojo/contracts/membership";
import { getCaller } from "@/lib/context";
import { errorFromCode } from "@/lib/rpc-errors";
import { AddMemberForm } from "./add-member-form";
import { decide, endMembership } from "./actions";

export default async function MembrosPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ erro?: string }>;
}) {
  const { id } = await params;
  const { erro } = await searchParams;
  const { supabase, isPlatformAdmin, managedAcademies } = await getCaller();
  if (!isPlatformAdmin && !managedAcademies.some((a) => a.id === id)) redirect("/perfil");

  const { data: academy } = await supabase.from("academies").select("id, name, slug").eq("id", id).maybeSingle();
  if (!academy) notFound();

  const { data: members } = await supabase
    .from("memberships")
    .select("id, user_id, role, status")
    .eq("academy_id", id)
    .order("created_at", { ascending: true });
  const userIds = (members ?? []).map((m) => m.user_id as string);
  const { data: profiles } = userIds.length
    ? await supabase.from("profiles").select("id, display_name").in("id", userIds)
    : { data: [] as { id: string; display_name: string }[] };
  const nameOf = new Map((profiles ?? []).map((p) => [p.id, p.display_name]));
  // Minors are only marked as "menor"; the birth date itself is never shown.
  const { data: flagsRaw } = await supabase.rpc("member_age_flags", { p_academy_id: id });
  const flags = new Map(
    ((flagsRaw ?? []) as unknown[]).map((x) => ageFlagSchema.safeParse(x)).flatMap((r) => (r.success ? [[r.data.user_id, r.data] as const] : [])),
  );
  const { data: contactRaw } = await supabase.rpc("contact_status", { p_academy_id: id });
  const hasFicha = new Map(
    ((contactRaw ?? []) as unknown[]).map((x) => contactStatusSchema.safeParse(x)).flatMap((r) => (r.success ? [[r.data.user_id, r.data.has_contact] as const] : [])),
  );
  const minorTag = (userId: string) => {
    const f = flags.get(userId);
    const age = f?.is_minor ? (f.guardian_ready ? " (menor · responsável conferido)" : " (menor · falta conferir o responsável)") : "";
    return `${age}${hasFicha.get(userId) === false ? " · ficha pendente" : ""}`;
  };

  const pending = (members ?? []).filter((m) => m.status === "pending");
  const active = (members ?? []).filter((m) => m.status === "approved" || m.status === "suspended");
  const closed = (members ?? []).filter((m) => m.status === "rejected" || m.status === "ended");
  const message = errorFromCode(erro);

  return (
    <main style={{ padding: 16, display: "grid", gap: 16, maxWidth: 640 }}>
      <p><Link href={`/academia/${id}`}>← {academy.name}</Link></p>
      <h1>Membros</h1>
      {message && <p role="alert">{message}</p>}

      <section>
        <h2>Pedidos de entrada</h2>
        {pending.length === 0 ? (
          <p>Nenhum pedido pendente.</p>
        ) : (
          <ul>
            {pending.map((m) => (
              <li key={m.id as string}>
                <form action={decide.bind(null, id)}>
                  <strong>{nameOf.get(m.user_id as string) ?? "Pessoa"}</strong>{minorTag(m.user_id as string)}
                  <input type="hidden" name="membershipId" value={m.id as string} />
                  <input type="hidden" name="idempotencyKey" value={crypto.randomUUID()} />
                  <label> Justificativa (opcional) <input name="reason" maxLength={500} /></label>
                  <button type="submit" name="decision" value="approved">Aprovar</button>
                  <button type="submit" name="decision" value="rejected">Rejeitar</button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2>Cadastrar aluno ou colaborador</h2>
        <AddMemberForm academyId={id} />
      </section>

      <section>
        <h2>Membros</h2>
        {active.length === 0 ? (
          <p>Nenhum membro ainda.</p>
        ) : (
          <ul>
            {active.map((m) => (
              <li key={m.id as string}>
                {nameOf.get(m.user_id as string) ?? "Pessoa"}{minorTag(m.user_id as string)} — {membershipRoleLabels[m.role as string]} ·{" "}
                {membershipStatusLabels[m.status as string]}
                {" "}<Link href={`/academia/${id}/membros/${m.user_id as string}`}>Ficha</Link>{m.role === "student" && m.status === "approved" && <> · <Link href={`/academia/${id}/financeiro/alunos/${m.user_id as string}`}>Financeiro</Link></>}
                {m.role !== "manager" && (
                  <form action={endMembership.bind(null, id)} style={{ display: "inline", marginLeft: 8 }}>
                    <input type="hidden" name="membershipId" value={m.id as string} />
                    <button type="submit">Encerrar vínculo</button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {closed.length > 0 && (
        <section>
          <h2>Encerrados e rejeitados</h2>
          <ul>
            {closed.map((m) => (
              <li key={m.id as string}>
                {nameOf.get(m.user_id as string) ?? "Pessoa"} — {membershipStatusLabels[m.status as string]}
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
