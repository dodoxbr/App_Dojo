import { notFound, redirect } from "next/navigation";
import { contactStatusSchema } from "@dojo/contracts/contacts";
import { ageFlagSchema } from "@dojo/contracts/guardians";
import { membershipRoleLabels, membershipStatusLabels } from "@dojo/contracts/membership";
import { Alert, Avatar, Badge, Button, ButtonLink, EmptyState, Page, PageHeader, Section } from "@/components/ui";
import { getCaller } from "@/lib/context";
import { errorFromCode } from "@/lib/rpc-errors";
import { AddMemberForm } from "./add-member-form";
import { decide, endMembership } from "./actions";
import styles from "./membros.module.css";

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
  const tags = (userId: string) => {
    const f = flags.get(userId);
    return (
      <>
        {f?.is_minor && <Badge tone={f.guardian_ready ? "info" : "danger"}>{f.guardian_ready ? "Menor · responsável conferido" : "Menor · falta conferir o responsável"}</Badge>}
        {hasFicha.get(userId) === false && <Badge tone="neutral">Ficha pendente</Badge>}
      </>
    );
  };

  const pending = (members ?? []).filter((m) => m.status === "pending");
  const active = (members ?? []).filter((m) => m.status === "approved" || m.status === "suspended");
  const closed = (members ?? []).filter((m) => m.status === "rejected" || m.status === "ended");
  const message = errorFromCode(erro);
  const nameFor = (userId: string) => nameOf.get(userId) ?? "Pessoa";

  return (
    <Page width="narrow">
      <PageHeader
        title="Membros"
        subtitle={academy.name}
        actions={<ButtonLink href={`/academia/${id}`} variant="secondary">← {academy.name}</ButtonLink>}
      />
      {message && <Alert tone="danger">{message}</Alert>}

      <Section title="Pedidos de entrada">
        {pending.length === 0 ? (
          <p className={styles.empty}>Nenhum pedido pendente.</p>
        ) : (
          <ul className={styles.list}>
            {pending.map((m) => (
              <li key={m.id as string} className={styles.row}>
                <form action={decide.bind(null, id)} className={styles.decide}>
                  <div className={styles.who}>
                    <Avatar name={nameFor(m.user_id as string)} />
                    <strong>{nameFor(m.user_id as string)}</strong>
                    {tags(m.user_id as string)}
                  </div>
                  <input type="hidden" name="membershipId" value={m.id as string} />
                  <input type="hidden" name="idempotencyKey" value={crypto.randomUUID()} />
                  <label className={styles.reason}>Justificativa (opcional) <input name="reason" maxLength={500} /></label>
                  <div className={styles.actions}>
                    <Button type="submit" name="decision" value="approved">Aprovar</Button>
                    <Button type="submit" name="decision" value="rejected" variant="secondary">Rejeitar</Button>
                  </div>
                </form>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Cadastrar aluno ou colaborador">
        <AddMemberForm academyId={id} />
      </Section>

      <Section title="Membros">
        {active.length === 0 ? (
          <EmptyState title="Nenhum membro ainda">Cadastre o primeiro aluno ou colaborador acima, ou compartilhe o link de entrada da academia.</EmptyState>
        ) : (
          <ul className={styles.list}>
            {active.map((m) => (
              <li key={m.id as string} className={styles.row}>
                <div className={styles.who}>
                  <Avatar name={nameFor(m.user_id as string)} />
                  <strong>{nameFor(m.user_id as string)}</strong>
                  <Badge tone="accent">{membershipRoleLabels[m.role as string]}</Badge>
                  <Badge tone={m.status === "approved" ? "success" : "neutral"}>{membershipStatusLabels[m.status as string]}</Badge>
                  {tags(m.user_id as string)}
                </div>
                <div className={styles.actions}>
                  <ButtonLink href={`/academia/${id}/membros/${m.user_id as string}`} variant="secondary">Ficha</ButtonLink>
                  {m.role === "student" && m.status === "approved" && (
                    <ButtonLink href={`/academia/${id}/financeiro/alunos/${m.user_id as string}`} variant="secondary">Financeiro</ButtonLink>
                  )}
                  {m.role !== "manager" && (
                    <form action={endMembership.bind(null, id)}>
                      <input type="hidden" name="membershipId" value={m.id as string} />
                      <Button type="submit" variant="secondary">Encerrar vínculo</Button>
                    </form>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {closed.length > 0 && (
        <Section title="Encerrados e rejeitados">
          <ul className={styles.list}>
            {closed.map((m) => (
              <li key={m.id as string} className={styles.row}>
                <div className={styles.who}>
                  <Avatar name={nameFor(m.user_id as string)} />
                  <strong>{nameFor(m.user_id as string)}</strong>
                  <Badge tone="neutral">{membershipStatusLabels[m.status as string]}</Badge>
                </div>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </Page>
  );
}
