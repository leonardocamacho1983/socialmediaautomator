const checks = [
  "Marco 0 em producao",
  "Marco 1 com perfil de marca local",
  "Marco 2 com gerador de conceitos",
  "Sem arte final, publicacao ou automacao neste momento",
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
          conceitos criativos antes de criar qualquer asset.
        </p>
        <ul className="check-list" aria-label="Status do reset">
          {checks.map((check) => (
            <li key={check}>{check}</li>
          ))}
        </ul>
        <div className="home-actions">
          <a className="primary-link" href="/brand">
            Abrir Brand Foundation
          </a>
          <a className="primary-link secondary-accent" href="/create">
            Gerar conceitos
          </a>
          <a className="health-link" href="/api/health">
            Ver health check
          </a>
        </div>
      </section>
    </main>
  );
}
