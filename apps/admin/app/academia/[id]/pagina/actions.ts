"use server";

import { revalidatePath } from "next/cache";
import { academyProfileSchema } from "@dojo/contracts/academy-page";
import { idSchema } from "@dojo/contracts/membership";
import { getCaller } from "@/lib/context";
import { rpcErrorMessage } from "@/lib/rpc-errors";
import type { FormState } from "../../../login/actions";

const str = (formData: FormData, name: string) => {
  const v = formData.get(name);
  return typeof v === "string" ? v : undefined;
};

// Salva a página pública da academia (só o gestor ou o super admin; o banco confere de novo e registra na auditoria).
export async function saveAcademyPage(academyId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  if (!idSchema.safeParse(academyId).success) return { error: "Academia inválida." };
  const parsed = academyProfileSchema.safeParse({
    isPublic: formData.get("isPublic") === "on",
    tagline: str(formData, "tagline"),
    description: str(formData, "description"),
    modalities: str(formData, "modalities") ?? "",
    phone: str(formData, "phone"),
    whatsapp: str(formData, "whatsapp"),
    address: str(formData, "address"),
    city: str(formData, "city"),
    state: str(formData, "state"),
    mapsUrl: str(formData, "mapsUrl"),
    instagram: str(formData, "instagram"),
    facebookUrl: str(formData, "facebookUrl"),
    youtubeUrl: str(formData, "youtubeUrl"),
    tiktok: str(formData, "tiktok"),
    websiteUrl: str(formData, "websiteUrl"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revise os campos." };

  const p = parsed.data;
  const { supabase } = await getCaller();
  const { error } = await supabase.rpc("save_academy_profile", {
    p_academy_id: academyId,
    p_is_public: p.isPublic,
    p_tagline: p.tagline ?? null,
    p_description: p.description ?? null,
    p_modalities: p.modalities,
    p_phone: p.phone ?? null,
    p_whatsapp: p.whatsapp ?? null,
    p_address: p.address ?? null,
    p_city: p.city ?? null,
    p_state: p.state ?? null,
    p_maps_url: p.mapsUrl ?? null,
    p_instagram: p.instagram ?? null,
    p_facebook_url: p.facebookUrl ?? null,
    p_youtube_url: p.youtubeUrl ?? null,
    p_tiktok: p.tiktok ?? null,
    p_website_url: p.websiteUrl ?? null,
  });
  if (error) return { error: rpcErrorMessage(error) };
  revalidatePath(`/academia/${academyId}/pagina`);
  return { message: p.isPublic ? "Página salva e publicada." : "Página salva (ainda oculta ao público)." };
}
