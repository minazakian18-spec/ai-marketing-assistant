// Public-site facts used for metadata, sitemap, robots and structured data.
// Only real, verifiable information: no ratings, reviews or invented
// company details.
import type { Metadata } from "next";
import { pricingPlans } from "./pricing-data";

export const SITE_NAME = "Mavix";

// Canonical origin. APP_URL is set in production (see .env.example); the
// fallback is the production domain so canonical URLs never point to
// localhost in a misconfigured build.
export function siteUrl() {
  const raw = process.env.APP_URL || "https://mavix.webbo-solutions.nl";
  try {
    return new URL(raw).origin;
  } catch {
    return "https://mavix.webbo-solutions.nl";
  }
}

export const SITE_DESCRIPTION =
  "Mavix is AI-marketingsoftware voor kleine en middelgrote bedrijven: beantwoord Google-reviews, maak en plan Instagram-content en verstuur e-mailcampagnes vanuit één werkruimte.";

// Public pages that should be indexed (legal pages follow once their final
// text is published).
export const PUBLIC_PAGES: { path: string; priority: number; changeFrequency: "weekly" | "monthly" }[] = [
  { path: "/", priority: 1, changeFrequency: "weekly" },
  { path: "/pricing", priority: 0.8, changeFrequency: "monthly" },
];

export function structuredData() {
  const url = siteUrl();
  return [
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      "@id": url + "/#organization",
      name: SITE_NAME,
      url,
      logo: url + "/icon-512.png",
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      "@id": url + "/#website",
      name: SITE_NAME,
      url,
      inLanguage: "nl-NL",
      publisher: { "@id": url + "/#organization" },
    },
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: SITE_NAME,
      url,
      applicationCategory: "BusinessApplication",
      applicationSubCategory: "Marketingsoftware",
      operatingSystem: "Web",
      inLanguage: "nl-NL",
      description: SITE_DESCRIPTION,
      publisher: { "@id": url + "/#organization" },
      offers: pricingPlans.map((p) => ({
        "@type": "Offer",
        name: p.name,
        price: p.monthlyPrice,
        priceCurrency: "EUR",
        priceSpecification: {
          "@type": "UnitPriceSpecification",
          price: p.monthlyPrice,
          priceCurrency: "EUR",
          unitText: "maand",
          valueAddedTaxIncluded: false,
        },
        url: url + "/pricing",
      })),
    },
  ];
}

const OG_IMAGE = { url: "/opengraph-image", width: 1200, height: 630, alt: "Mavix — AI-marketingsoftware voor ondernemers" };

// Complete page metadata. Next.js replaces (not merges) openGraph/twitter
// objects per page, so every public page sets the full set here.
export function pageMetadata({ title, description, path, absoluteTitle = false }: { title: string; description: string; path: string; absoluteTitle?: boolean }): Metadata {
  const full = absoluteTitle ? title : `${title} | ${SITE_NAME}`;
  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: { canonical: path },
    openGraph: { type: "website", siteName: SITE_NAME, locale: "nl_NL", url: path, title: full, description, images: [OG_IMAGE] },
    twitter: { card: "summary_large_image", title: full, description, images: [OG_IMAGE.url] },
  };
}