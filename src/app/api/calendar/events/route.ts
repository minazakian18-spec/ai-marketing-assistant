import { NextResponse } from "next/server";
import { z } from "zod";
import { workspace, failure, limited, sameOrigin, HttpError } from "@/lib/server/access";
import { createEvent, deleteEvent, listEvents, updateEvent } from "@/lib/server/calendar";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const time = z.string().regex(/^\d{2}:\d{2}$/);
const eventInput = z.object({
  title: z.string().trim().min(1).max(500),
  description: z.string().max(8000).optional(),
  location: z.string().max(500).optional(),
  allDay: z.boolean(),
  startDate: date,
  startTime: time.optional(),
  endDate: date,
  endTime: time.optional(),
  timeZone: z.string().min(1).max(64).refine((tz) => {
    try {
      new Intl.DateTimeFormat("en", { timeZone: tz });
      return true;
    } catch {
      return false;
    }
  }),
  reminder: z.union([z.literal("default"), z.literal("none"), z.number().int().min(0).max(40320)]),
  repeat: z
    .object({
      freq: z.enum(["DAILY", "WEEKLY", "MONTHLY", "YEARLY"]),
      interval: z.number().int().min(1).max(99),
    })
    .nullable(),
  attendees: z.array(z.string().email().max(254)).max(50).optional(),
});
const id = z.string().min(1).max(1024);
const scope = z.enum(["this", "following", "all"]);
const json = { headers: { "Cache-Control": "private, no-store" } };

async function ctx(request?: Request) {
  if (request) sameOrigin(request);
  const auth = await workspace();
  await limited("calendar:" + auth.user.id, request ? 60 : 120);
  return { workspaceId: auth.workspaceId, userId: auth.user.id };
}

function badInput(e: unknown) {
  return e instanceof z.ZodError
    ? failure(new HttpError(400, "Controleer titel, datum en tijden van het evenement."))
    : failure(e);
}

// Events for the visible range only (singleEvents expands recurring series).
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const start = z.string().datetime({ offset: true }).parse(url.searchParams.get("start"));
    const end = z.string().datetime({ offset: true }).parse(url.searchParams.get("end"));
    if (Date.parse(end) - Date.parse(start) > 100 * 86400000)
      throw new HttpError(400, "Kies een kortere periode.");
    const calendars = (url.searchParams.get("calendars") || "").split(",").filter(Boolean).slice(0, 20);
    const events = calendars.length ? await listEvents(await ctx(), calendars, start, end) : [];
    return NextResponse.json({ events }, json);
  } catch (e) {
    return badInput(e);
  }
}

export async function POST(request: Request) {
  try {
    const c = await ctx(request);
    const body = z.object({ calendarId: id, input: eventInput }).parse(await request.json());
    return NextResponse.json({ event: await createEvent(c, body.calendarId, body.input) }, json);
  } catch (e) {
    return badInput(e);
  }
}

export async function PATCH(request: Request) {
  try {
    const c = await ctx(request);
    const body = z
      .object({
        calendarId: id,
        eventId: id,
        targetCalendarId: id.optional(),
        scope,
        etag: z.string().max(200).optional(),
        input: eventInput,
      })
      .parse(await request.json());
    return NextResponse.json({ event: await updateEvent(c, body) }, json);
  } catch (e) {
    return badInput(e);
  }
}

export async function DELETE(request: Request) {
  try {
    const c = await ctx(request);
    const body = z.object({ calendarId: id, eventId: id, scope }).parse(await request.json());
    await deleteEvent(c, body);
    return NextResponse.json({ ok: true }, json);
  } catch (e) {
    return badInput(e);
  }
}
