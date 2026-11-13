import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Ban,
  CheckCircle2,
  ClipboardList,
  Download,
  Edit3,
  Eye,
  RefreshCw,
  Search,
  Trash2,
  UserCheck,
  Users,
  UserX,
  X,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { SUPER_ADMIN_EMAIL } from '../config/constants.js'
import {
  deleteUserAccountDoc,
  listRegisteredUsersWithStats,
  updateUserAccountStatus,
  updateUserDetails,
} from '../services/userService.js'
import { downloadCsv } from '../utils/csvExport.js'
import { formatDate, toMillis } from '../utils/slugify.js'

const PAGE_SIZE = 15

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

function getInitials(user) {
  const src = user?.displayName || user?.email || 'U'
  const parts = src.trim().split(/\s+/)
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  return src.slice(0, 2).toUpperCase()
}

export default function UsersManager() {
  const { user: currentUser, role: currentRole, isSuperAdmin } = useAuth()
  const [activeTab, setActiveTab] = useState('users') // 'users' | 'quiz_report'
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState('')
  const [banner, setBanner] = useState(null)

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [groupFilter, setGroupFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [selectedIds, setSelectedIds] = useState([])

  // Profile modal + editing
  const [profileUser, setProfileUser] = useState(null)
  const [editingProfile, setEditingProfile] = useState(false)
  const [editForm, setEditForm] = useState({
    displayName: '',
    phone: '',
    bio: '',
    userGroup: 'General',
  })

  const loadUsers = useCallback(async () => {
    setLoading(true)
    setBanner(null)
    try {
      const rows = await listRegisteredUsersWithStats()
      setUsers(rows)
    } catch (error) {
      setBanner({ type: 'error', text: error?.message || 'Unable to load users.' })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const id = setTimeout(() => {
      void loadUsers()
    }, 0)
    return () => clearTimeout(id)
  }, [loadUsers])

  const summary = useMemo(() => {
    const now = new Date()
    const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
    const startMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime()

    let active = 0
    let inactive = 0
    let suspended = 0
    let newToday = 0
    let newMonth = 0
    let quizParticipants = 0

    users.forEach((u) => {
      if (u.accountStatus === 'suspended') suspended += 1
      else if (u.accountStatus === 'inactive') inactive += 1
      else active += 1

      const regMs = toMillis(u.createdAt)
      if (regMs >= startToday) newToday += 1
      if (regMs >= startMonth) newMonth += 1
      if (u.quizAttemptsCount > 0) quizParticipants += 1
    })

    return {
      total: users.length,
      active,
      inactive,
      suspended,
      newToday,
      newMonth,
      quizParticipants,
    }
  }, [users])

  const groups = useMemo(() => {
    const set = new Set(['General'])
    users.forEach((u) => {
      if (u.userGroup) set.add(u.userGroup)
    })
    return Array.from(set)
  }, [users])

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase()
    return users.filter((u) => {
      if (statusFilter !== 'all' && u.accountStatus !== statusFilter) return false
      if (groupFilter !== 'all' && u.userGroup !== groupFilter) return false
      if (q) {
        const hay = `${u.displayName} ${u.email} ${u.userGroup}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [users, search, statusFilter, groupFilter])

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const paginatedUsers = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE
    return filteredUsers.slice(start, start + PAGE_SIZE)
  }, [filteredUsers, safePage])

  const quizReportRows = useMemo(() => {
    const q = search.trim().toLowerCase()
    const rows = []
    users.forEach((u) => {
      u.quizHistory.forEach((attempt) => {
        if (q) {
          const hay = `${u.displayName} ${u.email} ${attempt.quizTitle || ''}`.toLowerCase()
          if (!hay.includes(q)) return
        }
        rows.push({
          id: `${u.uid}-${attempt.id}`,
          userName: u.displayName,
          userEmail: u.email,
          quizName: attempt.quizTitle || attempt.quizId || 'Quiz',
          attemptDate: attempt.submittedAt,
          score: attempt.score ?? 0,
          totalMarks: attempt.maxScore ?? attempt.totalQuestions ?? 0,
          percentage: attempt.percentage ?? 0,
          durationSeconds: attempt.durationSeconds ?? 0,
          status: 'Completed',
        })
      })
    })
    return rows.sort((a, b) => toMillis(b.attemptDate) - toMillis(a.attemptDate))
  }, [users, search])

  function openProfile(u) {
    setProfileUser(u)
    setEditingProfile(false)
    setEditForm({
      displayName: u.displayName || '',
      phone: u.phone || '',
      bio: u.bio || '',
      userGroup: u.userGroup || 'General',
    })
  }

  async function handleStatusChange(u, nextStatus) {
    if (u.email?.toLowerCase() === SUPER_ADMIN_EMAIL && !isSuperAdmin) return
    if (
      !window.confirm(
        `Set account status to "${nextStatus}" for ${u.displayName || u.email}?`,
      )
    ) {
      return
    }
    setBusyId(u.uid)
    setBanner(null)
    try {
      await updateUserAccountStatus(u.uid, nextStatus)
      setUsers((prev) =>
        prev.map((item) =>
          item.uid === u.uid ? { ...item, accountStatus: nextStatus } : item,
        ),
      )
      if (profileUser?.uid === u.uid) {
        setProfileUser((prev) => (prev ? { ...prev, accountStatus: nextStatus } : null))
      }
      setBanner({ type: 'success', text: `Account status updated to ${nextStatus}.` })
    } catch (error) {
      setBanner({ type: 'error', text: error?.message || 'Status update failed.' })
    } finally {
      setBusyId('')
    }
  }

  async function handleBulkStatus(nextStatus) {
    if (!selectedIds.length) return
    if (
      !window.confirm(`Update status to "${nextStatus}" for ${selectedIds.length} user(s)?`)
    ) {
      return
    }
    setBusyId('bulk')
    setBanner(null)
    try {
      for (const uid of selectedIds) {
        await updateUserAccountStatus(uid, nextStatus)
      }
      const set = new Set(selectedIds)
      setUsers((prev) =>
        prev.map((u) => (set.has(u.uid) ? { ...u, accountStatus: nextStatus } : u)),
      )
      setSelectedIds([])
      setBanner({
        type: 'success',
        text: `Updated ${set.size} account(s) to ${nextStatus}.`,
      })
    } catch (error) {
      setBanner({ type: 'error', text: error?.message || 'Bulk status update failed.' })
    } finally {
      setBusyId('')
    }
  }

  async function handleDeleteUser(u) {
    if (u.email?.toLowerCase() === SUPER_ADMIN_EMAIL) {
      setBanner({ type: 'error', text: 'Bootstrap Super Admin cannot be deleted.' })
      return
    }
    if (
      !window.confirm(
        `Permanently delete user profile for ${u.displayName || u.email}? This action cannot be undone.`,
      )
    ) {
      return
    }
    setBusyId(u.uid)
    setBanner(null)
    try {
      await deleteUserAccountDoc(u.uid, u.email, { ...currentUser, role: currentRole })
      setUsers((prev) => prev.filter((item) => item.uid !== u.uid))
      setSelectedIds((prev) => prev.filter((id) => id !== u.uid))
      if (profileUser?.uid === u.uid) setProfileUser(null)
      setBanner({ type: 'success', text: 'User profile deleted.' })
    } catch (error) {
      setBanner({ type: 'error', text: error?.message || 'Delete failed.' })
    } finally {
      setBusyId('')
    }
  }

  async function handleSaveEdit(event) {
    event.preventDefault()
    if (!profileUser) return
    setBusyId(profileUser.uid)
    setBanner(null)
    try {
      await updateUserDetails(profileUser.uid, editForm, { ...currentUser, role: currentRole })
      setUsers((prev) =>
        prev.map((u) => (u.uid === profileUser.uid ? { ...u, ...editForm } : u)),
      )
      setProfileUser((prev) => (prev ? { ...prev, ...editForm } : null))
      setEditingProfile(false)
      setBanner({ type: 'success', text: 'User profile updated.' })
    } catch (error) {
      setBanner({ type: 'error', text: error?.message || 'Unable to update user.' })
    } finally {
      setBusyId('')
    }
  }

  function handleExportCsv() {
    if (activeTab === 'quiz_report') {
      downloadCsv(
        `swadhyay-quiz-participation-${new Date().toISOString().slice(0, 10)}.csv`,
        ['Learner', 'Email', 'Quiz Name', 'Attempt Date', 'Score', 'Total Marks', 'Percentage', 'Time (s)', 'Status'],
        quizReportRows.map((r) => [
          r.userName,
          r.userEmail,
          r.quizName,
          formatDateTime(r.attemptDate),
          r.score,
          r.totalMarks,
          `${r.percentage}%`,
          r.durationSeconds,
          r.status,
        ]),
      )
      return
    }

    downloadCsv(
      `swadhyay-users-${new Date().toISOString().slice(0, 10)}.csv`,
      ['Full Name', 'Email', 'Role', 'Group', 'Status', 'Registered', 'Last Login', 'Quiz Attempts', 'PDF Downloads'],
      filteredUsers.map((u) => [
        u.displayName,
        u.email,
        u.role,
        u.userGroup,
        u.accountStatus,
        formatDateTime(u.createdAt),
        formatDateTime(u.lastLoginAt),
        u.quizAttemptsCount,
        u.downloadsCount,
      ]),
    )
  }

  return (
    <div className="users-manager">
      <section className="admin-page-head">
        <div>
          <h1>Users Management</h1>
          <p>
            Monitor registered learners, quiz participation, PDF downloads, and account status.
          </p>
        </div>
        <div className="cms-head-left">
          <div className="cms-filter-group" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'users'}
              className={activeTab === 'users' ? 'cms-tab-btn is-active' : 'cms-tab-btn'}
              onClick={() => setActiveTab('users')}
            >
              <Users size={14} style={{ marginRight: 6, verticalAlign: '-2px' }} />
              Registered Users ({users.length})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'quiz_report'}
              className={activeTab === 'quiz_report' ? 'cms-tab-btn is-active' : 'cms-tab-btn'}
              onClick={() => setActiveTab('quiz_report')}
            >
              <ClipboardList size={14} style={{ marginRight: 6, verticalAlign: '-2px' }} />
              Quiz Participation ({quizReportRows.length})
            </button>
          </div>
          <button type="button" className="admin-btn-secondary" onClick={handleExportCsv}>
            <Download size={15} />
            <span>Export CSV</span>
          </button>
          <button type="button" className="admin-btn-secondary" onClick={loadUsers}>
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

      {/* A. User Overview Summary Cards */}
      <section className="cmt-stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(175px, 1fr))' }}>
        <div className="cmt-stat-card">
          <span className="cmt-stat-icon is-total">
            <Users size={18} />
          </span>
          <div>
            <span className="cmt-stat-label">Total Registered</span>
            <strong className="cmt-stat-value">{summary.total}</strong>
          </div>
        </div>
        <div className="cmt-stat-card">
          <span className="cmt-stat-icon is-published">
            <UserCheck size={18} />
          </span>
          <div>
            <span className="cmt-stat-label">Active Accounts</span>
            <strong className="cmt-stat-value">{summary.active}</strong>
          </div>
        </div>
        <div className="cmt-stat-card">
          <span className="cmt-stat-icon is-rejected">
            <UserX size={18} />
          </span>
          <div>
            <span className="cmt-stat-label">Inactive Accounts</span>
            <strong className="cmt-stat-value">{summary.inactive}</strong>
          </div>
        </div>
        <div className="cmt-stat-card">
          <span className="cmt-stat-icon is-pending">
            <CheckCircle2 size={18} />
          </span>
          <div>
            <span className="cmt-stat-label">New (Today / Month)</span>
            <strong className="cmt-stat-value">
              {summary.newToday} / {summary.newMonth}
            </strong>
          </div>
        </div>
        <div className="cmt-stat-card">
          <span className="cmt-stat-icon is-spam">
            <Ban size={18} />
          </span>
          <div>
            <span className="cmt-stat-label">Suspended</span>
            <strong className="cmt-stat-value">{summary.suspended}</strong>
          </div>
        </div>
        <div className="cmt-stat-card">
          <span className="cmt-stat-icon is-total">
            <ClipboardList size={18} />
          </span>
          <div>
            <span className="cmt-stat-label">Quiz Participants</span>
            <strong className="cmt-stat-value">{summary.quizParticipants}</strong>
          </div>
        </div>
      </section>

      <section className="admin-card">
        <div className="cmt-toolbar">
          <label className="cmt-search-box">
            <Search size={15} />
            <input
              type="search"
              placeholder={
                activeTab === 'users'
                  ? 'Search by name, email, or group…'
                  : 'Search by learner or quiz name…'
              }
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>

          {activeTab === 'users' ? (
            <>
              <select
                className="cmt-filter-select"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">All Statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="suspended">Suspended</option>
              </select>
              <select
                className="cmt-filter-select"
                value={groupFilter}
                onChange={(e) => setGroupFilter(e.target.value)}
              >
                <option value="all">All Groups</option>
                {groups.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </>
          ) : null}
        </div>

        {activeTab === 'users' && selectedIds.length > 0 ? (
          <div className="cms-bulk-bar">
            <span>{selectedIds.length} user(s) selected</span>
            <div className="cms-form-actions">
              <button
                type="button"
                className="admin-btn-secondary"
                onClick={() => handleBulkStatus('active')}
                disabled={busyId === 'bulk'}
              >
                Activate
              </button>
              <button
                type="button"
                className="admin-btn-secondary"
                onClick={() => handleBulkStatus('inactive')}
                disabled={busyId === 'bulk'}
              >
                Deactivate
              </button>
              <button
                type="button"
                className="admin-btn-secondary cmt-btn-danger"
                onClick={() => handleBulkStatus('suspended')}
                disabled={busyId === 'bulk'}
              >
                Suspend
              </button>
              <button
                type="button"
                className="admin-btn-secondary"
                onClick={() => setSelectedIds([])}
              >
                Clear
              </button>
            </div>
          </div>
        ) : null}

        {loading ? (
          <p className="cms-muted">Loading user records…</p>
        ) : activeTab === 'users' ? (
          <>
            <div className="cms-table-wrap">
              <table className="cms-table">
                <thead>
                  <tr>
                    <th style={{ width: 34 }}>
                      <input
                        type="checkbox"
                        checked={
                          paginatedUsers.length > 0 &&
                          paginatedUsers.every((u) => selectedIds.includes(u.uid))
                        }
                        onChange={() => {
                          const allSelected = paginatedUsers.every((u) =>
                            selectedIds.includes(u.uid),
                          )
                          if (allSelected) {
                            const s = new Set(paginatedUsers.map((u) => u.uid))
                            setSelectedIds((prev) => prev.filter((id) => !s.has(id)))
                          } else {
                            setSelectedIds((prev) =>
                              Array.from(new Set([...prev, ...paginatedUsers.map((u) => u.uid)])),
                            )
                          }
                        }}
                        aria-label="Select page users"
                      />
                    </th>
                    <th>User</th>
                    <th>Registration Date</th>
                    <th>Last Login</th>
                    <th>Quiz Attempts</th>
                    <th>PDF Downloads</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedUsers.map((u) => (
                    <tr key={u.uid}>
                      <td>
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(u.uid)}
                          onChange={() =>
                            setSelectedIds((prev) =>
                              prev.includes(u.uid)
                                ? prev.filter((id) => id !== u.uid)
                                : [...prev, u.uid],
                            )
                          }
                          aria-label={`Select ${u.displayName}`}
                        />
                      </td>
                      <td>
                        <div className="usr-cell">
                          {u.photoURL ? (
                            <img
                              src={u.photoURL}
                              alt=""
                              className="auth-avatar"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <span className="auth-avatar auth-avatar-fallback">
                              {getInitials(u)}
                            </span>
                          )}
                          <div>
                            <strong>{u.displayName}</strong>
                            <div className="cms-subtext">
                              {u.email || '—'} · {u.userGroup}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="cmt-date-cell">{formatDateTime(u.createdAt)}</td>
                      <td className="cmt-date-cell">{formatDateTime(u.lastLoginAt)}</td>
                      <td>{u.quizAttemptsCount}</td>
                      <td>{u.downloadsCount}</td>
                      <td>
                        <span
                          className={`cms-badge ${
                            u.accountStatus === 'suspended'
                              ? 'cmt-status-spam'
                              : u.accountStatus === 'inactive'
                                ? 'cmt-status-rejected'
                                : 'is-published'
                          }`}
                        >
                          {u.accountStatus}
                        </span>
                      </td>
                      <td>
                        <div className="cms-row-actions">
                          <button
                            type="button"
                            className="cmt-action-btn"
                            title="View Profile"
                            onClick={() => openProfile(u)}
                          >
                            <Eye size={14} />
                          </button>
                          {u.accountStatus !== 'active' ? (
                            <button
                              type="button"
                              className="cmt-action-btn is-approve"
                              title="Activate / Restore"
                              onClick={() => handleStatusChange(u, 'active')}
                              disabled={busyId === u.uid}
                            >
                              <UserCheck size={14} />
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="cmt-action-btn is-spam"
                              title="Suspend Account"
                              onClick={() => handleStatusChange(u, 'suspended')}
                              disabled={busyId === u.uid}
                            >
                              <Ban size={14} />
                            </button>
                          )}
                          <button
                            type="button"
                            className="cmt-action-btn is-delete"
                            title="Delete Account"
                            onClick={() => handleDeleteUser(u)}
                            disabled={busyId === u.uid}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 ? (
              <div className="usr-pagination">
                <button
                  type="button"
                  className="admin-btn-secondary"
                  disabled={safePage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </button>
                <span className="cms-muted">
                  Page {safePage} of {totalPages}
                </span>
                <button
                  type="button"
                  className="admin-btn-secondary"
                  disabled={safePage >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next
                </button>
              </div>
            ) : null}
          </>
        ) : (
          /* E. Quiz Participation Report */
          <div className="cms-table-wrap">
            <table className="cms-table">
              <thead>
                <tr>
                  <th>Learner</th>
                  <th>Quiz Name</th>
                  <th>Attempt Date</th>
                  <th>Score</th>
                  <th>Percentage</th>
                  <th>Time Taken</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {quizReportRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="cms-muted">
                      No quiz participation records found.
                    </td>
                  </tr>
                ) : (
                  quizReportRows.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <strong>{row.userName}</strong>
                        <div className="cms-subtext">{row.userEmail}</div>
                      </td>
                      <td>{row.quizName}</td>
                      <td className="cmt-date-cell">{formatDateTime(row.attemptDate)}</td>
                      <td>
                        {row.score} / {row.totalMarks}
                      </td>
                      <td>
                        <strong>{row.percentage}%</strong>
                      </td>
                      <td>{row.durationSeconds}s</td>
                      <td>
                        <span className="cms-badge is-published">{row.status}</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* C. User Profile Details Modal */}
      {profileUser ? (
        <div className="admin-modal-backdrop" role="dialog" aria-modal="true">
          <div className="admin-modal-card">
            <div className="cms-card-head">
              <div className="usr-cell">
                {profileUser.photoURL ? (
                  <img
                    src={profileUser.photoURL}
                    alt=""
                    className="auth-avatar"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <span className="auth-avatar auth-avatar-fallback">
                    {getInitials(profileUser)}
                  </span>
                )}
                <div>
                  <h2 style={{ margin: 0 }}>{profileUser.displayName}</h2>
                  <p className="cms-subtext">{profileUser.email}</p>
                </div>
              </div>
              <div className="cms-form-actions">
                <button
                  type="button"
                  className="admin-btn-secondary"
                  onClick={() => setEditingProfile((prev) => !prev)}
                >
                  <Edit3 size={14} /> {editingProfile ? 'Cancel Edit' : 'Edit Details'}
                </button>
                <button
                  type="button"
                  className="admin-icon-btn"
                  onClick={() => setProfileUser(null)}
                  aria-label="Close"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {editingProfile ? (
              <form className="cms-form" onSubmit={handleSaveEdit}>
                <div className="cms-field-row">
                  <div className="cms-field">
                    <label>Full Name</label>
                    <input
                      value={editForm.displayName}
                      onChange={(e) =>
                        setEditForm((p) => ({ ...p, displayName: e.target.value }))
                      }
                      required
                    />
                  </div>
                  <div className="cms-field">
                    <label>User Group</label>
                    <input
                      value={editForm.userGroup}
                      onChange={(e) =>
                        setEditForm((p) => ({ ...p, userGroup: e.target.value }))
                      }
                      placeholder="e.g. UPSC, KVS, Class 12"
                    />
                  </div>
                </div>
                <div className="cms-field">
                  <label>Phone (optional)</label>
                  <input
                    value={editForm.phone}
                    onChange={(e) => setEditForm((p) => ({ ...p, phone: e.target.value }))}
                  />
                </div>
                <div className="cms-field">
                  <label>Bio / Notes</label>
                  <textarea
                    rows={2}
                    value={editForm.bio}
                    onChange={(e) => setEditForm((p) => ({ ...p, bio: e.target.value }))}
                  />
                </div>
                <button
                  type="submit"
                  className="admin-btn-primary"
                  disabled={busyId === profileUser.uid}
                >
                  Save Profile
                </button>
              </form>
            ) : (
              <>
                <div className="usr-profile-grid">
                  <div>
                    <span className="cms-subtext">Role</span>
                    <strong>{profileUser.role}</strong>
                  </div>
                  <div>
                    <span className="cms-subtext">Account Status</span>
                    <strong>{profileUser.accountStatus}</strong>
                  </div>
                  <div>
                    <span className="cms-subtext">Registered</span>
                    <strong>{formatDateTime(profileUser.createdAt)}</strong>
                  </div>
                  <div>
                    <span className="cms-subtext">Last Login</span>
                    <strong>{formatDateTime(profileUser.lastLoginAt)}</strong>
                  </div>
                  <div>
                    <span className="cms-subtext">Group</span>
                    <strong>{profileUser.userGroup || 'General'}</strong>
                  </div>
                  <div>
                    <span className="cms-subtext">Phone</span>
                    <strong>{profileUser.phone || '—'}</strong>
                  </div>
                </div>

                <h3 style={{ marginTop: 18, marginBottom: 8 }}>
                  Quiz Participation History ({profileUser.quizHistory.length})
                </h3>
                {profileUser.quizHistory.length === 0 ? (
                  <p className="cms-muted">No quiz attempts recorded.</p>
                ) : (
                  <div className="rbac-activity-list">
                    {profileUser.quizHistory.slice(0, 10).map((q) => (
                      <div key={q.id} className="rbac-activity-item">
                        <div>
                          <strong>{q.quizTitle || q.quizId}</strong>
                          <div className="cms-subtext">
                            Score: {q.score}/{q.maxScore} ({q.percentage}%) · {q.durationSeconds}s
                          </div>
                        </div>
                        <span className="cmt-date-cell">{formatDateTime(q.submittedAt)}</span>
                      </div>
                    ))}
                  </div>
                )}

                <h3 style={{ marginTop: 18, marginBottom: 8 }}>
                  Download History ({profileUser.downloadHistory.length})
                </h3>
                {profileUser.downloadHistory.length === 0 ? (
                  <p className="cms-muted">No PDF downloads recorded.</p>
                ) : (
                  <div className="rbac-activity-list">
                    {profileUser.downloadHistory.slice(0, 10).map((d) => (
                      <div key={d.id} className="rbac-activity-item">
                        <div>
                          <strong>{d.targetTitle || d.targetId}</strong>
                          <div className="cms-subtext">{d.category || 'Document'}</div>
                        </div>
                        <span className="cmt-date-cell">{formatDateTime(d.createdAt)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
