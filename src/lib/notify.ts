import { supabase } from './supabase'

export async function notify(params: {
  tenant_id: string
  user_id: string
  title: string
  body: string
  category?: string
  priority?: 'low' | 'normal' | 'high' | 'urgent'
  action_url?: string
}) {
  try {
    await supabase.from('notifications').insert({
      tenant_id: params.tenant_id,
      user_id: params.user_id,
      title: params.title,
      body: params.body,
      category: params.category || 'general',
      priority: params.priority || 'normal',
      action_url: params.action_url || null,
      is_read: false,
      created_at: new Date().toISOString(),
    })
  } catch (e) {
    console.error('Notification failed:', e)
  }
}
