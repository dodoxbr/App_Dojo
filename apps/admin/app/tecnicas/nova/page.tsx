import Link from "next/link";
import { redirect } from "next/navigation";
import { getCaller } from "@/lib/context";
import { CreateTechniqueForm } from "./create-form";

export default async function NovaTecnicaPage() {
  const { isPlatformAdmin, managedAcademies } = await getCaller();
  if (!isPlatformAdmin && managedAcademies.length === 0) redirect("/tecnicas");

  const scopes = [
    ...managedAcademies.map((a) => ({ id: a.id, label: `Academia: ${a.name}` })),
    ...(isPlatformAdmin ? [{ id: "", label: "Catálogo global (super admin)" }] : []),
  ];

  return (
    <main style={{ padding: 16, display: "grid", gap: 16, maxWidth: 480 }}>
      <p><Link href="/tecnicas">← Catálogo</Link></p>
      <h1>Cadastrar técnica</h1>
      <CreateTechniqueForm scopes={scopes} />
    </main>
  );
}
