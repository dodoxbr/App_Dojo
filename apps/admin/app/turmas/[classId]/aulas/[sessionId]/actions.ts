"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import QRCode from "qrcode";
import { revokeAttendanceSchema, validateAttendanceSchema } from "@dojo/contracts/attendance";
import { idSchema } from "@dojo/contracts/membership";
import { getCaller } from "@/lib/context";
import { rpcErrorMessage } from "@/lib/rpc-errors";

export type QrState = { error?: string; qrSvgDataUrl?: string; url?: string; expiresAt?: string };

function pageUrl(classId: string, sessionId: string, error?: string) {
  return `/turmas/${classId}/aulas/${sessionId}${error ? `?erro=${error}` : ""}`;
}

// The plain token exists only in this response (the database keeps its hash). Shown once as a QR code.
export async function generateQr(classId: string, sessionId: string): Promise<QrState> {
  if (!idSchema.safeParse(sessionId).success) return { error: "Aula inválida." };
  const { supabase } = await getCaller();
  const { data, error } = await supabase.rpc("create_check_in_token", { p_session_id: sessionId });
  if (error || !data?.[0]) {
    if (error?.code === "22023") return { error: "O QR só pode ser gerado de 1 hora antes do início até 1 hora depois do fim, em aula não cancelada." };
    return { error: rpcErrorMessage(error ?? {}) };
  }
  const { token, expires_at } = data[0] as { token: string; expires_at: string };

  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  const url = `${proto}://${host}/checkin/${sessionId}?t=${token}`;
  const svg = await QRCode.toString(url, { type: "svg", margin: 1, width: 260 });
  return {
    qrSvgDataUrl: `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`,
    url,
    expiresAt: expires_at,
  };
}

export async function confirmAttendance(classId: string, sessionId: string, formData: FormData): Promise<void> {
  const parsed = validateAttendanceSchema.safeParse({
    sessionId,
    userId: formData.get("userId"),
    idempotencyKey: formData.get("idempotencyKey"),
  });
  if (!parsed.success) redirect(pageUrl(classId, sessionId, "22023"));

  const { supabase } = await getCaller();
  const { error } = await supabase.rpc("validate_attendance", {
    p_session_id: parsed.data.sessionId,
    p_user_id: parsed.data.userId,
    p_idempotency_key: parsed.data.idempotencyKey,
  });
  revalidatePath(pageUrl(classId, sessionId));
  redirect(pageUrl(classId, sessionId, error?.code ?? undefined));
}

export async function revokeAttendance(classId: string, sessionId: string, formData: FormData): Promise<void> {
  const parsed = revokeAttendanceSchema.safeParse({
    attendanceId: formData.get("attendanceId"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) redirect(pageUrl(classId, sessionId, "22023"));

  const { supabase } = await getCaller();
  const { error } = await supabase.rpc("revoke_attendance", {
    p_attendance_id: parsed.data.attendanceId,
    p_reason: parsed.data.reason,
  });
  revalidatePath(pageUrl(classId, sessionId));
  redirect(pageUrl(classId, sessionId, error?.code ?? undefined));
}
