import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import Header from './components/Header.jsx'
import Navigation from './components/Navigation.jsx'
import LeftSidebar from './components/LeftSidebar.jsx'
import MainContent from './components/MainContent.jsx'
import RightSidebar from './components/RightSidebar.jsx'
import LoginPromptModal from './components/LoginPromptModal.jsx'
import { useAuth } from './context/AuthContext.jsx'
import { translations } from './i18n/translations.js'
import {
  listCategories,
  listPublishedPages,
  listPublishedPosts,
} from './services/cmsService.js'
import {
  listPublishedNcertItems,
  listPublishedNotes,
  listPublishedPyqItems,
  listPublishedQuizzes,
  subscribePublishedQuizzes,
} from './services/eduService.js'
import { subscribeMenuItems } from './services/menuService.js'
import { trackAnalyticsEvent } from './services/analyticsService.js'
import { getGlobalSeoSettings } from './services/seoService.js'
import { getWebsiteSettings } from './services/settingsService.js'
import { pathForCategory, readAdminSection, readDynamicSlug, readHash } from './routes.js'
import Icon from './components/Icon.jsx'

const AdminApp = lazy(() => import('./admin/AdminApp.jsx'))

function readStored(key, allowed, fallback) {
  try {
    const value = localStorage.getItem(key)
    return allowed.includes(value) ? value : fallback
  } catch {
    return fallback
  }
}

function writeStored(key, value) {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* Storage can be unavailable in private browsing. The choice still applies for this visit. */
  }
}

function pageTitle(t, view, routeSlug, publishedPosts, publishedPages, dynamicCategories) {
  if (view === 'post') {
    const post = publishedPosts.find((p) => p.slug === routeSlug || p.id === routeSlug)
    return post?.seoTitle || post?.title || t.nav.home
  }
  if (view === 'page') {
    const page = publishedPages.find((p) => p.slug === routeSlug || p.id === routeSlug)
    return page?.seoTitle || page?.title || t.nav.home
  }
  if (view === 'category') {
    const cat = dynamicCategories.find((c) => c.slug === routeSlug)
    return cat?.name || routeSlug || t.nav.home
  }
  if (t.nav[view]) return t.nav[view]
  if (t.student[view]) return t.student[view]
  if (view === 'notfound') return t.notFoundTitle
  return t.nav.home
}

