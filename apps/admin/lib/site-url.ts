import { headers } from "next/headers";

// Endereço público do painel, usado no link que vai por e-mail. Em produção defina NEXT_PUBLIC_SITE_URL; no desenvolvimento
// vale o endereço pelo qual a pessoa está acessando. O Supabase ainda confere o endereço contra a lista de redirecionamentos permitidos.
export async function siteUrl(): Promise<string> {
  const fixed = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, "");
  if (fixed) return fixed;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https");
  return `${proto}://${host}`;
}
