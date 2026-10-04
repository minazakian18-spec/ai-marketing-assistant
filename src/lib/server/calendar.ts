import "server-only";
import { randomBytes, randomUUID } from "node:crypto";
import { adminClient, appUrl } from "./supabase";
import { HttpError } from "./access";
import { connectionToken } from "./integrations";
import { hash } from "./crypto";
import { toCalendarItems } from "@/lib/calendar-data";
import type { Workspace } from "@/lib/types";
import {
  MAVIX_TZ,
  addDays,
  zonedToUtc,
  contentEventBody,
  contentHash,
  continueRecurrence,
  eventBody,
  isMirroredContent,
  mapGoogleError,
  normalizeEvent,
  planMirror,
  remotelyDeleted,
  runSync,
  SyncTokenExpired,
  truncateRecurrence,
  validateInput,
  type ClientEvent,
  type ContentItem,
  type EventInput,
  type EventLink,
  type EventsPage,
  type GoogleEvent,
} from "@/lib/calendar/core";

const API = "https://www.googleapis.com/calendar/v3";
const enc = encodeURIComponent;

export type CalendarSettings = { mirror: boolean; mirrorCalendarId: string };
export type CalendarInfo = {
  id: string;
  summary: string;
  color: string;
  accessRole: string;
  primary: boolean;
};

/* ---------- connection & requests ---------- */

// Calendar data is personal: only the person who connected Google Calendar can
// read or change it, even though the connection belongs to the workspace.
async function connection(workspaceId: string, userId: string) {
  const { token, c } = await connectionToken(workspaceId, "google_calendar");
  if (c.connected_user !== userId)
    throw new HttpError(403, "Google Calendar is gekoppeld door een ander teamlid.");
  return { token, c };
}

type Ctx = { workspaceId: string; userId: string };

async function google<T = Record<string, unknown>>(
  ctx: Ctx,
  path: string,
  init: RequestInit = {},
  opts: { syncToken?: boolean } = {},
): Promise<T> {
  const { token, c } = await connection(ctx.workspaceId, ctx.userId);
  let r: Response;
  try {
    r = await fetch(API + path, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token.access_token,
        ...init.headers,
      },
      cache: "no-store",
    });
  } catch {
    throw new HttpError(503, mapGoogleError(503).message);
  }
  if (r.ok) return (r.status === 204 ? {} : await r.json()) as T;
  if (r.status === 410 && opts.syncToken) throw new SyncTokenExpired();
  let reason = "";
  try {
    const body = await r.json();
    reason = [body?.error?.errors?.[0]?.reason, body?.error?.status, body?.error?.message]
      .filter(Boolean)
      .join(" ");
  } catch {
    /* Non-JSON error body. */
  }
  const mapped = mapGoogleError(r.status, reason);
  if (mapped.connection)
    await adminClient()
      .from("integration_connections")
      .update({ status: mapped.connection })
      .eq("id", c.id);
  console.error(JSON.stringify({ event: "google_calendar_error", status: r.status }));
  throw new HttpError(mapped.status, mapped.message);
}

const stripNulls = (o: Record<string, unknown>): Record<string, unknown> =>
  Object.fromEntries(
    Object.entries(o)
      .filter(([, v]) => v !== null)
      .map(([k, v]) => [
        k,
        v && typeof v === "object" && !Array.isArray(v)
          ? stripNulls(v as Record<string, unknown>)
          : v,
      ]),
  );

/* ---------- status, settings, calendars ---------- */

export async function calendarStatus(workspaceId: string, userId: string) {
  const { data } = await adminClient()
    .from("integration_connections")
    .select("status,display_name,connected_user,metadata")
    .eq("workspace_id", workspaceId)
    .eq("provider", "google_calendar")
    .maybeSingle();
  const settings: CalendarSettings = {
    mirror: !!data?.metadata?.mirror,
    mirrorCalendarId: data?.metadata?.mirrorCalendarId || "primary",
  };
  if (!data || data.status === "disconnected")
    return { status: "disconnected" as const, settings };
  return {
    status: data.status as string,
    email: data.display_name as string,
    mine: data.connected_user === userId,
    settings,
  };
}

