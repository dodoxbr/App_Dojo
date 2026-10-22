import type { Metadata } from "next";
import "../styles/tokens.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Oss — Painel",
  description: "Oss: a plataforma das academias de Jiu-Jitsu. Turmas, presenças, graduações, financeiro e feed.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
