import { receiveNotification } from "@/lib/server/calendar";

// Google Calendar push notifications. Public by design; authenticated by the
// per-channel secret token (stored hashed) and the channel's resource id. It
// only marks the calendar as changed; the next sync fetches the actual changes.
export async function POST(request: Request) {
  try {
    await receiveNotification(request.headers);
  } catch {
    console.error(JSON.stringify({ event: "calendar_webhook_failed" }));
  }
  // Always acknowledge so Google doesn't retry unknown or stale channels.
  return new Response(null, { status: 204 });
}
