import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

// Public marketing pages are crawlable. The logged-in app and APIs are not:
// they require an account and redirect to /login anyway, and their pages
// also carry a noindex robots meta tag.
const PRIVATE = [
  "/api/",
  "/dashboard",
  "/agent",
  "/studio",
  "/inbox",
  "/calendar",
  "/social",
  "/email",
  "/reviews",
  "/ads",
  "/seo",
  "/contacten",
  "/inzichten",
  "/brand-hub",
  "/bedrijfsprofiel",
  "/library",
  "/account",
  "/reset-password",
  "/forgot-password",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: PRIVATE }],
    sitemap: siteUrl() + "/sitemap.xml",
    host: siteUrl(),
  };
}
