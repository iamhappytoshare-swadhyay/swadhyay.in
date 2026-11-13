import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore'
import { db } from '../firebase.js'
import { WORKER_API_URL } from '../config/constants.js'
import { toMillis } from '../utils/slugify.js'

export const MEDIA_FOLDERS = ['general', 'posts', 'ncert', 'pyq', 'notes', 'quizzes']

export const ACCEPTED_MEDIA_TYPES =
  '.pdf,.jpg,.jpeg,.png,.webp,.gif,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv'

function ensureDb() {
  if (!db) {
    throw new Error('Firestore is not configured. Check your .env Firebase settings.')
  }
  return db
}

export function formatBytes(bytes) {
  const value = Number(bytes) || 0
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
  return `${(value / (1024 * 1024)).toFixed(2)} MB`
}

export function getMediaKind(mimeType = '', name = '') {
  const mime = String(mimeType).toLowerCase()
  const lower = String(name).toLowerCase()
  if (mime.startsWith('image/') || /\.(jpg|jpeg|png|webp|gif)$/.test(lower)) return 'image'
  if (mime === 'application/pdf' || lower.endsWith('.pdf')) return 'pdf'
  return 'document'
}

export async function listMediaFiles() {
  const firestore = ensureDb()
  const snap = await getDocs(collection(firestore, 'media'))
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => toMillis(b.createdAt || b.updatedAt) - toMillis(a.createdAt || a.updatedAt))
}

function sendFormDataWithProgress({ method, url, formData, idToken, onProgress }) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open(method, url)
    xhr.setRequestHeader('Authorization', `Bearer ${idToken}`)

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && typeof onProgress === 'function') {
        const percent = Math.round((event.loaded / event.total) * 100)
        onProgress(percent)
      }
    }

    xhr.onload = () => {
      let parsed
      try {
        parsed = JSON.parse(xhr.responseText || '{}')
      } catch {
        parsed = {}
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(parsed)
      } else {
        reject(new Error(parsed.error || `Worker request failed with status ${xhr.status}`))
      }
    }

    xhr.onerror = () => {
      reject(
        new Error(
          `Unable to reach Cloudflare Worker at ${WORKER_API_URL}. Ensure the Worker is deployed and CORS allows this origin.`,
        ),
      )
    }

    xhr.send(formData)
  })
}

export async function uploadMediaFile({ file, folder = 'general', idToken, user, onProgress }) {
  const firestore = ensureDb()
  if (!idToken) throw new Error('Missing Firebase auth token. Please sign in again.')

  const formData = new FormData()
  formData.append('file', file)
  formData.append('folder', folder)

  const uploaded = await sendFormDataWithProgress({
    method: 'POST',
    url: `${WORKER_API_URL}/api/media/upload`,
    formData,
    idToken,
    onProgress,
  })

  const metadata = {
    name: uploaded.name || file.name,
    objectKey: uploaded.key,
    url: uploaded.url,
    folder: uploaded.folder || folder,
    size: uploaded.size ?? file.size,
    mimeType: uploaded.mimeType || file.type || 'application/octet-stream',
    kind: getMediaKind(uploaded.mimeType || file.type, uploaded.name || file.name),
    isPublic: true,
    uploadedBy: user?.displayName || user?.email || 'Admin',
    uploadedByUid: user?.uid || '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }

  const created = await addDoc(collection(firestore, 'media'), metadata)
  return { id: created.id, ...metadata }
}

export async function replaceMediaFile({ mediaItem, file, idToken, onProgress }) {
  const firestore = ensureDb()
  if (!idToken) throw new Error('Missing Firebase auth token. Please sign in again.')

  const formData = new FormData()
  formData.append('file', file)
  formData.append('key', mediaItem.objectKey)

  const replaced = await sendFormDataWithProgress({
    method: 'PUT',
    url: `${WORKER_API_URL}/api/media/replace`,
    formData,
    idToken,
    onProgress,
  })

  await updateDoc(doc(firestore, 'media', mediaItem.id), {
    size: replaced.size ?? file.size,
    mimeType: replaced.mimeType || file.type || mediaItem.mimeType,
    kind: getMediaKind(replaced.mimeType || file.type, mediaItem.name),
    updatedAt: serverTimestamp(),
  })

  return replaced
}

export async function renameMediaFile({ id, name, folder }) {
  const firestore = ensureDb()
  await updateDoc(doc(firestore, 'media', id), {
    name: String(name || '').trim(),
    folder: String(folder || 'general').trim() || 'general',
    updatedAt: serverTimestamp(),
  })
}

export async function findMediaReferences(mediaItem) {
  const firestore = ensureDb()
  const needles = [mediaItem.url, mediaItem.objectKey].filter(Boolean)
  if (needles.length === 0) return []

  const matchesValue = (text) => {
    const str = String(text || '')
    return needles.some((needle) => str.includes(needle))
  }

  const references = []

  const [postsSnap, pagesSnap, notesSnap] = await Promise.all([
    getDocs(query(collection(firestore, 'posts'), where('status', '==', 'published'))),
    getDocs(query(collection(firestore, 'pages'), where('status', '==', 'published'))),
    getDocs(collection(firestore, 'notes')),
  ])

  for (const d of postsSnap.docs) {
    const data = d.data()
    if (
      matchesValue(data.content) ||
      matchesValue(data.featuredImage) ||
      matchesValue(data.socialImage)
    ) {
      references.push({ type: 'Published Post', id: d.id, title: data.title || d.id })
    }
  }

  for (const d of pagesSnap.docs) {
    const data = d.data()
    if (matchesValue(data.content)) {
      references.push({ type: 'Published Page', id: d.id, title: data.title || d.id })
    }
  }

  for (const d of notesSnap.docs) {
    const data = d.data()
    const isPublished = !('status' in data) || data.status === 'published'
    if (
      isPublished &&
      (matchesValue(data.fileUrl) ||
        matchesValue(data.url) ||
        matchesValue(data.pdfUrl) ||
        matchesValue(data.thumbnail) ||
        matchesValue(data.content))
    ) {
      references.push({ type: 'Note', id: d.id, title: data.title || data.name || d.id })
    }
  }

  return references
}

export async function deleteMediaFile({ mediaItem, idToken }) {
  const firestore = ensureDb()
  if (!idToken) throw new Error('Missing Firebase auth token. Please sign in again.')

  const references = await findMediaReferences(mediaItem)
  if (references.length > 0) {
    const err = new Error(
      `Cannot delete "${mediaItem.name}": referenced by ${references.length} published item(s).`,
    )
    err.references = references
    throw err
  }

  const resp = await fetch(`${WORKER_API_URL}/api/media/delete`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ key: mediaItem.objectKey }),
  })

  const parsed = await resp.json().catch(() => ({}))
  if (!resp.ok) {
    throw new Error(parsed.error || `Failed to delete object from R2 (${resp.status})`)
  }

  await deleteDoc(doc(firestore, 'media', mediaItem.id))
}
