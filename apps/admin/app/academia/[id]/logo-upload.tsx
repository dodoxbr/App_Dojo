"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Alert, Button } from "@/components/ui";

const messages: Record<string, string> = {
  grande: "A imagem passa de 5 MB. Escolha uma menor.",
  format: "Use uma imagem JPG, PNG ou WebP.",
  decode: "Não foi possível ler essa imagem. Tente outra.",
  size: "A imagem ficou grande demais mesmo depois de reduzida. Tente uma mais simples.",
  proibido: "Só o gestor da academia troca a logo.",
};

// Troca ou remove a logo da academia. O envio vai para a rota da logo (o servidor limpa a imagem; o banco confere quem pode).
export function LogoUpload({ academyId, hasLogo }: { academyId: string; hasLogo: boolean }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(method: "POST" | "DELETE", file?: File) {
    setBusy(true);
    setError(null);
    try {
      const body = file ? new FormData() : undefined;
      if (body && file) body.set("logo", file);
      const res = await fetch(`/api/academias/${academyId}/logo`, { method, body });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { erro?: string };
        setError(messages[data.erro ?? ""] ?? "Não foi possível salvar a logo. Tente de novo.");
      } else {
        router.refresh();
      }
    } catch {
      setError("Não foi possível enviar a imagem. Confira a conexão e tente de novo.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void send("POST", file);
        }}
      />
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <Button type="button" loading={busy} onClick={() => input.current?.click()}>{hasLogo ? "Trocar a logo" : "Enviar a logo"}</Button>
        {hasLogo && <Button type="button" variant="secondary" disabled={busy} onClick={() => void send("DELETE")}>Remover a logo</Button>}
      </div>
      <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--text-muted)" }}>JPG, PNG ou WebP, até 5 MB. Quadrada fica melhor. Ela aparece ampliada e desfocada ao fundo do perfil da academia e redonda em destaque.</p>
      {error && <Alert tone="danger">{error}</Alert>}
    </div>
  );
}
