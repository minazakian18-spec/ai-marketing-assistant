import { NextResponse } from "next/server";
import { z } from "zod";
import { workspace, limited, failure, HttpError } from "@/lib/server/access";
import { gmailListInput, listGmailThreads } from "@/lib/server/gmail";
export async function GET(request: Request) {
  try {
    const auth = await workspace();
    await limited("gmail-list:" + auth.workspaceId, 30);
    const input = gmailListInput.parse(
      Object.fromEntries(new URL(request.url).searchParams),
    );
    return NextResponse.json(await listGmailThreads(auth.workspaceId, input), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (e) {
    return failure(
      e instanceof z.ZodError
        ? new HttpError(400, "Ongeldige zoekopdracht of pagina.")
        : e,
    );
  }
}
