import type { SupabaseClient } from "@supabase/supabase-js";
import { parqAdvice, parqRowSchema } from "@dojo/contracts/parq";
import { Alert, Badge, Section } from "@/components/ui";
import { ParqForm } from "@/app/parq/parq-form";

// O PAR-Q de uma pessoa (a própria ou um menor, para o responsável): a situação atual e o fluxo para (re)responder e assinar.
export async function ParqSection({ supabase, userId, revalidate, subjectName, forMinor = false }: { supabase: SupabaseClient; userId: string; revalidate: string; subjectName?: string; forMinor?: boolean }) {
  const { data } = await supabase.rpc("my_parq", { p_user_id: userId });
  const last = parqRowSchema.safeParse(((data ?? []) as unknown[])[0]);
  const row = last.success ? last.data : null;
  const day = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

  const { data: blocksRaw } = await supabase.rpc("my_parq_blocks");
  const blocks = (blocksRaw ?? []) as { academy_id: string; academy_name: string; reason: string }[];
  return (
    <>
      {blocks.length > 0 && !forMinor && (
        <Alert tone="danger">
          O check-in está <strong>bloqueado</strong> em {blocks.map((b) => b.academy_name).join(", ")} porque o seu PAR-Q {blocks.some((b) => b.reason === "missing") ? "não foi respondido" : "está vencido"}. Responda abaixo e o check-in volta a liberar na hora.
        </Alert>
      )}
      <Alert tone="info">
        O PAR-Q é um questionário rápido (7 perguntas de sim ou não) sobre a prontidão para a atividade física, seguido do termo de responsabilidade de saúde e da sua assinatura. É um aviso de segurança, não um diagnóstico, e vale por 12 meses. Os dados de saúde são privados: só {forMinor ? "você (responsável), " : "você, "}o gestor e o professor com permissão de ver saúde conseguem ver, e cada consulta é registrada.
        <br /><strong>Texto de referência do PAR-Q e termo padrão, em revisão (saúde e jurídico).</strong>
      </Alert>
      <Section title="Situação">
        {!row ? (
          <p><Badge tone="danger">Não respondido</Badge> Responda abaixo antes de treinar.</p>
        ) : (
          <>
            <p>
              {row.expired ? <Badge tone="danger">Vencido</Badge> : row.has_flag ? (row.certificate_checked_at ? <Badge tone="success">Atestado conferido</Badge> : <Badge tone="info">Atestado médico pendente</Badge>) : <Badge tone="success">Sem alertas</Badge>}{" "}
              Respondido em {day(row.created_at)} · vale até {day(row.valid_until)}.
            </p>
            {row.has_flag && !row.expired && !row.certificate_checked_at && <Alert tone="danger">{parqAdvice}</Alert>}
            {row.expired && <p>O PAR-Q passou de 12 meses: responda de novo.</p>}
          </>
        )}
      </Section>
      <Section title={row ? "Responder de novo" : "Responder o PAR-Q"} hint={forMinor ? `Você responde por ${subjectName ?? "o menor"}, como responsável legal.` : undefined}>
        <ParqForm userId={userId} revalidate={revalidate} subjectName={subjectName} forMinor={forMinor} />
      </Section>
    </>
  );
}
