import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore'
import { db } from '../firebase.js'
import { toMillis } from '../utils/slugify.js'

const SETTINGS_COLLECTION = 'website_settings'
const SETTINGS_DOC_ID = 'comments'

export const DEFAULT_SPAM_KEYWORDS = [
  'casino',
  'viagra',
  'crypto',
  'lottery',
  'loan',
  'porn',
  'betting',
  'free money',
]

export const DEFAULT_COMMENT_SETTINGS = {
  commentsEnabledGlobally: true,
  requireApproval: true,
  allowGuestComments: false,
  spamProtectionEnabled: true,
  spamKeywords: DEFAULT_SPAM_KEYWORDS,
  allowUserEditing: false,
}

function ensureDb() {
  if (!db) {
    throw new Error('Firestore is not configured. Check your .env Firebase settings.')
  }
  return db
}

export function normalizeCommentStatus(status) {
  if (status === 'approved' || status === 'published') return 'published'
  if (status === 'rejected') return 'rejected'
  if (status === 'spam') return 'spam'
  return 'pending'
}

function normalizeCommentDoc(docSnap) {
  const data = docSnap.data() || {}
  return {
    id: docSnap.id,
    ...data,
    status: normalizeCommentStatus(data.status),
    flagged: Boolean(data.flagged),
    isNew: data.isNew !== false && normalizeCommentStatus(data.status) === 'pending',
    adminReply: data.adminReply && data.adminReply.text ? data.adminReply : null,
  }
}

export function detectSpam(content, settings = DEFAULT_COMMENT_SETTINGS) {
  if (!settings?.spamProtectionEnabled) return false
  const text = String(content || '').toLowerCase()
  const keywords = Array.isArray(settings.spamKeywords)
    ? settings.spamKeywords
    : DEFAULT_SPAM_KEYWORDS

  if (keywords.some((kw) => kw && text.includes(String(kw).toLowerCase().trim()))) {
    return true
  }

  // Flag comments with multiple URLs or suspicious link shorteners
  const urlMatches = text.match(/https?:\/\/|www\./g) || []
  if (urlMatches.length >= 2) return true
  if (/bit\.ly|tinyurl\.com|t\.me\//i.test(text)) return true

  return false
}

export async function getCommentSettings() {
  if (!db) return { ...DEFAULT_COMMENT_SETTINGS }
  try {
    const snap = await getDoc(doc(db, SETTINGS_COLLECTION, SETTINGS_DOC_ID))
    if (!snap.exists()) return { ...DEFAULT_COMMENT_SETTINGS }
    const data = snap.data() || {}
    return {
      commentsEnabledGlobally: data.commentsEnabledGlobally !== false,
      requireApproval: data.requireApproval !== false,
      allowGuestComments: Boolean(data.allowGuestComments),
      spamProtectionEnabled: data.spamProtectionEnabled !== false,
      spamKeywords: Array.isArray(data.spamKeywords)
        ? data.spamKeywords
        : DEFAULT_SPAM_KEYWORDS,
      allowUserEditing: false,
    }
  } catch {
    return { ...DEFAULT_COMMENT_SETTINGS }
  }
}

export async function saveCommentSettings(settings, user) {
  const firestore = ensureDb()
  const keywords = Array.isArray(settings.spamKeywords)
    ? settings.spamKeywords.map((k) => String(k || '').trim()).filter(Boolean)
    : DEFAULT_SPAM_KEYWORDS

  const payload = {
    commentsEnabledGlobally: settings.commentsEnabledGlobally !== false,
    requireApproval: settings.requireApproval !== false,
    allowGuestComments: Boolean(settings.allowGuestComments),
    spamProtectionEnabled: settings.spamProtectionEnabled !== false,
    spamKeywords: keywords,
    allowUserEditing: false,
    updatedAt: serverTimestamp(),
    updatedBy: user?.email || user?.displayName || 'Admin',
  }

  await setDoc(doc(firestore, SETTINGS_COLLECTION, SETTINGS_DOC_ID), payload, { merge: true })
  return payload
}

export async function listAllComments() {
  const firestore = ensureDb()
  const snap = await getDocs(collection(firestore, 'comments'))
  return snap.docs
    .map(normalizeCommentDoc)
    .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt))
}

export function subscribePendingComments(onUpdate) {
  if (!db) return () => {}
  const q = query(collection(db, 'comments'), where('status', '==', 'pending'))
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs
        .map(normalizeCommentDoc)
        .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt))
      onUpdate(items)
    },
    () => {
      onUpdate([])
    },
  )
}

