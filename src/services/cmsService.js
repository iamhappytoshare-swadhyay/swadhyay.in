import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore'
import { db } from '../firebase.js'
import { slugify, toMillis } from '../utils/slugify.js'

function ensureDb() {
  if (!db) {
    throw new Error('Firestore is not configured. Check your .env Firebase settings.')
  }
  return db
}

function normalizeStringArray(input) {
  if (!Array.isArray(input)) return []
  return [...new Set(input.map((item) => String(item || '').trim()).filter(Boolean))]
}

async function syncTagsToCollection(firestore, tagNames) {
  if (!tagNames.length) return
  await Promise.all(
    tagNames.map((name) => {
      const id = slugify(name, 'tag')
      return setDoc(
        doc(firestore, 'tags', id),
        {
          name,
          slug: id,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      )
    }),
  )
}

async function recordPostRevision(firestore, postId, payload, user, note) {
  await addDoc(collection(firestore, 'posts', postId, 'revisions'), {
    title: payload.title || '',
    slug: payload.slug || '',
    content: payload.content || '',
    shortDescription: payload.shortDescription || '',
    status: payload.status || 'draft',
    savedBy: user?.displayName || user?.email || 'Admin',
    savedByUid: user?.uid || '',
    savedByEmail: user?.email || '',
    note: note || 'Saved revision',
    savedAt: serverTimestamp(),
  })
}

/* ========================= POSTS CRUD ========================= */

export async function listPosts() {
  const firestore = ensureDb()
  const snap = await getDocs(collection(firestore, 'posts'))
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => toMillis(b.updatedAt || b.createdAt) - toMillis(a.updatedAt || a.createdAt))
}

export async function listPublishedPosts() {
  if (!db) return []
  try {
    const q = query(collection(db, 'posts'), where('status', '==', 'published'))
    const snap = await getDocs(q)
    return snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => toMillis(b.publishedAt || b.updatedAt) - toMillis(a.publishedAt || a.updatedAt))
  } catch {
    return []
  }
}

