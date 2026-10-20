import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dojo Platform — Painel",
  description: "Painel administrativo (US-001: base técnica, sem funcionalidades).",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