export async function saveSettings(workspaceId: string, settings: CalendarSettings) {
  const db = adminClient();
  const { data, error } = await db
    .from("integration_connections")
    .select("id,metadata")
    .eq("workspace_id", workspaceId)
    .eq("provider", "google_calendar")
    .single();
  if (error || !data) throw new HttpError(409, "Verbind eerst Google Calendar.");
  const { error: saveError } = await db
    .from("integration_connections")
    .update({ metadata: { ...(data.metadata || {}), ...settings } })
    .eq("id", data.id);
  if (saveError) throw new HttpError(503, "Instellingen opslaan is niet gelukt.");
}

export async function listCalendars(ctx: Ctx): Promise<CalendarInfo[]> {
  const res = await google<{ items?: Record<string, unknown>[] }>(
    ctx,
    "/users/me/calendarList?" +
      new URLSearchParams({
        maxResults: "100",
        fields: "items(id,summary,summaryOverride,backgroundColor,accessRole,primary,hidden)",
      }),
  );
  return (res.items || [])
    .filter((c) => !c.hidden && c.accessRole !== "freeBusyReader")
    .map((c) => ({
      id: String(c.id),
      summary: String(c.summaryOverride || c.summary || "Agenda"),
      color: String(c.backgroundColor || "#7c6bd6"),
      accessRole: String(c.accessRole),
      primary: !!c.primary,
    }))
    .sort((a, b) => Number(b.primary) - Number(a.primary));
}

async function calendarMeta(ctx: Ctx, calendarId: string, preloaded?: CalendarInfo[]) {
  const calendars = preloaded || (await listCalendars(ctx));
  const found =
    calendarId === "primary"
      ? calendars.find((c) => c.primary)
      : calendars.find((c) => c.id === calendarId);
  if (!found) throw new HttpError(404, mapGoogleError(404).message);
  return found;
}

/* ---------- events ---------- */

export async function listEvents(
  ctx: Ctx,
  calendarIds: string[],
  timeMin: string,
  timeMax: string,
): Promise<ClientEvent[]> {
  const calendars = await listCalendars(ctx);
  const out: ClientEvent[] = [];
  for (const id of calendarIds.slice(0, 20)) {
    const meta = calendars.find((c) => c.id === id);
    if (!meta) continue;
    let pageToken = "";
    for (let page = 0; page < 4; page++) {
      const res = await google<EventsPage>(
        ctx,
        `/calendars/${enc(id)}/events?` +
          new URLSearchParams({
            timeMin,
            timeMax,
            singleEvents: "true",
            orderBy: "startTime",
            maxResults: "250",
            ...(pageToken ? { pageToken } : {}),
          }),
      );
      for (const e of res.items || []) {
        if (isMirroredContent(e)) continue; // shown natively as Mavix content
        const n = normalizeEvent(e, meta);
        if (n) out.push(n);
      }
      if (!res.nextPageToken) break;
      pageToken = res.nextPageToken;
    }
  }
  return out;
}

const eventPath = (calendarId: string, eventId: string) =>
  `/calendars/${enc(calendarId)}/events/${enc(eventId)}`;

async function getEvent(ctx: Ctx, calendarId: string, eventId: string) {
  return google<GoogleEvent>(ctx, eventPath(calendarId, eventId));
}

function inputOrThrow(input: EventInput) {
  const error = validateInput(input);
  if (error) throw new HttpError(400, error);
}

function sendUpdates(input: EventInput) {
  return input.attendees?.length ? "all" : "none";
}

export async function createEvent(ctx: Ctx, calendarId: string, input: EventInput) {
  inputOrThrow(input);
  const meta = await calendarMeta(ctx, calendarId);
  const created = await google<GoogleEvent>(
    ctx,
    `/calendars/${enc(meta.id)}/events?sendUpdates=${sendUpdates(input)}`,
    { method: "POST", body: JSON.stringify(stripNulls(eventBody(input))) },
  );
  return normalizeEvent(created, meta);
}

export type Scope = "this" | "following" | "all";

