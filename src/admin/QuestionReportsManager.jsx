import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Trash2,
  X,
} from 'lucide-react'
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
} from 'firebase/firestore'
import { db } from '../firebase.js'
import { formatDateTime } from '../utils/slugify.js'

export default function QuestionReportsManager() {
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(() => Boolean(db))
  const [filterStatus, setFilterStatus] = useState('all') // 'all' | 'pending' | 'resolved'
  const [selectedAttachment, setSelectedAttachment] = useState(null)
  const [actionBusyId, setActionBusyId] = useState('')

  useEffect(() => {
    if (!db) {
      return undefined
    }

    const q = query(collection(db, 'question_reports'), orderBy('createdAt', 'desc'))
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }))
        setReports(list)
        setLoading(false)
      },
      (err) => {
        console.error('Error fetching question reports:', err)
        setLoading(false)
      },
    )

    return () => unsubscribe()
  }, [])

  const filteredReports = useMemo(() => {
    if (filterStatus === 'all') return reports
    return reports.filter((r) => (r.status || 'pending') === filterStatus)
  }, [reports, filterStatus])

  const counts = useMemo(() => {
    const total = reports.length
    const pending = reports.filter((r) => (r.status || 'pending') === 'pending').length
    const resolved = reports.filter((r) => r.status === 'resolved').length
    return { total, pending, resolved }
  }, [reports])

  async function handleToggleStatus(report) {
    if (!db || actionBusyId) return
    setActionBusyId(report.id)
    try {
      const nextStatus = report.status === 'resolved' ? 'pending' : 'resolved'
      await updateDoc(doc(db, 'question_reports', report.id), {
        status: nextStatus,
      })
    } catch (err) {
      alert(`Status update failed: ${err.message}`)
    } finally {
      setActionBusyId('')
    }
  }

  async function handleDeleteReport(reportId) {
    if (!db || actionBusyId) return
    if (!window.confirm('Are you sure you want to delete this report?')) return
    setActionBusyId(reportId)
    try {
      await deleteDoc(doc(db, 'question_reports', reportId))
    } catch (err) {
      alert(`Delete failed: ${err.message}`)
    } finally {
      setActionBusyId('')
    }
  }

  return (
    <div className="cms-page">
      <div className="cms-page-head">
        <div>
          <h1>Question Error Reports</h1>
          <p className="admin-page-desc">
            Review reported question and answer errors submitted by students, including their descriptions and attachments.
          </p>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="admin-stat-grid" style={{ marginBottom: 20 }}>
        <div className="admin-stat-card">
          <span className="admin-stat-label">Total Reports</span>
          <strong className="admin-stat-value">{counts.total}</strong>
        </div>
        <div className="admin-stat-card" style={{ borderColor: '#f59e0b' }}>
          <span className="admin-stat-label" style={{ color: '#d97706' }}>Pending Review</span>
          <strong className="admin-stat-value" style={{ color: '#d97706' }}>{counts.pending}</strong>
        </div>
        <div className="admin-stat-card" style={{ borderColor: '#10b981' }}>
          <span className="admin-stat-label" style={{ color: '#059669' }}>Resolved</span>
          <strong className="admin-stat-value" style={{ color: '#059669' }}>{counts.resolved}</strong>
        </div>
      </div>

      {/* Filters */}
      <div className="cms-toolbar" style={{ marginBottom: 16 }}>
        <div className="admin-pill-group">
          <button
            type="button"
            className={`admin-pill-link ${filterStatus === 'all' ? 'is-primary' : ''}`}
            onClick={() => setFilterStatus('all')}
          >
            All ({counts.total})
          </button>
          <button
            type="button"
            className={`admin-pill-link ${filterStatus === 'pending' ? 'is-primary' : ''}`}
            onClick={() => setFilterStatus('pending')}
          >
            <Clock size={14} />
            <span>Pending ({counts.pending})</span>
          </button>
          <button
            type="button"
            className={`admin-pill-link ${filterStatus === 'resolved' ? 'is-primary' : ''}`}
            onClick={() => setFilterStatus('resolved')}
          >
            <CheckCircle2 size={14} />
            <span>Resolved ({counts.resolved})</span>
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="cms-card">
        {loading ? (
          <p style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>Loading reports…</p>
        ) : filteredReports.length === 0 ? (
          <div style={{ padding: 36, textAlign: 'center', color: 'var(--text-muted)' }}>
            <AlertTriangle size={36} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
            <p style={{ margin: 0, fontWeight: 600 }}>No question reports found.</p>
          </div>
        ) : (
          <div className="cms-table-wrap">
            <table className="cms-table">
              <thead>
                <tr>
                  <th style={{ width: 40 }}>#</th>
                  <th>Quiz &amp; Question</th>
                  <th>Question Preview</th>
                  <th>Report Description</th>
                  <th>Attachment</th>
                  <th>Student</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredReports.map((item, index) => {
                  const isResolved = item.status === 'resolved'
                  const attachmentSrc = item.attachmentUrl || item.attachmentDataUrl
                  const hasAttachment = Boolean(attachmentSrc)
                  const isImage = item.attachmentType?.startsWith('image/') || /\.(png|jpe?g|webp|gif)$/i.test(item.attachmentName || '')

                  return (
                    <tr key={item.id}>
                      <td>{index + 1}</td>
                      <td>
                        <strong>{item.quizTitle || 'Quiz'}</strong>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          Question #{item.questionIndex || 1}
                        </div>
                      </td>
                      <td style={{ maxWidth: 220 }}>
                        <div
                          style={{
                            fontSize: '0.84rem',
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                          }}
                          title={item.questionText}
                        >
                          {item.questionText || '—'}
                        </div>
                      </td>
                      <td style={{ maxWidth: 260 }}>
                        <div
                          style={{
                            fontSize: '0.86rem',
                            lineHeight: 1.4,
                            whiteSpace: 'pre-wrap',
                            maxHeight: 100,
                            overflowY: 'auto',
                          }}
                        >
                          {item.description || 'No description provided.'}
                        </div>
                      </td>
                      <td>
                        {hasAttachment ? (
                          <button
                            type="button"
                            className="admin-pill-link"
                            style={{ fontSize: '0.78rem', padding: '4px 8px' }}
                            onClick={() =>
                              setSelectedAttachment({
                                name: item.attachmentName || 'Attachment',
                                type: item.attachmentType,
                                url: attachmentSrc,
                                isImage,
                              })
                            }
                          >
                            {isImage ? <ImageIcon size={14} /> : <FileText size={14} />}
                            <span>View {isImage ? 'Image' : 'PDF'}</span>
                          </button>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>None</span>
                        )}
                      </td>
                      <td>
                        <div style={{ fontSize: '0.84rem' }}>{item.studentName || 'Student'}</div>
                        {item.studentEmail ? (
                          <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                            {item.studentEmail}
                          </div>
                        ) : null}
                      </td>
                      <td style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                        {formatDateTime(item.createdAt)}
                      </td>
                      <td>
                        <span
                          className="admin-pill-label"
                          style={{
                            background: isResolved ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                            color: isResolved ? '#059669' : '#d97706',
                            borderColor: isResolved ? '#10b981' : '#f59e0b',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          {isResolved ? <CheckCircle2 size={12} /> : <Clock size={12} />}
                          {isResolved ? 'Resolved' : 'Pending'}
                        </span>
                      </td>
                      <td>
                        <div className="cms-row-actions">
                          <button
                            type="button"
                            className="cms-action-btn"
                            disabled={actionBusyId === item.id}
                            onClick={() => handleToggleStatus(item)}
                            title={isResolved ? 'Mark as Pending' : 'Mark as Resolved'}
                          >
                            <CheckCircle2 size={15} color={isResolved ? '#059669' : 'currentColor'} />
                          </button>
                          <button
                            type="button"
                            className="cms-action-btn is-danger"
                            disabled={actionBusyId === item.id}
                            onClick={() => handleDeleteReport(item.id)}
                            title="Delete report"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Attachment Preview Modal */}
      {selectedAttachment ? (
        <div
          className="admin-modal-backdrop"
          onClick={() => setSelectedAttachment(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100000,
            padding: 20,
          }}
        >
          <div
            className="admin-modal-card"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: 720,
              width: '100%',
              maxHeight: '90vh',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              background: 'var(--surface, #ffffff)',
              borderRadius: 14,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 18px',
                borderBottom: '1px solid var(--border)',
              }}
            >
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>
                {selectedAttachment.name || 'Attachment Preview'}
              </h3>
              <button
                type="button"
                onClick={() => setSelectedAttachment(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'inherit',
                }}
              >
                <X size={18} />
              </button>
            </div>
            <div style={{ padding: 18, flex: 1, overflowY: 'auto', textAlign: 'center' }}>
              {selectedAttachment.isImage ? (
                <img
                  src={selectedAttachment.url}
                  alt={selectedAttachment.name}
                  style={{ maxWidth: '100%', maxHeight: '70vh', objectFit: 'contain', borderRadius: 8 }}
                />
              ) : (
                <div style={{ padding: 24 }}>
                  <FileText size={48} style={{ margin: '0 auto 12px', color: '#2563eb' }} />
                  <p style={{ margin: 0, fontWeight: 600 }}>{selectedAttachment.name}</p>
                  <a
                    href={selectedAttachment.url}
                    download={selectedAttachment.name || 'attachment.pdf'}
                    target="_blank"
                    rel="noreferrer"
                    className="admin-btn admin-btn--primary"
                    style={{ marginTop: 14, display: 'inline-flex', alignItems: 'center', gap: 6 }}
                  >
                    <ExternalLink size={14} />
                    <span>Open / Download PDF</span>
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
