import { useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import Icon from './Icon.jsx'

function GoogleMark() {
  return (
    <svg className="icon" width={20} height={20} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
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

export default function LoginPromptModal({ t }) {
  const {
    loginModalState,
    closeLoginModal,
    signInWithGoogle,
    authLoading,
    authBusy,
    authError,
    clearAuthError,
  } = useAuth()

  const modalRef = useRef(null)
  const isWelcome = Boolean(loginModalState.isWelcome)
  const lp = t?.loginPrompt || {}

  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === 'Escape' && loginModalState.isOpen) {
        handleDismiss()
      }
    }
    if (loginModalState.isOpen) {
      window.addEventListener('keydown', onKeyDown)
      // Prevent background scrolling while modal is open
      document.body.style.overflow = 'hidden'
    }
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = ''
    }
  }, [loginModalState.isOpen, isWelcome])

  if (!loginModalState.isOpen) return null

  function markSkippedInSession() {
    try {
      sessionStorage.setItem('swadhyay_login_skipped', 'true')
    } catch {
      /* SessionStorage might be blocked in restricted private browsing */
    }
  }

  function handleDismiss() {
    clearAuthError()
    if (isWelcome) {
      markSkippedInSession()
    }
    closeLoginModal()
  }

  function handleSkip() {
    clearAuthError()
    markSkippedInSession()
    closeLoginModal()
  }

  async function handleSignIn() {
    const ok = await signInWithGoogle({
      authNotConfigured: t?.authNotConfigured,
      authError: t?.authError,
    })
    if (ok) {
      const pending = loginModalState.pendingAction
      closeLoginModal()
      if (typeof pending === 'function') {
        try {
          pending()
        } catch (err) {
          console.error('Pending auth action error:', err)
        }
      }
    }
  }

  const isQuiz = loginModalState.itemType === 'quiz' || loginModalState.type === 'quiz'
  const isFile =
    loginModalState.itemType === 'file' ||
    loginModalState.itemType === 'notes' ||
    loginModalState.itemType === 'ncert' ||
    loginModalState.itemType === 'pyq' ||
    loginModalState.itemType === 'pdf'

  // Heading & message resolution
  let title = loginModalState.title
  let message = loginModalState.message

  if (!title) {
    if (isWelcome) {
      title = lp.welcomeTitle || 'स्वाध्याय में आपका स्वागत है'
    } else if (isQuiz) {
      title = lp.quizLockTitle || 'क्विज़ शुरू करने के लिए लॉगिन करें'
    } else if (isFile) {
      title = lp.fileLockTitle || 'फ़ाइल देखने के लिए लॉगिन आवश्यक है'
    } else {
      title = lp.secureLockTitle || 'लॉगिन आवश्यक है'
    }
  }

  if (!message) {
    if (isWelcome) {
      message =
        lp.welcomeSubtitle ||
        'मॉक टेस्ट, क्विज़, NCERT पुस्तकें एवं प्रामाणिक अध्ययन सामग्री का संपूर्ण मंच।'
    } else if (isQuiz) {
      message =
        lp.quizLockSubtitle ||
        'क्विज़ हल करने, टाइमर टेस्ट देने और अपनी ऑल इंडिया रैंक व स्कोर सुरक्षित करने के लिए लॉगिन आवश्यक है।'
    } else if (isFile) {
      message =
        lp.fileLockSubtitle ||
        'यह अध्ययन सामग्री / PDF केवल लॉग इन यूज़र्स के लिए उपलब्ध है। फ़ाइल देखने और डाउनलोड करने के लिए कृपया लॉगिन करें।'
    } else {
      message =
        lp.secureLockSubtitle ||
        'यह सुविधा केवल लॉग इन विद्यार्थियों के लिए उपलब्ध है। आगे बढ़ने के लिए कृपया लॉगिन करें।'
    }
  }

  return (
    <div
      className="sw-login-modal-overlay"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          handleDismiss()
        }
      }}
    >
      <div
        className="sw-login-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sw-login-modal-title"
        ref={modalRef}
      >
        <button
          type="button"
          className="sw-login-close-btn"
          aria-label={lp.close || 'बंद करें'}
          title={lp.close || 'बंद करें'}
          onClick={handleDismiss}
        >
          <Icon name="x" size={18} />
        </button>

        {isWelcome ? (
          <>
            <div className="sw-login-brand-badge">
              <span className="sw-login-logo-mark" aria-hidden="true">
                S
              </span>
              <span className="sw-login-badge-text">Swadhyay · स्वाध्याय</span>
            </div>

            <h2 id="sw-login-modal-title" className="sw-login-title">
              {title}
            </h2>
            <p className="sw-login-subtitle">{message}</p>

            <div className="sw-login-features">
              <div className="sw-login-feature-item">
                <span className="sw-login-feature-icon tone-amber">
                  <Icon name="trophy" size={17} />
                </span>
                <div>
                  <strong>{lp.featureQuizTitle || 'दैनिक क्विज़ व टेस्ट सीरीज़'}</strong>
                  <p>{lp.featureQuizDesc || 'रियल-टाइम टेस्ट, विस्तृत समाधान एवं ऑल इंडिया रैंक'}</p>
                </div>
              </div>

              <div className="sw-login-feature-item">
                <span className="sw-login-feature-icon tone-teal">
                  <Icon name="book" size={17} />
                </span>
                <div>
                  <strong>{lp.featureNotesTitle || 'अध्ययन नोट्स व NCERT पुस्तकें'}</strong>
                  <p>{lp.featureNotesDesc || 'परीक्षा उपयोगी प्रामाणिक PDF नोट्स, पुस्तकें एवं प्रश्न-पत्र'}</p>
                </div>
              </div>

              <div className="sw-login-feature-item">
                <span className="sw-login-feature-icon tone-violet">
                  <Icon name="chart" size={17} />
                </span>
                <div>
                  <strong>{lp.featureTrackTitle || 'प्रगति व प्रदर्शन रिपोर्ट'}</strong>
                  <p>{lp.featureTrackDesc || 'व्यक्तिगत डैशबोर्ड, बुकमार्क्स व ऑल इंडिया लीडरबोर्ड'}</p>
                </div>
              </div>
            </div>

            <div className="sw-login-action-box">
              <button
                type="button"
                className="sw-login-google-btn"
                onClick={handleSignIn}
                disabled={authLoading || authBusy}
              >
                <GoogleMark />
                <span>{authBusy ? lp.signingIn || 'लॉगिन हो रहा है…' : lp.signInGoogle || 'Google से लॉगिन करें'}</span>
              </button>

              {authError ? (
                <p className="sw-login-error" role="alert">
                  {authError}
                </p>
              ) : null}
            </div>

            {/* Bottom Skip Button as required */}
            <div className="sw-login-skip-wrap">
              <button
                type="button"
                className="sw-login-skip-btn"
                onClick={handleSkip}
                aria-label={lp.skipForNow || 'स्किप करें'}
              >
                <span>{lp.skipForNow || 'स्किप करें (बिना लॉगिन जारी रखें) →'}</span>
              </button>
              <p className="sw-login-skip-hint">
                {lp.skipHint || 'बिना लॉगिन आप लेख, पाठ्यक्रम व सामान्य जानकारी पढ़ सकते हैं।'}
              </p>
            </div>
          </>
        ) : (
          <>
            <div className="sw-login-secure-badge">
              <span className="sw-login-lock-circle">
                <Icon name={isQuiz ? 'trophy' : 'lock'} size={26} />
              </span>
            </div>

            <h2 id="sw-login-modal-title" className="sw-login-title">
              {title}
            </h2>
            <p className="sw-login-subtitle">{message}</p>

            {loginModalState.itemName ? (
              <div className="sw-login-resource-card">
                <span className="sw-login-resource-icon">
                  <Icon name={isQuiz ? 'trophy' : 'file'} size={20} />
                </span>
                <div className="sw-login-resource-info">
                  <span className="sw-login-resource-type">
                    {isQuiz ? lp.protectedQuiz || 'लाइव क्विज़ टेस्ट' : lp.protectedFile || 'सुरक्षित अध्ययन सामग्री / PDF'}
                  </span>
                  <span className="sw-login-resource-title">{loginModalState.itemName}</span>
                </div>
              </div>
            ) : null}

            <div className="sw-login-action-box">
              <button
                type="button"
                className="sw-login-google-btn"
                onClick={handleSignIn}
                disabled={authLoading || authBusy}
              >
                <GoogleMark />
                <span>{authBusy ? lp.signingIn || 'लॉगिन हो रहा है…' : lp.signInGoogle || 'Google से लॉगिन करें'}</span>
              </button>

              {authError ? (
                <p className="sw-login-error" role="alert">
                  {authError}
                </p>
              ) : null}
            </div>

            <div className="sw-login-skip-wrap">
              <button
                type="button"
                className="sw-login-cancel-btn"
                onClick={handleDismiss}
              >
                {lp.cancel || 'रद्द करें'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
