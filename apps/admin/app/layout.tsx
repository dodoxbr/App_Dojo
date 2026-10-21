import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Dojo Platform — Painel",
  description: "Painel da plataforma de academias de Jiu-Jitsu: turmas, presenças, graduações, financeiro e feed.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
