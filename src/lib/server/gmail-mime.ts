import "server-only";
import { gmailRequest } from "./gmail-api";
import { HttpError } from "./access";
import type { GmailMessage, GmailPart } from "../inbox/core";

// Gmail sometimes stores even text bodies behind attachmentId. Fetch only body
// parts, never arbitrary files or remote HTML resources. Bound total work/size.
export async function hydrateGmailBody(
  workspaceId: string,
  message: GmailMessage,
  accountId: string,
  generation: string,
) {
  let count = 0,
    bytes = 0;
  const walk = async (
    part: GmailPart | undefined,
    depth = 0,
  ): Promise<void> => {
    if (!part || depth > 30) return;
    if (
      !part.filename &&
      /^(text\/plain|text\/html)$/i.test(part.mimeType || "") &&
      part.body?.attachmentId &&
      !part.body.data
    ) {
      if (++count > 20 || (bytes += part.body.size || 0) > 2000000)
        throw new HttpError(
          413,
          "Dit e-mailbericht is te groot om volledig te laden.",
        );
      const data = await gmailRequest(
        workspaceId,
        `/messages/${encodeURIComponent(message.id || "")}/attachments/${encodeURIComponent(part.body.attachmentId)}`,
        {},
        accountId,
        generation,
      );
      if (typeof data.data !== "string" || data.data.length > 3000000)
        throw new HttpError(
          502,
          "De inhoud van dit e-mailbericht kon niet worden geladen.",
        );
      part.body.data = data.data;
    }
    for (const child of part.parts || []) await walk(child, depth + 1);
  };
  await walk(message.payload);
  return message;
}
