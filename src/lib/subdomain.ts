import { supabase } from './supabase'

// The production domain — update when pointing DNS
export const ROOT_DOMAIN = 'vela.co.zw'
// Netlify staging / preview URL (exact match — no subdomain extraction here)
const MAIN_HOSTS = [
  'velab2b.netlify.app',
  'vela.co.zw',
  'www.vela.co.zw',
  'localhost',
  '127.0.0.1',
]

/**
 * Reads window.location.hostname and returns the subdomain slug,
 * or null if the user is on the main/staging domain.
 *
 * helikon.vela.co.zw  → 'helikon'
 * vela.co.zw          → null
 * velab2b.netlify.app → null
 * localhost           → null
 */
export function detectSubdomain(): string | null {
  if (typeof window === 'undefined') return null
  const host = window.location.hostname
  if (MAIN_HOSTS.some(h => host === h)) return null
  if (host.endsWith('.netlify.app')) return null   // preview deploys

  // Extract first segment: 'helikon' from 'helikon.vela.co.zw'
  const parts = host.split('.')
  if (parts.length < 3) return null
  const slug = parts[0].toLowerCase()
  return slug || null
}

/**
 * Convert a company name to a URL-safe slug.
 * "Helikon Group" → "helikon-group"
 * "BuildRight Construction Ltd" → "buildright-construction-ltd"
 */
export function toSubdomainSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')  // strip accents
    .replace(/[^a-z0-9]+/g, '-')                        // non-alphanumeric → dash
    .replace(/^-+|-+$/g, '')                            // trim leading/trailing dashes
    .slice(0, 50)
}

/** Public lookup — works without a user session (used on the login page) */
export async function getTenantBySubdomain(slug: string) {
  const { data, error } = await supabase.rpc('get_tenant_by_subdomain', { p_subdomain: slug })
  if (error || !data?.length) return null
  return data[0] as {
    id: string; name: string; plan: string
    app_name: string; logo_url: string | null
    brand_color: string | null; hide_branding: boolean
  }
}

/** Check if a slug is available for the given tenant (not taken by another) */
export async function isSubdomainAvailable(slug: string, tenantId: string): Promise<boolean> {
  const { data } = await supabase.rpc('subdomain_available', {
    p_subdomain: slug,
    p_tenant_id: tenantId,
  })
  return !!data
}

/** Full subdomain URL for a tenant */
export function subdomainUrl(slug: string): string {
  return `https://${slug}.${ROOT_DOMAIN}`
}
