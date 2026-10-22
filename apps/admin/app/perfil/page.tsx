import Link from "next/link";
import { membershipRoleLabels, membershipStatusLabels } from "@dojo/contracts/membership";
import { Alert, Avatar, Badge, BeltBar, Button, Card, ItemLink, ItemList, Page, PageHero } from "@/components/ui";
import { anyAcademyHas, myFeatureMap } from "@/lib/features";
import { getCaller } from "@/lib/context";
import { CURRENT_TERMS_VERSION } from "@dojo/contracts/terms";
import { myMilestoneSchema, rankLabel, staffMilestoneSchema } from "@dojo/contracts/milestone";
import { BirthDateForm } from "./birth-date-form";
import { acceptTerms } from "./ficha/actions";
import { ProfileForm } from "./profile-form";
import { signOut } from "./actions";
import { DeclarationsCard, type Declarations } from "./image-consent";

export default async function PerfilPage() {
  const { supabase, userId, isPlatformAdmin, canCreateAcademy, managedAcademies } = await getCaller();
  const { data: profile, error } = await supabase.from("profiles").select("display_name").eq("id", userId).single();
  const { data: ageStatus } = await supabase.rpc("my_age_status");
  const [{ data: termsVersion }, { data: contactRows }] = await Promise.all([
    supabase.rpc("my_terms_version"),
    supabase.rpc("get_contact", { p_user_id: userId }),
  ]);
  const hasContact = ((contactRows ?? []) as unknown[]).length > 0;
  const { data: declRows } = await supabase.rpc("my_declarations");
  const declarations = ((declRows ?? []) as Declarations[])[0];
  const features = await myFeatureMap(supabase);
  const has = (f: "feed" | "medals" | "finance" | "challenges" | "curriculum" | "milestone") => features.size === 0 || anyAcademyHas(features, f);
  // US-020: aviso de 30 treinos desde a última graduação (do aluno e, para o professor, de quem chegou lá)
  const [{ data: myMilestonesRaw }, { data: staffMilestonesRaw }] = await Promise.all([supabase.rpc("my_milestones"), supabase.rpc("my_staff_milestones")]);
  const myMilestones = ((myMilestonesRaw ?? []) as unknown[]).map((x) => myMilestoneSchema.safeParse(x)).flatMap((r) => (r.success ? [r.data] : []));
  const staffMilestones = ((staffMilestonesRaw ?? []) as unknown[]).map((x) => staffMilestoneSchema.safeParse(x)).flatMap((r) => (r.success ? [r.data] : [])).filter((m) => m.students > 0);

  const { data: mine } = await supabase.from("memberships").select("academy_id, role, status").eq("user_id", userId);
  const ids = (mine ?? []).map((m) => m.academy_id as string);
  const { data: academies } = ids.length
    ? await supabase.from("academies").select("id, name, slug").in("id", ids)
    : { data: [] as { id: string; name: string; slug: string }[] };
  const nameOf = new Map((academies ?? []).map((a) => [a.id, a.name]));

  const { data: ranks } = await supabase.from("current_ranks").select("academy_id, belt_code, degree").eq("user_id", userId);
  const firstRank = (ranks ?? []).find((r) => (mine ?? []).some((m) => m.academy_id === r.academy_id && m.status === "approved")) ?? null;
  const shownName = (profile?.display_name as string | undefined) ?? "Meu perfil";

  return (
    <Page width="narrow">
      <PageHero
        eyebrow="Meu perfil"
        title={shownName}
        subtitle={firstRank ? `${firstRank.belt_code as string} · grau ${firstRank.degree as number}` : "Seus dados, suas academias e atalhos."}
        aside={<Avatar name={shownName} size="lg" />}
      >
        {firstRank && <BeltBar belt={firstRank.belt_code as string} degree={firstRank.degree as number} size="md" />}
      </PageHero>

      <Card>
        {error || !profile ? <Alert tone="danger">Não foi possível carregar o perfil.</Alert> : <ProfileForm displayName={profile.display_name} />}
      </Card>

      {termsVersion !== CURRENT_TERMS_VERSION && (
        <Alert tone="info">
          <strong>Termos de uso.</strong> Leia os <Link href="/termos">termos de uso e a política de privacidade</Link> (rascunho em revisão) e aceite para continuar usando a plataforma.
          <form action={acceptTerms} style={{ marginTop: 12 }}><button type="submit">Li e aceito</button></form>
        </Alert>
      )}
      {!hasContact && ageStatus !== "minor" && (
        <Alert tone="info">
          Falta a sua ficha de cadastro (nome completo, telefone e endereço). Sem ela você não consegue entrar em uma academia.{" "}
          <Link href="/perfil/ficha">Preencher a ficha</Link>
        </Alert>
      )}

      {ageStatus === "unknown" && <Card><h2 style={{ margin: "0 0 12px", fontSize: "1.25rem" }}>Data de nascimento</h2><BirthDateForm /></Card>}
      {ageStatus === "minor" && (
        <Alert tone="info">Você é menor de 18 anos. Menores não usam o app sozinhos: o responsável cadastra o menor e usa o app em nome dele.</Alert>
      )}

      {myMilestones.filter((m) => features.get(m.academy_id)?.has("milestone") ?? true).map((m) => (
        <Alert key={m.academy_id} tone="success">
          <strong>{m.attendances} treinos!</strong> Você chegou a {m.attendances} treinos confirmados na {m.academy_name} desde a última graduação ({rankLabel(m.belt_code, m.degree, m.rank_since)}). Converse com o seu professor. Quem decide a graduação é o professor e o gestor.
        </Alert>
      ))}
      {staffMilestones.filter((m) => features.get(m.academy_id)?.has("milestone") ?? true).map((m) => (
        <Alert key={m.academy_id} tone="success">
          <strong>Alunos no seu número de treinos.</strong> {m.students} aluno(s) da {m.academy_name} chegaram ao seu número de treinos desde a última graduação.{" "}
          <Link href={`/academia/${m.academy_id}/graduacao/alunos`}>Ver quem são</Link>
        </Alert>
      ))}

      <Card>
        <h2 style={{ margin: "0 0 12px", fontSize: "1.25rem" }}>Minhas academias</h2>
        {(mine ?? []).length === 0 ? (
          <p style={{ margin: 0, color: "var(--text-muted)" }}>Você ainda não faz parte de nenhuma academia. Peça o link ao gestor da sua academia.</p>
        ) : (
          <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 12 }}>
            {(mine ?? []).map((m) => (
              <li key={m.academy_id as string} style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", justifyContent: "space-between" }}>
                <strong>{nameOf.get(m.academy_id as string) ?? "Academia"}</strong>
                <span style={{ display: "flex", gap: 8 }}>
                  <Badge>{membershipRoleLabels[m.role as string]}</Badge>
                  <Badge tone={m.status === "approved" ? "success" : m.status === "pending" ? "info" : "neutral"}>{membershipStatusLabels[m.status as string]}</Badge>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {declarations && (
        <Card>
          <h2 style={{ margin: "0 0 12px", fontSize: "1.25rem" }}>Declarações e autorizações</h2>
          <DeclarationsCard d={declarations} />
        </Card>
      )}

      <section aria-labelledby="atalhos" style={{ display: "grid", gap: 12 }}>
        <h2 id="atalhos" style={{ margin: 0, fontSize: "1.25rem" }}>Atalhos</h2>
        <ItemList>
          <li><ItemLink href="/parq" title="PAR-Q e termo de saúde" meta="Questionário de prontidão e assinatura" /></li>
          <li><ItemLink href="/perfil/ficha" title={hasContact ? "Minha ficha de cadastro" : "Preencher minha ficha de cadastro"} meta="Contato, endereço e saúde" /></li>
          {has("feed") && <li><ItemLink href="/feed" title="Feed da academia (fotos)" /></li>}
          {has("medals") && <li><ItemLink href="/medalhas" title="Medalhas" /></li>}
          {has("finance") && <li><ItemLink href="/financeiro" title="Meu financeiro" /></li>}
          <li><ItemLink href="/dependentes" title="Meus dependentes (menores de idade)" /></li>
          {has("challenges") && <li><ItemLink href="/desafios" title="Desafios" /></li>}
          <li><ItemLink href="/graduacao" title="Minha graduação" /></li>
          {has("curriculum") && <li><ItemLink href="/trilha" title="Minha trilha" /></li>}
          <li><ItemLink href="/aulas" title="Agenda de aulas" /></li>
          <li><ItemLink href="/diario" title="Meu diário" /></li>
          <li><ItemLink href="/tecnicas" title="Catálogo de técnicas" /></li>
          {isPlatformAdmin && <li><ItemLink href="/plataforma" title="Plataforma (super admin)" /></li>}
          {canCreateAcademy && <li><ItemLink href="/academias/nova" title="Criar academia" /></li>}
          {managedAcademies.map((a) => (
            <li key={a.id}><ItemLink href={`/academia/${a.id}`} title={`Gerenciar: ${a.name}`} /></li>
          ))}
        </ItemList>
      </section>

      <form action={signOut}><Button type="submit" variant="secondary">Sair</Button></form>
    </Page>
  );
}
