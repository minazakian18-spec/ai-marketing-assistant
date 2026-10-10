import { notFound } from "next/navigation";
import { publicForm } from "@/lib/server/newsletter";

// Hosted signup page for a newsletter form (/nieuwsbrief/<public key>). Works
// without JavaScript: a plain form post to the public signup endpoint.
export default async function NewsletterSignup({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const form = await publicForm(key).catch(() => null);
  if (!form) notFound();
  return (
    <>
      <h1>Nieuwsbrief van {form.business}</h1>
      <p>{form.doubleOptIn ? "Na het aanmelden ontvang je een e-mail om je aanmelding te bevestigen." : "Meld je aan met je e-mailadres."}</p>
      <form className="nl-form" method="post" action="/api/newsletter/subscribe">
        <input type="hidden" name="form" value={form.publicKey} />
        <label>
          E-mailadres
          <input type="email" name="email" required maxLength={254} autoComplete="email" />
        </label>
        <label>
          Naam (optioneel)
          <input type="text" name="name" maxLength={120} autoComplete="name" />
        </label>
        <label className="nl-consent">
          <input type="checkbox" name="consent" value="yes" required />
          <span>
            {form.consentText}
            {form.privacyPolicyUrl && (
              <>
                {" "}
                <a href={form.privacyPolicyUrl} target="_blank" rel="noopener noreferrer">
                  Privacyverklaring
                </a>
              </>
            )}
          </span>
        </label>
        <div className="nl-hp" aria-hidden="true">
          <label>
            Website
            <input type="text" name="website" tabIndex={-1} autoComplete="off" />
          </label>
        </div>
        <button type="submit" className="nl-button">
          Aanmelden
        </button>
      </form>
    </>
  );
}
