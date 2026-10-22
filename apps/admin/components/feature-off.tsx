import { featureLabels, featureOffMessage, type FeatureKey } from "@dojo/contracts/features";
import { ButtonLink, EmptyState, Page, PageHeader } from "@/components/ui";

// Tela para uma funcionalidade que o pacote da academia não inclui (a navegação já deixa de mostrá-la; isto cobre o endereço digitado).
export function FeatureOff({ feature }: { feature: FeatureKey }) {
  return (
    <Page width="narrow">
      <PageHeader title={featureLabels[feature]} />
      <EmptyState title="Não disponível nesta academia" action={<ButtonLink href="/perfil" variant="secondary">Voltar ao perfil</ButtonLink>}>
        {featureOffMessage(feature)} Fale com o gestor da sua academia.
      </EmptyState>
    </Page>
  );
}
