import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  addressLine,
  formatDays,
  joinTimes,
  instagramLink,
  mapsSearchLink,
  publicAcademyPageSchema,
  telLink,
  tiktokLink,
  whatsappLink,
} from "@dojo/contracts/academy-page";
import { formatPhone } from "@dojo/contracts/contacts";
import { AcademyBanner, Badge, ButtonLink } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import styles from "./academia-publica.module.css";

// Página pública da academia: aberta a qualquer pessoa, SEM login, e só existe se o gestor publicou. Mostra dados da empresa (nunca de alunos).
async function load(slug: string) {
  const supabase = await createClient();
  const { data } = await supabase.rpc("public_academy_page", { p_slug: slug });
  const parsed = publicAcademyPageSchema.safeParse(data);
  return parsed.success ? parsed.data : null;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const page = await load((await params).slug);
  if (!page) return { title: "Academia — Oss" };
  return { title: `${page.name} — Oss`, description: page.tagline ?? page.description?.slice(0, 150) ?? `Página da academia ${page.name}.` };
}

export default async function AcademiaPublicaPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = await load(slug);
  if (!page) notFound();

  const logoUrl = page.logo_version ? `/api/academias/${page.academy_id}/logo?v=${new Date(page.logo_version).getTime()}` : null;
  const place = [page.city, page.state].filter(Boolean).join(" - ");
  const where = addressLine(page);
  const mapsHref = page.maps_url ?? (page.address ? mapsSearchLink(page.address, page.city, page.state) : null);
  const socials = [
    page.instagram ? { label: "Instagram", href: instagramLink(page.instagram) } : null,
    page.tiktok ? { label: "TikTok", href: tiktokLink(page.tiktok) } : null,
    page.facebook_url ? { label: "Facebook", href: page.facebook_url } : null,
    page.youtube_url ? { label: "YouTube", href: page.youtube_url } : null,
    page.website_url ? { label: "Site", href: page.website_url } : null,
  ].filter((s): s is { label: string; href: string } => s !== null);
  const hasContact = Boolean(page.whatsapp || page.phone);

  return (
    <main className={styles.page}>
      <div className={styles.wrap}>
        <AcademyBanner name={page.name} logoUrl={logoUrl} eyebrow={place || "Academia"} subtitle={page.tagline}>
          <ButtonLink href={`/entrar/${page.slug}`} variant="accent">Quero treinar aqui</ButtonLink>
          {page.whatsapp && <a className={styles.ghost} href={whatsappLink(page.whatsapp, `Olá! Vi a página da ${page.name} e quero saber mais.`)} target="_blank" rel="noopener noreferrer">Chamar no WhatsApp</a>}
        </AcademyBanner>

        <div className={styles.grid}>
          {(page.description || page.modalities.length > 0) && (
            <section className={`${styles.card} ${styles.wide}`}>
              <h2>Sobre a academia</h2>
              {page.description && <p className={styles.text}>{page.description}</p>}
              {page.modalities.length > 0 && (
                <ul className={styles.chips} aria-label="Modalidades">
                  {page.modalities.map((m) => <li key={m}><Badge tone="accent">{m}</Badge></li>)}
                </ul>
              )}
            </section>
          )}

          {page.schedule.length > 0 && (
            <section className={`${styles.card} ${styles.wide}`} aria-labelledby="horarios">
              <h2 id="horarios">Horários</h2>
              <div className={styles.groups}>
                {page.schedule.map((g) => (
                  <div key={g.title} className={styles.group}>
                    <h3>{g.title}</h3>
                    {g.note && <p className={styles.note}>{g.note}</p>}
                    <ul className={styles.slots}>
                      {g.lines.map((l, i) => (
                        <li key={i} className={styles.slot}>
                          <span className={styles.days}>{formatDays(l.days)}{l.label ? ` · ${l.label}` : ""}</span>
                          <strong className={styles.times}>{joinTimes(l.times)}</strong>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
              {hasContact && <p className={styles.note}>Informações e matrículas: {page.whatsapp ? <a href={whatsappLink(page.whatsapp)} target="_blank" rel="noopener noreferrer">{formatPhone(page.whatsapp)}</a> : page.phone ? <a href={telLink(page.phone)}>{formatPhone(page.phone)}</a> : null}</p>}
            </section>
          )}

          {hasContact && (
            <section className={styles.card}>
              <h2>Contato</h2>
              <ul className={styles.list}>
                {page.whatsapp && <li><span>WhatsApp</span><a href={whatsappLink(page.whatsapp)} target="_blank" rel="noopener noreferrer">{formatPhone(page.whatsapp)}</a></li>}
                {page.phone && <li><span>Telefone</span><a href={telLink(page.phone)}>{formatPhone(page.phone)}</a></li>}
              </ul>
            </section>
          )}

          {where && (
            <section className={styles.card}>
              <h2>Endereço</h2>
              <p className={styles.text}>{where}</p>
              {mapsHref && <a className={styles.action} href={mapsHref} target="_blank" rel="noopener noreferrer">Ver no mapa</a>}
            </section>
          )}

          {socials.length > 0 && (
            <section className={styles.card}>
              <h2>Redes e site</h2>
              <ul className={styles.links}>
                {socials.map((s) => <li key={s.label}><a className={styles.action} href={s.href} target="_blank" rel="noopener noreferrer">{s.label}</a></li>)}
              </ul>
            </section>
          )}
        </div>

        <footer className={styles.footer}>
          <p>Página criada no Oss, a saudação do tatame.</p>
        </footer>
      </div>
    </main>
  );
}
