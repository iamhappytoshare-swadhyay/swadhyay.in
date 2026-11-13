import { useCallback, useEffect, useMemo, useState } from 'react'
import Icon from './Icon.jsx'
import QuizRunnerModal from './QuizRunnerModal.jsx'
import PostCommentsSection from './PostCommentsSection.jsx'
import UniversalPostRenderer from './UniversalPostRenderer.jsx'
import NcertExplorer from './NcertExplorer.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { trackAnalyticsEvent } from '../services/analyticsService.js'
import {
  listLeaderboardEntries,
  listUserQuizResults,
  recordUserDownload,
  toggleUserBookmark,
  updateStudentProfile,
} from '../services/studentService.js'
import { isStudentView } from '../routes.js'
import { renderMathInHtml } from '../utils/renderMathHtml.js'
import { formatDate } from '../utils/slugify.js'
import {
  categoryIcon,
  categoryTone,
  helpItems,
} from '../data/catalog.js'

function postMatchesCategory(post, category) {
  if (!category) return false
  const cats = Array.isArray(post.categories) ? post.categories : [post.category]
  return cats.includes(category)
}

function PostCardsGrid({ posts, onOpenPath }) {
  return (
    <div className="post-card-grid">
      {posts.map((post) => {
        const primaryCat = Array.isArray(post.categories) ? post.categories[0] : post.category
        return (
          <button
            key={post.id}
            type="button"
            className="feature-card"
            onClick={() => onOpenPath(`/post/${post.slug}`)}
          >
            {post.featuredImage ? (
              <img src={post.featuredImage} alt="" className="post-card-thumb" />
            ) : (
              <span className={`tone tone-${categoryTone[primaryCat] || 'navy'}`}>
                <Icon name={categoryIcon[primaryCat] || 'file'} size={18} />
              </span>
            )}
            <span className="card-title">{post.title}</span>
            {post.shortDescription ? (
              <span className="card-text">{post.shortDescription}</span>
            ) : null}
            <span className="card-meta">
              {primaryCat ? `${primaryCat}` : ''}
              {post.showDate !== false
                ? `${primaryCat ? ' · ' : ''}${formatDate(post.publishedAt || post.updatedAt)}`
                : ''}
            </span>
          </button>
        )
      })}
    </div>
  )
}

const RAINBOW_COLORS = [
  { bg: '#dc2626', text: '#ffffff', accent: '#dc2626' }, // 1. लाल
  { bg: '#ea580c', text: '#ffffff', accent: '#ea580c' }, // 2. नारंगी
  { bg: '#eab308', text: '#1e1b4b', accent: '#ca8a04' }, // 3. पीला (dark text for contrast)
  { bg: '#16a34a', text: '#ffffff', accent: '#16a34a' }, // 4. हरा
  { bg: '#2563eb', text: '#ffffff', accent: '#2563eb' }, // 5. नीला
  { bg: '#4f46e5', text: '#ffffff', accent: '#4f46e5' }, // 6. जामुनी
  { bg: '#7c3aed', text: '#ffffff', accent: '#7c3aed' }, // 7. बैंगनी
]

