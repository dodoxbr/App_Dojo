import Link from "next/link";
import { notFound } from "next/navigation";
import { consentStepLabel, overviewSchema } from "@dojo/contracts/guardians";
import { idSchema } from "@dojo/contracts/membership";
import { getCaller } from "@/lib/context";
import { InviteForm } from "../forms";
import { revokeConsent } from "../actions";

const fmtWhen = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }).format(new Date(iso));

// What the legal guardian follows about the minor. The diary is never part of this page.
export default async function DependentePage({ params }: { params: Promise<{ minorId: string }> }) {
  const { minorId } = await params;
  if (!idSchema.safeParse(minorId).success) notFound();
  const { supabase } = await getCaller();
  const { data, error } = await supabase.rpc("guardian_overview", { p_minor_id: minorId });
  const parsed = overviewSchema.safeParse(data);
  if (error || !parsed.success || !parsed.data.minor) notFound();
  const o = parsed.data;

  return (
    <main style={{ padding: 16, display: "grid", gap: 20, maxWidth: 640 }}>
      <p><Link href="/dependentes">← Meus dependentes</Link></p>
      <h1>{o.minor?.display_name}</h1>

      {o.academies.length === 0 ? (
        <p>Ainda não há pedido de vaga. Abra o link da academia (<code>/entrar/endereço-da-academia</code>) para pedir a vaga do menor.</p>
      ) : (
        o.academies.map((a) => (
          <section key={a.consent_id}>
            <h2>{a.name}</h2>
            <p role="status">{consentStepLabel(a)}</p>
            {a.consent_status === "verified" && a.consent_active && (
              <ul>
                <li>Presenças confirmadas nos últimos 30 dias: {a.validated_attendances_30_days ?? 0}</li>
                <li>Graduação: {a.rank ? `${a.rank.belt_code}, grau ${a.rank.degree} (desde ${new Date(`${a.rank.since}T12:00:00Z`).toLocaleDateString("pt-BR", { timeZone: "UTC" })})` : "ainda sem graduação registrada"}</li>
                <li>Próximas aulas: {(a.next_sessions ?? []).length === 0 ? "nenhuma agendada" : (a.next_sessions ?? []).map((s) => `${s.title} (${fmtWhen(s.starts_at)})`).join("; ")}</li>
                <li>Uso de fotos: {a.consent_photos ? "autorizado" : "não autorizado"}</li>
              </ul>
            )}
            {a.consent_active && (
              <form action={revokeConsent.bind(null, minorId)}>
                <input type="hidden" name="consentId" value={a.consent_id} />
                <button type="submit">Revogar consentimento (suspende o menor)</button>
              </form>
            )}
          </section>
        ))
      )}

      <section>
        <h2>Responsável financeiro</h2>
        <p>Por padrão é você. Se outra pessoa paga as mensalidades, gere um código e envie a ela: ela terá acesso apenas à parte financeira.</p>
        <InviteForm minorId={minorId} />
      </section>

      <p role="note"><small>O diário de treino é privado e não aparece aqui. Menores não participam de desafios nem de rankings.</small></p>
    </main>
  );
}
