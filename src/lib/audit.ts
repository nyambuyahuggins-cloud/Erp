import { supabase } from './supabase'

export interface AuditEntry {
  tenant_id: string
  actor_id: string
  entity_type: string
  entity_id: string
  entity_name?: string
  action: string
  before_snapshot?: Record<string, unknown>
  after_snapshot?: Record<string, unknown>
  ip_address?: string
  user_agent?: string
  subsidiary_context?: string
  session_id?: string
  is_impersonation?: boolean
  impersonated_by?: string
  metadata?: Record<string, unknown>
}

export async function writeAudit(entry: AuditEntry): Promise<void> {
  try {
    await supabase.from('audit_log').insert({
      ...entry,
      user_agent: entry.user_agent ?? navigator.userAgent.slice(0, 300),
      device_info: {
        platform: navigator.platform,
        language: navigator.language,
        screen: `${screen.width}x${screen.height}`,
      }
    })
  } catch (e) {
    // Audit writes should never break the main flow
    console.error('Audit write failed:', e)
  }
}

// Convenience wrappers for common actions
export const audit = {
  submitted: (base: Omit<AuditEntry, 'action'>) => writeAudit({ ...base, action: 'submitted' }),
  approved: (base: Omit<AuditEntry, 'action'>) => writeAudit({ ...base, action: 'approved' }),
  rejected: (base: Omit<AuditEntry, 'action'>) => writeAudit({ ...base, action: 'rejected' }),
  updated: (base: Omit<AuditEntry, 'action'>) => writeAudit({ ...base, action: 'updated' }),
  deleted: (base: Omit<AuditEntry, 'action'>) => writeAudit({ ...base, action: 'deleted' }),
  restored: (base: Omit<AuditEntry, 'action'>) => writeAudit({ ...base, action: 'restored' }),
  exported: (base: Omit<AuditEntry, 'action'>, format: string) => writeAudit({ ...base, action: `exported_${format}` }),
  login: (base: Omit<AuditEntry, 'action'>) => writeAudit({ ...base, action: 'login' }),
  logout: (base: Omit<AuditEntry, 'action'>) => writeAudit({ ...base, action: 'logout' }),
  contextSwitch: (base: Omit<AuditEntry, 'action'>) => writeAudit({ ...base, action: 'context_switch' }),
  bulkAction: (base: Omit<AuditEntry, 'action'>, type: string) => writeAudit({ ...base, action: `bulk_${type}` }),
}