function QuizCardsGrid({ quizzes, onStartQuiz }) {
  if (!quizzes?.length) return null
  return (
    <div className="quiz-cards-grid-2col">
      {quizzes.map((quiz, idx) => {
        const rowIndex = Math.floor(idx / 2)
        const color = RAINBOW_COLORS[rowIndex % RAINBOW_COLORS.length]
        const questionCount =
          quiz.totalQuestions ||
          quiz.questionsCount ||
          quiz.questionCount ||
          (Array.isArray(quiz.questions) ? quiz.questions.length : 30)
        const durationMinutes = quiz.durationMinutes || quiz.duration || 20

        return (
          <div
            key={quiz.id}
            style={{
              background: 'var(--card-bg, #ffffff)',
              borderRadius: 14,
              border: '1px solid var(--border, #e2e8f0)',
              boxShadow: '0 2px 6px rgba(0, 0, 0, 0.04)',
              padding: '10px 10px 10px 10px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              minWidth: 0,
              overflow: 'hidden',
              transition: 'transform 0.15s ease, box-shadow 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)'
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.08)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'none'
              e.currentTarget.style.boxShadow = '0 2px 6px rgba(0, 0, 0, 0.04)'
            }}
          >
            {/* Card Title */}
            <div
              style={{
                fontSize: '0.94rem',
                fontWeight: 700,
                color: '#1e1b4b',
                lineHeight: 1.25,
                minHeight: '2.4em',
                marginBottom: 8,
                wordBreak: 'break-word',
              }}
              title={quiz.title}
            >
              {quiz.title}
            </div>

            {/* Bottom Row: Start Quiz Button + Stats */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 6,
                marginTop: 'auto',
                minWidth: 0,
              }}
            >
              {/* Start Quiz Button */}
              <button
                type="button"
                onClick={() => onStartQuiz(quiz)}
                style={{
                  background: color.bg,
                  color: color.text,
                  border: 'none',
                  borderRadius: 8,
                  padding: '6px 8px',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  cursor: 'pointer',
                  boxShadow: '0 2px 4px rgba(0, 0, 0, 0.12)',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
                <span>Start Quiz</span>
              </button>

              {/* Questions & Duration Info */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                  fontSize: '0.74rem',
                  fontWeight: 600,
                  color: '#1e293b',
                  textAlign: 'right',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
              >
                {/* Question count */}
                <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end', gap: 3 }}>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 14,
                      height: 14,
                      borderRadius: 3,
                      border: `1.5px solid ${color.accent}`,
                      color: color.accent,
                      fontSize: '0.64rem',
                      fontWeight: 800,
                      lineHeight: 1,
                    }}
                  >
                    ?
                  </span>
                  <span>{questionCount} प्रश्न</span>
                </div>

                {/* Duration */}
                <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end', gap: 3 }}>
                  <span style={{ color: color.accent, display: 'inline-flex', alignItems: 'center' }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={color.accent} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="13" r="8" />
                      <path d="M12 9v4l2 2" />
                      <path d="M10 2h4" />
                    </svg>
                  </span>
                  <span>{durationMinutes} मि.</span>
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function NotesCardsList({ notes, onTrackDownload, onOpenFile }) {
  if (!notes?.length) return null
  return (
    <div className="list">
      {notes.map((note) => {
        const href = note.fileUrl || note.pdfUrl || note.url || ''
        return (
          <a
            key={note.id}
            href={href || '#'}
            target={href ? '_blank' : undefined}
            rel={href ? 'noopener noreferrer' : undefined}
            className="row"
            style={{ textDecoration: 'none' }}
            onClick={(e) => {
              if (onOpenFile) {
                onOpenFile(e, {
                  href,
                  id: note.id,
                  type: 'note',
                  title: note.title,
                  category: note.category || note.subject || 'general',
                })
              } else if (href && onTrackDownload) {
                onTrackDownload({
                  id: note.id,
                  type: 'note',
                  title: note.title,
                  category: note.category || note.subject || 'general',
                  url: href,
                })
              }
            }}
          >
            <span className="tone tone-teal">
              <Icon name="download" size={18} />
            </span>
            <span className="row-copy">
              <span className="row-title">{note.title}</span>
              {note.description ? <span className="row-text">{note.description}</span> : null}
              <span className="row-meta">
                {note.subject || 'Notes'}
                {note.examName ? ` · ${note.examName}` : ''}
                {note.language ? ` · ${String(note.language).toUpperCase()}` : ''}
              </span>
            </span>
          </a>
        )
      })}
    </div>
  )
}

function SearchResults({
  t,
  query,
  publishedPosts,
  publishedPages,
  publishedQuizzes = [],
  publishedNotes = [],
  publishedNcert = [],
  publishedPyq = [],
  onOpenPath,
  onStartQuiz,
  onTrackDownload,
  onOpenFile,
}) {
  const needle = query.trim().toLowerCase()

  const postMatches = publishedPosts.filter((post) => {
    const hay = `${post.title || ''} ${post.shortDescription || ''} ${(post.tags || []).join(' ')} ${(post.categories || []).join(' ')}`.toLowerCase()
    return hay.includes(needle)
  })

  const pageMatches = publishedPages.filter((page) => {
    const hay = `${page.title || ''} ${page.metaDescription || ''}`.toLowerCase()
    return hay.includes(needle)
  })

  const quizMatches = publishedQuizzes.filter((quiz) => {
    const hay = `${quiz.title || ''} ${quiz.description || ''} ${quiz.category || ''} ${quiz.subject || ''}`.toLowerCase()
    return hay.includes(needle)
  })

  const noteMatches = publishedNotes.filter((note) => {
    const hay = `${note.title || ''} ${note.description || ''} ${note.subject || ''} ${note.examName || ''}`.toLowerCase()
    return hay.includes(needle)
  })

  const ncertMatches = publishedNcert.filter((item) => {
    const hay = `${item.title || ''} ${item.subject || ''} ${item.book || ''} ${item.classLevel || item.class || ''}`.toLowerCase()
    return hay.includes(needle)
  })

  const pyqMatches = publishedPyq.filter((item) => {
    const hay = `${item.title || ''} ${item.examName || ''} ${item.subject || ''} ${item.year || ''}`.toLowerCase()
    return hay.includes(needle)
  })

  const totalCount =
    postMatches.length +
    pageMatches.length +
    quizMatches.length +
    noteMatches.length +
    ncertMatches.length +
    pyqMatches.length

  return (
    <>
      <header className="page-head">
        <h1>{t.searchHeading}</h1>
        <p className="lede">
          {t.resultsFor} “{query.trim()}” · {totalCount} {t.resultsLabel}
        </p>
      </header>
      {totalCount === 0 ? (
        <p className="empty">{t.noResults}</p>
      ) : (
        <div className="list">
          {postMatches.map((post) => (
            <button
              key={`post-${post.id}`}
              type="button"
              className="row"
              onClick={() => onOpenPath(`/post/${post.slug}`)}
            >
              <span className="tone tone-red">
                <Icon name="file" size={18} />
              </span>
              <span className="row-copy">
                <span className="row-title">{post.title}</span>
                {post.shortDescription ? (
                  <span className="row-text">{post.shortDescription}</span>
                ) : null}
                <span className="row-meta">
                  {post.category || 'Article'}
                  {post.showDate !== false
                    ? ` · ${formatDate(post.publishedAt || post.updatedAt)}`
                    : ''}
                </span>
              </span>
            </button>
          ))}
          {quizMatches.map((quiz) => (
            <button
              key={`quiz-${quiz.id}`}
              type="button"
              className="row"
              onClick={() => onStartQuiz(quiz)}
            >
              <span className="tone tone-amber">
                <Icon name="trophy" size={18} />
              </span>
              <span className="row-copy">
                <span className="row-title">{quiz.title}</span>
                {quiz.description ? <span className="row-text">{quiz.description}</span> : null}
                <span className="row-meta">
                  Quiz · {quiz.durationMinutes || 15} min
                </span>
              </span>
            </button>
          ))}
          {noteMatches.map((note) => {
            const href = note.fileUrl || note.pdfUrl || note.url || ''
            return (
              <a
                key={`note-${note.id}`}
                href={href || '#'}
                target={href ? '_blank' : undefined}
                rel={href ? 'noopener noreferrer' : undefined}
                className="row"
                style={{ textDecoration: 'none' }}
                onClick={(e) => {
                  if (onOpenFile) {
                    onOpenFile(e, {
                      href,
                      id: note.id,
                      type: 'note',
                      title: note.title,
                      category: note.category || note.subject || 'general',
                    })
                  } else if (href) {
                    onTrackDownload?.({
                      id: note.id,
                      type: 'note',
                      title: note.title,
                      category: note.category || note.subject || 'general',
                      url: href,
                    })
                  }
                }}
              >
                <span className="tone tone-teal">
                  <Icon name="download" size={18} />
                </span>
                <span className="row-copy">
                  <span className="row-title">{note.title}</span>
                  <span className="row-meta">{note.subject || 'Notes'}</span>
                </span>
              </a>
            )
          })}
          {ncertMatches.map((item) => {
            const href = item.fileUrl || item.url || item.pdfUrl || ''
            return (
              <a
                key={`ncert-${item.id}`}
                href={href || '#'}
                target={href ? '_blank' : undefined}
                rel={href ? 'noopener noreferrer' : undefined}
                className="row"
                style={{ textDecoration: 'none' }}
                onClick={(e) => {
                  if (onOpenFile) {
                    onOpenFile(e, {
                      href,
                      id: item.id,
                      type: 'ncert',
                      title: item.title,
                      category: 'ncert',
                    })
                  } else if (href) {
                    onTrackDownload?.({
                      id: item.id,
                      type: 'ncert',
                      title: item.title,
                      category: 'ncert',
                      url: href,
                    })
                  }
                }}
              >
                <span className="tone tone-red">
                  <Icon name="book" size={18} />
                </span>
                <span className="row-copy">
                  <span className="row-title">{item.title}</span>
                  <span className="row-meta">
                    {item.classLevel || item.class || 'NCERT'} · {item.subject || 'Subject'}
                  </span>
                </span>
              </a>
            )
          })}
          {pyqMatches.map((item) => {
            const href = item.questionPaperUrl || item.solutionUrl || item.answerKeyUrl || ''
            return (
              <a
                key={`pyq-${item.id}`}
                href={href || '#'}
                target={href ? '_blank' : undefined}
                rel={href ? 'noopener noreferrer' : undefined}
                className="row"
                style={{ textDecoration: 'none' }}
                onClick={(e) => {
                  if (onOpenFile) {
                    onOpenFile(e, {
                      href,
                      id: item.id,
                      type: 'pyq',
                      title: item.title,
                      category: 'pyq',
                    })
                  } else if (href) {
                    onTrackDownload?.({
                      id: item.id,
                      type: 'pyq',
                      title: item.title,
                      category: 'pyq',
                      url: href,
                    })
                  }
                }}
              >
                <span className="tone tone-navy">
                  <Icon name="file" size={18} />
                </span>
                <span className="row-copy">
                  <span className="row-title">{item.title}</span>
                  <span className="row-meta">
                    {item.examName || 'PYQ'} ({item.year || '—'})
                  </span>
                </span>
              </a>
            )
          })}
          {pageMatches.map((page) => (
            <button
              key={`page-${page.id}`}
              type="button"
              className="row"
              onClick={() => onOpenPath(`/page/${page.slug}`)}
            >
              <span className="tone tone-navy">
                <Icon name="book" size={18} />
              </span>
              <span className="row-copy">
                <span className="row-title">{page.title}</span>
                {page.metaDescription ? (
                  <span className="row-text">{page.metaDescription}</span>
                ) : null}
              </span>
            </button>
          ))}
        </div>
      )}
    </>
  )
}

function Home({
  t,
  category,
  publishedPosts,
  publishedNotes = [],
  publishedQuizzes = [],
  profile,
  quizResults = [],
  onOpenPath,
  onStartQuiz,
  onTrackDownload,
  onOpenFile,
}) {
  const orderedPosts = useMemo(() => {
    if (!publishedPosts.length) return []
    return [...publishedPosts].sort((a, b) => {
      const aMatch = postMatchesCategory(a, category) ? 0 : 1
      const bMatch = postMatchesCategory(b, category) ? 0 : 1
      return aMatch - bMatch
    })
  }, [publishedPosts, category])

  const hasAnyLiveContent =
    orderedPosts.length > 0 || publishedQuizzes.length > 0 || publishedNotes.length > 0

  const totalRankScore = Math.round(
    quizResults.reduce((sum, r) => sum + Number(r.score ?? r.marksObtained ?? 0), 0),
  )
  const solvedQuizCount = quizResults.length
  const booksStudiedCount = Array.isArray(profile?.downloads) ? profile.downloads.length : 0

  return (
    <>
      <section className="hero-panel">
        <div className="hero-copy">
          <h1>{t.welcome}</h1>
          <p className="tagline">{t.tagline}</p>
        </div>
        <div className="home-user-metrics" aria-label="User Performance Summary">
          <button
            type="button"
            className="metric-box metric-box--rank"
            onClick={() => onOpenPath('/leaderboard')}
          >
            <span className="metric-title">All India Rank</span>
            <strong className="metric-value">{totalRankScore}</strong>
          </button>
          <button
            type="button"
            className="metric-box metric-box--quiz"
            onClick={() => onOpenPath('/progress')}
          >
            <span className="metric-title">Solved Quiz</span>
            <strong className="metric-value">{solvedQuizCount}</strong>
          </button>
          <button
            type="button"
            className="metric-box metric-box--books"
            onClick={() => onOpenPath('/downloads')}
          >
            <span className="metric-title">Books Studied</span>
            <strong className="metric-value">{booksStudiedCount}</strong>
          </button>
        </div>
      </section>

      {orderedPosts.length > 0 ? (
        <section className="panel" aria-labelledby="latest-articles-heading">
          <h2 id="latest-articles-heading">{t.latestArticlesTitle}</h2>
          <PostCardsGrid posts={orderedPosts.slice(0, 6)} onOpenPath={onOpenPath} />
        </section>
      ) : null}

      {publishedQuizzes.length > 0 ? (
        <section className="panel" aria-labelledby="live-quizzes-heading">
          <h2 id="live-quizzes-heading">Practice Quizzes</h2>
          <QuizCardsGrid quizzes={publishedQuizzes.slice(0, 6)} onStartQuiz={onStartQuiz} />
        </section>
      ) : null}

      {publishedNotes.length > 0 ? (
        <section className="panel" aria-labelledby="live-notes-heading">
          <h2 id="live-notes-heading">Published Notes &amp; Study PDFs</h2>
          <NotesCardsList
            notes={publishedNotes.slice(0, 8)}
            onTrackDownload={onTrackDownload}
            onOpenFile={onOpenFile}
          />
        </section>
      ) : null}

      {!hasAnyLiveContent ? (
        <section className="panel">
          <p className="empty">
            अभी कोई पोस्ट, क्विज़ या नोट्स प्रकाशित नहीं हैं। एडमिन पैनल से नई सामग्री जोड़ें।
          </p>
        </section>
      ) : null}
    </>
  )
}

const QUIZ_FILTER_CHIPS = [
  { id: 'history', labelHi: 'इतिहास', labelEn: 'History' },
  { id: 'geography', labelHi: 'भूगोल', labelEn: 'Geography' },
  { id: 'affairs', labelHi: 'समसामयिकी', labelEn: 'Current Affairs' },
  { id: 'gk', labelHi: 'सामान्य ज्ञान', labelEn: 'General Knowledge' },
]

function matchesQuizCategory(quiz, filterOrCategory) {
  if (!filterOrCategory || filterOrCategory === 'all') return true
  const target = String(filterOrCategory).toLowerCase().trim()
  const cat = String(quiz.category || '').toLowerCase()
  const subj = String(quiz.subject || '').toLowerCase()
  const title = String(quiz.title || '').toLowerCase()
  const desc = String(quiz.description || '').toLowerCase()
  const combined = `${cat} ${subj} ${title} ${desc}`

  if (target === 'history' || target === 'इतिहास') {
    return combined.includes('hist') || combined.includes('इतिहास')
  }
  if (target === 'geography' || target === 'भूगोल') {
    return combined.includes('geo') || combined.includes('भूगोल')
  }
  if (target === 'gk' || target === 'सामान्य ज्ञान' || target === 'ज्ञान') {
    return (
      combined.includes('gk') ||
      combined.includes('सामान्य') ||
      combined.includes('ज्ञान') ||
      combined.includes('general')
    )
  }
  if (target === 'affairs' || target === 'current' || target === 'समसामयिकी') {
    return (
      combined.includes('affair') ||
      combined.includes('समसामयिकी') ||
      combined.includes('current')
    )
  }
  return (
    cat === target ||
    subj === target ||
    cat.includes(target) ||
    subj.includes(target) ||
    title.includes(target)
  )
}

function SectionPage({
  t,
  view,
  publishedPages = [],
  publishedPosts,
  publishedNcert = [],
  publishedPyq = [],
  publishedNotes = [],
  publishedQuizzes = [],
  onOpenPath,
  onStartQuiz,
  onTrackDownload,
  onOpenFile,
  onHome,
}) {
  const [selectedQuizCategory, setSelectedQuizCategory] = useState('history')
  const [selectedNcertClass, setSelectedNcertClass] = useState('all')
  const [ncertSearch, setNcertSearch] = useState('')

  const cmsPage = publishedPages.find(
    (p) => String(p.slug || '').toLowerCase() === String(view || '').toLowerCase(),
  )
  const cmsPageHtml = useMemo(
    () => (cmsPage ? renderMathInHtml(cmsPage.content || '') : ''),
    [cmsPage],
  )
  const matchingPosts = publishedPosts.filter((post) => postMatchesCategory(post, view))
  const matchingNotes = publishedNotes.filter(
    (n) => n.category === view || String(n.subject || '').toLowerCase() === view,
  )
  const matchingQuizzes =
    view === 'quiz'
      ? publishedQuizzes.filter((q) => matchesQuizCategory(q, selectedQuizCategory))
      : publishedQuizzes.filter((q) => matchesQuizCategory(q, view))

  const sectionTitle = useMemo(() => {
    if (view === 'quiz') return t.nav?.quiz ? `${t.nav.quiz} (Quizzes)` : 'प्रश्नोत्तरी (Quiz)'
    if (view === 'pyq') return t.nav?.pyq || 'Previous Year Questions (PYQ)'
    if (view === 'history') return t.nav?.history || 'इतिहास (History)'
    if (view === 'geography') return t.nav?.geography || 'भूगोल (Geography)'
    if (view === 'kvs') return 'KVS-NVS'
    if (view === 'emrs') return 'EMRS'
    if (view === 'upessc') return 'UPESSC'
    if (cmsPage?.title) return cmsPage.title
    if (t.nav?.[view]) return t.nav[view]
    return view ? view.charAt(0).toUpperCase() + view.slice(1) : ''
  }, [cmsPage, t, view])

  const quizFilterCounts = useMemo(() => {
    const counts = {}
    QUIZ_FILTER_CHIPS.forEach((chip) => {
      counts[chip.id] = publishedQuizzes.filter((q) => matchesQuizCategory(q, chip.id)).length
    })
    return counts
  }, [publishedQuizzes])

  const ncertClassChips = useMemo(() => {
    const classes = ['all', 'Class 12', 'Class 11', 'Class 10', 'Class 9', 'Class 8', 'Class 7', 'Class 6']
    return classes.map((cls) => {
      const count =
        cls === 'all'
          ? publishedNcert.length
          : publishedNcert.filter(
              (item) => (item.classLevel || item.class || '').toLowerCase() === cls.toLowerCase(),
            ).length
      return { id: cls, label: cls === 'all' ? (t.nav?.all || 'सभी') : cls, count }
    })
  }, [publishedNcert, t])

  const filteredNcert = useMemo(() => {
    if (view !== 'ncert') return publishedNcert
    const query = ncertSearch.trim().toLowerCase()
    return publishedNcert.filter((item) => {
      const itemClass = (item.classLevel || item.class || '').toLowerCase()
      if (selectedNcertClass !== 'all' && itemClass !== selectedNcertClass.toLowerCase()) {
        return false
      }
      if (!query) return true
      return `${item.title || ''} ${item.subject || ''} ${item.book || ''} ${item.chapter || ''}`
        .toLowerCase()
        .includes(query)
    })
  }, [view, publishedNcert, selectedNcertClass, ncertSearch])

  const hasContent =
    Boolean(cmsPage) ||
    view === 'quiz' ||
    view === 'ncert' ||
    (view === 'pyq' && publishedPyq.length > 0) ||
    matchingQuizzes.length > 0 ||
    matchingNotes.length > 0 ||
    matchingPosts.length > 0

  return (
    <>
      {view !== 'ncert' ? (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
            flexWrap: 'wrap',
            marginBottom: 16,
            paddingBottom: 12,
            borderBottom: '1px solid var(--border)',
          }}
        >
          <h1
            style={{
              margin: 0,
              fontSize: 'clamp(1.25rem, 2.5vw, 1.75rem)',
              fontWeight: 800,
              color: 'var(--text-primary)',
            }}
          >
            {sectionTitle}
          </h1>
          {onHome ? (
            <button
              type="button"
              className="text-button"
              onClick={onHome}
              style={{
                padding: '6px 14px',
                borderRadius: 8,
                border: '1px solid var(--border)',
                background: 'var(--card-bg, #ffffff)',
                color: 'var(--text-primary)',
                fontSize: '0.88rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                flexShrink: 0,
              }}
            >
              ← {t.backToHome || 'वापस जाएं'}
            </button>
          ) : null}
        </div>
      ) : null}

      {view === 'quiz' ? (
        <nav
          aria-label="Quiz Subject Categories"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 14,
            overflowX: 'auto',
            padding: '2px 0 6px',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {QUIZ_FILTER_CHIPS.map((chip) => {
            const active = selectedQuizCategory === chip.id
            const label =
              t.locale === 'hi' || t.lang === 'hi' || t.nav?.home === 'होम'
                ? chip.labelHi
                : chip.labelEn
            return (
              <button
                key={chip.id}
                type="button"
                onClick={() => setSelectedQuizCategory(chip.id)}
                aria-pressed={active}
                style={{
                  padding: '7px 18px',
                  borderRadius: 10,
                  border: active ? '1.5px solid #c4b5fd' : '1.5px solid #cbd5e1',
                  background: active ? '#ede9fe' : 'var(--card-bg, #ffffff)',
                  color: active ? '#4338ca' : 'var(--text-primary, #1e293b)',
                  fontWeight: active ? 700 : 600,
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  boxShadow: active ? '0 1px 4px rgba(99, 102, 241, 0.15)' : 'none',
                  transition: 'all 0.15s ease',
                  userSelect: 'none',
                }}
              >
                {label}
              </button>
            )
          })}
        </nav>
      ) : null}

      {cmsPage && view !== 'ncert' && view !== 'quiz' ? (
        <section className="panel article-panel" style={{ marginBottom: 18 }}>
          <div
            className="article-prose"
            dangerouslySetInnerHTML={{ __html: cmsPageHtml }}
          />
          {cmsPage.allowComments === 'allow' ? (
            <PostCommentsSection
              post={{ id: `page_${cmsPage.id}`, title: cmsPage.title, slug: cmsPage.slug }}
            />
          ) : null}
        </section>
      ) : null}

      {view === 'ncert' ? (
        <NcertExplorer
          onOpenFile={onOpenFile}
          onTrackDownload={onTrackDownload}
          onHome={onHome}
        />
      ) : null}
      {view === 'pyq' && publishedPyq.length > 0 ? (
        <section className="panel">
          <h2>Previous Year Question Papers</h2>
          <div className="list">
            {publishedPyq.map((item) => {
              const href = item.questionPaperUrl || item.solutionUrl || item.answerKeyUrl || ''
              return (
                <a
                  key={item.id}
                  href={href || '#'}
                  target={href ? '_blank' : undefined}
                  rel={href ? 'noopener noreferrer' : undefined}
                  className="row"
                  style={{ textDecoration: 'none' }}
                  onClick={(e) => {
                    if (onOpenFile) {
                      onOpenFile(e, {
                        href,
                        id: item.id,
                        type: 'pyq',
                        title: item.title,
                        category: 'pyq',
                      })
                    } else if (href) {
                      onTrackDownload?.({
                        id: item.id,
                        type: 'pyq',
                        title: item.title,
                        category: 'pyq',
                        url: href,
                      })
                    }
                  }}
                >
                  <span className="tone tone-navy">
                    <Icon name="file" size={18} />
                  </span>
                  <span className="row-copy">
                    <span className="row-title">{item.title}</span>
                    <span className="row-meta">
                      {item.examName} ({item.year || '—'}) · {item.subject || 'General'}
                      {item.classOrPost ? ` · ${item.classOrPost}` : ''}
                    </span>
                  </span>
                </a>
              )
            })}
          </div>
        </section>
      ) : null}
      {view === 'quiz' ? (
        matchingQuizzes.length > 0 ? (
          <div style={{ marginBottom: 28 }}>
            <QuizCardsGrid quizzes={matchingQuizzes} onStartQuiz={onStartQuiz} />
          </div>
        ) : (
          <div
            style={{
              textAlign: 'center',
              padding: '60px 20px',
              background: 'var(--card-bg, #ffffff)',
              borderRadius: 16,
              border: '1px solid var(--border, #e2e8f0)',
              color: 'var(--text-muted, #64748b)',
            }}
          >
            <p style={{ margin: 0, fontSize: '1rem', fontWeight: 500 }}>
              इस श्रेणी में अभी कोई क्विज़ उपलब्ध नहीं है।
            </p>
          </div>
        )
      ) : matchingQuizzes.length > 0 ? (
        <section className="panel">
          <h2>Practice Quizzes ({matchingQuizzes.length})</h2>
          <QuizCardsGrid quizzes={matchingQuizzes} onStartQuiz={onStartQuiz} />
        </section>
      ) : null}
      {matchingNotes.length > 0 ? (
        <section className="panel">
          <h2>Study Notes</h2>
          <NotesCardsList
            notes={matchingNotes}
            onTrackDownload={onTrackDownload}
            onOpenFile={onOpenFile}
          />
        </section>
      ) : null}
      {matchingPosts.length > 0 ? (
        <section className="panel">
          <h2>{t.latestArticlesTitle}</h2>
          <PostCardsGrid posts={matchingPosts} onOpenPath={onOpenPath} />
        </section>
      ) : null}
      {!hasContent ? (
        <section className="panel">
          <p className="empty">इस सेक्शन में अभी कोई सामग्री प्रकाशित नहीं है।</p>
        </section>
      ) : null}
    </>
  )
}

function CategoryPage({
  t,
  slug,
  dynamicCategories = [],
  publishedPosts,
  onOpenPath,
  onHome,
}) {
  const cat = dynamicCategories.find((c) => c.slug === slug)
  const categoryTitle = cat?.name || slug
  const matchingPosts = publishedPosts.filter((post) => postMatchesCategory(post, slug))

  return (
    <section className="panel">
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
          marginBottom: 16,
          paddingBottom: 12,
          borderBottom: '1px solid var(--border)',
        }}
      >
        <h1
          style={{
            margin: 0,
            fontSize: 'clamp(1.25rem, 2.5vw, 1.75rem)',
            fontWeight: 800,
            color: 'var(--text-primary)',
          }}
        >
          {categoryTitle}
        </h1>
        {onHome ? (
          <button
            type="button"
            className="text-button"
            onClick={onHome}
            style={{
              padding: '6px 14px',
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'var(--card-bg, #ffffff)',
              color: 'var(--text-primary)',
              fontSize: '0.88rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              flexShrink: 0,
            }}
          >
            ← {t.backToHome || 'वापस जाएं'}
          </button>
        ) : null}
      </div>
      {matchingPosts.length === 0 ? (
        <p className="empty">{t.noCategoryPosts}</p>
      ) : (
        <PostCardsGrid posts={matchingPosts} onOpenPath={onOpenPath} />
      )}
    </section>
  )
}

function PostDetailView({
  t,
  slug,
  publishedPosts,
  publishedPages = [],
  onHome,
  isBookmarked,
  onToggleBookmark,
  onOpenFile,
}) {
  const post = publishedPosts.find((p) => p.slug === slug || p.id === slug)
  const fallbackPage = !post && publishedPages ? publishedPages.find((p) => p.slug === slug || p.id === slug) : null

  useEffect(() => {
    if (!post?.id) return
    trackAnalyticsEvent({
      eventType: 'content_view',
      targetId: post.id,
      targetTitle: post.title || post.slug || '',
      category: post.category || (Array.isArray(post.categories) ? post.categories[0] : '') || '',
    })
  }, [post?.id, post?.title, post?.slug, post?.category, post?.categories])

  if (!post && fallbackPage) {
    return (
      <PageDetailView
        t={t}
        slug={slug}
        publishedPages={publishedPages}
        onHome={onHome}
      />
    )
  }

  if (!post) {
    return (
      <header className="page-head">
        <h1>{t.notFoundTitle}</h1>
        <p className="lede">{t.notFoundText}</p>
        <button type="button" className="text-button" onClick={onHome}>
          {t.notFoundAction}
        </button>
      </header>
    )
  }

  const cats = Array.isArray(post.categories) ? post.categories : []
  const tags = Array.isArray(post.tags) ? post.tags : []
  const saved = isBookmarked(post.id, 'post')

  return (
    <article className="panel article-panel">
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
          marginBottom: 16,
          paddingBottom: 12,
          borderBottom: '1px solid var(--border)',
        }}
      >
        <h1
          style={{
            margin: 0,
            fontSize: 'clamp(1.25rem, 2.5vw, 1.75rem)',
            fontWeight: 800,
            color: 'var(--text-primary)',
          }}
        >
          {post.title}
        </h1>
        <button
          type="button"
          className="text-button"
          onClick={onHome}
          style={{
            padding: '6px 14px',
            borderRadius: 8,
            border: '1px solid var(--border)',
            background: 'var(--card-bg, #ffffff)',
            color: 'var(--text-primary)',
            fontSize: '0.88rem',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            flexShrink: 0,
          }}
        >
          ← {t.backToHome || 'वापस जाएं'}
        </button>
      </div>
      <header className="article-head" style={{ marginTop: 0 }}>
        {(post.showAuthor && post.author) || post.showDate !== false ? (
          <p className="article-meta">
            {post.showAuthor && post.author ? <span>{post.author}</span> : null}
            {post.showDate !== false ? (
              <span>{formatDate(post.publishedAt || post.updatedAt)}</span>
            ) : null}
          </p>
        ) : null}
        {cats.length > 0 || tags.length > 0 ? (
          <div className="article-tags">
            {cats.map((c) => (
              <span key={c} className="index-pill">
                {c}
              </span>
            ))}
            {tags.map((tag) => (
              <span key={tag} className="article-tag-chip">
                #{tag}
              </span>
            ))}
          </div>
        ) : null}
      </header>
      {post.featuredImage ? (
        <img src={post.featuredImage} alt="" className="article-cover" />
      ) : null}
      <div
        onClick={(e) => {
          const link = e.target.closest('a')
          if (!link) return
          const href = link.getAttribute('href') || ''
          const isPdfOrDownload = /\.pdf($|\?)/i.test(href) || link.hasAttribute('download')
          if (isPdfOrDownload && onOpenFile) {
            onOpenFile(e, {
              href,
              id: `post_link_${post.id}`,
              type: 'pdf',
              title: link.textContent?.trim() || post.title || 'PDF Document',
              category: cats[0] || post.category || 'general',
            })
          }
        }}
      >
        <UniversalPostRenderer
          html={post.content || ''}
          customCss={post.customCss || ''}
          interactiveTool={Boolean(post.interactiveTool)}
          title={post.title || 'Post content'}
        />
      </div>
      <PostCommentsSection post={post} />
    </article>
  )
}

