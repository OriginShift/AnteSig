export default function HomePage() {
  return (
    <main>
      <p className="eyebrow">Moss-Mini Demo</p>
      <h1>Web/API baseline</h1>
      <p className="lede">
        A buildable Next.js boundary for strict preflight request contracts and
        server-side validation.
      </p>
      <section className="status-panel" aria-labelledby="status-title">
        <span className="status-label">OFFLINE BASELINE</span>
        <h2 id="status-title">Integration is not enabled</h2>
        <p>
          This checkout exposes contract and health endpoints backed by an
          offline development service. It does not perform live protocol,
          wallet, RPC, signing, or transaction work.
        </p>
      </section>
    </main>
  );
}
