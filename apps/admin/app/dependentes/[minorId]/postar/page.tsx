import { notFound } from "next/navigation";
import { CAPTION_MAX, feedRespectNote } from "@dojo/contracts/feed";
import { overviewSchema } from "@dojo/contracts/guardians";
import { idSchema } from "@dojo/contracts/membership";
import { Alert, Button, ButtonLink, EmptyState, Page, PageHeader, Section } from "@/components/ui";
import { getCaller } from "@/lib/context";
import { feedMessage } from "@/lib/feed-ui";

// O responsável posta uma foto do próprio menor. Só onde o termo de imagem está assinado e conferido pelo gestor; a foto espera a
// aprovação do professor antes de aparecer no feed.
export default async function PostarDependentePage({
  params,
  searchParams,
}: {
  params: Promise<{ minorId: string }>;
  searchParams: Promise<{ erro?: string }>;
}) {
  const { minorId } = await params;
  const { erro } = await searchParams;
  if (!idSchema.safeParse(minorId).success) notFound();
  const { supabase } = await getCaller();
  const [{ data: overviewRaw, error }, { data: deps }] = await Promise.all([
    supabase.rpc("guardian_overview", { p_minor_id: minorId }),
    supabase.rpc("list_my_dependents"),
  ]);
  if (error) notFound();
  const dep = ((deps ?? []) as { minor_user_id: string; minor_name: string; kind: string }[]).find((d) => d.minor_user_id === minorId && d.kind === "legal");
  if (!dep) notFound();
  const overview = overviewSchema.safeParse(overviewRaw);
  const ready = overview.success
    ? overview.data.academies.filter((a) => a.consent_status === "verified" && a.consent_active && a.consent_photos && a.membership_status === "approved")
    : [];
  const message = feedMessage(erro);

  return (
    <Page width="narrow">
      <PageHeader
        title={`Postar foto de ${dep.minor_name}`}
        subtitle="A foto aparece no feed da academia depois que o professor ou o gestor aprovar."
        actions={<ButtonLink href={`/dependentes/${minorId}`} variant="secondary">← {dep.minor_name}</ButtonLink>}
      />
      <Alert tone="info">{feedRespectNote}</Alert>
      {message && <Alert tone="danger">{message}</Alert>}
      {ready.length === 0 ? (
        <EmptyState title="Ainda não dá para postar fotos">
          Para postar fotos de {dep.minor_name}, a academia precisa ter conferido o seu documento, a matrícula precisa estar ativa e o termo de uso de imagem
          (autorização de fotos) precisa estar assinado. Veja o andamento na tela do menor.
        </EmptyState>
      ) : (
        <Section title="Nova foto">
          <form action="/api/feed/upload" method="post" encType="multipart/form-data">
            <input type="hidden" name="clientKey" value={crypto.randomUUID()} />
            <input type="hidden" name="tagIds" value={minorId} />
            <input type="hidden" name="hasMinors" value="on" />
            <input type="hidden" name="back" value={`/dependentes/${minorId}/feed`} />
            <label>
              Academia
              <select name="academyId" defaultValue={ready[0]?.academy_id}>
                {ready.map((a) => <option key={a.academy_id} value={a.academy_id}>{a.name}</option>)}
              </select>
            </label>
            <label>Foto (JPEG, PNG ou WebP, até 8 MB) <input name="photo" type="file" accept="image/jpeg,image/png,image/webp" required /></label>
            <label>Legenda (opcional) <textarea name="caption" rows={2} maxLength={CAPTION_MAX} /></label>
            <p><small>Só {dep.minor_name} pode ser marcado. Você confirma que pode compartilhar esta imagem com os membros da academia, conforme o termo assinado.</small></p>
            <Button type="submit" variant="accent">Enviar foto</Button>
          </form>
        </Section>
      )}
    </Page>
  );
}
