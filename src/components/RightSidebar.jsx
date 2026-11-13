import Icon from './Icon.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { STUDENT_ITEMS } from '../routes.js'

export default function RightSidebar({ t, view, open, onNavigate }) {
  const { user, isAdmin, authBusy, signOutUser } = useAuth()

  return (
    <aside
      id="student-dashboard"
      className={open ? 'sidebar is-open' : 'sidebar'}
      aria-label={t.dashboardTitle}
    >
      <div className="sidebar-card">
        <p className="sidebar-title">{t.dashboardTitle}</p>
        <ul className="side-list">
          {STUDENT_ITEMS.map((item) => {
            const active = view === item.id
            return (
              <li key={item.id}>
                <button
                  type="button"
                  className={active ? 'side-link is-active' : 'side-link'}
                  aria-current={active ? 'page' : undefined}
                  onClick={() => onNavigate(item.path)}
                >
                  <span className={`tone tone-${item.tone}`}>
                    <Icon name={item.icon} size={18} />
                  </span>
                  <span>{t.student[item.id]}</span>
                </button>
              </li>
            )
          })}

          {isAdmin ? (
            <li>
              <button
                type="button"
                className="side-link"
                onClick={() => onNavigate('/admin')}
              >
                <span className="tone tone-amber">
                  <Icon name="shield" size={18} />
                </span>
                <span>{t.adminPanel || 'Admin'}</span>
              </button>
            </li>
          ) : null}

          {user ? (
            <li>
              <button
                type="button"
                className="side-link side-link-logout"
                disabled={authBusy}
                onClick={() => signOutUser()}
              >
                <span className="tone tone-red">
                  <Icon name="logout" size={18} />
                </span>
                <span>{t.signOut || 'Logout'}</span>
              </button>
            </li>
          ) : null}
        </ul>
      </div>
    </aside>
  )
}
