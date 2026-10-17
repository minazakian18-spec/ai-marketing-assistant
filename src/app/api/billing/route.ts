import { NextResponse } from "next/server";
import { z } from "zod";
import { workspace, failure, sameOrigin, limited, audit, HttpError } from "@/lib/server/access";
import { adminClient, appUrl } from "@/lib/server/supabase";
import { stripe, priceId } from "@/lib/server/billing";
import { billingState, checkoutAllowed, INTERVALS, PLANS } from "@/lib/billing-state";

// Subscription and invoices (owners only). Payments are OFF until the owner
// sets BILLING_CHECKOUT_ENABLED=1: Mavix is not being sold yet, and beta
// workspaces must never be charged by accident. Checkout uses the payment
// methods enabled in the Stripe dashboard (card, iDEAL via SEPA Direct Debit
// for recurring payments, Bancontact...). Subscription state only changes
// from Stripe's signed webhook, never from the browser.

const headers = { "Cache-Control": "no-store" };
const enabled = () => process.env.BILLING_CHECKOUT_ENABLED === "1" && !!process.env.STRIPE_SECRET_KEY;
const yearlyConfigured = () => PLANS.every((p) => !!process.env[`STRIPE_PRICE_${p.toUpperCase()}_YEAR`]);

async function approved(workspaceId: string) {
  const { data } = await adminClient().from("workspaces").select("access_status").eq("id", workspaceId).maybeSingle();
  return !data?.access_status || data.access_status === "approved";
}

export async function GET() {
  try {
    const auth = await workspace(["OWNER"]);
    const { data, error } = await adminClient().from("subscriptions").select("*").eq("workspace_id", auth.workspaceId).maybeSingle();
    if (error) throw error;
    let invoices: { number: string | null; date: number; amount: number; currency: string; status: string | null; url: string | null; pdf: string | null }[] = [];
    let invoiceError = false;
    if (data?.provider_customer_id && process.env.STRIPE_SECRET_KEY) {
      try {
        const list = await stripe().invoices.list({ customer: data.provider_customer_id, limit: 24 });
        invoices = list.data.map((i) => ({ number: i.number, date: i.created, amount: i.total, currency: i.currency, status: i.status ?? null, url: i.hosted_invoice_url ?? null, pdf: i.invoice_pdf ?? null }));
      } catch {
        invoiceError = true;
      }
    }
    const subscription = data ? { plan: data.plan, status: data.status, billing_interval: data.billing_interval, current_period_end: data.current_period_end } : null;
    const state = billingState(subscription);
    return NextResponse.json(
      {
        subscription,
        state,
        invoices,
        invoiceError,
        configured: !!process.env.STRIPE_SECRET_KEY,
        checkout: checkoutAllowed({ enabled: enabled(), approved: await approved(auth.workspaceId), state }),
        portal: !!data?.provider_customer_id && !!process.env.STRIPE_SECRET_KEY,
        // Yearly billing only when every yearly Stripe price is configured.
        yearly: yearlyConfigured(),
      },
      { headers },
    );
  } catch (e) {
    return failure(e);
  }
}

const input = z.union([
  z.object({ action: z.literal("portal") }),
  z.object({ action: z.literal("checkout"), plan: z.enum(PLANS), interval: z.enum(INTERVALS) }),
]);

export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const auth = await workspace(["OWNER"]);
    await limited("billing:" + auth.user.id, 5);
    const body = input.parse(await request.json());
    if (!process.env.STRIPE_SECRET_KEY) throw new HttpError(503, "Betalen is in Mavix nog niet ingericht.");
    const db = adminClient(),
      client = stripe();
    const { data: existing, error } = await db.from("subscriptions").select("*").eq("workspace_id", auth.workspaceId).maybeSingle();
    if (error) throw error;
    let subscription = existing;

    if (body.action === "portal") {
      if (!subscription?.provider_customer_id) throw new HttpError(409, "Er is nog geen betaalaccount voor deze werkruimte.");
      const session = await client.billingPortal.sessions.create({ customer: subscription.provider_customer_id, return_url: appUrl() + "/account/facturatie" });
      return NextResponse.json({ url: session.url }, { headers });
    }

    const state = billingState(subscription ? { plan: subscription.plan, status: subscription.status, billing_interval: subscription.billing_interval, current_period_end: subscription.current_period_end } : null);
    if (!checkoutAllowed({ enabled: enabled(), approved: await approved(auth.workspaceId), state }))
      throw new HttpError(409, state === "beta" || state === "canceled" ? "Betaalde abonnementen zijn nog niet open. Je werkruimte blijft in de beta zonder kosten." : "Beheer je bestaande abonnement via het betaalportaal.");
    if (body.interval === "year" && !yearlyConfigured()) throw new HttpError(409, "Jaarlijks betalen is nog niet beschikbaar. Kies maandelijks.");
    const price = (() => {
      try {
        return priceId(body.plan, body.interval);
      } catch {
        throw new HttpError(503, "Dit plan is in Mavix nog niet ingericht.");
      }
    })();
    if (!subscription?.provider_customer_id) {
      const customer = await client.customers.create({ email: auth.user.email, metadata: { workspace_id: auth.workspaceId } }, { idempotencyKey: "workspace-customer-" + auth.workspaceId });
      const result = await db.from("subscriptions").upsert({ workspace_id: auth.workspaceId, provider_customer_id: customer.id }, { onConflict: "workspace_id" }).select().single();
      if (result.error) throw result.error;
      subscription = result.data;
    }
    const session = await client.checkout.sessions.create(
      {
        mode: "subscription",
        customer: subscription!.provider_customer_id,
        line_items: [{ price, quantity: 1 }],
        // No payment_method_types: Stripe offers the methods enabled in the dashboard (incl. iDEAL/SEPA).
        billing_address_collection: "required",
        tax_id_collection: { enabled: true },
        customer_update: { address: "auto", name: "auto" },
        client_reference_id: auth.workspaceId,
        subscription_data: { metadata: { workspace_id: auth.workspaceId, plan: body.plan } },
        success_url: appUrl() + "/account/facturatie?betaling=bezig",
        cancel_url: appUrl() + "/account/facturatie?betaling=geannuleerd",
      },
      { idempotencyKey: "checkout-" + auth.workspaceId + "-" + price + "-" + Math.floor(Date.now() / 600000) },
    );
    await audit(auth.workspaceId, auth.user.id, "billing_checkout_started").catch(() => {});
    return NextResponse.json({ url: session.url }, { headers });
  } catch (e) {
    if (e instanceof z.ZodError) return failure(new HttpError(400, "Kies een geldig plan en een geldige periode."));
    return failure(e);
  }
}
