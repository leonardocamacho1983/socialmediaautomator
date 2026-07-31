const checks = [
  "Aplicacao Next.js limpa",
  "App Router, TypeScript e ESLint",
  "Rotas e arquitetura legadas removidas",
  "Health check minimo disponivel",
];

export default function Home() {
  return (
    <main className="page-shell">
      <section className="status-panel" aria-labelledby="reset-title">
        <p className="eyebrow">Marco 0</p>
        <h1 id="reset-title">Reset concluido.</h1>
        <p className="lead">
          Esta e uma base limpa do Social Media Automator. Nenhuma
          funcionalidade de produto foi implementada ainda.
        </p>
        <ul className="check-list" aria-label="Status do reset">
          {checks.map((check) => (
            <li key={check}>{check}</li>
          ))}
        </ul>
        <a className="health-link" href="/api/health">
          Ver health check
        </a>
      </section>
    </main>
  );
}