// Shift an event's start/end by the same delta the user applied to one occurrence.
function shiftTime(
  t: { date?: string; dateTime?: string; timeZone?: string },
  deltaMs: number,
  dayDelta: number,
) {
  if (t.date) {
    const d = new Date(t.date + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() + dayDelta);
    return { date: d.toISOString().slice(0, 10), dateTime: null };
  }
  return {
    dateTime: new Date(new Date(t.dateTime!).getTime() + deltaMs).toISOString(),
    timeZone: t.timeZone,
    date: null,
  };
}

export async function updateEvent(
  ctx: Ctx,
  args: {
    calendarId: string;
    eventId: string;
    targetCalendarId?: string;
    scope: Scope;
    input: EventInput;
    etag?: string;
  },
) {
  inputOrThrow(args.input);
  const meta = await calendarMeta(ctx, args.calendarId);
  if (!(meta.accessRole === "owner" || meta.accessRole === "writer"))
    throw new HttpError(403, mapGoogleError(403).message);
  const body = eventBody(args.input);
  const current = await getEvent(ctx, meta.id, args.eventId);
  const masterId = current.recurringEventId;

  // Single (non-recurring) event, or just this occurrence of a series.
  if (!masterId || args.scope === "this") {
    if (masterId) delete body.recurrence;
    let calendar = meta;
    let id = args.eventId;
    if (!masterId && args.targetCalendarId && args.targetCalendarId !== meta.id) {
      const target = await calendarMeta(ctx, args.targetCalendarId);
      const moved = await google<GoogleEvent>(
        ctx,
        `${eventPath(meta.id, id)}/move?destination=${enc(target.id)}`,
        { method: "POST" },
      );
      calendar = target;
      id = moved.id;
    }
    if (!body.recurrence && !masterId && current.recurrence) body.recurrence = null;
    const updated = await google<GoogleEvent>(
      ctx,
      `${eventPath(calendar.id, id)}?sendUpdates=${sendUpdates(args.input)}`,
      {
        method: "PATCH",
        body: JSON.stringify(body),
        headers: args.etag && calendar.id === meta.id ? { "If-Match": args.etag } : {},
      },
    );
    return normalizeEvent(updated, calendar);
  }

  const master = await getEvent(ctx, meta.id, masterId);
  if (args.scope === "all") {
    const input = args.input;
    if (!!master.start?.date !== input.allDay)
      throw new HttpError(
        400,
        "'Hele dag' aan- of uitzetten kan per gebeurtenis of voor deze en volgende gebeurtenissen.",
      );
    // Apply the same move the user made to this occurrence to the whole series.
    const oldStart = current.start?.dateTime
      ? Date.parse(current.start.dateTime)
      : Date.parse((current.start?.date || "") + "T00:00:00Z");
    const newStart = input.allDay
      ? Date.parse(input.startDate + "T00:00:00Z")
      : zonedToUtc(input.startDate, input.startTime!, input.timeZone);
    const delta = newStart - oldStart;
    const dayDelta = Math.round(delta / 86400000);
    const patch: Record<string, unknown> = {
      summary: body.summary,
      description: body.description,
      location: body.location,
      reminders: body.reminders,
    };
    if (master.start && master.end) {
      const start = shiftTime(master.start, delta, dayDelta);
      patch.start = start;
      if (input.allDay) {
        const days = Math.round(
          (Date.parse(input.endDate + "T00:00:00Z") - Date.parse(input.startDate + "T00:00:00Z")) / 86400000,
        );
        patch.end = { date: addDays(start.date!, days + 1), dateTime: null };
      } else {
        const duration =
          zonedToUtc(input.endDate, input.endTime!, input.timeZone) -
          zonedToUtc(input.startDate, input.startTime!, input.timeZone);
        patch.end = {
          dateTime: new Date(Date.parse(start.dateTime!) + duration).toISOString(),
          timeZone: master.end.timeZone || master.start.timeZone,
          date: null,
        };
      }
    }
    if (body.recurrence) patch.recurrence = body.recurrence;
    const updated = await google<GoogleEvent>(
      ctx,
      `${eventPath(meta.id, masterId)}?sendUpdates=${sendUpdates(input)}`,
      { method: "PATCH", body: JSON.stringify(patch) },
    );
    return normalizeEvent(updated, meta);
  }
  // "This and following": end the original series before this occurrence and
  // start a new series from here with the edited details.
  const occurrence = current.originalStartTime || current.start || {};
  await google(ctx, eventPath(meta.id, masterId), {
    method: "PATCH",
    body: JSON.stringify({ recurrence: truncateRecurrence(master.recurrence || [], occurrence) }),
  });
  const created = await google<GoogleEvent>(
    ctx,
    `/calendars/${enc(meta.id)}/events?sendUpdates=${sendUpdates(args.input)}`,
    {
      method: "POST",
      body: JSON.stringify(
        stripNulls({
          ...body,
          recurrence: body.recurrence || continueRecurrence(master.recurrence || []),
        }),
      ),
    },
  );
  return normalizeEvent(created, meta);
}

