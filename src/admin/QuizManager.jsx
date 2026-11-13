import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardPaste,
  Edit3,
  GripVertical,
  HelpCircle,
  ListChecks,
  Play,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  X,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import QuizRunnerModal from '../components/QuizRunnerModal.jsx'
import { listCategories } from '../services/cmsService.js'
import {
  computeQuizAnalytics,
  deleteQuiz,
  listQuizAttempts,
  listQuizQuestions,
  listQuizzes,
  saveQuiz,
  subscribeQuizzes,
  updateQuizzesOrder,
} from '../services/eduService.js'
import { parseBulkQuestionsText } from '../utils/bulkQuizParser.js'
import { formatDateTime, slugify } from '../utils/slugify.js'

const QUIZ_FILTER_CHIPS = [
  { id: 'all', labelHi: 'सभी', labelEn: 'All', tone: 'all' },
  { id: 'history', labelHi: 'इतिहास', labelEn: 'History', tone: 'amber' },
  { id: 'geography', labelHi: 'भूगोल', labelEn: 'Geography', tone: 'teal' },
  { id: 'gk', labelHi: 'सामान्य ज्ञान', labelEn: 'GK', tone: 'violet' },
  { id: 'affairs', labelHi: 'समसामयिकी', labelEn: 'Current Affairs', tone: 'blue' },
]

