import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  BellRing,
  Check,
  CheckCircle2,
  Clock,
  Edit3,
  Flag,
  Lock,
  MessageSquare,
  RefreshCw,
  Reply,
  Search,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  X,
  XCircle,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { listPosts } from '../services/cmsService.js'
import {
  DEFAULT_COMMENT_SETTINGS,
  bulkDeleteComments,
  bulkUpdateCommentStatus,
  deleteAdminReply,
  deleteComment,
  getCommentSettings,
  listAllComments,
  saveAdminReply,
  saveCommentSettings,
  toggleCommentFlag,
  togglePostCommentsEnabled,
  updateCommentStatus,
} from '../services/commentService.js'
import { formatDate, toMillis } from '../utils/slugify.js'

const STATUS_LABELS = {
  published: 'Published',
  pending: 'Pending',
  rejected: 'Rejected',
  spam: 'Spam',
}

function formatDateTime(value) {
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
    }).format(new Date(ms))
  } catch {
    return formatDate(value)
  }
}

export default function CommentsManager() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('comments') // 'comments' | 'settings'
  const [comments, setComments] = useState([])
  const [posts, setPosts] = useState([])
  const [settings, setSettings] = useState(DEFAULT_COMMENT_SETTINGS)
  const [keywordsInput, setKeywordsInput] = useState(
    DEFAULT_COMMENT_SETTINGS.spamKeywords.join(', '),
  )

  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState('')
  const [savingSettings, setSavingSettings] = useState(false)
  const [banner, setBanner] = useState(null)

  // Filters & Search
  const [statusFilter, setStatusFilter] = useState('all')
  const [postFilter, setPostFilter] = useState('all')
  const [dateFilter, setDateFilter] = useState('all') // 'all' | 'today' | '7d' | '30d' | 'custom'
  const [customDate, setCustomDate] = useState('')
  const [keywordFilter, setKeywordFilter] = useState('')
  const [searchTerm, setSearchTerm] = useState('')

  // Bulk Selection
  const [selectedIds, setSelectedIds] = useState([])

  // Reply Management
  const [replyingId, setReplyingId] = useState('')
  const [replyDraft, setReplyDraft] = useState('')

  // Per-post settings filter
  const [postSettingsSearch, setPostSettingsSearch] = useState('')

  const loadData = useCallback(async () => {
    setLoading(true)
    setBanner(null)
    try {
      const [commentRows, postRows, loadedSettings] = await Promise.all([
        listAllComments(),
        listPosts().catch(() => []),
        getCommentSettings(),
      ])
      setComments(commentRows)
      setPosts(postRows)
      setSettings(loadedSettings)
      setKeywordsInput((loadedSettings.spamKeywords || []).join(', '))
    } catch (error) {
      setBanner({
        type: 'error',
        text: error?.message || 'Unable to load comments right now.',
      })
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

  // Summary Counts (Dashboard A)
  const summary = useMemo(() => {
    let published = 0
    let pending = 0
    let spamOrFlagged = 0
    let rejected = 0
    let newlySubmitted = 0

    comments.forEach((c) => {
      if (c.status === 'published') published += 1
      else if (c.status === 'pending') pending += 1
      else if (c.status === 'rejected') rejected += 1
      if (c.status === 'spam' || c.flagged) spamOrFlagged += 1
      if (c.isNew || c.status === 'pending') newlySubmitted += 1
    })

    return {
      total: comments.length,
      published,
      pending,
      spamOrFlagged,
      rejected,
      newlySubmitted,
    }
  }, [comments])

  // Unique posts referenced in comments + CMS posts
  const postOptions = useMemo(() => {
    const map = new Map()
    posts.forEach((p) => {
      map.set(p.id, p.title || 'Untitled Post')
    })
    comments.forEach((c) => {
      if (c.postId && !map.has(c.postId)) {
        map.set(c.postId, c.postTitle || 'Untitled Post')
      }
    })
    return Array.from(map.entries()).map(([id, title]) => ({ id, title }))
  }, [posts, comments])

  const [mountNow] = useState(() => Date.now())

  // Filtered comments
  const filteredComments = useMemo(() => {
    const search = searchTerm.trim().toLowerCase()
    const kw = keywordFilter.trim().toLowerCase()
    const now = mountNow
    const startOfToday = new Date(now)
    startOfToday.setHours(0, 0, 0, 0)

    return comments.filter((c) => {
      if (statusFilter === 'flagged') {
        if (!c.flagged && c.status !== 'spam') return false
      } else if (statusFilter !== 'all' && c.status !== statusFilter) {
        return false
      }

      if (postFilter !== 'all' && c.postId !== postFilter) {
        return false
      }

      if (dateFilter !== 'all') {
        const ms = toMillis(c.createdAt)
        if (!ms) return false
        if (dateFilter === 'today' && ms < startOfToday.getTime()) return false
        if (dateFilter === '7d' && ms < now - 7 * 86400000) return false
        if (dateFilter === '30d' && ms < now - 30 * 86400000) return false
        if (dateFilter === 'custom' && customDate) {
          const dayStart = new Date(`${customDate}T00:00:00`).getTime()
          const dayEnd = dayStart + 86400000
          if (ms < dayStart || ms >= dayEnd) return false
        }
      }

      if (kw) {
        const hay = `${c.content || ''} ${c.postTitle || ''} ${c.adminReply?.text || ''}`.toLowerCase()
        if (!hay.includes(kw)) return false
      }

      if (search) {
        const hay = `${c.authorName || ''} ${c.authorEmail || ''} ${c.content || ''}`.toLowerCase()
        if (!hay.includes(search)) return false
      }

      return true
    })
  }, [comments, statusFilter, postFilter, dateFilter, customDate, keywordFilter, searchTerm, mountNow])

  const allVisibleSelected =
    filteredComments.length > 0 &&
    filteredComments.every((c) => selectedIds.includes(c.id))

  function toggleSelectAll() {
    if (allVisibleSelected) {
      const visibleSet = new Set(filteredComments.map((c) => c.id))
      setSelectedIds((prev) => prev.filter((id) => !visibleSet.has(id)))
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev)
        filteredComments.forEach((c) => next.add(c.id))
        return Array.from(next)
      })
    }
  }

  function toggleSelectOne(id) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    )
  }

  async function handleStatusChange(commentId, nextStatus) {
    setBusyId(commentId)
    setBanner(null)
    try {
      await updateCommentStatus(commentId, nextStatus)
      setComments((prev) =>
        prev.map((c) =>
          c.id === commentId
            ? { ...c, status: nextStatus, flagged: nextStatus === 'spam', isNew: false }
            : c,
        ),
      )
      setBanner({
        type: 'success',
        text: `Comment marked as ${STATUS_LABELS[nextStatus] || nextStatus}.`,
      })
    } catch (error) {
      setBanner({ type: 'error', text: error?.message || 'Failed to update comment status.' })
    } finally {
      setBusyId('')
    }
  }

  async function handleToggleFlag(comment) {
    const nextFlagged = !comment.flagged
    setBusyId(comment.id)
    setBanner(null)
    try {
      await toggleCommentFlag(comment.id, nextFlagged)
      setComments((prev) =>
        prev.map((c) =>
          c.id === comment.id ? { ...c, flagged: nextFlagged, isNew: false } : c,
        ),
      )
      setBanner({
        type: 'success',
        text: nextFlagged
          ? 'Comment flagged as inappropriate.'
          : 'Inappropriate flag removed.',
      })
    } catch (error) {
      setBanner({ type: 'error', text: error?.message || 'Failed to update flag.' })
    } finally {
      setBusyId('')
    }
  }

  async function handleDeleteOne(commentId) {
    if (!window.confirm('Permanently delete this comment and any admin reply?')) return
    setBusyId(commentId)
    setBanner(null)
    try {
      await deleteComment(commentId)
      setComments((prev) => prev.filter((c) => c.id !== commentId))
      setSelectedIds((prev) => prev.filter((id) => id !== commentId))
      setBanner({ type: 'success', text: 'Comment deleted permanently.' })
    } catch (error) {
      setBanner({ type: 'error', text: error?.message || 'Failed to delete comment.' })
    } finally {
      setBusyId('')
    }
  }

  async function handleBulkStatus(nextStatus) {
    if (!selectedIds.length) return
    setBusyId('bulk')
    setBanner(null)
    try {
      await bulkUpdateCommentStatus(selectedIds, nextStatus)
      const idSet = new Set(selectedIds)
      setComments((prev) =>
        prev.map((c) =>
          idSet.has(c.id)
            ? { ...c, status: nextStatus, flagged: nextStatus === 'spam', isNew: false }
            : c,
        ),
      )
      setSelectedIds([])
      setBanner({
        type: 'success',
        text: `${idSet.size} comment(s) marked as ${STATUS_LABELS[nextStatus]}.`,
      })
    } catch (error) {
      setBanner({ type: 'error', text: error?.message || 'Bulk action failed.' })
    } finally {
      setBusyId('')
    }
  }

  async function handleBulkDelete() {
    if (!selectedIds.length) return
    if (!window.confirm(`Delete ${selectedIds.length} selected comment(s) permanently?`)) return
    setBusyId('bulk')
    setBanner(null)
    try {
      await bulkDeleteComments(selectedIds)
      const idSet = new Set(selectedIds)
      setComments((prev) => prev.filter((c) => !idSet.has(c.id)))
      setSelectedIds([])
      setBanner({ type: 'success', text: `${idSet.size} comment(s) deleted.` })
    } catch (error) {
      setBanner({ type: 'error', text: error?.message || 'Bulk delete failed.' })
    } finally {
      setBusyId('')
    }
  }

  function openReplyBox(comment) {
    setReplyingId(comment.id)
    setReplyDraft(comment.adminReply?.text || '')
  }

  async function handleSaveReply(comment) {
    if (!replyDraft.trim()) return
    setBusyId(comment.id)
    setBanner(null)
    try {
      const savedReply = await saveAdminReply(
        comment.id,
        replyDraft,
        user,
        comment.adminReply,
      )
      setComments((prev) =>
        prev.map((c) =>
          c.id === comment.id ? { ...c, adminReply: savedReply, isNew: false } : c,
        ),
      )
      setReplyingId('')
      setReplyDraft('')
      setBanner({
        type: 'success',
        text: comment.adminReply ? 'Admin reply updated.' : 'Admin reply posted.',
      })
    } catch (error) {
      setBanner({ type: 'error', text: error?.message || 'Failed to save reply.' })
    } finally {
      setBusyId('')
    }
  }

  async function handleDeleteReply(commentId) {
    if (!window.confirm('Delete this admin reply?')) return
    setBusyId(commentId)
    setBanner(null)
    try {
      await deleteAdminReply(commentId)
      setComments((prev) =>
        prev.map((c) => (c.id === commentId ? { ...c, adminReply: null } : c)),
      )
      setBanner({ type: 'success', text: 'Admin reply deleted.' })
    } catch (error) {
      setBanner({ type: 'error', text: error?.message || 'Failed to delete reply.' })
    } finally {
      setBusyId('')
    }
  }

  async function handleSaveSettings(event) {
    event.preventDefault()
    setSavingSettings(true)
    setBanner(null)
    try {
      const parsedKeywords = keywordsInput
        .split(',')
        .map((k) => k.trim())
        .filter(Boolean)
      const nextSettings = {
        ...settings,
        spamKeywords: parsedKeywords,
        allowUserEditing: false,
      }
      await saveCommentSettings(nextSettings, user)
      setSettings(nextSettings)
      setBanner({ type: 'success', text: 'Comment settings saved.' })
    } catch (error) {
      setBanner({ type: 'error', text: error?.message || 'Unable to save comment settings.' })
    } finally {
      setSavingSettings(false)
    }
  }

  async function handleTogglePostComments(post) {
    const nextEnabled = post.commentsEnabled === false
    setBusyId(`post-${post.id}`)
    setBanner(null)
    try {
      await togglePostCommentsEnabled(post.id, nextEnabled)
      setPosts((prev) =>
        prev.map((p) => (p.id === post.id ? { ...p, commentsEnabled: nextEnabled } : p)),
      )
      setBanner({
        type: 'success',
        text: `Comments ${nextEnabled ? 'enabled' : 'disabled'} for "${post.title}".`,
      })
    } catch (error) {
      setBanner({ type: 'error', text: error?.message || 'Failed to update post setting.' })
    } finally {
      setBusyId('')
    }
  }

  const filteredPostsForSettings = useMemo(() => {
    const q = postSettingsSearch.trim().toLowerCase()
    if (!q) return posts
    return posts.filter(
      (p) =>
        (p.title || '').toLowerCase().includes(q) ||
        (p.slug || '').toLowerCase().includes(q),
    )
  }, [posts, postSettingsSearch])

  return (
    <div className="comments-manager">
      <section className="admin-page-head">
        <div>
          <h1>Comments Management</h1>
          <p>
            Moderate reader comments, post official admin replies, filter spam, and configure
            comment policies.
          </p>
        </div>

        <div className="cms-head-left">
          <div className="cms-filter-group" role="tablist" aria-label="Comments views">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'comments'}
              className={activeTab === 'comments' ? 'cms-tab-btn is-active' : 'cms-tab-btn'}
              onClick={() => setActiveTab('comments')}
            >
              <MessageSquare size={14} style={{ marginRight: 6, verticalAlign: '-2px' }} />
              Comments ({summary.total})
              {summary.pending > 0 ? (
                <span className="cmt-tab-count">{summary.pending}</span>
              ) : null}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'settings'}
              className={activeTab === 'settings' ? 'cms-tab-btn is-active' : 'cms-tab-btn'}
              onClick={() => setActiveTab('settings')}
            >
              <Settings size={14} style={{ marginRight: 6, verticalAlign: '-2px' }} />
              Comment Settings
            </button>
          </div>

          <button
            type="button"
            className="admin-btn-secondary"
            onClick={loadData}
            disabled={loading}
          >
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
              : 'admin-alert cmt-alert-success'
          }
          role="status"
        >
          <span>{banner.text}</span>
          <button
            type="button"
            className="cmt-alert-close"
            onClick={() => setBanner(null)}
            aria-label="Dismiss message"
          >
            <X size={15} />
          </button>
        </div>
      ) : null}

      {/* F. Pending Comments Notification Banner */}
      {summary.pending > 0 && activeTab === 'comments' ? (
        <div className="cmt-pending-banner">
          <div className="cmt-pending-banner-copy">
            <BellRing size={18} />
            <span>
              <strong>{summary.pending}</strong> comment
              {summary.pending > 1 ? 's' : ''} awaiting moderation approval. Newly submitted
              comments are highlighted below.
            </span>
          </div>
          <button
            type="button"
            className="admin-btn-secondary"
            onClick={() => setStatusFilter(statusFilter === 'pending' ? 'all' : 'pending')}
          >
            {statusFilter === 'pending' ? 'Show All Comments' : 'Review Pending'}
          </button>
        </div>
      ) : null}

      {/* A. Comment Dashboard Summary Cards */}
      <section className="cmt-stats-grid" aria-label="Comment summary">
        <button
          type="button"
          className={`cmt-stat-card ${statusFilter === 'all' ? 'is-selected' : ''}`}
          onClick={() => {
            setActiveTab('comments')
            setStatusFilter('all')
          }}
        >
          <span className="cmt-stat-icon is-total">
            <MessageSquare size={18} />
          </span>
          <div>
            <span className="cmt-stat-label">Total Comments</span>
            <strong className="cmt-stat-value">{summary.total}</strong>
          </div>
        </button>

        <button
          type="button"
          className={`cmt-stat-card ${statusFilter === 'published' ? 'is-selected' : ''}`}
          onClick={() => {
            setActiveTab('comments')
            setStatusFilter('published')
          }}
        >
          <span className="cmt-stat-icon is-published">
            <CheckCircle2 size={18} />
          </span>
          <div>
            <span className="cmt-stat-label">Published</span>
            <strong className="cmt-stat-value">{summary.published}</strong>
          </div>
        </button>

        <button
          type="button"
          className={`cmt-stat-card ${statusFilter === 'pending' ? 'is-selected' : ''}`}
          onClick={() => {
            setActiveTab('comments')
            setStatusFilter('pending')
          }}
        >
          <span className="cmt-stat-icon is-pending">
            <Clock size={18} />
          </span>
          <div>
            <span className="cmt-stat-label">Pending Approval</span>
            <strong className="cmt-stat-value">{summary.pending}</strong>
          </div>
        </button>

        <button
          type="button"
          className={`cmt-stat-card ${statusFilter === 'flagged' ? 'is-selected' : ''}`}
          onClick={() => {
            setActiveTab('comments')
            setStatusFilter('flagged')
          }}
        >
          <span className="cmt-stat-icon is-spam">
            <ShieldAlert size={18} />
          </span>
          <div>
            <span className="cmt-stat-label">Spam / Flagged</span>
            <strong className="cmt-stat-value">{summary.spamOrFlagged}</strong>
          </div>
        </button>

        <button
          type="button"
          className={`cmt-stat-card ${statusFilter === 'rejected' ? 'is-selected' : ''}`}
          onClick={() => {
            setActiveTab('comments')
            setStatusFilter('rejected')
          }}
        >
          <span className="cmt-stat-icon is-rejected">
            <XCircle size={18} />
          </span>
          <div>
            <span className="cmt-stat-label">Rejected</span>
            <strong className="cmt-stat-value">{summary.rejected}</strong>
          </div>
        </button>
      </section>

      {activeTab === 'comments' ? (
        <section className="admin-card">
          {/* C. Filter & Search Toolbar */}
          <div className="cmt-toolbar">
            <label className="cmt-search-box" aria-label="Search comments">
              <Search size={15} />
              <input
                type="search"
                placeholder="Search reader name, email, or comment…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </label>

            <input
              type="text"
              className="cmt-filter-input"
              placeholder="Filter by keyword…"
              value={keywordFilter}
              onChange={(e) => setKeywordFilter(e.target.value)}
              aria-label="Filter by keyword"
            />

            <select
              className="cmt-filter-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Filter by status"
            >
              <option value="all">All Statuses</option>
              <option value="published">Published</option>
              <option value="pending">Pending Approval</option>
              <option value="rejected">Rejected</option>
              <option value="spam">Spam</option>
              <option value="flagged">Spam / Flagged</option>
            </select>

            <select
              className="cmt-filter-select"
              value={postFilter}
              onChange={(e) => setPostFilter(e.target.value)}
              aria-label="Filter by post"
            >
              <option value="all">All Posts / Articles</option>
              {postOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>

            <select
              className="cmt-filter-select"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              aria-label="Filter by date"
            >
              <option value="all">All Dates</option>
              <option value="today">Today</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="custom">Specific Date</option>
            </select>

            {dateFilter === 'custom' ? (
              <input
                type="date"
                className="cmt-filter-input"
                value={customDate}
                onChange={(e) => setCustomDate(e.target.value)}
                aria-label="Pick date"
              />
            ) : null}
          </div>

          {/* Bulk Actions Bar */}
          {selectedIds.length > 0 ? (
            <div className="cms-bulk-bar">
              <span>{selectedIds.length} comment(s) selected</span>
              <div className="cms-form-actions">
                <button
                  type="button"
                  className="admin-btn-secondary"
                  onClick={() => handleBulkStatus('published')}
                  disabled={busyId === 'bulk'}
                >
                  <Check size={14} /> Approve
                </button>
                <button
                  type="button"
                  className="admin-btn-secondary"
                  onClick={() => handleBulkStatus('rejected')}
                  disabled={busyId === 'bulk'}
                >
                  <XCircle size={14} /> Reject
                </button>
                <button
                  type="button"
                  className="admin-btn-secondary"
                  onClick={() => handleBulkStatus('spam')}
                  disabled={busyId === 'bulk'}
                >
                  <AlertTriangle size={14} /> Mark Spam
                </button>
                <button
                  type="button"
                  className="admin-btn-secondary cmt-btn-danger"
                  onClick={handleBulkDelete}
                  disabled={busyId === 'bulk'}
                >
                  <Trash2 size={14} /> Delete
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

          {/* B. Comments Table */}
          {loading ? (
            <p className="cms-muted">Loading reader comments…</p>
          ) : filteredComments.length === 0 ? (
            <div className="cmt-empty-state">
              <MessageSquare size={28} />
              <h3>No comments match your filters</h3>
              <p>
                {comments.length === 0
                  ? 'Reader comments submitted on published articles will appear here for moderation.'
                  : 'Try clearing the search or status/date filters.'}
              </p>
            </div>
          ) : (
            <div className="cms-table-wrap">
              <table className="cms-table cmt-table">
                <thead>
                  <tr>
                    <th style={{ width: 36 }}>
                      <input
                        type="checkbox"
                        checked={allVisibleSelected}
                        onChange={toggleSelectAll}
                        aria-label="Select all visible comments"
                      />
                    </th>
                    <th>Reader</th>
                    <th>Comment &amp; Admin Reply</th>
                    <th>Post / Article</th>
                    <th>Date</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredComments.map((comment) => {
                    const isRowBusy = busyId === comment.id
                    const isHighlighted = comment.isNew || comment.status === 'pending'
                    const isReplying = replyingId === comment.id

                    return (
                      <tr
                        key={comment.id}
                        className={isHighlighted ? 'cmt-row-new' : undefined}
                      >
                        <td>
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(comment.id)}
                            onChange={() => toggleSelectOne(comment.id)}
                            aria-label={`Select comment by ${comment.authorName}`}
                          />
                        </td>

                        <td>
                          <div className="cmt-reader-cell">
                            <div className="cmt-reader-name">
                              <strong>{comment.authorName || 'Reader'}</strong>
                              {isHighlighted ? (
                                <span className="cmt-new-badge">NEW</span>
                              ) : null}
                              {comment.flagged ? (
                                <span
                                  className="cmt-flag-badge"
                                  title="Flagged as inappropriate"
                                >
                                  <Flag size={11} /> Flagged
                                </span>
                              ) : null}
                            </div>
                            <span className="cms-subtext">
                              {comment.authorEmail || 'Guest reader'}
                            </span>
                          </div>
                        </td>

                        <td className="cmt-content-cell">
                          <p className="cmt-body-text">{comment.content}</p>

                          {/* D. Admin Reply Display */}
                          {comment.adminReply ? (
                            <div className="cmt-admin-reply-box">
                              <div className="cmt-admin-reply-head">
                                <span className="cmt-admin-reply-badge">
                                  <ShieldCheck size={12} /> Admin Reply
                                </span>
                                <span className="cmt-admin-reply-meta">
                                  {comment.adminReply.authorName} ·{' '}
                                  {formatDateTime(
                                    comment.adminReply.updatedAt ||
                                      comment.adminReply.createdAt,
                                  )}
                                </span>
                                <div className="cmt-admin-reply-actions">
                                  <button
                                    type="button"
                                    className="cmt-inline-link"
                                    onClick={() => openReplyBox(comment)}
                                    disabled={isRowBusy}
                                  >
                                    <Edit3 size={12} /> Edit
                                  </button>
                                  <button
                                    type="button"
                                    className="cmt-inline-link is-danger"
                                    onClick={() => handleDeleteReply(comment.id)}
                                    disabled={isRowBusy}
                                  >
                                    <Trash2 size={12} /> Delete
                                  </button>
                                </div>
                              </div>
                              <p className="cmt-admin-reply-text">
                                {comment.adminReply.text}
                              </p>
                            </div>
                          ) : null}

                          {/* D. Inline Reply / Edit Reply Composer */}
                          {isReplying ? (
                            <div className="cmt-reply-composer">
                              <textarea
                                rows={3}
                                placeholder="Write an official admin reply…"
                                value={replyDraft}
                                onChange={(e) => setReplyDraft(e.target.value)}
                              />
                              <div className="cms-form-actions">
                                <button
                                  type="button"
                                  className="admin-btn-primary"
                                  onClick={() => handleSaveReply(comment)}
                                  disabled={isRowBusy || !replyDraft.trim()}
                                >
                                  {comment.adminReply ? 'Update Reply' : 'Post Reply'}
                                </button>
                                <button
                                  type="button"
                                  className="admin-btn-secondary"
                                  onClick={() => {
                                    setReplyingId('')
                                    setReplyDraft('')
                                  }}
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : null}
                        </td>

                        <td>
                          <span className="cmt-post-title">
                            {comment.postTitle || 'Untitled Post'}
                          </span>
                        </td>

                        <td className="cmt-date-cell">
                          {formatDateTime(comment.createdAt)}
                        </td>

                        <td>
                          <span className={`cms-badge cmt-status-${comment.status}`}>
                            {STATUS_LABELS[comment.status] || comment.status}
                          </span>
                        </td>

                        <td>
                          <div className="cmt-actions-grid">
                            {comment.status !== 'published' ? (
                              <button
                                type="button"
                                className="cmt-action-btn is-approve"
                                title="Approve comment"
                                onClick={() => handleStatusChange(comment.id, 'published')}
                                disabled={isRowBusy}
                              >
                                <Check size={14} />
                              </button>
                            ) : null}

                            {comment.status !== 'rejected' ? (
                              <button
                                type="button"
                                className="cmt-action-btn is-reject"
                                title="Reject comment"
                                onClick={() => handleStatusChange(comment.id, 'rejected')}
                                disabled={isRowBusy}
                              >
                                <XCircle size={14} />
                              </button>
                            ) : null}

                            <button
                              type="button"
                              className="cmt-action-btn"
                              title={comment.adminReply ? 'Edit reply' : 'Reply'}
                              onClick={() => openReplyBox(comment)}
                              disabled={isRowBusy}
                            >
                              <Reply size={14} />
                            </button>

                            <button
                              type="button"
                              className={`cmt-action-btn ${comment.flagged ? 'is-flagged' : ''}`}
                              title={
                                comment.flagged
                                  ? 'Remove inappropriate flag'
                                  : 'Flag inappropriate comment'
                              }
                              onClick={() => handleToggleFlag(comment)}
                              disabled={isRowBusy}
                            >
                              <Flag size={14} />
                            </button>

                            {comment.status !== 'spam' ? (
                              <button
                                type="button"
                                className="cmt-action-btn is-spam"
                                title="Mark as Spam"
                                onClick={() => handleStatusChange(comment.id, 'spam')}
                                disabled={isRowBusy}
                              >
                                <AlertTriangle size={14} />
                              </button>
                            ) : null}

                            <button
                              type="button"
                              className="cmt-action-btn is-delete"
                              title="Delete comment"
                              onClick={() => handleDeleteOne(comment.id)}
                              disabled={isRowBusy}
                            >
                              <Trash2 size={14} />
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
        </section>
      ) : (
        /* E. Comment Settings Tab */
        <div className="cmt-settings-grid">
          <section className="admin-card">
            <div className="cms-card-head">
              <div>
                <h2>Global Comment Settings</h2>
                <p className="cms-muted">
                  Control how reader comments work across the entire Swadhyay website.
                </p>
              </div>
            </div>

            <form className="cms-form" onSubmit={handleSaveSettings}>
              <label className="cmt-toggle-row">
                <div>
                  <strong>Enable Comments Globally</strong>
                  <p className="cms-subtext">
                    Master switch to show or hide comment sections on all articles.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.commentsEnabledGlobally}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      commentsEnabledGlobally: e.target.checked,
                    }))
                  }
                />
              </label>

              <label className="cmt-toggle-row">
                <div>
                  <strong>Require Admin Approval Before Publishing</strong>
                  <p className="cms-subtext">
                    New comments enter Pending Approval until reviewed by an editor or admin.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.requireApproval}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      requireApproval: e.target.checked,
                    }))
                  }
                />
              </label>

              <div className="cmt-toggle-row">
                <div>
                  <strong>Who Can Comment</strong>
                  <p className="cms-subtext">
                    Restrict commenting to signed-in Google users or allow everyone.
                  </p>
                </div>
                <select
                  className="cmt-filter-select"
                  value={settings.allowGuestComments ? 'everyone' : 'logged_in'}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      allowGuestComments: e.target.value === 'everyone',
                    }))
                  }
                >
                  <option value="logged_in">Logged-in users only</option>
                  <option value="everyone">Everyone (Logged-in &amp; Guests)</option>
                </select>
              </div>

              <label className="cmt-toggle-row">
                <div>
                  <strong>Enable Spam Protection</strong>
                  <p className="cms-subtext">
                    Automatically route comments with multiple links or blocked keywords to Spam.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.spamProtectionEnabled}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      spamProtectionEnabled: e.target.checked,
                    }))
                  }
                />
              </label>

              {settings.spamProtectionEnabled ? (
                <div className="cms-field">
                  <label htmlFor="spam-keywords">Blocked Spam Keywords (comma-separated)</label>
                  <textarea
                    id="spam-keywords"
                    rows={2}
                    value={keywordsInput}
                    onChange={(e) => setKeywordsInput(e.target.value)}
                    placeholder="casino, viagra, crypto, lottery"
                  />
                </div>
              ) : null}

              <div className="cmt-policy-lock">
                <Lock size={15} />
                <span>
                  <strong>Reader Editing Disabled:</strong> Readers cannot edit or modify
                  submitted comments (enforced in both UI and Firestore security rules).
                </span>
              </div>

              <div className="cms-form-actions">
                <button
                  type="submit"
                  className="admin-btn-primary"
                  disabled={savingSettings}
                >
                  {savingSettings ? 'Saving…' : 'Save Comment Settings'}
                </button>
              </div>
            </form>
          </section>

          {/* Per-Post Comment Controls */}
          <section className="admin-card">
            <div className="cms-card-head">
              <div>
                <h2>Per-Post Comment Controls</h2>
                <p className="cms-muted">
                  Enable or disable comments for individual posts and articles.
                </p>
              </div>
            </div>

            <label className="cmt-search-box" style={{ marginBottom: 12 }}>
              <Search size={15} />
              <input
                type="search"
                placeholder="Filter posts by title…"
                value={postSettingsSearch}
                onChange={(e) => setPostSettingsSearch(e.target.value)}
              />
            </label>

            {filteredPostsForSettings.length === 0 ? (
              <p className="cms-muted">No posts found.</p>
            ) : (
              <div className="cmt-post-toggle-list">
                {filteredPostsForSettings.map((post) => {
                  const enabled = post.commentsEnabled !== false
                  const isBusy = busyId === `post-${post.id}`
                  return (
                    <div key={post.id} className="cmt-post-toggle-item">
                      <div className="cmt-post-toggle-info">
                        <strong>{post.title || 'Untitled Post'}</strong>
                        <span className="cms-subtext">
                          /{post.slug} · {post.status || 'draft'}
                        </span>
                      </div>
                      <button
                        type="button"
                        className={`cmt-post-toggle-btn ${enabled ? 'is-on' : 'is-off'}`}
                        onClick={() => handleTogglePostComments(post)}
                        disabled={isBusy}
                      >
                        {isBusy
                          ? 'Updating…'
                          : enabled
                            ? 'Comments Enabled'
                            : 'Comments Disabled'}
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  )
}
