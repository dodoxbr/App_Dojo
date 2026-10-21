import { notFound } from "next/navigation";
import { formatCnpj } from "@dojo/contracts/academy";
import { createClient } from "@/lib/supabase/server";
import { platformVars, TermsView } from "../terms-view";

// Public page of an academy: the company name and CNPJ the manager registered fill the terms.
export default async function TermosAcademiaPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data } = await supabase.rpc("public_academy_legal", { p_slug: slug });
  const row = ((data ?? []) as { name: string; legal_name: string | null; cnpj: string | null }[])[0];
  if (!row) notFound();
  return (
    <TermsView
      academyName={row.name}
      vars={{ empresa: row.legal_name, cnpj: row.cnpj ? formatCnpj(row.cnpj) : null, ...platformVars() }}
    />
  );
}
