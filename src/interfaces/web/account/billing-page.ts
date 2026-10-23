import type { BillingState } from '../../../accounts/billing/billing.ts';
import { htmlDocument, NOTICE_HEADERS } from '../page-html.ts';

const PLAN_LABELS: Readonly<Record<BillingState['plan'], string>> = { free: 'Free' };

// Billing has no write operation in the free plan.
export function billingPage(state: BillingState): Response {
  return new Response(htmlDocument('Billing', [
    `<p>Plan: ${PLAN_LABELS[state.plan]}</p>`,
    `<p>Billed seats: ${state.billedSeats}</p>`,
    '<p>This service collects no payment. The organization is on the free plan, and no seat is billed. Access depends only on the grants of each member.</p>',
  ]), { status: 200, headers: NOTICE_HEADERS });
}
