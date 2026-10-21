import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { instructorPermissionLabels, instructorPermissions } from "@dojo/contracts/academy";
import { getCaller } from "@/lib/context";
import { formatCnpj } from "@dojo/contracts/academy";
import { LegalForm } from "./legal-form";
import { SettingsForm } from "./settings-form";
import { setPermission } from "./actions";

export default async function AcademiaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, isPlatformAdmin, managedAcademies } = await getCaller();
  const isManager = managedAcademies.some((a) => a.id === id);
  if (!isPlatformAdmin && !isManager) redirect("/perfil");

  const { data: academy } = await supabase
    .from("academies")
    .select("id, name, slug, theme_primary, theme_secondary, legal_name, cnpj")
    .eq("id", id)
    .maybeSingle();
  if (!academy) notFound();

  const { data: granted } = await supabase
    .from("academy_role_permissions")
    .select("permission")
    .eq("academy_id", id)
    .eq("role", "instructor");
  const enabled = new Set((granted ?? []).map((p) => p.permission));

  return (
    <main style={{ padding: 16, display: "grid", gap: 16, maxWidth: 560 }}>
      <p><Link href="/perfil">← Meu perfil</Link></p>
      <h1>{academy.name}</h1>
      <p>Endereço: <code>{academy.slug}</code></p>
      <p>Link para os alunos: <code>/entrar/{academy.slug}</code> (use o endereço do painel antes dele)</p>
      <p><Link href={`/academia/${academy.id}/membros`}>Membros e pedidos de entrada</Link> · <Link href={`/academia/${academy.id}/responsaveis`}>Menores e responsáveis</Link> · <Link href={`/academia/${academy.id}/financeiro`}>Financeiro</Link> · <Link href={`/academia/${academy.id}/saude`}>Saúde dos alunos</Link></p>
      <p><Link href={`/academia/${academy.id}/turmas`}>Turmas e aulas</Link></p>
      <p><Link href={`/academia/${academy.id}/curriculos`}>Currículos (trilhas)</Link> · <Link href={`/academia/${academy.id}/avaliacoes`}>Avaliações de domínio</Link> · <Link href={`/academia/${academy.id}/graduacao`}>Graduação</Link> · <Link href={`/academia/${academy.id}/painel`}>Painel e indicadores</Link></p>

      <section>
        <h2>Identidade visual</h2>
        <SettingsForm
          academyId={academy.id}
          name={academy.name}
          themePrimary={academy.theme_primary}
          themeSecondary={academy.theme_secondary}
        />
      </section>

      <section>
        <h2>Dados da empresa</h2>
        <p>Aparecem nos termos de uso e na política de privacidade da academia (<Link href={`/termos/${academy.slug}`}>ver os termos</Link>).</p>
        <LegalForm academyId={academy.id} legalName={(academy.legal_name as string | null) ?? ""} cnpj={academy.cnpj ? formatCnpj(academy.cnpj as string) : ""} />
      </section>

      <section>
        <h2>O que o instrutor pode fazer</h2>
        <p>Você, como gestor, tem acesso geral. Defina aqui o que os instrutores podem acessar. O diário de treino do aluno nunca é liberado por esta lista.</p>
        <ul>
          {instructorPermissions.map((permission) => {
            const on = enabled.has(permission);
            return (
              <li key={permission}>
                <form action={setPermission.bind(null, id, permission, !on)}>
                  {instructorPermissionLabels[permission]}: <strong>{on ? "permitido" : "não permitido"}</strong>{" "}
                  <button type="submit">{on ? "Remover" : "Permitir"}</button>
                </form>
              </li>
            );
          })}
        </ul>
      </section>
    </main>
  );
}