function PageDetailView({ t, slug, publishedPages, onHome }) {
  const page = publishedPages.find((p) => p.slug === slug || p.id === slug)
  const renderedHtml = useMemo(
    () => (page ? renderMathInHtml(page.content || '') : ''),
    [page],
  )

  if (!page) {
    return (
      <header className="page-head">
        <h1>{t.notFoundTitle}</h1>
        <p className="lede">{t.notFoundText}</p>
        <button type="button" className="text-button" onClick={onHome}>
          {t.notFoundAction}
        </button>
      </header>
    )
  }

  return (
    <article className="panel article-panel">
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
          marginBottom: 16,
          paddingBottom: 12,
          borderBottom: '1px solid var(--border)',
        }}
      >
        <h1
          style={{
            margin: 0,
            fontSize: 'clamp(1.25rem, 2.5vw, 1.75rem)',
            fontWeight: 800,
            color: 'var(--text-primary)',
          }}
        >
          {page.title}
        </h1>
        {onHome ? (
          <button
            type="button"
            className="text-button"
            onClick={onHome}
            style={{
              padding: '6px 14px',
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'var(--card-bg, #ffffff)',
              color: 'var(--text-primary)',
              fontSize: '0.88rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              flexShrink: 0,
            }}
          >
            ← {t.backToHome || 'वापस जाएं'}
          </button>
        ) : null}
      </div>
      <div
        className="article-prose"
        dangerouslySetInnerHTML={{ __html: renderedHtml }}
      />
      {page.allowComments === 'allow' ? (
        <PostCommentsSection
          post={{ id: `page_${page.id}`, title: page.title, slug: page.slug }}
        />
      ) : null}
    </article>
  )
}

