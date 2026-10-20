import Link from "next/link";
import { redirect } from "next/navigation";
import { getCaller } from "@/lib/context";
import { CreateAcademyForm } from "./create-form";

export default async function NovaAcademiaPage() {
  const { canCreateAcademy } = await getCaller();
  if (!canCreateAcademy) redirect("/perfil");

  return (
    <main style={{ padding: 16, display: "grid", gap: 16, maxWidth: 420 }}>
      <p><Link href="/perfil">← Meu perfil</Link></p>
      <h1>Criar academia</h1>
      <CreateAcademyForm />
    </main>
  );
}
