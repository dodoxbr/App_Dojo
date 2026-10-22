import Link from "next/link";
import { Alert } from "@/components/ui";
import { Icon } from "./landing-icons";
import styles from "./home.module.css";

const bullets = [
  { icon: "book", text: "Registro de treinos e técnicas" },
  { icon: "check", text: "Presença validada pelo professor" },
  { icon: "medal", text: "Graduação oficial decidida pelo mestre" },
  { icon: "people", text: "Comunidade da academia" },
  { icon: "clipboard", text: "Gestão completa para mestres e professores" },
];

const features = [
  { icon: "book", text: "Biblioteca de técnicas com vídeos e detalhes" },
  { icon: "chart", text: "Acompanhe sua evolução de faixa e graus" },
  { icon: "check", text: "Registre seus treinos e acompanhe seu progresso" },
  { icon: "people", text: "Conecte-se com sua academia e colegas" },
  { icon: "shield", text: "Menores com proteção reforçada" },
  { icon: "medal", text: "Várias academias, um só atleta" },
];

const forGyms = [
  { title: "Alunos e turmas", text: "Cadastro, faixa atual e histórico de cada aluno em um só lugar." },
  { title: "Presença validada", text: "O aluno faz check-in, o professor confirma. Sem lista de papel." },
  { title: "Graduação por treinos", text: "Veja quem está pronto para o próximo grau. A decisão final é do mestre." },
  { title: "Financeiro manual", text: "Controle de pagamentos e pendências de cada aluno (conforme o pacote da academia)." },
];

const security = [
  { title: "Dados separados por academia", text: "Cada academia só enxerga os próprios dados. A regra é aplicada no banco de dados, não apenas na tela." },
  { title: "Diário privado", text: "Ninguém lê o seu diário sem a sua permissão, nem mesmo o gestor da academia." },
  { title: "Ações críticas registradas", text: "Aprovações, presenças validadas e graduações ficam registradas e não podem ser alteradas depois." },
];

