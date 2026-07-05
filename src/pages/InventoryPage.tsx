import React, { useEffect, useState } from 'react'
import Layout from '../components/Layout'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { Plus, X, AlertTriangle, Package, Truck, Cpu, Trash2 } from 'lucide-react'
import { dbWrite } from '../lib/offlineWrite'
import { OfflineBanner } from '../components/AppPrompts'
import TabBar from '../components/TabBar'

type InvTab = 'assets' | 'fleet'

export default function InventoryPage() {
  const { profile, post } = useAuth()
  const [tab, setTab] = useState<InvTab>('assets')
  const level = post?.hierarchy_levels
  const canEdit = level && level.rank <= 2

  return (
    <Layout title="Company Property">
      <OfflineBanner />
      <TabBar style={{ marginBottom:'1.25rem' }}>
        {(['assets','fleet'] as InvTab[]).map(t => (
          <button key={t} className={`tab ${tab===t?'active':''}`} onClick={() => setTab(t)}>
            {t === 'assets' ? 'Assets' : 'Fleet & Fuel'}
          </button>
        ))}
      </TabBar>
      {tab === 'assets' && <AssetsTab profile={profile} canEdit={canEdit} />}
      {tab === 'fleet'  && <FleetTab  profile={profile} canEdit={canEdit} />}
    </Layout>
  )
}

