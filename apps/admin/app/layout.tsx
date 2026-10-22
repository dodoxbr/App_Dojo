import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Archivo, Figtree } from "next/font/google";
import "../styles/tokens.css";
import "./globals.css";

// Fontes da marca (landing e login): o Next baixa na hora do build e serve do próprio site; o navegador não consulta o Google.
const archivo = Archivo({ subsets: ["latin"], weight: ["700", "800"], variable: "--font-display", display: "swap" });
const figtree = Figtree({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-body", display: "swap" });

export const metadata: Metadata = {
  title: "Oss — Painel",
  description: "Oss: a plataforma das academias de Jiu-Jitsu. Turmas, presenças, graduações, financeiro e feed.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Aparência: escuro por padrão (cookie `oss-theme`); Perfil > Aparência troca para claro.
  const theme = (await cookies()).get("oss-theme")?.value === "light" ? "light" : "dark";
  return (
    <html lang="pt-BR" data-theme={theme} className={`${archivo.variable} ${figtree.variable}`}>
      <body>{children}</body>
    </html>
  );
}
