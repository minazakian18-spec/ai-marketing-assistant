// Result pages after signing up, confirming or unsubscribing.
const TEXT: Record<string, [string, string]> = {
  subscribed: ["Je bent aangemeld", "Bedankt! Je ontvangt voortaan de nieuwsbrief. Afmelden kan altijd via de link in elke e-mail."],
  pending: ["Bijna klaar", "We hebben je een e-mail gestuurd. Klik op de link in die e-mail om je aanmelding te bevestigen."],
  confirmed: ["Aanmelding bevestigd", "Bedankt! Je ontvangt voortaan de nieuwsbrief. Afmelden kan altijd via de link in elke e-mail."],
  expired: ["Link verlopen", "Deze bevestigingslink is verlopen of al gebruikt. Meld je opnieuw aan om een nieuwe link te ontvangen."],
  unsubscribed: ["Je bent afgemeld", "Je ontvangt geen nieuwsbrief meer. Heb je je per ongeluk afgemeld? Dan kun je je opnieuw aanmelden via het formulier."],
  invalid_link: ["Ongeldige link", "Deze afmeldlink klopt niet. Gebruik de link uit de laatste e-mail die je hebt ontvangen."],
  invalid: ["Controleer je gegevens", "Vul een geldig e-mailadres in en geef toestemming met het vinkje. Ga terug om het opnieuw te proberen."],
  forbidden: ["Aanmelden niet mogelijk", "Dit formulier mag niet vanaf deze website worden gebruikt."],
  busy: ["Even geduld", "Er zijn veel aanvragen tegelijk. Probeer het over een minuut opnieuw."],
  error: ["Er ging iets mis", "Je aanvraag kon niet worden verwerkt. Probeer het later opnieuw."],
};

export default async function NewsletterStatus({ searchParams }: { searchParams: Promise<{ s?: string }> }) {
  const { s } = await searchParams;
  const [title, body] = TEXT[s || ""] || TEXT.error;
  const problem = ["expired", "invalid_link", "invalid", "forbidden", "busy", "error"].includes(s || "error");
  return (
    <>
      <h1>{title}</h1>
      <p className={problem ? "nl-error" : undefined} role={problem ? "alert" : "status"}>
        {body}
      </p>
    </>
  );
}
