import Link from "next/link";
import { DECLARATIONS_VERSION, healthDeclaration } from "@dojo/contracts/terms";
import { Alert, Page, PageHeader, Section } from "@/components/ui";

export const metadata = { title: "Declaração de saúde — Oss" };

// Página pública (sem login): a pessoa lê a declaração antes de marcar no cadastro. RASCUNHO até a revisão jurídica.
export default function DeclaracaoDeSaudePage() {
  return (
    <Page width="narrow">
      <PageHeader title="Declaração de saúde" subtitle={`Versão ${DECLARATIONS_VERSION}`} />
      <Alert tone="info"><strong>Rascunho em revisão jurídica.</strong> O texto final será definido antes do uso com alunos reais. Ao criar a conta, a pessoa lê e marca que declara; a plataforma guarda a data e a versão.</Alert>
      {healthDeclaration.map((s) => (
        <Section key={s.id} title={s.title}>
          {s.paragraphs.map((p) => <p key={p} style={{ margin: 0, lineHeight: 1.6 }}>{p}</p>)}
        </Section>
      ))}
      <p><Link href="/login">← Entrar</Link></p>
    </Page>
  );
}
