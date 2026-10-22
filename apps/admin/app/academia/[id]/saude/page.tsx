import { notFound, redirect } from "next/navigation";
import { formatPhone, healthNoteSchema } from "@dojo/contracts/contacts";
import { Alert, Avatar, Badge, ButtonLink, Card, EmptyState, Page, PageHeader } from "@/components/ui";
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

  return (
    <Page>
      <PageHeader
        title="Saúde e contato de emergência"
        subtitle={academy.name}
        actions={<ButtonLink href={`/academia/${id}`} variant="secondary">← {academy.name}</ButtonLink>}
      />
      <Alert tone="info">Dados sensíveis informados pelos próprios alunos (ou pelos responsáveis dos menores) com consentimento. Os instrutores com a permissão &quot;ver observações de saúde&quot; veem estes dados na tela da aula. Cada consulta é registrada.</Alert>
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
