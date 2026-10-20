import Link from "next/link";

export default function Home() {
  return (
    <main style={{ padding: 16 }}>
      <h1>Dojo Platform — Painel</h1>
      <p><Link href="/login">Entrar</Link> · <Link href="/perfil">Meu perfil</Link></p>
    </main>
  );
}