export default function App() {
  const { user, isAdmin, authLoading, signInWithGoogle, openLoginModal } = useAuth()
  const initialView = readHash()
  const [theme, setTheme] = useState(() => readStored('swadhyay-theme', ['light', 'dark'], 'light'))
  const [lang, setLang] = useState(() => readStored('swadhyay-lang', ['en', 'hi'], 'en'))
  const [view, setView] = useState(initialView)
  const [routeSlug, setRouteSlug] = useState(() => readDynamicSlug())
  const [adminSection, setAdminSection] = useState(() => readAdminSection())
  const [category, setCategory] = useState(initialView === 'geography' ? 'geography' : 'history')
  const [query, setQuery] = useState('')
  const [leftOpen, setLeftOpen] = useState(false)
  const [rightOpen, setRightOpen] = useState(false)

  // Live Firestore public hydration state
  const [publishedPosts, setPublishedPosts] = useState([])
  const [publishedPages, setPublishedPages] = useState([])
  const [dynamicCategories, setDynamicCategories] = useState([])
  const [publishedNcert, setPublishedNcert] = useState([])
  const [publishedPyq, setPublishedPyq] = useState([])
  const [publishedNotes, setPublishedNotes] = useState([])
  const [publishedQuizzes, setPublishedQuizzes] = useState([])
  const [menuItems, setMenuItems] = useState([])
  const [siteSettings, setSiteSettings] = useState(null)
  const [seoSettings, setSeoSettings] = useState(null)

  const skipScroll = useRef(true)
  const prevViewRef = useRef(initialView)
  const t = translations[lang]

  const refreshPublicContent = useCallback(async () => {
    const [postsList, pagesList, catsList, ncertList, pyqList, notesList, quizList] =
      await Promise.all([
        listPublishedPosts(),
        listPublishedPages(),
        listCategories(),
        listPublishedNcertItems(),
        listPublishedPyqItems(),
        listPublishedNotes(),
        listPublishedQuizzes(),
      ])
    setPublishedPosts(postsList)
    setPublishedPages(pagesList)
    setDynamicCategories(catsList)
    setPublishedNcert(ncertList)
    setPublishedPyq(pyqList)
    setPublishedNotes(notesList)
    setPublishedQuizzes(quizList)
  }, [])

  useEffect(() => {
    let active = true
    Promise.all([
      listPublishedPosts(),
      listPublishedPages(),
      listCategories(),
      listPublishedNcertItems(),
      listPublishedPyqItems(),
      listPublishedNotes(),
      listPublishedQuizzes(),
    ]).then(([postsList, pagesList, catsList, ncertList, pyqList, notesList, quizList]) => {
      if (!active) return
      setPublishedPosts(postsList)
      setPublishedPages(pagesList)
      setDynamicCategories(catsList)
      setPublishedNcert(ncertList)
      setPublishedPyq(pyqList)
      setPublishedNotes(notesList)
      setPublishedQuizzes(quizList)
    })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => subscribeMenuItems(setMenuItems), [])
  useEffect(() => subscribePublishedQuizzes(setPublishedQuizzes), [])

  useEffect(() => {
    getWebsiteSettings().then(setSiteSettings).catch(() => {})
    getGlobalSeoSettings().then(setSeoSettings).catch(() => {})
  }, [])

  useEffect(() => {
    if (view === 'admin') return
    trackAnalyticsEvent({
      eventType: 'page_view',
      targetId: routeSlug ? `${view}:${routeSlug}` : view,
      targetTitle: view,
      uid: user?.uid || '',
    })
  }, [view, routeSlug, user?.uid])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    writeStored('swadhyay-theme', theme)
  }, [theme])

  useEffect(() => {
    document.documentElement.lang = lang === 'hi' ? 'hi' : 'en'
    writeStored('swadhyay-lang', lang)
  }, [lang])

  useEffect(() => {
    if (view === 'admin') return
    const siteName = siteSettings?.siteName || 'Swadhyay'
    document.title = `${siteName} · ${pageTitle(
      t,
      view,
      routeSlug,
      publishedPosts,
      publishedPages,
      dynamicCategories,
    )}`

    const activePost =
      view === 'post'
        ? publishedPosts.find((p) => p.slug === routeSlug || p.id === routeSlug)
        : null
    const desc =
      activePost?.metaDescription ||
      activePost?.shortDescription ||
      seoSettings?.metaDescription ||
      ''
    if (desc) {
      let metaDesc = document.querySelector('meta[name="description"]')
      if (!metaDesc) {
        metaDesc = document.createElement('meta')
        metaDesc.name = 'description'
        document.head.appendChild(metaDesc)
      }
      metaDesc.content = desc
    }
  }, [t, view, routeSlug, publishedPosts, publishedPages, dynamicCategories, siteSettings, seoSettings])

  useEffect(() => {
    function onHashChange() {
      const next = readHash()
      const nextSlug = readDynamicSlug()
      const wasAdmin = prevViewRef.current === 'admin'
      prevViewRef.current = next
      setView(next)
      setRouteSlug(nextSlug)
      if (next === 'admin') {
        setAdminSection(readAdminSection())
      } else if (wasAdmin) {
        refreshPublicContent()
      }
      if (next === 'history' || next === 'geography') setCategory(next)
      if (next === 'category' && nextSlug) setCategory(nextSlug)
      setLeftOpen(false)
      setRightOpen(false)
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [refreshPublicContent])

  useEffect(() => {
    if (view === 'admin' && !authLoading && (!user || !isAdmin)) {
      window.location.hash = '/home'
    }
  }, [view, authLoading, user, isAdmin])

  // Prompt unauthenticated visitors to login when Swadhyay opens, with a skip option
  useEffect(() => {
    if (authLoading) return
    if (user) return
    if (view === 'admin') return

    try {
      const skipped = sessionStorage.getItem('swadhyay_login_skipped') === 'true'
      if (!skipped) {
        openLoginModal({ isWelcome: true })
      }
    } catch {
      // Storage might be unavailable
    }
  }, [authLoading, user, view, openLoginModal])

  useEffect(() => {
    function onKey(event) {
      if (event.key === 'Escape') {
        setLeftOpen(false)
        setRightOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (skipScroll.current) {
      skipScroll.current = false
      return
    }
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [view, routeSlug])

  function navigate(path) {
    const hash = path.startsWith('/') ? path : `/${path}`
    setQuery('')
    setLeftOpen(false)
    setRightOpen(false)
    if (window.location.hash === `#${hash}`) {
      setView(readHash())
      setRouteSlug(readDynamicSlug())
      return
    }
    window.location.hash = hash
  }

  function openCategory(id) {
    setCategory(id)
    navigate(pathForCategory(id))
  }

  function openDynamicCategory(slug) {
    setCategory(slug)
    navigate(`/category/${slug}`)
  }

  function openItem(item) {
    if (item.focus) setCategory(item.focus)
    navigate(item.path)
  }

  if (view === 'admin') {
    if (authLoading) {
      return (
        <div
          className="app"
          style={{ minHeight: '100svh', display: 'grid', placeItems: 'center', padding: 24 }}
        >
          <p className="empty" style={{ maxWidth: 380, width: '100%' }}>
            Verifying admin session…
          </p>
        </div>
      )
    }
    if (!user || !isAdmin) {
      return null
    }
    return (
      <Suspense
        fallback={
          <div
            className="app"
            style={{ minHeight: '100svh', display: 'grid', placeItems: 'center', padding: 24 }}
          >
            <p className="empty" style={{ maxWidth: 380, width: '100%' }}>
              Loading Admin Console…
            </p>
          </div>
        }
      >
        <AdminApp sectionId={adminSection} theme={theme} onTheme={setTheme} />
      </Suspense>
    )
  }

  const footerPages = publishedPages.filter((page) => page.showInFooter !== false)
  const footerMenuItems = menuItems.filter(
    (item) => item.enabled !== false && item.location === 'footer',
  )

  const inMaintenance = Boolean(siteSettings?.maintenanceEnabled)
  const canBypassMaintenance =
    isAdmin && siteSettings?.allowAdminDuringMaintenance !== false

  if (inMaintenance && !canBypassMaintenance) {
    return (
      <div
        className="app"
        style={{
          minHeight: '100svh',
          display: 'grid',
          placeItems: 'center',
          padding: 24,
        }}
      >
        <section className="panel" style={{ maxWidth: 520, textAlign: 'center', padding: 32 }}>
          <h1>{siteSettings?.maintenanceTitle || 'Scheduled Maintenance'}</h1>
          <p style={{ color: 'var(--text-muted)', lineHeight: 1.6 }}>
            {siteSettings?.maintenanceMessage ||
              'Swadhyay is currently undergoing maintenance. Please check back shortly.'}
          </p>
        </section>
      </div>
    )
  }

  return (
    <div className={`app view-${view} ${view !== 'home' ? 'is-subpage' : 'is-home'}`}>
      {inMaintenance && canBypassMaintenance ? (
        <div
          style={{
            background: '#b45309',
            color: '#fff',
            textAlign: 'center',
            padding: '6px 12px',
            fontSize: '0.82rem',
            fontWeight: 700,
          }}
        >
          Maintenance Mode Active (Admin Preview) ·{' '}
          <a href="#/admin/settings" style={{ color: '#fff', textDecoration: 'underline' }}>
            Manage Settings
          </a>
        </div>
      ) : null}
      <Header
        t={t}
        theme={theme}
        lang={lang}
        query={query}
        onQuery={setQuery}
        onTheme={setTheme}
        onLang={setLang}
        onHome={() => navigate('/home')}
      />
      <div className={`drawer-toggles ${view !== 'home' ? 'mobile-subpage-hide' : ''}`}>
        <button
          type="button"
          className="drawer-btn drawer-btn--categories"
          aria-expanded={leftOpen}
          aria-controls="study-categories"
          onClick={() => {
            setLeftOpen((open) => !open)
            setRightOpen(false)
          }}
        >
          <Icon name="book" size={17} />
          <span>{t.mobileCategories}</span>
        </button>
        <button
          type="button"
          className="drawer-btn drawer-btn--dashboard"
          aria-expanded={rightOpen}
          aria-controls="student-dashboard"
          onClick={() => {
            setRightOpen((open) => !open)
            setLeftOpen(false)
          }}
        >
          <Icon name="user" size={17} />
          <span>{t.mobileDashboard}</span>
        </button>
        {user ? (
          <button
            type="button"
            className="drawer-btn drawer-btn--login is-signed-in"
            onClick={() => navigate('/profile')}
            title={user.email || ''}
          >
            {user.photoURL ? (
              <img
                src={user.photoURL}
                alt=""
                style={{ width: 20, height: 20, borderRadius: '50%', objectFit: 'cover' }}
                referrerPolicy="no-referrer"
              />
            ) : (
              <Icon name="user" size={17} />
            )}
            <span>{(user.displayName || user.email || 'User').split(' ')[0]}</span>
          </button>
        ) : (
          <button
            type="button"
            className="drawer-btn drawer-btn--login"
            disabled={authLoading}
            onClick={signInWithGoogle}
          >
            <Icon name="login" size={17} />
            <span>{t.login || 'Login'}</span>
          </button>
        )}
      </div>

      <Navigation
        t={t}
        lang={lang}
        view={view}
        routeSlug={routeSlug}
        menuItems={menuItems}
        onNavigate={navigate}
      />

      <div className="layout">
        <LeftSidebar
          t={t}
          category={category}
          dynamicCategories={dynamicCategories}
          open={leftOpen}
          onSelect={openCategory}
          onSelectDynamic={openDynamicCategory}
        />
        <MainContent
          t={t}
          theme={theme}
          lang={lang}
          onTheme={setTheme}
          onLang={setLang}
          view={view}
          routeSlug={routeSlug}
          category={category}
          dynamicCategories={dynamicCategories}
          publishedPosts={publishedPosts}
          publishedPages={publishedPages}
          publishedNcert={publishedNcert}
          publishedPyq={publishedPyq}
          publishedNotes={publishedNotes}
          publishedQuizzes={publishedQuizzes}
          query={query}
          onOpen={openItem}
          onOpenPath={navigate}
          onHome={() => navigate('/home')}
        />
        <RightSidebar t={t} view={view} open={rightOpen} onNavigate={navigate} />
      </div>

      {footerPages.length > 0 || footerMenuItems.length > 0 ? (
        <footer className="site-footer">
          <div className="site-footer-inner">
            <span>© {new Date().getFullYear()} Swadhyay.in</span>
            <nav className="site-footer-links" aria-label="Footer navigation">
              {footerMenuItems.map((item) => {
                const label = lang === 'hi' ? item.labelHi || item.labelEn : item.labelEn
                const isExt = /^https?:\/\//i.test(item.url || '')
                return isExt ? (
                  <a
                    key={item.id}
                    href={item.url}
                    target={item.openInNewTab === false ? undefined : '_blank'}
                    rel={item.openInNewTab === false ? undefined : 'noopener noreferrer'}
                  >
                    {label}
                  </a>
                ) : (
                  <a key={item.id} href={`#${item.url.startsWith('/') ? item.url : `/${item.url}`}`}>
                    {label}
                  </a>
                )
              })}
              {footerPages.map((page) => (
                <a key={page.id} href={`#/page/${page.slug}`}>
                  {page.title}
                </a>
              ))}
            </nav>
          </div>
        </footer>
      ) : null}

      <LoginPromptModal t={t} />
    </div>
  )
}
