"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Alert, Badge, Button } from "@/components/ui";
import type { FormState } from "../login/actions";
import { declareHealth, setImageAuthorization } from "./image-consent-actions";

export type Declarations = { health_declared: boolean; health_declared_at: string | null; image_authorized: boolean; image_authorized_at: string | null };

const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "");

// Declarações feitas no cadastro (declaração de saúde e autorização de imagem). Contas antigas fazem aqui; a autorização de imagem dá para mudar a qualquer momento.
export function DeclarationsCard({ d }: { d: Declarations }) {
  const [healthState, healthAction, healthPending] = useActionState<FormState, FormData>(declareHealth, {});
  const [imageState, imageAction, imagePending] = useActionState<FormState, FormData>(setImageAuthorization, {});
  return (
    <div style={{ display: "grid", gap: 20 }}>
      <div style={{ display: "grid", gap: 8 }}>
        <p style={{ margin: 0 }}>
          <strong>Declaração de saúde</strong>{" "}
          {d.health_declared ? <Badge tone="success">Declarada{d.health_declared_at ? ` em ${day(d.health_declared_at)}` : ""}</Badge> : <Badge tone="danger">Pendente</Badge>}
        </p>
        {!d.health_declared && (
          <form action={healthAction} style={{ display: "grid", gap: 8 }}>
            <label><input type="checkbox" name="agree" required /> Li e declaro a <Link href="/declaracao-de-saude" target="_blank">declaração de saúde</Link> (estou apto(a) a praticar Jiu-Jitsu e vou avisar o professor sobre qualquer condição ou lesão)</label>
            <div><Button type="submit" loading={healthPending}>Declarar</Button></div>
            {healthState.error && <Alert tone="danger">{healthState.error}</Alert>}
          </form>
        )}
      </div>

      <div style={{ display: "grid", gap: 8 }}>
        <p style={{ margin: 0 }}>
          <strong>Autorização de imagem no feed</strong>{" "}
          {d.image_authorized ? <Badge tone="success">Autorizada{d.image_authorized_at ? ` em ${day(d.image_authorized_at)}` : ""}</Badge> : <Badge tone="neutral">Não autorizada</Badge>}
        </p>
        <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "0.875rem" }}>
          Para os colegas poderem te marcar em fotos do feed fechado da academia (só membros veem, por 30 dias). Leia o <Link href="/termo-de-imagem" target="_blank">termo de uso de imagem</Link>. Você muda de ideia quando quiser: ao revogar, as fotos em que você está marcado saem do feed.
        </p>
        <form action={imageAction}>
          <input type="hidden" name="on" value={d.image_authorized ? "false" : "true"} />
          <Button type="submit" variant={d.image_authorized ? "secondary" : "primary"} loading={imagePending}>{d.image_authorized ? "Revogar a autorização" : "Autorizar o uso da minha imagem"}</Button>
        </form>
        {imageState.error && <Alert tone="danger">{imageState.error}</Alert>}
      </div>
    </div>
  );
}
