import Link from "next/link";
import { adultImageTerm, fillTerms, PHOTO_TERM_VERSION, photoTerm } from "@dojo/contracts/terms";
import { Alert, Page, PageHeader, Section } from "@/components/ui";

export const metadata = { title: "Termo de uso de imagem — Oss" };

// Página pública (sem login): o responsável lê o termo antes de assinar. RASCUNHO até a revisão jurídica.
export default function TermoDeImagemPage() {
  return (
    <Page width="narrow">
      <PageHeader title="Termo de uso de imagem de menor" subtitle={`Versão ${PHOTO_TERM_VERSION}`} />
      <Alert tone="info"><strong>Rascunho em revisão jurídica.</strong> O texto final será definido antes do uso com alunos reais. Quem assina é o responsável legal do menor, digitando o nome completo, ao pedir a vaga ou na tela do menor.</Alert>
      {fillTerms(photoTerm, { empresa: null }).map((s) => (
        <Section key={s.id} title={s.title}>
          {s.paragraphs.map((p) => <p key={p} style={{ margin: 0, lineHeight: 1.6 }}>{p.replace("a academia a definir", "a academia")}</p>)}
        </Section>
      ))}
      <h2 style={{ margin: "var(--space-4) 0 0" }}>Para adultos</h2>
      {fillTerms(adultImageTerm, { empresa: null }).map((s) => (
        <Section key={s.id} title={s.title}>
          {s.paragraphs.map((p) => <p key={p} style={{ margin: 0, lineHeight: 1.6 }}>{p.replace("a academia a definir", "a academia")}</p>)}
        </Section>
      ))}
      <p><Link href="/login">← Entrar</Link></p>
    </Page>
  );
}
