import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  History,
  Lock,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  UserPlus,
  UserX,
  X,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { ROLE_LABELS, SUPER_ADMIN_EMAIL } from '../config/constants.js'
import { listActivityLogs } from '../services/auditService.js'
import {
  DEFAULT_PERMISSION_MATRIX,
  PERMISSION_ACTIONS,
  PERMISSION_MODULES,
  assignAdminRole,
  getPermissionMatrix,
  listAllUsersForPermissions,
  savePermissionMatrix,
} from '../services/permissionService.js'
import { formatDate, toMillis } from '../utils/slugify.js'

const ASSIGNABLE_ROLES = ['admin', 'editor', 'author']

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

export default function PermissionsManager() {
  const { user, isSuperAdmin } = useAuth()
  const [activeTab, setActiveTab] = useState('admins') // 'admins' | 'matrix'
  const [allUsers, setAllUsers] = useState([])
  const [logs, setLogs] = useState([])
  const [matrix, setMatrix] = useState(DEFAULT_PERMISSION_MATRIX)
  const [matrixRole, setMatrixRole] = useState('admin')
  const [loading, setLoading] = useState(true)
  const [busyUid, setBusyUid] = useState('')
  const [savingMatrix, setSavingMatrix] = useState(false)
  const [banner, setBanner] = useState(null)

  // Add New Admin modal/inline form
  const [selectedCandidateUid, setSelectedCandidateUid] = useState('')
  const [candidateRole, setCandidateRole] = useState('editor')

  // Activity drawer
  const [activityTarget, setActivityTarget] = useState(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    setBanner(null)
    try {
      const [usersList, loadedMatrix, activityList] = await Promise.all([
        listAllUsersForPermissions(),
        getPermissionMatrix(),
        listActivityLogs().catch(() => []),
      ])
      setAllUsers(usersList)
      setMatrix(loadedMatrix)
      setLogs(activityList)
    } catch (error) {
      setBanner({ type: 'error', text: error?.message || 'Unable to load permissions.' })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!isSuperAdmin) return undefined
    const id = setTimeout(() => {
      void loadData()
    }, 0)
    return () => clearTimeout(id)
  }, [isSuperAdmin, loadData])

  const adminUsers = useMemo(() => {
    return allUsers
      .filter((u) => ['super_admin', 'admin', 'editor', 'author'].includes(u.role))
      .sort((a, b) => {
        if (a.role === 'super_admin') return -1
        if (b.role === 'super_admin') return 1
        return (a.displayName || a.email || '').localeCompare(b.displayName || b.email || '')
      })
  }, [allUsers])

  const studentCandidates = useMemo(() => {
    return allUsers
      .filter((u) => !['super_admin', 'admin', 'editor', 'author'].includes(u.role))
      .sort((a, b) => (a.displayName || a.email || '').localeCompare(b.displayName || b.email || ''))
  }, [allUsers])

  const targetLogs = useMemo(() => {
    if (!activityTarget) return []
    return logs.filter(
      (l) =>
        l.actorUid === activityTarget.id ||
        (activityTarget.email && l.actorEmail === activityTarget.email),
    )
  }, [logs, activityTarget])

  if (!isSuperAdmin) {
    return (
      <section className="admin-card">
        <div className="admin-alert" role="alert">
          <ShieldAlert size={18} style={{ marginRight: 8, verticalAlign: '-3px' }} />
          Access Restricted: Only a <strong>Super Admin</strong> can manage administrator roles
          and module permissions.
        </div>
      </section>
    )
  }

  async function handleAddAdmin(event) {
    event.preventDefault()
    const target = studentCandidates.find((u) => u.id === selectedCandidateUid)
    if (!target) return
    if (
      !window.confirm(
        `Grant ${ROLE_LABELS[candidateRole]} access to ${target.displayName || target.email}?`,
      )
    ) {
      return
    }

    setBusyUid(target.id)
    setBanner(null)
    try {
      await assignAdminRole({
        uid: target.id,
        email: target.email || '',
        displayName: target.displayName || '',
        role: candidateRole,
        accountStatus: 'active',
      })
      setSelectedCandidateUid('')
      await loadData()
      setBanner({
        type: 'success',
        text: `Assigned ${ROLE_LABELS[candidateRole]} role to ${target.email || target.id}.`,
      })
    } catch (error) {
      setBanner({ type: 'error', text: error?.message || 'Failed to assign admin role.' })
    } finally {
      setBusyUid('')
    }
  }

  async function handleRoleChange(adminUser, nextRole) {
    if (adminUser.email?.toLowerCase() === SUPER_ADMIN_EMAIL) return
    if (nextRole === adminUser.role) return
    if (
      !window.confirm(
        `Change role for ${adminUser.displayName || adminUser.email} from ${ROLE_LABELS[adminUser.role]} to ${ROLE_LABELS[nextRole]}?`,
      )
    ) {
      return
    }
    setBusyUid(adminUser.id)
    setBanner(null)
    try {
      await assignAdminRole({
        uid: adminUser.id,
        email: adminUser.email || '',
        displayName: adminUser.displayName || '',
        role: nextRole,
        accountStatus: adminUser.accountStatus || 'active',
      })
      await loadData()
      setBanner({ type: 'success', text: 'Admin role updated and logged.' })
    } catch (error) {
      setBanner({ type: 'error', text: error?.message || 'Failed to update role.' })
    } finally {
      setBusyUid('')
    }
  }

  async function handleToggleStatus(adminUser) {
    if (adminUser.email?.toLowerCase() === SUPER_ADMIN_EMAIL) return
    const nextStatus = adminUser.accountStatus === 'inactive' ? 'active' : 'inactive'
    if (
      !window.confirm(
        `${nextStatus === 'inactive' ? 'Deactivate' : 'Activate'} admin account for ${adminUser.email}?`,
      )
    ) {
      return
    }
    setBusyUid(adminUser.id)
    setBanner(null)
    try {
      await assignAdminRole({
        uid: adminUser.id,
        email: adminUser.email || '',
        displayName: adminUser.displayName || '',
        role: adminUser.role,
        accountStatus: nextStatus,
      })
      await loadData()
      setBanner({ type: 'success', text: `Admin account set to ${nextStatus}.` })
    } catch (error) {
      setBanner({ type: 'error', text: error?.message || 'Failed to update status.' })
    } finally {
      setBusyUid('')
    }
  }

  async function handleRevoke(adminUser) {
    if (adminUser.email?.toLowerCase() === SUPER_ADMIN_EMAIL) return
    if (
      !window.confirm(
        `Revoke all admin access for ${adminUser.displayName || adminUser.email} and revert to Student?`,
      )
    ) {
      return
    }
    setBusyUid(adminUser.id)
    setBanner(null)
    try {
      await assignAdminRole({
        uid: adminUser.id,
        email: adminUser.email || '',
        displayName: adminUser.displayName || '',
        role: 'student',
        accountStatus: 'active',
      })
      await loadData()
      setBanner({ type: 'success', text: 'Admin access revoked and logged.' })
    } catch (error) {
      setBanner({ type: 'error', text: error?.message || 'Failed to revoke access.' })
    } finally {
      setBusyUid('')
    }
  }

  function toggleMatrixCell(moduleId, action) {
    if (matrixRole === 'super_admin') return
    setMatrix((prev) => {
      const roleMap = { ...(prev[matrixRole] || {}) }
      const modPerms = { ...(roleMap[moduleId] || {}) }
      modPerms[action] = !modPerms[action]
      if (action !== 'view' && modPerms[action]) {
        modPerms.view = true
      }
      if (action === 'view' && !modPerms.view) {
        PERMISSION_ACTIONS.forEach((a) => {
          modPerms[a] = false
        })
      }
      roleMap[moduleId] = modPerms
      return { ...prev, [matrixRole]: roleMap }
    })
  }

  async function handleSaveMatrix() {
    setSavingMatrix(true)
    setBanner(null)
    try {
      await savePermissionMatrix(matrix, user)
      setBanner({ type: 'success', text: 'Permission matrix saved and logged.' })
    } catch (error) {
      setBanner({ type: 'error', text: error?.message || 'Failed to save permission matrix.' })
    } finally {
      setSavingMatrix(false)
    }
  }

  return (
    <div className="permissions-manager">
      <section className="admin-page-head">
        <div>
          <h1>Admin Users &amp; Permissions</h1>
          <p>
            Super Admin–only RBAC console to assign roles, revoke access, and configure
            module-level permissions.
          </p>
        </div>
        <div className="cms-head-left">
          <div className="cms-filter-group" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'admins'}
              className={activeTab === 'admins' ? 'cms-tab-btn is-active' : 'cms-tab-btn'}
              onClick={() => setActiveTab('admins')}
            >
              <ShieldCheck size={14} style={{ marginRight: 6, verticalAlign: '-2px' }} />
              Admin Users ({adminUsers.length})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'matrix'}
              className={activeTab === 'matrix' ? 'cms-tab-btn is-active' : 'cms-tab-btn'}
              onClick={() => setActiveTab('matrix')}
            >
              <Lock size={14} style={{ marginRight: 6, verticalAlign: '-2px' }} />
              Permission Matrix
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

      {activeTab === 'admins' ? (
        <>
          <section className="admin-card" style={{ marginBottom: 16 }}>
            <div className="cms-card-head">
              <div>
                <h2>Add New Admin User</h2>
                <p className="cms-muted">
                  Select a registered user to grant Admin, Editor, or Author privileges.
                </p>
              </div>
            </div>
            <form className="rbac-add-form" onSubmit={handleAddAdmin}>
              <select
                className="cmt-filter-select"
                value={selectedCandidateUid}
                onChange={(e) => setSelectedCandidateUid(e.target.value)}
                required
              >
                <option value="">Select registered user…</option>
                {studentCandidates.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.displayName || 'Unnamed'} ({u.email || u.id})
                  </option>
                ))}
              </select>
              <select
                className="cmt-filter-select"
                value={candidateRole}
                onChange={(e) => setCandidateRole(e.target.value)}
              >
                {ASSIGNABLE_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                className="admin-btn-primary"
                disabled={!selectedCandidateUid || Boolean(busyUid)}
              >
                <UserPlus size={15} />
                <span>Assign Role</span>
              </button>
            </form>
          </section>

          <section className="admin-card">
            <div className="cms-card-head">
              <h2>Active Administrators</h2>
            </div>
            {loading ? (
              <p className="cms-muted">Loading administrator directory…</p>
            ) : (
              <div className="cms-table-wrap">
                <table className="cms-table">
                  <thead>
                    <tr>
                      <th>Admin User</th>
                      <th>Role</th>
                      <th>Status</th>
                      <th>Last Login</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {adminUsers.map((adminUser) => {
                      const isBootstrap =
                        adminUser.email?.toLowerCase() === SUPER_ADMIN_EMAIL
                      const isBusy = busyUid === adminUser.id
                      return (
                        <tr key={adminUser.id}>
                          <td>
                            <strong>{adminUser.displayName || 'Admin'}</strong>
                            <div className="cms-subtext">{adminUser.email || adminUser.id}</div>
                          </td>
                          <td>
                            {isBootstrap ? (
                              <span className="cms-badge is-published">
                                Super Admin (Protected)
                              </span>
                            ) : (
                              <select
                                className="cmt-filter-select"
                                value={adminUser.role}
                                onChange={(e) => handleRoleChange(adminUser, e.target.value)}
                                disabled={isBusy}
                              >
                                {ASSIGNABLE_ROLES.map((r) => (
                                  <option key={r} value={r}>
                                    {ROLE_LABELS[r]}
                                  </option>
                                ))}
                              </select>
                            )}
                          </td>
                          <td>
                            <span
                              className={`cms-badge ${
                                adminUser.accountStatus === 'inactive'
                                  ? 'cmt-status-spam'
                                  : 'is-published'
                              }`}
                            >
                              {adminUser.accountStatus || 'active'}
                            </span>
                          </td>
                          <td className="cmt-date-cell">
                            {formatDateTime(adminUser.lastLoginAt)}
                          </td>
                          <td>
                            <div className="cms-row-actions">
                              <button
                                type="button"
                                className="cmt-action-btn"
                                title="View Admin Activity"
                                onClick={() => setActivityTarget(adminUser)}
                              >
                                <History size={14} />
                              </button>
                              {!isBootstrap ? (
                                <>
                                  <button
                                    type="button"
                                    className="cmt-action-btn"
                                    title={
                                      adminUser.accountStatus === 'inactive'
                                        ? 'Activate Admin'
                                        : 'Deactivate Admin'
                                    }
                                    onClick={() => handleToggleStatus(adminUser)}
                                    disabled={isBusy}
                                  >
                                    <UserCheck size={14} />
                                  </button>
                                  <button
                                    type="button"
                                    className="cmt-action-btn is-delete"
                                    title="Revoke Admin Access"
                                    onClick={() => handleRevoke(adminUser)}
                                    disabled={isBusy}
                                  >
                                    <UserX size={14} />
                                  </button>
                                </>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      ) : (
        <section className="admin-card">
          <div className="cms-card-head">
            <div>
              <h2>Role Permission Matrix</h2>
              <p className="cms-muted">
                Configure module-wise View, Create, Edit, Delete, Publish, and Manage
                capabilities.
              </p>
            </div>
            <div className="cms-filter-group">
              {['super_admin', 'admin', 'editor', 'author'].map((r) => (
                <button
                  key={r}
                  type="button"
                  className={matrixRole === r ? 'cms-tab-btn is-active' : 'cms-tab-btn'}
                  onClick={() => setMatrixRole(r)}
                >
                  {ROLE_LABELS[r]}
                </button>
              ))}
            </div>
          </div>

          <div className="cms-table-wrap">
            <table className="cms-table rbac-matrix-table">
              <thead>
                <tr>
                  <th>Module</th>
                  {PERMISSION_ACTIONS.map((action) => (
                    <th key={action} style={{ textAlign: 'center' }}>
                      {action}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PERMISSION_MODULES.map((mod) => {
                  const perms = matrix?.[matrixRole]?.[mod.id] || {}
                  const locked = matrixRole === 'super_admin' || mod.id === 'permissions'
                  return (
                    <tr key={mod.id}>
                      <td>
                        <strong>{mod.label}</strong>
                      </td>
                      {PERMISSION_ACTIONS.map((action) => (
                        <td key={action} style={{ textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            checked={Boolean(perms[action])}
                            disabled={locked}
                            onChange={() => toggleMatrixCell(mod.id, action)}
                            aria-label={`${ROLE_LABELS[matrixRole]} ${mod.label} ${action}`}
                          />
                        </td>
                      ))}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="cms-form-actions" style={{ marginTop: 14 }}>
            <button
              type="button"
              className="admin-btn-primary"
              onClick={handleSaveMatrix}
              disabled={savingMatrix}
            >
              {savingMatrix ? 'Saving Matrix…' : 'Save Permission Matrix'}
            </button>
          </div>
        </section>
      )}

      {activityTarget ? (
        <div className="admin-modal-backdrop" role="dialog" aria-modal="true">
          <div className="admin-modal-card">
            <div className="cms-card-head">
              <div>
                <h2>Admin Activity: {activityTarget.displayName || activityTarget.email}</h2>
                <p className="cms-subtext">{activityTarget.email}</p>
              </div>
              <button
                type="button"
                className="admin-icon-btn"
                onClick={() => setActivityTarget(null)}
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>
            {targetLogs.length === 0 ? (
              <p className="cms-muted">No recorded activity logs for this administrator yet.</p>
            ) : (
              <div className="rbac-activity-list">
                {targetLogs.slice(0, 25).map((item) => (
                  <div key={item.id} className="rbac-activity-item">
                    <div>
                      <strong>{item.action}</strong> · <span>{item.module}</span>
                      <p className="cms-subtext">{item.description}</p>
                    </div>
                    <span className="cmt-date-cell">{formatDateTime(item.createdAt)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
