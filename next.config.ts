import type { NextConfig } from "next";

// Legacy app URLs (bookmarks, old links, emails) keep working. Query strings
// such as ?tab=assist&post=… are passed through to the new route.
const legacyRoutes: [string, string][] = [
  ["/instagram-ai", "/social"],
  ["/ai-content", "/social"],
  ["/email-ai", "/email"],
  ["/review-ai", "/reviews"],
  ["/contentkalender", "/calendar"],
  // The Brand Hub used to live here.
  ["/bedrijfsprofiel", "/brand-hub"],
];

const legalRoutes: [string, string][] = [
  ["/legal/privacy", "/privacy"],
  ["/legal/voorwaarden", "/voorwaarden"],
  ["/legal/cookies", "/cookies"],
  ["/legal/avg", "/privacy"],
];

const nextConfig: NextConfig = {
  experimental: {
    // Build workers (page-data collection and static generation). By default
    // Next uses one per CPU; on the shared Hostinger build host that was 63,
    // more threads than the host allows ("can't spawn worker thread"). Two
    // workers build reliably there; the build output is the same.
    cpus: 2,
  },
  async redirects() {
    return [
      ...legacyRoutes.map(([source, destination]) => ({
        source,
        destination,
        permanent: false,
      })),
      // The legal pages moved from /legal/* to short, stable URLs.
      ...legalRoutes.map(([source, destination]) => ({ source, destination, permanent: true })),
    ];
  },
};

export default nextConfig;
