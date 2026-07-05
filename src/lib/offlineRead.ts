/**
 * offlineRead — wraps a Supabase query with IndexedDB cache.
 *
 * When online  → runs the query, stores result in IDB, returns fresh data.
 * When offline → skips the query, returns whatever is in IDB (may be stale).
 *
 * Usage:
 *   const rows = await offlineRead('leave_requests:user123', () =>
 *     supabase.from('leave_requests').select('*').eq('requester_id', profile.id)
 *   )
 */
import { offlineQueue } from './offlineQueue'

// Default TTL: 30 minutes (data is usable offline for this long)
const DEFAULT_TTL = 30 * 60 * 1000

export async function offlineRead<T = any[]>(
  cacheKey: string,
  queryFn: () => PromiseLike<{ data: T | null; error: any }>,
  ttlMs = DEFAULT_TTL
): Promise<T | null> {
  if (navigator.onLine) {
    try {
      const { data, error } = await queryFn()
      if (!error && data !== null) {
        // Store fresh result - fire-and-forget, don't block the return
        offlineQueue.cacheSet(cacheKey, data, ttlMs).catch(() => {})
        return data
      }
    } catch {
      // network error even though onLine — fall through to cache
    }
  }

  // Offline (or network error) — return cached data
  const cached = await offlineQueue.cacheGet<T>(cacheKey)
  return cached ?? null
}
