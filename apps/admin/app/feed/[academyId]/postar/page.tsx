import { notFound } from "next/navigation";
import { CAPTION_MAX, feedPersonSchema, feedRespectNote } from "@dojo/contracts/feed";
import { idSchema } from "@dojo/contracts/membership";
import { Alert, Button, ButtonLink, Page, PageHeader, Section } from "@/components/ui";
import { FeatureOff } from "@/components/feature-off";
import { academyHas } from "@/lib/features";
import { getCaller } from "@/lib/context";
import { feedMessage } from "@/lib/feed-ui";

// Postar uma foto no feed da academia. Foto com criança ou adolescente espera a aprovação do professor ou do gestor.
export default async function PostarPage({
  params,
  searchParams,
}: {
  params: Promise<{ academyId: string }>;
  searchParams: Promise<{ erro?: string }>;
}) {
  const { academyId } = await params;
  const { erro } = await searchParams;
  if (!idSchema.safeParse(academyId).success) notFound();
  const { supabase } = await getCaller();
  if (!(await academyHas(supabase, academyId, "feed"))) return <FeatureOff feature="feed" />;
  const { data: academy } = await supabase.from("academies").select("id, name").eq("id", academyId).maybeSingle();
  if (!academy) notFound();
  const { data: peopleRaw, error } = await supabase.rpc("list_feed_people", { p_academy_id: academyId });
  if (error) notFound(); // quem não é da academia recebe a mesma resposta de uma academia que não existe
  const people = ((peopleRaw ?? []) as unknown[]).map((x) => feedPersonSchema.safeParse(x)).flatMap((r) => (r.success ? [r.data] : []));
  const message = feedMessage(erro);

  return (
    <Page width="narrow">
      <PageHeader
        title="Postar foto"
        subtitle={academy.name}
        actions={<ButtonLink href={`/feed/${academyId}`} variant="secondary">← Feed</ButtonLink>}
      />
      <Alert tone="info">{feedRespectNote}</Alert>
      {message && <Alert tone="danger">{message}</Alert>}
      <Section title="Nova foto">
        <form action="/api/feed/upload" method="post" encType="multipart/form-data">
          <input type="hidden" name="academyId" value={academyId} />
          <input type="hidden" name="clientKey" value={crypto.randomUUID()} />
          <label>Foto (JPEG, PNG ou WebP, até 8 MB) <input name="photo" type="file" accept="image/jpeg,image/png,image/webp" required /></label>
          <label>Legenda (opcional) <textarea name="caption" rows={2} maxLength={CAPTION_MAX} /></label>
          <label><input type="checkbox" name="hasMinors" /> Há criança ou adolescente na foto (marque quem aparece abaixo)</label>
          <fieldset>
            <legend>Quem aparece na foto (opcional)</legend>
            {people.length === 0 ? <p>Nenhum membro para marcar.</p> : people.map((p) => (
              <label key={p.user_id}>
                <input type="checkbox" name="tagIds" value={p.user_id} disabled={!p.photo_ok} /> {p.person_name}
                {p.is_minor ? (p.photo_ok ? " (menor, com autorização de foto)" : " (menor, sem autorização de foto do responsável: não pode aparecer)") : ""}
              </label>
            ))}
          </fieldset>
          <p><small>Ao postar você confirma que pode compartilhar esta imagem com os membros da academia. Foto de menor só com a autorização (termo assinado) do responsável.</small></p>
          <Button type="submit" variant="accent">Enviar foto</Button>
        </form>
      </Section>
    </Page>
  );
}
