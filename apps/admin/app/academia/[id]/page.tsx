import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { formatCnpj, instructorPermissionLabels, instructorPermissions } from "@dojo/contracts/academy";
import { AcademyBanner, Badge, Button, ButtonLink, ItemLink, ItemList, Page, Section } from "@/components/ui";
import { academyLogoUrl } from "@/lib/academy-logo";
import { getCaller } from "@/lib/context";
import { LegalForm } from "./legal-form";
import { LogoUpload } from "./logo-upload";
import { SettingsForm } from "./settings-form";
import { setParqRequired, setPermission } from "./actions";
import styles from "./academia.module.css";

export default async function AcademiaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, isPlatformAdmin, managedAcademies } = await getCaller();
  const isManager = managedAcademies.some((a) => a.id === id);
  if (!isPlatformAdmin && !isManager) redirect("/perfil");

  const { data: academy } = await supabase
    .from("academies")
    .select("id, name, slug, theme_primary, theme_secondary, legal_name, cnpj, parq_required")
    .eq("id", id)
    .maybeSingle();
  if (!academy) notFound();

  const { data: granted } = await supabase
    .from("academy_role_permissions")
    .select("permission")
    .eq("academy_id", id)
    .eq("role", "instructor");
  const enabled = new Set((granted ?? []).map((p) => p.permission));
  const { data: featuresRaw } = await supabase.rpc("academy_features", { p_academy_id: id });
  const features = new Set((featuresRaw ?? []) as string[]);
  const has = (f: string) => features.size === 0 || features.has(f);

  const a = `/academia/${academy.id}`;
  const logoUrl = await academyLogoUrl(supabase, id);
  const links = [
    { href: `${a}/pagina`, title: "Página pública da academia (contato, endereço e redes)", show: true },
    { href: `${a}/membros`, title: "Membros e pedidos de entrada", show: true },
    { href: `${a}/turmas`, title: "Turmas e aulas", show: true },
    { href: `${a}/graduacao`, title: "Graduação", show: true },
    { href: `${a}/responsaveis`, title: "Menores e responsáveis", show: true },
    { href: `${a}/saude`, title: "Saúde dos alunos", show: true },
    { href: `${a}/financeiro`, title: "Financeiro", show: has("finance") },
    { href: `${a}/curriculos`, title: "Currículos (trilhas)", show: has("curriculum") },
    { href: `${a}/avaliacoes`, title: "Avaliações de domínio", show: has("curriculum") },
    { href: `${a}/painel`, title: "Painel e indicadores", show: has("dashboard") },
    { href: `/feed/${academy.id}`, title: "Feed de fotos", show: has("feed") },
  ].filter((l) => l.show);

  return (
    <Page width="narrow">
      <AcademyBanner
        name={academy.name}
        logoUrl={logoUrl}
        eyebrow="Academia"
        subtitle={<>Link para os alunos: <code>/entrar/{academy.slug}</code> (use o endereço do painel antes dele)</>}
      >
        <ButtonLink href="/perfil" variant="secondary">← Meu perfil</ButtonLink>
      </AcademyBanner>

      <ItemList>
        {links.map((l) => <li key={l.href}><ItemLink href={l.href} title={l.title} /></li>)}
      </ItemList>

      <Section title="Logo da academia" hint="A logo vira o fundo e o selo do perfil da academia (esta tela, o início da equipe e o link de entrada dos alunos).">
        <LogoUpload academyId={academy.id} hasLogo={logoUrl !== null} />
      </Section>

      <Section
        title="PAR-Q obrigatório"
        hint="Ligado, quem tem o PAR-Q vencido (mais de 12 meses) ou nunca respondeu não consegue pedir check-in nas aulas. Ao responder de novo, o check-in libera na hora. O professor continua podendo validar presenças. Desligado, o PAR-Q só informa."
      >
        <form action={setParqRequired.bind(null, academy.id)} className={styles.permForm}>
          <input type="hidden" name="on" value={academy.parq_required ? "false" : "true"} />
          <span className={styles.permName}>Bloqueio por PAR-Q vencido</span>
          <Badge tone={academy.parq_required ? "success" : "neutral"}>{academy.parq_required ? "Ligado" : "Desligado"}</Badge>
          <Button type="submit" variant="secondary">{academy.parq_required ? "Desligar" : "Ligar"}</Button>
        </form>
      </Section>

      <Section title="Identidade visual">
        <SettingsForm
          academyId={academy.id}
          name={academy.name}
          themePrimary={academy.theme_primary}
          themeSecondary={academy.theme_secondary}
        />
      </Section>

      <Section
        title="Dados da empresa"
        hint={<>Aparecem nos termos de uso e na política de privacidade da academia (<Link href={`/termos/${academy.slug}`}>ver os termos</Link>).</>}
      >
        <LegalForm academyId={academy.id} legalName={(academy.legal_name as string | null) ?? ""} cnpj={academy.cnpj ? formatCnpj(academy.cnpj as string) : ""} />
      </Section>

      <Section
        title="O que o instrutor pode fazer"
        hint="Você, como gestor, tem acesso geral. Defina aqui o que os instrutores podem acessar. O diário de treino do aluno nunca é liberado por esta lista."
      >
        <ul className={styles.perms}>
          {instructorPermissions.map((permission) => {
            const on = enabled.has(permission);
            return (
              <li key={permission} className={styles.perm}>
                <form action={setPermission.bind(null, id, permission, !on)} className={styles.permForm}>
                  <span className={styles.permName}>{instructorPermissionLabels[permission]}</span>
                  <Badge tone={on ? "success" : "neutral"}>{on ? "Permitido" : "Não permitido"}</Badge>
                  <Button type="submit" variant="secondary">{on ? "Remover" : "Permitir"}</Button>
                </form>
              </li>
            );
          })}
        </ul>
      </Section>
    </Page>
  );
}
