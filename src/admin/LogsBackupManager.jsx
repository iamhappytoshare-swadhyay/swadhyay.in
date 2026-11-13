import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Database,
  Download,
  Eye,
  History,
  Lock,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldAlert,
  X,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import {
  createManualBackup,
  downloadBackupFromWorker,
  listActivityLogs,
  listBackups,
  restoreBackupFromWorker,
} from '../services/auditService.js'
import { downloadCsv } from '../utils/csvExport.js'
import { formatDate, toMillis } from '../utils/slugify.js'

function formatDateTime(value) {
  const ms = toMillis(value)
  if (!ms) return '—'
  try {
    return new Intl.DateTimeFormat('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(ms))
  } catch {
    return formatDate(value)
  }
}

function formatBytes(bytes) {
  const n = Number(bytes || 0)
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(2)} MB`
}

export default function LogsBackupManager() {
  const { isSuperAdmin } = useAuth()
  const [activeTab, setActiveTab] = useState('logs') // 'logs' | 'backups'
  const [logs, setLogs] = useState([])
  const [backups, setBackups] = useState([])
  const [loading, setLoading] = useState(true)
  const [creatingBackup, setCreatingBackup] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [banner, setBanner] = useState(null)

  // Log filters
  const [adminSearch, setAdminSearch] = useState('')
  const [moduleFilter, setModuleFilter] = useState('all')
  const [actionFilter, setActionFilter] = useState('all')
  const [dateFilter, setDateFilter] = useState('')
  const [detailLog, setDetailLog] = useState(null)

  // Backup form
  const [backupLabel, setBackupLabel] = useState('')
  const [retentionPolicy, setRetentionPolicy] = useState('daily')

  const loadData = useCallback(async () => {
    setLoading(true)
    setBanner(null)
    try {
      const [logRows, backupRows] = await Promise.all([
        listActivityLogs(),
        listBackups(),
      ])
      setLogs(logRows)
      setBackups(backupRows)
    } catch (error) {
      setBanner({ type: 'error', text: error?.message || 'Unable to load logs or backups.' })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const id = setTimeout(() => {
      void loadData()
    }, 0)
    return () => clearTimeout(id)
  }, [loadData])

  const moduleOptions = useMemo(() => {
    const set = new Set()
    logs.forEach((l) => l.module && set.add(l.module))
    return Array.from(set).sort()
  }, [logs])

  const actionOptions = useMemo(() => {
    const set = new Set()
    logs.forEach((l) => l.action && set.add(l.action))
    return Array.from(set).sort()
  }, [logs])

  const filteredLogs = useMemo(() => {
    const q = adminSearch.trim().toLowerCase()
    return logs.filter((l) => {
      if (moduleFilter !== 'all' && l.module !== moduleFilter) return false
      if (actionFilter !== 'all' && l.action !== actionFilter) return false
      if (dateFilter) {
        const ms = toMillis(l.createdAt)
        const day = ms ? new Date(ms).toISOString().slice(0, 10) : ''
        if (day !== dateFilter) return false
      }
      if (q) {
        const hay = `${l.actorName || ''} ${l.actorEmail || ''} ${l.description || ''}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [logs, adminSearch, moduleFilter, actionFilter, dateFilter])

  function handleExportLogsCsv() {
    downloadCsv(
      `swadhyay-activity-logs-${new Date().toISOString().slice(0, 10)}.csv`,
      ['Date & Time', 'Admin Name', 'Email', 'Role', 'Action', 'Module', 'Record ID', 'Description'],
      filteredLogs.map((l) => [
        formatDateTime(l.createdAt),
        l.actorName,
        l.actorEmail,
        l.actorRole,
        l.action,
        l.module,
        l.recordId,
        l.description,
      ]),
    )
  }

  async function handleCreateBackup(event) {
    event.preventDefault()
    setCreatingBackup(true)
    setBanner(null)
    try {
      const res = await createManualBackup({
        label: backupLabel.trim() || `Manual Backup (${retentionPolicy})`,
        retentionPolicy,
      })

      if (res.backupJson) {
        const blob = new Blob([res.backupJson], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `swadhyay-backup-${new Date().toISOString().slice(0, 10)}.json`
        a.click()
        URL.revokeObjectURL(url)
      }

      setBackupLabel('')
      await loadData()
      setBanner({
        type: 'success',
        text: `Verified backup created (${res.totalRecords} records, ${formatBytes(res.sizeBytes)}).`,
      })
    } catch (error) {
      setBanner({ type: 'error', text: error?.message || 'Backup creation failed.' })
    } finally {
      setCreatingBackup(false)
    }
  }

  async function handleDownloadBackup(backup) {
    if (!backup.r2Key) {
      setBanner({ type: 'error', text: 'Backup file key not stored in R2.' })
      return
    }
    try {
      const text = await downloadBackupFromWorker(backup.r2Key)
      const blob = new Blob([text], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = backup.r2Key.split('/').pop() || 'swadhyay-backup.json'
      a.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      setBanner({ type: 'error', text: error?.message || 'Download failed.' })
    }
  }

  async function handleRestoreBackup(backup) {
    if (!isSuperAdmin) return
    const typed = window.prompt(
      `DANGER: Restoring "${backup.label}" will overwrite matching Firestore records.\nType RESTORE to confirm:`,
    )
    if (typed !== 'RESTORE') return

    setRestoring(true)
    setBanner(null)
    try {
      const res = await restoreBackupFromWorker({ r2Key: backup.r2Key })
      await loadData()
      setBanner({
        type: 'success',
        text: `Backup restored (${res.restoredCount} records updated).`,
      })
    } catch (error) {
      setBanner({ type: 'error', text: error?.message || 'Restore failed.' })
    } finally {
      setRestoring(false)
    }
  }

  return (
    <div className="logs-backup-manager">
      <section className="admin-page-head">
        <div>
          <h1>Backup &amp; Activity Logs</h1>
          <p>
            Immutable administrative audit trail and sanitized database backups (separated from
            R2 file storage).
          </p>
        </div>
        <div className="cms-head-left">
          <div className="cms-filter-group" role="tablist">
            <button
              type="button"
              className={activeTab === 'logs' ? 'cms-tab-btn is-active' : 'cms-tab-btn'}
              onClick={() => setActiveTab('logs')}
            >
              <History size={14} style={{ marginRight: 6, verticalAlign: '-2px' }} />
              Activity Logs ({logs.length})
            </button>
            <button
              type="button"
              className={activeTab === 'backups' ? 'cms-tab-btn is-active' : 'cms-tab-btn'}
              onClick={() => setActiveTab('backups')}
            >
              <Database size={14} style={{ marginRight: 6, verticalAlign: '-2px' }} />
              Database Backups ({backups.length})
            </button>
          </div>
          {activeTab === 'logs' ? (
            <button type="button" className="admin-btn-secondary" onClick={handleExportLogsCsv}>
              <Download size={15} />
              <span>Export CSV</span>
            </button>
          ) : null}
          <button type="button" className="admin-btn-secondary" onClick={loadData}>
            <RefreshCw size={15} className={loading ? 'spin-icon' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </section>

      {banner ? (
        <div
          className={banner.type === 'error' ? 'admin-alert' : 'admin-alert cmt-alert-success'}
          role="status"
        >
          <span>{banner.text}</span>
          <button
            type="button"
            className="cmt-alert-close"
            onClick={() => setBanner(null)}
            aria-label="Dismiss"
          >
            <X size={15} />
          </button>
        </div>
      ) : null}

      {activeTab === 'logs' ? (
        <section className="admin-card">
          <div className="cmt-toolbar">
            <label className="cmt-search-box">
              <Search size={15} />
              <input
                type="search"
                placeholder="Search by admin name, email, or description…"
                value={adminSearch}
                onChange={(e) => setAdminSearch(e.target.value)}
              />
            </label>
            <select
              className="cmt-filter-select"
              value={moduleFilter}
              onChange={(e) => setModuleFilter(e.target.value)}
            >
              <option value="all">All Modules</option>
              {moduleOptions.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <select
              className="cmt-filter-select"
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
            >
              <option value="all">All Actions</option>
              {actionOptions.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
            <input
              type="date"
              className="cmt-filter-input"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
            />
          </div>

          <div className="cmt-policy-lock" style={{ marginBottom: 12 }}>
            <Lock size={15} />
            <span>
              Audit logs are append-only and cannot be edited or deleted by any user.
            </span>
          </div>

          <div className="cms-table-wrap">
            <table className="cms-table">
              <thead>
                <tr>
                  <th>Date &amp; Time</th>
                  <th>Admin</th>
                  <th>Action</th>
                  <th>Module</th>
                  <th>Record ID</th>
                  <th>Description</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="cms-muted">
                      No activity logs match the current filters.
                    </td>
                  </tr>
                ) : (
                  filteredLogs.slice(0, 100).map((logItem) => (
                    <tr key={logItem.id}>
                      <td className="cmt-date-cell">{formatDateTime(logItem.createdAt)}</td>
                      <td>
                        <strong>{logItem.actorName || 'Admin'}</strong>
                        <div className="cms-subtext">{logItem.actorRole || 'admin'}</div>
                      </td>
                      <td>
                        <span className="cms-badge">{logItem.action}</span>
                      </td>
                      <td>{logItem.module}</td>
                      <td>
                        <code>{logItem.recordId || '—'}</code>
                      </td>
                      <td>{logItem.description}</td>
                      <td>
                        <button
                          type="button"
                          className="cmt-action-btn"
                          title="Inspect log"
                          onClick={() => setDetailLog(logItem)}
                        >
                          <Eye size={14} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <div className="cms-form" style={{ gap: 16 }}>
          <section className="admin-card">
            <h2>Create Manual Database Backup</h2>
            <p className="cms-muted">
              Exports Firestore content &amp; settings (posts, pages, quizzes, NCERT, PYQ,
              comments, settings) with sensitive tokens stripped and JSON integrity verified.
            </p>
            <form className="rbac-add-form" onSubmit={handleCreateBackup}>
              <input
                type="text"
                className="cmt-filter-input"
                style={{ flex: '1 1 240px' }}
                placeholder="Backup label (e.g. Pre-Release Snapshot)"
                value={backupLabel}
                onChange={(e) => setBackupLabel(e.target.value)}
              />
              <select
                className="cmt-filter-select"
                value={retentionPolicy}
                onChange={(e) => setRetentionPolicy(e.target.value)}
              >
                <option value="manual">Manual Retention</option>
                <option value="daily">Daily Policy</option>
                <option value="weekly">Weekly Policy</option>
                <option value="monthly">Monthly Policy</option>
              </select>
              <button
                type="submit"
                className="admin-btn-primary"
                disabled={creatingBackup}
              >
                <Database size={15} />
                <span>{creatingBackup ? 'Creating Backup…' : 'Create & Verify Backup'}</span>
              </button>
            </form>
          </section>

          <section className="admin-card">
            <div className="cms-card-head">
              <h2>Backup History</h2>
              {!isSuperAdmin ? (
                <span className="cms-subtext">
                  <ShieldAlert size={13} style={{ verticalAlign: '-2px', marginRight: 4 }} />
                  Restore requires Super Admin
                </span>
              ) : null}
            </div>
            <div className="cms-table-wrap">
              <table className="cms-table">
                <thead>
                  <tr>
                    <th>Backup Label</th>
                    <th>Created At</th>
                    <th>Status</th>
                    <th>Records / Size</th>
                    <th>Retention</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {backups.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="cms-muted">
                        No database backups created yet.
                      </td>
                    </tr>
                  ) : (
                    backups.map((b) => (
                      <tr key={b.id}>
                        <td>
                          <strong>{b.label || 'Backup'}</strong>
                          <div className="cms-subtext">By {b.createdBy || 'Admin'}</div>
                        </td>
                        <td className="cmt-date-cell">{formatDateTime(b.createdAt)}</td>
                        <td>
                          <span className="cms-badge is-published">{b.status || 'verified'}</span>
                        </td>
                        <td>
                          {b.totalRecords ?? 0} records · {formatBytes(b.sizeBytes)}
                        </td>
                        <td>{b.retentionPolicy || 'manual'}</td>
                        <td>
                          <div className="cms-row-actions">
                            <button
                              type="button"
                              className="cmt-action-btn"
                              title="Download Backup JSON"
                              onClick={() => handleDownloadBackup(b)}
                            >
                              <Download size={14} />
                            </button>
                            {isSuperAdmin ? (
                              <button
                                type="button"
                                className="cmt-action-btn is-spam"
                                title="Restore Backup (Super Admin Only)"
                                onClick={() => handleRestoreBackup(b)}
                                disabled={restoring}
                              >
                                <RotateCcw size={14} />
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {detailLog ? (
        <div className="admin-modal-backdrop" role="dialog" aria-modal="true">
          <div className="admin-modal-card">
            <div className="cms-card-head">
              <h2>Activity Log Detail</h2>
              <button
                type="button"
                className="admin-icon-btn"
                onClick={() => setDetailLog(null)}
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>
            <pre className="log-detail-pre">{JSON.stringify(detailLog, null, 2)}</pre>
          </div>
        </div>
      ) : null}
    </div>
  )
}
