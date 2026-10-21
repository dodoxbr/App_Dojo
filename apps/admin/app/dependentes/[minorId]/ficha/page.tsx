import Link from "next/link";
import { notFound } from "next/navigation";
import { contactRowSchema } from "@dojo/contracts/contacts";
import { idSchema } from "@dojo/contracts/membership";
import { getCaller } from "@/lib/context";
import { ContactForm } from "../../../perfil/ficha/contact-form";

// Ficha of the minor, filled in by the legal guardian (phone and address are usually the guardian's).
export default async function FichaDependentePage({ params }: { params: Promise<{ minorId: string }> }) {
  const { minorId } = await params;
  if (!idSchema.safeParse(minorId).success) notFound();
  const { supabase } = await getCaller();
  const { data: raw, error } = await supabase.rpc("get_contact", { p_user_id: minorId });
  if (error) notFound();
  const { data: deps } = await supabase.rpc("list_my_dependents");
  const dep = ((deps ?? []) as { minor_user_id: string; minor_name: string; kind: string }[]).find((d) => d.minor_user_id === minorId && d.kind === "legal");
  if (!dep) notFound();
  const parsed = contactRowSchema.safeParse(((raw ?? []) as unknown[])[0]);

  return (
    <main style={{ padding: 16, display: "grid", gap: 16, maxWidth: 480 }}>
      <p><Link href={`/dependentes/${minorId}`}>← {dep.minor_name}</Link></p>
      <h1>Ficha de {dep.minor_name}</h1>
      <p>Telefone e endereço de contato do menor (em geral, os do responsável). Dados privados: só você e o gestor das academias em que o menor tem vínculo conseguem ver.</p>
      <ContactForm key={parsed.success ? parsed.data.updated_at : "novo"} userId={minorId} current={parsed.success ? parsed.data : null} suggestedName={dep.minor_name} />
    </main>
  );
}
