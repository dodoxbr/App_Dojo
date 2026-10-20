import Link from "next/link";
import { notFound } from "next/navigation";
import { membershipStatusLabels } from "@dojo/contracts/membership";
import { getCaller } from "@/lib/context";
import { RequestButton } from "./request-button";

// Link shared by the academy: /entrar/{slug}. Shows the academy and lets the signed-in person ask to join.
export default async function EntrarPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { supabase, userId } = await getCaller();

  const { data: academy } = await supabase
    .from("academies")
    .select("id, name, theme_primary, theme_secondary")
    .eq("slug", slug.toLowerCase())
    .maybeSingle();
  if (!academy) notFound();

  const { data: ageStatus } = await supabase.rpc("my_age_status");
  const { data: mine } = await supabase
    .from("memberships")
    .select("status")
    .eq("academy_id", academy.id)
    .eq("user_id", userId)
    .maybeSingle();

  return (
    <main style={{ padding: 16, display: "grid", gap: 16, maxWidth: 420 }}>
      <header style={{ background: academy.theme_primary, color: academy.theme_secondary, padding: 16 }}>
        <h1 style={{ margin: 0 }}>{academy.name}</h1>
      </header>

      {!mine && ageStatus !== "adult" && (
        <p role="alert">
          {ageStatus === "unknown"
            ? "Para pedir entrada é preciso informar a data de nascimento no seu perfil."
            : "O cadastro de menores de 18 anos ainda não está disponível: ele exige um responsável."}{" "}
          <Link href="/perfil">Ir para o perfil</Link>
        </p>
      )}
      {!mine && ageStatus === "adult" && (
        <>
          <p>Você foi convidado(a) a entrar nesta academia. O gestor precisa aprovar o seu pedido.</p>
          <RequestButton academyId={academy.id} />
        </>
      )}
      {mine?.status === "pending" && <p role="status">{membershipStatusLabels.pending}. O gestor ainda não decidiu.</p>}
      {mine?.status === "approved" && <p role="status">Você já faz parte desta academia.</p>}
      {mine?.status === "ended" && (
        <>
          <p>Seu vínculo anterior foi encerrado. Você pode pedir para entrar de novo.</p>
          <RequestButton academyId={academy.id} />
        </>
      )}
      {(mine?.status === "rejected" || mine?.status === "suspended") && (
        <p role="alert">Seu vínculo não está ativo. Fale com o gestor da academia.</p>
      )}

      <p><Link href="/perfil">Meu perfil</Link></p>
    </main>
  );
}