function SignInRequiredPanel({ message, onSignIn, title = 'लॉगिन आवश्यक है' }) {
  return (
    <section className="panel" style={{ textAlign: 'center', padding: '36px 20px' }}>
      <div style={{ marginBottom: 14 }}>
        <span
          className="tone tone-amber"
          style={{
            width: 48,
            height: 48,
            borderRadius: '50%',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto',
          }}
        >
          <Icon name="lock" size={24} />
        </span>
      </div>
      <h2 style={{ fontSize: '1.25rem', margin: '0 0 8px' }}>{title}</h2>
      <p className="lede" style={{ marginBottom: 18, maxWidth: 460, marginInline: 'auto' }}>
        {message}
      </p>
      <button
        type="button"
        className="auth-btn"
        style={{ height: 42, padding: '0 20px', fontSize: '0.94rem' }}
        onClick={onSignIn}
      >
        <Icon name="login" size={17} />
        <span>Google से लॉगिन करें</span>
      </button>
    </section>
  )
}

function Profile({ t, user, profile, quizResults = [], onSignIn }) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')
  const [form, setForm] = useState(() => ({
    displayName: profile?.displayName || user?.displayName || '',
    studyClass: profile?.studyClass || '',
    targetExam: profile?.targetExam || '',
    phone: profile?.phone || '',
    bio: profile?.bio || '',
  }))

  if (!user) {
    return (
      <SignInRequiredPanel
        message="अपनी प्रोफ़ाइल देखने और अपडेट करने के लिए लॉगिन करें।"
        onSignIn={onSignIn}
      />
    )
  }

  const displayName = profile?.displayName || user.displayName || user.email || 'Student'
  const initials = displayName
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  const totalPoints = Math.round(
    quizResults.reduce((sum, r) => sum + Number(r.score ?? r.marksObtained ?? 0), 0),
  )

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    setSaveMsg('')
    try {
      await updateStudentProfile(user.uid, form)
      setSaveMsg('प्रोफ़ाइल सफलतापूर्वक अपडेट हो गई!')
      setEditing(false)
    } catch (err) {
      setSaveMsg(err?.message || 'प्रोफ़ाइल सेव करने में त्रुटि।')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <article className="profile-card">
        {user.photoURL ? (
          <img
            src={user.photoURL}
            alt=""
            className="avatar"
            style={{ objectFit: 'cover' }}
            referrerPolicy="no-referrer"
          />
        ) : (
          <span className="avatar" aria-hidden="true">
            {initials || 'U'}
          </span>
        )}
        <div style={{ flex: 1 }}>
          <h2 className="profile-name">{displayName}</h2>
          <p className="lede">
            {user.email}
            {profile?.role ? ` · ${profile.role}` : ''}
          </p>
        </div>
        <button
          type="button"
          className="text-button"
          onClick={() => {
            if (!editing) {
              setForm({
                displayName: profile?.displayName || user?.displayName || '',
                studyClass: profile?.studyClass || '',
                targetExam: profile?.targetExam || '',
                phone: profile?.phone || '',
                bio: profile?.bio || '',
              })
            }
            setEditing((v) => !v)
          }}
        >
          {editing ? 'रद्द करें' : 'प्रोफ़ाइल संपादित करें'}
        </button>
      </article>

      {saveMsg ? <p className="focus-banner">{saveMsg}</p> : null}

      {editing ? (
        <form className="panel" onSubmit={handleSave} style={{ display: 'grid', gap: 12 }}>
          <label style={{ display: 'grid', gap: 4 }}>
            <span>पूरा नाम</span>
            <input
              type="text"
              value={form.displayName}
              onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
              required
              style={{ padding: 10, borderRadius: 8, border: '1px solid var(--border)' }}
            />
          </label>
          <label style={{ display: 'grid', gap: 4 }}>
            <span>{t.fieldClass}</span>
            <input
              type="text"
              placeholder="उदा. Class 12 / B.A. / PGT"
              value={form.studyClass}
              onChange={(e) => setForm((f) => ({ ...f, studyClass: e.target.value }))}
              style={{ padding: 10, borderRadius: 8, border: '1px solid var(--border)' }}
            />
          </label>
          <label style={{ display: 'grid', gap: 4 }}>
            <span>{t.fieldTarget}</span>
            <input
              type="text"
              placeholder="उदा. KVS / EMRS / UPESSC / UPSC"
              value={form.targetExam}
              onChange={(e) => setForm((f) => ({ ...f, targetExam: e.target.value }))}
              style={{ padding: 10, borderRadius: 8, border: '1px solid var(--border)' }}
            />
          </label>
          <label style={{ display: 'grid', gap: 4 }}>
            <span>फ़ोन नंबर (वैकल्पिक)</span>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              style={{ padding: 10, borderRadius: 8, border: '1px solid var(--border)' }}
            />
          </label>
          <label style={{ display: 'grid', gap: 4 }}>
            <span>परिचय (Bio)</span>
            <textarea
              rows={2}
              value={form.bio}
              onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
              style={{ padding: 10, borderRadius: 8, border: '1px solid var(--border)' }}
            />
          </label>
          <div>
            <button type="submit" className="auth-btn" disabled={saving}>
              {saving ? 'सेव हो रहा है…' : 'प्रोफ़ाइल सेव करें'}
            </button>
          </div>
        </form>
      ) : (
        <div className="meta-grid">
          <article className="meta-item">
            <span>{t.fieldClass}</span>
            <strong>{profile?.studyClass || 'सेट नहीं है'}</strong>
          </article>
          <article className="meta-item">
            <span>{t.fieldTarget}</span>
            <strong>{profile?.targetExam || 'सेट नहीं है'}</strong>
          </article>
          <article className="meta-item">
            <span>Quiz Attempts</span>
            <strong>{quizResults.length}</strong>
          </article>
          <article className="meta-item">
            <span>{t.fieldPoints}</span>
            <strong>
              {totalPoints} {t.pointsSuffix}
            </strong>
          </article>
        </div>
      )}
    </>
  )
}

