import Link from "next/link";
import { notFound } from "next/navigation";
import { dependentMedalSchema } from "@dojo/contracts/feed";
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
  const [{ data, error }, { data: contactRows }, { data: medalRows }] = await Promise.all([
    supabase.rpc("guardian_overview", { p_minor_id: minorId }),
    supabase.rpc("get_contact", { p_user_id: minorId }),
    supabase.rpc("dependent_medals", { p_minor_id: minorId }),
  ]);
  const medals = ((medalRows ?? []) as unknown[]).map((x) => dependentMedalSchema.safeParse(x)).flatMap((r) => (r.success ? [r.data] : []));
  const hasContact = ((contactRows ?? []) as unknown[]).length > 0;
  const parsed = overviewSchema.safeParse(data);
  if (error || !parsed.success || !parsed.data.minor) notFound();
  const o = parsed.data;

  return (
    <main style={{ padding: 16, display: "grid", gap: 20, maxWidth: 640 }}>
      <p><Link href="/dependentes">← Meus dependentes</Link></p>
      <h1>{o.minor?.display_name}</h1>
      <p role={hasContact ? "status" : "alert"}>
        {hasContact ? "Ficha de cadastro preenchida." : "Falta a ficha de cadastro do menor: sem ela não é possível pedir vaga."}{" "}
        <Link href={`/dependentes/${minorId}/ficha`}>{hasContact ? "Ver ou editar a ficha" : "Preencher a ficha"}</Link>
      </p>

      <p><Link href={`/dependentes/${minorId}/feed`}>Ver o treino do {o.minor?.display_name} (fotos do feed)</Link></p>

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
                <li>Fotos no feed da academia: {a.consent_photos ? "autorizado" : "não autorizado"} · redes sociais (Instagram): {a.consent_social ? "autorizado" : "não autorizado"}</li>
              </ul>
            )}
            {a.consent_status === "verified" && a.consent_active && (
              <>
                <h3>Medalhas</h3>
                {medals.filter((m) => m.academy_id === a.academy_id).length === 0 ? <p>Ainda sem medalhas.</p> : (
                  <ul>{medals.filter((m) => m.academy_id === a.academy_id).map((m) => <li key={`${m.code}-${m.challenge_id ?? ""}`}>{m.title} — {new Date(`${m.earned_on}T12:00:00Z`).toLocaleDateString("pt-BR", { timeZone: "UTC" })}</li>)}</ul>
                )}
              </>
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
