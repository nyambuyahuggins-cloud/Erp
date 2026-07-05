import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, RadialBarChart, RadialBar, PolarAngleAxis,
} from 'recharts'
import { Sparkles, TrendingUp, Clock, ShieldCheck, ListChecks } from 'lucide-react'

const REQUEST_STATUS_COLORS: Record<string, string> = {
  pending: 'var(--warning)', approved: 'var(--success)', funded: 'var(--info)',
  rejected: 'var(--danger)', stale: '#6b7280', cancelled: '#6b7280',
}
const COMPLIANCE_STATUS_COLORS: Record<string, string> = {
  upcoming: 'var(--warning)', overdue: '#ef4444', completed: 'var(--success)', waived: '#6b7280',
}
const ENTITY_BAR_COLORS = ['var(--gold)', 'var(--info)', 'var(--success)', '#a78bfa', '#fb923c', 'var(--danger)']

interface InsightsData {
  requestsByStatus: { name: string; value: number; color: string }[]
  requestsByEntity: { name: string; value: number }[]
  complianceByStatus: { name: string; value: number; color: string }[]
  avgApprovalDays: number | null
  approvalRate: number | null
  avgTargetProgress: number
  activeTasks: number
  totalRequests: number
}

export default function EnterpriseInsights({ profile }: { profile: any }) {
  const [data, setData] = useState<InsightsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { if (profile) load() }, [profile])

  async function load() {
    setLoading(true)
    const tid = profile.tenant_id

    const [reqRes, compRes, taskRes, targetRes] = await Promise.all([
      supabase.from('funding_requests').select('status,created_at,approved_at,entity_id,entities!entity_id(name)').eq('tenant_id', tid),
      supabase.from('compliance_items').select('status').eq('tenant_id', tid).is('deleted_at', null),
      supabase.from('tasks').select('status').eq('tenant_id', tid),
      supabase.from('targets').select('progress').eq('tenant_id', tid),
    ])

    // Requests by status
    const statusMap: Record<string, number> = {}
    const entityMap: Record<string, number> = {}
    let approvalDaysSum = 0, approvalDaysCount = 0
    let approvedCount = 0, rejectedCount = 0
    ;(reqRes.data || []).forEach((r: any) => {
      statusMap[r.status] = (statusMap[r.status] || 0) + 1
      const entityName = r.entities?.name || 'Unassigned'
      entityMap[entityName] = (entityMap[entityName] || 0) + 1
      if (r.status === 'approved' || r.status === 'funded') approvedCount++
      if (r.status === 'rejected') rejectedCount++
      if (r.approved_at && r.created_at) {
        const days = (new Date(r.approved_at).getTime() - new Date(r.created_at).getTime()) / 86400000
        if (days >= 0) { approvalDaysSum += days; approvalDaysCount++ }
      }
    })

    // Compliance by status
    const compMap: Record<string, number> = {}
    ;(compRes.data || []).forEach((c: any) => { compMap[c.status] = (compMap[c.status] || 0) + 1 })

    // Tasks
    const tasks = taskRes.data || []
    const activeTasks = tasks.filter((t: any) => t.status === 'open' || t.status === 'inprogress').length

    // Targets
    const targets = targetRes.data || []
    const avgTargetProgress = targets.length
      ? Math.round(targets.reduce((s: number, t: any) => s + (t.progress || 0), 0) / targets.length)
      : 0

    const resolvedTotal = approvedCount + rejectedCount

    setData({
      requestsByStatus: Object.entries(statusMap).map(([name, value]) => ({
        name, value, color: REQUEST_STATUS_COLORS[name] || '#6b7280',
      })),
      requestsByEntity: Object.entries(entityMap)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 6),
      complianceByStatus: Object.entries(compMap).map(([name, value]) => ({
        name, value, color: COMPLIANCE_STATUS_COLORS[name] || '#6b7280',
      })),
      avgApprovalDays: approvalDaysCount > 0 ? approvalDaysSum / approvalDaysCount : null,
      approvalRate: resolvedTotal > 0 ? Math.round((approvedCount / resolvedTotal) * 100) : null,
      avgTargetProgress,
      activeTasks,
      totalRequests: (reqRes.data || []).length,
    })
    setLoading(false)
  }

  if (loading) {
    return (
      <div className="card" style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'center', padding: '2.5rem' }}>
        <div className="spinner" />
      </div>
    )
  }
  if (!data || data.totalRequests === 0) return null

  const kpis = [
    {
      icon: <Clock size={15} />, color: 'var(--info)',
      label: 'Avg Approval Time',
      value: data.avgApprovalDays !== null ? `${data.avgApprovalDays.toFixed(1)}d` : '—',
    },
    {
      icon: <ShieldCheck size={15} />, color: 'var(--success)',
      label: 'Approval Rate',
      value: data.approvalRate !== null ? `${data.approvalRate}%` : '—',
    },
    {
      icon: <TrendingUp size={15} />, color: 'var(--gold)',
      label: 'Avg Target Progress',
      value: `${data.avgTargetProgress}%`,
    },
    {
      icon: <ListChecks size={15} />, color: '#a78bfa',
      label: 'Active Tasks',
      value: `${data.activeTasks}`,
    },
  ]

  const radialData = [{ name: 'progress', value: data.avgTargetProgress, fill: 'var(--gold)' }]

  return (
    <div className="card" style={{
      marginBottom: '1.5rem',
      background: 'linear-gradient(135deg, var(--gold-wash), transparent 60%)',
      border: '1px solid var(--gold-ring)',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <h2 style={{ margin: 0, fontFamily: "'Playfair Display',serif", fontSize: 'var(--text-lead)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Sparkles size={16} style={{ color: 'var(--gold)' }} />
          Group Insights
        </h2>
        <span style={{
          fontSize: 'var(--text-micro)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
          padding: '2px 8px', borderRadius: 999, background: 'var(--gold-dim)',
          color: 'var(--gold)', border: '1px solid var(--border-gold)',
        }}>
          Enterprise
        </span>
      </div>

      {/* KPI strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px,1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
        {kpis.map(kpi => (
          <div key={kpi.label} style={{
            background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10,
            padding: '0.75rem 0.875rem',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: kpi.color, marginBottom: '0.375rem' }}>
              {kpi.icon}
              <span style={{ fontSize: 'var(--text-micro)', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{kpi.label}</span>
            </div>
            <p style={{ margin: 0, fontFamily: "'JetBrains Mono',monospace", fontSize: 'var(--text-h2)', fontWeight: 700, color: kpi.color }}>{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Charts grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px,1fr))', gap: '1rem' }}>

        {/* Approval pipeline donut */}
        {data.requestsByStatus.length > 0 && (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '0.875rem' }}>
            <p style={{ margin: '0 0 0.5rem', fontSize: 'var(--text-micro)', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Approval Pipeline</p>
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie data={data.requestsByStatus} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={38} outerRadius={62} paddingAngle={2}>
                  {data.requestsByStatus.map((entry, i) => <Cell key={i} fill={entry.color} stroke="none" />)}
                </Pie>
                <Tooltip contentStyle={{ background: 'var(--bg-850)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 'var(--text-micro)' }} />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', justifyContent: 'center', marginTop: '0.375rem' }}>
              {data.requestsByStatus.map(s => (
                <span key={s.name} style={{ fontSize: 'var(--text-micro)', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4, textTransform: 'capitalize' }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: s.color, display: 'inline-block' }} />
                  {s.name} ({s.value})
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Compliance health donut */}
        {data.complianceByStatus.length > 0 && (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '0.875rem' }}>
            <p style={{ margin: '0 0 0.5rem', fontSize: 'var(--text-micro)', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Compliance Health</p>
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie data={data.complianceByStatus} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={38} outerRadius={62} paddingAngle={2}>
                  {data.complianceByStatus.map((entry, i) => <Cell key={i} fill={entry.color} stroke="none" />)}
                </Pie>
                <Tooltip contentStyle={{ background: 'var(--bg-850)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 'var(--text-micro)' }} />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', justifyContent: 'center', marginTop: '0.375rem' }}>
              {data.complianceByStatus.map(s => (
                <span key={s.name} style={{ fontSize: 'var(--text-micro)', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4, textTransform: 'capitalize' }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: s.color, display: 'inline-block' }} />
                  {s.name} ({s.value})
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Target progress radial */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '0.875rem' }}>
          <p style={{ margin: '0 0 0.5rem', fontSize: 'var(--text-micro)', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Target Progress</p>
          <ResponsiveContainer width="100%" height={160}>
            <RadialBarChart cx="50%" cy="50%" innerRadius="65%" outerRadius="100%" barSize={14} data={radialData} startAngle={90} endAngle={-270}>
              <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
              <RadialBar background={{ fill: 'var(--border)' }} dataKey="value" cornerRadius={8} fill="var(--gold)" />
              <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 22, fontWeight: 700, fill: 'var(--gold)' }}>
                {data.avgTargetProgress}%
              </text>
            </RadialBarChart>
          </ResponsiveContainer>
          <p style={{ margin: '0.375rem 0 0', fontSize: 'var(--text-micro)', color: 'var(--text-muted)', textAlign: 'center' }}>Average across all active targets</p>
        </div>

        {/* Requests by entity bar */}
        {data.requestsByEntity.length > 1 && (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '0.875rem', gridColumn: data.requestsByEntity.length > 3 ? 'span 2' : undefined }}>
            <p style={{ margin: '0 0 0.5rem', fontSize: 'var(--text-micro)', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Requests by Entity</p>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={data.requestsByEntity} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} interval={0} angle={-25} textAnchor="end" height={50} />
                <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} allowDecimals={false} />
                <Tooltip contentStyle={{ background: 'var(--bg-850)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 'var(--text-micro)' }} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {data.requestsByEntity.map((_, i) => <Cell key={i} fill={ENTITY_BAR_COLORS[i % ENTITY_BAR_COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  )
}
