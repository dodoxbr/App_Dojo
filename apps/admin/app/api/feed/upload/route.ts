import { NextResponse, type NextRequest } from "next/server";
import { MAX_UPLOAD_BYTES, uploadFieldsSchema } from "@dojo/contracts/feed";
import { idSchema } from "@dojo/contracts/membership";
import { ImageError, prepareFeedImage } from "@/lib/feed-image";
import { feedErrorKey } from "@/lib/feed-ui";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

// Receives the photo of the feed, removes ALL metadata (GPS, camera...) on the server and hands the clean JPEG to the database,
// which re-checks everything. The browser never sends the final bytes: only this route can produce a post.
export async function POST(request: NextRequest) {
  // Browsers say where a request comes from; a form on another site must not post in the name of a logged-in member.
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") return new NextResponse("Forbidden", { status: 403 });

  const data = await request.formData();
  const academyId = data.get("academyId");
  const back = (erro?: string) =>
    NextResponse.redirect(
      new URL(typeof academyId === "string" && idSchema.safeParse(academyId).success ? `/feed/${academyId}${erro ? `?erro=${erro}` : "?ok=1"}` : `/feed?erro=${erro ?? "fields"}`, request.url),
      303,
    );

  const parsed = uploadFieldsSchema.safeParse({
    academyId,
    caption: typeof data.get("caption") === "string" ? data.get("caption") : undefined,
    hasMinors: data.get("hasMinors") === "on",
    tagIds: data.getAll("tagIds").filter((v): v is string => typeof v === "string"),
    clientKey: data.get("clientKey"),
  });
  if (!parsed.success) {
    const path = parsed.error.issues[0]?.path[0];
    return back(path === "caption" ? "caption" : path === "tagIds" ? "tags" : "fields");
  }

  const file = data.get("photo");
  if (!(file instanceof File) || file.size === 0) return back("file");
  if (file.size > MAX_UPLOAD_BYTES) return back("toobig");

  let image;
  try {
    image = await prepareFeedImage(Buffer.from(await file.arrayBuffer()));
  } catch (e) {
    return back(e instanceof ImageError ? e.kind : "decode");
  }

  const supabase = await createClient();
  const f = parsed.data;
  const { error } = await supabase.rpc("create_feed_post", {
    p_academy_id: f.academyId,
    p_caption: f.caption ?? null,
    p_image: `\\x${image.data.toString("hex")}`, // PostgREST bytea input
    p_width: image.width,
    p_height: image.height,
    p_has_minors: f.hasMinors,
    p_tag_ids: f.tagIds,
    p_client_key: f.clientKey,
  });
  if (error) return back(feedErrorKey(error));
  return back();
}
