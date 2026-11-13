import { addDoc, collection, getDocs, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase.js'
import { callWorkerApi } from './adminApi.js'
import { toMillis } from '../utils/slugify.js'

function ensureDb() {
  if (!db) throw new Error('Firestore is not configured.')
  return db
}

export async function logActivity({
  user,
  role,
  action,
  module,
  recordId = '',
  description = '',
}) {
  if (!db || !user?.uid) return
  try {
    await addDoc(collection(db, 'activity_logs'), {
      actorUid: user.uid,
      actorName: user.displayName || user.email || 'Admin',
      actorEmail: user.email || '',
      actorRole: role || 'admin',
      action,
      module,
      recordId: String(recordId || ''),
      description,
      source: 'admin-ui',
      createdAt: serverTimestamp(),
    })
  } catch {
    /* Non-blocking audit logging */
  }
}

export async function listActivityLogs() {
  const firestore = ensureDb()
  const snap = await getDocs(collection(firestore, 'activity_logs'))
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt))
}

export async function listBackups() {
  const firestore = ensureDb()
  const snap = await getDocs(collection(firestore, 'backups'))
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt))
}

export async function createManualBackup({ label, retentionPolicy }) {
  return callWorkerApi('/api/backups/create', {
    method: 'POST',
    body: { label, retentionPolicy },
  })
}

export async function downloadBackupFromWorker(r2Key) {
  const resp = await callWorkerApi(`/api/backups/download?key=${encodeURIComponent(r2Key)}`)
  return resp.text()
}

export async function restoreBackupFromWorker({ r2Key, backupData }) {
  return callWorkerApi('/api/backups/restore', {
    method: 'POST',
    body: { r2Key, backupData },
  })
}