/* ── STOCK TAB ─────────────────────────────────────────────────── */
function StockTab({ profile, canEdit }: any) {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showItemModal, setShowItemModal] = useState(false)
  const [showMoveModal, setShowMoveModal] = useState(false)
  const [selectedItem, setSelectedItem] = useState<any>(null)
  const [editItem, setEditItem] = useState<any>(null)
  const [itemForm, setItemForm] = useState({ name:'', sku:'', category:'', unit:'unit', quantity:'', low_stock_threshold:'5', unit_cost:'', supplier:'', notes:'' })
  const [moveForm, setMoveForm] = useState({ movement_type:'in', quantity:'', reason:'' })
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => { if (profile) load() }, [profile])
  async function load() {
    setLoading(true)
    const { data } = await supabase.from('inventory_items').select('*, entities!entity_id(name)').eq('tenant_id', profile.tenant_id).eq('is_active', true).order('name')
    setItems(data || []); setLoading(false)
  }

  function openEdit(item: any) {
    setEditItem(item)
    setItemForm({ name:item.name, sku:item.sku||'', category:item.category||'', unit:item.unit, quantity:String(item.quantity), low_stock_threshold:String(item.low_stock_threshold), unit_cost:String(item.unit_cost||0), supplier:item.supplier||'', notes:item.notes||'' })
    setShowItemModal(true)
  }

  async function saveItem(e: React.FormEvent) {
    e.preventDefault(); setSubmitting(true)
    const payload = { name:itemForm.name, sku:itemForm.sku||null, category:itemForm.category||null, unit:itemForm.unit, quantity:parseFloat(itemForm.quantity), low_stock_threshold:parseFloat(itemForm.low_stock_threshold), unit_cost:parseFloat(itemForm.unit_cost||'0'), supplier:itemForm.supplier||null, notes:itemForm.notes||null }
    if (editItem) await supabase.from('inventory_items').update(payload).eq('id', editItem.id)
    else await supabase.from('inventory_items').insert({ tenant_id:profile.tenant_id, entity_id:profile.entity_id, ...payload })
    setShowItemModal(false); setEditItem(null); await load(); setSubmitting(false)
  }

  async function deleteItem(id: string) {
    if (!confirm('Archive this item?')) return
    await supabase.from('inventory_items').update({ is_active:false }).eq('id', id); await load()
  }

  async function recordMovement(e: React.FormEvent) {
    e.preventDefault(); setSubmitting(true)
    const qty = parseFloat(moveForm.quantity)
    const delta = moveForm.movement_type === 'in' ? qty : moveForm.movement_type === 'out' ? -qty : qty
    await supabase.from('inventory_movements').insert({ tenant_id:profile.tenant_id, item_id:selectedItem.id, entity_id:profile.entity_id, movement_type:moveForm.movement_type, quantity:qty, reason:moveForm.reason, ref:`MV-${Date.now().toString(36).toUpperCase()}`, recorded_by:profile.id })
    await supabase.from('inventory_items').update({ quantity:Math.max(0, selectedItem.quantity + delta) }).eq('id', selectedItem.id)
    setShowMoveModal(false); setMoveForm({ movement_type:'in', quantity:'', reason:'' }); await load(); setSubmitting(false)
  }

  const lowStock = items.filter(i => i.quantity <= i.low_stock_threshold)
  return (
    <>
      {lowStock.length > 0 && <div style={{ background:'var(--warning-dim)', border:'1px solid var(--warning-dim)', borderRadius:8, padding:'0.75rem 1rem', marginBottom:'1rem', display:'flex', alignItems:'center', gap:'0.625rem', fontSize:'0.875rem', color:'var(--warning)' }}><AlertTriangle size={16} />{lowStock.length} item(s) at or below low-stock threshold</div>}
      <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:'1rem' }}>
        {canEdit && <button className="btn-gold" style={{ display:'flex', alignItems:'center', gap:6 }} onClick={() => { setEditItem(null); setItemForm({ name:'', sku:'', category:'', unit:'unit', quantity:'', low_stock_threshold:'5', unit_cost:'', supplier:'', notes:'' }); setShowItemModal(true) }}><Plus size={16} />Add Item</button>}
      </div>
      <div className="card" style={{ padding:0, overflow:'hidden' }}>
        {loading ? <div style={{ display:'flex', justifyContent:'center', padding:'3rem' }}><div className="spinner" /></div>
        : <div style={{ overflowX:'auto' }}><table className="data-table">
            <thead><tr><th>Name</th><th>SKU</th><th>Category</th><th>Qty</th><th>Unit Cost</th><th>Value</th><th>Status</th><th></th></tr></thead>
            <tbody>{items.length === 0 ? <tr><td colSpan={8} style={{ textAlign:'center', color:'var(--text-muted)', padding:'2rem' }}>No items. Add your first item to get started.</td></tr>
              : items.map(item => (
              <tr key={item.id}>
                <td style={{ fontWeight:500 }}>{item.name}</td>
                <td style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:'0.8rem', color:'var(--text-muted)' }}>{item.sku||'—'}</td>
                <td style={{ color:'var(--text-muted)' }}>{item.category||'—'}</td>
                <td style={{ fontFamily:"'JetBrains Mono',monospace", fontWeight:600, color:item.quantity<=item.low_stock_threshold?'var(--warning)':'var(--text-primary)' }}>{item.quantity} {item.unit}</td>
                <td style={{ fontFamily:"'JetBrains Mono',monospace", color:'var(--text-muted)' }}>USD {parseFloat(item.unit_cost).toFixed(2)}</td>
                <td style={{ fontFamily:"'JetBrains Mono',monospace", color:'var(--gold)' }}>USD {(item.quantity*parseFloat(item.unit_cost)).toFixed(2)}</td>
                <td>{item.quantity<=0?<span className="badge badge-rejected">Out of Stock</span>:item.quantity<=item.low_stock_threshold?<span className="badge badge-pending">Low Stock</span>:<span className="badge badge-approved">In Stock</span>}</td>
                <td><div style={{ display:'flex', gap:4 }}>
                  {canEdit && <button className="btn-ghost" style={{ padding:'0.3rem 0.6rem', fontSize:'0.72rem' }} onClick={() => { setSelectedItem(item); setShowMoveModal(true) }}>Record</button>}
                  {canEdit && <button className="btn-ghost" style={{ padding:'0.3rem 0.6rem', fontSize:'0.72rem' }} onClick={() => openEdit(item)}>Edit</button>}
                  {canEdit && <button onClick={() => deleteItem(item.id)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--danger)', padding:'0.25rem' }}><Trash2 size={13} /></button>}
                </div></td>
              </tr>
            ))}</tbody>
          </table></div>}
      </div>
      {showItemModal && (
        <div className="modal-backdrop" onClick={() => setShowItemModal(false)}>
          <div className="card" style={{ width:'100%', maxWidth:460 }} onClick={e => e.stopPropagation()}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1.25rem' }}>
              <h3 style={{ fontFamily:"'Playfair Display',serif", fontSize:'1.1rem', margin:0 }}>{editItem?'Edit Item':'Add Inventory Item'}</h3>
              <button onClick={() => setShowItemModal(false)} style={{ background:'none', border:'none', color:'var(--text-muted)', cursor:'pointer' }}><X size={18} /></button>
            </div>
            <form onSubmit={saveItem}>
              {[
                { label:'Item Name', el:<input className="input" required value={itemForm.name} onChange={e => setItemForm({...itemForm,name:e.target.value})} /> },
                { label:'SKU', el:<input className="input" value={itemForm.sku} onChange={e => setItemForm({...itemForm,sku:e.target.value})} placeholder="e.g. CAM-001" /> },
                { label:'Category', el:<select className="input" value={itemForm.category} onChange={e => setItemForm({...itemForm,category:e.target.value})}><option value="">Select...</option>{['Electronics','Equipment','Supplies','Raw Materials','Finished Goods','Other'].map(c=><option key={c}>{c}</option>)}</select> },
                { label:'Unit', el:<select className="input" value={itemForm.unit} onChange={e => setItemForm({...itemForm,unit:e.target.value})}><option>unit</option><option>kg</option><option>litre</option><option>box</option><option>roll</option><option>metre</option></select> },
                { label:'Quantity', el:<input className="input" type="number" required min="0" step="0.01" value={itemForm.quantity} onChange={e => setItemForm({...itemForm,quantity:e.target.value})} /> },
                { label:'Low Stock Threshold', el:<input className="input" type="number" min="0" value={itemForm.low_stock_threshold} onChange={e => setItemForm({...itemForm,low_stock_threshold:e.target.value})} /> },
                { label:'Unit Cost (USD)', el:<input className="input" type="number" min="0" step="0.01" value={itemForm.unit_cost} onChange={e => setItemForm({...itemForm,unit_cost:e.target.value})} /> },
                { label:'Supplier', el:<input className="input" value={itemForm.supplier} onChange={e => setItemForm({...itemForm,supplier:e.target.value})} /> },
              ].map(({label,el}) => <div key={label} style={{ marginBottom:'1rem' }}><label className="form-label">{label}</label>{el}</div>)}
              <div style={{ display:'flex', gap:'0.75rem', justifyContent:'flex-end' }}>
                <button type="button" className="btn-ghost" onClick={() => setShowItemModal(false)}>Cancel</button>
                <button type="submit" className="btn-gold" disabled={submitting}>{submitting?'Saving...':editItem?'Save':'Add Item'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {showMoveModal && selectedItem && (
        <div className="modal-backdrop" onClick={() => setShowMoveModal(false)}>
          <div className="card" style={{ width:'100%', maxWidth:400 }} onClick={e => e.stopPropagation()}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1rem' }}>
              <h3 style={{ fontFamily:"'Playfair Display',serif", fontSize:'1.1rem', margin:0 }}>Record Movement</h3>
              <button onClick={() => setShowMoveModal(false)} style={{ background:'none', border:'none', color:'var(--text-muted)', cursor:'pointer' }}><X size={18} /></button>
            </div>
            <div style={{ background:'var(--surface)', borderRadius:8, padding:'0.75rem', marginBottom:'1rem' }}>
              <p style={{ margin:0, fontWeight:600 }}>{selectedItem.name}</p>
              <p style={{ margin:'0.25rem 0 0', fontSize:'0.85rem', color:'var(--text-muted)' }}>Current: {selectedItem.quantity} {selectedItem.unit}</p>
            </div>
            <form onSubmit={recordMovement}>
              {[
                { label:'Type', el:<select className="input" value={moveForm.movement_type} onChange={e => setMoveForm({...moveForm,movement_type:e.target.value})}><option value="in">Stock In</option><option value="out">Stock Out</option><option value="adjustment">Adjustment</option></select> },
                { label:'Quantity', el:<input className="input" type="number" required min="0.01" step="0.01" value={moveForm.quantity} onChange={e => setMoveForm({...moveForm,quantity:e.target.value})} /> },
                { label:'Reason', el:<input className="input" value={moveForm.reason} onChange={e => setMoveForm({...moveForm,reason:e.target.value})} placeholder="e.g. PO-123" /> },
              ].map(({label,el}) => <div key={label} style={{ marginBottom:'1rem' }}><label className="form-label">{label}</label>{el}</div>)}
              <div style={{ display:'flex', gap:'0.75rem', justifyContent:'flex-end' }}>
                <button type="button" className="btn-ghost" onClick={() => setShowMoveModal(false)}>Cancel</button>
                <button type="submit" className="btn-gold" disabled={submitting}>{submitting?'Recording...':'Record'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}

/* ── MOVEMENTS TAB ─────────────────────────────────────────────── */
function MovementsTab({ profile }: any) {
  const [movements, setMovements] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => { if (profile) load() }, [profile])
  async function load() {
    setLoading(true)
    const { data } = await supabase.from('inventory_movements').select('*, inventory_items!item_id(name), user_profiles!recorded_by(full_name)').eq('tenant_id', profile.tenant_id).order('created_at', { ascending:false }).limit(100)
    setMovements(data || []); setLoading(false)
  }
  return (
    <div className="card" style={{ padding:0, overflow:'hidden' }}>
      {loading ? <div style={{ display:'flex', justifyContent:'center', padding:'3rem' }}><div className="spinner" /></div>
      : <div style={{ overflowX:'auto' }}><table className="data-table">
          <thead><tr><th>Ref</th><th>Item</th><th>Type</th><th>Qty</th><th>Reason</th><th>By</th><th>Date</th></tr></thead>
          <tbody>{movements.length === 0 ? <tr><td colSpan={7} style={{ textAlign:'center', color:'var(--text-muted)', padding:'2rem' }}>No movements yet</td></tr>
            : movements.map(m => (
            <tr key={m.id}>
              <td style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:'0.8rem', color:'var(--gold)' }}>{m.ref}</td>
              <td>{m.inventory_items?.name}</td>
              <td><span className={`badge ${m.movement_type==='in'?'badge-approved':m.movement_type==='out'?'badge-rejected':'badge-pending'}`}>{m.movement_type}</span></td>
              <td style={{ fontFamily:"'JetBrains Mono',monospace" }}>{m.movement_type==='out'?'-':'+'}{m.quantity}</td>
              <td style={{ color:'var(--text-muted)' }}>{m.reason||'—'}</td>
              <td style={{ color:'var(--text-muted)' }}>{m.user_profiles?.full_name}</td>
              <td style={{ color:'var(--text-muted)', fontSize:'0.8rem' }}>{new Date(m.created_at).toLocaleDateString()}</td>
            </tr>
          ))}</tbody>
        </table></div>}
    </div>
  )
}

/* ── ASSETS TAB ────────────────────────────────────────────────── */
function AssetsTab({ profile, canEdit }: any) {
  const [assets, setAssets] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editAsset, setEditAsset] = useState<any>(null)
  const [form, setForm] = useState({ name:'', category:'Equipment', serial_number:'', purchase_date:'', purchase_cost:'', current_value:'', depreciation_rate:'0', assigned_to:'', location:'', status:'active', notes:'' })
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => { if (profile) { load(); loadUsers() } }, [profile])
  async function load() {
    setLoading(true)
    const { data } = await supabase.from('assets').select('*, user_profiles!assigned_to(full_name), entities!entity_id(name)').eq('tenant_id', profile.tenant_id).is('deleted_at', null).order('name')
    setAssets(data || []); setLoading(false)
  }
  async function loadUsers() {
    const { data } = await supabase.from('user_profiles').select('id,full_name').eq('tenant_id', profile.tenant_id).eq('is_active', true).is('deleted_at', null)
    setUsers(data || [])
  }

  function openAdd() { setEditAsset(null); setForm({ name:'', category:'Equipment', serial_number:'', purchase_date:'', purchase_cost:'', current_value:'', depreciation_rate:'0', assigned_to:'', location:'', status:'active', notes:'' }); setShowModal(true) }
  function openEdit(a: any) { setEditAsset(a); setForm({ name:a.name, category:a.category, serial_number:a.serial_number||'', purchase_date:a.purchase_date||'', purchase_cost:String(a.purchase_cost||0), current_value:String(a.current_value||0), depreciation_rate:String(a.depreciation_rate||0), assigned_to:a.assigned_to||'', location:a.location||'', status:a.status, notes:a.notes||'' }); setShowModal(true) }

  async function save(e: React.FormEvent) {
    e.preventDefault(); setSubmitting(true)
    const payload = { name:form.name, category:form.category, serial_number:form.serial_number||null, purchase_date:form.purchase_date||null, purchase_cost:parseFloat(form.purchase_cost||'0'), current_value:parseFloat(form.current_value||'0'), depreciation_rate:parseFloat(form.depreciation_rate||'0'), assigned_to:form.assigned_to||null, location:form.location||null, status:form.status, notes:form.notes||null }
    if (editAsset) await supabase.from('assets').update(payload).eq('id', editAsset.id)
    else await supabase.from('assets').insert({ tenant_id:profile.tenant_id, entity_id:profile.entity_id, ...payload })
    setShowModal(false); setEditAsset(null); await load(); setSubmitting(false)
  }

  async function deleteAsset(id: string) {
    if (!confirm('Archive this asset?')) return
    await supabase.from('assets').update({ deleted_at:new Date().toISOString() }).eq('id', id); await load()
  }

  const statusColors: Record<string, string> = { active:'badge-approved', maintenance:'badge-pending', disposed:'badge-rejected', lost:'badge-rejected' }
  return (
    <>
      <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:'1rem' }}>
        {canEdit && <button className="btn-gold" style={{ display:'flex', alignItems:'center', gap:6 }} onClick={openAdd}><Plus size={16} />Add Asset</button>}
      </div>
      <div className="card" style={{ padding:0, overflow:'hidden' }}>
        {loading ? <div style={{ display:'flex', justifyContent:'center', padding:'3rem' }}><div className="spinner" /></div>
        : <div style={{ overflowX:'auto' }}><table className="data-table">
            <thead><tr><th>Name</th><th>Category</th><th>Serial</th><th>Cost</th><th>Current Value</th><th>Assigned To</th><th>Status</th><th></th></tr></thead>
            <tbody>{assets.length === 0 ? <tr><td colSpan={8} style={{ textAlign:'center', color:'var(--text-muted)', padding:'2rem' }}>No assets registered yet</td></tr>
              : assets.map(a => (
              <tr key={a.id}>
                <td style={{ fontWeight:500 }}>{a.name}</td>
                <td style={{ color:'var(--text-muted)' }}>{a.category}</td>
                <td style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:'0.8rem', color:'var(--text-muted)' }}>{a.serial_number||'—'}</td>
                <td style={{ fontFamily:"'JetBrains Mono',monospace" }}>USD {parseFloat(a.purchase_cost||0).toFixed(2)}</td>
                <td style={{ fontFamily:"'JetBrains Mono',monospace", color:'var(--gold)' }}>USD {parseFloat(a.current_value||0).toFixed(2)}</td>
                <td style={{ color:'var(--text-muted)' }}>{a.user_profiles?.full_name||'—'}</td>
                <td><span className={`badge ${statusColors[a.status]||'badge-draft'}`}>{a.status}</span></td>
                <td><div style={{ display:'flex', gap:4 }}>
                  {canEdit && <button className="btn-ghost" style={{ padding:'0.25rem 0.5rem', fontSize:'0.72rem' }} onClick={() => openEdit(a)}>Edit</button>}
                  {canEdit && <button onClick={() => deleteAsset(a.id)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--danger)', padding:'0.25rem' }}><Trash2 size={13} /></button>}
                </div></td>
              </tr>
            ))}</tbody>
          </table></div>}
      </div>
      {showModal && (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="card" style={{ width:'100%', maxWidth:460 }} onClick={e => e.stopPropagation()}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1.25rem' }}>
              <h3 style={{ fontFamily:"'Playfair Display',serif", margin:0, fontSize:'1rem' }}>{editAsset?'Edit Asset':'Add Asset'}</h3>
              <button onClick={() => setShowModal(false)} style={{ background:'none', border:'none', color:'var(--text-muted)', cursor:'pointer' }}><X size={18} /></button>
            </div>
            <form onSubmit={save}>
              {[
                { label:'Asset Name *', el:<input className="input" required value={form.name} onChange={e => setForm({...form,name:e.target.value})} /> },
                { label:'Category', el:<select className="input" value={form.category} onChange={e => setForm({...form,category:e.target.value})}>{['Equipment','Vehicle','Furniture','Electronics','Property','Other'].map(c=><option key={c}>{c}</option>)}</select> },
                { label:'Serial Number', el:<input className="input" value={form.serial_number} onChange={e => setForm({...form,serial_number:e.target.value})} /> },
                { label:'Purchase Date', el:<input className="input" type="date" value={form.purchase_date} onChange={e => setForm({...form,purchase_date:e.target.value})} /> },
                { label:'Purchase Cost (USD)', el:<input className="input" type="number" min="0" step="0.01" value={form.purchase_cost} onChange={e => setForm({...form,purchase_cost:e.target.value})} /> },
                { label:'Current Value (USD)', el:<input className="input" type="number" min="0" step="0.01" value={form.current_value} onChange={e => setForm({...form,current_value:e.target.value})} /> },
                { label:'Depreciation Rate (%/yr)', el:<input className="input" type="number" min="0" max="100" step="0.5" value={form.depreciation_rate} onChange={e => setForm({...form,depreciation_rate:e.target.value})} /> },
                { label:'Assigned To', el:<select className="input" value={form.assigned_to} onChange={e => setForm({...form,assigned_to:e.target.value})}><option value="">None</option>{users.map(u=><option key={u.id} value={u.id}>{u.full_name}</option>)}</select> },
                { label:'Location', el:<input className="input" value={form.location} onChange={e => setForm({...form,location:e.target.value})} placeholder="Office / Site" /> },
                { label:'Status', el:<select className="input" value={form.status} onChange={e => setForm({...form,status:e.target.value})}><option>active</option><option>maintenance</option><option>disposed</option><option>lost</option></select> },
              ].map(({label,el}) => <div key={label} style={{ marginBottom:'0.875rem' }}><label className="form-label">{label}</label>{el}</div>)}
              <div style={{ display:'flex', gap:'0.75rem', justifyContent:'flex-end', marginTop:'0.5rem' }}>
                <button type="button" className="btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn-gold" disabled={submitting}>{submitting?'Saving...':editAsset?'Save':'Add Asset'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}

/* ── FLEET & FUEL TAB ──────────────────────────────────────────── */
function FleetTab({ profile, canEdit }: any) {
  const [vehicles, setVehicles] = useState<any[]>([])
  const [logs, setLogs] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [subTab, setSubTab] = useState<'vehicles'|'logs'>('vehicles')
  const [showVehicleModal, setShowVehicleModal] = useState(false)
  const [showLogModal, setShowLogModal] = useState(false)
  const [editVehicle, setEditVehicle] = useState<any>(null)
  const [vForm, setVForm] = useState({ registration:'', make:'', model:'', year:'', fuel_type:'Diesel', assigned_to:'' })
  const [lForm, setLForm] = useState({ vehicle_id:'', driver_id:'', log_date:new Date().toISOString().split('T')[0], odometer_start:'', odometer_end:'', fuel_litres:'', fuel_cost_usd:'', purpose:'', notes:'' })
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => { if (profile) { loadVehicles(); loadUsers() } }, [profile])
  useEffect(() => { if (profile && subTab === 'logs') loadLogs() }, [profile, subTab])

  async function loadVehicles() {
    setLoading(true)
    const { data } = await supabase.from('vehicles').select('*, user_profiles!assigned_to(full_name)').eq('tenant_id', profile.tenant_id).is('deleted_at', null).order('registration')
    setVehicles(data || []); setLoading(false)
  }
  async function loadLogs() {
    setLoading(true)
    const { data } = await supabase.from('fleet_logs').select('*, vehicles!vehicle_id(registration,make,model), user_profiles!driver_id(full_name)').eq('tenant_id', (await supabase.from('vehicles').select('tenant_id').eq('tenant_id', profile.tenant_id).limit(1)).data?.[0]?.tenant_id || profile.tenant_id).order('log_date', { ascending:false }).limit(100)
    setLogs(data || []); setLoading(false)
  }
  async function loadUsers() {
    const { data } = await supabase.from('user_profiles').select('id,full_name').eq('tenant_id', profile.tenant_id).eq('is_active', true)
    setUsers(data || [])
  }

  function openAddVehicle() { setEditVehicle(null); setVForm({ registration:'', make:'', model:'', year:'', fuel_type:'Diesel', assigned_to:'' }); setShowVehicleModal(true) }
  function openEditVehicle(v: any) { setEditVehicle(v); setVForm({ registration:v.registration, make:v.make||'', model:v.model||'', year:String(v.year||''), fuel_type:v.fuel_type||'Diesel', assigned_to:v.assigned_to||'' }); setShowVehicleModal(true) }

  async function saveVehicle(e: React.FormEvent) {
    e.preventDefault(); setSubmitting(true)
    const payload = { registration:vForm.registration, make:vForm.make||null, model:vForm.model||null, year:vForm.year?parseInt(vForm.year):null, fuel_type:vForm.fuel_type, assigned_to:vForm.assigned_to||null }
    if (editVehicle) await supabase.from('vehicles').update(payload).eq('id', editVehicle.id)
    else await supabase.from('vehicles').insert({ tenant_id:profile.tenant_id, entity_id:profile.entity_id, ...payload })
    setShowVehicleModal(false); setEditVehicle(null); await loadVehicles(); setSubmitting(false)
  }

  async function saveLog(e: React.FormEvent) {
    e.preventDefault(); setSubmitting(true)
    const dist = lForm.odometer_end && lForm.odometer_start ? parseFloat(lForm.odometer_end) - parseFloat(lForm.odometer_start) : null
    await supabase.from('fleet_logs').insert({ tenant_id:profile.tenant_id, vehicle_id:lForm.vehicle_id, driver_id:lForm.driver_id||null, log_date:lForm.log_date, odometer_start:lForm.odometer_start?parseFloat(lForm.odometer_start):null, odometer_end:lForm.odometer_end?parseFloat(lForm.odometer_end):null, distance_km:dist, fuel_litres:lForm.fuel_litres?parseFloat(lForm.fuel_litres):null, fuel_cost_usd:lForm.fuel_cost_usd?parseFloat(lForm.fuel_cost_usd):null, purpose:lForm.purpose||null, notes:lForm.notes||null })
    setShowLogModal(false); await loadLogs(); setSubmitting(false)
  }

  return (
    <>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1rem', flexWrap:'wrap', gap:'0.75rem' }}>
        <div style={{ display:'flex', gap:'0.25rem' }}>
          <button className={`tab ${subTab==='vehicles'?'active':''}`} style={{ fontSize:'0.8rem' }} onClick={() => setSubTab('vehicles')}>Vehicles ({vehicles.length})</button>
          <button className={`tab ${subTab==='logs'?'active':''}`} style={{ fontSize:'0.8rem' }} onClick={() => setSubTab('logs')}>Fuel Logs</button>
        </div>
        <div style={{ display:'flex', gap:'0.5rem' }}>
          {canEdit && subTab==='vehicles' && <button className="btn-gold" style={{ fontSize:'0.8rem', gap:5 }} onClick={openAddVehicle}><Plus size={13} />Add Vehicle</button>}
          {canEdit && subTab==='logs' && vehicles.length > 0 && <button className="btn-gold" style={{ fontSize:'0.8rem', gap:5 }} onClick={() => { setLForm({...lForm, vehicle_id:vehicles[0].id}); setShowLogModal(true) }}><Plus size={13} />Log Trip</button>}
        </div>
      </div>

      <div className="card" style={{ padding:0, overflow:'hidden' }}>
        {loading ? <div style={{ display:'flex', justifyContent:'center', padding:'3rem' }}><div className="spinner" /></div>
        : subTab === 'vehicles'
        ? <div style={{ overflowX:'auto' }}><table className="data-table">
            <thead><tr><th>Registration</th><th>Make / Model</th><th>Fuel Type</th><th>Driver</th><th>Status</th><th></th></tr></thead>
            <tbody>{vehicles.length === 0 ? <tr><td colSpan={6} style={{ textAlign:'center', color:'var(--text-muted)', padding:'2rem' }}>No vehicles registered</td></tr>
              : vehicles.map(v => (
              <tr key={v.id}>
                <td style={{ fontFamily:"'JetBrains Mono',monospace", fontWeight:600 }}>{v.registration}</td>
                <td>{v.make} {v.model} {v.year?`(${v.year})`:''}</td>
                <td style={{ color:'var(--text-muted)' }}>{v.fuel_type}</td>
                <td style={{ color:'var(--text-muted)' }}>{v.user_profiles?.full_name||'Unassigned'}</td>
                <td><span className={`badge ${v.status==='active'?'badge-approved':v.status==='maintenance'?'badge-pending':'badge-rejected'}`}>{v.status}</span></td>
                <td>{canEdit && <button className="btn-ghost" style={{ padding:'0.25rem 0.5rem', fontSize:'0.72rem' }} onClick={() => openEditVehicle(v)}>Edit</button>}</td>
              </tr>
            ))}</tbody>
          </table></div>
        : <div style={{ overflowX:'auto' }}><table className="data-table">
            <thead><tr><th>Date</th><th>Vehicle</th><th>Driver</th><th>Distance</th><th>Fuel (L)</th><th>Cost (USD)</th><th>Purpose</th></tr></thead>
            <tbody>{logs.length === 0 ? <tr><td colSpan={7} style={{ textAlign:'center', color:'var(--text-muted)', padding:'2rem' }}>No logs recorded</td></tr>
              : logs.map(l => (
              <tr key={l.id}>
                <td style={{ fontSize:'0.8rem', color:'var(--text-muted)' }}>{new Date(l.log_date).toLocaleDateString()}</td>
                <td style={{ fontFamily:"'JetBrains Mono',monospace", fontWeight:600, color:'var(--gold)' }}>{l.vehicles?.registration}</td>
                <td style={{ color:'var(--text-muted)' }}>{l.user_profiles?.full_name||'—'}</td>
                <td style={{ fontFamily:"'JetBrains Mono',monospace" }}>{l.distance_km?`${l.distance_km} km`:'—'}</td>
                <td style={{ fontFamily:"'JetBrains Mono',monospace" }}>{l.fuel_litres||'—'}</td>
                <td style={{ fontFamily:"'JetBrains Mono',monospace", color:'var(--gold)' }}>{l.fuel_cost_usd?`$${parseFloat(l.fuel_cost_usd).toFixed(2)}`:'—'}</td>
                <td style={{ color:'var(--text-muted)', maxWidth:160 }}>{l.purpose||'—'}</td>
              </tr>
            ))}</tbody>
          </table></div>}
      </div>

      {showVehicleModal && (
        <div className="modal-backdrop" onClick={() => setShowVehicleModal(false)}>
          <div className="card" style={{ width:'100%', maxWidth:400 }} onClick={e => e.stopPropagation()}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1.25rem' }}>
              <h3 style={{ fontFamily:"'Playfair Display',serif", margin:0, fontSize:'1rem' }}>{editVehicle?'Edit Vehicle':'Add Vehicle'}</h3>
              <button onClick={() => setShowVehicleModal(false)} style={{ background:'none', border:'none', color:'var(--text-muted)', cursor:'pointer' }}><X size={18} /></button>
            </div>
            <form onSubmit={saveVehicle}>
              {[
                { label:'Registration *', el:<input className="input" required value={vForm.registration} onChange={e => setVForm({...vForm,registration:e.target.value})} placeholder="ABC 1234" /> },
                { label:'Make', el:<input className="input" value={vForm.make} onChange={e => setVForm({...vForm,make:e.target.value})} placeholder="Toyota" /> },
                { label:'Model', el:<input className="input" value={vForm.model} onChange={e => setVForm({...vForm,model:e.target.value})} placeholder="Hilux" /> },
                { label:'Year', el:<input className="input" type="number" min="1990" max="2030" value={vForm.year} onChange={e => setVForm({...vForm,year:e.target.value})} /> },
                { label:'Fuel Type', el:<select className="input" value={vForm.fuel_type} onChange={e => setVForm({...vForm,fuel_type:e.target.value})}><option>Petrol</option><option>Diesel</option><option>Electric</option><option>Hybrid</option></select> },
                { label:'Assigned Driver', el:<select className="input" value={vForm.assigned_to} onChange={e => setVForm({...vForm,assigned_to:e.target.value})}><option value="">None</option>{users.map(u=><option key={u.id} value={u.id}>{u.full_name}</option>)}</select> },
              ].map(({label,el}) => <div key={label} style={{ marginBottom:'0.875rem' }}><label className="form-label">{label}</label>{el}</div>)}
              <div style={{ display:'flex', gap:'0.75rem', justifyContent:'flex-end', marginTop:'0.5rem' }}>
                <button type="button" className="btn-ghost" onClick={() => setShowVehicleModal(false)}>Cancel</button>
                <button type="submit" className="btn-gold" disabled={submitting}>{submitting?'Saving...':editVehicle?'Save':'Add'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showLogModal && (
        <div className="modal-backdrop" onClick={() => setShowLogModal(false)}>
          <div className="card" style={{ width:'100%', maxWidth:400 }} onClick={e => e.stopPropagation()}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1.25rem' }}>
              <h3 style={{ fontFamily:"'Playfair Display',serif", margin:0, fontSize:'1rem' }}>Log Trip / Fuel</h3>
              <button onClick={() => setShowLogModal(false)} style={{ background:'none', border:'none', color:'var(--text-muted)', cursor:'pointer' }}><X size={18} /></button>
            </div>
            <form onSubmit={saveLog}>
              {[
                { label:'Vehicle *', el:<select className="input" required value={lForm.vehicle_id} onChange={e => setLForm({...lForm,vehicle_id:e.target.value})}><option value="">Select...</option>{vehicles.map(v=><option key={v.id} value={v.id}>{v.registration} — {v.make} {v.model}</option>)}</select> },
                { label:'Driver', el:<select className="input" value={lForm.driver_id} onChange={e => setLForm({...lForm,driver_id:e.target.value})}><option value="">Select...</option>{users.map(u=><option key={u.id} value={u.id}>{u.full_name}</option>)}</select> },
                { label:'Date', el:<input className="input" type="date" required value={lForm.log_date} onChange={e => setLForm({...lForm,log_date:e.target.value})} /> },
                { label:'Odometer Start (km)', el:<input className="input" type="number" min="0" step="0.1" value={lForm.odometer_start} onChange={e => setLForm({...lForm,odometer_start:e.target.value})} /> },
                { label:'Odometer End (km)', el:<input className="input" type="number" min="0" step="0.1" value={lForm.odometer_end} onChange={e => setLForm({...lForm,odometer_end:e.target.value})} /> },
                { label:'Fuel Filled (litres)', el:<input className="input" type="number" min="0" step="0.1" value={lForm.fuel_litres} onChange={e => setLForm({...lForm,fuel_litres:e.target.value})} /> },
                { label:'Fuel Cost (USD)', el:<input className="input" type="number" min="0" step="0.01" value={lForm.fuel_cost_usd} onChange={e => setLForm({...lForm,fuel_cost_usd:e.target.value})} /> },
                { label:'Purpose', el:<input className="input" value={lForm.purpose} onChange={e => setLForm({...lForm,purpose:e.target.value})} placeholder="Site visit, delivery..." /> },
              ].map(({label,el}) => <div key={label} style={{ marginBottom:'0.875rem' }}><label className="form-label">{label}</label>{el}</div>)}
              <div style={{ display:'flex', gap:'0.75rem', justifyContent:'flex-end', marginTop:'0.5rem' }}>
                <button type="button" className="btn-ghost" onClick={() => setShowLogModal(false)}>Cancel</button>
                <button type="submit" className="btn-gold" disabled={submitting}>{submitting?'Saving...':'Log Trip'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