function Leaderboard({ t, user, isAdmin, onSignIn }) {
  const [entries, setEntries] = useState([])
  const [loadedUid, setLoadedUid] = useState('')

  useEffect(() => {
    if (!user) return undefined
    let active = true
    listLeaderboardEntries(user, isAdmin)
      .then((list) => {
        if (active) setEntries(list)
      })
      .finally(() => {
        if (active) setLoadedUid(user.uid)
      })
    return () => {
      active = false
    }
  }, [user, isAdmin])

  const loading = Boolean(user) && loadedUid !== user.uid

  if (!user) {
    return (
      <SignInRequiredPanel
        message="लीडरबोर्ड और अपना स्कोर देखने के लिए लॉगिन करें।"
        onSignIn={onSignIn}
      />
    )
  }

  if (loading) return <p className="empty">डेटा लोड हो रहा है…</p>
  if (entries.length === 0) {
    return (
      <p className="empty">
        अभी तक कोई क्विज़ स्कोर दर्ज नहीं हुआ है। लीडरबोर्ड में आने के लिए क्विज़ हल करें!
      </p>
    )
  }

  return (
    <ol className="board">
      {entries.map((entry, index) => (
        <li
          key={entry.uid}
          className={entry.isCurrentUser ? 'board-row is-you' : 'board-row'}
        >
          <span className={`rank rank-${index + 1}`}>{index + 1}</span>
          <span className="board-name">
            {entry.name}
            {entry.isCurrentUser ? <span className="you-badge">{t.you}</span> : null}
          </span>
          <span className="board-points">
            {entry.points} {t.pointsSuffix} ({entry.attempts} quiz)
          </span>
        </li>
      ))}
    </ol>
  )
}

