import { workspace, failure } from "@/lib/server/access";
import { GET as health } from "../health/route";

// All integrations in one call (status, health, last real check). Same data
// as /api/integrations/health; the per-provider status routes remain for the
// detail cards. Signed-in members only.
export async function GET() {
  try {
    await workspace();
    return await health();
  } catch (e) {
    return failure(e);
  }
}
