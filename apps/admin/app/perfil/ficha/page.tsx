import Link from "next/link";
import { contactRowSchema } from "@dojo/contracts/contacts";
import { getCaller } from "@/lib/context";
import { ContactForm } from "./contact-form";

export default async function FichaPage() {
  const { supabase, userId } = await getCaller();
  const [{ data: raw }, { data: profile }] = await Promise.all([
    supabase.rpc("get_contact", { p_user_id: userId }),
    supabase.from("profiles").select("display_name").eq("id", userId).single(),
  ]);
  const parsed = contactRowSchema.safeParse(((raw ?? []) as unknown[])[0]);

  return (
    <main style={{ padding: 16, display: "grid", gap: 16, maxWidth: 480 }}>
      <p><Link href="/perfil">← Meu perfil</Link></p>
      <h1>Minha ficha de cadastro</h1>
      <p>Precisamos desses dados para você entrar em uma academia. Eles são privados: só você e o gestor das academias em que você tem vínculo conseguem ver, e cada consulta do gestor fica registrada.</p>
      <ContactForm key={parsed.success ? parsed.data.updated_at : "novo"} userId={userId} current={parsed.success ? parsed.data : null} suggestedName={(profile?.display_name as string | undefined) ?? ""} />
    </main>
  );
}