// Página inicial pública (visual aprovado no Claude Design). O link de confirmação do e-mail de cadastro também cai aqui
// (`?code=` = e-mail confirmado, `?error=` = link vencido). Só textos fixos: nada da URL é exibido. As telas dos celulares são ILUSTRAÇÃO
// (dados fictícios); não há depoimentos, números de clientes nem preços: o produto está em alpha.
export default async function Home({ searchParams }: { searchParams: Promise<{ code?: string; error?: string; error_code?: string }> }) {
  const { code, error, error_code } = await searchParams;
  const failed = Boolean(error || error_code);

  return (
    <div className={styles.page} id="inicio">
      <header className={styles.nav}>
        <a href="#inicio" aria-label="Oss, início" className={styles.logoLink}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/oss-site-logo.webp" alt="Oss, seu companheiro de treino" width={1000} height={547} className={styles.logo} />
        </a>
        <nav className={styles.navLinks} aria-label="Principal">
          <a className={styles.navActive} href="#inicio">Início</a>
          <a href="#funcionalidades">Funcionalidades</a>
          <a href="#academias">Para academias</a>
          <a href="#seguranca">Segurança</a>
        </nav>
        <Link href="/login" className={styles.ghost}>Entrar</Link>
      </header>

      <main>
        <section className={styles.hero}>
          <div className={styles.heroText}>
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
            <h1 className={styles.headline}>Seu treino,<br />sua evolução,<br /><span>sua academia.</span></h1>
            <p className={styles.lead}>A plataforma completa para academias de Jiu-Jitsu. Do controle de presença ao acompanhamento da sua evolução técnica, tudo em um só lugar.</p>
            <ul className={styles.bullets}>
              {bullets.map((b) => (
                <li key={b.text}><span className={styles.bulletIcon}><Icon name={b.icon} /></span>{b.text}</li>
              ))}
            </ul>
            <div className={styles.heroActions}>
              <Link href="/login?aba=criar" className={styles.primary}>Começar agora <Icon name="arrow" /></Link>
              <a href="#funcionalidades" className={styles.ghostWide}>Conheça todas as funcionalidades</a>
            </div>
            <p className={styles.note}>Versão alpha, em testes com dados fictícios.</p>
          </div>

          <div className={styles.phones} aria-hidden="true">
            <div className={`${styles.phone} ${styles.phoneDark}`}>
              <div className={styles.phoneBody}>
                <div className={styles.phoneTop}>
                  <span className={styles.avatar}>FS</span>
                  <span className={styles.greet}>Boa noite,<br /><strong>Atleta!</strong></span>
                  <span className={styles.bell}><Icon name="bell" size={20} /></span>
                </div>
                <div className={styles.lightCard}>
                  <span className={styles.small}>Faixa atual</span>
                  <span className={styles.beltName}>Azul · 2 graus</span>
                  <svg viewBox="0 0 240 26" className={styles.beltSvg}>
                    <rect x="0" width="150" height="26" fill="#2457C5" />
                    <rect x="155" width="54" height="26" fill="#151515" />
                    <rect x="214" width="26" height="26" fill="#2457C5" />
                    <rect x="163" width="5" height="26" fill="#fff" />
                    <rect x="173" width="5" height="26" fill="#fff" />
                  </svg>
                  <span className={styles.meter}><span style={{ width: "68%" }} /></span>
                  <span className={styles.small}>68% do caminho até o próximo grau</span>
                </div>
                <div className={styles.lightCard}>
                  <strong className={styles.cardTitle}>Próxima aula</strong>
                  <span className={styles.classRow}>
                    <span className={styles.classIcon}><Icon name="calendar" size={16} /></span>
                    <span className={styles.small}><strong>Jiu-Jitsu · Gi</strong><br />Hoje · 19:00–20:30</span>
                  </span>
                  <span className={styles.btnRow}>
                    <span className={styles.miniGhost}>Ver detalhes</span>
                    <span className={styles.miniPrimary}>Fazer check-in</span>
                  </span>
                </div>
                <strong className={styles.weekTitle}>Resumo da semana</strong>
                <div className={styles.stats}>
                  <span><b>3</b>Treinos</span>
                  <span><b>92%</b>Frequência</span>
                  <span><b>5</b>Técnicas</span>
                </div>
              </div>
              <div className={styles.tabbar}>
                <span className={styles.tabOn}><Icon name="home" />Início</span>
                <span><Icon name="book" />Treinos</span>
                <span><Icon name="clipboard" />Técnicas</span>
                <span><Icon name="chart" />Evolução</span>
                <span><Icon name="user" />Perfil</span>
              </div>
            </div>

            <div className={`${styles.phone} ${styles.phoneLight}`}>
              <div className={styles.techHead}>
                <strong>Passagem de guarda toureando</strong>
                <span className={styles.tags}><span>Passagem</span><span>Intermediário</span></span>
              </div>
              <div className={styles.video}><span className={styles.play} /><span className={styles.progress}><span /></span></div>
              <div className={styles.tabs}><span className={styles.tabsOn}>Detalhes</span><span>Passo a passo</span><span>Variações</span></div>
              <div className={styles.techBody}>
                <strong className={styles.cardTitle}>Descrição</strong>
                <p>Passagem em pé que controla as calças do oponente e redireciona as pernas para o lado, abrindo caminho até o controle lateral.</p>
                <strong className={styles.cardTitle}>Técnicas relacionadas</strong>
                <div className={styles.related}>
                  <span><i />Quebra de guarda</span>
                  <span><i />Controle de quadril</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="funcionalidades" className={styles.features}>
          {features.map((f) => (
            <div key={f.text} className={styles.featureCard}>
              <span className={styles.featureIcon}><Icon name={f.icon} size={20} /></span>
              <span>{f.text}</span>
            </div>
          ))}
        </section>

        <section id="academias" className={styles.light}>
          <div className={styles.lightInner}>
            <div className={styles.lightText}>
              <p className={styles.eyebrow}>Para academias</p>
              <h2 className={styles.h2}>O tatame organizado, do check-in à graduação.</h2>
              <p className={styles.lightLead}>Mestres e professores acompanham alunos, validam presenças e decidem graduações com base no histórico real de treinos.</p>
              <Link href="/login?aba=criar" className={styles.dark}>Quero para minha academia</Link>
            </div>
            <div className={styles.gymGrid}>
              {forGyms.map((g) => (
                <div key={g.title} className={styles.gymCard}>
                  <h3>{g.title}</h3>
                  <p>{g.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="seguranca" className={styles.security}>
          <p className={styles.eyebrowDark}>Segurança</p>
          <h2 className={styles.h2Dark}>Privacidade levada a sério</h2>
          <div className={styles.secGrid}>
            {security.map((s) => (
              <div key={s.title} className={styles.featureCard}>
                <div><h3>{s.title}</h3><p>{s.text}</p></div>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/oss-site-logo.webp" alt="Oss" width={1000} height={547} className={styles.footLogo} />
        <span>Oss, a saudação do tatame.</span>
        <span className={styles.footLinks}>
          <Link href="/termos">Termos e privacidade</Link>
          <Link href="/login">Entrar</Link>
        </span>
      </footer>
    </div>
  );
}
