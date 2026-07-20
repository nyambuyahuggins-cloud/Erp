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
