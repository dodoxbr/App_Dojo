import Link from "next/link";
import { Alert, BeltBar, BrandLogo, ButtonLink } from "@/components/ui";
import styles from "./home.module.css";

const features = [
  { title: "Presença que vale", text: "O aluno faz check-in e o professor confirma. Só presença confirmada conta para a graduação e para as medalhas." },
  { title: "Diário de treino privado", text: "Anotações, técnicas e sensações de cada treino. O diário é só do aluno; compartilhar com o professor exige permissão explícita." },
  { title: "Graduação com critério", text: "Cada academia define suas faixas, graus e critérios. O aluno acompanha o progresso; a graduação oficial é sempre registrada pelo gestor." },
  { title: "Turmas e aulas", text: "Agenda, turmas, instrutores e lista de presença de cada aula, sem planilha." },
  { title: "Menores com proteção reforçada", text: "Crianças e adolescentes exigem responsáveis cadastrados e conferidos. Esse cuidado nunca é opcional." },
  { title: "Várias academias, um só atleta", text: "O atleta tem uma identidade só e pode treinar em mais de uma academia. Os dados de cada academia ficam separados." },
];

const optional = ["Financeiro manual", "Feed de fotos", "Desafios entre alunos", "Medalhas", "Painel de frequência", "Trilhas e avaliações de domínio"];

const roles = [
  { who: "Aluno", items: ["Registrar o treino em segundos", "Ver a evolução e a agenda da semana", "Fazer check-in nas aulas"] },
  { who: "Professor", items: ["Confirmar presenças da aula", "Recomendar graduações", "Ver o progresso dos alunos"] },
  { who: "Gestor", items: ["Aprovar membros e responsáveis", "Definir faixas e critérios", "Acompanhar a academia em um painel"] },
];

// Página inicial pública. O link de confirmação do e-mail de cadastro também cai aqui (`?code=` = e-mail confirmado, `?error=` = link vencido).
// Só textos fixos: nada da URL é exibido. Não há depoimentos, números de clientes nem preços: o produto está em alpha.
export default async function Home({ searchParams }: { searchParams: Promise<{ code?: string; error?: string; error_code?: string }> }) {
  const { code, error, error_code } = await searchParams;
  const failed = Boolean(error || error_code);

  return (
    <div className={styles.page}>
      <header className={styles.nav}>
        <BrandLogo tone="light" />
        <nav className={styles.navLinks} aria-label="Principal">
          <a href="#recursos">Recursos</a>
          <a href="#para-quem">Para quem</a>
          <a href="#seguranca">Segurança</a>
        </nav>
        <div className={styles.navActions}>
          <ButtonLink href="/login" variant="secondary">Entrar</ButtonLink>
        </div>
      </header>

      <main>
        <section className={styles.hero}>
          <div className={styles.heroInner}>
            <div className={styles.heroText}>
              <p className={styles.eyebrow}>Jiu-Jitsu · gestão e evolução</p>
              <h1 className={styles.headline}>Oss! O treino da sua academia, em um só lugar.</h1>
              <p className={styles.lead}>Presença confirmada, diário de treino, graduação com critério e gestão da academia. Para quem treina, para quem ensina e para quem cuida.</p>
              {code && !failed && (
                <Alert tone="success">
                  E-mail confirmado. Agora <Link href="/login">entre com o seu e-mail e a sua senha</Link>.
                </Alert>
              )}
              {failed && (
                <Alert tone="danger">
                  Este link de confirmação venceu ou já foi usado. Se o seu e-mail já foi confirmado, <Link href="/login">entre com a sua senha</Link>;
                  se não, crie a conta de novo na mesma tela.
                </Alert>
              )}
              <div className={styles.actions}>
                <ButtonLink href="/login?aba=criar" variant="accent">Criar conta</ButtonLink>
                <ButtonLink href="/login" variant="secondary">Entrar</ButtonLink>
              </div>
              <p className={styles.note}>Versão alpha, em testes com dados fictícios.</p>
            </div>

            <div className={styles.preview} aria-hidden="true">
              <div className={styles.previewCard}>
                <p className={styles.previewLabel}>Sua graduação</p>
                <p className={styles.previewBelt}>Azul · grau 2</p>
                <BeltBar belt="Azul" degree={2} size="lg" />
                <p className={styles.previewLabel}>Esta semana</p>
                <div className={styles.week}>
                  {["S", "T", "Q", "Q", "S", "S", "D"].map((d, i) => (
                    <span key={i} className={[0, 2, 4].includes(i) ? styles.dayOn : styles.day}>{d}</span>
                  ))}
                </div>
                <p className={styles.previewHint}>Ilustração. Só treino confirmado pelo professor conta.</p>
              </div>
            </div>
          </div>
        </section>

        <section id="recursos" className={styles.section}>
          <h2 className={styles.h2}>Tudo o que a academia precisa, sem complicar</h2>
          <div className={styles.grid}>
            {features.map((f) => (
              <article key={f.title} className={styles.feature}>
                <h3 className={styles.h3}>{f.title}</h3>
                <p>{f.text}</p>
              </article>
            ))}
          </div>
          <div className={styles.optional}>
            <p className={styles.optionalTitle}>Recursos extras, liberados conforme o pacote da academia</p>
            <ul className={styles.chips}>
              {optional.map((o) => <li key={o}>{o}</li>)}
            </ul>
          </div>
        </section>

        <section id="para-quem" className={`${styles.section} ${styles.alt}`}>
          <h2 className={styles.h2}>Para quem treina, ensina e cuida</h2>
          <div className={styles.grid3}>
            {roles.map((r) => (
              <article key={r.who} className={styles.role}>
                <h3 className={styles.h3}>{r.who}</h3>
                <ul>
                  {r.items.map((i) => <li key={i}>{i}</li>)}
                </ul>
              </article>
            ))}
          </div>
        </section>

        <section id="seguranca" className={styles.section}>
          <h2 className={styles.h2}>Privacidade levada a sério</h2>
          <div className={styles.grid3}>
            <article className={styles.feature}><h3 className={styles.h3}>Dados separados por academia</h3><p>Cada academia só enxerga os próprios dados. A regra é aplicada no banco de dados, não apenas na tela.</p></article>
            <article className={styles.feature}><h3 className={styles.h3}>Diário privado</h3><p>Ninguém lê o seu diário sem a sua permissão, nem mesmo o gestor da academia.</p></article>
            <article className={styles.feature}><h3 className={styles.h3}>Ações críticas registradas</h3><p>Aprovações, presenças validadas e graduações ficam registradas e não podem ser alteradas depois.</p></article>
          </div>
        </section>

        <section className={styles.cta}>
          <h2 className={styles.ctaTitle}>Pronto para o próximo treino?</h2>
          <p>Crie a sua conta e peça o link de entrada ao gestor da sua academia.</p>
          <div className={styles.actions}>
            <ButtonLink href="/login?aba=criar" variant="accent">Criar conta</ButtonLink>
            <ButtonLink href="/login" variant="secondary">Entrar</ButtonLink>
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <BrandLogo tone="light" />
        <p>Oss! é a saudação do Jiu-Jitsu. Versão alpha.</p>
        <p><Link href="/termos">Termos e privacidade</Link></p>
      </footer>
    </div>
  );
}
