import { NextResponse } from "next/server";
import { z } from "zod";
import {
  workspace,
  sameOrigin,
  limited,
  failure,
  HttpError,
} from "@/lib/server/access";
import { newGmailInput, sendNewGmail } from "@/lib/server/gmail";
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const auth = await workspace();
    await limited("gmail-send:" + auth.workspaceId, 20);
    const input = newGmailInput.parse(await request.json());
    return NextResponse.json(await sendNewGmail(auth.workspaceId, input), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (e) {
    return failure(
      e instanceof z.ZodError || e instanceof SyntaxError
        ? new HttpError(
            400,
            "Controleer het e-mailadres, onderwerp en bericht.",
          )
        : e,
    );
  }
}