export async function deleteEvent(
  ctx: Ctx,
  args: { calendarId: string; eventId: string; scope: Scope },
) {
  const meta = await calendarMeta(ctx, args.calendarId);
  if (!(meta.accessRole === "owner" || meta.accessRole === "writer"))
    throw new HttpError(403, mapGoogleError(403).message);
  const current = await getEvent(ctx, meta.id, args.eventId);
  const masterId = current.recurringEventId;
  if (!masterId || args.scope === "this") {
    await google(ctx, `${eventPath(meta.id, args.eventId)}?sendUpdates=all`, { method: "DELETE" });
    return;
  }
  if (args.scope === "all") {
    await google(ctx, `${eventPath(meta.id, masterId)}?sendUpdates=all`, { method: "DELETE" });
    return;
  }
  const master = await getEvent(ctx, meta.id, masterId);
  await google(ctx, eventPath(meta.id, masterId), {
    method: "PATCH",
    body: JSON.stringify({
      recurrence: truncateRecurrence(
        master.recurrence || [],
        current.originalStartTime || current.start || {},
      ),
    }),
  });
}

/* ---------- incremental sync, push channels, mirroring ---------- */

function pushAvailable() {
  try {
    return appUrl().startsWith("https://") && !appUrl().includes("localhost");
  } catch {
    return false;
  }
}

async function stopChannel(ctx: Ctx, channelId: string, resourceId: string) {
  try {
    await google(ctx, "/channels/stop", {
      method: "POST",
      body: JSON.stringify({ id: channelId, resourceId }),
    });
  } catch {
    /* Expired or already stopped channels are fine. */
  }
}

async function ensureChannel(
  ctx: Ctx,
  calendarId: string,
  state: { channel_id?: string | null; channel_resource_id?: string | null; channel_expires_at?: string | null } | null,
) {
  const db = adminClient();
  const expires = state?.channel_expires_at ? new Date(state.channel_expires_at).getTime() : 0;
  if (state?.channel_id && expires > Date.now() + 24 * 3600 * 1000) return true;
  if (state?.channel_id && state.channel_resource_id)
    await stopChannel(ctx, state.channel_id, state.channel_resource_id);
  const id = randomUUID();
  const token = randomBytes(32).toString("base64url");
  try {
    const res = await google<{ resourceId: string; expiration: string }>(
      ctx,
      `/calendars/${enc(calendarId)}/events/watch`,
      {
        method: "POST",
        body: JSON.stringify({
          id,
          type: "web_hook",
          address: appUrl() + "/api/calendar/webhook",
          token,
          params: { ttl: String(7 * 24 * 3600) },
        }),
      },
    );
    await db
      .from("calendar_sync_state")
      .update({
        channel_id: id,
        channel_resource_id: res.resourceId,
        channel_token_hash: hash(token),
        channel_expires_at: new Date(Number(res.expiration)).toISOString(),
      })
      .eq("workspace_id", ctx.workspaceId)
      .eq("calendar_id", calendarId);
    return true;
  } catch {
    // Push is an optimisation; incremental polling keeps working without it.
    await db
      .from("calendar_sync_state")
      .update({ channel_id: null, channel_resource_id: null, channel_token_hash: null, channel_expires_at: null })
      .eq("workspace_id", ctx.workspaceId)
      .eq("calendar_id", calendarId);
    return false;
  }
}

