import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { syncEngine } from '../lib/syncEngine'
import { parseUserAgent } from '../lib/deviceInfo'
import type { Plan } from '../lib/planEnforcement'
import { applyBranding, cacheBranding, type Branding } from '../lib/branding'

export interface Profile {
  id: string; tenant_id: string; full_name: string; entity_id: string | null
  post_id: string | null; phone: string | null; avatar_url: string | null
  is_active: boolean; active_entity_id: string | null; active_entity_switched_at: string | null
  demo_plan?: string | null
}
export interface HierarchyLevel {
  id: string; name: string; rank: number; can_approve: boolean; can_endorse: boolean
  can_set_targets: boolean; can_assign_tasks: boolean; can_see_budgets: boolean
  can_see_hierarchy: boolean; petty_cash_limit: number; dual_approval_threshold: number
  is_accounting: boolean; is_hr: boolean; is_it_admin: boolean
}
export interface Post {
  id: string; title: string; level_id: string; entity_id: string
  hierarchy_levels: HierarchyLevel
}
export interface RoleAssignment {
  post_id: string; is_primary: boolean
  posts: Post
}
export interface Tenant {
  id: string; name: string; plan: Plan; plan_employee_limit: number
  plan_branch_limit: number; white_label_enabled: boolean; api_enabled: boolean
  supported_currencies: string[]; currency_base: string; color_mode: string
  petty_cash_limit: number; dual_approval_threshold: number
  plan_confirmed: boolean; subdomain: string | null
}
interface AuthContextType {
  session: Session | null; user: User | null; profile: Profile | null
  post: Post | null; tenant: Tenant | null; branding: Branding | null; loading: boolean
  roleAssignments: RoleAssignment[]
  activeEntityId: string | null
  effectivePlan: Plan
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>
  signInWithPasskey: () => Promise<{ error: Error | null }>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
  refreshBranding: () => Promise<void>
  switchEntity: (entityId: string) => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const DEFAULT_BRANDING: Branding = {
  app_name: 'VELA', tagline: 'COMMAND YOUR GROUP', primary_color: '#d4a84b',
  secondary_color: '#16213e', accent_color: '#0f0f23',
  logo_url: null, logo_storage_path: null,
  hide_vela_branding: false, font_heading: 'Playfair Display', font_body: 'DM Sans'
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [post, setPost] = useState<Post | null>(null)
  const [roleAssignments, setRoleAssignments] = useState<RoleAssignment[]>([])
  const [tenant, setTenant] = useState<Tenant | null>(null)
  const [branding, setBranding] = useState<Branding | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeEntityId, setActiveEntityId] = useState<string | null>(null)

  const fetchBranding = useCallback(async (tenantId: string, entityId?: string | null) => {
    // Load tenant-level branding base
    const { data } = await supabase.from('tenant_branding').select('*').eq('tenant_id', tenantId).single()
    const base: Branding = data ? {
      app_name: data.app_name || 'VELA',
      tagline: data.tagline || 'COMMAND YOUR GROUP',
      primary_color: data.primary_color || '#d4a84b',
      secondary_color: data.secondary_color || '#16213e',
      accent_color: data.accent_color || '#0f0f23',
      logo_storage_path: data.logo_storage_path || null,
      logo_url: data.logo_storage_path
        ? supabase.storage.from('vela-logos').getPublicUrl(data.logo_storage_path).data.publicUrl
        : null,
      hide_vela_branding: data.hide_vela_branding || false,
      font_heading: data.font_heading || 'Playfair Display',
      font_body: data.font_body || 'DM Sans',
    } : { ...DEFAULT_BRANDING }

    // If entity has its own branding, layer it on top (entity overrides tenant)
    if (entityId) {
      const { data: eb } = await supabase
        .from('entities')
        .select('app_name,tagline,logo_url,logo_path,primary_color,secondary_color,accent_color,font_heading,font_body,hide_holding_branding,name')
        .eq('id', entityId).single()
      if (eb) {
        if (eb.app_name)          base.app_name          = eb.app_name
        else if (eb.hide_holding_branding) base.app_name  = eb.name  // use entity name, not holding name
        if (eb.tagline)           base.tagline            = eb.tagline
        if (eb.logo_url)          base.logo_url           = eb.logo_url
        if (eb.primary_color)     base.primary_color      = eb.primary_color
        if (eb.secondary_color)   base.secondary_color    = eb.secondary_color
        if (eb.accent_color)      base.accent_color       = eb.accent_color
        if (eb.font_heading)      base.font_heading       = eb.font_heading
        if (eb.font_body)         base.font_body          = eb.font_body
        if (eb.hide_holding_branding) base.hide_vela_branding = true
      }
    }

    setBranding(base)
    applyBranding(base)
    cacheBranding(base)
  }, [])

