import { beltAgeReference } from "@dojo/contracts/belts";
import { Alert, BeltBar, ButtonLink, Card, Page, PageHeader } from "@/components/ui";
import { getCaller } from "@/lib/context";
import styles from "./idades.module.css";

// Quadro de consulta: idade mínima de cada faixa. NÃO é regra do sistema (cada academia define as suas).
const AGES = Array.from({ length: 16 }, (_, i) => i + 4); // 4..19
const LATE = [50, 57, 67];
const col = (age: number) => (age <= 19 ? age - 3 : 16 + LATE.indexOf(age) + 1);

export default async function IdadesPage() {
  await getCaller();
  const last = 16 + LATE.length;
  return (
    <Page>
      <PageHeader
        title="Idades mínimas por faixa"
        subtitle="Quadro de referência. Cada academia define as suas próprias regras de graduação; nada aqui bloqueia ou libera uma graduação."
        actions={<ButtonLink href="/graduacao" variant="secondary">Voltar</ButtonLink>}
      />
      <Alert tone="info">Referência do mercado enviada pelo dono do produto. Confirme com a sua federação ou academia antes de usar como regra.</Alert>
      <Card className={styles.card}>
        <div className={styles.chart} role="table" aria-label="Idade mínima por faixa">
          <div className={styles.head} role="row">
            <span />
            <div className={styles.axis} style={{ gridTemplateColumns: `repeat(${last}, 1fr)` }}>
              {AGES.map((a) => <span key={a}>{a === 19 ? "19+" : a}</span>)}
              {LATE.map((a) => <span key={a}>{a}+</span>)}
            </div>
          </div>
          {beltAgeReference.map((r) => (
            <div key={r.belt} className={styles.row} role="row">
              <span className={styles.name} role="rowheader">{r.belt}</span>
              <div className={styles.track} style={{ gridTemplateColumns: `repeat(${last}, 1fr)` }}>
                <div className={styles.bar} style={{ gridColumn: `${col(r.from)} / ${(r.until ? col(r.until) : last) + 1}` }}>
                  <BeltBar belt={r.belt} size="md" />
                </div>
              </div>
              <span className={styles.age}>{r.until ? `${r.from} a ${r.until}` : `${r.from}+`}</span>
            </div>
          ))}
        </div>
      </Card>
    </Page>
  );
}
