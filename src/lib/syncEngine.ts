import { supabase } from './supabase'
import { offlineQueue, QueuedOperation } from './offlineQueue'

export type SyncStatus = 'idle' | 'syncing' | 'error' | 'offline'

type SyncListener = (status: SyncStatus, pendingCount: number) => void

const listeners = new Set<SyncListener>()
let syncStatus: SyncStatus = navigator.onLine ? 'idle' : 'offline'
let isSyncing = false

function notify(status: SyncStatus, count: number) {
  syncStatus = status
  listeners.forEach(fn => fn(status, count))
}

export const syncEngine = {
  getStatus: () => syncStatus,

  subscribe(fn: SyncListener) {
    listeners.add(fn)
    return () => listeners.delete(fn)
  },

  // Public entry point for other modules (e.g. offlineWrite.ts) to push a
  // status/count update to every subscriber — e.g. the header sync badge.
  notify(status: SyncStatus, count: number) {
    notify(status, count)
  },

  async getPendingCount(): Promise<number> {
    return offlineQueue.count()
  },

  async sync(): Promise<{ synced: number; errors: number }> {
    if (isSyncing || !navigator.onLine) return { synced: 0, errors: 0 }

    isSyncing = true
    const pending = await offlineQueue.getPending()

    if (pending.length === 0) {
      isSyncing = false
      notify('idle', 0)
      return { synced: 0, errors: 0 }
    }

    notify('syncing', pending.length)
    let synced = 0
    let errors = 0

    for (const op of pending) {
      if (op.retries >= 3) {
        // Give up after 3 retries - mark as permanently failed
        await offlineQueue.markError(op.id, 'Max retries exceeded')
        errors++
        continue
      }

      const result = await executeSyncOp(op)
      if (result.success) {
        await offlineQueue.markSynced(op.id)
        synced++
      } else {
        await offlineQueue.markError(op.id, result.error || 'Unknown error')
        errors++
      }
    }

    await offlineQueue.clearSynced()
    const remaining = await offlineQueue.count()

    notify(remaining > 0 ? 'error' : 'idle', remaining)
    isSyncing = false

    return { synced, errors }
  },

  init() {
    window.addEventListener('online', async () => {
      notify('idle', await offlineQueue.count())
      // Small delay to let network stabilise
      setTimeout(() => this.sync(), 1500)
    })

    window.addEventListener('offline', async () => {
      notify('offline', await offlineQueue.count())
    })

    // Initial status
    offlineQueue.count().then(count => {
      notify(navigator.onLine ? 'idle' : 'offline', count)
    })
  }
}

async function executeSyncOp(op: QueuedOperation): Promise<{ success: boolean; error?: string }> {
  try {
    let result

    if (op.operation === 'insert') {
      result = await supabase.from(op.table).insert(op.payload)
    } else if (op.operation === 'update' && op.eq) {
      result = await supabase.from(op.table).update(op.payload).eq(op.eq[0], op.eq[1])
    } else if (op.operation === 'delete' && op.eq) {
      result = await supabase.from(op.table).delete().eq(op.eq[0], op.eq[1])
    } else {
      return { success: false, error: 'Invalid operation' }
    }

    if (result.error) {
      return { success: false, error: result.error.message }
    }

    return { success: true }
  } catch (e: unknown) {
    return { success: false, error: e instanceof Error ? e.message : 'Unknown error' }
  }
}

// Offline-aware write: queue if offline, execute directly if online
export async function offlineWrite(
  table: string,
  operation: 'insert' | 'update' | 'delete',
  payload: Record<string, unknown>,
  eq?: [string, string]
): Promise<{ queued: boolean; error?: string }> {
  if (navigator.onLine) {
    try {
      let result
      if (operation === 'insert') {
        result = await supabase.from(table).insert(payload)
      } else if (operation === 'update' && eq) {
        result = await supabase.from(table).update(payload).eq(eq[0], eq[1])
      } else if (operation === 'delete' && eq) {
        result = await supabase.from(table).delete().eq(eq[0], eq[1])
      }
      if (result?.error) {
        throw result.error
      }
      return { queued: false }
    } catch (e: unknown) {
      // If online write fails, queue it
      await offlineQueue.enqueue({ table, operation, payload, eq })
      return { queued: true, error: e instanceof Error ? e.message : 'Write failed, queued for retry' }
    }
  } else {
    await offlineQueue.enqueue({ table, operation, payload, eq })
    // Update pending count for all listeners
    const count = await offlineQueue.count()
    listeners.forEach(fn => fn('offline', count))
    return { queued: true }
  }
}
