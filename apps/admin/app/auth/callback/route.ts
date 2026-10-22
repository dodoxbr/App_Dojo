import { NextResponse, type NextRequest } from "next/server";
import { safeRedirectPath } from "@dojo/contracts/auth";
import { createClient } from "@/lib/supabase/server";

// Destino do link enviado por e-mail (redefinição de senha): troca o código do link por uma sessão e segue para `next`
// (só caminhos internos). Link vencido, usado ou de outro navegador: volta para pedir um novo.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = safeRedirectPath(searchParams.get("next"), "/inicio");
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, origin));
  }
  return NextResponse.redirect(new URL("/recuperar-senha?erro=link", origin));
}
