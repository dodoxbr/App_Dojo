import Link from "next/link";
import { getCaller } from "@/lib/context";
import { approvedAcademies } from "@/lib/diary";
import { LogForm } from "../log-form";

export default async function NovoRegistroPage() {
  const { supabase, userId } = await getCaller();
  const academies = await approvedAcademies(supabase, userId);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <main style={{ padding: 16, display: "grid", gap: 16, maxWidth: 640 }}>
      <p><Link href="/diario">← Meu diário</Link></p>
      <h1>Registrar treino</h1>
      <LogForm academies={academies} initial={{ academyId: "", trainedDate: today, notes: "", techniques: [] }} />
    </main>
  );
}
