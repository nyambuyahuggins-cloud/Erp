// Single entry point for all data writes - routes through offline queue when offline
import { supabase } from './supabase'
import { offlineQueue } from './offlineQueue'
import { syncEngine } from './syncEngine'

export async function dbWrite(
  table: string,
  operation: 'insert' | 'update' | 'delete',
  payload: Record<string, unknown>,
  eq?: [string, string]
): Promise<{ data: any; error: any; queued: boolean }> {
  if (!navigator.onLine) {
    const id = await offlineQueue.enqueue({ table, operation, payload, eq })
    const count = await offlineQueue.count()
    // Notify sync engine listeners
    ;(syncEngine as any)['_notifyCount']?.(count)
    return { data: null, error: null, queued: true }
  }

  try {
    let result: any
    if (operation === 'insert') {
      result = await supabase.from(table).insert(payload).select()
    } else if (operation === 'update' && eq) {
      result = await supabase.from(table).update(payload).eq(eq[0], eq[1]).select()
    } else if (operation === 'delete' && eq) {
      result = await supabase.from(table).delete().eq(eq[0], eq[1])
    }
    if (result?.error) throw result.error
    return { data: result?.data, error: null, queued: false }
  } catch (e: any) {
    // If online write fails, queue for retry
    await offlineQueue.enqueue({ table, operation, payload, eq })
    return { data: null, error: e, queued: true }
  }
}
