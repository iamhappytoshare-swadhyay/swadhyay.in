import { useEffect, useState } from 'react'
import { collection, getCountFromServer, query, where } from 'firebase/firestore'
import {
  BookOpen,
  ClipboardList,
  FileText,
  FolderTree,
  HelpCircle,
  Image,
  MessageSquare,
  NotebookPen,
  Plus,
  RefreshCw,
  Users,
} from 'lucide-react'
import { db } from '../firebase.js'
import { R2_MEDIA_URL, ROLE_LABELS, WORKER_API_URL } from '../config/constants.js'

const STAT_DEFINITIONS = [
  { key: 'users', label: 'Registered Users', collection: 'users', icon: Users, tone: 'blue' },
  { key: 'posts', label: 'Total Posts', collection: 'posts', icon: FileText, tone: 'red' },
  { key: 'publishedPosts', label: 'Published Posts', collection: 'posts', status: 'published', icon: FileText, tone: 'teal' },
  { key: 'draftPosts', label: 'Draft Posts', collection: 'posts', status: 'draft', icon: FileText, tone: 'amber' },
  { key: 'pages', label: 'Static Pages', collection: 'pages', icon: FileText, tone: 'navy' },
  { key: 'categories', label: 'Categories', collection: 'categories', icon: FolderTree, tone: 'violet' },
  { key: 'notes', label: 'Notes & Materials', collection: 'notes', icon: NotebookPen, tone: 'teal' },
  { key: 'ncertBooks', label: 'NCERT Books', collection: 'ncert_books', icon: BookOpen, tone: 'amber' },
  { key: 'pyq', label: 'PYQ Papers', collection: 'pyq', icon: ClipboardList, tone: 'navy' },
  { key: 'quizAttempts', label: 'Quiz Attempts', collection: 'quiz_attempts', icon: HelpCircle, tone: 'red' },
  { key: 'media', label: 'Media Files (R2)', collection: 'media', icon: Image, tone: 'blue' },
  { key: 'comments', label: 'Comments', collection: 'comments', icon: MessageSquare, tone: 'violet' },
]

async function fetchCollectionCount(def) {
  if (!db) return { key: def.key, value: null, error: true }
  try {
    const colRef = collection(db, def.collection)
    const target = def.status ? query(colRef, where('status', '==', def.status)) : colRef
    const snap = await getCountFromServer(target)
    return { key: def.key, value: snap.data().count, error: false }
  } catch {
    return { key: def.key, value: null, error: true }
  }
}

export default function AdminDashboard({ role, onSelectSection }) {
  const [counts, setCounts] = useState({})
  const [loading, setLoading] = useState(true)
  const [hasPermissionNotice, setHasPermissionNotice] = useState(false)
  const [refreshTick, setRefreshTick] = useState(0)

  useEffect(() => {
    let active = true

    async function loadCounts() {
      setLoading(true)
      const results = await Promise.all(STAT_DEFINITIONS.map(fetchCollectionCount))
      if (!active) return

      const nextCounts = {}
      let anyError = false
      for (const res of results) {
        nextCounts[res.key] = res.value
        if (res.error) anyError = true
      }

      setCounts(nextCounts)
      setHasPermissionNotice(anyError)
      setLoading(false)
    }

    loadCounts()
    return () => {
      active = false
    }
  }, [refreshTick])

  return (
    <>
      <section className="admin-page-head">
        <div>
          <h1>Dashboard Overview</h1>
          <p>
            Live Firestore collection totals for Swadhyay.in. No demo or placeholder counts are
            shown.
          </p>
        </div>
        <div className="admin-quick-actions">
          <button
            type="button"
            className="admin-pill-link is-primary"
            onClick={() => onSelectSection('posts')}
          >
            <Plus size={16} />
            <span>New Post</span>
          </button>
          <button
            type="button"
            className="admin-pill-link"
            onClick={() => onSelectSection('media')}
          >
            <Image size={16} />
            <span>Upload Media</span>
          </button>
          <button
            type="button"
            className="admin-pill-link"
            onClick={() => onSelectSection('quizzes')}
          >
            <HelpCircle size={16} />
            <span>Quizzes</span>
          </button>
          <button
            type="button"
            className="admin-pill-link"
            onClick={() => setRefreshTick((tick) => tick + 1)}
            disabled={loading}
          >
            <RefreshCw size={15} />
            <span>{loading ? 'Refreshing…' : 'Refresh'}</span>
          </button>
        </div>
      </section>

      {hasPermissionNotice ? (
        <div className="admin-alert" role="status">
          Some Firestore counts returned unavailable. Deploy the updated{' '}
          <code>firestore.rules</code> to your Firebase project so admin aggregation queries are
          authorized for all CMS collections.
        </div>
      ) : null}

      <section className="admin-stats-grid" aria-label="Website statistics">
        {STAT_DEFINITIONS.map((def) => {
          const IconComponent = def.icon
          const raw = counts[def.key]
          const display = loading ? '…' : raw === null || raw === undefined ? '—' : raw.toLocaleString()

          return (
            <article key={def.key} className="admin-stat-card">
              <div>
                <span className="admin-stat-label">{def.label}</span>
                <strong className="admin-stat-value">{display}</strong>
                <span className="admin-stat-sub">Collection: {def.collection}</span>
              </div>
              <span className={`tone tone-${def.tone}`} aria-hidden="true">
                <IconComponent size={18} />
              </span>
            </article>
          )
        })}
      </section>

      <div className="admin-grid-2">
        <section className="admin-card">
          <h2>Connected Infrastructure</h2>
          <ul className="admin-info-list">
            <li className="admin-info-row">
              <span>Admin Access Role</span>
              <strong>{ROLE_LABELS[role] || role}</strong>
            </li>
            <li className="admin-info-row">
              <span>Cloudflare Worker API</span>
              <code>{WORKER_API_URL}</code>
            </li>
            <li className="admin-info-row">
              <span>Cloudflare R2 Media Base</span>
              <code>{R2_MEDIA_URL}</code>
            </li>
            <li className="admin-info-row">
              <span>Preserved Existing Collections</span>
              <code>users, notes, ncert_books, likes, quiz_attempts, quiz sets</code>
            </li>
          </ul>
        </section>

        <section className="admin-card">
          <h2>Phase 1 Foundation Active</h2>
          <ul className="admin-info-list">
            <li className="admin-info-row">
              <span>Auth &amp; RBAC Context</span>
              <strong>Active</strong>
            </li>
            <li className="admin-info-row">
              <span>Protected Route (#/admin)</span>
              <strong>Active</strong>
            </li>
            <li className="admin-info-row">
              <span>19-Module Blogger Shell</span>
              <strong>Active</strong>
            </li>
            <li className="admin-info-row">
              <span>Next: Phase 2 (Post &amp; Page Editor)</span>
              <strong>Ready</strong>
            </li>
          </ul>
        </section>
      </div>
    </>
  )
}