export async function listPostRevisions(postId) {
  const firestore = ensureDb()
  if (!postId) return []
  const q = query(collection(firestore, 'posts', postId, 'revisions'), orderBy('savedAt', 'desc'))
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

export async function savePost({ id, existingPost, data, user, mode = 'draft' }) {
  const firestore = ensureDb()
  const normalizedSlug = slugify(data.slug || data.title, 'post')
  const categories = normalizeStringArray(data.categories)
  const tags = normalizeStringArray(data.tags)
  const authorName = (data.author || user?.displayName || user?.email || 'Admin').trim()

  const contentPayload = {
    title: (data.title || '').trim() || 'Untitled Post',
    slug: normalizedSlug,
    content: data.content || '',
    customCss: data.customCss || '',
    editorMode: data.editorMode || 'visual',
    interactiveTool: Boolean(data.interactiveTool),
    shortDescription: (data.shortDescription || '').trim(),
    featuredImage: (data.featuredImage || '').trim(),
    categories,
    category: categories[0] || '',
    tags,
    author: authorName,
    showAuthor: Boolean(data.showAuthor),
    showDate: data.showDate !== false,
    authorUid: existingPost?.authorUid || user?.uid || '',
    seoTitle: (data.seoTitle || '').trim(),
    metaDescription: (data.metaDescription || '').trim(),
    canonicalUrl: (data.canonicalUrl || '').trim(),
    socialImage: (data.socialImage || '').trim(),
    commentsEnabled: data.commentsEnabled !== false,
    featured: Boolean(data.featured),
    scheduledFor: data.scheduledFor || '',
  }

  const isCurrentlyPublished = existingPost?.status === 'published'

  // CRITICAL: Autosave or saving draft edits on a published post must NOT overwrite the live published version.
  if (id && isCurrentlyPublished && (mode === 'autosave' || mode === 'draft')) {
    const postRef = doc(firestore, 'posts', id)
    await updateDoc(postRef, {
      draftSnapshot: {
        ...contentPayload,
        savedAt: new Date().toISOString(),
        savedBy: user?.email || authorName,
      },
      hasUnpublishedChanges: true,
      lastAutosavedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })

    if (mode === 'draft') {
      await recordPostRevision(
        firestore,
        id,
        { ...contentPayload, status: 'published-draft' },
        user,
        'Saved unpublished draft edits',
      )
    }
    return { id, slug: normalizedSlug, savedToDraftBuffer: true }
  }

  const nextStatus =
    mode === 'publish'
      ? 'published'
      : mode === 'schedule'
        ? 'scheduled'
        : existingPost?.status === 'scheduled' && mode === 'autosave'
          ? 'scheduled'
          : 'draft'

  const writePayload = {
    ...contentPayload,
    status: nextStatus,
    hasUnpublishedChanges: false,
    draftSnapshot: null,
    updatedAt: serverTimestamp(),
    ...(mode === 'autosave' ? { lastAutosavedAt: serverTimestamp() } : {}),
  }

  if (nextStatus === 'published') {
    writePayload.publishedAt = existingPost?.publishedAt || serverTimestamp()
  }

  let savedId = id
  if (id) {
    await updateDoc(doc(firestore, 'posts', id), writePayload)
  } else {
    const created = await addDoc(collection(firestore, 'posts'), {
      ...writePayload,
      createdAt: serverTimestamp(),
      views: 0,
    })
    savedId = created.id
  }

  if (mode !== 'autosave') {
    await Promise.all([
      syncTagsToCollection(firestore, tags),
      recordPostRevision(
        firestore,
        savedId,
        { ...contentPayload, status: nextStatus },
        user,
        nextStatus === 'published'
          ? 'Published post'
          : nextStatus === 'scheduled'
            ? 'Scheduled post'
            : 'Saved draft',
      ),
    ])
  }

  return { id: savedId, slug: normalizedSlug, savedToDraftBuffer: false }
}

export async function discardPostDraftBuffer(postId) {
  const firestore = ensureDb()
  await updateDoc(doc(firestore, 'posts', postId), {
    draftSnapshot: null,
    hasUnpublishedChanges: false,
    updatedAt: serverTimestamp(),
  })
}

export async function movePostToTrash(post) {
  const firestore = ensureDb()
  await updateDoc(doc(firestore, 'posts', post.id), {
    previousStatus: post.status || 'draft',
    status: 'trashed',
    deletedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

export async function restorePostFromTrash(post) {
  const firestore = ensureDb()
  const restoredStatus =
    post.previousStatus && post.previousStatus !== 'trashed' ? post.previousStatus : 'draft'
  await updateDoc(doc(firestore, 'posts', post.id), {
    status: restoredStatus,
    deletedAt: null,
    updatedAt: serverTimestamp(),
  })
}

export async function deletePostPermanently(postId) {
  const firestore = ensureDb()
  await deleteDoc(doc(firestore, 'posts', postId))
}

export async function duplicatePost(post, user) {
  const firestore = ensureDb()
  const nextTitle = `${post.title || 'Untitled'} (Copy)`
  const nextSlug = slugify(`${post.slug || post.title}-copy-${Date.now().toString(36).slice(-4)}`)
  const created = await addDoc(collection(firestore, 'posts'), {
    title: nextTitle,
    slug: nextSlug,
    content: post.content || '',
    shortDescription: post.shortDescription || '',
    featuredImage: post.featuredImage || '',
    categories: normalizeStringArray(post.categories),
    category: post.category || '',
    tags: normalizeStringArray(post.tags),
    author: user?.displayName || user?.email || post.author || 'Admin',
    authorUid: user?.uid || post.authorUid || '',
    seoTitle: post.seoTitle || '',
    metaDescription: post.metaDescription || '',
    canonicalUrl: '',
    socialImage: post.socialImage || '',
    commentsEnabled: post.commentsEnabled !== false,
    featured: false,
    status: 'draft',
    hasUnpublishedChanges: false,
    draftSnapshot: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    views: 0,
  })
  return created.id
}

export async function bulkUpdatePostsStatus(postIds, status) {
  const firestore = ensureDb()
  if (!postIds.length) return
  const batch = writeBatch(firestore)
  for (const postId of postIds) {
    batch.update(doc(firestore, 'posts', postId), {
      status,
      updatedAt: serverTimestamp(),
      ...(status === 'published' ? { publishedAt: serverTimestamp() } : {}),
      ...(status === 'trashed' ? { deletedAt: serverTimestamp() } : {}),
    })
  }
  await batch.commit()
}

export async function bulkDeletePosts(postIds) {
  const firestore = ensureDb()
  if (!postIds.length) return
  const batch = writeBatch(firestore)
  for (const postId of postIds) {
    batch.delete(doc(firestore, 'posts', postId))
  }
  await batch.commit()
}

/* ========================= PAGES CRUD ========================= */

export async function listPages() {
  const firestore = ensureDb()
  const snap = await getDocs(collection(firestore, 'pages'))
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => toMillis(b.updatedAt || b.createdAt) - toMillis(a.updatedAt || a.createdAt))
}

export async function listPublishedPages() {
  if (!db) return []
  try {
    const q = query(collection(db, 'pages'), where('status', '==', 'published'))
    const snap = await getDocs(q)
    return snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0))
  } catch {
    return []
  }
}

export async function savePage({ id, existingPage, data, user, status = 'draft' }) {
  const firestore = ensureDb()
  const normalizedSlug = slugify(data.slug || data.title, 'page')
  const payload = {
    title: (data.title || '').trim() || 'Untitled Page',
    slug: normalizedSlug,
    content: data.content || '',
    seoTitle: (data.seoTitle || '').trim(),
    metaDescription: (data.metaDescription || '').trim(),
    canonicalUrl: (data.canonicalUrl || '').trim(),
    allowComments: data.allowComments || 'allow',
    order: Number.isFinite(Number(data.order)) ? Number(data.order) : 0,
    showInFooter: data.showInFooter !== false,
    status,
    author: user?.displayName || user?.email || existingPage?.author || 'Admin',
    authorUid: existingPage?.authorUid || user?.uid || '',
    updatedAt: serverTimestamp(),
  }
  if (status === 'published') {
    payload.publishedAt = existingPage?.publishedAt || serverTimestamp()
  }

  if (id) {
    await updateDoc(doc(firestore, 'pages', id), payload)
    return { id, slug: normalizedSlug }
  }
  const created = await addDoc(collection(firestore, 'pages'), {
    ...payload,
    createdAt: serverTimestamp(),
  })
  return { id: created.id, slug: normalizedSlug }
}

export async function togglePagePublish(page) {
  const firestore = ensureDb()
  const nextStatus = page.status === 'published' ? 'draft' : 'published'
  await updateDoc(doc(firestore, 'pages', page.id), {
    status: nextStatus,
    updatedAt: serverTimestamp(),
    ...(nextStatus === 'published' && !page.publishedAt ? { publishedAt: serverTimestamp() } : {}),
  })
}

export async function deletePage(pageId) {
  const firestore = ensureDb()
  await deleteDoc(doc(firestore, 'pages', pageId))
}

/* ========================= CATEGORIES & TAGS CRUD ========================= */

export async function listCategories() {
  if (!db) return []
  try {
    const snap = await getDocs(collection(db, 'categories'))
    return snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0))
  } catch {
    return []
  }
}

