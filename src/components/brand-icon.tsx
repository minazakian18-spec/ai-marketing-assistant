import {
  siGmail,
  siGoogle,
  siGoogleads,
  siGooglecalendar,
  siGooglesearchconsole,
  siInstagram,
  siMessenger,
  siMeta,
  siShopify,
  siWhatsapp,
  type SimpleIcon,
} from "simple-icons";

// Recognisable brand marks for channels and integrations, from simple-icons
// (CC0). Used only to identify the service a feature connects to.
// LinkedIn asked simple-icons to remove its logo, so it gets a plain
// monogram in its brand colour instead.
export type Brand =
  | "whatsapp"
  | "instagram"
  | "messenger"
  | "gmail"
  | "google_calendar"
  | "google_business"
  | "google_reviews"
  | "google_ads"
  | "search_console"
  | "linkedin"
  | "shopify"
  | "meta_ads";

const ICONS: Partial<Record<Brand, SimpleIcon>> = {
  whatsapp: siWhatsapp,
  instagram: siInstagram,
  messenger: siMessenger,
  gmail: siGmail,
  google_calendar: siGooglecalendar,
  google_business: siGoogle,
  google_reviews: siGoogle,
  google_ads: siGoogleads,
  search_console: siGooglesearchconsole,
  shopify: siShopify,
  meta_ads: siMeta,
};

export const BRAND_LABEL: Record<Brand, string> = {
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  messenger: "Messenger",
  gmail: "Gmail",
  google_calendar: "Google Agenda",
  google_business: "Google Bedrijfsprofiel",
  google_reviews: "Google Reviews",
  google_ads: "Google Ads",
  search_console: "Search Console",
  linkedin: "LinkedIn",
  shopify: "Shopify",
  meta_ads: "Meta Ads",
};

export function BrandIcon({
  brand,
  size = 18,
  title,
  className = "",
}: {
  brand: Brand;
  size?: number;
  title?: string;
  className?: string;
}) {
  const icon = ICONS[brand];
  const label = title ?? BRAND_LABEL[brand];
  if (!icon)
    return (
      <svg className={"brand-mark " + className} width={size} height={size} viewBox="0 0 24 24" role="img" aria-label={label}>
        <rect width="24" height="24" rx="4" fill="#0A66C2" />
        <text x="12" y="17" textAnchor="middle" fontSize="13" fontWeight="700" fontFamily="Arial, sans-serif" fill="#fff">
          in
        </text>
      </svg>
    );
  return (
    <svg className={"brand-mark " + className} width={size} height={size} viewBox="0 0 24 24" role="img" aria-label={label}>
      <path d={icon.path} fill={"#" + icon.hex} />
    </svg>
  );
}
