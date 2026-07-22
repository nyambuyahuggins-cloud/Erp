import { isLight, lighten, darken, hexToRgba, mixHex } from './color'

export interface Branding {
  app_name: string | null; tagline: string | null; primary_color: string | null
  secondary_color: string | null; accent_color: string | null
  logo_url: string | null; logo_storage_path: string | null
  hide_vela_branding: boolean; font_heading: string | null; font_body: string | null
}

export const BRANDING_CACHE_KEY = 'vela-branding-cache'

export function applyBranding(b: Branding) {
  const root = document.documentElement

  // Every other "gold-*" token (the gradient's dark stop, focus rings, dim
  // badge backgrounds, etc.) was previously left at its fixed default hue —
  // so picking e.g. Crimson only changed the gradient's first stop, and the
  // rest of the app (buttons, active nav state, focus rings) stayed gold/
  // orange regardless of what a tenant picked. Deriving the whole family
  // from primary_color fixes that everywhere at once.
  if (b.primary_color) {
    const primary = b.primary_color
    root.style.setProperty('--gold', primary)
    root.style.setProperty('--gold-light', lighten(primary, 0.18))
    root.style.setProperty('--gold-dark', darken(primary, 0.2))
    root.style.setProperty('--gold-dim', hexToRgba(primary, 0.08))
    root.style.setProperty('--gold-ring', hexToRgba(primary, 0.18))
    root.style.setProperty('--gold-wash', hexToRgba(primary, 0.05))
    root.style.setProperty('--gold-soft', hexToRgba(primary, 0.11))
    root.style.setProperty('--gold-border', hexToRgba(primary, 0.28))
    root.style.setProperty('--gold-strong', hexToRgba(primary, 0.4))
    root.style.setProperty('--border-gold', hexToRgba(primary, 0.25))
    // Button text: whatever primary_color a tenant picks, the label on top
    // of it needs to stay readable — a dark accent needs light text, same
    // as anywhere else we compute contrast in this function.
    root.style.setProperty('--gold-text', isLight(primary) ? '#1a1814' : '#f0ead6')
  }

  // Sidebar/BottomNav: scoped tokens so a custom Sidebar Background stays
  // readable even if it ends up a different lightness than the Page Background.
  if (b.secondary_color) {
    root.style.setProperty('--bg-850', b.secondary_color)
    const light = isLight(b.secondary_color)
    root.style.setProperty('--sidebar-text', light ? '#1a1814' : '#f0ead6')
    root.style.setProperty('--sidebar-text-muted', light ? '#7a7060' : '#7a7a96')
    root.style.setProperty('--sidebar-border', light ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)')
    root.style.setProperty('--sidebar-surface', light ? 'rgba(0,0,0,0.025)' : 'rgba(255,255,255,0.04)')
  }

  // Header + page content share --bg-900. Everything that reads the global
  // text/border/surface tokens sits on this surface, so those tokens must be
  // recomputed to match whatever color the tenant picked here — otherwise a
  // light Page Background paired with the app's default light-on-dark text
  // renders as barely-visible ghost text (exactly what happens if this block
  // only touches --bg-900 and leaves --text-primary etc. alone).
  if (b.accent_color) {
    root.style.setProperty('--bg-900', b.accent_color)
    const light = isLight(b.accent_color)
    root.style.setProperty('--text-primary', light ? '#1a1814' : '#f0ead6')
    root.style.setProperty('--text-secondary', light ? '#4a4540' : '#c4bfd4')
    root.style.setProperty('--text-muted', light ? '#7a7060' : '#7a7a96')
    root.style.setProperty('--border', light ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)')
    root.style.setProperty('--surface', light ? 'rgba(0,0,0,0.025)' : 'rgba(255,255,255,0.04)')
    root.style.setProperty('--surface-hover', light ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.07)')
    root.style.setProperty('--surface-active', light ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.10)')
    root.style.setProperty('--input-bg', light ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.05)')

    // A third, slightly-elevated surface shade (dropdown option backgrounds,
    // a couple of standalone panels) — same relationship the default theme
    // has between --bg-900 and --bg-800 (one step lighter in dark mode, one
    // step toward the ink in light mode), but computed from the tenant's own
    // color instead of independently fixed.
    root.style.setProperty('--bg-800', light ? mixHex(b.accent_color, '#000000', 0.05) : mixHex(b.accent_color, '#ffffff', 0.08))

    // Modals float in their own backdrop layer rather than sitting directly
    // on the page, so they need their own solid, contrast-safe surface — but
    // it should still visibly belong to the same palette as the rest of the
    // app, not an arbitrary fixed navy that has nothing to do with what a
    // tenant actually picked.
    root.style.setProperty('--modal-card-bg', light ? mixHex(b.accent_color, '#ffffff', 0.9) : mixHex(b.accent_color, '#ffffff', 0.12))
    root.style.setProperty('--modal-bg', light ? 'rgba(245,243,239,0.72)' : 'rgba(0,0,0,0.75)')
  }
}

/** Best-effort read of the last branding applied on this device, so we can
 *  paint with the right colors immediately on boot instead of the hardcoded
 *  defaults while the real branding is still being fetched from Supabase —
 *  that gap is exactly what showed up as a flash of the wrong (default navy)
 *  color behind the loading spinner on every cold start. */
export function applyCachedBranding() {
  try {
    const raw = localStorage.getItem(BRANDING_CACHE_KEY)
    if (raw) applyBranding(JSON.parse(raw))
  } catch {
    // corrupted cache or storage unavailable — fall through to defaults,
    // the real branding fetch will correct this shortly anyway
  }
}

export function cacheBranding(b: Branding) {
  try { localStorage.setItem(BRANDING_CACHE_KEY, JSON.stringify(b)) } catch { /* storage full/unavailable — non-critical */ }
}
