"use client";

import { useActionState } from "react";
import { BRAZIL_UFS } from "@dojo/contracts/contacts";
import { formatPhone } from "@dojo/contracts/contacts";
import { Alert, Button } from "@/components/ui";
import { PreservingForm } from "@/components/ui/PreservingForm";
import type { FormState } from "../../../login/actions";
import { saveAcademyPage } from "./actions";
import styles from "./pagina.module.css";

export type PageValues = {
  is_public?: boolean; tagline?: string | null; description?: string | null; modalities?: string[]; phone?: string | null; whatsapp?: string | null;
  address?: string | null; city?: string | null; state?: string | null; maps_url?: string | null; instagram?: string | null;
  facebook_url?: string | null; youtube_url?: string | null; tiktok?: string | null; website_url?: string | null;
};

export function PageForm({ academyId, values }: { academyId: string; values: PageValues }) {
  const [state, action, pending] = useActionState<FormState, FormData>((prev, formData) => saveAcademyPage(academyId, prev, formData), {});
  const phone = (d?: string | null) => (d ? formatPhone(d) : "");
  return (
    <PreservingForm action={action} state={state} className={styles.form}>
      <label className={styles.publish}>
        <input type="checkbox" name="isPublic" defaultChecked={Boolean(values.is_public)} />
        <span><strong>Publicar a página da academia</strong><br />Quem tiver o link vê a página, sem precisar de conta. Desmarcado, ela fica oculta.</span>
      </label>

      <fieldset>
        <legend>Apresentação</legend>
        <label>Frase de apresentação (opcional) <input name="tagline" maxLength={120} defaultValue={values.tagline ?? ""} placeholder="Ex.: Jiu-Jitsu, Kids, Feminino e Taekwondo" /></label>
        <label>Sobre a academia (opcional) <textarea name="description" rows={5} maxLength={1200} defaultValue={values.description ?? ""} /></label>
        <label>Modalidades (separe por vírgula) <input name="modalities" defaultValue={(values.modalities ?? []).join(", ")} placeholder="Jiu-Jitsu, Kids, Feminino" /></label>
      </fieldset>

      <fieldset>
        <legend>Contato</legend>
        <div className={styles.two}>
          <label>WhatsApp com DDD <input name="whatsapp" type="tel" inputMode="tel" defaultValue={phone(values.whatsapp)} placeholder="(61) 99999-9999" /></label>
          <label>Telefone fixo ou outro (opcional) <input name="phone" type="tel" inputMode="tel" defaultValue={phone(values.phone)} placeholder="(61) 3333-4444" /></label>
        </div>
      </fieldset>

      <fieldset>
        <legend>Endereço</legend>
        <label>Endereço (rua, quadra, conjunto, lote…) <input name="address" maxLength={200} defaultValue={values.address ?? ""} /></label>
        <div className={styles.two}>
          <label>Cidade <input name="city" maxLength={80} defaultValue={values.city ?? ""} /></label>
          <label>
            Estado
            <select name="state" defaultValue={values.state ?? ""}>
              <option value="">—</option>
              {BRAZIL_UFS.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
            </select>
          </label>
        </div>
        <label>Link da localização (opcional) <input name="mapsUrl" type="url" maxLength={500} defaultValue={values.maps_url ?? ""} placeholder="https://maps.app.goo.gl/…" /></label>
        <p className={styles.hint}>No Google Maps, abra o local, toque em Compartilhar e copie o link. Sem ele, a página usa uma busca do Maps pelo endereço.</p>
      </fieldset>

      <fieldset>
        <legend>Redes sociais e site</legend>
        <div className={styles.two}>
          <label>Instagram (usuário ou link) <input name="instagram" defaultValue={values.instagram ?? ""} placeholder="@suaacademia" /></label>
          <label>TikTok (usuário ou link) <input name="tiktok" defaultValue={values.tiktok ?? ""} placeholder="@suaacademia" /></label>
        </div>
        <label>Facebook (link) <input name="facebookUrl" type="url" maxLength={300} defaultValue={values.facebook_url ?? ""} placeholder="https://facebook.com/…" /></label>
        <label>YouTube (link) <input name="youtubeUrl" type="url" maxLength={300} defaultValue={values.youtube_url ?? ""} placeholder="https://youtube.com/…" /></label>
        <label>Site (link) <input name="websiteUrl" type="url" maxLength={300} defaultValue={values.website_url ?? ""} placeholder="https://suaacademia.com.br" /></label>
      </fieldset>

      {state.error && <Alert tone="danger">{state.error}</Alert>}
      {state.message && <Alert tone="success">{state.message}</Alert>}
      <div><Button type="submit" loading={pending}>{pending ? "Salvando…" : "Salvar a página"}</Button></div>
    </PreservingForm>
  );
}