async function syncCalendar(ctx: Ctx, calendarId: string) {
  const db = adminClient();
  const { data: state } = await db
    .from("calendar_sync_state")
    .select("*")
    .eq("workspace_id", ctx.workspaceId)
    .eq("calendar_id", calendarId)
    .maybeSingle();
  if (!state)
    await db.from("calendar_sync_state").insert({ workspace_id: ctx.workspaceId, calendar_id: calendarId });

  const pushActive =
    !!state?.channel_id &&
    !!state.channel_expires_at &&
    new Date(state.channel_expires_at).getTime() > Date.now();
  const lastSync = state?.last_synced_at ? new Date(state.last_synced_at).getTime() : 0;
  const notified = state?.changed_at ? new Date(state.changed_at).getTime() : Date.now();
  // With an active push channel and no notification since the last sync,
  // nothing changed: skip the Google call (re-check at least every 15 min).
  const skip = !!state?.sync_token && pushActive && notified <= lastSync && Date.now() - lastSync < 15 * 60 * 1000;

  let changed = false;
  let deletedIds: string[] = [];
  if (!skip) {
    const timeMin = new Date(Date.now() - 31 * 86400000).toISOString();
    const result = await runSync(async (req) => {
      const params = new URLSearchParams({
        maxResults: "2500",
        fields: "nextPageToken,nextSyncToken,items(id,status,recurringEventId)",
      });
      if (req.syncToken) params.set("syncToken", req.syncToken);
      else {
        params.set("timeMin", timeMin);
        params.set("showDeleted", "false");
      }
      if (req.pageToken) params.set("pageToken", req.pageToken);
      return google<EventsPage>(ctx, `/calendars/${enc(calendarId)}/events?${params}`, {}, { syncToken: !!req.syncToken });
    }, state?.sync_token || null);
    changed = result.reset ? !!state?.sync_token : result.changes.length > 0;
    deletedIds = remotelyDeleted(result.changes);
    await db
      .from("calendar_sync_state")
      .update({
        sync_token: result.nextSyncToken,
        last_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("workspace_id", ctx.workspaceId)
      .eq("calendar_id", calendarId);
  }
  const push = pushAvailable() ? await ensureChannel(ctx, calendarId, state) : false;
  return { changed, deletedIds, push };
}

function scheduledContent(data: Workspace): ContentItem[] {
  return toCalendarItems(data)
    .filter((i) => i.date && (i.status === "scheduled" || i.status === "approved"))
    .map((i) => ({
      type: i.source.kind === "post" ? "post" : "email",
      id: i.source.id,
      title: i.title,
      channel: i.channel,
      kind: i.contentType,
      date: i.date,
      time: i.time,
      caption: i.caption,
    }));
}

async function mirrorContent(ctx: Ctx, settings: CalendarSettings, calendars: CalendarInfo[]) {
  const db = adminClient();
  const { data: links } = await db
    .from("calendar_event_links")
    .select("*")
    .eq("workspace_id", ctx.workspaceId);
  const result = { created: 0, updated: 0, removed: 0 };
  if (!settings.mirror && !(links || []).some((l) => l.state === "active")) return result;
  const meta = await calendarMeta(ctx, settings.mirrorCalendarId, calendars);
  let items: ContentItem[] = [];
  if (settings.mirror) {
    const { data } = await db
      .from("business_profiles")
      .select("data")
      .eq("workspace_id", ctx.workspaceId)
      .single();
    items = scheduledContent((data?.data || {}) as Workspace);
  }
  const plan = planMirror(items, (links || []) as EventLink[], ctx.workspaceId, meta.id);
  for (const link of plan.remove) {
    try {
      await google(ctx, eventPath(link.calendar_id, link.provider_event_id), { method: "DELETE" });
    } catch (e) {
      if (!(e instanceof HttpError && e.status === 404)) throw e;
    }
    await db
      .from("calendar_event_links")
      .delete()
      .eq("workspace_id", ctx.workspaceId)
      .eq("provider_event_id", link.provider_event_id);
    result.removed++;
  }
  for (const item of plan.create.slice(0, 50)) {
    const body = contentEventBody(item, MAVIX_TZ);
    const created = await google<GoogleEvent>(ctx, `/calendars/${enc(meta.id)}/events`, {
      method: "POST",
      body: JSON.stringify(body),
    });
    await db.from("calendar_event_links").upsert(
      {
        workspace_id: ctx.workspaceId,
        mavix_entity_type: item.type,
        mavix_entity_id: item.id,
        calendar_id: meta.id,
        provider_event_id: created.id,
        content_hash: contentHash(body),
        state: "active",
        last_synced_at: new Date().toISOString(),
      },
      { onConflict: "workspace_id,mavix_entity_type,mavix_entity_id" },
    );
    result.created++;
  }
  for (const { item, link } of plan.update.slice(0, 50)) {
    const body = contentEventBody(item, MAVIX_TZ);
    try {
      await google(ctx, eventPath(link.calendar_id, link.provider_event_id), {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      await db
        .from("calendar_event_links")
        .update({ content_hash: contentHash(body), last_synced_at: new Date().toISOString() })
        .eq("workspace_id", ctx.workspaceId)
        .eq("provider_event_id", link.provider_event_id);
      result.updated++;
    } catch (e) {
      if (!(e instanceof HttpError && e.status === 404)) throw e;
      await db
        .from("calendar_event_links")
        .update({ state: "deleted_remotely" })
        .eq("workspace_id", ctx.workspaceId)
        .eq("provider_event_id", link.provider_event_id);
    }
  }
  return result;
}

export async function syncWorkspace(ctx: Ctx, calendarIds: string[]) {
  const status = await calendarStatus(ctx.workspaceId, ctx.userId);
  if (status.status !== "connected" || !status.mine)
    throw new HttpError(409, "Verbind eerst Google Calendar.");
  const calendars = await listCalendars(ctx);
  const tracked = calendarIds.filter((id) => calendars.some((c) => c.id === id)).slice(0, 20);
  let changed = false;
  let push = tracked.length > 0;
  const deleted: string[] = [];
  for (const id of tracked) {
    const r = await syncCalendar(ctx, id);
    changed ||= r.changed;
    push &&= r.push;
    deleted.push(...r.deletedIds);
  }
  if (deleted.length)
    await adminClient()
      .from("calendar_event_links")
      .update({ state: "deleted_remotely" })
      .eq("workspace_id", ctx.workspaceId)
      .in("provider_event_id", deleted.slice(0, 500));
  const mirrored = await mirrorContent(ctx, status.settings, calendars);
  return { changed, mode: push ? "push" : "poll", mirrored };
}

// Webhook from Google: validates the channel token and marks the calendar dirty.
export async function receiveNotification(headers: Headers) {
  const channelId = headers.get("x-goog-channel-id") || "";
  const token = headers.get("x-goog-channel-token") || "";
  const resourceId = headers.get("x-goog-resource-id") || "";
  if (!channelId || !token) return false;
  const db = adminClient();
  const { data } = await db
    .from("calendar_sync_state")
    .select("workspace_id,calendar_id,channel_token_hash,channel_resource_id")
    .eq("channel_id", channelId)
    .maybeSingle();
  if (!data || data.channel_token_hash !== hash(token) || data.channel_resource_id !== resourceId)
    return false;
  await db
    .from("calendar_sync_state")
    .update({ changed_at: new Date().toISOString() })
    .eq("workspace_id", data.workspace_id)
    .eq("calendar_id", data.calendar_id);
  return true;
}

// Before tokens are removed on disconnect: stop push channels and forget sync
// state and mappings. Events already in Google are left untouched.
export async function cleanupCalendar(workspaceId: string, userId: string) {
  const db = adminClient();
  const { data: states } = await db
    .from("calendar_sync_state")
    .select("channel_id,channel_resource_id")
    .eq("workspace_id", workspaceId);
  for (const s of states || [])
    if (s.channel_id && s.channel_resource_id)
      await stopChannel({ workspaceId, userId }, s.channel_id, s.channel_resource_id).catch(() => {});
  await db.from("calendar_sync_state").delete().eq("workspace_id", workspaceId);
  await db.from("calendar_event_links").delete().eq("workspace_id", workspaceId);
}
