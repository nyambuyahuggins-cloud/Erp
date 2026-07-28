// DEPRECATED — no longer part of the billing design.
//
// This was meant to be the daily cron job driving automatic recurring
// charges (EcoCash push notifications + card auto-charge). Dropped in favor
// of a manual-payment model with no scheduled charge attempts at all —
// see paynow-webhook and PayNowGate.tsx. Never actually wired to a pg_cron
// schedule, so this was never live in practice.
//
// Left deployed (rather than deleted, which isn't available via this
// project's tooling) as an inert stub.
Deno.serve(async () => new Response(JSON.stringify({ error: 'This endpoint is deprecated and was never scheduled. Billing is manual — see paynow-webhook.' }), { status: 410, headers: { 'Content-Type': 'application/json' } }))
