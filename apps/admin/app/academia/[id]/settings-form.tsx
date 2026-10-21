"use client";

import { useActionState, useState } from "react";
import { MIN_THEME_CONTRAST, contrastRatio } from "@dojo/contracts/academy";
import { updateSettings } from "./actions";
import type { FormState } from "../../login/actions";

type Props = { academyId: string; name: string; themePrimary: string; themeSecondary: string };

export function SettingsForm({ academyId, name, themePrimary, themeSecondary }: Props) {
  const [state, action, pending] = useActionState<FormState, FormData>((prev, formData) => updateSettings(academyId, prev, formData), {});
  const [primary, setPrimary] = useState(themePrimary);
  const [secondary, setSecondary] = useState(themeSecondary);
  const ratio = contrastRatio(primary, secondary);
  const ok = ratio >= MIN_THEME_CONTRAST;

  return (
    <form action={action}>
      <label>Nome <input name="name" defaultValue={name} minLength={2} maxLength={160} required /></label>
      <label>Cor primária <input name="themePrimary" type="color" value={primary} onChange={(e) => setPrimary(e.target.value.toUpperCase())} /></label>
      <label>Cor secundária <input name="themeSecondary" type="color" value={secondary} onChange={(e) => setSecondary(e.target.value.toUpperCase())} /></label>
      <p style={{ background: secondary, color: primary, padding: 8 }}>
        Pré-visualização — contraste {ratio.toFixed(2)}:1 {ok ? "(ok)" : `(mínimo ${MIN_THEME_CONTRAST}:1)`}
      </p>
      <button type="submit" disabled={pending || !ok}>{pending ? "Salvando…" : "Salvar"}</button>
      {state.error && <p role="alert">{state.error}</p>}
      {state.message && <p role="status">{state.message}</p>}
    </form>
  );
}
