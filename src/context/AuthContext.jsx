import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth'
import { doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore'
import { auth, db, googleProvider, isFirebaseConfigured } from '../firebase.js'
import {
  hasAdminAccess,
  isSuperAdminRole,
  SUPER_ADMIN_EMAIL,
} from '../config/constants.js'

const AuthContext = createContext(null)

function resolveRole(user, profileData) {
  if (!user) return null
  const isBootstrapSuper =
    user.email?.toLowerCase() === SUPER_ADMIN_EMAIL && user.emailVerified !== false
  if (isBootstrapSuper) return 'super_admin'
  return typeof profileData?.role === 'string' ? profileData.role : 'student'
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [authLoading, setAuthLoading] = useState(() => Boolean(auth))
  const [authBusy, setAuthBusy] = useState(false)
  const [authError, setAuthError] = useState('')
  const [loginModalState, setLoginModalState] = useState({
    isOpen: false,
    isWelcome: false,
    title: '',
    message: '',
    itemName: '',
    itemType: 'general',
    pendingAction: null,
  })

  const openLoginModal = useCallback((options = {}) => {
    setLoginModalState({
      isOpen: true,
      isWelcome: Boolean(options.isWelcome),
      title: options.title || '',
      message: options.message || '',
      itemName: options.itemName || '',
      itemType: options.itemType || 'general',
      pendingAction: typeof options.pendingAction === 'function' ? options.pendingAction : null,
    })
  }, [])

  const closeLoginModal = useCallback(() => {
    setLoginModalState((prev) => ({
      ...prev,
      isOpen: false,
      pendingAction: null,
    }))
  }, [])

  const requireAuth = useCallback(
    (actionCallback, options = {}) => {
      if (user) {
        if (typeof actionCallback === 'function') {
          actionCallback()
        }
        return true
      }
      openLoginModal({
        ...options,
        isWelcome: false,
        pendingAction: actionCallback,
      })
      return false
    },
    [user, openLoginModal],
  )

  useEffect(() => {
    if (!auth) return undefined

    let unsubscribeProfile = null

    const unsubscribeAuth = onAuthStateChanged(auth, (nextUser) => {
      if (unsubscribeProfile) {
        unsubscribeProfile()
        unsubscribeProfile = null
      }

      if (!nextUser) {
        setUser(null)
        setProfile(null)
        setAuthLoading(false)
        return
      }

      setUser(nextUser)

      if (!db) {
        setProfile(null)
        setAuthLoading(false)
        return
      }

      setAuthLoading(true)
      const userRef = doc(db, 'users', nextUser.uid)
      const isBootstrapSuper =
        nextUser.email?.toLowerCase() === SUPER_ADMIN_EMAIL && nextUser.emailVerified !== false

      // Sync non-privileged profile fields without overriding an existing user's role.
      const baseProfile = {
        uid: nextUser.uid,
        email: nextUser.email || '',
        displayName: nextUser.displayName || '',
        photoURL: nextUser.photoURL || '',
        lastLoginAt: serverTimestamp(),
      }
      if (isBootstrapSuper) {
        baseProfile.role = 'super_admin'
      }

      setDoc(userRef, baseProfile, { merge: true }).catch(() => {
        /* Profile sync failure should not lock out auth state listening. */
      })

      unsubscribeProfile = onSnapshot(
        userRef,
        (snapshot) => {
          setProfile(snapshot.exists() ? snapshot.data() : null)
          setAuthLoading(false)
        },
        () => {
          setProfile(null)
          setAuthLoading(false)
        },
      )
    })

    return () => {
      if (unsubscribeProfile) unsubscribeProfile()
      unsubscribeAuth()
    }
  }, [])

  const signInWithGoogle = useCallback(async (messages = {}) => {
    setAuthError('')
    if (!isFirebaseConfigured || !auth || !googleProvider) {
      setAuthError(
        messages.authNotConfigured ||
          'Add VITE_FIREBASE_* variables to .env to enable Google Sign-In.',
      )
      return false
    }
    setAuthBusy(true)
    try {
      await signInWithPopup(auth, googleProvider)
      return true
    } catch (error) {
      if (
        error?.code !== 'auth/popup-closed-by-user' &&
        error?.code !== 'auth/cancelled-popup-request'
      ) {
        setAuthError(messages.authError || 'Could not sign in with Google. Please try again.')
      }
      return false
    } finally {
      setAuthBusy(false)
    }
  }, [])

  const signOutUser = useCallback(async (messages = {}) => {
    if (!auth) return
    setAuthError('')
    setAuthBusy(true)
    try {
      await signOut(auth)
    } catch {
      setAuthError(messages.authError || 'Could not sign out. Please try again.')
    } finally {
      setAuthBusy(false)
    }
  }, [])

  const clearAuthError = useCallback(() => setAuthError(''), [])

  const getIdToken = useCallback(async () => {
    if (!user) return null
    return user.getIdToken()
  }, [user])

  const role = useMemo(() => resolveRole(user, profile), [user, profile])
  const isAdmin = useMemo(() => hasAdminAccess(role), [role])
  const isSuperAdmin = useMemo(() => isSuperAdminRole(role), [role])

  const value = useMemo(
    () => ({
      user,
      profile,
      role,
      isAdmin,
      isSuperAdmin,
      authLoading,
      authBusy,
      authError,
      clearAuthError,
      signInWithGoogle,
      signOutUser,
      getIdToken,
      loginModalState,
      openLoginModal,
      closeLoginModal,
      requireAuth,
    }),
    [
      user,
      profile,
      role,
      isAdmin,
      isSuperAdmin,
      authLoading,
      authBusy,
      authError,
      clearAuthError,
      signInWithGoogle,
      signOutUser,
      getIdToken,
      loginModalState,
      openLoginModal,
      closeLoginModal,
      requireAuth,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider')
  }
  return ctx
}