function Progress({ t, user, quizResults = [], onSignIn }) {
  if (!user) {
    return (
      <SignInRequiredPanel
        message="अपनी क्विज़ प्रगति और प्रदर्शन देखने के लिए लॉगिन करें।"
        onSignIn={onSignIn}
      />
    )
  }

  if (quizResults.length === 0) {
    return (
      <p className="empty">
        आपने अभी तक कोई क्विज़ नहीं दिया है। प्रगति ट्रैक करने के लिए कोई क्विज़ शुरू करें!
      </p>
    )
  }

  const byCategory = new Map()
  quizResults.forEach((r) => {
    const key = String(r.category || r.subject || 'general').toLowerCase()
    const prev = byCategory.get(key) || { sumPct: 0, count: 0 }
    const totalMarks = Number(r.totalMarks || r.totalQuestions || 0)
    const score = Number(r.score ?? r.marksObtained ?? 0)
    const pct =
      Number.isFinite(Number(r.percentage))
        ? Number(r.percentage)
        : totalMarks > 0
          ? Math.max(0, Math.min(100, Math.round((score / totalMarks) * 100)))
          : 0
    byCategory.set(key, { sumPct: prev.sumPct + pct, count: prev.count + 1 })
  })

  const categories = Array.from(byCategory.entries()).map(([id, data]) => ({
    id,
    label: t.category[id] || id,
    value: Math.round(data.sumPct / data.count),
    attempts: data.count,
  }))

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <div className="progress-list">
        {categories.map((item) => (
          <div key={item.id} className="progress-item">
            <div className="progress-label">
              <span>
                {item.label} ({item.attempts} attempts)
              </span>
              <span>{item.value}%</span>
            </div>
            <div
              className="meter"
              role="progressbar"
              aria-valuenow={item.value}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={item.label}
            >
              <div className="meter-fill" style={{ width: `${item.value}%` }} />
            </div>
          </div>
        ))}
      </div>

      <section className="panel">
        <h2>हाल के क्विज़ प्रयास</h2>
        <div className="list">
          {quizResults.slice(0, 10).map((r) => (
            <div key={r.id} className="row static-row">
              <span className="tone tone-amber">
                <Icon name="trophy" size={18} />
              </span>
              <span className="row-copy">
                <span className="row-title">{r.quizTitle || r.quizId || 'Quiz Attempt'}</span>
                <span className="row-meta">
                  Score: {r.score ?? r.marksObtained ?? 0}
                  {r.totalMarks ? ` / ${r.totalMarks}` : ''} ·{' '}
                  {formatDate(r.submittedAt || r.createdAt)}
                </span>
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

function Bookmarks({ user, profile, onOpenPath, onToggleBookmark, onSignIn }) {
  if (!user) {
    return (
      <SignInRequiredPanel
        message="अपने सहेजे गए बुकमार्क देखने के लिए लॉगिन करें।"
        onSignIn={onSignIn}
      />
    )
  }

  const saved = Array.isArray(profile?.bookmarks) ? profile.bookmarks : []
  if (saved.length === 0) {
    return (
      <p className="empty">
        अभी कोई बुकमार्क सहेजा नहीं गया है। किसी भी पोस्ट को खोलकर &ldquo;Save Bookmark&rdquo; पर क्लिक करें।
      </p>
    )
  }

  return (
    <div className="list">
      {saved.map((item) => (
        <div key={`${item.type}-${item.id}`} className="row" style={{ justifyContent: 'space-between' }}>
          <button
            type="button"
            className="text-button"
            style={{ flex: 1, textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10 }}
            onClick={() => {
              if (item.path) onOpenPath(item.path)
            }}
          >
            <span className={`tone tone-${categoryTone[item.category] || 'navy'}`}>
              <Icon name="bookmark" size={18} />
            </span>
            <span className="row-copy">
              <span className="row-title">{item.title}</span>
              <span className="row-meta">
                {item.category || 'Post'} · {formatDate(item.savedAt)}
              </span>
            </span>
          </button>
          <button
            type="button"
            className="text-button"
            aria-label="Remove bookmark"
            onClick={() => onToggleBookmark(item)}
          >
            <Icon name="x" size={16} />
          </button>
        </div>
      ))}
    </div>
  )
}

function Downloads({ user, profile, onSignIn }) {
  if (!user) {
    return (
      <SignInRequiredPanel
        message="अपने डाउनलोड किए गए नोट्स और PDFs देखने के लिए लॉगिन करें।"
        onSignIn={onSignIn}
      />
    )
  }

  const list = Array.isArray(profile?.downloads) ? profile.downloads : []
  if (list.length === 0) {
    return (
      <p className="empty">
        अभी तक कोई PDF या नोट्स डाउनलोड नहीं किए गए हैं। जब आप नोट्स, NCERT या PYQ खोलेंगे तो वे यहाँ दिखाई देंगे।
      </p>
    )
  }

  return (
    <ul className="list static-list">
      {list.map((item) => (
        <li key={`${item.type}-${item.id}`} className="row static-row">
          <a
            href={item.url || '#'}
            target={item.url ? '_blank' : undefined}
            rel={item.url ? 'noopener noreferrer' : undefined}
            style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none', color: 'inherit', width: '100%' }}
          >
            <span className={`tone tone-${categoryTone[item.category] || 'teal'}`}>
              <Icon name="download" size={18} />
            </span>
            <span className="row-copy">
              <span className="row-title">{item.title}</span>
              <span className="row-meta">
                {item.type?.toUpperCase() || 'PDF'} · {formatDate(item.downloadedAt)}
              </span>
            </span>
          </a>
        </li>
      ))}
    </ul>
  )
}

function Help({ t }) {
  return (
    <div className="faq">
      {helpItems.map((item) => (
        <article key={item.id}>
          <h2>{t[item.q]}</h2>
          <p>{t[item.a]}</p>
        </article>
      ))}
    </div>
  )
}

function StudentView({
  t,
  view,
  user,
  profile,
  isAdmin,
  quizResults,
  onOpenPath,
  onToggleBookmark,
  onSignIn,
  onOpenFile,
}) {
  return (
    <>
      {view === 'profile' ? (
        <Profile
          t={t}
          user={user}
          profile={profile}
          quizResults={quizResults}
          onSignIn={onSignIn}
        />
      ) : null}
      {view === 'leaderboard' ? (
        <Leaderboard t={t} user={user} isAdmin={isAdmin} onSignIn={onSignIn} />
      ) : null}
      {view === 'progress' ? (
        <Progress t={t} user={user} quizResults={quizResults} onSignIn={onSignIn} />
      ) : null}
      {view === 'bookmarks' ? (
        <Bookmarks
          user={user}
          profile={profile}
          onOpenPath={onOpenPath}
          onToggleBookmark={onToggleBookmark}
          onSignIn={onSignIn}
        />
      ) : null}
      {view === 'downloads' ? (
        <Downloads user={user} profile={profile} onSignIn={onSignIn} onOpenFile={onOpenFile} />
      ) : null}
      {view === 'help' ? <Help t={t} /> : null}
    </>
  )
}

function renderBody({
  t,
  view,
  routeSlug,
  category,
  dynamicCategories,
  publishedPosts,
  publishedPages,
  publishedNcert,
  publishedPyq,
  publishedNotes,
  publishedQuizzes,
  query,
  user,
  profile,
  isAdmin,
  quizResults,
  isBookmarked,
  onToggleBookmark,
  onTrackDownload,
  onOpenFile,
  onSignIn,
  onOpenPath,
  onHome,
  onStartQuiz,
}) {
  if (query.trim().length > 0) {
    return (
      <SearchResults
        t={t}
        query={query}
        publishedPosts={publishedPosts}
        publishedPages={publishedPages}
        publishedQuizzes={publishedQuizzes}
        publishedNotes={publishedNotes}
        publishedNcert={publishedNcert}
        publishedPyq={publishedPyq}
        onOpenPath={onOpenPath}
        onStartQuiz={onStartQuiz}
        onTrackDownload={onTrackDownload}
        onOpenFile={onOpenFile}
      />
    )
  }
  if (view === 'post') {
    return (
      <PostDetailView
        t={t}
        slug={routeSlug}
        publishedPosts={publishedPosts}
        publishedPages={publishedPages}
        onHome={onHome}
        isBookmarked={isBookmarked}
        onToggleBookmark={onToggleBookmark}
        onOpenFile={onOpenFile}
      />
    )
  }
  if (view === 'page') {
    return (
      <PageDetailView
        t={t}
        slug={routeSlug}
        publishedPages={publishedPages}
        onHome={onHome}
      />
    )
  }
  if (view === 'category') {
    return (
      <CategoryPage
        t={t}
        slug={routeSlug}
        dynamicCategories={dynamicCategories}
        publishedPosts={publishedPosts}
        onOpenPath={onOpenPath}
        onHome={onHome}
      />
    )
  }
  if (view === 'notfound') {
    const rawSlug = (window.location.hash || '')
      .replace(/^#\/?/, '')
      .split('?')[0]
      .replace(/\/+$/, '')
    const fallbackPage = rawSlug
      ? publishedPages.find(
          (p) => String(p.slug || '').toLowerCase() === rawSlug.toLowerCase(),
        )
      : null
    if (fallbackPage) {
      return (
        <PageDetailView
          t={t}
          slug={fallbackPage.slug}
          publishedPages={publishedPages}
          onHome={onHome}
        />
      )
    }
    return (
      <header className="page-head">
        <h1>{t.notFoundTitle}</h1>
        <p className="lede">{t.notFoundText}</p>
        <button type="button" className="text-button" onClick={onHome}>
          {t.notFoundAction}
        </button>
      </header>
    )
  }
  if (isStudentView(view)) {
    return (
      <StudentView
        t={t}
        view={view}
        user={user}
        profile={profile}
        isAdmin={isAdmin}
        quizResults={quizResults}
        onOpenPath={onOpenPath}
        onToggleBookmark={onToggleBookmark}
        onSignIn={onSignIn}
        onOpenFile={onOpenFile}
      />
    )
  }
  if (view === 'home') {
    return (
      <Home
        t={t}
        category={category}
        publishedPosts={publishedPosts}
        publishedNotes={publishedNotes}
        publishedQuizzes={publishedQuizzes}
        profile={profile}
        quizResults={quizResults}
        onOpenPath={onOpenPath}
        onStartQuiz={onStartQuiz}
        onTrackDownload={onTrackDownload}
        onOpenFile={onOpenFile}
      />
    )
  }
  return (
    <SectionPage
      t={t}
      view={view}
      publishedPages={publishedPages}
      publishedPosts={publishedPosts}
      publishedNcert={publishedNcert}
      publishedPyq={publishedPyq}
      publishedNotes={publishedNotes}
      publishedQuizzes={publishedQuizzes}
      onOpenPath={onOpenPath}
      onStartQuiz={onStartQuiz}
      onTrackDownload={onTrackDownload}
      onOpenFile={onOpenFile}
      onHome={onHome}
    />
  )
}

export default function MainContent(props) {
  const { user, profile, isAdmin, signInWithGoogle, requireAuth } = useAuth()
  const [activeQuiz, setActiveQuiz] = useState(null)
  const [quizResults, setQuizResults] = useState([])

  const refreshQuizResults = useCallback(async () => {
    if (!user?.uid) return
    const list = await listUserQuizResults(user.uid).catch(() => [])
    setQuizResults(list)
  }, [user])

  useEffect(() => {
    if (!user?.uid) return undefined
    let active = true
    listUserQuizResults(user.uid)
      .then((list) => {
        if (active) setQuizResults(list)
      })
      .catch(() => {
        if (active) setQuizResults([])
      })
    return () => {
      active = false
    }
  }, [user])

  const visibleQuizResults = user?.uid ? quizResults : []

  const isBookmarked = useCallback(
    (id, type = 'post') => {
      const list = Array.isArray(profile?.bookmarks) ? profile.bookmarks : []
      return list.some((b) => b.id === id && b.type === type)
    },
    [profile],
  )

  const handleToggleBookmark = useCallback(
    async (item) => {
      if (!user?.uid) {
        requireAuth(() => toggleUserBookmark(user?.uid, profile?.bookmarks || [], item), {
          type: 'bookmark',
          itemName: item.title,
        })
        return
      }
      await toggleUserBookmark(user.uid, profile?.bookmarks || [], item)
    },
    [user, profile, requireAuth],
  )

  const handleTrackDownload = useCallback(
    (item) => {
      trackAnalyticsEvent({
        eventType: 'pdf_download',
        targetId: item.id,
        targetTitle: item.title,
        category: item.category,
        uid: user?.uid || '',
      })
      if (user?.uid) {
        recordUserDownload(user.uid, profile?.downloads || [], item)
      }
    },
    [user, profile],
  )

  const handleStartQuiz = useCallback(
    (quiz) => {
      if (!quiz) return
      if (!user) {
        requireAuth(() => setActiveQuiz(quiz), {
          type: 'quiz',
          itemType: 'quiz',
          itemName: quiz.title,
        })
        return
      }
      setActiveQuiz(quiz)
    },
    [user, requireAuth],
  )

  const handleOpenFile = useCallback(
    (e, item) => {
      if (!item?.href) return
      if (!user) {
        if (e && typeof e.preventDefault === 'function') {
          e.preventDefault()
        }
        requireAuth(
          () => {
            window.open(item.href, '_blank', 'noopener,noreferrer')
            handleTrackDownload(item)
          },
          {
            type: 'file',
            itemType: item.type || 'file',
            itemName: item.title,
          },
        )
        return
      }
      handleTrackDownload(item)
    },
    [user, requireAuth, handleTrackDownload],
  )

  const handlePromptSignIn = useCallback(() => {
    requireAuth(null, {
      isWelcome: false,
    })
  }, [requireAuth])

  return (
    <main className="main" id="content">
      {renderBody({
        ...props,
        user,
        profile,
        isAdmin,
        quizResults: visibleQuizResults,
        isBookmarked,
        onToggleBookmark: handleToggleBookmark,
        onTrackDownload: handleTrackDownload,
        onOpenFile: handleOpenFile,
        onSignIn: handlePromptSignIn,
        onStartQuiz: handleStartQuiz,
      })}
      {activeQuiz ? (
        <QuizRunnerModal
          quiz={activeQuiz}
          siteTheme={props.theme}
          siteLang={props.lang}
          onThemeChange={props.onTheme}
          onLangChange={props.onLang}
          onClose={() => setActiveQuiz(null)}
          onAttemptSaved={() => {
            refreshQuizResults()
          }}
        />
      ) : null}
    </main>
  )
}
