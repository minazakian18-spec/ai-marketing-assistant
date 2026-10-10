// Double opt-in: the e-mail link opens this page; the button confirms (POST),
// so e-mail link scanners cannot confirm on someone's behalf.
export default async function NewsletterConfirm({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = "" } = await searchParams;
  return (
    <>
      <h1>Aanmelding bevestigen</h1>
      <p>Bevestig dat je de nieuwsbrief wilt ontvangen.</p>
      <form className="nl-form" method="post" action="/api/newsletter/confirm">
        <input type="hidden" name="token" value={token.slice(0, 100)} />
        <button type="submit" className="nl-button">
          Ja, bevestig mijn aanmelding
        </button>
      </form>
    </>
  );
}
