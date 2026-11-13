import {
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore'
import { db } from '../firebase.js'
import { toMillis } from '../utils/slugify.js'

function ensureDb() {
  if (!db) throw new Error('Firestore is not configured.')
  return db
}

export async function updateStudentProfile(uid, updates) {
  if (!uid) throw new Error('Sign in required.')
  const firestore = ensureDb()
  const payload = {
    displayName: String(updates.displayName || '').trim(),
    studyClass: String(updates.studyClass || '').trim(),
    targetExam: String(updates.targetExam || '').trim(),
    phone: String(updates.phone || '').trim(),
    bio: String(updates.bio || '').trim(),
    updatedAt: serverTimestamp(),
  }
  await updateDoc(doc(firestore, 'users', uid), payload)
  return payload
}

export async function toggleUserBookmark(uid, currentBookmarks = [], item) {
  if (!uid || !item?.id) throw new Error('Sign in required to save bookmarks.')
  const firestore = ensureDb()
  const existing = Array.isArray(currentBookmarks) ? currentBookmarks : []
  const exists = existing.some((b) => b.id === item.id && b.type === item.type)
  const next = exists
    ? existing.filter((b) => !(b.id === item.id && b.type === item.type))
    : [
        {
          id: String(item.id),
          type: String(item.type || 'post'),
          title: String(item.title || ''),
          category: String(item.category || 'general'),
          path: String(item.path || ''),
          url: String(item.url || ''),
          savedAt: new Date().toISOString(),
        },
        ...existing,
      ].slice(0, 100)

  await updateDoc(doc(firestore, 'users', uid), {
    bookmarks: next,
    updatedAt: serverTimestamp(),
  })
  return { saved: !exists, bookmarks: next }
}

export async function recordUserDownload(uid, currentDownloads = [], item) {
  if (!uid || !item?.id) return currentDownloads
  const firestore = ensureDb()
  const existing = Array.isArray(currentDownloads) ? currentDownloads : []
  const filtered = existing.filter((d) => !(d.id === item.id && d.type === item.type))
  const next = [
    {
      id: String(item.id),
      type: String(item.type || 'note'),
      title: String(item.title || 'Study Material'),
      category: String(item.category || 'general'),
      url: String(item.url || ''),
      downloadedAt: new Date().toISOString(),
    },
    ...filtered,
  ].slice(0, 50)

  await updateDoc(doc(firestore, 'users', uid), {
    downloads: next,
    updatedAt: serverTimestamp(),
  }).catch(() => {})

  return next
}

export async function listUserQuizResults(uid) {
  if (!uid || !db) return []
  const [byUidSnap, byUserIdSnap] = await Promise.all([
    getDocs(query(collection(db, 'quiz_results'), where('uid', '==', uid))).catch(() => ({ docs: [] })),
    getDocs(query(collection(db, 'quiz_results'), where('userId', '==', uid))).catch(() => ({ docs: [] })),
  ])

  const merged = new Map()
  for (const snap of [byUidSnap, byUserIdSnap]) {
    snap.docs.forEach((d) => {
      merged.set(d.id, { id: d.id, ...d.data() })
    })
  }

  return Array.from(merged.values()).sort(
    (a, b) => toMillis(b.submittedAt || b.createdAt) - toMillis(a.submittedAt || a.createdAt),
  )
}

export async function listLeaderboardEntries(currentUser, isAdmin = false) {
  if (!currentUser || !db) return []

  if (!isAdmin) {
    const mine = await listUserQuizResults(currentUser.uid)
    const totalPoints = mine.reduce((sum, r) => sum + Number(r.score ?? r.marksObtained ?? 0), 0)
    if (mine.length === 0) return []
    return [
      {
        uid: currentUser.uid,
        name: currentUser.displayName || currentUser.email || 'You',
        points: Math.round(totalPoints),
        attempts: mine.length,
        isCurrentUser: true,
      },
    ]
  }

  const [usersSnap, resultsSnap] = await Promise.all([
    getDocs(collection(db, 'users')).catch(() => ({ docs: [] })),
    getDocs(collection(db, 'quiz_results')).catch(() => ({ docs: [] })),
  ])

  const userNames = new Map()
  usersSnap.docs.forEach((d) => {
    const data = d.data() || {}
    userNames.set(data.uid || d.id, data.displayName || data.email || 'Student')
  })

  const totals = new Map()
  resultsSnap.docs.forEach((d) => {
    const r = d.data() || {}
    const uid = r.uid || r.userId
    if (!uid) return
    const prev = totals.get(uid) || { points: 0, attempts: 0 }
    totals.set(uid, {
      points: prev.points + Number(r.score ?? r.marksObtained ?? 0),
      attempts: prev.attempts + 1,
    })
  })

  return Array.from(totals.entries())
    .map(([uid, stats]) => ({
      uid,
      name: userNames.get(uid) || 'Student',
      points: Math.round(stats.points),
      attempts: stats.attempts,
      isCurrentUser: uid === currentUser.uid,
    }))
    .sort((a, b) => b.points - a.points)
    .slice(0, 20)
}
