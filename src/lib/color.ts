// WCAG relative luminance — used to decide whether a tenant's custom brand
// color needs light or dark text sitting on top of it. Without this, a
// tenant picking a near-white Sidebar/Page Background color ends up with
// the app's default dark-theme text (also light-colored) rendering nearly
// invisible on top of it.
export function relativeLuminance(hex: string): number {
  const clean = hex.replace('#', '').trim()
  const full = clean.length === 3 ? clean.split('').map(c => c + c).join('') : clean
  const r = parseInt(full.substring(0, 2), 16) / 255
  const g = parseInt(full.substring(2, 4), 16) / 255
  const b = parseInt(full.substring(4, 6), 16) / 255
  const lin = (v: number) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4))
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}

export function isLight(hex: string): boolean {
  if (!/^#?[0-9a-fA-F]{3}$|^#?[0-9a-fA-F]{6}$/.test(hex)) return false
  return relativeLuminance(hex) > 0.5
}

function toRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '').trim()
  const full = clean.length === 3 ? clean.split('').map(c => c + c).join('') : clean
  return [
    parseInt(full.substring(0, 2), 16),
    parseInt(full.substring(2, 4), 16),
    parseInt(full.substring(4, 6), 16),
  ]
}

function toHex(r: number, g: number, b: number): string {
  const c = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')
  return `#${c(r)}${c(g)}${c(b)}`
}

/** Blends `hex` toward `target` by `ratio` (0 = hex, 1 = target). Simple linear RGB mix — good enough for UI tinting, not meant for perceptual accuracy. */
export function mixHex(hex: string, target: string, ratio: number): string {
  const [r1, g1, b1] = toRgb(hex)
  const [r2, g2, b2] = toRgb(target)
  return toHex(r1 + (r2 - r1) * ratio, g1 + (g2 - g1) * ratio, b1 + (b2 - b1) * ratio)
}

export function lighten(hex: string, ratio: number): string {
  return mixHex(hex, '#ffffff', ratio)
}

export function darken(hex: string, ratio: number): string {
  return mixHex(hex, '#000000', ratio)
}

/** hex -> "r, g, b" so callers can build rgba(...) strings with their own alpha. */
export function toRgbString(hex: string): string {
  const [r, g, b] = toRgb(hex)
  return `${r}, ${g}, ${b}`
}

export function hexToRgba(hex: string, alpha: number): string {
  return `rgba(${toRgbString(hex)}, ${alpha})`
}
