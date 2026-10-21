import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { consentRowSchema } from "@dojo/contracts/guardians";
import { getCaller } from "@/lib/context";
import { errorFromCode } from "@/lib/rpc-errors";
import { verifyConsent } from "./actions";

export default async function ResponsaveisPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ erro?: string }>;
}) {
  const { id } = await params;
  const { erro } = await searchParams;
  const { supabase, isPlatformAdmin, managedAcademies } = await getCaller();
  if (!isPlatformAdmin && !managedAcademies.some((a) => a.id === id)) redirect("/perfil");

  const { data: academy } = await supabase.from("academies").select("id, name").eq("id", id).maybeSingle();
  if (!academy) notFound();

  const { data: raw } = await supabase.rpc("list_academy_guardian_consents", { p_academy_id: id });
  const rows = ((raw ?? []) as unknown[]).map((x) => consentRowSchema.safeParse(x)).flatMap((r) => (r.success ? [r.data] : []));
  const pending = rows.filter((r) => r.status === "pending" && r.consent_active);
  const others = rows.filter((r) => !(r.status === "pending" && r.consent_active));
  const message = errorFromCode(erro);

  return (
    <main style={{ padding: 16, display: "grid", gap: 16, maxWidth: 640 }}>
      <p><Link href={`/academia/${id}`}>← {academy.name}</Link></p>
      <h1>Menores e responsáveis</h1>
      <p>Para aprovar um menor, confira o documento do responsável <strong>pessoalmente</strong>. O sistema não guarda foto nem número do documento: só registra quem conferiu e quando.</p>
      {message && <p role="alert">{message}</p>}

      <section>
        <h2>Aguardando conferência</h2>
        {pending.length === 0 ? (
          <p>Nenhum responsável aguardando.</p>
        ) : (
          <ul>
            {pending.map((r) => (
              <li key={r.id}>
                <form action={verifyConsent.bind(null, id)}>
                  <strong>{r.minor_name}</strong> — responsável: {r.guardian_name} ({r.relationship})
                  {r.consent_photos ? " · autoriza fotos no feed" : " · fotos não autorizadas"}{r.consent_social ? " · autoriza redes sociais (Instagram)" : " · redes sociais não autorizadas"}
                  <input type="hidden" name="consentId" value={r.id} />
                  <label><input type="checkbox" name="documentChecked" required /> Conferi o documento do responsável pessoalmente</label>
                  <label> Observação (opcional) <input name="note" maxLength={500} /></label>
                  <button type="submit">Confirmar conferência</button>
                </form>
              </li>
            ))}
          </ul>
        )}
        <p>Depois da conferência, aprove a matrícula do menor em <Link href={`/academia/${id}/membros`}>Membros</Link>.</p>
      </section>

      <section>
        <h2>Demais registros</h2>
        {others.length === 0 ? (
          <p>Nenhum.</p>
        ) : (
          <ul>
            {others.map((r) => (
              <li key={r.id}>
                {r.minor_name} — {r.guardian_name} ({r.relationship}) ·{" "}
                {!r.consent_active ? "consentimento revogado" : "conferido"}
                {r.membership_status ? ` · matrícula: ${r.membership_status}` : ""}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
