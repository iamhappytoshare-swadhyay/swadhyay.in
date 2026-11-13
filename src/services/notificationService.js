import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore'
import { db } from '../firebase.js'
import { callWorkerApi } from './adminApi.js'
import { toMillis } from '../utils/slugify.js'

function ensureDb() {
  if (!db) throw new Error('Firestore is not configured.')
  return db
}

export async function listNotifications() {
  const firestore = ensureDb()
  const snap = await getDocs(collection(firestore, 'notifications'))
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt))
}

export async function sendOrScheduleNotification(payload) {
  return callWorkerApi('/api/notifications/send', {
    method: 'POST',
    body: payload,
  })
}

export async function updateScheduledNotification(id, updates) {
  const firestore = ensureDb()
  await updateDoc(doc(firestore, 'notifications', id), {
    ...updates,
    updatedAt: serverTimestamp(),
  })
}

export async function cancelScheduledNotification(id) {
  const firestore = ensureDb()
  await updateDoc(doc(firestore, 'notifications', id), {
    status: 'cancelled',
    updatedAt: serverTimestamp(),
  })
}

export async function deleteNotificationDoc(id) {
  const firestore = ensureDb()
  await deleteDoc(doc(firestore, 'notifications', id))
}
