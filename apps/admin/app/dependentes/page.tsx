import { dependentRowSchema, guardianKindLabels } from "@dojo/contracts/guardians";
import { Alert, Badge, ButtonLink, Card, EmptyState, ItemLink, ItemList, Page, PageHero } from "@/components/ui";
import { getCaller } from "@/lib/context";
import { AcceptInviteForm } from "./forms";

export default async function DependentesPage() {
  const { supabase } = await getCaller();
  const [{ data: raw }, { data: ageStatus }] = await Promise.all([supabase.rpc("list_my_dependents"), supabase.rpc("my_age_status")]);
  const dependents = ((raw ?? []) as unknown[]).map((x) => dependentRowSchema.safeParse(x)).flatMap((r) => (r.success ? [r.data] : []));
  const isAdult = ageStatus === "adult";

  return (
    <Page width="narrow">
      <PageHero
        eyebrow="Responsável"
        title="Meus dependentes"
        subtitle="Menores de 18 anos não têm login: o responsável cadastra o menor e usa o app em nome dele."
        actions={isAdult ? <ButtonLink href="/dependentes/novo" variant="accent">Cadastrar um menor</ButtonLink> : undefined}
      />

      {dependents.length === 0 ? (
        <EmptyState title="Você ainda não cadastrou nenhum menor" />
      ) : (
        <ItemList>
          {dependents.map((d) => (
            <li key={`${d.minor_user_id}-${d.kind}`}>
              {d.kind === "legal" && !d.minor_is_adult ? (
                <ItemLink href={`/dependentes/${d.minor_user_id}`} title={d.minor_name} meta={`${guardianKindLabels[d.kind]} (${d.relationship})`} badges={<Badge tone="accent">Ver o acompanhamento</Badge>} />
              ) : (
                <Card>
                  <strong>{d.minor_name}</strong> — {guardianKindLabels[d.kind]} ({d.relationship})
                  {d.minor_is_adult && " · já completou 18 anos: o acesso do responsável terminou"}
                  {d.kind === "financial" && " · você cuida apenas da parte financeira"}
                </Card>
              )}
            </li>
          ))}
        </ItemList>
      )}

      {isAdult ? (
        <Card>
          <h2 style={{ margin: "0 0 8px", fontSize: "1.25rem" }}>Sou o responsável financeiro</h2>
          <p style={{ margin: "0 0 16px", color: "var(--text-muted)" }}>Se o responsável legal gerou um código para você, informe aqui. Você não verá a frequência nem a graduação do menor.</p>
          <AcceptInviteForm />
        </Card>
      ) : (
        <Alert tone="info">Informe sua data de nascimento (maior de 18 anos) no perfil para cadastrar um menor.</Alert>
      )}
    </Page>
  );
}
