// Lightweight UA parsing for the Active Sessions list — good enough for
// "Desktop · Chrome · Windows" style labels without pulling in a dependency.
export function parseUserAgent(ua: string) {
  const isTablet = /iPad|Tablet/i.test(ua)
  const isMobile = !isTablet && /Mobile|Android|iPhone/i.test(ua)
  const device_type = isTablet ? 'Tablet' : isMobile ? 'Mobile' : 'Desktop'

  let browser = 'Browser'
  if (/Edg\//.test(ua)) browser = 'Edge'
  else if (/OPR\//.test(ua)) browser = 'Opera'
  else if (/Chrome\//.test(ua) && !/Chromium/.test(ua)) browser = 'Chrome'
  else if (/Firefox\//.test(ua)) browser = 'Firefox'
  else if (/Safari\//.test(ua)) browser = 'Safari'

  let os = 'Unknown OS'
  if (/Windows/.test(ua)) os = 'Windows'
  else if (/Mac OS X/.test(ua)) os = 'macOS'
  else if (/Android/.test(ua)) os = 'Android'
  else if (/iPhone|iPad|iOS/.test(ua)) os = 'iOS'
  else if (/Linux/.test(ua)) os = 'Linux'

  return { device_type, browser, os }
}
