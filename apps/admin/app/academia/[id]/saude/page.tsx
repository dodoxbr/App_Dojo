import { notFound, redirect } from "next/navigation";
import { formatPhone, healthNoteSchema } from "@dojo/contracts/contacts";
import { parqState, parqStateLabels, parqStatusRowSchema } from "@dojo/contracts/parq";
import { Alert, Avatar, Badge, ButtonLink, Card, DataTable, EmptyState, Page, PageHeader, type DataRow } from "@/components/ui";
import { getCaller } from "@/lib/context";

// Everyone in the academy who has health notes, with the emergency contact (manager). Teachers see the same data per lesson.
export default async function SaudePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, managedAcademies } = await getCaller();
  if (!managedAcademies.some((a) => a.id === id)) redirect("/perfil");
  const { data: academy } = await supabase.from("academies").select("id, name").eq("id", id).maybeSingle();
  if (!academy) notFound();
  const { data: raw } = await supabase.rpc("list_health_notes", { p_academy_id: id });
  const rows = ((raw ?? []) as unknown[]).map((x) => healthNoteSchema.safeParse(x)).flatMap((r) => (r.success ? [r.data] : []));
  const { data: parqRaw } = await supabase.rpc("list_parq_status", { p_academy_id: id });
  const parqRows: DataRow[] = ((parqRaw ?? []) as unknown[]).map((x) => parqStatusRowSchema.safeParse(x)).flatMap((r) => (r.success ? [r.data] : [])).map((r) => {
    const state = parqState({ answered_at: r.answered_at, has_flag: r.has_flag, expired: r.expired, certificate_checked: r.certificate_checked });
    const tone = state === "ok" || state === "certificate" ? "success" : state === "attention" ? "info" : "danger";
    return {
      id: r.user_id,
      search: r.person_name,
      tags: [state],
      cells: {
        aluno: <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><Avatar name={r.person_name} size="sm" /><strong>{r.person_name}</strong>{r.is_minor && <Badge tone="info">Menor</Badge>}</span>,
        situacao: <Badge tone={tone}>{parqStateLabels[state]}</Badge>,
        data: r.answered_at ? new Date(r.answered_at).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "—",
        acoes: r.answered_at ? <ButtonLink href={`/academia/${id}/saude/parq/${r.user_id}`} variant="secondary">Ver respostas</ButtonLink> : <span style={{ color: "var(--text-muted)" }}>—</span>,
      },
    };
  });

  return (
    <Page>
      <PageHeader
        title="Saúde e contato de emergência"
        subtitle={academy.name}
        actions={<ButtonLink href={`/academia/${id}`} variant="secondary">← {academy.name}</ButtonLink>}
      />
      <Alert tone="info">Dados sensíveis informados pelos próprios alunos (ou pelos responsáveis dos menores) com consentimento. Os instrutores com a permissão &quot;ver observações de saúde&quot; veem estes dados na tela da aula. Cada consulta é registrada.</Alert>
      <h2 style={{ margin: "var(--space-2) 0 0", fontSize: "var(--text-lg)" }}>PAR-Q dos alunos</h2>
      <Alert tone="info">Qualquer &quot;sim&quot; no PAR-Q exige atestado médico físico: ao conferir o atestado, marque na tela de respostas. O PAR-Q vale por 12 meses. Abrir as respostas é registrado.</Alert>
      {parqRows.length === 0 ? (
        <EmptyState title="Nenhum aluno aprovado">Os alunos aparecem aqui depois de aprovados.</EmptyState>
      ) : (
        <DataTable
          searchLabel="Buscar aluno"
          columns={[
            { key: "aluno", label: "Aluno" },
            { key: "situacao", label: "PAR-Q" },
            { key: "data", label: "Respondido em" },
            { key: "acoes", label: "Ações", align: "right" },
          ]}
          rows={parqRows}
          filters={[
            { value: "none", label: "Não respondeu" },
            { value: "attention", label: "Atestado pendente" },
            { value: "expired", label: "Vencido" },
          ]}
          emptyText="Nenhum aluno com esse filtro."
        />
      )}
      <h2 style={{ margin: "var(--space-4) 0 0", fontSize: "var(--text-lg)" }}>Observações de saúde e contato de emergência</h2>
      {rows.length === 0 ? (
        <EmptyState title="Nenhuma observação de saúde">Nenhum aluno informou observações de saúde.</EmptyState>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {rows.map((r) => (
            <Card key={r.user_id}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <Avatar name={r.person_name} />
                <strong>{r.person_name}</strong>
                {r.is_minor && <Badge tone="info">Menor</Badge>}
              </div>
              <p style={{ margin: "12px 0 4px" }}>{r.health_notes}</p>
              <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--text-muted)" }}>
                Emergência: {r.emergency_name ?? "—"}{r.emergency_relationship ? ` (${r.emergency_relationship})` : ""} {r.emergency_phone ? formatPhone(r.emergency_phone) : ""}
              </p>
            </Card>
          ))}
        </div>
      )}
    </Page>
  );
}
