import Link from "next/link";

const checks = [
  "Marco 0 em producao",
  "Marco 1 com perfil de marca local",
  "Marco 2 com gerador de conceitos",
  "Marco 3.2 com pacote final de post tipografico",
  "Marco 3.3 com biblioteca local de posts aprovados",
  "Marco 3.4 com detalhe individual do post aprovado",
  "Sem imagens geradas, publicacao ou automacao neste momento",
  "Health check minimo disponivel",
];

export default function Home() {
  return (
    <main className="page-shell">
      <section className="status-panel" aria-labelledby="reset-title">
        <p className="eyebrow">Social Media Automator</p>
        <h1 id="reset-title">Base limpa.</h1>
        <p className="lead">
          O reset foi concluido. Agora o sistema estrutura a marca e gera
          conceitos, peca tipografica, legenda e pacote final antes de qualquer
          automacao.
        </p>
        <ul className="check-list" aria-label="Status do reset">
          {checks.map((check) => (
            <li key={check}>{check}</li>
          ))}
        </ul>
        <div className="home-actions">
          <Link className="primary-link" href="/brand">
            Abrir Brand Foundation
          </Link>
          <Link className="primary-link secondary-accent" href="/create">
            Gerar conceitos
          </Link>
          <Link className="primary-link" href="/approved">
            Ver aprovados
          </Link>
          <a className="health-link" href="/api/health">
            Ver health check
          </a>
        </div>
      </section>
    </main>
  );
}