  const fetchProfile = useCallback(async (userId: string) => {
    try {
      const { data: profileData } = await supabase.from('user_profiles').select('*').eq('id', userId).single()
      if (!profileData) return
      setProfile(profileData)
      const resolvedEntityId = profileData.active_entity_id || profileData.entity_id
      setActiveEntityId(resolvedEntityId)

      // Load every role this user holds (across entities), then use whichever
      // one applies to the currently active entity — falling back to their
      // primary post if they don't hold a distinct role there. This is what
      // makes rank/permissions entity-aware: switching entities (which
      // already reloads the app) re-resolves this from scratch.
      const { data: assignments } = await supabase.from('user_role_assignments')
        .select('post_id, is_primary, posts!post_id(id, title, level_id, entity_id, hierarchy_levels(*))')
        .eq('user_id', userId)
      const roleList = (assignments || []) as unknown as RoleAssignment[]
      setRoleAssignments(roleList)

      const forEntity = roleList.find(a => a.posts?.entity_id === resolvedEntityId)
      if (forEntity?.posts) {
        setPost(forEntity.posts)
      } else if (profileData.post_id) {
        const { data: postData } = await supabase.from('posts').select('*, hierarchy_levels(*)').eq('id', profileData.post_id).single()
        if (postData) setPost(postData as Post)
      }

      const { data: tenantData } = await supabase.from('tenants')
        .select('id,name,plan,plan_employee_limit,plan_branch_limit,white_label_enabled,api_enabled,supported_currencies,currency_base,color_mode,petty_cash_limit,dual_approval_threshold,plan_confirmed,subdomain')
        .eq('id', profileData.tenant_id).single()
      if (tenantData) setTenant(tenantData as Tenant)
      await fetchBranding(profileData.tenant_id, profileData.active_entity_id || profileData.entity_id)
    } catch (e) { console.error('fetchProfile error', e) }
  }, [fetchBranding])

  const refreshProfile = useCallback(async () => { if (user) await fetchProfile(user.id) }, [user, fetchProfile])
  const refreshBranding = useCallback(async () => {
    if (profile) await fetchBranding(profile.tenant_id, activeEntityId || profile.entity_id)
  }, [profile, activeEntityId, fetchBranding])

  const switchEntity = useCallback(async (entityId: string) => {
    if (!profile) return
    setActiveEntityId(entityId)
    await supabase.from('user_profiles').update({ active_entity_id: entityId, active_entity_switched_at: new Date().toISOString() }).eq('id', profile.id)
    // Reload the app so all page-level data fetches re-run against the new entity
    window.location.reload()
  }, [profile])

  useEffect(() => {
    let mounted = true
    syncEngine.init()
    // Safety timeout — if auth check hangs on mobile (poor network), stop loading after 8s
    const loadingTimeout = setTimeout(() => { if (mounted) setLoading(false) }, 8000)
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (!mounted) return
      clearTimeout(loadingTimeout)
      setSession(s); setUser(s?.user ?? null)
      if (s?.user) { fetchProfile(s.user.id).finally(() => { if (mounted) setLoading(false) }) }
      else setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      if (!mounted) return
      setSession(s); setUser(s?.user ?? null)
      if (s?.user) { fetchProfile(s.user.id) }
      else { setProfile(null); setPost(null); setTenant(null); setBranding(null); setActiveEntityId(null) }
    })
    return () => { mounted = false; subscription.unsubscribe() }
  }, [fetchProfile])

  // Shared by both password and passkey sign-in — logs the attempt and
  // creates/enforces the session record so both paths behave identically
  // (passkey sign-ins previously would have bypassed session tracking and
  // the 2-session limit entirely if wired up separately).
  const trackSuccessfulLogin = async (userId: string, email: string | null) => {
    if (email) supabase.from('login_attempts').insert({ email, success: true }).then(() => {}, () => {})
    try {
      const { data: prof } = await supabase.from('user_profiles').select('tenant_id').eq('id', userId).single()
      if (!prof) return
      const { device_type, browser, os } = parseUserAgent(navigator.userAgent)
      await supabase.from('user_sessions').insert({
        tenant_id: prof.tenant_id, user_id: userId,
        session_token: crypto.randomUUID(),
        device_type, browser, os,
        is_current: true,
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      })
      const { data: active } = await supabase.from('user_sessions')
        .select('id, created_at').eq('user_id', userId).is('invalidated_at', null)
        .order('created_at', { ascending: false })
      if (active && active.length > 2) {
        const toInvalidate = active.slice(2).map(s => s.id)
        await supabase.from('user_sessions').update({
          invalidated_at: new Date().toISOString(), invalidated_reason: 'session_limit',
        }).in('id', toInvalidate)
      }
    } catch { /* session tracking is best-effort, never block login on it */ }
  }

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    supabase.from('login_attempts').insert({ email, success: !error }).then(() => {}, () => {})
    if (!error && data.user) await trackSuccessfulLogin(data.user.id, data.user.email ?? email)
    return { error }
  }

  const signInWithPasskey = async () => {
    const { data, error } = await supabase.auth.signInWithPasskey()
    if (!error && data?.user) await trackSuccessfulLogin(data.user.id, data.user.email ?? null)
    return { error }
  }

  const signOut = async () => {
    if (typeof window !== 'undefined') sessionStorage.removeItem('vela_demo_tier')
    await supabase.auth.signOut()
    setProfile(null); setPost(null); setTenant(null); setBranding(null); setActiveEntityId(null)
  }

  // effectivePlan resolution:
  //   1. profile.demo_plan  – set on the three main demo@ accounts
  //   2. sessionStorage 'vela_demo_tier'  – persisted across persona switches within demo tenant
  //   3. tenant.plan  – real plan for production users
  const DEMO_TENANT_ID = '00000000-0000-0000-0000-000000000001'
  const storedDemoTier = (
    profile?.tenant_id === DEMO_TENANT_ID && typeof window !== 'undefined'
      ? (sessionStorage.getItem('vela_demo_tier') as Plan | null)
      : null
  )
  const effectivePlan: Plan = (
    (profile?.demo_plan as Plan | undefined) || storedDemoTier || tenant?.plan || 'starter'
  ) as Plan

  return (
    <AuthContext.Provider value={{ session, user, profile, post, tenant, branding, loading, activeEntityId, roleAssignments,
      effectivePlan,
      signIn, signInWithPasskey, signOut, refreshProfile, refreshBranding, switchEntity }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
