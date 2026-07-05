import React, { useEffect, useState } from 'react'
import Layout from '../components/Layout'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { Download } from 'lucide-react'

const COLORS = ['var(--gold)', 'var(--info)', 'var(--success)', 'var(--danger)', '#a78bfa', '#fb923c']

export default function AnalyticsPage({ embedded }: { embedded?: boolean }) {
  const { profile, post } = useAuth()
  const [entities, setEntities] = useState<any[]>([])
  const [requestStats, setRequestStats] = useState<any[]>([])
  const [budgetStats, setBudgetStats] = useState<any[]>([])
  const [headcount, setHeadcount] = useState<any[]>([])
  const [targetStats, setTargetStats] = useState<any>({ total: 0, completed: 0, avg: 0 })
  const [loading, setLoading] = useState(true)

  const level = post?.hierarchy_levels
  const isExec = level && level.rank <= 1
  if (!isExec) {
    const msg = <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>Executive access only.</div>
    return embedded ? msg : <Layout title="Analytics">{msg}</Layout>
  }

  useEffect(() => { if (profile) load() }, [profile])

  async function load() {
    setLoading(true)
    const tid = profile!.tenant_id

    const [entRes, reqRes, budRes, userRes, tgtRes] = await Promise.all([
      supabase.from('entities').select('id,name,entity_type').eq('tenant_id', tid).eq('is_active', true),
      supabase.from('funding_requests').select('entity_id, amount, status, entities!entity_id(name)').eq('tenant_id', tid),
      supabase.from('budget_pools').select('entity_id, total_amount, used_amount, entities!entity_id(name)').eq('tenant_id', tid),
      supabase.from('user_profiles').select('entity_id, entities!entity_id(name)').eq('tenant_id', tid).eq('is_active', true),
      supabase.from('targets').select('progress, manager_confirmed').eq('tenant_id', tid)
    ])

    setEntities(entRes.data || [])

    // Request stats per entity
    const reqMap: Record<string, any> = {}
    ;(reqRes.data || []).forEach(r => {
      const name = (r as any).entities?.name || 'Unknown'
      if (!reqMap[name]) reqMap[name] = { name, total: 0, approved: 0, pending: 0, amount: 0 }
      reqMap[name].total++
      if (r.status === 'approved' || r.status === 'funded') reqMap[name].approved++
      if (r.status === 'pending') reqMap[name].pending++
      reqMap[name].amount += parseFloat(r.amount)
    })
    setRequestStats(Object.values(reqMap))

    // Budget utilisation
    const budMap: Record<string, any> = {}
    ;(budRes.data || []).forEach(b => {
      const name = (b as any).entities?.name || 'Unknown'
      if (!budMap[name]) budMap[name] = { name, total: 0, used: 0 }
      budMap[name].total += parseFloat(b.total_amount)
      budMap[name].used += parseFloat(b.used_amount)
    })
    setBudgetStats(Object.values(budMap).map(b => ({ ...b, utilisation: b.total > 0 ? Math.round((b.used / b.total) * 100) : 0 })))

    // Headcount per entity
    const hcMap: Record<string, number> = {}
    ;(userRes.data || []).forEach(u => {
      const name = (u as any).entities?.name || 'Unknown'
      hcMap[name] = (hcMap[name] || 0) + 1
    })
    setHeadcount(Object.entries(hcMap).map(([name, count]) => ({ name, count })))

    // Target stats
    const tgts = tgtRes.data || []
    const avg = tgts.length ? Math.round(tgts.reduce((s, t) => s + t.progress, 0) / tgts.length) : 0
    setTargetStats({ total: tgts.length, completed: tgts.filter(t => t.progress >= 100).length, avg })

    setLoading(false)
  }

  async function exportPDF() {
    const { default: jsPDF } = await import('jspdf')
    const doc = new jsPDF()
    const now = new Date().toLocaleDateString('en-ZW', { day: 'numeric', month: 'long', year: 'numeric' })

    doc.setFontSize(20)
    doc.setTextColor(212, 168, 75)
    doc.text('VELA — Consolidated Report', 20, 20)
    doc.setFontSize(10)
    doc.setTextColor(140, 140, 160)
    doc.text(`Generated: ${now}`, 20, 28)

    let y = 42
    doc.setFontSize(13)
    doc.setTextColor(240, 234, 214)
    doc.text('Group Overview', 20, y); y += 8

    doc.setFontSize(10)
    doc.setTextColor(180, 180, 200)
    doc.text(`Total Entities: ${entities.length}`, 20, y); y += 6
    doc.text(`Total Headcount: ${headcount.reduce((s, h) => s + h.count, 0)}`, 20, y); y += 6
    doc.text(`Targets — Avg Progress: ${targetStats.avg}% (${targetStats.completed}/${targetStats.total} completed)`, 20, y); y += 12

    doc.setFontSize(13)
    doc.setTextColor(240, 234, 214)
    doc.text('Funding Requests by Entity', 20, y); y += 8

    doc.setFontSize(9)
    requestStats.forEach(r => {
      doc.setTextColor(180, 180, 200)
      doc.text(`${r.name}: ${r.total} requests | Approved: ${r.approved} | Pending: ${r.pending} | Total: USD ${r.amount.toFixed(2)}`, 20, y)
      y += 6
    })

    y += 6
    doc.setFontSize(13)
    doc.setTextColor(240, 234, 214)
    doc.text('Budget Utilisation', 20, y); y += 8

    budgetStats.forEach(b => {
      doc.setFontSize(9)
      doc.setTextColor(180, 180, 200)
      doc.text(`${b.name}: USD ${b.total.toFixed(2)} allocated | USD ${b.used.toFixed(2)} used (${b.utilisation}%)`, 20, y)
      y += 6
    })

    y += 6
    doc.setFontSize(13)
    doc.setTextColor(240, 234, 214)
    doc.text('Headcount', 20, y); y += 8
    headcount.forEach(h => {
      doc.setFontSize(9)
      doc.setTextColor(180, 180, 200)
      doc.text(`${h.name}: ${h.count} employee(s)`, 20, y); y += 6
    })

    doc.save(`vela-consolidated-${new Date().toISOString().slice(0, 10)}.pdf`)
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null
    return (
      <div style={{ background: 'var(--bg-850)', border: '1px solid var(--border-gold)', borderRadius: 8, padding: '0.75rem', fontSize: 'var(--text-small)', boxShadow: 'var(--shadow-2)' }}>
        <p style={{ margin: '0 0 0.25rem', color: 'var(--gold)', fontWeight: 600 }}>{label}</p>
        {payload.map((p: any, i: number) => <p key={i} style={{ margin: 0, color: p.color }}>{p.name}: {p.value}</p>)}
      </div>
    )
  }

  const inner = (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1.25rem' }}>
        <button className="btn-ghost" onClick={exportPDF} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Download size={15} /> Export Consolidated PDF
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '3rem' }}><div className="spinner" /></div>
      ) : (
        <>
          {/* Summary stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '0.875rem', marginBottom: '1.5rem' }}>
            {[
              { label: 'Entities', value: entities.length, color: 'var(--gold)' },
              { label: 'Total Headcount', value: headcount.reduce((s, h) => s + h.count, 0), color: 'var(--info)' },
              { label: 'Total Targets', value: targetStats.total, color: '#a78bfa' },
              { label: 'Avg Target Progress', value: `${targetStats.avg}%`, color: 'var(--success)' },
              { label: 'Targets Complete', value: targetStats.completed, color: '#34d399' },
              { label: 'Total Requests', value: requestStats.reduce((s, r) => s + r.total, 0), color: 'var(--warning)' },
            ].map((s, i) => (
              <div key={i} className="stat-card">
                <p style={{ margin: '0 0 0.375rem', fontSize: 'var(--text-micro)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{s.label}</p>
                <p style={{ margin: 0, fontFamily: "'JetBrains Mono', monospace", fontSize: 'var(--text-h2)', fontWeight: 700, color: s.color }}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* Charts */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
            {/* Requests by entity */}
            <div className="card">
              <h4 style={{ margin: '0 0 1rem', fontSize: 'var(--text-small)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Requests by Entity</h4>
              {requestStats.length === 0 ? <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '1rem' }}>No data</p> : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={requestStats} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
                    <XAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="approved" name="Approved" fill="var(--success)" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="pending" name="Pending" fill="var(--warning)" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Headcount distribution */}
            <div className="card">
              <h4 style={{ margin: '0 0 1rem', fontSize: 'var(--text-small)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Headcount Distribution</h4>
              {headcount.length === 0 ? <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '1rem' }}>No data</p> : (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={headcount} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, percent }: any) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`} labelLine={false}
                      style={{ fontSize: 10 }}>
                      {headcount.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Budget utilisation */}
            <div className="card">
              <h4 style={{ margin: '0 0 1rem', fontSize: 'var(--text-small)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Budget Utilisation %</h4>
              {budgetStats.length === 0 ? <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '1rem' }}>No data</p> : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={budgetStats} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
                    <XAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} domain={[0, 100]} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="utilisation" name="Used %" fill="var(--gold)" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Request amounts */}
            <div className="card">
              <h4 style={{ margin: '0 0 1rem', fontSize: 'var(--text-small)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Request Amounts (USD)</h4>
              {requestStats.length === 0 ? <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '1rem' }}>No data</p> : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={requestStats} margin={{ top: 0, right: 10, left: -10, bottom: 0 }}>
                    <XAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="amount" name="USD" fill="var(--info)" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </>
      )}
    </>
  )

  if (embedded) return inner
  return <Layout title="Analytics">{inner}</Layout>
}
