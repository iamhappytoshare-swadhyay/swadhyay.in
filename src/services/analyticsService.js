import { getAnalytics, isSupported, logEvent } from 'firebase/analytics'
import { addDoc, collection, getDocs, serverTimestamp } from 'firebase/firestore'
import { app, db } from '../firebase.js'
import { toMillis } from '../utils/slugify.js'

let analyticsInstancePromise = null

async function getFirebaseAnalyticsSafe() {
  if (!app || !import.meta.env.VITE_FIREBASE_MEASUREMENT_ID) return null
  if (!analyticsInstancePromise) {
    analyticsInstancePromise = isSupported()
      .then((ok) => (ok ? getAnalytics(app) : null))
      .catch(() => null)
  }
  return analyticsInstancePromise
}

function getOrCreateSessionId() {
  try {
    let sid = sessionStorage.getItem('swadhyay-analytics-sid')
    if (!sid) {
      sid = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
      sessionStorage.setItem('swadhyay-analytics-sid', sid)
    }
    return sid
  } catch {
    return 'anon'
  }
}

export async function trackAnalyticsEvent({
  eventType,
  targetId = '',
  targetTitle = '',
  category = '',
  className = '',
  subject = '',
  uid = '',
  durationSeconds = 0,
}) {
  if (!db || !eventType) return

  // Deduplicate page_view and content_view per session + target
  if (eventType === 'page_view' || eventType === 'content_view') {
    const dedupeKey = `swadhyay-ev-${eventType}-${targetId || targetTitle}`
    try {
      if (sessionStorage.getItem(dedupeKey)) return
      sessionStorage.setItem(dedupeKey, '1')
    } catch {
      /* Ignore storage restrictions */
    }
  }

  try {
    await addDoc(collection(db, 'analytics_events'), {
      eventType,
      targetId: String(targetId || ''),
      targetTitle: String(targetTitle || ''),
      category: String(category || ''),
      className: String(className || ''),
      subject: String(subject || ''),
      uid: String(uid || ''),
      sessionId: getOrCreateSessionId(),
      durationSeconds: Number(durationSeconds || 0),
      createdAt: serverTimestamp(),
    })
  } catch {
    /* Non-blocking analytics write */
  }

  try {
    const ga = await getFirebaseAnalyticsSafe()
    if (ga) {
      logEvent(ga, eventType, {
        target_id: targetId,
        target_title: targetTitle,
        category,
      })
    }
  } catch {
    /* Ignore GA errors */
  }
}

export function getDateRangeBounds(preset, customStart, customEnd) {
  const now = new Date()
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()

  if (preset === 'today') return { startMs: startOfToday, endMs: endOfToday }
  if (preset === 'yesterday') {
    return { startMs: startOfToday - 86400000, endMs: startOfToday - 1 }
  }
  if (preset === '7d') return { startMs: startOfToday - 6 * 86400000, endMs: endOfToday }
  if (preset === '30d') return { startMs: startOfToday - 29 * 86400000, endMs: endOfToday }
  if (preset === '90d') return { startMs: startOfToday - 89 * 86400000, endMs: endOfToday }
  if (preset === 'year') {
    return { startMs: new Date(now.getFullYear(), 0, 1).getTime(), endMs: endOfToday }
  }
  if (preset === 'custom') {
    const startMs = customStart ? new Date(`${customStart}T00:00:00`).getTime() : 0
    const endMs = customEnd ? new Date(`${customEnd}T23:59:59.999`).getTime() : endOfToday
    return { startMs, endMs }
  }
  return { startMs: 0, endMs: endOfToday }
}

