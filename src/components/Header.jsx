import { useState } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import Icon from './Icon.jsx'

function getInitials(user, fallback) {
  const source = user?.displayName || user?.email || fallback || 'S'
  const parts = source.trim().split(/\s+/)
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  }
  return source.slice(0, 2).toUpperCase()
}

function GoogleMark() {
  return (
    <svg className="icon" width={18} height={18} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        fill="#4285F4"
        d="M23.52 12.27c0-.79-.07-1.54-.2-2.27H12v4.51h6.47a5.54 5.54 0 0 1-2.4 3.63v3.02h3.88c2.27-2.09 3.57-5.17 3.57-8.89Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.07 7.94-2.9l-3.88-3.02c-1.07.72-2.45 1.15-4.06 1.15-3.12 0-5.77-2.11-6.72-4.96H1.28v3.11A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.27A7.2 7.2 0 0 1 4.9 12c0-.79.14-1.56.38-2.27V6.62H1.28A12 12 0 0 0 0 12c0 1.94.46 3.77 1.28 5.38l4-3.11Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.77c1.76 0 3.34.61 4.58 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.28 6.62l4 3.11c.95-2.85 3.6-4.96 6.72-4.96Z"
      />
    </svg>
  )
}

export default function Header({
  t,
  theme,
  lang,
  query,
  onQuery,
  onTheme,
  onLang,
  onHome,
}) {
  const { user, isAdmin, authLoading, authBusy, authError, signInWithGoogle } = useAuth()
  const [failedPhotoUrl, setFailedPhotoUrl] = useState('')
  const showAvatarImg = Boolean(user?.photoURL && failedPhotoUrl !== user.photoURL)

  function handleSignIn() {
    signInWithGoogle({
      authNotConfigured: t.authNotConfigured,
      authError: t.authError,
    })
  }

  return (
    <header className="header">
      <div className="header-inner">
        <button type="button" className="brand" onClick={onHome} aria-label={t.homeLink}>
          <span className="logo-mark" aria-hidden="true">
            S
          </span>
          <span className="brand-name">
            <span className="brand-hi" lang="hi">
              स्वाध्याय
            </span>
            <span className="brand-en" lang="en">
              - Swadhyay.in
            </span>
          </span>
        </button>

        <div className="seg seg-theme" role="group" aria-label={`${t.themeLight} / ${t.themeDark}`}>
          <button
            type="button"
            aria-pressed={theme === 'light'}
            aria-label={t.themeLight}
            title={t.themeLight}
            onClick={() => onTheme('light')}
          >
            <Icon name="sun" size={18} />
          </button>
          <button
            type="button"
            aria-pressed={theme === 'dark'}
            aria-label={t.themeDark}
            title={t.themeDark}
            onClick={() => onTheme('dark')}
          >
            <Icon name="moon" size={18} />
          </button>
        </div>

        <button
          type="button"
          className="mobile-single-toggle mobile-theme-toggle"
          aria-label={theme === 'light' ? t.themeDark : t.themeLight}
          title={theme === 'light' ? t.themeDark : t.themeLight}
          onClick={() => onTheme(theme === 'light' ? 'dark' : 'light')}
        >
          <Icon name={theme === 'light' ? 'sun' : 'moon'} size={17} />
        </button>

        <div className="seg seg-lang" role="group" aria-label={`${t.langEnglish} / ${t.langHindi}`}>
          <button
            type="button"
            aria-pressed={lang === 'en'}
            aria-label={t.langEnglish}
            title={t.langEnglish}
            onClick={() => onLang('en')}
          >
            E
          </button>
          <button
            type="button"
            aria-pressed={lang === 'hi'}
            aria-label={t.langHindi}
            title={t.langHindi}
            onClick={() => onLang('hi')}
          >
            हिं
          </button>
        </div>

        <button
          type="button"
          className="mobile-single-toggle mobile-lang-toggle"
          aria-label={lang === 'en' ? t.langHindi : t.langEnglish}
          title={lang === 'en' ? t.langHindi : t.langEnglish}
          onClick={() => onLang(lang === 'en' ? 'hi' : 'en')}
        >
          {lang === 'en' ? 'E' : 'हिं'}
        </button>

        <form className="search" role="search" onSubmit={(event) => event.preventDefault()}>
          <Icon name="search" size={18} />
          <input
            type="search"
            name="q"
            placeholder={t.searchPlaceholder}
            aria-label={t.searchLabel}
            value={query}
            onChange={(event) => onQuery(event.target.value)}
            autoComplete="off"
          />
          {query ? (
            <button
              type="button"
              className="search-clear"
              onClick={() => onQuery('')}
              aria-label={t.clearSearch}
            >
              <Icon name="x" size={16} />
            </button>
          ) : null}
        </form>

        <div className="header-auth">
          {user ? (
            <div className="auth-user auth-user-compact" aria-label={t.authAccountLabel}>
              <a
                href="#/profile"
                className="auth-avatar-link"
                title={user.displayName || user.email || t.you}
                aria-label={user.displayName || user.email || t.you}
              >
                {showAvatarImg ? (
                  <img
                    className="auth-avatar"
                    src={user.photoURL}
                    alt={user.displayName || ''}
                    referrerPolicy="no-referrer"
                    onError={() => setFailedPhotoUrl(user.photoURL)}
                  />
                ) : (
                  <span className="auth-avatar auth-avatar-fallback" aria-hidden="true">
                    {getInitials(user, t.you)}
                  </span>
                )}
              </a>
              {isAdmin ? (
                <a href="#/admin" className="auth-admin-link">
                  {t.adminPanel}
                </a>
              ) : null}
            </div>
          ) : (
            <button
              type="button"
              className="auth-btn"
              onClick={handleSignIn}
              disabled={authLoading || authBusy}
            >
              <GoogleMark />
              <span>{authBusy ? t.signingIn : t.signInGoogle}</span>
            </button>
          )}

          {authError ? (
            <p className="auth-error" role="alert">
              {authError}
            </p>
          ) : null}
        </div>
      </div>
    </header>
  )
}
