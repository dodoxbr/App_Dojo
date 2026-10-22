import sharp from "sharp";
import type { SupabaseClient } from "@supabase/supabase-js";

export const MAX_LOGO_UPLOAD_BYTES = 5 * 1024 * 1024;
const MAX_LOGO_STORED_BYTES = 350_000; // o banco aceita até 400 KB
const ALLOWED = new Set(["jpeg", "png", "webp"]);

export class LogoError extends Error {
  readonly kind: "format" | "decode" | "size";
  constructor(kind: "format" | "decode" | "size") {
    super(kind);
    this.kind = kind;
  }
}

// A logo é regravada em WebP (sem metadados, com a transparência que tiver) e reduzida até caber no limite do banco.
export async function prepareAcademyLogo(input: Buffer): Promise<Buffer> {
  const options = { failOn: "error" as const, limitInputPixels: 80_000_000 };
  let format: string | undefined;
  try {
    format = (await sharp(input, options).metadata()).format;
  } catch {
    throw new LogoError("decode");
  }
  if (!format || !ALLOWED.has(format)) throw new LogoError("format");
  for (const [side, quality] of [[900, 85], [900, 70], [700, 65], [512, 60]] as const) {
    try {
      const data = await sharp(input, options).rotate().resize({ width: side, height: side, fit: "inside", withoutEnlargement: true }).webp({ quality }).toBuffer();
      if (data.length <= MAX_LOGO_STORED_BYTES) return data;
    } catch {
      throw new LogoError("decode");
    }
  }
  throw new LogoError("size");
}

// Endereço da logo (com a versão, para o navegador renovar o cache quando trocar) ou nulo se a academia não tem logo.
export async function academyLogoUrl(supabase: SupabaseClient, academyId: string): Promise<string | null> {
  const { data } = await supabase.rpc("academy_logo_version", { p_academy_id: academyId });
  if (!data) return null;
  return `/api/academias/${academyId}/logo?v=${new Date(data as string).getTime()}`;
}
