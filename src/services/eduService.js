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
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore'
import { db } from '../firebase.js'
import { WORKER_API_URL } from '../config/constants.js'
import { callWorkerApi } from './adminApi.js'
import { slugify, toMillis } from '../utils/slugify.js'

function ensureDb() {
  if (!db) {
    throw new Error('Firestore is not configured. Check your .env Firebase settings.')
  }
  return db
}

async function listCollectionDocs(collectionName, sortFn) {
  const firestore = ensureDb()
  const snap = await getDocs(collection(firestore, collectionName))
  const items = snap.docs.map((d) => ({ id: d.id, ...d.data(), _collection: collectionName }))
  return sortFn ? items.sort(sortFn) : items
}

async function listPublishedDocs(collectionName, sortFn) {
  if (!db) return []
  try {
    const q = query(collection(db, collectionName), where('status', '==', 'published'))
    const snap = await getDocs(q)
    const items = snap.docs.map((d) => ({ id: d.id, ...d.data(), _collection: collectionName }))
    return sortFn ? items.sort(sortFn) : items
  } catch {
    return []
  }
}

async function saveCollectionDoc(collectionName, id, payload, user) {
  const firestore = ensureDb()
  const actor = user?.displayName || user?.email || 'Admin'
  if (id) {
    await updateDoc(doc(firestore, collectionName, id), {
      ...payload,
      updatedBy: actor,
      updatedAt: serverTimestamp(),
    })
    return { id }
  }
  const ref = await addDoc(collection(firestore, collectionName), {
    ...payload,
    createdBy: actor,
    createdByUid: user?.uid || '',
    updatedBy: actor,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return { id: ref.id }
}

async function removeCollectionDoc(collectionName, id) {
  const firestore = ensureDb()
  await deleteDoc(doc(firestore, collectionName, id))
}

function sortByRecent(a, b) {
  return toMillis(b.updatedAt || b.createdAt) - toMillis(a.updatedAt || a.createdAt)
}

export function sortByCustomOrder(a, b) {
  const orderA = a.order !== undefined && a.order !== null && a.order !== '' ? Number(a.order) : 999999
  const orderB = b.order !== undefined && b.order !== null && b.order !== '' ? Number(b.order) : 999999
  if (orderA !== orderB) {
    return orderA - orderB
  }
  return toMillis(b.updatedAt || b.createdAt) - toMillis(a.updatedAt || a.createdAt)
}

/* ========================= NCERT MANAGER ========================= */

export async function listNcertItems() {
  const [cmsNcert, legacyNcert] = await Promise.all([
    listCollectionDocs('ncert_content', sortByRecent),
    listCollectionDocs('ncert_books', sortByRecent).catch(() => []),
  ])
  return [
    ...cmsNcert.map((item) => ({ ...item, isLegacy: false })),
    ...legacyNcert.map((item) => ({ ...item, isLegacy: true })),
  ]
}

export async function listPublishedNcertItems() {
  if (!db) return []
  const [cmsPublished, legacySnap] = await Promise.all([
    listPublishedDocs('ncert_content', sortByRecent),
    getDocs(collection(db, 'ncert_books')).catch(() => ({ docs: [] })),
  ])
  const legacyItems = (legacySnap.docs || [])
    .map((d) => ({ id: d.id, ...d.data(), _collection: 'ncert_books', isLegacy: true }))
    .filter((item) => !item.status || item.status === 'published')
  return [...cmsPublished, ...legacyItems]
}

export async function saveNcertItem({ id, targetCollection = 'ncert_content', data, user }) {
  const payload = {
    title: String(data.title || '').trim() || 'Untitled NCERT Resource',
    classLevel: String(data.classLevel || '').trim(),
    subject: String(data.subject || '').trim(),
    book: String(data.book || '').trim(),
    chapter: String(data.chapter || '').trim(),
    language: data.language || 'en',
    contentType: data.contentType || 'PDF',
    fileUrl: String(data.fileUrl || '').trim(),
    r2Key: String(data.r2Key || '').trim(),
    size: Number(data.size || 0),
    description: String(data.description || '').trim(),
    status: data.status === 'published' ? 'published' : 'draft',
  }
  const safeCol = targetCollection === 'ncert_books' ? 'ncert_books' : 'ncert_content'
  return saveCollectionDoc(safeCol, id, payload, user)
}

export async function deleteNcertItem(id, targetCollection = 'ncert_content') {
  const safeCol = targetCollection === 'ncert_books' ? 'ncert_books' : 'ncert_content'
  return removeCollectionDoc(safeCol, id)
}

/* ========================= CLOUDFLARE R2 NCRT SYNC ========================= */

export async function listR2NcrtFiles() {
  try {
    const data = await callWorkerApi('/api/ncrt/files')
    return Array.isArray(data?.objects) ? data.objects : []
  } catch (err) {
    console.warn('Unable to list R2 ncrt bucket files:', err)
    return []
  }
}

export async function uploadNcrtToR2({
  file,
  classLevel,
  subject,
  key,
  relativePath,
  idToken,
  onProgress,
}) {
  if (!file) throw new Error('No file selected for R2 upload')
  if (!idToken) throw new Error('Missing authentication token for R2 upload')

  const formData = new FormData()
  formData.append('file', file)
  if (classLevel) formData.append('classLevel', classLevel)
  if (subject) formData.append('subject', subject)
  if (key) formData.append('key', key)
  if (relativePath) formData.append('relativePath', relativePath)

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${WORKER_API_URL}/api/ncrt/upload`)
    xhr.setRequestHeader('Authorization', `Bearer ${idToken}`)

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && typeof onProgress === 'function') {
        const percent = Math.round((event.loaded / event.total) * 100)
        onProgress(percent)
      }
    }

    xhr.onload = () => {
      let parsed = {}
      try {
        parsed = JSON.parse(xhr.responseText || '{}')
      } catch {
        parsed = {}
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(parsed)
      } else {
        reject(new Error(parsed.error || `R2 upload failed with status ${xhr.status}`))
      }
    }

    xhr.onerror = () => {
      reject(new Error(`Unable to reach Cloudflare Worker at ${WORKER_API_URL}`))
    }

    xhr.send(formData)
  })
}

export async function deleteNcrtFromR2(key) {
  if (!key) return
  return callWorkerApi('/api/ncrt/delete', {
    method: 'DELETE',
    body: { key },
  })
}

export async function syncR2NcrtWithFirestore(user) {
  const r2Files = await listR2NcrtFiles()
  if (!r2Files.length) {
    return {
      ok: true,
      message: 'Cloudflare R2 ncrt bucket is empty or not yet connected.',
      totalR2: 0,
      added: 0,
      updated: 0,
    }
  }

  const existingItems = await listNcertItems()
  const existingMap = new Map()
  existingItems.forEach((item) => {
    if (item.r2Key) existingMap.set(item.r2Key, item)
    if (item.fileUrl) existingMap.set(item.fileUrl, item)
  })

  let added = 0
  let updated = 0

  for (const file of r2Files) {
    const matched = existingMap.get(file.key) || existingMap.get(file.url)
    const payload = {
      title: file.title || file.filename || 'NCERT Resource',
      classLevel: file.classLevel || 'Class 12',
      subject: file.subject || 'Geography',
      chapter: file.chapter || '',
      book: file.book || '',
      language: file.language || 'en',
      contentType: 'PDF',
      fileUrl: file.url,
      r2Key: file.key,
      size: file.size || 0,
      status: 'published',
      syncedAt: new Date().toISOString(),
    }

    if (matched) {
      await saveNcertItem({
        id: matched.id,
        targetCollection: matched._collection || 'ncert_content',
        data: { ...matched, ...payload },
        user,
      })
      updated += 1
    } else {
      await saveNcertItem({
        id: null,
        targetCollection: 'ncert_content',
        data: payload,
        user,
      })
      added += 1
    }
  }

  return {
    ok: true,
    totalR2: r2Files.length,
    added,
    updated,
    synced: added + updated,
  }
}

/* ========================= PYQ MANAGER ========================= */

export async function listPyqItems() {
  return listCollectionDocs('pyq', (a, b) => Number(b.year || 0) - Number(a.year || 0) || sortByRecent(a, b))
}

export async function listPublishedPyqItems() {
  return listPublishedDocs('pyq', (a, b) => Number(b.year || 0) - Number(a.year || 0) || sortByRecent(a, b))
}

export async function savePyqItem({ id, data, user }) {
  const payload = {
    title: String(data.title || '').trim() || `${data.examName || 'Exam'} ${data.year || ''} PYQ`.trim(),
    examName: String(data.examName || '').trim(),
    year: String(data.year || '').trim(),
    subject: String(data.subject || '').trim(),
    classOrPost: String(data.classOrPost || '').trim(),
    language: data.language || 'both',
    questionPaperUrl: String(data.questionPaperUrl || '').trim(),
    answerKeyUrl: String(data.answerKeyUrl || '').trim(),
    solutionUrl: String(data.solutionUrl || '').trim(),
    notes: String(data.notes || '').trim(),
    status: data.status === 'published' ? 'published' : 'draft',
  }
  return saveCollectionDoc('pyq', id, payload, user)
}

export async function deletePyqItem(id) {
  return removeCollectionDoc('pyq', id)
}

/* ========================= NOTES & STUDY MATERIALS ========================= */

export async function listNotes() {
  return listCollectionDocs('notes', sortByRecent)
}

export async function listPublishedNotes() {
  if (!db) return []
  try {
    const snap = await getDocs(collection(db, 'notes'))
    return snap.docs
      .map((d) => ({ id: d.id, ...d.data(), _collection: 'notes' }))
      .filter((item) => !item.status || item.status === 'published')
      .sort(sortByRecent)
  } catch {
    return []
  }
}

export async function saveNote({ id, data, user }) {
  const payload = {
    title: String(data.title || '').trim() || 'Untitled Study Note',
    description: String(data.description || '').trim(),
    subject: String(data.subject || '').trim(),
    classLevel: String(data.classLevel || '').trim(),
    examName: String(data.examName || '').trim(),
    category: String(data.category || '').trim(),
    fileUrl: String(data.fileUrl || '').trim(),
    thumbnailUrl: String(data.thumbnailUrl || '').trim(),
    language: data.language || 'en',
    status: data.status === 'published' ? 'published' : 'draft',
  }
  return saveCollectionDoc('notes', id, payload, user)
}

export async function deleteNote(id) {
  return removeCollectionDoc('notes', id)
}

/* ========================= QUIZ & QUESTION MANAGER ========================= */

export async function listQuizzes() {
  return listCollectionDocs('quizzes', sortByCustomOrder)
}

export function subscribeQuizzes(callback) {
  if (!db) {
    callback([])
    return () => {}
  }
  return onSnapshot(
    collection(db, 'quizzes'),
    (snap) => {
      const items = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort(sortByCustomOrder)
      callback(items)
    },
    (err) => {
      console.warn('Realtime admin quizzes sync error:', err)
    },
  )
}

export async function listPublishedQuizzes() {
  if (!db) return []
  try {
    const snap = await getDocs(collection(db, 'quizzes'))
    return snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((q) => q.status !== 'draft' && q.active !== false && q.status !== 'trashed')
      .sort(sortByCustomOrder)
  } catch (err) {
    console.warn('Failed to load published quizzes:', err)
    return []
  }
}

export function subscribePublishedQuizzes(callback) {
  if (!db) {
    callback([])
    return () => {}
  }
  return onSnapshot(
    collection(db, 'quizzes'),
    (snap) => {
      const items = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((q) => q.status !== 'draft' && q.active !== false && q.status !== 'trashed')
        .sort(sortByCustomOrder)
      callback(items)
    },
    (err) => {
      console.warn('Realtime published quizzes sync error:', err)
    },
  )
}

export async function updateQuizzesOrder(orderedQuizzes) {
  const firestore = ensureDb()
  const batch = writeBatch(firestore)
  orderedQuizzes.forEach((quiz, index) => {
    if (quiz.id) {
      const ref = doc(firestore, 'quizzes', quiz.id)
      batch.update(ref, {
        order: index,
        updatedAt: serverTimestamp(),
      })
    }
  })
  await batch.commit()
}

export async function saveQuiz({ id, data, user }) {
  const active = Boolean(data.active)
  const collectionId = String(data.collectionId || data.legacyCollectionName || '').trim()
  const questions = Array.isArray(data.questions)
    ? data.questions.map((q) => ({
        question: String(q.question || q.questionText || '').trim(),
        options: (Array.isArray(q.options) ? q.options : ['', '', '', '']).map((o) =>
          String(o || '').trim(),
        ),
        correctAnswerIndex: Number(
          q.correctAnswerIndex ?? q.correctOptionIndex ?? q.correctOption ?? 0,
        ),
        correctAnswerText: String(
          q.correctAnswerText ||
            (Array.isArray(q.options)
              ? q.options[
                  Number(q.correctAnswerIndex ?? q.correctOptionIndex ?? q.correctOption ?? 0)
                ]
              : '') ||
            '',
        ).trim(),
        explanation: String(q.explanation || '').trim(),
      }))
    : undefined

  const payload = {
    title: String(data.title || '').trim() || 'Untitled Quiz',
    slug: slugify(data.slug || data.title, 'quiz'),
    collectionId,
    description: String(data.description || '').trim(),
    subject: String(data.subject || '').trim(),
    category: String(data.category || '').trim(),
    durationMinutes: Math.max(1, Number(data.durationMinutes || 15)),
    marksPerQuestion: Math.max(0.25, Number(data.marksPerQuestion || 1)),
    negativeMarking: Math.max(0, Number(data.negativeMarking || 0)),
    totalMarks: Math.max(0, Number(data.totalMarks || 0)),
    scheduledStart: data.scheduledStart || '',
    scheduledEnd: data.scheduledEnd || '',
    legacyCollectionName: collectionId,
    active,
    status: active ? 'published' : data.status === 'published' ? 'published' : 'draft',
    order: data.order !== undefined && data.order !== null ? Number(data.order) : 0,
    ...(questions !== undefined ? { questions, questionCount: questions.length } : {}),
  }
  return saveCollectionDoc('quizzes', id, payload, user)
}

export async function deleteQuiz(id) {
  return removeCollectionDoc('quizzes', id)
}

export function normalizeQuestionRecord(raw) {
  const options = Array.isArray(raw.options) && raw.options.length > 0
    ? raw.options.map((o) => String(o ?? ''))
    : [raw.optA, raw.optB, raw.optC, raw.optD]
        .filter((v) => v !== undefined && v !== null && String(v).trim() !== '')
        .map((v) => String(v))

  let correctOption = Number(
    raw.correctOption ?? raw.correctOptionIndex ?? raw.correctAnswerIndex ?? raw.correctIndex ?? -1,
  )
  if (!Number.isInteger(correctOption) || correctOption < 0) {
    const ans = raw.correctAnswer ?? raw.answer ?? raw.ans
    if (typeof ans === 'number' && Number.isInteger(ans)) {
      correctOption = ans
    } else if (typeof ans === 'string') {
      const trimmed = ans.trim()
      if (/^\d+$/.test(trimmed)) {
        correctOption = Number(trimmed)
      } else if (/^[a-f]$/i.test(trimmed)) {
        correctOption = trimmed.toUpperCase().charCodeAt(0) - 65
      } else {
        correctOption = options.findIndex((opt) => opt.trim().toLowerCase() === trimmed.toLowerCase())
      }
    }
  }

  return {
    ...raw,
    questionText: raw.questionText || raw.question || raw.title || '',
    options: options.length >= 2 ? options : ['', '', '', ''],
    correctOption: correctOption >= 0 ? correctOption : 0,
    explanation: raw.explanation || '',
    imageUrl: raw.imageUrl || '',
    marks: Number(raw.marks || 0) || null,
    order: Number(raw.order ?? 0),
  }
}

export async function listQuizQuestions(quizId, legacyCollectionName = '') {
  const firestore = ensureDb()
  const results = []

  if (quizId) {
    const q = query(collection(firestore, 'questions'), where('quizId', '==', quizId))
    const snap = await getDocs(q)
    for (const d of snap.docs) {
      results.push(normalizeQuestionRecord({ id: d.id, ...d.data(), _collection: 'questions' }))
    }
  }

  if (legacyCollectionName && results.length === 0) {
    const legacySnap = await getDocs(collection(firestore, legacyCollectionName))
    for (const d of legacySnap.docs) {
      results.push(
        normalizeQuestionRecord({ id: d.id, ...d.data(), _collection: legacyCollectionName }),
      )
    }
  }

  if (quizId && results.length === 0) {
    const quizSnap = await getDoc(doc(firestore, 'quizzes', quizId))
    const quizData = quizSnap.exists() ? quizSnap.data() : null
    if (Array.isArray(quizData?.questions) && quizData.questions.length > 0) {
      quizData.questions.forEach((item, idx) => {
        results.push(
          normalizeQuestionRecord({
            id: `embedded_${idx}`,
            ...item,
            order: idx + 1,
            _collection: 'quizzes',
          }),
        )
      })
    }
  }

  return results.sort((a, b) => Number(a.order ?? 0) - Number(b.order ?? 0))
}

export async function saveQuizQuestion({ id, quizId, targetCollection = 'questions', data, user }) {
  const options = (Array.isArray(data.options) ? data.options : []).map((opt) => String(opt || '').trim())
  if (options.filter(Boolean).length < 2) {
    throw new Error('Provide at least 2 non-empty options for a question.')
  }
  const safeCorrect = Math.min(Math.max(0, Number(data.correctOption || 0)), options.length - 1)
  const payload = {
    quizId: quizId || '',
    questionText: String(data.questionText || '').trim(),
    options,
    correctOption: safeCorrect,
    explanation: String(data.explanation || '').trim(),
    imageUrl: String(data.imageUrl || '').trim(),
    marks: data.marks ? Number(data.marks) : null,
    order: Number(data.order ?? 0),
    status: data.status === 'draft' ? 'draft' : 'published',
  }
  return saveCollectionDoc(targetCollection || 'questions', id, payload, user)
}

export async function deleteQuizQuestion(id, targetCollection = 'questions') {
  return removeCollectionDoc(targetCollection || 'questions', id)
}

/* ========================= QUIZ ATTEMPTS & ANALYTICS ========================= */

export async function listQuizAttempts(quizId = '') {
  const firestore = ensureDb()
  const baseRef = collection(firestore, 'quiz_attempts')
  const q = quizId ? query(baseRef, where('quizId', '==', quizId)) : baseRef
  const snap = await getDocs(q)
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => toMillis(b.submittedAt || b.createdAt) - toMillis(a.submittedAt || a.createdAt))
}

export function computeQuizAnalytics(attempts, questions = []) {
  if (!attempts.length) {
    return {
      totalParticipants: 0,
      highestScore: 0,
      lowestScore: 0,
      averageScore: 0,
      leaderboard: [],
      questionStats: [],
    }
  }

  const numericScores = attempts.map((a) => Number(a.score ?? 0))
  const sum = numericScores.reduce((acc, s) => acc + s, 0)
  const highestScore = Math.max(...numericScores)
  const lowestScore = Math.min(...numericScores)
  const averageScore = Math.round((sum / attempts.length) * 100) / 100

  const bestByUser = new Map()
  for (const att of attempts) {
    const key = att.userId || att.uid || att.userEmail || att.id
    const prev = bestByUser.get(key)
    const curScore = Number(att.score ?? 0)
    if (!prev || curScore > Number(prev.score ?? 0)) {
      bestByUser.set(key, att)
    }
  }

  const leaderboard = [...bestByUser.values()]
    .sort((a, b) => Number(b.score ?? 0) - Number(a.score ?? 0))
    .slice(0, 25)

  const questionStats = questions.map((q) => {
    let attempted = 0
    let correct = 0
    for (const att of attempts) {
      const sel = att.answers?.[q.id]
      if (sel !== undefined && sel !== null && sel !== '' && Number(sel) >= 0) {
        attempted += 1
        if (Number(sel) === Number(q.correctOption)) {
          correct += 1
        }
      }
    }
    return {
      questionId: q.id,
      questionText: q.questionText,
      attempted,
      correct,
      accuracy: attempted > 0 ? Math.round((correct / attempted) * 100) : 0,
    }
  })

  return {
    totalParticipants: bestByUser.size,
    highestScore,
    lowestScore,
    averageScore,
    leaderboard,
    questionStats,
  }
}

export async function submitQuizToWorker({
  quizId,
  collectionName = '',
  answers,
  durationSeconds = 0,
  idToken,
  saveAttempt = true,
}) {
  if (!idToken) {
    throw new Error('Sign in with Google to submit quiz answers to the scoring Worker.')
  }

  const response = await fetch(`${WORKER_API_URL}/api/quiz/score`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      quizId,
      collectionName,
      answers,
      durationSeconds,
      saveAttempt,
    }),
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(data.error || `Quiz scoring Worker failed with status ${response.status}`)
  }
  return data
}
