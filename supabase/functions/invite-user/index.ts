// Real admin-invite path.
//
// Why this exists: the previous "Invite User" flow called the public
// supabase.auth.signUp() API from the client. That's built for self-service
// signup, not admin-initiated invites — it sends Supabase's generic "Confirm
// your signup" template (not a real invite), and if the email was ever used
// before it silently no-ops (returns 200, sends nothing) as an anti-
// enumeration measure, with no way for the client to tell the difference.
//
// This function uses the Admin API (service-role only, never exposed to the
// browser) to call inviteUserByEmail, which sends a genuine "You've been
// invited" email and always actually attempts delivery. Authorization is
// checked server-side — a caller can only invite people into their own
// tenant, and only if they're an Exec or IT Admin there.

import { createClient } from 'jsr:@supabase/supabase-js@2'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface InvitePayload {
  email: string
  full_name: string
  phone?: string | null
  entity_id: string
  post_id: string
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS })

  try {
    const authHeader = req.headers.get('Authorization') ?? ''
    if (!authHeader) {
      return json({ error: 'Missing Authorization header' }, 401)
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // Client scoped to the CALLER's own JWT — used only to find out who's asking.
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: userData, error: userErr } = await callerClient.auth.getUser()
    if (userErr || !userData.user) {
      return json({ error: 'Invalid or expired session' }, 401)
    }

    // Service-role client — bypasses RLS, used for the actual admin operations.
    const admin = createClient(supabaseUrl, serviceRoleKey)

    const { data: callerProfile, error: profileErr } = await admin
      .from('user_profiles')
      .select('tenant_id, post_id, hierarchy_levels!post_id(rank, is_it_admin)')
      .eq('id', userData.user.id)
      .single()

    if (profileErr || !callerProfile) {
      return json({ error: 'Could not resolve caller profile' }, 403)
    }

    const level = callerProfile.hierarchy_levels as any
    const isExec = level?.rank <= 1
    const isITAdmin = level?.is_it_admin || isExec
    if (!isITAdmin) {
      return json({ error: 'Only IT Administrators and Group Executives can invite users' }, 403)
    }

    const body: InvitePayload = await req.json()
    if (!body.email || !body.full_name || !body.entity_id || !body.post_id) {
      return json({ error: 'Missing required fields' }, 400)
    }

    // Confirm the target entity + post actually belong to the CALLER's own
    // tenant — without this check, a valid JWT plus a guessed/looked-up
    // entity_id from another tenant would let someone provision a user into
    // a company they have no business touching.
    const { data: entity } = await admin.from('entities').select('id').eq('id', body.entity_id).eq('tenant_id', callerProfile.tenant_id).maybeSingle()
    const { data: post } = await admin.from('hierarchy_levels').select('id').eq('id', body.post_id).eq('tenant_id', callerProfile.tenant_id).maybeSingle()
    if (!entity || !post) {
      return json({ error: 'Entity or post does not belong to your organization' }, 403)
    }

    const origin = req.headers.get('origin') || 'https://vela.co.zw'

    const { data: invited, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(body.email, {
      data: {
        full_name: body.full_name,
        phone: body.phone || null,
        tenant_id: callerProfile.tenant_id,
        entity_id: body.entity_id,
        post_id: body.post_id,
      },
      redirectTo: `${origin}/login`,
    })

    if (inviteErr) {
      // Surface Supabase's real reason (e.g. "User already registered") instead
      // of a generic failure — this is exactly the ambiguity that made the
      // previous flow impossible to debug from the client.
      return json({ error: inviteErr.message }, 400)
    }

    // Belt-and-braces: make sure the profile row reflects the intended
    // tenant/entity/post regardless of what the on_auth_user_created trigger
    // already did with the metadata above.
    if (invited.user) {
      await admin.from('user_profiles').upsert({
        id: invited.user.id,
        email: body.email,
        full_name: body.full_name,
        phone: body.phone || null,
        tenant_id: callerProfile.tenant_id,
        entity_id: body.entity_id,
        post_id: body.post_id,
        is_active: true,
      }, { onConflict: 'id' })
    }

    return json({ success: true, user_id: invited.user?.id })
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Unknown error' }, 500)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}
