import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { contactRowSchema, formatPhone, formatPostalCode } from "@dojo/contracts/contacts";
import { idSchema } from "@dojo/contracts/membership";
import { getCaller } from "@/lib/context";

// The manager reads the ficha of a person who has a membership in the academy. The database audits every read.
export default async function FichaDoMembroPage({ params }: { params: Promise<{ id: string; userId: string }> }) {
  const { id, userId } = await params;
  if (!idSchema.safeParse(id).success || !idSchema.safeParse(userId).success) notFound();
  const { supabase, managedAcademies } = await getCaller();
  if (!managedAcademies.some((a) => a.id === id)) redirect("/perfil");

  const { data: academy } = await supabase.from("academies").select("id, name").eq("id", id).maybeSingle();
  if (!academy) notFound();
  const { data: raw, error } = await supabase.rpc("get_member_contact", { p_academy_id: id, p_user_id: userId });
  if (error) notFound();
  const { data: profile } = await supabase.from("profiles").select("display_name").eq("id", userId).maybeSingle();
  const parsed = contactRowSchema.safeParse(((raw ?? []) as unknown[])[0]);
  const c = parsed.success ? parsed.data : null;

  return (
    <main style={{ padding: 16, display: "grid", gap: 12, maxWidth: 560 }}>
      <p><Link href={`/academia/${id}/membros`}>← Membros de {academy.name}</Link></p>
      <h1>Ficha de {profile?.display_name ?? "membro"}</h1>
      {!c ? (
        <p role="note">A ficha de cadastro ainda não foi preenchida.</p>
      ) : (
        <dl>
          <dt>Nome completo</dt><dd>{c.full_name}</dd>
          <dt>Telefone</dt><dd>{formatPhone(c.phone)}</dd>
          <dt>Endereço</dt>
          <dd>
            {c.street}, {c.number}{c.complement ? ` — ${c.complement}` : ""}<br />
            {c.neighborhood} · {c.city}/{c.state} · CEP {formatPostalCode(c.postal_code)}
          </dd>
        </dl>
      )}
      <p><small>Dados pessoais protegidos: esta consulta foi registrada na auditoria da academia.</small></p>
    </main>
  );
}
