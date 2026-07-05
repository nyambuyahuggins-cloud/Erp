import React, { useEffect, useState, useRef } from 'react'
import Layout from '../components/Layout'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { audit } from '../lib/audit'
import { getPlanLimits } from '../lib/planEnforcement'
import { Upload, Download, FileText, Trash2, Eye, Tag, Lock, CheckCircle, X, Plus, Filter } from 'lucide-react'

const DOC_TYPES = ['general', 'invoice', 'contract', 'employee_file', 'report', 'policy', 'other'] as const
type DocType = typeof DOC_TYPES[number]

interface Doc {
  id: string
  file_name: string
  file_size: number
  mime_type: string
  storage_path: string
  document_type: DocType
  tags: string[]
  description: string
  is_confidential: boolean
  created_at: string
  retention_until: string | null
  signed_at: string | null
  entity_id: string | null
  entities?: { name: string }
  uploaded_by_profile?: { full_name: string }
}

export default function DocumentsPage() {
  const { profile, post, tenant } = useAuth()
  const [docs, setDocs] = useState<Doc[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [showUpload, setShowUpload] = useState(false)
  const [filterType, setFilterType] = useState<string>('all')
  const [filterEntity, setFilterEntity] = useState<string>('all')
  const [entities, setEntities] = useState<{ id: string; name: string }[]>([])
  const [signModal, setSignModal] = useState<Doc | null>(null)
  const [signNote, setSignNote] = useState('')
  const [uploadForm, setUploadForm] = useState({
    document_type: 'general' as DocType,
    description: '',
    tags: '',
    entity_id: '',
    is_confidential: false,
  })
  const fileRef = useRef<HTMLInputElement>(null)

  const level = post?.hierarchy_levels
  const isExec = level && level.rank <= 1
  const plan = (tenant?.plan || 'starter') as 'starter' | 'group' | 'enterprise'
  const limits = getPlanLimits(plan)
  const retentionDays = limits.documentRetentionDays

  useEffect(() => { if (profile) { load(); loadEntities() } }, [profile, filterType, filterEntity])

  async function load() {
    setLoading(true)
    let q = supabase.from('documents')
      .select('*, entities!entity_id(name)')
      .eq('tenant_id', profile!.tenant_id)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })

    if (filterType !== 'all') q = q.eq('document_type', filterType)
    if (filterEntity !== 'all') q = q.eq('entity_id', filterEntity)

    const { data } = await q
    setDocs(data || [])
    setLoading(false)
  }

  async function loadEntities() {
    const { data } = await supabase.from('entities').select('id,name').eq('tenant_id', profile!.tenant_id).eq('is_active', true)
    setEntities(data || [])
  }

  async function handleUpload() {
    const file = fileRef.current?.files?.[0]
    if (!file) return
    setUploading(true)

    try {
      // Upload to Supabase Storage
      const ext = file.name.split('.').pop()
      const storagePath = `${profile!.tenant_id}/documents/${Date.now()}_${file.name}`
      const { error: storageError } = await supabase.storage
        .from('vela-documents')
        .upload(storagePath, file, { contentType: file.type, upsert: false })

      if (storageError) throw storageError

      // Compute retention date based on plan
      const retentionUntil = new Date()
      retentionUntil.setDate(retentionUntil.getDate() + retentionDays)

      const { data: doc, error: dbError } = await supabase.from('documents').insert({
        tenant_id: profile!.tenant_id,
        entity_id: uploadForm.entity_id || profile!.entity_id,
        uploaded_by: profile!.id,
        file_name: file.name,
        file_size: file.size,
        mime_type: file.type,
        storage_path: storagePath,
        document_type: uploadForm.document_type,
        description: uploadForm.description,
        tags: uploadForm.tags ? uploadForm.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
        is_confidential: uploadForm.is_confidential,
        retention_until: retentionUntil.toISOString(),
      }).select().single()

      if (dbError) throw dbError

      await audit.submitted({
        tenant_id: profile!.tenant_id, actor_id: profile!.id,
        entity_type: 'document', entity_id: doc.id, entity_name: file.name,
        after_snapshot: { file_name: file.name, document_type: uploadForm.document_type }
      })

      setShowUpload(false)
      setUploadForm({ document_type: 'general', description: '', tags: '', entity_id: '', is_confidential: false })
      if (fileRef.current) fileRef.current.value = ''
      load()
    } catch (e: unknown) {
      alert(`Upload failed: ${e instanceof Error ? e.message : 'Unknown error'}`)
    } finally {
      setUploading(false)
    }
  }

  async function handleDownload(doc: Doc) {
    const { data } = await supabase.storage.from('vela-documents').createSignedUrl(doc.storage_path, 60)
    if (data?.signedUrl) {
      const a = document.createElement('a')
      a.href = data.signedUrl
      a.download = doc.file_name
      a.click()

      await supabase.from('document_access_log').insert({
        document_id: doc.id, accessed_by: profile!.id, access_type: 'download'
      })
      await audit.exported(
        { tenant_id: profile!.tenant_id, actor_id: profile!.id, entity_type: 'document', entity_id: doc.id, entity_name: doc.file_name },
        'download'
      )
    }
  }

  async function handleDelete(doc: Doc) {
    if (!confirm(`Delete "${doc.file_name}"? This cannot be undone.`)) return
    const before = { ...doc }
    await supabase.from('documents').update({
      is_deleted: true, deleted_at: new Date().toISOString(), deleted_by: profile!.id
    }).eq('id', doc.id)
    await audit.deleted({
      tenant_id: profile!.tenant_id, actor_id: profile!.id,
      entity_type: 'document', entity_id: doc.id, entity_name: doc.file_name,
      before_snapshot: before
    })
    load()
  }

  async function handleSign(doc: Doc) {
    if (!signNote.trim()) return
    await supabase.from('documents').update({
      signed_by: profile!.id,
      signed_at: new Date().toISOString(),
      signature_note: signNote
    }).eq('id', doc.id)
    await audit.approved({
      tenant_id: profile!.tenant_id, actor_id: profile!.id,
      entity_type: 'document', entity_id: doc.id, entity_name: doc.file_name,
      after_snapshot: { signed_at: new Date().toISOString(), signature_note: signNote }
    })
    setSignModal(null)
    setSignNote('')
    load()
  }

  function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  }

  const typeColors: Record<string, string> = {
    invoice: 'var(--info)', contract: '#a78bfa', employee_file: '#f97316',
    report: 'var(--gold)', policy: '#34d399', general: 'var(--text-muted)', other: '#9ca3af'
  }

  return (
    <Layout
      title="Documents"
      action={
        <button className="btn-gold" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--text-small)' }}
          onClick={() => setShowUpload(true)}>
          <Upload size={14} /> Upload
        </button>
      }
    >
      {/* Filters */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <Filter size={14} style={{ color: 'var(--text-muted)' }} />
        <select className="input" style={{ width: 'auto', fontSize: 'var(--text-small)' }}
          value={filterType} onChange={e => setFilterType(e.target.value)}>
          <option value="all">All Types</option>
          {DOC_TYPES.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
        </select>
        <select className="input" style={{ width: 'auto', fontSize: 'var(--text-small)' }}
          value={filterEntity} onChange={e => setFilterEntity(e.target.value)}>
          <option value="all">All Entities</option>
          {entities.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
        <span style={{ fontSize: 'var(--text-micro)', color: 'var(--text-muted)', marginLeft: 'auto' }}>
          Retention: {retentionDays >= 365 ? `${Math.floor(retentionDays/365)}yr` : `${retentionDays}d`} ({plan})
        </span>
      </div>

      {/* Document grid */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '3rem' }}><div className="spinner" /></div>
      ) : docs.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <FolderEmpty />
          <p style={{ color: 'var(--text-muted)', marginTop: '1rem', fontSize: 'var(--text-body)' }}>No documents yet</p>
          <button className="btn-gold" style={{ marginTop: '1rem' }} onClick={() => setShowUpload(true)}>Upload first document</button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.875rem' }}>
          {docs.map(doc => (
            <div key={doc.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 8, flexShrink: 0,
                  background: `${typeColors[doc.document_type]}18`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  <FileText size={16} style={{ color: typeColors[doc.document_type] }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontWeight: 600, fontSize: 'var(--text-small)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {doc.file_name}
                  </p>
                  <p style={{ margin: '2px 0 0', fontSize: 'var(--text-micro)', color: 'var(--text-muted)' }}>
                    {formatSize(doc.file_size)} · {new Date(doc.created_at).toLocaleDateString()}
                  </p>
                </div>
                {doc.is_confidential && <Lock size={14} style={{ color: '#f97316', flexShrink: 0 }} />}
              </div>

              {/* Tags */}
              {doc.tags?.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {doc.tags.map(tag => (
                    <span key={tag} style={{
                      fontSize: 'var(--text-micro)', padding: '2px 7px', borderRadius: 999,
                      background: 'var(--gold-soft)', color: 'var(--gold)'
                    }}>{tag}</span>
                  ))}
                </div>
              )}

              {/* Entity + type */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{
                  fontSize: 'var(--text-micro)', padding: '2px 7px', borderRadius: 999,
                  background: `${typeColors[doc.document_type]}15`,
                  color: typeColors[doc.document_type]
                }}>{doc.document_type}</span>
                {doc.entities && <span style={{ fontSize: 'var(--text-micro)', color: 'var(--text-muted)' }}>{doc.entities.name}</span>}
              </div>

              {/* Signature status */}
              {doc.signed_at && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 'var(--text-micro)', color: 'var(--success)' }}>
                  <CheckCircle size={12} />
                  Signed {new Date(doc.signed_at).toLocaleDateString()}
                </div>
              )}

              {/* Actions */}
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: 'auto', paddingTop: '0.5rem', borderTop: '1px solid var(--border)' }}>
                <button className="btn-ghost" style={{ flex: 1, fontSize: 'var(--text-micro)', padding: '0.4rem 0.6rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
                  onClick={() => handleDownload(doc)}>
                  <Download size={12} /> Download
                </button>
                {!doc.signed_at && (
                  <button className="btn-ghost" style={{ flex: 1, fontSize: 'var(--text-micro)', padding: '0.4rem 0.6rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
                    onClick={() => setSignModal(doc)}>
                    <CheckCircle size={12} /> Sign
                  </button>
                )}
                {isExec && (
                  <button onClick={() => handleDelete(doc)} style={{
                    background: 'var(--danger-dim)', border: 'none', borderRadius: 6,
                    color: 'var(--danger)', cursor: 'pointer', padding: '0.4rem 0.6rem'
                  }}>
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload Modal */}
      {showUpload && (
        <div className="modal-backdrop" onClick={() => setShowUpload(false)}>
          <div className="card" style={{ width: '100%', maxWidth: 500 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ margin: 0, fontFamily: "'Playfair Display', serif", fontSize: 'var(--text-body)' }}>Upload Document</h3>
              <button onClick={() => setShowUpload(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={18} /></button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: 'var(--text-micro)', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>File *</label>
                <input ref={fileRef} type="file" className="input" accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.csv,.txt" />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 'var(--text-micro)', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Type</label>
                <select className="input" value={uploadForm.document_type} onChange={e => setUploadForm({ ...uploadForm, document_type: e.target.value as DocType })}>
                  {DOC_TYPES.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 'var(--text-micro)', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Entity</label>
                <select className="input" value={uploadForm.entity_id} onChange={e => setUploadForm({ ...uploadForm, entity_id: e.target.value })}>
                  <option value="">My Entity</option>
                  {entities.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 'var(--text-micro)', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Description</label>
                <input className="input" value={uploadForm.description} onChange={e => setUploadForm({ ...uploadForm, description: e.target.value })} placeholder="Brief description..." />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 'var(--text-micro)', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Tags (comma separated)</label>
                <input className="input" value={uploadForm.tags} onChange={e => setUploadForm({ ...uploadForm, tags: e.target.value })} placeholder="e.g. Q1, supplier, harare" />
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 'var(--text-small)' }}>
                <input type="checkbox" checked={uploadForm.is_confidential} onChange={e => setUploadForm({ ...uploadForm, is_confidential: e.target.checked })} />
                <Lock size={14} style={{ color: '#f97316' }} />
                Mark as confidential
              </label>

              <p style={{ fontSize: 'var(--text-micro)', color: 'var(--text-muted)', margin: 0 }}>
                Retention: {retentionDays >= 365 * 7 ? '7 years' : retentionDays >= 365 ? `${Math.floor(retentionDays/365)} year(s)` : `${retentionDays} days`} (Enterprise plan)
              </p>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button className="btn-ghost" onClick={() => setShowUpload(false)}>Cancel</button>
                <button className="btn-gold" onClick={handleUpload} disabled={uploading}>
                  {uploading ? 'Uploading...' : 'Upload'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sign Modal */}
      {signModal && (
        <div className="modal-backdrop" onClick={() => setSignModal(null)}>
          <div className="card" style={{ width: '100%', maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 1rem', fontFamily: "'Playfair Display', serif", fontSize: 'var(--text-body)' }}>Sign Document</h3>
            <p style={{ fontSize: 'var(--text-small)', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              "{signModal.file_name}" — your digital signature will be logged with a timestamp.
            </p>
            <label style={{ display: 'block', fontSize: 'var(--text-micro)', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Signature Note</label>
            <input className="input" value={signNote} onChange={e => setSignNote(e.target.value)} placeholder="e.g. Reviewed and approved for Q2 2026" style={{ marginBottom: '1rem' }} />
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button className="btn-ghost" onClick={() => setSignModal(null)}>Cancel</button>
              <button className="btn-gold" onClick={() => handleSign(signModal)} disabled={!signNote.trim()}>
                <CheckCircle size={14} style={{ marginRight: 6 }} /> Sign
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}

function FolderEmpty() {
  return (
    <div style={{ width: 64, height: 64, margin: '0 auto', opacity: 0.3 }}>
      <FolderOpen size={64} strokeWidth={1} style={{ color: 'var(--gold)' }} />
    </div>
  )
}

// Need this import
import { FolderOpen } from 'lucide-react'
