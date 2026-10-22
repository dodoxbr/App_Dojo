"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

// Guarda a aparência escolhida (escuro ou claro) por um ano. Só preferência de tela: nenhum dado pessoal.
export async function setTheme(formData: FormData): Promise<void> {
  const value = formData.get("theme") === "light" ? "light" : "dark";
  (await cookies()).set("oss-theme", value, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  revalidatePath("/", "layout");
}
