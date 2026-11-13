import {
  collection,
  doc,
  getDocs,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore'
import { db } from '../firebase.js'
import { callWorkerApi } from './adminApi.js'
import { logActivity } from './auditService.js'
import { toMillis } from '../utils/slugify.js'

function ensureDb() {
  if (!db) throw new Error('Firestore is not configured.')
  return db
}

export async function listRegisteredUsersWithStats() {
  const firestore = ensureDb()
  const [usersSnap, resultsSnap, eventsSnap] = await Promise.all([
    getDocs(collection(firestore, 'users')),
    getDocs(collection(firestore, 'quiz_results')).catch(() => ({ docs: [] })),
    getDocs(collection(firestore, 'analytics_events')).catch(() => ({ docs: [] })),
  ])

  const quizByUser = new Map()
  resultsSnap.docs.forEach((d) => {
    const r = { id: d.id, ...d.data() }
    const uid = r.uid || r.userId
    if (!uid) return
    if (!quizByUser.has(uid)) quizByUser.set(uid, [])
    quizByUser.get(uid).push(r)
  })

  const downloadsByUser = new Map()
  eventsSnap.docs.forEach((d) => {
    const ev = { id: d.id, ...d.data() }
    if (ev.eventType !== 'pdf_download' || !ev.uid) return
    if (!downloadsByUser.has(ev.uid)) downloadsByUser.set(ev.uid, [])
    downloadsByUser.get(ev.uid).push(ev)
  })

  return usersSnap.docs
    .map((d) => {
      const data = d.data() || {}
      // Strip any accidental credential fields
      const { token, accessToken, refreshToken, password, ...safeData } = data
      void token
      void accessToken
      void refreshToken
      void password

      const uid = data.uid || d.id
      const quizHistory = (quizByUser.get(uid) || []).sort(
        (a, b) => toMillis(b.submittedAt) - toMillis(a.submittedAt),
      )
      const downloadHistory = (downloadsByUser.get(uid) || []).sort(
        (a, b) => toMillis(b.createdAt) - toMillis(a.createdAt),
      )

      return {
        id: d.id,
        uid,
        displayName: safeData.displayName || 'Unnamed Learner',
        email: safeData.email || '',
        photoURL: safeData.photoURL || '',
        role: safeData.role || 'student',
        accountStatus: safeData.accountStatus || 'active',
        phone: safeData.phone || '',
        bio: safeData.bio || '',
        userGroup: safeData.userGroup || 'General',
        createdAt: safeData.createdAt || safeData.lastLoginAt || null,
        lastLoginAt: safeData.lastLoginAt || null,
        quizAttemptsCount: quizHistory.length,
        downloadsCount: downloadHistory.length,
        quizHistory,
        downloadHistory,
      }
    })
    .sort((a, b) => toMillis(b.lastLoginAt || b.createdAt) - toMillis(a.lastLoginAt || a.createdAt))
}

export async function updateUserAccountStatus(uid, accountStatus) {
  return callWorkerApi('/api/admin/users/status', {
    method: 'POST',
    body: { uid, accountStatus },
  })
}

export async function updateUserDetails(uid, updates, actor) {
  const firestore = ensureDb()
  const payload = {
    displayName: String(updates.displayName || '').trim(),
    phone: String(updates.phone || '').trim(),
    bio: String(updates.bio || '').trim(),
    userGroup: String(updates.userGroup || 'General').trim(),
    updatedAt: serverTimestamp(),
  }
  await updateDoc(doc(firestore, 'users', uid), payload)
  await logActivity({
    user: actor,
    role: actor?.role || 'admin',
    action: 'USER_UPDATED',
    module: 'users',
    recordId: uid,
    description: `Updated profile details for ${payload.displayName || uid}`,
  })
}

export async function deleteUserAccountDoc(uid) {
  return callWorkerApi('/api/admin/users/delete', {
    method: 'DELETE',
    body: { uid },
  })
}