export async function fetchAnalyticsSnapshot({ preset = '30d', customStart = '', customEnd = '' }) {
  if (!db) throw new Error('Firestore is not configured.')

  const { startMs, endMs } = getDateRangeBounds(preset, customStart, customEnd)
  const inRange = (ms) => ms > 0 && ms >= startMs && ms <= endMs

  const [eventsSnap, quizSnap, usersSnap, postsSnap, ncertSnap, commentsSnap] =
    await Promise.all([
      getDocs(collection(db, 'analytics_events')).catch(() => ({ docs: [] })),
      getDocs(collection(db, 'quiz_results')).catch(() => ({ docs: [] })),
      getDocs(collection(db, 'users')).catch(() => ({ docs: [] })),
      getDocs(collection(db, 'posts')).catch(() => ({ docs: [] })),
      getDocs(collection(db, 'ncert_content')).catch(() => ({ docs: [] })),
      getDocs(collection(db, 'comments')).catch(() => ({ docs: [] })),
    ])

  const events = eventsSnap.docs
    .map((d) => ({ id: d.id, ...d.data(), ms: toMillis(d.data()?.createdAt) }))
    .filter((e) => inRange(e.ms))

  const quizResults = quizSnap.docs
    .map((d) => ({ id: d.id, ...d.data(), ms: toMillis(d.data()?.submittedAt) }))
    .filter((q) => inRange(q.ms))

  const users = usersSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
  const posts = postsSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
  const ncert = ncertSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
  const comments = commentsSnap.docs.map((d) => ({ id: d.id, ...d.data() }))

  const pageViews = events.filter((e) => e.eventType === 'page_view')
  const contentViews = events.filter((e) => e.eventType === 'content_view')
  const pdfViews = events.filter((e) => e.eventType === 'pdf_view')
  const pdfDownloads = events.filter((e) => e.eventType === 'pdf_download')

  const uniqueVisitors = new Set(
    events.map((e) => e.uid || e.sessionId).filter(Boolean),
  ).size

  const now = Date.now()
  const dau = users.filter((u) => toMillis(u.lastLoginAt) >= now - 86400000).length
  const mau = users.filter((u) => toMillis(u.lastLoginAt) >= now - 30 * 86400000).length

  // Quiz analytics
  const uniqueQuizUsers = new Set(
    quizResults.map((q) => q.uid || q.userId).filter(Boolean),
  ).size
  const avgQuizScore = quizResults.length
    ? Math.round(
        quizResults.reduce((acc, q) => acc + Number(q.percentage || 0), 0) /
          quizResults.length,
      )
    : 0
  const avgQuizDuration = quizResults.length
    ? Math.round(
        quizResults.reduce((acc, q) => acc + Number(q.durationSeconds || 0), 0) /
          quizResults.length,
      )
    : 0

  const quizCountsMap = new Map()
  quizResults.forEach((q) => {
    const title = q.quizTitle || q.quizId || 'Quiz'
    const entry = quizCountsMap.get(title) || { name: title, attempts: 0, totalPct: 0 }
    entry.attempts += 1
    entry.totalPct += Number(q.percentage || 0)
    quizCountsMap.set(title, entry)
  })
  const quizLeaderboard = Array.from(quizCountsMap.values())
    .map((item) => ({
      name: item.name,
      attempts: item.attempts,
      avgScore: Math.round(item.totalPct / item.attempts),
    }))
    .sort((a, b) => b.attempts - a.attempts)

  // Daily trend series (actual events + quiz attempts)
  const dayMap = new Map()
  const addDay = (ms, key) => {
    if (!ms) return
    const day = new Date(ms).toISOString().slice(0, 10)
    const row = dayMap.get(day) || {
      date: day,
      pageViews: 0,
      quizAttempts: 0,
      pdfViews: 0,
      pdfDownloads: 0,
    }
    row[key] += 1
    dayMap.set(day, row)
  }
  pageViews.forEach((e) => addDay(e.ms, 'pageViews'))
  pdfViews.forEach((e) => addDay(e.ms, 'pdfViews'))
  pdfDownloads.forEach((e) => addDay(e.ms, 'pdfDownloads'))
  quizResults.forEach((q) => addDay(q.ms, 'quizAttempts'))

  const dailySeries = Array.from(dayMap.values()).sort((a, b) =>
    a.date.localeCompare(b.date),
  )

  // PDF document stats
  const docStatsMap = new Map()
  ;[...pdfViews, ...pdfDownloads].forEach((e) => {
    const title = e.targetTitle || e.targetId || 'Document'
    const row = docStatsMap.get(title) || {
      title,
      className: e.className || 'General',
      subject: e.subject || 'General',
      views: 0,
      downloads: 0,
    }
    if (e.eventType === 'pdf_view') row.views += 1
    else row.downloads += 1
    docStatsMap.set(title, row)
  })
  const documentStats = Array.from(docStatsMap.values()).sort(
    (a, b) => b.downloads + b.views - (a.downloads + a.views),
  )

  // Category & content engagement
  const categoryMap = new Map()
  contentViews.forEach((e) => {
    const cat = e.category || 'General'
    categoryMap.set(cat, (categoryMap.get(cat) || 0) + 1)
  })
  const categoryEngagement = Array.from(categoryMap.entries()).map(([name, value]) => ({
    name,
    value,
  }))

  const readingTimes = contentViews
    .map((e) => Number(e.durationSeconds || 0))
    .filter((s) => s > 0)
  const avgReadingTimeSec = readingTimes.length
    ? Math.round(readingTimes.reduce((a, b) => a + b, 0) / readingTimes.length)
    : 0

  return {
    overview: {
      totalVisitors: uniqueVisitors,
      totalPageViews: pageViews.length,
      registeredUsers: users.length,
      dau,
      mau,
      totalQuizAttempts: quizResults.length,
      totalPdfViews: pdfViews.length,
      totalPdfDownloads: pdfDownloads.length,
      totalContentViews: contentViews.length,
      totalComments: comments.length,
      publishedPosts: posts.filter((p) => p.status === 'published').length,
      ncertItems: ncert.length,
      avgReadingTimeSec,
    },
    quiz: {
      totalAttempts: quizResults.length,
      uniqueParticipants: uniqueQuizUsers,
      avgScore: avgQuizScore,
      avgCompletionSec: avgQuizDuration,
      mostAttempted: quizLeaderboard.slice(0, 6),
      leastAttempted: [...quizLeaderboard].reverse().slice(0, 5),
    },
    dailySeries,
    documentStats,
    categoryEngagement,
  }
}
