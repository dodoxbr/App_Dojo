"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { commentInputSchema, commentReportSchema, reportSchema } from "@dojo/contracts/feed";
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

// Professor ou gestor aprova (a foto vai para o feed) ou recusa (com motivo) uma foto que aguardava moderação.
export async function moderatePost(academyId: string, formData: FormData): Promise<void> {
  const postId = formData.get("postId");
  if (!idSchema.safeParse(academyId).success || !idSchema.safeParse(postId).success) return;
  const approve = formData.get("decision") === "approve";
  const reason = typeof formData.get("reason") === "string" ? String(formData.get("reason")) : "";
  if (!approve && reason.trim().length < 3) return back(academyId, "reason");
  const { supabase } = await getCaller();
  const { error } = await supabase.rpc("moderate_feed_post", { p_post_id: postId, p_approve: approve, p_reason: approve ? null : reason.trim() });
  return back(academyId, error ? feedErrorKey(error) : undefined);
}

export async function restorePost(academyId: string, formData: FormData): Promise<void> {
  const postId = formData.get("postId");
  if (!idSchema.safeParse(academyId).success || !idSchema.safeParse(postId).success) return;
  const { supabase } = await getCaller();
  const { error } = await supabase.rpc("restore_feed_post", { p_post_id: postId });
  return back(academyId, error ? feedErrorKey(error) : undefined);
}

export async function toggleReaction(academyId: string, formData: FormData): Promise<void> {
  const postId = formData.get("postId");
  if (!idSchema.safeParse(academyId).success || !idSchema.safeParse(postId).success) return;
  const { supabase } = await getCaller();
  const { error } = await supabase.rpc("toggle_feed_reaction", { p_post_id: postId });
  return back(academyId, error ? feedErrorKey(error) : undefined);
}

export async function addComment(academyId: string, formData: FormData): Promise<void> {
  const parsed = commentInputSchema.safeParse({ postId: formData.get("postId"), body: formData.get("body"), clientKey: formData.get("clientKey") });
  if (!idSchema.safeParse(academyId).success) return;
  if (!parsed.success) return back(academyId, "body");
  const { supabase } = await getCaller();
  const { error } = await supabase.rpc("add_feed_comment", { p_post_id: parsed.data.postId, p_body: parsed.data.body, p_client_key: parsed.data.clientKey });
  return back(academyId, error ? feedErrorKey(error) : undefined);
}

export async function reportComment(academyId: string, formData: FormData): Promise<void> {
  const parsed = commentReportSchema.safeParse({ commentId: formData.get("commentId"), reason: formData.get("reason") });
  if (!idSchema.safeParse(academyId).success) return;
  if (!parsed.success) return back(academyId, "reason");
  const { supabase } = await getCaller();
  const { error } = await supabase.rpc("report_feed_comment", { p_comment_id: parsed.data.commentId, p_reason: parsed.data.reason });
  return back(academyId, error ? feedErrorKey(error) : undefined);
}

export async function deleteComment(academyId: string, formData: FormData): Promise<void> {
  const commentId = formData.get("commentId");
  if (!idSchema.safeParse(academyId).success || !idSchema.safeParse(commentId).success) return;
  const { supabase } = await getCaller();
  const { error } = await supabase.rpc("delete_feed_comment", { p_comment_id: commentId });
  return back(academyId, error ? feedErrorKey(error) : undefined);
}

export async function restoreComment(academyId: string, formData: FormData): Promise<void> {
  const commentId = formData.get("commentId");
  if (!idSchema.safeParse(academyId).success || !idSchema.safeParse(commentId).success) return;
  const { supabase } = await getCaller();
  const { error } = await supabase.rpc("restore_feed_comment", { p_comment_id: commentId });
  return back(academyId, error ? feedErrorKey(error) : undefined);
}
