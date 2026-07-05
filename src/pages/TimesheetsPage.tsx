import React, { useEffect, useState } from 'react'
import Layout from '../components/Layout'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { Clock, LogIn, LogOut } from 'lucide-react'
import { dbWrite } from '../lib/offlineWrite'
import TabBar from '../components/TabBar'

export default function TimesheetsPage() {
  const { profile, post } = useAuth()
  const [entries, setEntries] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [activeEntry, setActiveEntry] = useState<any>(null)
  const [submitting, setSubmitting] = useState(false)
  const [tab, setTab] = useState<'mine' | 'team'>('mine')
  const [weekSummary, setWeekSummary] = useState<{ total: number; days: number }>({ total: 0, days: 0 })

  const level = post?.hierarchy_levels
  const isManager = level && level.rank <= 2

  useEffect(() => { if (profile) { load(); checkActiveSession() } }, [profile, tab])

  async function load() {
    setLoading(true)
    let query = supabase.from('timesheet_entries')
      .select('*, user_profiles!user_id(full_name), entities!entity_id(name)')
      .eq('tenant_id', profile!.tenant_id)
      .order('clock_in', { ascending: false })
      .limit(50)

    if (tab === 'mine') query = query.eq('user_id', profile!.id)

    const { data } = await query
    setEntries(data || [])

    // Weekly summary for own entries
    const now = new Date()
    const startOfWeek = new Date(now)
    startOfWeek.setDate(now.getDate() - now.getDay())
    startOfWeek.setHours(0, 0, 0, 0)
    const myWeek = (data || []).filter(e =>
      e.user_id === profile!.id &&
      e.clock_out &&
      new Date(e.clock_in) >= startOfWeek
    )
    const totalHours = myWeek.reduce((sum, e) => sum + (parseFloat(e.hours_worked) || 0), 0)
    const uniqueDays = new Set(myWeek.map(e => new Date(e.clock_in).toDateString())).size
    setWeekSummary({ total: totalHours, days: uniqueDays })
    setLoading(false)
  }

  async function checkActiveSession() {
    const { data } = await supabase.from('timesheet_entries')
      .select('*').eq('user_id', profile!.id).is('clock_out', null).limit(1)
    setActiveEntry(data?.[0] || null)
  }

  async function clockIn() {
    setSubmitting(true)
    await supabase.from('timesheet_entries').insert({
      tenant_id: profile!.tenant_id,
      user_id: profile!.id,
      entity_id: profile!.entity_id,
      clock_in: new Date().toISOString(),
      status: 'pending'
    })
    await checkActiveSession()
    load()
    setSubmitting(false)
  }

  async function clockOut() {
    if (!activeEntry) return
    setSubmitting(true)
    await supabase.from('timesheet_entries').update({ clock_out: new Date().toISOString() }).eq('id', activeEntry.id)
    setActiveEntry(null)
    load()
    setSubmitting(false)
  }

  async function approveEntry(id: string) {
    await supabase.from('timesheet_entries').update({ status: 'approved', approved_by: profile!.id, approved_at: new Date().toISOString() }).eq('id', id)
    load()
  }

  function formatHours(h: number | null) {
    if (!h) return '—'
    const hrs = Math.floor(h)
    const mins = Math.round((h - hrs) * 60)
    return `${hrs}h ${mins}m`
  }

  function formatTime(ts: string) {
    return new Date(ts).toLocaleTimeString('en-ZW', { hour: '2-digit', minute: '2-digit' })
  }

  function formatDate(ts: string) {
    return new Date(ts).toLocaleDateString('en-ZW', { day: 'numeric', month: 'short' })
  }

  return (
    <Layout title="Timesheets">
      {/* Clock in/out card */}
      <div className="card" style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <p style={{ margin: 0, fontSize: 'var(--text-micro)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
            {activeEntry ? 'Currently Clocked In' : 'Not Clocked In'}
          </p>
          {activeEntry && (
            <p style={{ margin: '0.25rem 0 0', fontSize: 'var(--text-small)', color: 'var(--gold)' }}>
              Since {formatTime(activeEntry.clock_in)} · {formatDate(activeEntry.clock_in)}
            </p>
          )}
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <div style={{ textAlign: 'right' }}>
            <p style={{ margin: 0, fontSize: 'var(--text-micro)', color: 'var(--text-muted)' }}>This week</p>
            <p style={{ margin: 0, fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: 'var(--text-primary)' }}>
              {formatHours(weekSummary.total)} · {weekSummary.days} days
            </p>
          </div>
          {activeEntry ? (
            <button className="btn-ghost" onClick={clockOut} disabled={submitting}
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', borderColor: 'var(--danger)', color: 'var(--danger)' }}>
              <LogOut size={15} /> Clock Out
            </button>
          ) : (
            <button className="btn-gold" onClick={clockIn} disabled={submitting}
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <LogIn size={15} /> Clock In
            </button>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <TabBar>
          <button className={`tab ${tab === 'mine' ? 'active' : ''}`} onClick={() => setTab('mine')}>My Entries</button>
          {isManager && <button className={`tab ${tab === 'team' ? 'active' : ''}`} onClick={() => setTab('team')}>Team</button>}
        </TabBar>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}><div className="spinner" /></div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  {tab === 'team' && <th>Employee</th>}
                  <th>Date</th>
                  <th>Clock In</th>
                  <th>Clock Out</th>
                  <th>Hours</th>
                  <th>Status</th>
                  {isManager && tab === 'team' && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {entries.length === 0 ? (
                  <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>No timesheet entries</td></tr>
                ) : entries.map(e => (
                  <tr key={e.id}>
                    {tab === 'team' && <td style={{ fontWeight: 500 }}>{e.user_profiles?.full_name}</td>}
                    <td style={{ color: 'var(--text-muted)' }}>{formatDate(e.clock_in)}</td>
                    <td style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 'var(--text-small)' }}>{formatTime(e.clock_in)}</td>
                    <td style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 'var(--text-small)', color: e.clock_out ? 'var(--text-primary)' : 'var(--gold)' }}>
                      {e.clock_out ? formatTime(e.clock_out) : '⏳ Active'}
                    </td>
                    <td style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, color: 'var(--gold)' }}>
                      {formatHours(e.hours_worked ? parseFloat(e.hours_worked) : null)}
                    </td>
                    <td>
                      <span className={`badge ${e.status === 'approved' ? 'badge-approved' : e.status === 'rejected' ? 'badge-rejected' : 'badge-pending'}`}>
                        {e.status}
                      </span>
                    </td>
                    {isManager && tab === 'team' && (
                      <td>
                        {e.status === 'pending' && e.clock_out && (
                          <button className="btn-gold" style={{ padding: '0.3rem 0.7rem', fontSize: 'var(--text-micro)' }} onClick={() => approveEntry(e.id)}>
                            Approve
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Layout>
  )
}
