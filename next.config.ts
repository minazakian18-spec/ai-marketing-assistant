import type { NextConfig } from "next";

// Legacy app URLs (bookmarks, old links, emails) keep working. Query strings
// such as ?tab=assist&post=… are passed through to the new route.
const legacyRoutes: [string, string][] = [
  ["/instagram-ai", "/social"],
  ["/ai-content", "/social"],
  ["/email-ai", "/email"],
  ["/review-ai", "/reviews"],
  ["/contentkalender", "/calendar"],
];

const nextConfig: NextConfig = {
  async redirects() {
    return legacyRoutes.map(([source, destination]) => ({
      source,
      destination,
      permanent: false,
    }));
  },
};

export default nextConfig;
