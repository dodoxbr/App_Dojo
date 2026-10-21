"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { reportSchema } from "@dojo/contracts/feed";
import { idSchema } from "@dojo/contracts/membership";
import { feedErrorKey } from "@/lib/feed-ui";
import { getCaller } from "@/lib/context";

const back = (academyId: string, erro?: string): never => {
  revalidatePath(`/feed/${academyId}`);
  redirect(`/feed/${academyId}${erro ? `?erro=${erro}` : ""}`);
};

export async function deletePost(academyId: string, formData: FormData): Promise<void> {
  const postId = formData.get("postId");
  if (!idSchema.safeParse(academyId).success || !idSchema.safeParse(postId).success) return;
  const { supabase } = await getCaller();
  const { error } = await supabase.rpc("delete_feed_post", { p_post_id: postId });
  return back(academyId, error ? feedErrorKey(error) : undefined);
}

export async function reportPost(academyId: string, formData: FormData): Promise<void> {
  const parsed = reportSchema.safeParse({ postId: formData.get("postId"), reason: formData.get("reason") });
  if (!idSchema.safeParse(academyId).success) return;
  if (!parsed.success) return back(academyId, "reason");
  const { supabase } = await getCaller();
  const { error } = await supabase.rpc("report_feed_post", { p_post_id: parsed.data.postId, p_reason: parsed.data.reason });
  return back(academyId, error ? feedErrorKey(error) : undefined);
}

export async function restorePost(academyId: string, formData: FormData): Promise<void> {
  const postId = formData.get("postId");
  if (!idSchema.safeParse(academyId).success || !idSchema.safeParse(postId).success) return;
  const { supabase } = await getCaller();
  const { error } = await supabase.rpc("restore_feed_post", { p_post_id: postId });
  return back(academyId, error ? feedErrorKey(error) : undefined);
}
