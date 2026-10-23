import { BrandHub } from "@/components/brand-hub/brand-hub";
import "../../brand-hub.css";

// Brand Hub. The old address /bedrijfsprofiel redirects here; this page must
// never point back to it (that made the page empty: a redirect to itself).
export default function BrandHubPage() {
  return <BrandHub />;
}
