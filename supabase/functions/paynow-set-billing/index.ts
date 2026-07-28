// DEPRECATED — no longer part of the billing design.
//
// This function originally captured an EcoCash number / card choice ahead
// of automatic recurring charging. That design was dropped in favor of a
// manual-payment model: plan_paid_until in the tenants table is the single
// source of truth, checked client-side by PayNowGate.tsx, with no
// auto-charge attempts at all. See paynow-initiate for the actual (manual,
// person-clicks-a-button) checkout flow.
//
// Left deployed (rather than deleted, which isn't available via this
// project's tooling) as an inert stub so nothing breaks if anything old
// still references it, and so the history of why it exists is visible to
// whoever looks at it next.
Deno.serve(async () => new Response(JSON.stringify({ error: 'This endpoint is deprecated. Billing is now manual — see paynow-initiate.' }), { status: 410, headers: { 'Content-Type': 'application/json' } }))
