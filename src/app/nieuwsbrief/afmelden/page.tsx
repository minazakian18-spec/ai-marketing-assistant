// Unsubscribe link target. The button unsubscribes (POST), so link scanners
// that only open the link do not unsubscribe anyone.
export default async function NewsletterUnsubscribe({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = "" } = await searchParams;
  return (
    <>
      <h1>Afmelden voor de nieuwsbrief</h1>
      <p>Weet je het zeker? Je ontvangt daarna geen nieuwsbrief meer.</p>
      <form className="nl-form" method="post" action="/api/newsletter/unsubscribe">
        <input type="hidden" name="token" value={token.slice(0, 100)} />
        <button type="submit" className="nl-button">
          Afmelden
        </button>
      </form>
    </>
  );
}
