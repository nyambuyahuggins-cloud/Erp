import React, { useEffect, useState } from 'react'
import Layout from '../components/Layout'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'
import { FileText, CheckSquare, Target, Clock, AlertTriangle, Bell, WifiOff, Megaphone, Calendar, ChevronRight } from 'lucide-react'
import { syncEngine, SyncStatus } from '../lib/syncEngine'
import { offlineQueue } from '../lib/offlineQueue'
import { OfflineBanner } from '../components/AppPrompts'
import EnterpriseInsights from '../components/EnterpriseInsights'
import { SkeletonStatGrid, SkeletonCard } from '../components/ui/Skeleton'
import { useNoticesTray } from '../contexts/NoticesTrayContext'

export default function DashboardPage() {
  const { profile, post, tenant, effectivePlan } = useAuth()
  const navigate = useNavigate()
  const { openTray } = useNoticesTray()
  const level = post?.hierarchy_levels
  const canSeeFinance = !!(level?.can_see_budgets || level?.is_accounting || (level && level.rank <= 1))
  const [stats, setStats] = useState({ pendingRequests:0, openTasks:0, activeTargets:0, pendingLeave:0, complianceDue:0 })
  const [financeStats, setFinanceStats] = useState<{
    totalRequested: number; totalApproved: number; totalPending: number; totalFunded: number
    byEntity: { name: string; amount: number }[]; byWeek: { label: string; amount: number }[]
  } | null>(null)
  const [recentRequests, setRecentRequests] = useState<any[]>([])
  const [notices, setNotices] = useState<any[]>([])
  const [compliance, setCompliance] = useState<any[]>([])
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(syncEngine.getStatus())
  const [syncQueueLen, setSyncQueueLen] = useState(0)
  const [loading, setLoading] = useState(true)

  const isNewTenant = !loading && stats.pendingRequests === 0 && stats.openTasks === 0 && stats.activeTargets === 0

  useEffect(() => {
    const unsub = syncEngine.subscribe((s, count) => { setSyncStatus(s); setSyncQueueLen(count) })
    return () => { unsub() }
  }, [])

  useEffect(() => { if (profile) loadAll() }, [profile])

  async function loadAll() {
    setLoading(true)
    const tid = profile!.tenant_id
    const uid = profile!.id
    const cacheKey = `dashboard:${tid}:${uid}`

    if (!navigator.onLine) {
      const c = await offlineQueue.cacheGet<any>(cacheKey)
      if (c) { setStats(c.stats); setRecentRequests(c.recent || []); setNotices(c.notices || []); setCompliance(c.compliance || []) }
      setLoading(false); return
    }

    const [reqRes, taskRes, targetRes, leaveRes, compCountRes, recentRes, noticeRes, compRes] = await Promise.all([
      supabase.from('funding_requests').select('id', { count:'exact', head:true }).eq('tenant_id', tid).eq('status','pending'),
      supabase.from('tasks').select('id', { count:'exact', head:true }).eq('tenant_id', tid).eq('assigned_to', uid).in('status',['open','inprogress']),
      supabase.from('targets').select('id', { count:'exact', head:true }).eq('tenant_id', tid).eq('assigned_to', uid).lt('progress',100),
      supabase.from('leave_requests').select('id', { count:'exact', head:true }).eq('tenant_id', tid).eq('status','pending'),
      supabase.from('compliance_items').select('id', { count:'exact', head:true }).eq('tenant_id', tid).is('deleted_at', null).in('status',['upcoming','overdue']),
      supabase.from('funding_requests').select('ref,amount,status,category,created_at').eq('tenant_id', tid).order('created_at', { ascending:false }).limit(5),
      supabase.from('notice_board_posts').select('*, user_profiles!posted_by(full_name)').eq('tenant_id', tid).is('deleted_at', null).or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`).order('created_at', { ascending:false }).limit(3),
      supabase.from('compliance_items').select('*, user_profiles!responsible_id(full_name)').eq('tenant_id', tid).is('deleted_at', null).in('status',['upcoming','overdue']).order('due_date').limit(5),
    ])
    const statsData = { pendingRequests:reqRes.count||0, openTasks:taskRes.count||0, activeTargets:targetRes.count||0, pendingLeave:leaveRes.count||0, complianceDue:compCountRes.count||0 }
    const recent = recentRes.data || []
    const noticeData = noticeRes.data || []
    const compData = compRes.data || []
    setStats(statsData); setRecentRequests(recent); setNotices(noticeData); setCompliance(compData)
    offlineQueue.cacheSet(cacheKey, { stats:statsData, recent, notices:noticeData, compliance:compData }).catch(()=>{})

    if (canSeeFinance) {
      const since = new Date(); since.setDate(since.getDate() - 56) // 8 weeks of trend data
      const { data: allRequests } = await supabase.from('funding_requests')
        .select('amount, status, entity_id, created_at, entities!entity_id(name)')
        .eq('tenant_id', tid).neq('status', 'rejected').gte('created_at', since.toISOString())

      const rows = allRequests || []
      const totalRequested = rows.reduce((s, r) => s + parseFloat(r.amount), 0)
      const totalApproved = rows.filter(r => r.status === 'approved').reduce((s, r) => s + parseFloat(r.amount), 0)
      const totalPending = rows.filter(r => r.status === 'pending' || r.status === 'endorsed').reduce((s, r) => s + parseFloat(r.amount), 0)
      const totalFunded = rows.filter(r => r.status === 'funded').reduce((s, r) => s + parseFloat(r.amount), 0)

      const entityTotals = new Map<string, number>()
      for (const r of rows) {
        const name = (r as any).entities?.name || 'Unassigned'
        entityTotals.set(name, (entityTotals.get(name) || 0) + parseFloat(r.amount))
      }
      const byEntity = [...entityTotals.entries()].map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount)

      const weekTotals = new Map<string, number>()
      for (const r of rows) {
        const d = new Date(r.created_at)
        const weekStart = new Date(d); weekStart.setDate(d.getDate() - d.getDay())
        const label = weekStart.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
        weekTotals.set(label, (weekTotals.get(label) || 0) + parseFloat(r.amount))
      }
      const byWeek = [...weekTotals.entries()].map(([label, amount]) => ({ label, amount })).slice(-8)

      setFinanceStats({ totalRequested, totalApproved, totalPending, totalFunded, byEntity, byWeek })
    }
    setLoading(false)
  }

  const statCards = [
    { label: 'Pending Requests', value: stats.pendingRequests,   icon: <FileText   size={16}/>, color: 'var(--warning)',  bgColor: 'var(--warning-dim)',  path: '/requests' },
    { label: 'Open Tasks',       value: stats.openTasks,         icon: <CheckSquare size={16}/>,color: 'var(--info)',     bgColor: 'var(--info-dim)', path: '/work' },
    { label: 'Active Targets',   value: stats.activeTargets,     icon: <Target     size={16}/>, color: 'var(--success)',  bgColor: 'var(--success-dim)', path: '/work' },
    { label: 'Leave Pending',    value: stats.pendingLeave,      icon: <Clock      size={16}/>, color: '#a78bfa',         bgColor: 'rgba(167,139,250,0.1)',path: '/hr' },
    { label: 'Compliance Due',   value: stats.complianceDue,    icon: <AlertTriangle size={16}/>, color: 'var(--danger)', bgColor: 'var(--danger-dim)',path: '/notices#compliance' },
  ]

  return (
    <Layout title={`Welcome back${profile?.full_name ? ', ' + profile.full_name.split(' ')[0] : ''}`}>
      <OfflineBanner />

      {/* Sync status */}
      {syncQueueLen > 0 && (
        <div style={{ background:'var(--gold-dim)', border:'1px solid var(--gold-ring)', borderRadius:8, padding:'0.625rem 1rem', marginBottom:'1rem', display:'flex', alignItems:'center', gap:'0.625rem', fontSize:'0.8rem', color:'var(--gold)' }}>
          <Bell size={14}/> {syncQueueLen} change(s) queued and will sync when online.
        </div>
      )}

      {/* Onboarding empty state */}
      {isNewTenant && (
        <div className="card" style={{ marginBottom:'1.5rem', border:'1px solid var(--gold-border)', background:'var(--gold-wash)' }}>
          <div style={{ display:'flex', alignItems:'flex-start', gap:'1rem' }}>
            <div style={{ fontSize:'2rem', flexShrink:0 }}>🚀</div>
            <div style={{ flex:1 }}>
              <h3 style={{ fontFamily:"'Playfair Display',serif", margin:'0 0 0.5rem', color:'var(--text-primary)' }}>Welcome to VELA</h3>
              <p style={{ color:'var(--text-muted)', fontSize:'var(--text-small)', margin:'0 0 1rem', lineHeight:1.6 }}>
                Your workspace is ready. Here's how to get started:
              </p>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(200px,1fr))', gap:'0.75rem' }}>
                {[
                  { label:'Set up your group',    desc:'Add subsidiary companies and branches',     path:'/group',    icon:'🏢' },
                  { label:'Invite your team',     desc:'Add staff and assign roles in Admin',       path:'/admin',    icon:'👥' },
                  { label:'Configure approvals',  desc:'Set your approval thresholds or rules',     path:'/admin',    icon:'✅' },
                ].map(step => (
                  <button key={step.label} onClick={() => navigate(step.path)}
                    style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:10, padding:'0.875rem', cursor:'pointer', textAlign:'left', display:'flex', gap:'0.625rem', alignItems:'flex-start', transition:'border-color 0.15s' }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor='var(--gold)')}
                    onMouseLeave={e => (e.currentTarget.style.borderColor='var(--border)')}>
                    <span style={{ fontSize:'1rem', flexShrink:0, marginTop:1 }}>{step.icon}</span>
                    <div>
                      <p style={{ margin:0, fontWeight:600, fontSize:'var(--text-small)', color:'var(--text-primary)' }}>{step.label}</p>
                      <p style={{ margin:'2px 0 0', fontSize:'var(--text-micro)', color:'var(--text-muted)' }}>{step.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stat cards — skeleton while loading */}
      {loading ? <SkeletonStatGrid count={6} /> : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(150px,1fr))', gap:'var(--sp-4)', marginBottom:'var(--sp-6)' }}>
          {statCards.map(card => (
            <button key={card.label} onClick={() => card.path.startsWith('/notices') ? openTray(card.path.includes('compliance') ? 'compliance' : 'notices') : navigate(card.path)}
              className="stat-card"
              aria-label={`${card.label}: ${card.value}`}
              style={{ cursor:'pointer', textAlign:'left', width:'100%', border:'none', fontFamily:'inherit' }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'var(--sp-4)' }}>
                <div className="icon-wrap-sm" style={{ background: card.bgColor, color: card.color }}>
                  {card.icon}
                </div>
                {card.value > 0 && (
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: card.color, flexShrink: 0 }} />
                )}
              </div>
              <p style={{ margin:'0 0 var(--sp-1)', fontFamily:"'Playfair Display',serif", fontSize:'var(--text-h2)', fontWeight:700, color: card.value > 0 ? card.color : 'var(--text-muted)', lineHeight:1 }}>
                {card.value}
              </p>
              <p style={{ margin:0, fontSize:'var(--text-micro)', color:'var(--text-muted)', lineHeight:1.4 }}>{card.label}</p>
            </button>
          ))}
        </div>
      )}

      {canSeeFinance && financeStats && (
        <div className="card" style={{ marginBottom: 'var(--sp-6)' }}>
          <h3 style={{ margin: '0 0 var(--sp-4)', fontSize: 'var(--text-small)', fontWeight: 600, color: 'var(--text-primary)' }}>
            Finance Summary <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: 'var(--text-micro)' }}>· last 8 weeks</span>
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px,1fr))', gap: 'var(--sp-4)', marginBottom: 'var(--sp-5)' }}>
            {[
              { label: 'Total Requested', value: financeStats.totalRequested, color: 'var(--text-primary)' },
              { label: 'Awaiting Funds', value: financeStats.totalApproved, color: 'var(--gold)' },
              { label: 'Pending Decision', value: financeStats.totalPending, color: 'var(--warning)' },
              { label: 'Funded', value: financeStats.totalFunded, color: 'var(--success)' },
            ].map(f => (
              <div key={f.label}>
                <p style={{ margin: 0, fontFamily: "'JetBrains Mono', monospace", fontSize: 'var(--text-lead)', fontWeight: 700, color: f.color }}>
                  USD {f.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </p>
                <p style={{ margin: '2px 0 0', fontSize: 'var(--text-micro)', color: 'var(--text-muted)' }}>{f.label}</p>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px,1fr))', gap: 'var(--sp-6)' }}>
            {financeStats.byEntity.length > 0 && (
              <div>
                <p style={{ margin: '0 0 0.6rem', fontSize: 'var(--text-micro)', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>By Entity</p>
                {financeStats.byEntity.slice(0, 6).map(e => {
                  const max = financeStats.byEntity[0].amount || 1
                  return (
                    <div key={e.name} style={{ marginBottom: '0.5rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-micro)', marginBottom: 2 }}>
                        <span style={{ color: 'var(--text-primary)' }}>{e.name}</span>
                        <span style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-muted)' }}>USD {e.amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                      </div>
                      <div style={{ height: 4, borderRadius: 2, background: 'var(--surface)' }}>
                        <div style={{ height: '100%', width: `${(e.amount / max) * 100}%`, background: 'var(--gold)', borderRadius: 2 }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {financeStats.byWeek.length > 0 && (
              <div>
                <p style={{ margin: '0 0 0.6rem', fontSize: 'var(--text-micro)', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>By Week</p>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 80 }}>
                  {financeStats.byWeek.map(w => {
                    const max = Math.max(...financeStats.byWeek.map(x => x.amount)) || 1
                    return (
                      <div key={w.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }} title={`${w.label}: USD ${w.amount.toLocaleString()}`}>
                        <div style={{ width: '100%', height: Math.max(3, (w.amount / max) * 64), background: 'var(--gold)', borderRadius: '3px 3px 0 0' }} />
                        <span style={{ fontSize: '0.55rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{w.label}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {effectivePlan === 'enterprise' && <EnterpriseInsights profile={profile} />}

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(300px,1fr))', gap:'var(--sp-5)' }}>
        {/* Recent Requests */}
        <div className="card" style={{ padding:0, overflow:'hidden' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'var(--sp-4) var(--sp-5) var(--sp-3)', borderBottom:'1px solid var(--border)' }}>
            <h3 style={{ margin:0, fontSize:'var(--text-small)', fontWeight:600, display:'flex', alignItems:'center', gap:6, color:'var(--text-primary)' }}><FileText size={13} style={{ color:'var(--text-muted)' }}/>Recent Requests</h3>
            <button className="btn-ghost" style={{ padding:'0.2rem var(--sp-2)', fontSize:'var(--text-micro)' }} onClick={() => navigate('/requests')}>View all <ChevronRight size={11}/></button>
          </div>
          {loading
            ? <div style={{ padding:'0.75rem 1.25rem' }}>{[1,2,3].map(i=><SkeletonCard key={i} lines={2} />)}</div>
            : recentRequests.length === 0
            ? <div style={{ padding:'1.5rem', textAlign:'center', color:'var(--text-muted)', fontSize:'var(--text-small)' }}>No requests yet</div>
            : recentRequests.map(r => (
              <div key={r.ref} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'0.625rem 1.25rem', borderBottom:'1px solid var(--border)' }}>
                <div>
                  <p style={{ margin:0, fontSize:'0.8rem', fontWeight:500 }}>{r.category}</p>
                  <p style={{ margin:'2px 0 0', fontSize:'0.7rem', color:'var(--text-muted)', fontFamily:"'JetBrains Mono',monospace" }}>{r.ref} · USD {parseFloat(r.amount||0).toFixed(0)}</p>
                </div>
                <span className={`badge badge-${r.status}`} style={{ fontSize:'0.65rem' }}>{r.status}</span>
              </div>
            ))}
        </div>

        {/* Notice Board */}
        <div className="card" style={{ padding:0, overflow:'hidden' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'var(--sp-4) var(--sp-5) var(--sp-3)', borderBottom:'1px solid var(--border)' }}>
            <h3 style={{ margin:0, fontSize:'var(--text-small)', fontWeight:600, display:'flex', alignItems:'center', gap:6, color:'var(--text-primary)' }}><Megaphone size={13} style={{ color:'var(--text-muted)' }}/>Notices</h3>
            <button className="btn-ghost" style={{ padding:'0.2rem var(--sp-2)', fontSize:'var(--text-micro)' }} onClick={() => openTray('notices')} aria-label="View all notices">View all <ChevronRight size={11}/></button>
          </div>
          {loading
            ? <div style={{ padding:'0.75rem 1.25rem' }}>{[1,2].map(i=><SkeletonCard key={i} lines={3} />)}</div>
            : notices.length === 0
            ? <div style={{ padding:'1.5rem', textAlign:'center', color:'var(--text-muted)', fontSize:'var(--text-small)' }}>No active notices</div>
            : notices.map(n => (
              <div key={n.id} style={{ padding:'0.75rem 1.25rem', borderBottom:'1px solid var(--border)' }}>
                <div style={{ display:'flex', gap:'0.5rem', alignItems:'flex-start' }}>
                  {n.priority === 'urgent' && <AlertTriangle size={13} style={{ color:'var(--danger)', flexShrink:0, marginTop:2 }}/>}
                  <div style={{ minWidth:0 }}>
                    <p style={{ margin:0, fontSize:'var(--text-small)', fontWeight:600, color: n.priority==='urgent'?'var(--danger)':'var(--text-primary)' }}>{n.title}</p>
                    <p style={{ margin:'3px 0 0', fontSize:'var(--text-micro)', color:'var(--text-muted)', lineHeight:1.4 }}>{n.body}</p>
                    <p style={{ margin:'4px 0 0', fontSize:'var(--text-micro)', color:'var(--text-muted)' }}>— {n.user_profiles?.full_name} · {new Date(n.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
              </div>
            ))}
        </div>

        {/* Compliance Calendar */}
        <div className="card" style={{ padding:0, overflow:'hidden' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'var(--sp-4) var(--sp-5) var(--sp-3)', borderBottom:'1px solid var(--border)' }}>
            <h3 style={{ margin:0, fontSize:'var(--text-small)', fontWeight:600, display:'flex', alignItems:'center', gap:6, color:'var(--text-primary)' }}><Calendar size={13} style={{ color:'var(--text-muted)' }}/>Compliance Due</h3>
            <button className="btn-ghost" style={{ padding:'0.2rem var(--sp-2)', fontSize:'var(--text-micro)' }} onClick={() => openTray('compliance')} aria-label="View all compliance">View all <ChevronRight size={11}/></button>
          </div>
          {loading
            ? <div style={{ padding:'0.75rem 1.25rem' }}>{[1,2,3].map(i=><SkeletonCard key={i} lines={2} />)}</div>
            : compliance.length === 0
            ? <div style={{ padding:'1.5rem', textAlign:'center', color:'var(--text-muted)', fontSize:'var(--text-small)' }}>All compliance items up to date</div>
            : compliance.map(c => {
              const daysLeft = Math.ceil((new Date(c.due_date).getTime() - Date.now()) / 86400000)
              const isOverdue = daysLeft < 0
              return (
                <div key={c.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'0.625rem 1.25rem', borderBottom:'1px solid var(--border)' }}>
                  <div style={{ minWidth:0 }}>
                    <p style={{ margin:0, fontSize:'0.8rem', fontWeight:500 }}>{c.title}</p>
                    <p style={{ margin:'2px 0 0', fontSize:'0.7rem', color:'var(--text-muted)' }}>{c.category} · {c.user_profiles?.full_name||'Unassigned'}</p>
                  </div>
                  <span style={{ fontSize:'0.72rem', fontWeight:600, color:isOverdue?'var(--danger)':daysLeft<=7?'var(--warning)':'var(--text-muted)', flexShrink:0, marginLeft:'0.5rem' }}>
                    {isOverdue ? `${Math.abs(daysLeft)}d overdue` : daysLeft === 0 ? 'Today' : `${daysLeft}d`}
                  </span>
                </div>
              )
            })}
        </div>
      </div>
    </Layout>
  )
}
