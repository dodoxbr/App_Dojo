import { notFound, redirect } from "next/navigation";
import { parqAdvice, parqQuestions } from "@dojo/contracts/parq";
import { idSchema } from "@dojo/contracts/membership";
import { Alert, Badge, Button, ButtonLink, Page, PageHeader, Section } from "@/components/ui";
import { getCaller } from "@/lib/context";
import { markCertificate } from "../../parq-actions";
import styles from "@/app/parq/parq.module.css";

type Detail = {
  created_at: string; has_flag: boolean; answers: boolean[]; notes: string | null; signed_name: string; answered_by_guardian: boolean;
  term_version: string; term_hash: string | null; client_ip: string | null; user_agent: string | null; certificate_checked_at: string | null;
};

// As respostas do PAR-Q de um aluno: só com a permissão de ver saúde; abrir esta tela é registrado na auditoria.
export default async function ParqDetalhePage({ params }: { params: Promise<{ id: string; userId: string }> }) {
  const { id, userId } = await params;
  if (!idSchema.safeParse(id).success || !idSchema.safeParse(userId).success) notFound();
  const { supabase } = await getCaller();
  const { data, error } = await supabase.rpc("parq_detail", { p_academy_id: id, p_user_id: userId });
  if (error) redirect("/perfil"); // sem a permissão de ver saúde (o banco decide) ou pessoa fora da academia
  const d = ((data ?? []) as Detail[])[0];
  const { data: person } = await supabase.from("profiles").select("display_name").eq("id", userId).maybeSingle();
  const name = (person?.display_name as string | undefined) ?? "Aluno";
  const when = (iso: string) => new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });

  return (
    <Page width="narrow">
      <PageHeader title={`PAR-Q de ${name}`} subtitle="Dado de saúde: esta consulta foi registrada." actions={<ButtonLink href={`/academia/${id}/saude`} variant="secondary">← Saúde</ButtonLink>} />
      {!d ? (
        <Alert tone="info">{name} ainda não respondeu o PAR-Q.</Alert>
      ) : (
        <>
          {d.has_flag && (
            <Alert tone={d.certificate_checked_at ? "success" : "danger"}>
              {d.certificate_checked_at ? `Atestado médico conferido em ${when(d.certificate_checked_at)}.` : parqAdvice}
            </Alert>
          )}
          <Section title="Respostas">
            <ul className={styles.answers}>
              {parqQuestions.map((q, i) => (
                <li key={i}><span>{i + 1}. {q}</span><strong className={d.answers[i] ? styles.yes : styles.no}>{d.answers[i] ? "Sim" : "Não"}</strong></li>
              ))}
            </ul>
            {d.notes && <p><strong>Observações:</strong> {d.notes}</p>}
          </Section>
          <Section title="Assinatura e prova do aceite">
            <p>Assinado por <strong>{d.signed_name}</strong>{d.answered_by_guardian ? " (responsável legal do menor)" : ""} em {when(d.created_at)}.</p>
            <p className={styles.hint}>Versão do texto: {d.term_version}. Hash do termo: <code>{d.term_hash?.slice(0, 16)}…</code> · IP: {d.client_ip ?? "não informado"} · Navegador: {d.user_agent ?? "não informado"}.</p>
          </Section>
          {d.has_flag && !d.certificate_checked_at && (
            <form action={markCertificate.bind(null, id, userId)}>
              <Button type="submit">Conferi o atestado médico físico</Button>
            </form>
          )}
          {d.certificate_checked_at && <p><Badge tone="success">Atestado conferido</Badge></p>}
        </>
      )}
    </Page>
  );
}
