import { notFound } from "next/navigation";
import { idSchema } from "@dojo/contracts/membership";
import { ButtonLink, Page, PageHeader } from "@/components/ui";
import { ParqSection } from "@/components/parq-section";
import { getCaller } from "@/lib/context";

// O responsável legal responde o PAR-Q e assina o termo pelo menor.
export default async function ParqDependentePage({ params }: { params: Promise<{ minorId: string }> }) {
  const { minorId } = await params;
  if (!idSchema.safeParse(minorId).success) notFound();
  const { supabase } = await getCaller();
  const { data: deps } = await supabase.rpc("list_my_dependents");
  const dep = ((deps ?? []) as { minor_user_id: string; minor_name: string; kind: string }[]).find((d) => d.minor_user_id === minorId && d.kind === "legal");
  if (!dep) notFound();
  return (
    <Page width="narrow">
      <PageHeader title={`PAR-Q de ${dep.minor_name}`} subtitle="Respondido pelo responsável legal" actions={<ButtonLink href={`/dependentes/${minorId}`} variant="secondary">← {dep.minor_name}</ButtonLink>} />
      <ParqSection supabase={supabase} userId={minorId} revalidate={`/dependentes/${minorId}/parq`} subjectName={dep.minor_name} forMinor />
    </Page>
  );
}