export async function listPublishedCommentsForPost(postId) {
  if (!db || !postId) return []
  try {
    const q = query(
      collection(db, 'comments'),
      where('postId', '==', postId),
      where('status', 'in', ['published', 'approved']),
    )
    const snap = await getDocs(q)
    return snap.docs
      .map(normalizeCommentDoc)
      .sort((a, b) => toMillis(a.createdAt) - toMillis(b.createdAt))
  } catch {
    return []
  }
}

export async function submitComment({
  post,
  authorName,
  authorEmail,
  uid = '',
  content,
  settings,
}) {
  const firestore = ensureDb()
  const effectiveSettings = settings || (await getCommentSettings())
  const cleanContent = String(content || '').trim()
  if (!cleanContent) {
    throw new Error('Comment cannot be empty.')
  }

  const isSpam = detectSpam(cleanContent, effectiveSettings)
  const initialStatus = isSpam
    ? 'spam'
    : effectiveSettings.requireApproval
      ? 'pending'
      : 'published'

  const docRef = await addDoc(collection(firestore, 'comments'), {
    postId: post.id,
    postTitle: post.title || 'Untitled Post',
    postSlug: post.slug || '',
    authorName: String(authorName || 'Reader').trim(),
    authorEmail: String(authorEmail || '').trim(),
    uid: uid || '',
    content: cleanContent,
    status: initialStatus,
    flagged: isSpam,
    isNew: true,
    adminReply: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })

  return { id: docRef.id, status: initialStatus, isSpam }
}

export async function updateCommentStatus(commentId, status) {
  const firestore = ensureDb()
  const normalized = normalizeCommentStatus(status)
  await updateDoc(doc(firestore, 'comments', commentId), {
    status: normalized,
    flagged: normalized === 'spam',
    isNew: false,
    updatedAt: serverTimestamp(),
  })
}

export async function bulkUpdateCommentStatus(commentIds, status) {
  if (!commentIds.length) return
  const firestore = ensureDb()
  const normalized = normalizeCommentStatus(status)
  const batch = writeBatch(firestore)
  commentIds.forEach((id) => {
    batch.update(doc(firestore, 'comments', id), {
      status: normalized,
      flagged: normalized === 'spam',
      isNew: false,
      updatedAt: serverTimestamp(),
    })
  })
  await batch.commit()
}

export async function toggleCommentFlag(commentId, flagged) {
  const firestore = ensureDb()
  await updateDoc(doc(firestore, 'comments', commentId), {
    flagged: Boolean(flagged),
    isNew: false,
    updatedAt: serverTimestamp(),
  })
}

export async function deleteComment(commentId) {
  const firestore = ensureDb()
  await deleteDoc(doc(firestore, 'comments', commentId))
}

export async function bulkDeleteComments(commentIds) {
  if (!commentIds.length) return
  const firestore = ensureDb()
  const batch = writeBatch(firestore)
  commentIds.forEach((id) => {
    batch.delete(doc(firestore, 'comments', id))
  })
  await batch.commit()
}

export async function saveAdminReply(commentId, text, user, existingReply = null) {
  const firestore = ensureDb()
  const cleanText = String(text || '').trim()
  if (!cleanText) {
    throw new Error('Reply text cannot be empty.')
  }

  const nowIso = new Date().toISOString()
  const replyPayload = {
    text: cleanText,
    authorName: user?.displayName || 'Swadhyay Admin',
    authorEmail: user?.email || '',
    authorUid: user?.uid || '',
    createdAt: existingReply?.createdAt || nowIso,
    updatedAt: nowIso,
  }

  await updateDoc(doc(firestore, 'comments', commentId), {
    adminReply: replyPayload,
    isNew: false,
    updatedAt: serverTimestamp(),
  })

  return replyPayload
}

export async function deleteAdminReply(commentId) {
  const firestore = ensureDb()
  await updateDoc(doc(firestore, 'comments', commentId), {
    adminReply: null,
    updatedAt: serverTimestamp(),
  })
}

export async function togglePostCommentsEnabled(postId, enabled) {
  const firestore = ensureDb()
  await updateDoc(doc(firestore, 'posts', postId), {
    commentsEnabled: Boolean(enabled),
    updatedAt: serverTimestamp(),
  })
}
