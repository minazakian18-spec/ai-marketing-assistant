import "server-only";
import { HttpError } from "./access";
import {
  gmailConnection,
  gmailToken,
  markGmailConnection,
} from "./gmail-credentials";

export class GmailHistoryExpired extends Error {}

// expectedAccount protects cached Inbox records from a mailbox switch. Generation
// pins all calls in a multi-request operation to the same OAuth connection.
export async function gmailRequest(
  workspaceId: string,
  path: string,
  init: RequestInit = {},
  expectedAccount?: string,
  generation?: string,
) {
  const check = (c: Awaited<ReturnType<typeof gmailConnection>>) => {
    if (
      (expectedAccount && c.provider_account_id !== expectedAccount) ||
      (generation && c.connection_generation !== generation)
    )
      throw new HttpError(
        409,
        "De Gmail-koppeling is gewijzigd. Laad de Inbox opnieuw.",
      );
  };
  const current = await gmailConnection(workspaceId);
  check(current);
  const pinned = current.connection_generation;
  let auth = await gmailToken(workspaceId);
  for (let attempt = 0; attempt < 2; attempt++) {
    check(auth.c);
    if (auth.c.connection_generation !== pinned)
      throw new HttpError(
        409,
        "De Gmail-koppeling is gewijzigd. Probeer opnieuw.",
      );
    let response: Response;
    try {
      response = await fetch(
        "https://gmail.googleapis.com/gmail/v1/users/me" + path,
        {
          ...init,
          headers: {
            ...init.headers,
            "Content-Type": "application/json",
            Authorization: "Bearer " + auth.token.access_token,
          },
          cache: "no-store",
          signal: AbortSignal.timeout(20000),
        },
      );
    } catch {
      // Never retry an ambiguous send: Google may already have accepted it.
      throw new HttpError(
        503,
        init.method === "POST"
          ? "Gmail heeft de verzending niet bevestigd. Controleer Verzonden voordat je opnieuw verstuurt."
          : "Gmail kon tijdelijk niet worden geladen. Probeer het opnieuw.",
      );
    }
    if (response.ok) {
      const data = await response.json().catch(() => null);
      if (!data) throw new HttpError(502, "Gmail gaf een ongeldig antwoord.");
      const latest = await gmailConnection(workspaceId);
      check(latest);
      if (latest.connection_generation !== pinned)
        throw new HttpError(
          409,
          "De Gmail-koppeling is gewijzigd. Laad de Inbox opnieuw.",
        );
      return data;
    }
    if (response.status === 401 && attempt === 0) {
      auth = await gmailToken(workspaceId, undefined, auth.token.access_token);
      continue;
    }
    const data = await response.json().catch(() => ({}));
    const reason = String(
      data?.error?.errors?.[0]?.reason || data?.error?.status || "",
    );
    if (response.status === 401) {
      await markGmailConnection(auth.c, "reconnect_required");
      throw new HttpError(
        409,
        "Je Gmail-koppeling is verlopen. Koppel opnieuw om verder te gaan.",
      );
    }
    if (
      response.status === 429 ||
      /rateLimit|quota|RESOURCE_EXHAUSTED/i.test(reason)
    )
      throw new HttpError(
        429,
        "Gmail is even te druk. Probeer het later opnieuw.",
      );
    if (
      response.status === 403 &&
      /insufficient|PERMISSION_DENIED|forbidden/i.test(reason)
    ) {
      await markGmailConnection(auth.c, "permission_missing");
      throw new HttpError(
        403,
        "Toestemming voor Gmail ontbreekt. Koppel Gmail opnieuw.",
      );
    }
    if (response.status === 404 && path.startsWith("/history"))
      throw new GmailHistoryExpired();
    if (response.status === 404)
      throw new HttpError(
        404,
        "Dit e-mailbericht of gesprek bestaat niet meer.",
      );
    if (response.status === 400)
      throw new HttpError(
        400,
        "Gmail kon deze aanvraag niet verwerken. Controleer je zoekopdracht of laad de lijst opnieuw.",
      );
    throw new HttpError(
      502,
      "Gmail kon tijdelijk niet worden geladen. Probeer het opnieuw.",
    );
  }
  throw new HttpError(409, "Koppel Gmail opnieuw.");
}