export async function saveCategory({ id, data }) {
  const firestore = ensureDb()
  const normalizedSlug = slugify(data.slug || data.name, 'category')
  const payload = {
    name: (data.name || '').trim() || 'Untitled Category',
    slug: normalizedSlug,
    description: (data.description || '').trim(),
    icon: (data.icon || 'book').trim(),
    tone: (data.tone || 'navy').trim(),
    parentId: (data.parentId || '').trim(),
    order: Number.isFinite(Number(data.order)) ? Number(data.order) : 0,
    showOnPublic: data.showOnPublic !== false,
    updatedAt: serverTimestamp(),
  }

  if (id) {
    await updateDoc(doc(firestore, 'categories', id), payload)
    return id
  }
  const created = await addDoc(collection(firestore, 'categories'), {
    ...payload,
    createdAt: serverTimestamp(),
  })
  return created.id
}

export async function deleteCategory(categoryId) {
  const firestore = ensureDb()
  await deleteDoc(doc(firestore, 'categories', categoryId))
}

export async function listTags() {
  const firestore = ensureDb()
  const snap = await getDocs(collection(firestore, 'tags'))
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')))
}

export async function saveTag(name) {
  const firestore = ensureDb()
  const trimmed = String(name || '').trim()
  if (!trimmed) return null
  const id = slugify(trimmed, 'tag')
  await setDoc(
    doc(firestore, 'tags', id),
    {
      name: trimmed,
      slug: id,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  )
  return id
}

export async function deleteTag(tagId) {
  const firestore = ensureDb()
  await deleteDoc(doc(firestore, 'tags', tagId))
}
