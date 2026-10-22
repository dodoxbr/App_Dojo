import Link from "next/link";
import { notFound } from "next/navigation";
import { dependentRowSchema } from "@dojo/contracts/guardians";
import { membershipStatusLabels } from "@dojo/contracts/membership";
import { AcademyBanner } from "@/components/ui";
import { academyLogoUrl } from "@/lib/academy-logo";
import { getCaller } from "@/lib/context";
import { RequestForDependentForm } from "../../dependentes/forms";
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

  const logoUrl = await academyLogoUrl(supabase, academy.id as string);
  const { data: ageStatus } = await supabase.rpc("my_age_status");
  const { data: depsRaw } = await supabase.rpc("list_my_dependents");
  const minors = ((depsRaw ?? []) as unknown[])
    .map((x) => dependentRowSchema.safeParse(x))
    .flatMap((r) => (r.success && r.data.kind === "legal" && !r.data.minor_is_adult ? [r.data] : []));
  const { data: contactRows } = await supabase.rpc("get_contact", { p_user_id: userId });
  const hasContact = ((contactRows ?? []) as unknown[]).length > 0;
  const { data: mine } = await supabase
    .from("memberships")
    .select("status")
    .eq("academy_id", academy.id)
    .eq("user_id", userId)
    .maybeSingle();

  return (
    <main style={{ padding: 16, display: "grid", gap: 16, maxWidth: 560 }}>
      <AcademyBanner name={academy.name as string} logoUrl={logoUrl} eyebrow="Convite" subtitle="Peça para entrar e o gestor aprova o seu pedido." />

      {!mine && ageStatus !== "adult" && (
        <p role="alert">
          {ageStatus === "unknown"
            ? "Para pedir entrada é preciso informar a data de nascimento no seu perfil."
            : "Menores de 18 anos não têm login: o responsável cadastra o menor e pede a vaga em nome dele."}{" "}
          <Link href="/perfil">Ir para o perfil</Link>
        </p>
      )}
      {ageStatus === "adult" && minors.length > 0 && (
        <section>
          <h2>Pedir vaga para um menor</h2>
          {minors.map((d) => (
            <div key={d.minor_user_id}>
              <h3>{d.minor_name}</h3>
              <RequestForDependentForm minorId={d.minor_user_id} academyId={academy.id} />
            </div>
          ))}
        </section>
      )}
      {ageStatus === "adult" && minors.length === 0 && (
        <p><small>Quer matricular um filho ou dependente menor de idade? <Link href="/dependentes/novo">Cadastre o menor primeiro</Link>.</small></p>
      )}
      {!mine && ageStatus === "adult" && !hasContact && (
        <p role="alert">Antes de pedir entrada, preencha a sua ficha de cadastro (nome completo, telefone e endereço). <Link href="/perfil/ficha">Preencher a ficha</Link></p>
      )}
      {!mine && ageStatus === "adult" && hasContact && (
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

      <p><Link href={`/termos/${slug.toLowerCase()}`}>Termos e privacidade desta academia</Link> · <Link href="/perfil">Meu perfil</Link></p>
    </main>
  );
}
