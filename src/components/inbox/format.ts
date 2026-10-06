const time = new Intl.DateTimeFormat("nl-NL", { hour: "2-digit", minute: "2-digit" });
const day = new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "short" });
const full = new Intl.DateTimeFormat("nl-NL", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

export function listTime(iso: string) {
  const d = new Date(iso), now = new Date();
  if (sameDay(d, now)) return time.format(d);
  const y = new Date(now);
  y.setDate(now.getDate() - 1);
  if (sameDay(d, y)) return "gisteren";
  return day.format(d);
}

export const messageTime = (iso: string) => {
  const d = new Date(iso);
  return sameDay(d, new Date()) ? time.format(d) : full.format(d);
};

export function windowLabel(closesAt: string | null) {
  if (!closesAt) return "";
  const ms = new Date(closesAt).getTime() - Date.now();
  if (ms <= 0) return "";
  const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000);
  return h > 0 ? `nog ${h} u ${m} min` : `nog ${m} min`;
}

export const initials = (name: string) =>
  name
    .replace(/^[@+]/, "")
    .split(/[\s._-]+/)
    .filter((p) => /^[\p{L}\p{N}]/u.test(p))
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("") || "?";

export const dayKey = (iso: string) => new Date(iso).toDateString();
export function dayLabel(iso: string) {
  const d = new Date(iso), now = new Date();
  if (sameDay(d, now)) return "Vandaag";
  const y = new Date(now);
  y.setDate(now.getDate() - 1);
  if (sameDay(d, y)) return "Gisteren";
  return d.toLocaleDateString("nl-NL", { weekday: "long", day: "numeric", month: "long" });
}
