import "server-only";
import { z } from "zod";
import { HttpError } from "./access";
import { emailConfigured } from "./newsletter";

// Validation for newsletter signup forms (create and update).
const origin = z
  .string()
  .trim()
  .max(200)
  .refine((v) => {
    try {
      const u = new URL(v);
      return (u.protocol === "https:" || u.hostname === "localhost") && u.origin === v;
    } catch {
      return false;
    }
  });
export const formInput = z.object({
  name: z.string().trim().min(1).max(120),
  consentText: z.string().trim().min(10).max(1000),
  privacyPolicyUrl: z.string().trim().url().startsWith("https://").max(500).nullable().optional(),
  privacyPolicyVersion: z.string().trim().min(1).max(40),
  allowedOrigins: z.array(origin).max(10).default([]),
  redirectUrl: z.string().trim().url().startsWith("https://").max(500).nullable().optional(),
  doubleOptIn: z.boolean().default(false),
  active: z.boolean().default(true),
});
export const toRow = (f: z.infer<typeof formInput>) => ({
  name: f.name,
  consent_text: f.consentText,
  privacy_policy_url: f.privacyPolicyUrl || null,
  privacy_policy_version: f.privacyPolicyVersion,
  allowed_origins: f.allowedOrigins,
  redirect_url: f.redirectUrl || null,
  double_opt_in: f.doubleOptIn,
  active: f.active,
});
export function checkDoubleOptIn(f: { doubleOptIn: boolean }) {
  if (f.doubleOptIn && !emailConfigured())
    throw new HttpError(400, "Dubbele bevestiging vereist dat Mavix e-mail kan versturen. Dat is nog niet ingesteld; zet deze optie uit of vraag de beheerder om e-mail in te stellen.");
}

