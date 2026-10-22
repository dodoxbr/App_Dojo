"use client";

import { useActionState } from "react";
import { CHECK_IN_TOKEN_MINUTES } from "@dojo/contracts/attendance";
import { generateQr, type QrState } from "./actions";
import { PreservingForm } from "@/components/ui/PreservingForm";

export function QrBlock({ classId, sessionId }: { classId: string; sessionId: string }) {
  const [state, action, pending] = useActionState<QrState, FormData>(() => generateQr(classId, sessionId), {});
  return (
    <div>
      <PreservingForm action={action} state={state}>
        <button type="submit" disabled={pending}>{pending ? "Gerando…" : "Gerar QR de check-in"}</button>
      </PreservingForm>
      {state.error && <p role="alert">{state.error}</p>}
      {state.qrSvgDataUrl && (
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={state.qrSvgDataUrl} alt="QR code de check-in desta aula" width={260} height={260} />
          <p>
            Vale por {CHECK_IN_TOKEN_MINUTES} minutos
            {state.expiresAt ? ` (até ${new Date(state.expiresAt).toLocaleTimeString("pt-BR")})` : ""}. Os alunos escaneiam e
            tocam em <em>Fazer check-in</em>; você confirma abaixo. O QR sozinho não confirma presença.
          </p>
          <p><small>Link: <code>{state.url}</code></small></p>
        </div>
      )}
    </div>
  );
}
