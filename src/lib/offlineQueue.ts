import { openDB, IDBPDatabase } from 'idb'

export type QueuedOperation = {
  id: string
  table: string
  operation: 'insert' | 'update' | 'delete'
  payload: Record<string, unknown>
  eq?: [string, string]  // [column, value] for updates/deletes
  timestamp: number
  retries: number
  synced: boolean
  error?: string
}

const DB_NAME = 'vela-offline'
const DB_VERSION = 1

let dbPromise: Promise<IDBPDatabase> | null = null

function getDB(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('queue')) {
          const store = db.createObjectStore('queue', { keyPath: 'id' })
          store.createIndex('by_synced', 'synced')
          store.createIndex('by_timestamp', 'timestamp')
        }
        if (!db.objectStoreNames.contains('cache')) {
          db.createObjectStore('cache', { keyPath: 'key' })
        }
      },
    })
  }
  return dbPromise
}

export const offlineQueue = {
  async enqueue(op: Omit<QueuedOperation, 'id' | 'timestamp' | 'retries' | 'synced'>): Promise<string> {
    const db = await getDB()
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`
    const item: QueuedOperation = { ...op, id, timestamp: Date.now(), retries: 0, synced: false }
    await db.put('queue', item)
    return id
  },

  async getPending(): Promise<QueuedOperation[]> {
    const db = await getDB()
    const all = await db.getAll('queue')
    return all.filter(op => !op.synced).sort((a, b) => a.timestamp - b.timestamp)
  },

  async markSynced(id: string): Promise<void> {
    const db = await getDB()
    const item = await db.get('queue', id)
    if (item) {
      item.synced = true
      await db.put('queue', item)
    }
  },

  async markError(id: string, error: string): Promise<void> {
    const db = await getDB()
    const item = await db.get('queue', id)
    if (item) {
      item.retries += 1
      item.error = error
      await db.put('queue', item)
    }
  },

  async count(): Promise<number> {
    const db = await getDB()
    const all = await db.getAll('queue')
    return all.filter(op => !op.synced).length
  },

  async clearSynced(): Promise<void> {
    const db = await getDB()
    const all = await db.getAll('queue')
    const synced = all.filter(op => op.synced)
    for (const item of synced) {
      await db.delete('queue', item.id)
    }
  },

  // Cache layer for offline reads
  async cacheSet(key: string, data: unknown, ttlMs = 5 * 60 * 1000): Promise<void> {
    const db = await getDB()
    await db.put('cache', { key, data, expiresAt: Date.now() + ttlMs })
  },

  async cacheGet<T>(key: string): Promise<T | null> {
    const db = await getDB()
    const item = await db.get('cache', key)
    if (!item) return null
    if (Date.now() > item.expiresAt) {
      await db.delete('cache', key)
      return null
    }
    return item.data as T
  },

  async cacheClear(prefix?: string): Promise<void> {
    const db = await getDB()
    const all = await db.getAllKeys('cache') as string[]
    for (const key of all) {
      if (!prefix || key.startsWith(prefix)) {
        await db.delete('cache', key)
      }
    }
  }
}
