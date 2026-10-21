import { NextResponse } from "next/server";
import { idSchema } from "@dojo/contracts/membership";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

// Serves one picture of the feed. The access rule is the database's (members of the academy; the author and the manager also see
// hidden posts): whoever may not see the post gets a plain 404, exactly like a post that does not exist.
export async function GET(_request: Request, { params }: { params: Promise<{ postId: string }> }) {
  const { postId } = await params;
  if (!idSchema.safeParse(postId).success) return new NextResponse(null, { status: 404 });
  const supabase = await createClient();
  const { data } = await supabase.from("feed_posts").select("image").eq("id", postId).maybeSingle();
  const raw = data?.image as string | null | undefined;
  if (!raw) return new NextResponse(null, { status: 404 });
  const bytes = Buffer.from(raw.startsWith("\\x") ? raw.slice(2) : raw, "hex");
  return new NextResponse(bytes, {
    headers: {
      "Content-Type": "image/jpeg",
      "Content-Length": String(bytes.length),
      "Cache-Control": "private, max-age=300",
      "X-Content-Type-Options": "nosniff",
      "Cross-Origin-Resource-Policy": "same-origin",
      "Content-Disposition": "inline",
    },
  });
}
