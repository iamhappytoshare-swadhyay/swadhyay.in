import { useEffect, useMemo, useRef, useState } from 'react'
import {
  BarChart3,
  Bell,
  BookOpen,
  ClipboardList,
  ExternalLink,
  FileCode2,
  FileText,
  FolderTree,
  HelpCircle,
  History,
  Image,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Menu,
  MessageSquare,
  Moon,
  NotebookPen,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  SearchCheck,
  Settings,
  ShieldCheck,
  Sun,
  Users,
  X,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { ROLE_LABELS } from '../config/constants.js'
import { pathForAdmin } from '../routes.js'
import { ADMIN_NAV_GROUPS, getAdminSection } from './adminNav.js'
import AdminDashboard from './AdminDashboard.jsx'
import AnalyticsManager from './AnalyticsManager.jsx'
import CategoriesManager from './CategoriesManager.jsx'
import CommentsManager from './CommentsManager.jsx'
import LogsBackupManager from './LogsBackupManager.jsx'
import MediaLibrary from './MediaLibrary.jsx'
import MenuManager from './MenuManager.jsx'
import NcertManager from './NcertManager.jsx'
import NotesManager from './NotesManager.jsx'
import NotificationsManager from './NotificationsManager.jsx'
import PagesManager from './PagesManager.jsx'
import PermissionsManager from './PermissionsManager.jsx'
import PostsManager from './PostsManager.jsx'
import PyqManager from './PyqManager.jsx'
import QuizManager from './QuizManager.jsx'
import QuestionReportsManager from './QuestionReportsManager.jsx'
import SeoManager from './SeoManager.jsx'
import SettingsManager from './SettingsManager.jsx'
import UsersManager from './UsersManager.jsx'
import { subscribePendingComments } from '../services/commentService.js'
import {
  DEFAULT_PERMISSION_MATRIX,
  canAccessModule,
  getPermissionMatrix,
} from '../services/permissionService.js'
import './admin.css'

const ICON_MAP = {
  LayoutDashboard,
  FileText,
  FileCode2,
  FolderTree,
  Image,
  MessageSquare,
  BookOpen,
  ClipboardList,
  NotebookPen,
  HelpCircle,
  Users,
  Bell,
  BarChart3,
  SearchCheck,
  Menu,
  Megaphone,
  Settings,
  ShieldCheck,
  History,
}

function getInitials(user) {
  const src = user?.displayName || user?.email || 'A'
  const parts = src.trim().split(/\s+/)
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  return src.slice(0, 2).toUpperCase()
}

function AdminSectionPlaceholder({ section, isSuperAdmin }) {
  const locked = Boolean(section.superAdminOnly && !isSuperAdmin)

  return (
    <>
      <section className="admin-page-head">
        <div>
          <h1>{section.label}</h1>
          <p>{section.description}</p>
        </div>
        {section.superAdminOnly ? (
          <span className="admin-nav-badge">Super Admin Only</span>
        ) : null}
      </section>

      {locked ? (
        <div className="admin-alert" role="alert">
          Only a Super Admin can manage administrator roles and permissions.
        </div>
      ) : (
        <section className="admin-card">
          <h2>Module Ready for Implementation</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem' }}>
            The navigation route (<code>#{pathForAdmin(section.id)}</code>), role guard, and
            light/dark theme shell for <strong>{section.label}</strong> are in place. CRUD
            workflows and Cloudflare Worker / Firestore integrations for this module will be built
            in the upcoming module phases.
          </p>
        </section>
      )}
    </>
  )
}

export default function AdminApp({ sectionId, theme, onTheme }) {
  const { user, role, isSuperAdmin, signOutUser } = useAuth()
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem('swadhyay-admin-sidebar') === 'collapsed'
    } catch {
      return false
    }
  })
  const [mobileOpen, setMobileOpen] = useState(false)
  const [navSearch, setNavSearch] = useState('')
  const [avatarFailed, setAvatarFailed] = useState(false)
  const [pendingComments, setPendingComments] = useState([])
  const [notifOpen, setNotifOpen] = useState(false)
  const [permissionMatrix, setPermissionMatrix] = useState(DEFAULT_PERMISSION_MATRIX)
  const notifRef = useRef(null)

  const currentSection = useMemo(() => getAdminSection(sectionId), [sectionId])

  useEffect(() => {
    const unsubscribe = subscribePendingComments(setPendingComments)
    getPermissionMatrix().then(setPermissionMatrix).catch(() => {})
    return () => unsubscribe()
  }, [])

  useEffect(() => {
    function handleOutside(event) {
      if (notifRef.current && !notifRef.current.contains(event.target)) {
        setNotifOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem('swadhyay-admin-sidebar', collapsed ? 'collapsed' : 'expanded')
    } catch {
      /* Ignore storage failures in restricted browsing modes. */
    }
  }, [collapsed])

  useEffect(() => {
    document.title = `Swadhyay Admin · ${currentSection.label}`
  }, [currentSection])

  useEffect(() => {
    function onKeyDown(event) {
      if (event.key === 'Escape') setMobileOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  function selectSection(id) {
    setMobileOpen(false)
    const nextHash = `#${pathForAdmin(id)}`
    if (window.location.hash !== nextHash) {
      window.location.hash = pathForAdmin(id)
    }
  }

  async function handleLogout() {
    await signOutUser()
    window.location.hash = '/home'
  }

  const filteredGroups = useMemo(() => {
    const needle = navSearch.trim().toLowerCase()
    return ADMIN_NAV_GROUPS.map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        if (!canAccessModule(role, item.id, permissionMatrix)) return false
        if (item.superAdminOnly && !isSuperAdmin) return false
        if (!needle) return true
        return (
          item.label.toLowerCase().includes(needle) ||
          item.description.toLowerCase().includes(needle)
        )
      }),
    })).filter((group) => group.items.length > 0)
  }, [navSearch, role, isSuperAdmin, permissionMatrix])

  const hasSectionAccess =
    canAccessModule(role, currentSection.id, permissionMatrix) &&
    (!currentSection.superAdminOnly || isSuperAdmin)

  return (
    <div className={collapsed ? 'admin-shell is-collapsed' : 'admin-shell'}>
      <header className="admin-topbar">
        <button
          type="button"
          className="admin-icon-btn admin-desktop-toggle"
          onClick={() => setCollapsed((prev) => !prev)}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
        </button>

        <button
          type="button"
          className="admin-icon-btn admin-mobile-toggle"
          onClick={() => setMobileOpen((prev) => !prev)}
          aria-label="Toggle admin menu"
          aria-expanded={mobileOpen}
        >
          {mobileOpen ? <X size={18} /> : <Menu size={18} />}
        </button>

        <a href="#/admin" className="admin-brand">
          <span className="logo-mark" aria-hidden="true">
            S
          </span>
          <span className="admin-brand-copy">
            <span className="admin-brand-title">स्वाध्याय CMS</span>
            <span className="admin-brand-sub">Admin Console</span>
          </span>
        </a>

        <nav className="admin-breadcrumb" aria-label="Breadcrumb">
          <span>Swadhyay</span>
          <span>/</span>
          <span>Admin</span>
          <span>/</span>
          <strong>{currentSection.label}</strong>
        </nav>

        <div className="admin-topbar-spacer" />

        <label className="admin-search" aria-label="Search admin modules">
          <Search size={16} aria-hidden="true" />
          <input
            type="search"
            placeholder="Filter menu…"
            value={navSearch}
            onChange={(event) => setNavSearch(event.target.value)}
            autoComplete="off"
          />
        </label>

        <div className="admin-topbar-actions">
          <div className="admin-notif-wrap" ref={notifRef}>
            <button
              type="button"
              className="admin-icon-btn admin-notif-btn"
              onClick={() => setNotifOpen((prev) => !prev)}
              aria-label={`Notifications (${pendingComments.length} pending comments)`}
              aria-expanded={notifOpen}
              title="Notifications"
            >
              <Bell size={18} />
              {pendingComments.length > 0 ? (
                <span className="admin-notif-badge">
                  {pendingComments.length > 99 ? '99+' : pendingComments.length}
                </span>
              ) : null}
            </button>

            {notifOpen ? (
              <div className="admin-notif-dropdown" role="dialog" aria-label="Comment notifications">
                <div className="admin-notif-head">
                  <strong>Pending Comments ({pendingComments.length})</strong>
                  <button
                    type="button"
                    className="cmt-inline-link"
                    onClick={() => {
                      setNotifOpen(false)
                      selectSection('comments')
                    }}
                  >
                    Manage All
                  </button>
                </div>
                {pendingComments.length === 0 ? (
                  <p className="admin-notif-empty">No new comments waiting for approval.</p>
                ) : (
                  <ul className="admin-notif-list">
                    {pendingComments.slice(0, 5).map((item) => (
                      <li key={item.id}>
                        <button
                          type="button"
                          className="admin-notif-item"
                          onClick={() => {
                            setNotifOpen(false)
                            selectSection('comments')
                          }}
                        >
                          <div className="admin-notif-item-head">
                            <strong>{item.authorName || 'Reader'}</strong>
                            <span className="cmt-new-badge">NEW</span>
                          </div>
                          <span className="admin-notif-item-post">{item.postTitle}</span>
                          <span className="admin-notif-item-text">{item.content}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : null}
          </div>

          <button
            type="button"
            className="admin-icon-btn"
            onClick={() => onTheme(theme === 'dark' ? 'light' : 'dark')}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          <a href="#/home" className="admin-pill-link">
            <ExternalLink size={15} />
            <span className="admin-pill-label">Visit Website</span>
          </a>

          <div className="admin-profile-chip">
            {user?.photoURL && !avatarFailed ? (
              <img
                className="auth-avatar"
                src={user.photoURL}
                alt=""
                referrerPolicy="no-referrer"
                onError={() => setAvatarFailed(true)}
              />
            ) : (
              <span className="auth-avatar auth-avatar-fallback" aria-hidden="true">
                {getInitials(user)}
              </span>
            )}
            <div className="admin-profile-meta">
              <span className="admin-profile-name">{user?.displayName || user?.email}</span>
              <span className="admin-profile-role">{ROLE_LABELS[role] || role}</span>
            </div>
          </div>

          <button
            type="button"
            className="admin-pill-link"
            onClick={handleLogout}
            aria-label="Logout"
            title="Logout"
          >
            <LogOut size={15} />
            <span className="admin-pill-label">Logout</span>
          </button>
        </div>
      </header>

      <div
        className={mobileOpen ? 'admin-backdrop is-visible' : 'admin-backdrop'}
        onClick={() => setMobileOpen(false)}
        aria-hidden="true"
      />

      <aside
        className={mobileOpen ? 'admin-sidebar is-mobile-open' : 'admin-sidebar'}
        aria-label="Admin navigation"
      >
        {filteredGroups.map((group) => (
          <div key={group.id}>
            <p className="admin-nav-group-title">{group.label}</p>
            <ul className="admin-nav-list">
              {group.items.map((item) => {
                const NavIcon = ICON_MAP[item.icon] || LayoutDashboard
                const isActive = currentSection.id === item.id
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      className={isActive ? 'admin-nav-item is-active' : 'admin-nav-item'}
                      aria-current={isActive ? 'page' : undefined}
                      title={collapsed ? item.label : undefined}
                      onClick={() => selectSection(item.id)}
                    >
                      <NavIcon size={18} />
                      <span className="admin-nav-item-label">{item.label}</span>
                      {item.id === 'comments' && pendingComments.length > 0 ? (
                        <span className="admin-nav-badge is-count">
                          {pendingComments.length > 99 ? '99+' : pendingComments.length}
                        </span>
                      ) : null}
                      {item.superAdminOnly ? (
                        <span className="admin-nav-badge">SA</span>
                      ) : null}
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </aside>

      <main className="admin-main" id="admin-content">
        {!hasSectionAccess ? (
          <section className="admin-card">
            <div className="admin-alert" role="alert">
              Access Denied: Your role (<strong>{ROLE_LABELS[role] || role}</strong>) does not
              have permission to open <strong>{currentSection.label}</strong>.
            </div>
          </section>
        ) : currentSection.id === 'dashboard' ? (
          <AdminDashboard role={role} onSelectSection={selectSection} />
        ) : currentSection.id === 'posts' ? (
          <PostsManager />
        ) : currentSection.id === 'pages' ? (
          <PagesManager />
        ) : currentSection.id === 'categories' ? (
          <CategoriesManager />
        ) : currentSection.id === 'comments' ? (
          <CommentsManager />
        ) : currentSection.id === 'media' ? (
          <MediaLibrary />
        ) : currentSection.id === 'ncert' ? (
          <NcertManager />
        ) : currentSection.id === 'pyq' ? (
          <PyqManager />
        ) : currentSection.id === 'notes' ? (
          <NotesManager />
        ) : currentSection.id === 'quizzes' ? (
          <QuizManager />
        ) : currentSection.id === 'reports' ? (
          <QuestionReportsManager />
        ) : currentSection.id === 'navigation' ? (
          <MenuManager />
        ) : currentSection.id === 'users' ? (
          <UsersManager />
        ) : currentSection.id === 'notifications' ? (
          <NotificationsManager />
        ) : currentSection.id === 'analytics' ? (
          <AnalyticsManager />
        ) : currentSection.id === 'seo' ? (
          <SeoManager />
        ) : currentSection.id === 'settings' ? (
          <SettingsManager />
        ) : currentSection.id === 'permissions' ? (
          <PermissionsManager />
        ) : currentSection.id === 'logs' ? (
          <LogsBackupManager />
        ) : (
          <AdminSectionPlaceholder section={currentSection} isSuperAdmin={isSuperAdmin} />
        )}
      </main>
    </div>
  )
}
