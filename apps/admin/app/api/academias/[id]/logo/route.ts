import { NextResponse, type NextRequest } from "next/server";
import { idSchema } from "@dojo/contracts/membership";
import { LogoError, MAX_LOGO_UPLOAD_BYTES, prepareAcademyLogo } from "@/lib/academy-logo";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

// A logo é a identidade pública da academia (como o nome no link de entrada): qualquer pessoa vê. Quem pode TROCAR é decidido pelo banco.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!idSchema.safeParse(id).success) return new NextResponse(null, { status: 404 });
  const supabase = await createClient();
  const { data } = await supabase.rpc("academy_logo", { p_academy_id: id });
  const raw = data as string | null;
  if (!raw) return new NextResponse(null, { status: 404 });
  const bytes = Buffer.from(raw.startsWith("\\x") ? raw.slice(2) : raw, "hex");
  return new NextResponse(bytes, {
    headers: {
      "Content-Type": "image/webp",
      "Content-Length": String(bytes.length),
      "Cache-Control": "public, max-age=3600", // o endereço leva ?v=<versão>, então a troca aparece na hora
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function sameOrigin(request: NextRequest) {
  const site = request.headers.get("sec-fetch-site");
  return !site || site === "same-origin" || site === "none";
}

// Troca a logo: o servidor limpa e regrava a imagem (WebP, sem metadados) e o banco confere de novo quem pode.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(request)) return NextResponse.json({ erro: "proibido" }, { status: 403 });
  const { id } = await params;
  if (!idSchema.safeParse(id).success) return NextResponse.json({ erro: "invalido" }, { status: 400 });
  const file = (await request.formData()).get("logo");
  if (!(file instanceof File) || file.size === 0) return NextResponse.json({ erro: "arquivo" }, { status: 400 });
  if (file.size > MAX_LOGO_UPLOAD_BYTES) return NextResponse.json({ erro: "grande" }, { status: 413 });

  let image: Buffer;
  try {
    image = await prepareAcademyLogo(Buffer.from(await file.arrayBuffer()));
  } catch (e) {
    return NextResponse.json({ erro: e instanceof LogoError ? e.kind : "decode" }, { status: 422 });
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_academy_logo", { p_academy_id: id, p_image: `\\x${image.toString("hex")}` });
  if (error) return NextResponse.json({ erro: error.code === "42501" ? "proibido" : "banco" }, { status: error.code === "42501" ? 403 : 400 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(request)) return NextResponse.json({ erro: "proibido" }, { status: 403 });
  const { id } = await params;
  if (!idSchema.safeParse(id).success) return NextResponse.json({ erro: "invalido" }, { status: 400 });
  const supabase = await createClient();
  const { error } = await supabase.rpc("remove_academy_logo", { p_academy_id: id });
  if (error) return NextResponse.json({ erro: error.code === "42501" ? "proibido" : "banco" }, { status: error.code === "42501" ? 403 : 400 });
  return NextResponse.json({ ok: true });
}
