// PayNow Zimbabwe checkout initiation.
//
// This was previously just credentials sitting in config with nothing built
// on top of them — no table, no function, no way to actually take a payment.
// This function creates the transaction with PayNow and returns the URL to
// redirect the browser to. paynow-webhook (the resulturl PayNow POSTs back
// to) is what actually confirms payment and updates the tenant's plan.
//
// PayNow's hash scheme: concatenate the VALUES of every field in the exact
// order they're sent in the request body, append the Integration Key, MD5,
// uppercase hex. Their side reconstructs the hash the same way from the
// fields as received, so consistency between what we hash and what we send
// (same values, same order) is what actually matters here.

import { createClient } from 'jsr:@supabase/supabase-js@2'
import { crypto } from 'jsr:@std/crypto'
import { encodeHex } from 'jsr:@std/encoding/hex'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Matches the pricing already established for the product (see memory /
// PlanSelectPage.tsx) — kept here as the source of truth for what a plan
// actually costs, since the client should never be the one telling the
// server how much to charge itself.
const PLAN_PRICES: Record<string, number> = { starter: 49, group: 199, enterprise: 399 }

async function md5Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input)
  const digest = await crypto.subtle.digest('MD5', data)
  return encodeHex(new Uint8Array(digest)).toUpperCase()
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS })

  try {
    const authHeader = req.headers.get('Authorization') ?? ''
    if (!authHeader) return json({ error: 'Missing Authorization header' }, 401)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const paynowId = Deno.env.get('PAYNOW_INTEGRATION_ID')
    const paynowKey = Deno.env.get('PAYNOW_INTEGRATION_KEY')

    if (!paynowId || !paynowKey) {
      return json({ error: 'PayNow is not configured on this project yet (missing PAYNOW_INTEGRATION_ID / PAYNOW_INTEGRATION_KEY secrets).' }, 500)
    }

    const callerClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } })
    const { data: userData, error: userErr } = await callerClient.auth.getUser()
    if (userErr || !userData.user) return json({ error: 'Invalid or expired session' }, 401)

    const admin = createClient(supabaseUrl, serviceRoleKey)

    const { data: callerProfile, error: profileErr } = await admin
      .from('user_profiles')
      .select('tenant_id, email, posts!post_id(hierarchy_levels!level_id(rank))')
      .eq('id', userData.user.id)
      .single()
    if (profileErr || !callerProfile) return json({ error: 'Could not resolve caller profile' }, 403)

    const isExec = ((callerProfile.posts as any)?.hierarchy_levels as any)?.rank <= 1
    if (!isExec) return json({ error: 'Only Group Executives can manage billing' }, 403)

    const body = await req.json()
    const plan = body.plan as string
    if (!PLAN_PRICES[plan]) return json({ error: 'Unknown plan' }, 400)

    const amount = PLAN_PRICES[plan]
    const reference = `VELA-${callerProfile.tenant_id.slice(0, 8)}-${Date.now()}`
    const origin = req.headers.get('origin') || 'https://vela.co.zw'

    const fields: Record<string, string> = {
      id: paynowId,
      reference,
      amount: amount.toFixed(2),
      additionalinfo: `VELA ${plan} plan subscription`,
      returnurl: `${origin}/admin?paynow_return=${reference}`,
      resulturl: `${supabaseUrl}/functions/v1/paynow-webhook`,
      authemail: callerProfile.email || '',
      status: 'Message',
    }
    const hashInput = Object.values(fields).join('') + paynowKey
    const hash = await md5Hex(hashInput)

    const form = new URLSearchParams({ ...fields, hash })
    const paynowRes = await fetch('https://www.paynow.co.zw/interface/initiatetransaction', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    })
    const resText = await paynowRes.text()
    const resParams = new URLSearchParams(resText)
    const status = resParams.get('status')

    if (status?.toLowerCase() !== 'ok') {
      return json({ error: resParams.get('error') || 'PayNow rejected the request', raw: resText }, 400)
    }

    const browserurl = resParams.get('browserurl')
    const pollurl = resParams.get('pollurl')

    await admin.from('payments').insert({
      tenant_id: callerProfile.tenant_id,
      reference, plan, amount, currency: 'USD',
      status: 'sent', poll_url: pollurl,
      initiated_by: userData.user.id,
      raw_result: Object.fromEntries(resParams),
    })

    return json({ success: true, browserurl, reference })
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Unknown error' }, 500)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } })
}
