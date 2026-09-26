import 'server-only';
import Stripe from 'stripe';
export function stripe(){if(!process.env.STRIPE_SECRET_KEY)throw new Error('BILLING_SETUP_REQUIRED');return new Stripe(process.env.STRIPE_SECRET_KEY);}
export function priceId(plan:string,interval:string){if(!['starter','growth','autopilot'].includes(plan)||!['month','year'].includes(interval))throw new Error('INVALID_PLAN');const id=process.env[`STRIPE_PRICE_${plan.toUpperCase()}_${interval.toUpperCase()}`];if(!id)throw new Error('PRICE_SETUP_REQUIRED');return id;}