function matchesQuizCategory(quiz, filterId) {
  if (!filterId || filterId === 'all') return true
  const target = String(filterId).toLowerCase().trim()
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

function buildEmptyQuizForm(defaultCategory = '') {
  return {
    title: '',
    collectionId: '',
    description: '',
    durationMinutes: 15,
    marksPerQuestion: 1,
    totalMarks: 0,
    category: defaultCategory,
    active: true,
  }
}

export default function QuizManager() {
  const { user } = useAuth()
  const [quizzes, setQuizzes] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Screen 1: Quiz Details
  const [editingQuizId, setEditingQuizId] = useState(null)
  const [quizForm, setQuizForm] = useState(() => buildEmptyQuizForm(''))
  const [totalMarksManual, setTotalMarksManual] = useState(false)

  // Screen 2: Questions - Bulk Paste
  const [bulkText, setBulkText] = useState('')
  const [tempQuestionsList, setTempQuestionsList] = useState([])
  const [parseStatusMsg, setParseStatusMsg] = useState('')
  const [editingIndex, setEditingIndex] = useState(null)
  const [editDraft, setEditDraft] = useState(null)

  // Single status message (Success OR Failed, never both)
  const [saveFeedback, setSaveFeedback] = useState(null) // { type: 'success' | 'error', text: string }

  // Quiz List / Preview / Analytics
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('all')
  const [runnerQuiz, setRunnerQuiz] = useState(null)
  const [analyticsQuiz, setAnalyticsQuiz] = useState(null)
  const [attempts, setAttempts] = useState([])
  const [analyticsQuestions, setAnalyticsQuestions] = useState([])
  const [loadingAnalytics, setLoadingAnalytics] = useState(false)

  const reloadAll = useCallback(async () => {
    setLoading(true)
    try {
      const [quizList, catList] = await Promise.all([
        listQuizzes(),
        listCategories().catch(() => []),
      ])
      setQuizzes(quizList)
      setCategories(catList)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let active = true
    Promise.all([listQuizzes(), listCategories().catch(() => [])])
      .then(([quizList, catList]) => {
        if (!active) return
        setQuizzes(quizList)
        setCategories(catList)
        if (catList.length > 0) {
          setQuizForm((prev) =>
            prev.category ? prev : { ...prev, category: catList[0].name || catList[0].slug || '' },
          )
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    return subscribeQuizzes((quizList) => {
      setQuizzes(quizList)
    })
  }, [])

  const quizFilterCounts = useMemo(() => {
    const counts = {}
    QUIZ_FILTER_CHIPS.forEach((chip) => {
      counts[chip.id] = quizzes.filter((q) => matchesQuizCategory(q, chip.id)).length
    })
    return counts
  }, [quizzes])

  const filteredQuizzes = useMemo(() => {
    return quizzes.filter((q) => matchesQuizCategory(q, selectedCategoryFilter))
  }, [quizzes, selectedCategoryFilter])

  // Drag and drop reordering state
  const [draggedIndex, setDraggedIndex] = useState(null)
  const [dragOverIndex, setDragOverIndex] = useState(null)
  const [orderSaving, setOrderSaving] = useState(false)
  const [orderFeedback, setOrderFeedback] = useState('')

  const moveQuiz = useCallback(
    async (fromIndex, toIndex) => {
      if (
        fromIndex === toIndex ||
        fromIndex < 0 ||
        toIndex < 0 ||
        toIndex >= filteredQuizzes.length
      ) {
        return
      }

      const reorderedFiltered = [...filteredQuizzes]
      const [movedItem] = reorderedFiltered.splice(fromIndex, 1)
      reorderedFiltered.splice(toIndex, 0, movedItem)

      let updatedMasterList
      if (selectedCategoryFilter === 'all') {
        updatedMasterList = reorderedFiltered
      } else {
        const filteredIds = new Set(reorderedFiltered.map((q) => q.id))
        const others = quizzes.filter((q) => !filteredIds.has(q.id))
        updatedMasterList = [...reorderedFiltered, ...others]
      }

      // Re-index order property for every quiz
      const finalOrdered = updatedMasterList.map((q, idx) => ({
        ...q,
        order: idx,
      }))

      // Optimistic local state update
      setQuizzes(finalOrdered)
      setOrderSaving(true)
      setOrderFeedback('Saving new quiz sequence to Firestore…')

      try {
        await updateQuizzesOrder(finalOrdered)
        setOrderFeedback('✓ नया क्रम सफलतापूर्वक सेव हो गया और वेबसाइट पर लाइव हो गया!')
        setTimeout(() => setOrderFeedback(''), 4000)
      } catch (err) {
        setOrderFeedback(`Order save failed: ${err?.message || 'Error updating order'}`)
        setTimeout(() => setOrderFeedback(''), 5000)
      } finally {
        setOrderSaving(false)
      }
    },
    [filteredQuizzes, selectedCategoryFilter, quizzes],
  )

  function handleDragStart(e, index) {
    setDraggedIndex(index)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(index))
  }

  function handleDragEnter(index) {
    if (draggedIndex === null || draggedIndex === index) return
    setDragOverIndex(index)
  }

  function handleDragEnd() {
    if (draggedIndex !== null && dragOverIndex !== null && draggedIndex !== dragOverIndex) {
      moveQuiz(draggedIndex, dragOverIndex)
    }
    setDraggedIndex(null)
    setDragOverIndex(null)
  }

  // Auto-calculate Total Marks = Number of Questions x Marks Per Question unless manually edited
  const autoTotalMarks = Number(
    (tempQuestionsList.length * Math.max(0, Number(quizForm.marksPerQuestion || 0))).toFixed(2),
  )
  const displayedTotalMarks = totalMarksManual ? quizForm.totalMarks : autoTotalMarks

  function resetForm() {
    const defaultCat = categories[0]?.name || categories[0]?.slug || ''
    setEditingQuizId(null)
    setQuizForm(buildEmptyQuizForm(defaultCat))
    setTotalMarksManual(false)
    setBulkText('')
    setTempQuestionsList([])
    setParseStatusMsg('')
    setEditingIndex(null)
    setEditDraft(null)
  }

  async function handleEditExistingQuiz(quiz) {
    setSaveFeedback(null)
    setEditingQuizId(quiz.id)
    setTotalMarksManual(true)
    setQuizForm({
      title: quiz.title || '',
      collectionId: quiz.collectionId || quiz.legacyCollectionName || '',
      description: quiz.description || '',
      durationMinutes: Number(quiz.durationMinutes || 15),
      marksPerQuestion: Number(quiz.marksPerQuestion || 1),
      totalMarks: Number(quiz.totalMarks || 0),
      category: quiz.category || quiz.subject || '',
      active: quiz.active !== false && quiz.status !== 'draft',
    })
    setBulkText('')
    setParseStatusMsg('')
    setEditingIndex(null)
    setEditDraft(null)

    try {
      const existingQs = await listQuizQuestions(
        quiz.id,
        quiz.collectionId || quiz.legacyCollectionName || '',
      )
      setTempQuestionsList(
        existingQs.map((q) => {
          const opts = (Array.isArray(q.options) ? q.options : ['', '', '', '']).slice(0, 4)
          return {
            question: q.questionText || q.question || '',
            options: opts,
            correctOptionIndex: Number(q.correctOption ?? q.correctOptionIndex ?? q.correctAnswerIndex ?? 0),
            explanation: q.explanation || 'Explanation not available.',
          }
        }),
      )
    } catch {
      setTempQuestionsList([])
    }
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function updateQuestionsPreview(nextList) {
    const list = nextList ?? tempQuestionsList
    const countEl = document.getElementById('question-count')
    if (countEl) {
      countEl.textContent = String(list.length)
    }
  }

  function parseBulkQuestions() {
    setSaveFeedback(null)
    const el = document.getElementById('bulk-questions-text')
    const raw = (el ? el.value : bulkText).trim()
    if (!raw) {
      setParseStatusMsg('Please paste questions')
      return
    }

    const { added } = parseBulkQuestionsText(raw)
    const nextList = [...tempQuestionsList, ...added]
    setTempQuestionsList(nextList)
    setParseStatusMsg(`✅ ${added.length} questions added! (Total: ${nextList.length})`)
    setBulkText('')
    if (el) el.value = ''
    updateQuestionsPreview(nextList)
  }

  function handleStartEditQuestion(index) {
    const q = tempQuestionsList[index]
    setEditingIndex(index)
    setEditDraft({
      question: q.question,
      options: [...q.options],
      correctOptionIndex: q.correctOptionIndex,
      explanation: q.explanation || '',
    })
  }

  function handleSaveEditedQuestion() {
    if (editingIndex === null || !editDraft) return
    const cleanOptions = editDraft.options.map((o) => String(o || '').trim())
    const idx = Math.min(Math.max(0, Number(editDraft.correctOptionIndex || 0)), cleanOptions.length - 1)
    const updated = {
      question: String(editDraft.question || '').trim(),
      options: cleanOptions,
      correctOptionIndex: idx,
      explanation: String(editDraft.explanation || '').trim() || 'Explanation not available.',
    }
    const nextList = tempQuestionsList.map((item, i) => (i === editingIndex ? updated : item))
    setTempQuestionsList(nextList)
    setEditingIndex(null)
    setEditDraft(null)
    updateQuestionsPreview(nextList)
  }

  function handleDeleteParsedQuestion(index) {
    const nextList = tempQuestionsList.filter((_, i) => i !== index)
    setTempQuestionsList(nextList)
    if (editingIndex === index) {
      setEditingIndex(null)
      setEditDraft(null)
    }
    updateQuestionsPreview(nextList)
  }

  async function handlePublishQuiz(event) {
    event.preventDefault()
    setSaveFeedback(null)

    if (!quizForm.title.trim()) {
      setSaveFeedback({ type: 'error', text: 'Quiz Title is required.' })
      return
    }
    if (!quizForm.collectionId.trim()) {
      setSaveFeedback({ type: 'error', text: 'Collection ID is required (e.g. 10.4 or all_quiz).' })
      return
    }
    if (tempQuestionsList.length === 0) {
      setSaveFeedback({
        type: 'error',
        text: 'Add at least 1 question using "Parse & Add Questions" before publishing.',
      })
      return
    }

    setSaving(true)
    try {
      const selectedCat = quizForm.category.trim()
      await saveQuiz({
        id: editingQuizId,
        data: {
          title: quizForm.title.trim(),
          slug: slugify(quizForm.title, 'quiz'),
          collectionId: quizForm.collectionId.trim(),
          legacyCollectionName: quizForm.collectionId.trim(),
          description: quizForm.description.trim(),
          category: selectedCat,
          subject: selectedCat,
          durationMinutes: Number(quizForm.durationMinutes || 15),
          marksPerQuestion: Number(quizForm.marksPerQuestion || 1),
          totalMarks: Number(displayedTotalMarks || tempQuestionsList.length),
          active: true,
          questions: tempQuestionsList,
        },
        user,
      })
      const savedCount = tempQuestionsList.length
      const savedTitle = quizForm.title.trim()
      resetForm()
      await reloadAll()
      setSaveFeedback({
        type: 'success',
        text: `Quiz "${savedTitle}" with ${savedCount} question(s) saved & published to Firestore & App.`,
      })
    } catch (err) {
      setSaveFeedback({
        type: 'error',
        text: err?.message || 'Failed to save quiz to Firestore.',
      })
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteQuiz(quiz) {
    if (!window.confirm(`Delete quiz "${quiz.title}" permanently?`)) return
    setSaveFeedback(null)
    try {
      await deleteQuiz(quiz.id)
      if (editingQuizId === quiz.id) resetForm()
      if (analyticsQuiz?.id === quiz.id) setAnalyticsQuiz(null)
      await reloadAll()
      setSaveFeedback({ type: 'success', text: `Deleted quiz "${quiz.title}".` })
    } catch (err) {
      setSaveFeedback({ type: 'error', text: err?.message || 'Failed to delete quiz.' })
    }
  }

  async function handleOpenAnalytics(quiz) {
    setAnalyticsQuiz(quiz)
    setLoadingAnalytics(true)
    try {
      const [attList, qList] = await Promise.all([
        listQuizAttempts(quiz.id),
        listQuizQuestions(quiz.id, quiz.collectionId || quiz.legacyCollectionName || ''),
      ])
      setAttempts(attList)
      setAnalyticsQuestions(qList)
    } finally {
      setLoadingAnalytics(false)
    }
  }

  const analytics = useMemo(
    () => computeQuizAnalytics(attempts, analyticsQuestions),
    [attempts, analyticsQuestions],
  )

  return (
    <div className="qz-dark-wrap">
      <section className="admin-page-head">
        <div>
          <h1>Quiz Builder &amp; Bulk Importer</h1>
          <p>
            Configure quiz details, bulk-paste questions in 7-line format, preview, and publish to
            Firestore &amp; App.
          </p>
        </div>
        <div className="admin-quick-actions">
          <button type="button" className="admin-pill-link" onClick={reloadAll} disabled={loading}>
            <RefreshCw size={15} />
            <span>Refresh</span>
          </button>
          {editingQuizId ? (
            <button type="button" className="admin-pill-link" onClick={resetForm}>
              <Plus size={15} />
              <span>New Quiz</span>
            </button>
          ) : null}
        </div>
      </section>

      {saveFeedback ? (
        <div
          className={
            saveFeedback.type === 'error'
              ? 'qz-status-banner is-error'
              : 'qz-status-banner is-success'
          }
          role="status"
        >
          {saveFeedback.type === 'error' ? <AlertCircle size={17} /> : <CheckCircle2 size={17} />}
          <span>{saveFeedback.text}</span>
        </div>
      ) : null}

      <form onSubmit={handlePublishQuiz} className="qz-builder-stack">
        {/* SCREEN 1 - QUIZ DETAILS */}
        <section className="qz-card">
          <div className="qz-card-head">
            <div className="qz-card-title">
              <HelpCircle size={18} />
              <h2>{editingQuizId ? 'Edit Quiz Details' : '1. Quiz Details'}</h2>
            </div>
            <span className="qz-step-pill">Screen 1</span>
          </div>

          <div className="qz-form-grid">
            <div className="cms-field">
              <label htmlFor="quiz-title">Quiz Title *</label>
              <input
                id="quiz-title"
                type="text"
                required
                placeholder="e.g. Geography Special Quiz"
                value={quizForm.title}
                onChange={(e) => setQuizForm((p) => ({ ...p, title: e.target.value }))}
              />
            </div>

            <div className="cms-field">
              <label htmlFor="quiz-collection-id">Collection ID *</label>
              <input
                id="quiz-collection-id"
                type="text"
                required
                placeholder="e.g. 10.4 or all_quiz"
                value={quizForm.collectionId}
                onChange={(e) => setQuizForm((p) => ({ ...p, collectionId: e.target.value }))}
              />
            </div>

            <div className="cms-field">
              <label htmlFor="quiz-category">Category (Subject)</label>
              <select
                id="quiz-category"
                value={quizForm.category}
                onChange={(e) => setQuizForm((p) => ({ ...p, category: e.target.value }))}
              >
                <option value="">Select Category / Subject</option>
                <optgroup label="Standard Subjects (Synced with Web Chips &amp; Menu)">
                  <option value="history">इतिहास (History)</option>
                  <option value="geography">भूगोल (Geography)</option>
                  <option value="gk">सामान्य ज्ञान (GK)</option>
                  <option value="affairs">समसामयिकी (Current Affairs)</option>
                </optgroup>
                {categories.length > 0 ? (
                  <optgroup label="Other Firestore Categories">
                    {categories.map((cat) => {
                      const val = cat.name || cat.slug || cat.id
                      return (
                        <option key={cat.id} value={val}>
                          {cat.name || cat.slug}
                        </option>
                      )
                    })}
                  </optgroup>
                ) : null}
              </select>
            </div>

            <div className="cms-field">
              <label htmlFor="quiz-duration">Duration (Minutes)</label>
              <input
                id="quiz-duration"
                type="number"
                min={1}
                value={quizForm.durationMinutes}
                onChange={(e) => setQuizForm((p) => ({ ...p, durationMinutes: e.target.value }))}
              />
            </div>

            <div className="cms-field">
              <label htmlFor="quiz-marks-per-q">Marks Per Question</label>
              <input
                id="quiz-marks-per-q"
                type="number"
                min={0.25}
                step={0.25}
                value={quizForm.marksPerQuestion}
                onChange={(e) => {
                  setTotalMarksManual(false)
                  setQuizForm((p) => ({ ...p, marksPerQuestion: e.target.value }))
                }}
              />
            </div>

            <div className="cms-field">
              <div className="qz-label-row">
                <label htmlFor="quiz-total-marks">Total Marks</label>
                {totalMarksManual ? (
                  <button
                    type="button"
                    className="qz-link-btn"
                    onClick={() => setTotalMarksManual(false)}
                  >
                    Auto-calc
                  </button>
                ) : (
                  <span className="qz-muted-hint">
                    Auto ({tempQuestionsList.length} × {quizForm.marksPerQuestion || 0})
                  </span>
                )}
              </div>
              <input
                id="quiz-total-marks"
                type="number"
                min={0}
                step={0.25}
                value={displayedTotalMarks}
                onChange={(e) => {
                  setTotalMarksManual(true)
                  setQuizForm((p) => ({ ...p, totalMarks: e.target.value }))
                }}
              />
            </div>

            <div className="cms-field qz-full-span">
              <label htmlFor="quiz-description">Description &amp; Instructions</label>
              <textarea
                id="quiz-description"
                rows={3}
                placeholder="Instructions for students, syllabus coverage, marking scheme..."
                value={quizForm.description}
                onChange={(e) => setQuizForm((p) => ({ ...p, description: e.target.value }))}
              />
            </div>
          </div>
        </section>

        {/* SCREEN 2 - QUESTIONS - BULK PASTE */}
        <section className="qz-card">
          <div className="qz-card-head">
            <div className="qz-card-title">
              <ClipboardPaste size={18} />
              <h2>2. Questions — Bulk Paste</h2>
            </div>
            <span className="qz-success-counter">
              SUCCESSFULLY ADDED QUESTIONS (<span id="question-count">{tempQuestionsList.length}</span>)
            </span>
          </div>

          <div className="qz-format-guide">
            <strong>Supported Bulk Format (English &amp; Hindi):</strong>
            <span>
              Q1. / प्रश्न 1: / प्र 1: · Options: A) B) C) D) or A. B. C. D. or 1. 2. 3. 4. ·
              Answer: Correct Answer: / सही उत्तर: / सही: · Explanation: व्याख्या: / स्पष्टीकरण: / Explanation:
            </span>
          </div>

          <textarea
            id="bulk-questions-text"
            className="qz-bulk-textarea"
            rows={12}
            placeholder="Paste all your questions here..."
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
          />

          <div className="qz-bulk-actions">
            <button
              type="button"
              className="qz-btn-primary"
              onClick={parseBulkQuestions}
            >
              <ListChecks size={16} />
              <span>Parse &amp; Add Questions</span>
            </button>
            {tempQuestionsList.length > 0 ? (
              <button
                type="button"
                className="admin-pill-link"
                onClick={() => {
                  if (window.confirm('Clear all parsed questions from the preview list?')) {
                    setTempQuestionsList([])
                    setParseStatusMsg('')
                  }
                }}
              >
                <Trash2 size={14} />
                <span>Clear Parsed List</span>
              </button>
            ) : null}
            <span id="parse-status-msg" className="qz-parse-status-msg" role="status">
              {parseStatusMsg}
            </span>
          </div>

          <div id="questions-preview-list" className="qz-preview-list">
            {tempQuestionsList.length === 0 ? (
              <p className="cms-muted">No questions added yet.</p>
            ) : (
              tempQuestionsList.map((q, idx) => (
                <article key={idx} className="qz-preview-item">
                  <div className="qz-preview-head">
                    <strong>
                      Q{idx + 1}: {q.question} | Correct:{' '}
                      {q.options[q.correctOptionIndex] || '—'}
                    </strong>
                    <div className="cms-row-actions">
                      <button
                        type="button"
                        className="admin-icon-btn"
                        onClick={() => handleStartEditQuestion(idx)}
                        title="Edit question"
                      >
                        <Edit3 size={14} />
                      </button>
                      <button
                        type="button"
                        className="admin-icon-btn"
                        onClick={() => handleDeleteParsedQuestion(idx)}
                        title="Delete question"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {editingIndex === idx && editDraft ? (
                    <div className="qz-inline-edit">
                      <div className="cms-field">
                        <label>Question</label>
                        <input
                          type="text"
                          value={editDraft.question}
                          onChange={(e) =>
                            setEditDraft((d) => ({ ...d, question: e.target.value }))
                          }
                        />
                      </div>
                      <div className="qz-options-edit-grid">
                        {editDraft.options.map((opt, optIdx) => (
                          <div key={optIdx} className="cms-field">
                            <label>
                              Option {optIdx + 1}{' '}
                              <input
                                type="radio"
                                name={`edit-correct-${idx}`}
                                checked={editDraft.correctAnswerIndex === optIdx}
                                onChange={() =>
                                  setEditDraft((d) => ({ ...d, correctAnswerIndex: optIdx }))
                                }
                              />{' '}
                              Correct
                            </label>
                            <input
                              type="text"
                              value={opt}
                              onChange={(e) =>
                                setEditDraft((d) => {
                                  const next = [...d.options]
                                  next[optIdx] = e.target.value
                                  return { ...d, options: next }
                                })
                              }
                            />
                          </div>
                        ))}
                      </div>
                      <div className="cms-field">
                        <label>Explanation</label>
                        <input
                          type="text"
                          value={editDraft.explanation}
                          onChange={(e) =>
                            setEditDraft((d) => ({ ...d, explanation: e.target.value }))
                          }
                        />
                      </div>
                      <div className="admin-quick-actions">
                        <button
                          type="button"
                          className="qz-btn-primary"
                          onClick={handleSaveEditedQuestion}
                        >
                          <Save size={14} />
                          <span>Save Question</span>
                        </button>
                        <button
                          type="button"
                          className="admin-pill-link"
                          onClick={() => {
                            setEditingIndex(null)
                            setEditDraft(null)
                          }}
                        >
                          <X size={14} />
                          <span>Cancel</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="qz-preview-options">
                        {q.options.map((opt, optIdx) => {
                          const isCorrect = optIdx === q.correctOptionIndex
                          return (
                            <div
                              key={optIdx}
                              className={
                                isCorrect ? 'qz-preview-opt is-correct' : 'qz-preview-opt'
                              }
                            >
                              <span>
                                {String.fromCharCode(65 + optIdx)}. {opt}
                              </span>
                              {isCorrect ? <strong>✓ Correct</strong> : null}
                            </div>
                          )
                        })}
                      </div>
                      {q.explanation ? (
                        <p className="qz-preview-exp">
                          <strong>Explanation:</strong> {q.explanation}
                        </p>
                      ) : null}
                    </>
                  )}
                </article>
              ))
            )}
          </div>
        </section>

        <div className="qz-publish-bar">
          <button type="submit" className="qz-btn-publish" disabled={saving}>
            <Save size={16} />
            <span>{saving ? 'Saving Quiz…' : 'Save / Publish Quiz to Firestore & App'}</span>
          </button>
        </div>
      </form>

      {/* QUIZ LIST */}
      <section className="qz-card" style={{ marginTop: 18 }}>
        <div className="qz-card-head" style={{ flexWrap: 'wrap', gap: 12 }}>
          <h2>
            Published Quizzes ({filteredQuizzes.length}
            {selectedCategoryFilter !== 'all' ? ` / ${quizzes.length}` : ''})
          </h2>
        </div>

        {/* Web-style Quiz Chips Filter in Admin */}
        <div className="quiz-chips-bar" style={{ margin: '14px 0 16px' }}>
          {QUIZ_FILTER_CHIPS.map((chip) => {
            const active = selectedCategoryFilter === chip.id
            const count = quizFilterCounts[chip.id] ?? 0
            return (
              <button
                key={chip.id}
                type="button"
                className={`quiz-chip-btn quiz-chip--${chip.tone} ${active ? 'is-active' : ''}`}
                onClick={() => setSelectedCategoryFilter(chip.id)}
                aria-pressed={active}
              >
                <span>
                  {chip.labelHi} ({chip.labelEn}) {count > 0 ? `(${count})` : ''}
                </span>
              </button>
            )
          })}
        </div>

        {orderFeedback ? (
          <div
            style={{
              margin: '0 0 14px',
              padding: '8px 14px',
              borderRadius: '8px',
              background: orderSaving ? 'rgba(56, 189, 248, 0.15)' : 'rgba(34, 197, 94, 0.15)',
              color: orderSaving ? '#38bdf8' : '#4ade80',
              border: `1px solid ${orderSaving ? 'rgba(56, 189, 248, 0.3)' : 'rgba(34, 197, 94, 0.3)'}`,
              fontSize: '0.84rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            {orderSaving ? <RefreshCw size={14} className="spin" /> : <CheckCircle2 size={14} />}
            <span>{orderFeedback}</span>
          </div>
        ) : null}

        {filteredQuizzes.length === 0 ? (
          <p className="cms-muted">
            {loading ? (
              'Loading quizzes…'
            ) : selectedCategoryFilter !== 'all' ? (
              <>
                इस फ़िल्टर में कोई क्विज़ नहीं मिली।{' '}
                <button
                  type="button"
                  className="qz-link-btn"
                  onClick={() => setSelectedCategoryFilter('all')}
                >
                  सभी ({quizzes.length}) क्विज़ देखें
                </button>
              </>
            ) : (
              'No quizzes created yet.'
            )}
          </p>
        ) : (
          <div className="cms-table-wrap">
            <table className="cms-table">
              <thead>
                <tr>
                  <th style={{ width: 110 }}>Order / Drag</th>
                  <th>Quiz Title</th>
                  <th>Collection ID</th>
                  <th>Category</th>
                  <th>Questions</th>
                  <th>Duration</th>
                  <th>Total Marks</th>
                  <th>Updated</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredQuizzes.map((quiz, idx) => (
                  <tr
                    key={quiz.id}
                    className={`qz-drag-row ${draggedIndex === idx ? 'is-dragging' : ''} ${dragOverIndex === idx ? 'is-drag-over' : ''}`}
                    draggable={true}
                    onDragStart={(e) => handleDragStart(e, idx)}
                    onDragEnter={() => handleDragEnter(idx)}
                    onDragOver={(e) => e.preventDefault()}
                    onDragEnd={handleDragEnd}
                  >
                    <td>
                      <div className="qz-drag-cell">
                        <span
                          className="qz-drag-handle"
                          title="क्विज़ को ऊपर-नीचे खींचें (Drag to reorder)"
                        >
                          <GripVertical size={16} />
                        </span>
                        <button
                          type="button"
                          className="qz-move-btn"
                          disabled={idx === 0 || orderSaving}
                          onClick={() => moveQuiz(idx, idx - 1)}
                          title="Move Up"
                        >
                          <ChevronUp size={15} />
                        </button>
                        <button
                          type="button"
                          className="qz-move-btn"
                          disabled={idx === filteredQuizzes.length - 1 || orderSaving}
                          onClick={() => moveQuiz(idx, idx + 1)}
                          title="Move Down"
                        >
                          <ChevronDown size={15} />
                        </button>
                        <span
                          style={{
                            fontSize: '0.78rem',
                            color: '#94a3b8',
                            minWidth: 20,
                            textAlign: 'center',
                          }}
                        >
                          #{idx + 1}
                        </span>
                      </div>
                    </td>
                    <td>
                      <strong>{quiz.title}</strong>
                    </td>
                    <td>
                      <code>{quiz.collectionId || quiz.legacyCollectionName || '—'}</code>
                    </td>
                    <td>{quiz.category || quiz.subject || '—'}</td>
                    <td>
                      {Array.isArray(quiz.questions)
                        ? quiz.questions.length
                        : quiz.questionCount ?? '—'}
                    </td>
                    <td>{quiz.durationMinutes || 15} min</td>
                    <td>{quiz.totalMarks ?? '—'}</td>
                    <td>{formatDateTime(quiz.updatedAt || quiz.createdAt)}</td>
                    <td>
                      <div className="cms-row-actions">
                        <button
                          type="button"
                          className="admin-icon-btn"
                          onClick={() => setRunnerQuiz(quiz)}
                          title="Play / Test quiz"
                        >
                          <Play size={14} />
                        </button>
                        <button
                          type="button"
                          className="admin-icon-btn"
                          onClick={() => handleOpenAnalytics(quiz)}
                          title="View analytics"
                        >
                          <BarChart3 size={14} />
                        </button>
                        <button
                          type="button"
                          className="admin-icon-btn"
                          onClick={() => handleEditExistingQuiz(quiz)}
                          title="Edit quiz"
                        >
                          <Edit3 size={14} />
                        </button>
                        <button
                          type="button"
                          className="admin-icon-btn"
                          onClick={() => handleDeleteQuiz(quiz)}
                          title="Delete quiz"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {analyticsQuiz ? (
        <section className="qz-card" style={{ marginTop: 18 }}>
          <div className="qz-card-head">
            <h2>Analytics — {analyticsQuiz.title}</h2>
            <button
              type="button"
              className="admin-pill-link"
              onClick={() => setAnalyticsQuiz(null)}
            >
              Close
            </button>
          </div>
          {loadingAnalytics ? (
            <p className="cms-muted">Loading quiz attempts…</p>
          ) : (
            <div className="edu-analytics-grid">
              <div className="admin-stat-card">
                <span className="admin-stat-label">Total Participants</span>
                <strong className="admin-stat-value">{analytics.totalParticipants}</strong>
              </div>
              <div className="admin-stat-card">
                <span className="admin-stat-label">Average Score</span>
                <strong className="admin-stat-value">{analytics.averageScore}%</strong>
              </div>
              <div className="admin-stat-card">
                <span className="admin-stat-label">Avg Time</span>
                <strong className="admin-stat-value">{analytics.averageDurationSec}s</strong>
              </div>
              <div className="admin-stat-card">
                <span className="admin-stat-label">Questions</span>
                <strong className="admin-stat-value">{analyticsQuestions.length}</strong>
              </div>
            </div>
          )}
        </section>
      ) : null}

      {runnerQuiz ? (
        <QuizRunnerModal quiz={runnerQuiz} onClose={() => setRunnerQuiz(null)} />
      ) : null}
    </div>
  )
}
