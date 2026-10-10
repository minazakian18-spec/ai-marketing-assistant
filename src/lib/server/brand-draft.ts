import "server-only";
import { z } from "zod";

// The Brand Hub fields an AI preview may use (no images, addresses or IDs).
// Shaped like a Profile so buildBrandContext can read it.
export const brandDraft = z.object({
  name: z.string().max(160).default(""),
  industry: z.string().max(300).default(""),
  description: z.string().max(3000).default(""),
  audience: z.string().max(1000).default(""),
  voice: z.string().max(100).default(""),
  website: z.string().max(300).default(""),
  city: z.string().max(100).default(""),
  country: z.string().max(100).default(""),
  brandVoice: z
    .object({
      colors: z.array(z.string().max(9)).max(4).default([]),
      preferredWords: z.string().max(500).default(""),
      avoidWords: z.string().max(500).default(""),
      emojiUsage: z.enum(["geen", "af en toe", "veel"]).default("af en toe"),
      formality: z.enum(["formeel", "neutraal", "informeel"]).default("neutraal"),
      marketingStyle: z.string().max(500).default(""),
    })
    .default({ colors: [], preferredWords: "", avoidWords: "", emojiUsage: "af en toe", formality: "neutraal", marketingStyle: "" }),
  strategy: z
    .object({
      usps: z.string().max(2000).default(""),
      audienceInterests: z.string().max(1000).default(""),
      language: z.string().max(10).default("nl"),
      tonePreset: z.enum(["professioneel", "vriendelijk", "speels", "luxe", "informatief"]).optional(),
      personality: z.array(z.string().max(40)).max(12).default([]),
      ctas: z.array(z.string().max(60)).max(6).default([]),
      objective: z.string().max(40).default(""),
    })
    .partial()
    .default({}),
});