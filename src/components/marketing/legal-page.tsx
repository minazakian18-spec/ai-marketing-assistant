export function LegalPage({
  title,
  intro,
}: {
  title: string;
  intro: string;
}) {
  return (
    <main className="mkt-section mkt-container" style={{ maxWidth: 760 }}>
      <h1 className="mkt-h1" style={{ fontSize: 34 }}>
        {title}
      </h1>
      <p className="mkt-lede" style={{ margin: "18px 0 0" }}>
        {intro}
      </p>
      <div
        className="mkt-auth-banner mkt-auth-banner-info"
        style={{ marginTop: 32 }}
      >
        De definitieve juridische tekst voor deze pagina is nog niet
        vastgesteld. Deze plek is voorbereid zodat de tekst hier direct
        geplaatst kan worden zodra die klaar is.
      </div>
    </main>
  );
}
