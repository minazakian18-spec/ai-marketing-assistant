import type { Contact, ContactNewsletter, ContactStatus } from "./types";

// Newsletter subscribers -> Contacts. Shared by the server (merge on
// workspace load) and tests; no browser or server-only imports.

export const NEWSLETTER_GROUP = "Nieuwsbrieflezers";

/** Lower-case, trimmed address; the de-duplication key within a workspace. */
export const normalizeEmail = (email: string) => email.trim().toLowerCase();

export type SubscriberSync = {
  id: string;
  email: string;
  name: string | null;
  status: ContactNewsletter["status"];
  source: string;
  subscribed_at: string | null;
  unsubscribed_at: string | null;
  privacy_policy_version: string | null;
  created_at: string;
};

export const CONTACT_STATUS: Record<ContactNewsletter["status"], ContactStatus> = {
  subscribed: "Ingeschreven",
  pending: "Niet bevestigd",
  unsubscribed: "Uitgeschreven",
};

function splitName(name: string | null) {
  const parts = (name || "").trim().replace(/\s+/g, " ").split(" ").filter(Boolean);
  return { firstName: parts[0] || "", lastName: parts.slice(1).join(" ") };
}

/**
 * Merge subscriber changes into the contact list. An existing contact with the
 * same normalized e-mail is updated (status + newsletter details; names only
 * filled when empty), never duplicated. Returns the same array when nothing
 * changed.
 */
export function mergeSubscribers(contacts: Contact[], subscribers: SubscriberSync[], newId: () => string): { contacts: Contact[]; changed: boolean } {
  if (!subscribers.length) return { contacts, changed: false };
  const next = [...contacts];
  const index = new Map<string, number>();
  next.forEach((c, i) => {
    const key = normalizeEmail(c.email);
    if (!index.has(key)) index.set(key, i);
  });
  let changed = false;
  for (const s of subscribers) {
    const key = normalizeEmail(s.email);
    const newsletter: ContactNewsletter = {
      subscriberId: s.id,
      status: s.status,
      source: s.source,
      ...(s.subscribed_at ? { subscribedAt: s.subscribed_at } : {}),
      ...(s.unsubscribed_at ? { unsubscribedAt: s.unsubscribed_at } : {}),
      ...(s.privacy_policy_version ? { privacyPolicyVersion: s.privacy_policy_version } : {}),
    };
    const at = index.get(key);
    if (at === undefined) {
      const { firstName, lastName } = splitName(s.name);
      next.push({
        id: newId(),
        firstName,
        lastName,
        email: key,
        group: NEWSLETTER_GROUP,
        status: CONTACT_STATUS[s.status],
        source: "newsletter",
        createdAt: s.created_at,
        newsletter,
      });
      index.set(key, next.length - 1);
      changed = true;
      continue;
    }
    const current = next[at];
    const names = !current.firstName && !current.lastName ? splitName(s.name) : null;
    const updated: Contact = {
      ...current,
      ...(names ? names : {}),
      status: CONTACT_STATUS[s.status],
      group: current.group || NEWSLETTER_GROUP,
      newsletter,
    };
    if (JSON.stringify(updated) !== JSON.stringify(current)) {
      next[at] = updated;
      changed = true;
    }
  }
  return { contacts: changed ? next : contacts, changed };
}

/** Contacts that belong to the newsletter segment in the Contacts module. */
export const isNewsletterContact = (c: Contact) => !!c.newsletter || c.group === NEWSLETTER_GROUP;
