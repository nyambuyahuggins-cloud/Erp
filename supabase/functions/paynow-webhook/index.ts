// PayNow calls this URL directly (server-to-server) once a payment
// completes or fails — this is the ONLY place that should ever mark a
// payment as actually paid. The browser-side returnurl is just where the
// person's browser lands after PayNow's checkout page; it carries no
// guarantee the payment succeeded, so it must never be trusted to update
// billing state on its own.
//
// Anyone can POST to this URL, so the hash check below is the only thing
// standing between "PayNow says this was paid" and "someone curled this
// endpoint claiming a payment happened." Never skip it.

import { createClient } from 'jsr:@supabase/supabase-js@2'
import { crypto } from 'jsr:@std/crypto'
import { encodeHex } from 'jsr:@std/encoding/hex'

async function md5Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input)
  const digest = await crypto.subtle.digest('MD5', data)
  return encodeHex(new Uint8Array(digest)).toUpperCase()
}

Deno.serve(async (req: Request) => {
  try {
    const paynowKey = Deno.env.get('PAYNOW_INTEGRATION_KEY')
    if (!paynowKey) return new Response('PayNow not configured', { status: 500 })

    const raw = await req.text()
    const params = new URLSearchParams(raw)
    const received = Object.fromEntries(params)
    const receivedHash = received.hash
    if (!receivedHash) return new Response('Missing hash', { status: 400 })

    const withoutHash = { ...received }
    delete withoutHash.hash
    const expectedHash = await md5Hex(Object.values(withoutHash).join('') + paynowKey)

    if (expectedHash !== receivedHash.toUpperCase()) {
      // Do not touch any payment record on a bad hash — this is exactly the
      // scenario the hash check exists to catch.
      return new Response('Invalid hash', { status: 401 })
    }

    const reference = received.reference
    const status = (received.status || '').toLowerCase()
    if (!reference) return new Response('Missing reference', { status: 400 })

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const admin = createClient(supabaseUrl, serviceRoleKey)

    const { data: payment } = await admin.from('payments').select('*').eq('reference', reference).maybeSingle()
    if (!payment) return new Response('Unknown reference', { status: 404 })

    const newStatus = status === 'paid' ? 'paid' : status === 'cancelled' ? 'cancelled' : status === 'failed' ? 'failed' : payment.status

    await admin.from('payments').update({
      status: newStatus,
      paynow_reference: received.paynowreference || payment.paynow_reference,
      raw_result: received,
      updated_at: new Date().toISOString(),
    }).eq('id', payment.id)

    if (newStatus === 'paid') {
      const paidUntil = new Date()
      paidUntil.setDate(paidUntil.getDate() + 31) // monthly cycle; annual billing is handled separately in the plan-selection flow
      await admin.from('tenants').update({
        plan: payment.plan,
        plan_confirmed: true,
        plan_paid_until: paidUntil.toISOString(),
      }).eq('id', payment.tenant_id)
    }

    // PayNow expects a plain 200 OK — anything else and it will keep retrying.
    return new Response('OK', { status: 200 })
  } catch (e) {
    console.error('paynow-webhook error', e)
    return new Response('Internal error', { status: 500 })
  }
})
