import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Bell,
  CalendarClock,
  CheckCircle2,
  Edit3,
  RefreshCw,
  Send,
  Trash2,
  Users,
  X,
  XCircle,
} from 'lucide-react'
import {
  cancelScheduledNotification,
  deleteNotificationDoc,
  listNotifications,
  sendOrScheduleNotification,
  updateScheduledNotification,
} from '../services/notificationService.js'
import { listRegisteredUsersWithStats } from '../services/userService.js'
import { formatDate, toMillis } from '../utils/slugify.js'

const AUDIENCE_LABELS = {
  all: 'All Registered Users',
  active: 'Active Users',
  new: 'New Users (Last 7 Days)',
  quiz_participants: 'Quiz Participants',
  pdf_downloaders: 'PDF Downloaders',
  group: 'Selected User Group',
  selected: 'Selected Users',
}

function formatLocalDateTime(value) {
  if (!value) return '—'
  const ms = typeof value === 'string' ? Date.parse(value) : toMillis(value)
  if (!ms || Number.isNaN(ms)) return formatDate(value)
  try {
    return new Intl.DateTimeFormat('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short',
    }).format(new Date(ms))
  } catch {
    return formatDate(value)
  }
}

export default function NotificationsManager() {
  const [activeTab, setActiveTab] = useState('compose') // 'compose' | 'scheduled' | 'history'
  const [notifications, setNotifications] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [banner, setBanner] = useState(null)

  const [editingId, setEditingId] = useState('')
  const [form, setForm] = useState({
    title: '',
    message: '',
    imageUrl: '',
    icon: 'bell',
    category: 'announcement',
    redirectUrl: '/#/home',
    audienceType: 'all',
    selectedGroup: 'General',
    targetUids: [],
    channel: 'in_app',
    scheduleMode: 'now', // 'now' | 'later'
    scheduledLocal: '',
    recurrence: 'none',
  })

  const loadData = useCallback(async () => {
    setLoading(true)
    setBanner(null)
    try {
      const [notifs, userRows] = await Promise.all([
        listNotifications(),
        listRegisteredUsersWithStats().catch(() => []),
      ])
      setNotifications(notifs)
      setUsers(userRows)
    } catch (error) {
      setBanner({ type: 'error', text: error?.message || 'Unable to load notifications.' })
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

  const userGroups = useMemo(() => {
    const set = new Set(['General'])
    users.forEach((u) => {
      if (u.userGroup) set.add(u.userGroup)
    })
    return Array.from(set)
  }, [users])

  const [mountNow] = useState(() => Date.now())

  const resolvedTargets = useMemo(() => {
    const sevenDaysAgo = mountNow - 7 * 86400000
    if (form.audienceType === 'active') {
      return users.filter((u) => u.accountStatus === 'active')
    }
    if (form.audienceType === 'new') {
      return users.filter((u) => toMillis(u.createdAt) >= sevenDaysAgo)
    }
    if (form.audienceType === 'quiz_participants') {
      return users.filter((u) => u.quizAttemptsCount > 0)
    }
    if (form.audienceType === 'pdf_downloaders') {
      return users.filter((u) => u.downloadsCount > 0)
    }
    if (form.audienceType === 'group') {
      return users.filter((u) => (u.userGroup || 'General') === form.selectedGroup)
    }
    if (form.audienceType === 'selected') {
      const set = new Set(form.targetUids)
      return users.filter((u) => set.has(u.uid))
    }
    return users
  }, [users, form.audienceType, form.selectedGroup, form.targetUids, mountNow])

  const summary = useMemo(() => {
    let sent = 0
    let scheduled = 0
    let failed = 0
    let totalRecipients = 0

    notifications.forEach((n) => {
      if (n.status === 'sent' || n.status === 'partial') sent += 1
      else if (n.status === 'scheduled') scheduled += 1
      else if (n.status === 'failed') failed += 1
      totalRecipients += Number(n.deliveredCount || 0)
    })

    return {
      total: notifications.length,
      sent,
      scheduled,
      failed,
      totalRecipients,
    }
  }, [notifications])

  const scheduledList = useMemo(
    () => notifications.filter((n) => n.status === 'scheduled'),
    [notifications],
  )

  async function handleSubmit(event) {
    event.preventDefault()
    if (!form.title.trim() || !form.message.trim()) return

    let scheduledIso = ''
    if (form.scheduleMode === 'later') {
      if (!form.scheduledLocal) {
        setBanner({ type: 'error', text: 'Please select a schedule date and time.' })
        return
      }
      scheduledIso = new Date(form.scheduledLocal).toISOString()
    }

    setSending(true)
    setBanner(null)
    try {
      if (editingId) {
        await updateScheduledNotification(editingId, {
          title: form.title.trim(),
          message: form.message.trim(),
          imageUrl: form.imageUrl.trim(),
          icon: form.icon,
          category: form.category,
          redirectUrl: form.redirectUrl.trim(),
          audienceType: form.audienceType,
          targetUids: resolvedTargets.map((u) => u.uid),
          recipientCount: resolvedTargets.length,
          scheduledFor: scheduledIso,
          recurrence: form.recurrence,
        })
        setEditingId('')
        setBanner({ type: 'success', text: 'Scheduled notification updated.' })
      } else {
        const res = await sendOrScheduleNotification({
          title: form.title.trim(),
          message: form.message.trim(),
          imageUrl: form.imageUrl.trim(),
          icon: form.icon,
          category: form.category,
          redirectUrl: form.redirectUrl.trim(),
          audienceType: form.audienceType,
          targetUids: resolvedTargets.map((u) => u.uid),
          recipientCount: resolvedTargets.length,
          channel: form.channel,
          scheduledFor: scheduledIso,
          recurrence: form.recurrence,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata',
        })

        if (res.pushStatus === 'pending_fcm_credentials') {
          setBanner({
            type: 'info',
            text:
              res.status === 'failed'
                ? 'Push delivery failed: FCM server credentials are not configured on the Worker.'
                : 'In-App notification sent. Push (FCM) skipped because FCM credentials are not configured.',
          })
        } else {
          setBanner({
            type: 'success',
            text:
              res.status === 'scheduled'
                ? 'Notification scheduled successfully.'
                : `Notification sent to ${res.deliveredCount} recipient(s).`,
          })
        }
      }

      setForm((prev) => ({ ...prev, title: '', message: '', imageUrl: '' }))
      await loadData()
    } catch (error) {
      setBanner({ type: 'error', text: error?.message || 'Unable to send notification.' })
    } finally {
      setSending(false)
    }
  }

  function startEditScheduled(n) {
    setEditingId(n.id)
    const localDt = n.scheduledFor
      ? new Date(n.scheduledFor).toISOString().slice(0, 16)
      : ''
    setForm({
      title: n.title || '',
      message: n.message || '',
      imageUrl: n.imageUrl || '',
      icon: n.icon || 'bell',
      category: n.category || 'announcement',
      redirectUrl: n.redirectUrl || '/#/home',
      audienceType: n.audienceType || 'all',
      selectedGroup: 'General',
      targetUids: n.targetUids || [],
      channel: n.channel || 'in_app',
      scheduleMode: 'later',
      scheduledLocal: localDt,
      recurrence: n.recurrence || 'none',
    })
    setActiveTab('compose')
  }

  async function handleCancelScheduled(id) {
    if (!window.confirm('Cancel this scheduled notification?')) return
    try {
      await cancelScheduledNotification(id)
      await loadData()
      setBanner({ type: 'success', text: 'Scheduled notification cancelled.' })
    } catch (error) {
      setBanner({ type: 'error', text: error?.message || 'Cancel failed.' })
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this notification record?')) return
    try {
      await deleteNotificationDoc(id)
      setNotifications((prev) => prev.filter((n) => n.id !== id))
    } catch (error) {
      setBanner({ type: 'error', text: error?.message || 'Delete failed.' })
    }
  }

  return (
    <div className="notifications-manager">
      <section className="admin-page-head">
        <div>
          <h1>Notifications Management</h1>
          <p>
            Compose, target, schedule, and audit In-App and Push (FCM) notifications.
          </p>
        </div>
        <div className="cms-head-left">
          <div className="cms-filter-group" role="tablist">
            <button
              type="button"
              className={activeTab === 'compose' ? 'cms-tab-btn is-active' : 'cms-tab-btn'}
              onClick={() => setActiveTab('compose')}
            >
              <Send size={14} style={{ marginRight: 6, verticalAlign: '-2px' }} />
              {editingId ? 'Edit Scheduled' : 'Create'}
            </button>
            <button
              type="button"
              className={activeTab === 'scheduled' ? 'cms-tab-btn is-active' : 'cms-tab-btn'}
              onClick={() => setActiveTab('scheduled')}
            >
              <CalendarClock size={14} style={{ marginRight: 6, verticalAlign: '-2px' }} />
              Scheduled ({scheduledList.length})
            </button>
            <button
              type="button"
              className={activeTab === 'history' ? 'cms-tab-btn is-active' : 'cms-tab-btn'}
              onClick={() => setActiveTab('history')}
            >
              <Bell size={14} style={{ marginRight: 6, verticalAlign: '-2px' }} />
              History ({notifications.length})
            </button>
          </div>
          <button type="button" className="admin-btn-secondary" onClick={loadData}>
            <RefreshCw size={15} className={loading ? 'spin-icon' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </section>

      {banner ? (
        <div
          className={
            banner.type === 'error'
              ? 'admin-alert'
              : banner.type === 'info'
                ? 'cmt-pending-banner'
                : 'admin-alert cmt-alert-success'
          }
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

      {/* A. Notification Dashboard */}
      <section className="cmt-stats-grid">
        <div className="cmt-stat-card">
          <span className="cmt-stat-icon is-total">
            <Bell size={18} />
          </span>
          <div>
            <span className="cmt-stat-label">Total Notifications</span>
            <strong className="cmt-stat-value">{summary.total}</strong>
          </div>
        </div>
        <div className="cmt-stat-card">
          <span className="cmt-stat-icon is-published">
            <CheckCircle2 size={18} />
          </span>
          <div>
            <span className="cmt-stat-label">Sent</span>
            <strong className="cmt-stat-value">{summary.sent}</strong>
          </div>
        </div>
        <div className="cmt-stat-card">
          <span className="cmt-stat-icon is-pending">
            <CalendarClock size={18} />
          </span>
          <div>
            <span className="cmt-stat-label">Scheduled</span>
            <strong className="cmt-stat-value">{summary.scheduled}</strong>
          </div>
        </div>
        <div className="cmt-stat-card">
          <span className="cmt-stat-icon is-spam">
            <XCircle size={18} />
          </span>
          <div>
            <span className="cmt-stat-label">Failed</span>
            <strong className="cmt-stat-value">{summary.failed}</strong>
          </div>
        </div>
        <div className="cmt-stat-card">
          <span className="cmt-stat-icon is-total">
            <Users size={18} />
          </span>
          <div>
            <span className="cmt-stat-label">Total Recipients</span>
            <strong className="cmt-stat-value">{summary.totalRecipients}</strong>
          </div>
        </div>
      </section>

      {activeTab === 'compose' ? (
        <section className="admin-card">
          <form className="cms-form" onSubmit={handleSubmit}>
            <div className="cms-field-row">
              <div className="cms-field">
                <label>Notification Title *</label>
                <input
                  value={form.title}
                  onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                  placeholder="e.g. New NCERT Class 12 Geography Quiz Live!"
                  required
                />
              </div>
              <div className="cms-field">
                <label>Category</label>
                <select
                  value={form.category}
                  onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
                >
                  <option value="announcement">Announcement</option>
                  <option value="quiz">New Quiz</option>
                  <option value="notes">Notes / PDF</option>
                  <option value="pyq">PYQ Update</option>
                  <option value="exam_alert">Exam Alert</option>
                </select>
              </div>
            </div>

            <div className="cms-field">
              <label>Notification Message *</label>
              <textarea
                rows={3}
                value={form.message}
                onChange={(e) => setForm((p) => ({ ...p, message: e.target.value }))}
                placeholder="Write a concise, clear message for students…"
                required
              />
            </div>

            <div className="cms-field-row">
              <div className="cms-field">
                <label>Redirect URL / Deep Link</label>
                <input
                  value={form.redirectUrl}
                  onChange={(e) => setForm((p) => ({ ...p, redirectUrl: e.target.value }))}
                  placeholder="/#/ncert or https://swadhyay.in/#/pyq"
                />
              </div>
              <div className="cms-field">
                <label>Notification Image URL (Optional)</label>
                <input
                  value={form.imageUrl}
                  onChange={(e) => setForm((p) => ({ ...p, imageUrl: e.target.value }))}
                  placeholder="https://notes.swadhyay.in/..."
                />
              </div>
            </div>

            <div className="cms-field-row">
              <div className="cms-field">
                <label>Target Audience ({resolvedTargets.length} matched users)</label>
                <select
                  value={form.audienceType}
                  onChange={(e) => setForm((p) => ({ ...p, audienceType: e.target.value }))}
                >
                  {Object.entries(AUDIENCE_LABELS).map(([k, label]) => (
                    <option key={k} value={k}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="cms-field">
                <label>Delivery Channel</label>
                <select
                  value={form.channel}
                  onChange={(e) => setForm((p) => ({ ...p, channel: e.target.value }))}
                >
                  <option value="in_app">In-App Notification</option>
                  <option value="push">Push Notification (FCM)</option>
                  <option value="both">Both (In-App + Push)</option>
                </select>
              </div>
            </div>

            {form.audienceType === 'group' ? (
              <div className="cms-field">
                <label>Select User Group</label>
                <select
                  value={form.selectedGroup}
                  onChange={(e) => setForm((p) => ({ ...p, selectedGroup: e.target.value }))}
                >
                  {userGroups.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            {form.audienceType === 'selected' ? (
              <div className="cms-field">
                <label>Select Specific Users</label>
                <div className="notif-user-picker">
                  {users.map((u) => (
                    <label key={u.uid} className="cms-checkbox">
                      <input
                        type="checkbox"
                        checked={form.targetUids.includes(u.uid)}
                        onChange={() =>
                          setForm((p) => ({
                            ...p,
                            targetUids: p.targetUids.includes(u.uid)
                              ? p.targetUids.filter((id) => id !== u.uid)
                              : [...p.targetUids, u.uid],
                          }))
                        }
                      />
                      <span>
                        {u.displayName} ({u.email})
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="cms-field-row">
              <div className="cms-field">
                <label>Send Timing</label>
                <select
                  value={form.scheduleMode}
                  onChange={(e) => setForm((p) => ({ ...p, scheduleMode: e.target.value }))}
                >
                  <option value="now">Send Now</option>
                  <option value="later">Schedule for Later</option>
                </select>
              </div>
              {form.scheduleMode === 'later' ? (
                <div className="cms-field">
                  <label>Local Date &amp; Time</label>
                  <input
                    type="datetime-local"
                    value={form.scheduledLocal}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, scheduledLocal: e.target.value }))
                    }
                    required
                  />
                </div>
              ) : null}
            </div>

            {form.scheduleMode === 'later' ? (
              <div className="cms-field">
                <label>Recurrence</label>
                <select
                  value={form.recurrence}
                  onChange={(e) => setForm((p) => ({ ...p, recurrence: e.target.value }))}
                >
                  <option value="none">One-time</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                </select>
              </div>
            ) : null}

            <div className="cms-form-actions">
              <button type="submit" className="admin-btn-primary" disabled={sending}>
                <Send size={15} />
                <span>
                  {sending
                    ? 'Processing…'
                    : editingId
                      ? 'Save Scheduled Changes'
                      : form.scheduleMode === 'later'
                        ? 'Schedule Notification'
                        : 'Send Notification'}
                </span>
              </button>
              {editingId ? (
                <button
                  type="button"
                  className="admin-btn-secondary"
                  onClick={() => setEditingId('')}
                >
                  Cancel Edit
                </button>
              ) : null}
            </div>
          </form>
        </section>
      ) : activeTab === 'scheduled' ? (
        <section className="admin-card">
          {scheduledList.length === 0 ? (
            <p className="cms-muted">No scheduled notifications.</p>
          ) : (
            <div className="cms-table-wrap">
              <table className="cms-table">
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Target Audience</th>
                    <th>Scheduled Time (Local)</th>
                    <th>Recurrence</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {scheduledList.map((n) => (
                    <tr key={n.id}>
                      <td>
                        <strong>{n.title}</strong>
                        <div className="cms-subtext">{n.message}</div>
                      </td>
                      <td>
                        {AUDIENCE_LABELS[n.audienceType] || n.audienceType} ({n.recipientCount || 0})
                      </td>
                      <td className="cmt-date-cell">{formatLocalDateTime(n.scheduledFor)}</td>
                      <td>{n.recurrence || 'none'}</td>
                      <td>
                        <div className="cms-row-actions">
                          <button
                            type="button"
                            className="cmt-action-btn"
                            title="Edit Scheduled"
                            onClick={() => startEditScheduled(n)}
                          >
                            <Edit3 size={14} />
                          </button>
                          <button
                            type="button"
                            className="cmt-action-btn is-delete"
                            title="Cancel Scheduled"
                            onClick={() => handleCancelScheduled(n.id)}
                          >
                            <XCircle size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : (
        <section className="admin-card">
          <div className="cms-table-wrap">
            <table className="cms-table">
              <thead>
                <tr>
                  <th>Notification Title</th>
                  <th>Sent / Created Date</th>
                  <th>Target Audience</th>
                  <th>Channel / Status</th>
                  <th>Delivered / Failed</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {notifications.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="cms-muted">
                      No notifications sent yet.
                    </td>
                  </tr>
                ) : (
                  notifications.map((n) => (
                    <tr key={n.id}>
                      <td>
                        <strong>{n.title}</strong>
                        <div className="cms-subtext">{n.message}</div>
                      </td>
                      <td className="cmt-date-cell">
                        {formatLocalDateTime(n.sentAt || n.createdAt)}
                      </td>
                      <td>{AUDIENCE_LABELS[n.audienceType] || n.audienceType}</td>
                      <td>
                        <span
                          className={`cms-badge ${
                            n.status === 'sent'
                              ? 'is-published'
                              : n.status === 'failed'
                                ? 'cmt-status-spam'
                                : 'cmt-status-pending'
                          }`}
                        >
                          {n.status} ({n.channel || 'in_app'})
                        </span>
                        {n.pushStatus && n.pushStatus !== 'not_requested' ? (
                          <div className="cms-subtext">Push: {n.pushStatus}</div>
                        ) : null}
                      </td>
                      <td>
                        <strong>{n.deliveredCount ?? 0}</strong> / {n.failedCount ?? 0}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="cmt-action-btn is-delete"
                          title="Delete record"
                          onClick={() => handleDelete(n.id)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}
