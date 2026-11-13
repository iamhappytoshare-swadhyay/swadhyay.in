import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Award,
  BookOpen,
  Bookmark,
  Check,
  Clock,
  Eye,
  FileText,
  Flag,
  HelpCircle,
  Loader2,
  Menu,
  Moon,
  RotateCcw,
  Sparkles,
  Sun,
  Upload,
  X,
} from 'lucide-react'
import { collection, addDoc, getDoc, doc, serverTimestamp, getDocs, query, where, limit } from 'firebase/firestore'
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage'
import { db, storage } from '../firebase.js'
import { useAuth } from '../context/AuthContext.jsx'
import { listQuizQuestions, normalizeQuestionRecord } from '../services/eduService.js'
import { toggleUserBookmark } from '../services/studentService.js'
import { renderMathInHtml } from '../utils/renderMathHtml.js'
import { translateQuizContent } from '../utils/quizTranslator.js'
import '../styles/modernQuizPlayer.css'

const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F']

// Live Leaderboard Badge & Title System
const badgeData = [
  { badge: '👑', title: 'King' },
  { badge: '🏆', title: 'Champion' },
  { badge: '💎', title: 'Diamond Receiver' },
  { badge: '🥇', title: 'Gold Medalist' },
  { badge: '🥈', title: 'Silver Medalist' },
  { badge: '🥉', title: 'Bronze Medalist' },
  { badge: '🌟', title: 'Super Star' },
  { badge: '⭐', title: 'Star' },
  { badge: '✨', title: 'Rising star' },
  { badge: '★', title: 'Proto star' },
  { badge: '🎯', title: 'Target Achiever' },
  { badge: '📝', title: 'Academic learner' },
  { badge: '📚', title: 'Rising Learner' },
  { badge: '✍️', title: 'Learner' },
]

function getBadgeAndTitle(index, userScore, topScoreUnderRank1) {
  if (index === 0) return badgeData[0]
  if (topScoreUnderRank1 === null || topScoreUnderRank1 === undefined) return badgeData[1]
  let scoreDiff = topScoreUnderRank1 - userScore
  if (scoreDiff < 0) scoreDiff = 0
  let rangeIndex = Math.floor(scoreDiff) + 1
  if (rangeIndex >= badgeData.length - 1) rangeIndex = badgeData.length - 1
  return badgeData[rangeIndex]
}

function getQuizOriginalLanguage(quizItem, fallback = 'hi') {
  if (!quizItem) return fallback
  const direct = String(quizItem.language || quizItem.lang || '').toLowerCase().trim()
  if (direct.startsWith('hi')) return 'hi'
  if (direct.startsWith('en')) return 'en'

  const titleAndDesc = `${quizItem.title || ''} ${quizItem.description || ''} ${quizItem.category || ''}`
  if (/[\u0900-\u097F]/.test(titleAndDesc)) {
    return 'hi'
  }
  if (Array.isArray(quizItem.questions) && quizItem.questions.length > 0) {
    const qSample = quizItem.questions
      .slice(0, 3)
      .map((q) => `${q.questionText || q.question || ''} ${Array.isArray(q.options) ? q.options.join(' ') : ''}`)
      .join(' ')
    if (/[\u0900-\u097F]/.test(qSample)) {
      return 'hi'
    }
  }
  return 'en'
}

const QUIZ_STRINGS = {
  en: {
    onlineQuiz: 'Online Quiz',
    totalQuestions: 'Total Questions',
    totalMarks: 'Total Marks',
    duration: 'Duration',
    category: 'Category',
    min: 'min',
    marks: 'marks',
    marking: 'Marking',
    instructionsTitle: 'Important Instructions',
    instr1: 'Each question has 4 options, only 1 is correct.',
    instr2: 'No negative marking.',
    instr3: 'You can move freely and mark questions for review.',
    instr4: 'Timer will auto-submit the quiz when time ends.',
    loginToSave: 'Please login to track rank and save your score.',
    signInGoogle: 'Sign in with Google to Start',
    startQuiz: 'Start Quiz Now',
    answered: 'Answered',
    unanswered: 'Unanswered',
    marked: 'Marked',
    notVisited: 'Not Visited',
    notAnswered: 'Not Answered',
    markForReview: 'Mark for Review',
    markedForReview: 'Marked for Review',
    clearResponse: 'Clear Response',
    viewAllQuestions: 'View All Questions',
    questionPalette: 'Question Palette',
    submitQuiz: 'Submit Quiz',
    submitConfirmTitle: 'Submit Quiz Confirmation',
    submitConfirmMsg: (ans, tot) => `You have answered ${ans} / ${tot} questions. Are you sure you want to submit?`,
    goBack: 'Go Back',
    confirmSubmit: 'Yes, Submit',
    submitting: 'Submitting...',
    timeUpTitle: "Time's Up!",
    timeUpMsg: 'Your exam time has expired. Submitting your answers automatically...',
    resultTitle: 'Quiz Performance Summary',
    marksObtained: 'Marks Obtained',
    accuracy: 'Accuracy',
    timeTaken: 'Time Taken',
    rank: 'Rank',
    correct: 'Correct',
    incorrect: 'Incorrect',
    skipped: 'Skipped',
    viewSolutions: 'View Solutions & Explanations',
    attemptAgain: 'Attempt Again',
    backToQuizzes: 'Back to Quizzes',
    solutionsTitle: 'Solutions & Explanations',
    backToScoreCard: 'Back to Score Card',
    question: 'Question',
    of: 'of',
    pts: 'pts',
    yourAnswerCorrect: '✓ Your Answer (Correct)',
    correctAnswer: '✓ Correct Answer',
    yourAnswerWrong: '✗ Your Answer',
    explanationTitle: 'Explanation / व्याख्या:',
    warning5m: '5 minutes remaining! Review your answers.',
    warning1m: '1 minute left! Quiz will auto-submit shortly.',
    jumpToQuestion: 'Jump to Question',
    endOfQuiz: 'You have reached the end of the quiz!',
    noQuestions: 'No questions have been attached to this quiz yet.',
    loadingQuestions: 'Loading questions…',
  },
  hi: {
    onlineQuiz: 'ऑनलाइन क्विज',
    totalQuestions: 'कुल प्रश्न',
    totalMarks: 'पूर्णांक',
    duration: 'समय सीमा',
    category: 'श्रेणी',
    min: 'मिनट',
    marks: 'अंक',
    marking: 'अंकन योजना',
    instructionsTitle: 'महत्वपूर्ण निर्देश',
    instr1: 'प्रत्येक प्रश्न में 4 विकल्प हैं, केवल 1 विकल्प सही है।',
    instr2: 'कोई नकारात्मक अंकन नहीं है।',
    instr3: 'आप प्रश्नों पर जा सकते हैं और समीक्षा हेतु चिन्हित कर सकते हैं।',
    instr4: 'समय समाप्त होने पर क्विज स्वतः सबमिट हो जाएगी।',
    loginToSave: 'रैंक व स्कोर सुरक्षित करने के लिए कृपया लॉगिन करें।',
    signInGoogle: 'Google से लॉगिन करें',
    startQuiz: 'क्विज शुरू करें',
    answered: 'उत्तर दिए',
    unanswered: 'अनुत्तरित',
    marked: 'समीक्षा हेतु',
    notVisited: 'देखा नहीं',
    notAnswered: 'छोड़ा गया',
    markForReview: 'समीक्षा हेतु चिन्हित करें',
    markedForReview: 'समीक्षा हेतु चिन्हित',
    clearResponse: 'उत्तर हटाएं',
    viewAllQuestions: 'सभी प्रश्न देखें',
    questionPalette: 'प्रश्न पैलेट',
    submitQuiz: 'क्विज सबमिट करें',
    submitConfirmTitle: 'क्विज सबमिट करने की पुष्टि',
    submitConfirmMsg: (ans, tot) => `आपने कुल ${tot} में से ${ans} प्रश्नों के उत्तर दिए हैं। क्या आप सबमिट करना चाहते हैं?`,
    goBack: 'वापस जाएँ',
    confirmSubmit: 'हाँ, सबमिट करें',
    submitting: 'सबमिट हो रहा है...',
    timeUpTitle: 'समय समाप्त!',
    timeUpMsg: 'क्विज का समय समाप्त हो गया है। आपके उत्तर स्वतः सबमिट किए जा रहे हैं...',
    resultTitle: 'क्विज परिणाम सारांश',
    marksObtained: 'प्राप्त अंक',
    accuracy: 'सटीकता',
    timeTaken: 'लिया गया समय',
    rank: 'रैंक',
    correct: 'सही',
    incorrect: 'गलत',
    skipped: 'छोड़े गए',
    viewSolutions: 'समाधान व व्याख्या देखें',
    attemptAgain: 'पुनः प्रयास करें',
    backToQuizzes: 'क्विज सूची पर जाएँ',
    solutionsTitle: 'समाधान एवं व्याख्या',
    backToScoreCard: 'परिणाम पर वापस जाएँ',
    question: 'प्रश्न',
    of: 'का',
    pts: 'अंक',
    yourAnswerCorrect: '✓ आपका उत्तर (सही)',
    correctAnswer: '✓ सही उत्तर',
    yourAnswerWrong: '✗ आपका उत्तर',
    explanationTitle: 'व्याख्या / Explanation:',
    warning5m: 'केवल 5 मिनट शेष हैं! अपने उत्तरों की समीक्षा कर लें।',
    warning1m: 'केवल 1 मिनट शेष है! क्विज स्वतः सबमिट होने वाली है।',
    jumpToQuestion: 'प्रश्न पर जाएँ',
    endOfQuiz: 'आप क्विज़ के अंत तक पहुँच गए हैं!',
    noQuestions: 'इस क्विज़ में अभी कोई प्रश्न उपलब्ध नहीं हैं।',
    loadingQuestions: 'प्रश्न लोड हो रहे हैं…',
  },
}

export default function QuizRunnerModal({
  quiz,
  siteTheme,
  siteLang,
  onThemeChange,
  onLangChange,
  onClose,
  onAttemptSaved,
}) {
  const { user, profile, signInWithGoogle, requireAuth } = useAuth()

  // Language management: quiz's original language as default, with manual override support
  const userOverrodeLangRef = useRef(false)
  const [quizLang, setQuizLang] = useState(() => getQuizOriginalLanguage(quiz, siteLang || 'hi'))

  // Theme management: retains the website's theme user previously set
  const [userThemeOverride, setUserThemeOverride] = useState(null)
  const quizTheme =
    userThemeOverride ||
    siteTheme ||
    (typeof document !== 'undefined' ? document.documentElement?.dataset?.theme : null) ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('swadhyay-theme') : null) ||
    'light'

  function handleToggleTheme() {
    const nextTheme = quizTheme === 'dark' ? 'light' : 'dark'
    setUserThemeOverride(nextTheme)
    if (typeof document !== 'undefined') {
      document.documentElement.dataset.theme = nextTheme
    }
    try {
      localStorage.setItem('swadhyay-theme', nextTheme)
    } catch {
      // ignore storage error
    }
    onThemeChange?.(nextTheme)
  }

  const st = QUIZ_STRINGS[quizLang] || QUIZ_STRINGS.hi

  // --------------------------------------------------------------------------
  // Bookmarks Logic (saves in descending order to student profile)
  // --------------------------------------------------------------------------
  const userBookmarks = useMemo(() => {
    return Array.isArray(profile?.bookmarks) ? profile.bookmarks : []
  }, [profile])

  const isQuestionBookmarked = useCallback(
    (qId) => {
      return userBookmarks.some(
        (b) => b.id === `q_${qId}` || b.id === String(qId),
      )
    },
    [userBookmarks],
  )

  const handleToggleBookmark = useCallback(
    async (q) => {
      if (!user?.uid) {
        signInWithGoogle()
        return
      }
      try {
        await toggleUserBookmark(user.uid, userBookmarks, {
          id: `q_${q.id}`,
          type: 'question',
          title: q.questionText || '',
          category: quiz?.category || quiz?.title || 'Quiz Question',
          path: `/quiz/${quiz?.id || ''}`,
          quizId: quiz?.id || '',
          quizTitle: quiz?.title || '',
        })
      } catch (err) {
        console.error('Bookmark error:', err)
      }
    },
    [user, userBookmarks, quiz, signInWithGoogle],
  )

  // --------------------------------------------------------------------------
  // Question Error Report State & Handlers
  // --------------------------------------------------------------------------
  const [reportModalQuestion, setReportModalQuestion] = useState(null)
  const [reportDescription, setReportDescription] = useState('')
  const [reportAttachment, setReportAttachment] = useState(null) // { name, type, dataUrl }
  const [reportSubmitting, setReportSubmitting] = useState(false)
  const [reportSubmittedSuccess, setReportSubmittedSuccess] = useState(false)
  const [reportError, setReportError] = useState('')

  function handleOpenReportModal(q, idx) {
    setReportModalQuestion({ ...q, idx })
    setReportDescription('')
    setReportAttachment(null)
    setReportSubmittedSuccess(false)
    setReportError('')
  }

  function handleCloseReportModal() {
    setReportModalQuestion(null)
    setReportDescription('')
    setReportAttachment(null)
    setReportSubmittedSuccess(false)
    setReportError('')
  }

  function handleReportFileChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 10 * 1024 * 1024) {
      setReportError(
        quizLang === 'hi'
          ? 'फ़ाइल का आकार 10MB से कम होना चाहिए।'
          : 'File size must be less than 10MB.',
      )
      return
    }
    setReportError('')
    const reader = new FileReader()
    reader.onload = () => {
      setReportAttachment({
        name: file.name,
        type: file.type,
        dataUrl: reader.result,
        file: file,
      })
    }
    reader.onerror = () => {
      setReportError(
        quizLang === 'hi' ? 'फ़ाइल पढ़ने में त्रुटि हुई।' : 'Error reading file.',
      )
    }
    reader.readAsDataURL(file)
  }

  async function handleSubmitReport(e) {
    e.preventDefault()
    if (!reportDescription.trim() && !reportAttachment) {
      setReportError(
        quizLang === 'hi'
          ? 'कृपया विवरण लिखें या कोई संलग्नक जोड़ें।'
          : 'Please enter details or attach a file.',
      )
      return
    }
    setReportSubmitting(true)
    setReportError('')
    try {
      let uploadedUrl = ''
      if (reportAttachment?.file && storage) {
        try {
          const safeName = `${Date.now()}_${reportAttachment.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
          const fileRef = storageRef(storage, `question_reports/${safeName}`)
          await uploadBytes(fileRef, reportAttachment.file)
          uploadedUrl = await getDownloadURL(fileRef)
        } catch (storageErr) {
          console.warn('Storage upload error, fallback to dataUrl:', storageErr)
        }
      }

      // If uploaded to storage, keep dataUrl empty to save Firestore document size
      const dataUrlToSave = uploadedUrl
        ? ''
        : (reportAttachment?.dataUrl && reportAttachment.dataUrl.length < 800000 ? reportAttachment.dataUrl : '')

      if (db) {
        await addDoc(collection(db, 'question_reports'), {
          quizId: quiz?.id || '',
          quizTitle: quiz?.title || '',
          questionId: reportModalQuestion?.id || '',
          questionIndex: (reportModalQuestion?.idx ?? 0) + 1,
          questionText: reportModalQuestion?.questionText || '',
          studentUid: user?.uid || 'guest',
          studentEmail: user?.email || '',
          studentName: user?.displayName || user?.email || 'Student',
          description: reportDescription.trim(),
          attachmentName: reportAttachment?.name || '',
          attachmentType: reportAttachment?.type || '',
          attachmentUrl: uploadedUrl,
          attachmentDataUrl: dataUrlToSave,
          status: 'pending',
          createdAt: serverTimestamp(),
        })
      }
      setReportSubmittedSuccess(true)
    } catch (err) {
      setReportError(err?.message || 'Failed to submit report. Please try again.')
    } finally {
      setReportSubmitting(false)
    }
  }

  // Screen Phases: 'START' | 'PLAY' | 'RESULT' | 'SOLUTIONS'
  const [screen, setScreen] = useState('START')

  // Quiz metadata state
  const [quizDetails, setQuizDetails] = useState(quiz || {})
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  // Sanitized playable questions (NO correctOption, NO explanation)
  const [playableQuestions, setPlayableQuestions] = useState([])
  // Solutions data held securely for after-submit evaluation
  const solutionsRef = useRef([])
  const [solutionsQuestions, setSolutionsQuestions] = useState([])

  // Student State
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState({}) // { [qId]: optionIndex }
  const [markedForReview, setMarkedForReview] = useState({}) // { [qId]: boolean }
  const [visitedQuestions, setVisitedQuestions] = useState({ 0: true }) // { [index]: boolean }
  const [reachedLastQuestion, setReachedLastQuestion] = useState(false)

  // Timer State
  const [remainingSeconds, setRemainingSeconds] = useState(0)
  const [totalDurationSeconds, setTotalDurationSeconds] = useState(900)
  const [timerActive, setTimerActive] = useState(false)
  const timerIntervalRef = useRef(null)

  // Warnings (5m and 1m)
  const [warning5mShown, setWarning5mShown] = useState(false)
  const [warning1mShown, setWarning1mShown] = useState(false)
  const [activeBanner, setActiveBanner] = useState(null) // { text, urgent }

  // Modals & Drawers
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false)
  const [showMobilePalette, setShowMobilePalette] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Results State
  const [resultData, setResultData] = useState(null)
  const [rankInfo, setRankInfo] = useState({ rank: 1, total: 1 })

  // Live Leaderboard & AIR State
  const [isRetryMode, setIsRetryMode] = useState(false)
  const [leaderboardList, setLeaderboardList] = useState([])
  const [leaderboardLoading, setLeaderboardLoading] = useState(false)
  const [leaderboardError, setLeaderboardError] = useState(false)
  const [userTitleText, setUserTitleText] = useState('')
  const [userRankText, setUserRankText] = useState('')
  const [topScoreUnderRank1, setTopScoreUnderRank1] = useState(null)

  const timerStorageKey = useMemo(() => {
    return `swadhyay_quiz_timer_${quiz?.id || 'quiz'}_${user?.uid || 'guest'}`
  }, [quiz?.id, user?.uid])

  // Dynamic bilingual translation state
  const [translationsMap, setTranslationsMap] = useState({})
  const [isTranslating, setIsTranslating] = useState(false)
  const [translationProgress, setTranslationProgress] = useState({ current: 0, total: 0 })

  // Landscape Mobile Mode state
  const [isLandscapeMobile, setIsLandscapeMobile] = useState(false)
  const [landscapeBarsVisible, setLandscapeBarsVisible] = useState(false)

  useEffect(() => {
    function handleOrientationCheck() {
      const isLandscape = window.innerWidth > window.innerHeight
      // Detect phones in landscape (height <= 580px or mobile widths <= 1024 with small height)
      const isMobileHeight =
        window.innerHeight <= 580 || (window.innerWidth <= 1024 && window.innerHeight <= 600)
      const active = isLandscape && isMobileHeight
      setIsLandscapeMobile(active)
      if (!active) {
        setLandscapeBarsVisible(false)
      }
    }

    handleOrientationCheck()
    window.addEventListener('resize', handleOrientationCheck)
    window.addEventListener('orientationchange', handleOrientationCheck)
    return () => {
      window.removeEventListener('resize', handleOrientationCheck)
      window.removeEventListener('orientationchange', handleOrientationCheck)
    }
  }, [])

  // Enable native root document scrolling on mobile so browser's address bar collapses on scroll
  useEffect(() => {
    document.documentElement.classList.add('quiz-active')
    document.body.classList.add('quiz-active')
    window.scrollTo({ top: 0, behavior: 'instant' })
    return () => {
      document.documentElement.classList.remove('quiz-active')
      document.body.classList.remove('quiz-active')
    }
  }, [])

  const triggerTranslation = useCallback(
    async (targetLang, overrideQuiz = null, overrideQuestions = null) => {
      const qz = overrideQuiz || quizDetails
      const origLang = getQuizOriginalLanguage(qz, siteLang || 'hi')
      if (targetLang === origLang) return

      if (translationsMap[targetLang]?.questionsMap) {
        return
      }

      const qList =
        overrideQuestions ||
        (solutionsRef.current.length > 0 ? solutionsRef.current : playableQuestions)
      if (!qList || qList.length === 0) return

      setIsTranslating(true)
      setTranslationProgress({ current: 0, total: qList.length + 1 })

      try {
        const res = await translateQuizContent(
          qz,
          qList,
          origLang,
          targetLang,
          (curr, tot) => setTranslationProgress({ current: curr, total: tot }),
        )
        setTranslationsMap((prev) => ({
          ...prev,
          [targetLang]: res,
        }))
      } catch (err) {
        console.warn('[QuizRunnerModal] Translation error:', err)
      } finally {
        setIsTranslating(false)
      }
    },
    [quizDetails, siteLang, translationsMap, playableQuestions],
  )

  const handleToggleLanguage = useCallback(() => {
    userOverrodeLangRef.current = true
    const nextLang = quizLang === 'en' ? 'hi' : 'en'
    setQuizLang(nextLang)
    onLangChange?.(nextLang)
  }, [quizLang, onLangChange])

  // Trigger background translation whenever quizLang differs from original quiz language
  useEffect(() => {
    const origLang = getQuizOriginalLanguage(quizDetails, siteLang || 'hi')
    if (quizLang !== origLang && playableQuestions.length > 0) {
      triggerTranslation(quizLang)
    }
  }, [quizLang, quizDetails, siteLang, playableQuestions, triggerTranslation])

  const getDisplayQuestion = useCallback(
    (q) => {
      const trQ = translationsMap[quizLang]?.questionsMap?.[q.id]
      return {
        questionText: trQ?.questionText || q.questionText || q.question || '',
        options: Array.isArray(trQ?.options) && trQ.options.length > 0 ? trQ.options : q.options,
        explanation:
          trQ?.explanation != null && trQ.explanation !== '' ? trQ.explanation : q.explanation,
      }
    },
    [translationsMap, quizLang],
  )

  const displayQuizTitle =
    translationsMap[quizLang]?.quizTitle || quizDetails.title || st.onlineQuiz

  // --------------------------------------------------------------------------
  // 1. Fetch Quiz Details & Questions from Firestore
  // --------------------------------------------------------------------------
  useEffect(() => {
    let active = true

    async function loadQuizData() {
      try {
        let currentQuiz = quiz || {}
        if (quiz?.id && db) {
          try {
            const quizSnap = await getDoc(doc(db, 'quizzes', quiz.id))
            if (quizSnap.exists()) {
              currentQuiz = { id: quizSnap.id, ...quizSnap.data(), ...quiz }
            }
          } catch {
            // fallback to prop
          }
        }
        if (!active) return
        setQuizDetails(currentQuiz)
        if (!userOverrodeLangRef.current) {
          const orig = getQuizOriginalLanguage(currentQuiz, siteLang || 'hi')
          setQuizLang(orig)
        }

        const rawList = await listQuizQuestions(
          currentQuiz.id || '',
          currentQuiz.legacyCollectionName || currentQuiz.collectionId || '',
        )

        const questionsList =
          rawList.length > 0
            ? rawList
            : Array.isArray(currentQuiz.questions)
              ? currentQuiz.questions.map((q, idx) =>
                  normalizeQuestionRecord({ id: q.id || `inline_${idx}`, ...q, order: idx + 1 }),
                )
              : []

        if (!active) return

        // Save complete questions for after-submit scoring & explanations
        solutionsRef.current = questionsList

        // Playable questions with correctOption & explanation for instant feedback
        const sanitized = questionsList.map((q) => ({
          id: q.id,
          questionText: q.questionText || q.question || '',
          options: Array.isArray(q.options) ? q.options : ['', '', '', ''],
          imageUrl: q.imageUrl || '',
          marks: q.marks || null,
          order: q.order || 0,
          correctOption: Number(q.correctOption ?? 0),
          explanation: q.explanation || '',
        }))
        setPlayableQuestions(sanitized)

        // Set Duration
        const durationMins = Number(currentQuiz.durationMinutes || 15)
        const totalSecs = Math.max(60, durationMins * 60)
        setTotalDurationSeconds(totalSecs)

        // Check if student was already playing this quiz (in-progress timer in localStorage)
        try {
          const savedTimer = localStorage.getItem(timerStorageKey)
          if (savedTimer) {
            const parsed = JSON.parse(savedTimer)
            const remaining = Math.floor((parsed.endTime - Date.now()) / 1000)
            if (remaining > 0) {
              setRemainingSeconds(remaining)
              setScreen('PLAY')
              setTimerActive(true)
            } else {
              localStorage.removeItem(timerStorageKey)
            }
          }
        } catch {
          // ignore localStorage error
        }
      } catch (err) {
        if (active) {
          setLoadError(err?.message || 'Unable to load quiz.')
        }
      } finally {
        if (active) setLoading(false)
      }
    }

    loadQuizData()

    return () => {
      active = false
    }
  }, [quiz, timerStorageKey, siteLang])

  // --------------------------------------------------------------------------
  // 2. Live Leaderboard & AIR Loader
  // --------------------------------------------------------------------------
  const loadBoard = useCallback(
    async (me = null, myScore = null, myTime = null) => {
      setLeaderboardLoading(true)
      setLeaderboardError(false)
      try {
        const targetQuizId = quizDetails.id || quiz?.id || ''
        const customCol = quizDetails.collection

        const docs = []

        // If quiz has a custom collection configured (e.g. geography quizzes)
        if (customCol && customCol !== 'quiz_attempts') {
          try {
            const customSnap = await getDocs(
              query(collection(db, customCol), limit(100))
            )
            customSnap.forEach((x) => docs.push({ id: x.id, ...x.data() }))
          } catch {
            // fallback
          }
        }

        // Query standard quiz_attempts collection by quizId
        if (docs.length === 0 && targetQuizId) {
          try {
            const snap = await getDocs(
              query(
                collection(db, 'quiz_attempts'),
                where('quizId', '==', targetQuizId)
              )
            )
            snap.forEach((x) => docs.push({ id: x.id, ...x.data() }))
          } catch (e) {
            console.warn('Failed to query quiz_attempts for leaderboard:', e)
          }
        }

        // Normalize data
        const d = docs.map((x) => {
          const score = Number(x.score ?? x.marksObtained ?? 0)
          const timeTakenSec = Number(x.timeTakenSec ?? x.timeTakenSeconds ?? 0)
          const mins = Math.floor(timeTakenSec / 60)
          const secs = String(timeTakenSec % 60).padStart(2, '0')
          return {
            ...x,
            name: x.name || x.userName || 'Student',
            score,
            timeTakenSec,
            timeTakenStr: x.timeTakenStr || `${mins}:${secs}`,
          }
        })

        // Sort as per specification:
        // 1. score desc
        // 2. timeTakenSec asc
        // 3. date / timestamp desc
        d.sort((a, b) => {
          if (b.score !== a.score) return b.score - a.score
          if (a.timeTakenSec !== b.timeTakenSec) return a.timeTakenSec - b.timeTakenSec
          const timeA = a.createdAt
            ? a.createdAt.toMillis
              ? a.createdAt.toMillis()
              : new Date(a.date || a.createdAt).getTime()
            : a.date
            ? new Date(a.date).getTime()
            : 0
          const timeB = b.createdAt
            ? b.createdAt.toMillis
              ? b.createdAt.toMillis()
              : new Date(b.date || b.createdAt).getTime()
            : b.date
            ? new Date(b.date).getTime()
            : 0
          return timeB - timeA
        })

        const top100 = d.slice(0, 100)
        setLeaderboardList(top100)

        const topScoreUnderRank1Val = top100.length > 1 ? top100[1].score : null
        setTopScoreUnderRank1(topScoreUnderRank1Val)

        const currentUid = user?.uid
        if (!isRetryMode && me && top100.length > 0) {
          let rIndex =
            top100.findIndex(
              (x) =>
                (currentUid && x.userId === currentUid && x.score === myScore && x.timeTakenSec === myTime) ||
                (x.name === me && x.score === myScore && x.timeTakenSec === myTime) ||
                (x.name === me && x.score === myScore)
            ) + 1
          if (rIndex === 0) rIndex = 1
          const bData = getBadgeAndTitle(rIndex - 1, myScore, topScoreUnderRank1Val)
          setUserTitleText(`${me}, You are '${bData.title}' of this Quiz.`)
          setUserRankText(`ऑल इंडिया रैंक – ${rIndex} / ${top100.length}`)
          setRankInfo({ rank: rIndex, total: top100.length })
        } else if (isRetryMode && me) {
          setUserTitleText(`${me}, You are 'Practicing' this Quiz.`)
          setUserRankText('ऑल इंडिया रैंक – N/A (अभ्यास मोड)')
        }
      } catch (e) {
        console.error('Leaderboard error:', e)
        setLeaderboardError(true)
      } finally {
        setLeaderboardLoading(false)
      }
    },
    [quizDetails, quiz, user, isRetryMode]
  )

  // --------------------------------------------------------------------------
  // 3. Submit Logic (Score Calculation & Firestore Saving)
  // --------------------------------------------------------------------------
  const handleSubmitQuiz = useCallback(async () => {
    if (submitting) return
    setSubmitting(true)
    setShowSubmitConfirm(false)
    setTimerActive(false)
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current)

    try {
      const fullQuestions = solutionsRef.current
      const totalQuestions = fullQuestions.length
      const marksPerQuestion = Number(quizDetails.marksPerQuestion || 1)
      const negativeMarking = Number(quizDetails.negativeMarking || 0)

      let correctCount = 0
      let wrongCount = 0
      let skippedCount = 0

      fullQuestions.forEach((q) => {
        const studentAns = answers[q.id]
        if (studentAns === undefined || studentAns === null || studentAns === '') {
          skippedCount += 1
        } else if (Number(studentAns) === Number(q.correctOption)) {
          correctCount += 1
        } else {
          wrongCount += 1
        }
      })

      const answeredCount = correctCount + wrongCount
      const rawScore = correctCount * marksPerQuestion - wrongCount * negativeMarking
      const marksObtained = Math.max(0, Math.round(rawScore * 100) / 100)
      const totalMarks = totalQuestions * marksPerQuestion
      const accuracy = answeredCount > 0 ? Math.round((correctCount / answeredCount) * 100) : 0
      const timeTakenSeconds = Math.max(0, totalDurationSeconds - remainingSeconds)
      const minsTaken = Math.floor(timeTakenSeconds / 60)
      const secsTaken = String(timeTakenSeconds % 60).padStart(2, '0')
      const timeTakenStr = `${minsTaken}:${secsTaken}`
      const studentName = user?.displayName || user?.email?.split('@')[0] || 'Student'

      const attemptRecord = {
        name: studentName,
        userName: studentName,
        userId: user?.uid || 'guest_user',
        correct: correctCount,
        wrong: wrongCount,
        score: marksObtained,
        marksObtained,
        totalMarks,
        accuracy,
        totalQuestions,
        correctCount,
        wrongCount,
        skippedCount,
        timeTakenSec: timeTakenSeconds,
        timeTakenSeconds,
        timeTakenStr,
        quizId: quizDetails.id || '',
        quizTitle: quizDetails.title || 'Practice Quiz',
        answers,
        createdAt: serverTimestamp(),
        date: new Date().toISOString(),
      }

      // Handle leaderboard and firestore save based on mode
      if (!isRetryMode) {
        setUserTitleText(`${studentName}, You are calculating your rank...`)
        setUserRankText('ऑल इंडिया रैंक – गणना हो रही है...')
        loadBoard(studentName, marksObtained, timeTakenSeconds)

        if (db) {
          try {
            await addDoc(collection(db, 'quiz_attempts'), attemptRecord)
            if (quizDetails.collection && quizDetails.collection !== 'quiz_attempts') {
              await addDoc(collection(db, quizDetails.collection), attemptRecord)
            }
          } catch (e) {
            console.error('Firebase Error: ', e)
          }
          // Reload board to reflect newly saved score
          loadBoard(studentName, marksObtained, timeTakenSeconds)
        }
      } else {
        setUserTitleText(`${studentName}, You are 'Practicing' this Quiz.`)
        setUserRankText('ऑल इंडिया रैंक – N/A (अभ्यास मोड)')
        loadBoard(studentName, marksObtained, timeTakenSeconds)
      }

      // Clear localStorage timer
      try {
        localStorage.removeItem(timerStorageKey)
      } catch {
        // ignore
      }

      setResultData({
        marksObtained,
        totalMarks,
        accuracy,
        totalQuestions,
        correctCount,
        wrongCount,
        skippedCount,
        timeTakenSeconds,
      })

      if (typeof onAttemptSaved === 'function') {
        onAttemptSaved(attemptRecord)
      }

      setSolutionsQuestions(fullQuestions)
      setScreen('RESULT')
    } catch (err) {
      alert(`Submission error: ${err?.message || 'Failed to submit quiz.'}`)
    } finally {
      setSubmitting(false)
    }
  }, [
    submitting,
    quizDetails,
    answers,
    totalDurationSeconds,
    remainingSeconds,
    user,
    timerStorageKey,
    onAttemptSaved,
    isRetryMode,
    loadBoard,
  ])

  // --------------------------------------------------------------------------
  // 3. Timer & Auto-Submit Countdown
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (!timerActive || screen !== 'PLAY') {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current)
      return
    }

    timerIntervalRef.current = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(timerIntervalRef.current)
          setTimerActive(false)
          // Auto-submit when time reaches 0
          handleSubmitQuiz()
          return 0
        }

        // 5 Minutes Left Warning (300s)
        if (prev <= 300 && prev > 295 && !warning5mShown) {
          setWarning5mShown(true)
          setActiveBanner({
            text: '⚠️ ध्यान दें: केवल 5 मिनट शेष हैं! कृपया अपने उत्तरों की समीक्षा करें।',
            urgent: false,
          })
          setTimeout(() => setActiveBanner(null), 8000)
        }

        // 1 Minute Left Warning (60s)
        if (prev <= 60 && prev > 55 && !warning1mShown) {
          setWarning1mShown(true)
          setActiveBanner({
            text: '⏰ अंतिम चेतावनी: केवल 1 मिनट शेष है! क्विज़ जल्द ही स्वतः सबमिट हो जाएगी।',
            urgent: true,
          })
          setTimeout(() => setActiveBanner(null), 8000)
        }

        return prev - 1
      })
    }, 1000)

    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current)
    }
  }, [timerActive, screen, warning5mShown, warning1mShown, handleSubmitQuiz])

  // --------------------------------------------------------------------------
  // 4. Start Quiz Action
  // --------------------------------------------------------------------------
  function handleStartQuiz() {
    if (!user) {
      if (typeof requireAuth === 'function') {
        requireAuth(null, {
          type: 'quiz',
          itemType: 'quiz',
          itemName: quizDetails.title,
        })
      } else {
        signInWithGoogle()
      }
      return
    }

    const durationMins = Number(quizDetails.durationMinutes || 15)
    const secs = Math.max(60, durationMins * 60)
    setRemainingSeconds(secs)
    setTimerActive(true)

    // Store in localStorage for reload recovery
    try {
      const endTime = Date.now() + secs * 1000
      localStorage.setItem(
        timerStorageKey,
        JSON.stringify({ quizId: quizDetails.id, endTime, durationSeconds: secs }),
      )
    } catch {
      // ignore
    }

    setCurrentIndex(0)
    setVisitedQuestions({ 0: true })
    setScreen('PLAY')
  }

  // --------------------------------------------------------------------------
  // 5. Option Selection & Navigation Actions
  // --------------------------------------------------------------------------
  function handleSelectOption(qId, optIdx, qIdx) {
    setAnswers((prev) => {
      const next = { ...prev }
      if (next[qId] === optIdx) {
        delete next[qId] // Clicking selected option again unselects it
      } else {
        next[qId] = optIdx
      }
      return next
    })

    // Auto-scroll screen so explanation is visible
    setTimeout(() => {
      const explEl = document.getElementById(`explanation-${qIdx}`)
      if (explEl) {
        explEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      }
    }, 120)
  }

  function handleToggleMarkForReview(qId) {
    setMarkedForReview((prev) => ({
      ...prev,
      [qId]: !prev[qId],
    }))
  }

  const handleJumpToQuestion = useCallback((targetIdx) => {
    if (targetIdx < 0 || targetIdx >= playableQuestions.length) return
    setVisitedQuestions((prev) => (prev[targetIdx] ? prev : { ...prev, [targetIdx]: true }))
    setCurrentIndex(targetIdx)
    if (targetIdx >= playableQuestions.length - 1) {
      setReachedLastQuestion(true)
    }
    setShowMobilePalette(false)
    const el = document.getElementById(`question-card-${targetIdx}`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [playableQuestions.length])

  // Track visited questions as student scrolls through the vertical feed
  useEffect(() => {
    if (screen !== 'PLAY' || playableQuestions.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const idx = Number(entry.target.getAttribute('data-q-index'))
            if (!Number.isNaN(idx)) {
              setVisitedQuestions((prev) => (prev[idx] ? prev : { ...prev, [idx]: true }))
              setCurrentIndex(idx)
              if (idx >= playableQuestions.length - 1) {
                setReachedLastQuestion(true)
              }
            } else if (entry.target.classList.contains('mqp-feed-end-card')) {
              setReachedLastQuestion(true)
            }
          }
        })
      },
      { threshold: 0.25 },
    )

    playableQuestions.forEach((_, idx) => {
      const el = document.getElementById(`question-card-${idx}`)
      if (el) observer.observe(el)
    })

    const endCardEl = document.querySelector('.mqp-feed-end-card')
    if (endCardEl) observer.observe(endCardEl)

    return () => observer.disconnect()
  }, [screen, playableQuestions])

  const isLastQuestionReached =
    reachedLastQuestion ||
    Boolean(visitedQuestions[playableQuestions.length - 1]) ||
    currentIndex >= playableQuestions.length - 1 ||
    playableQuestions.length <= 1

  // --------------------------------------------------------------------------
  // 6. Question Palette Status Helper
  // --------------------------------------------------------------------------
  const getPaletteStatus = useCallback((idx, qId) => {
    const isVisited = Boolean(visitedQuestions[idx])
    const isAnswered = answers[qId] !== undefined && answers[qId] !== null
    const isMarked = Boolean(markedForReview[qId])

    if (isAnswered && isMarked) return 'is-answered-marked'
    if (isMarked) return 'is-marked'
    if (isAnswered) return 'is-answered'
    if (isVisited) return 'is-not-answered'
    return 'is-not-visited'
  }, [visitedQuestions, answers, markedForReview])

  // Calculate live stats
  const paletteStats = useMemo(() => {
    let answered = 0
    let marked = 0
    let notAnswered = 0
    let notVisited = 0

    playableQuestions.forEach((q, idx) => {
      const status = getPaletteStatus(idx, q.id)
      if (status === 'is-answered' || status === 'is-answered-marked') answered += 1
      if (status === 'is-marked' || status === 'is-answered-marked') marked += 1
      if (status === 'is-not-answered') notAnswered += 1
      if (status === 'is-not-visited') notVisited += 1
    })

    return { answered, notAnswered, marked, notVisited }
  }, [playableQuestions, getPaletteStatus])

  // Timer formatting
  const timerMins = String(Math.floor(remainingSeconds / 60)).padStart(2, '0')
  const timerSecs = String(remainingSeconds % 60).padStart(2, '0')
  const isUrgentTimer = remainingSeconds <= 120 && remainingSeconds > 0

  // --------------------------------------------------------------------------
  // 7. Restart / Close Actions & Result Screen Lifecycle
  // --------------------------------------------------------------------------
  function handleAttemptAgain() {
    setIsRetryMode(true)
    setAnswers({})
    setMarkedForReview({})
    setVisitedQuestions({ 0: true })
    setReachedLastQuestion(false)
    setCurrentIndex(0)
    setResultData(null)
    setWarning5mShown(false)
    setWarning1mShown(false)
    setActiveBanner(null)
    try {
      localStorage.removeItem(timerStorageKey)
    } catch {
      // ignore
    }
    setScreen('START')
  }

  function handleClosePlayer() {
    setIsRetryMode(false)
    try {
      localStorage.removeItem(timerStorageKey)
    } catch {
      // ignore
    }
    onClose()
  }

  // ==========================================================================
  // RENDER: 1. QUIZ START SCREEN
  // ==========================================================================
  if (screen === 'START') {
    const durationMins = Number(quizDetails.durationMinutes || 15)
    const marksPerQ = Number(quizDetails.marksPerQuestion || 1)
    const negMarks = Number(quizDetails.negativeMarking || 0)
    const totalQCount = playableQuestions.length
    const totalMarks = totalQCount * marksPerQ

    return (
      <div
      className={`modern-quiz-player theme-${quizTheme} ${isLandscapeMobile ? 'is-landscape-mobile' : ''} ${
        isLandscapeMobile && !landscapeBarsVisible ? 'bars-hidden' : ''
      }`}
      data-theme={quizTheme}
      role="dialog"
      aria-modal="true"
    >
        <div className="mqp-start-container">
          <div className="mqp-start-card">
            <div className="mqp-start-header-actions">
              <button
                type="button"
                className={`mqp-topbar-toggle-btn mqp-lang-toggle-btn ${isTranslating ? 'is-translating' : ''}`}
                onClick={handleToggleLanguage}
                title={quizLang === 'en' ? 'हिंदी में बदलें' : 'Switch to English'}
                aria-label="Toggle Language"
                disabled={isTranslating}
              >
                {isTranslating ? (
                  <Loader2 size={15} className="mqp-spin" />
                ) : (
                  quizLang === 'en' ? 'हिं' : 'E'
                )}
              </button>
              <button
                type="button"
                className="mqp-topbar-toggle-btn mqp-theme-toggle-btn"
                onClick={handleToggleTheme}
                title={quizTheme === 'dark' ? 'Light Theme' : 'Dark Theme'}
                aria-label="Toggle Theme"
              >
                {quizTheme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
              </button>
              <button
                type="button"
                className="mqp-close-start-btn"
                onClick={handleClosePlayer}
                aria-label="Close quiz"
              >
                <X size={20} />
              </button>
            </div>

            {isTranslating ? (
              <div className="mqp-translating-banner" style={{ borderRadius: 8, marginBottom: 16 }}>
                <Loader2 size={15} className="mqp-spin" />
                <span>
                  {quizLang === 'en'
                    ? `Translating questions, options & explanations to English (${translationProgress.current}/${translationProgress.total})...`
                    : `प्रश्नों, विकल्पों एवं व्याख्या का अनुवाद हो रहा है (${translationProgress.current}/${translationProgress.total})...`}
                </span>
              </div>
            ) : null}

            {quizDetails.category || quizDetails.subject ? (
              <span className="mqp-start-badge">
                {quizDetails.category || quizDetails.subject}
              </span>
            ) : null}

            <h1 className="mqp-start-title">{displayQuizTitle}</h1>

            {quizDetails.description ? (
              <p className="mqp-start-desc">{quizDetails.description}</p>
            ) : null}

            {loading ? (
              <p style={{ textAlign: 'center', color: '#64748b' }}>{st.loadingQuestions}</p>
            ) : loadError ? (
              <div
                style={{
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  padding: 16,
                  borderRadius: 12,
                  color: '#b91c1c',
                  marginBottom: 20,
                }}
              >
                {loadError}
              </div>
            ) : totalQCount === 0 ? (
              <div
                style={{
                  background: 'var(--surface, #f8fafc)',
                  border: '1px solid var(--border, #e2e8f0)',
                  padding: 24,
                  borderRadius: 14,
                  textAlign: 'center',
                  color: '#64748b',
                  marginBottom: 24,
                }}
              >
                <HelpCircle size={36} style={{ margin: '0 auto 10px', color: '#94a3b8' }} />
                <p style={{ margin: 0, fontWeight: 600 }}>{st.noQuestions}</p>
              </div>
            ) : (
              <>
                <div className="mqp-start-stats-grid">
                  <div className="mqp-start-stat">
                    <div className="mqp-start-stat-label">{st.totalQuestions}</div>
                    <div className="mqp-start-stat-val">{totalQCount}</div>
                  </div>
                  <div className="mqp-start-stat">
                    <div className="mqp-start-stat-label">{st.totalMarks}</div>
                    <div className="mqp-start-stat-val">{totalMarks}</div>
                  </div>
                  <div className="mqp-start-stat">
                    <div className="mqp-start-stat-label">{st.duration}</div>
                    <div className="mqp-start-stat-val">{durationMins} {st.min}</div>
                  </div>
                  <div className="mqp-start-stat">
                    <div className="mqp-start-stat-label">{st.marking}</div>
                    <div className="mqp-start-stat-val">
                      +{marksPerQ} {negMarks > 0 ? `/-${negMarks}` : ''}
                    </div>
                  </div>
                </div>

                <div className="mqp-instructions-box">
                  <h3 className="mqp-instructions-title">
                    <BookOpen size={18} color="#2563eb" /> {st.instructionsTitle}
                  </h3>
                  <ol className="mqp-instructions-list">
                    <li>{st.instr1}</li>
                    <li>
                      {negMarks > 0
                        ? (quizLang === 'hi' ? `प्रत्येक गलत उत्तर पर -${negMarks} अंक कटेंगे।` : `Each wrong answer incurs -${negMarks} negative marking.`)
                        : st.instr2}
                    </li>
                    <li>{st.instr3}</li>
                    <li>{st.instr4}</li>
                  </ol>
                </div>

                {!user ? (
                  <div className="mqp-start-login-box">
                    <p>{st.loginToSave}</p>
                    <button
                      type="button"
                      className="mqp-start-btn"
                      onClick={() => {
                        if (typeof requireAuth === 'function') {
                          requireAuth(null, {
                            type: 'quiz',
                            itemType: 'quiz',
                            itemName: quizDetails.title,
                          })
                        } else {
                          signInWithGoogle()
                        }
                      }}
                    >
                      <span>{st.signInGoogle}</span>
                    </button>
                  </div>
                ) : (
                  <button type="button" className="mqp-start-btn" onClick={handleStartQuiz}>
                    <span>{st.startQuiz}</span>
                    <ArrowRight size={20} />
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ==========================================================================
  // RENDER: 3. RESULT SCREEN
  // ==========================================================================
  if (screen === 'RESULT' && resultData) {
    const {
      marksObtained,
      totalMarks,
      accuracy,
      totalQuestions,
      correctCount,
      wrongCount,
      skippedCount,
      timeTakenSeconds,
    } = resultData

    const minsTaken = Math.floor(timeTakenSeconds / 60)
    const secsTaken = String(timeTakenSeconds % 60).padStart(2, '0')

    // Circular donut calculations (circumference = 339.29)
    const circumference = 339.29
    const correctRatio = totalQuestions > 0 ? correctCount / totalQuestions : 0
    const wrongRatio = totalQuestions > 0 ? wrongCount / totalQuestions : 0
    const skippedRatio = totalQuestions > 0 ? skippedCount / totalQuestions : 0

    const correctDash = correctRatio * circumference
    const wrongDash = wrongRatio * circumference
    const skippedDash = skippedRatio * circumference

    return (
      <div
      className={`modern-quiz-player theme-${quizTheme} ${isLandscapeMobile ? 'is-landscape-mobile' : ''} ${
        isLandscapeMobile && !landscapeBarsVisible ? 'bars-hidden' : ''
      }`}
      data-theme={quizTheme}
      role="dialog"
      aria-modal="true"
    >
        <div className="mqp-result-container">
          <div className="mqp-result-card">
            <div className="mqp-start-header-actions">
              <button
                type="button"
                className="mqp-topbar-toggle-btn mqp-lang-toggle-btn"
                onClick={handleToggleLanguage}
                title={quizLang === 'en' ? 'हिंदी में बदलें' : 'Switch to English'}
                aria-label="Toggle Language"
              >
                {quizLang === 'en' ? 'हिं' : 'E'}
              </button>
              <button
                type="button"
                className="mqp-topbar-toggle-btn mqp-theme-toggle-btn"
                onClick={handleToggleTheme}
                title={quizTheme === 'dark' ? 'Light Theme' : 'Dark Theme'}
                aria-label="Toggle Theme"
              >
                {quizTheme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
              </button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: '50%',
                  background: '#ecfdf5',
                  color: '#059669',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Award size={32} />
              </div>
            </div>

            <h1 className="mqp-result-title">{st.resultTitle}</h1>
            <p className="mqp-result-subtitle">{quizDetails.title || st.onlineQuiz}</p>

            <div className="mqp-result-user-banner" id="userTitleText">
              {userTitleText || `${user?.displayName || user?.email?.split('@')[0] || 'Student'}, You are calculating your rank...`}
            </div>

            {/* Donut & Legend */}
            <div className="mqp-result-overview">
              <div className="mqp-donut-wrap">
                <svg width="150" height="150" viewBox="0 0 120 120">
                  {/* Background Circle */}
                  <circle
                    cx="60"
                    cy="60"
                    r="54"
                    fill="none"
                    stroke="#f1f5f9"
                    strokeWidth="12"
                  />
                  {/* Skipped Arc (Grey) */}
                  <circle
                    cx="60"
                    cy="60"
                    r="54"
                    fill="none"
                    stroke="#94a3b8"
                    strokeWidth="12"
                    strokeDasharray={`${skippedDash} ${circumference}`}
                    strokeDashoffset={0}
                    transform="rotate(-90 60 60)"
                  />
                  {/* Wrong Arc (Red) */}
                  <circle
                    cx="60"
                    cy="60"
                    r="54"
                    fill="none"
                    stroke="#ef4444"
                    strokeWidth="12"
                    strokeDasharray={`${wrongDash} ${circumference}`}
                    strokeDashoffset={-skippedDash}
                    transform="rotate(-90 60 60)"
                  />
                  {/* Correct Arc (Green) */}
                  <circle
                    cx="60"
                    cy="60"
                    r="54"
                    fill="none"
                    stroke="#22c55e"
                    strokeWidth="12"
                    strokeDasharray={`${correctDash} ${circumference}`}
                    strokeDashoffset={-(skippedDash + wrongDash)}
                    transform="rotate(-90 60 60)"
                  />
                </svg>
                <div className="mqp-donut-center">
                  <span className="mqp-donut-score">{marksObtained}</span>
                  <span className="mqp-donut-label">of {totalMarks} {st.pts}</span>
                </div>
              </div>

              <div className="mqp-donut-legend">
                <div className="mqp-donut-legend-item">
                  <span
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: 4,
                      background: '#22c55e',
                      display: 'inline-block',
                    }}
                  />
                  <span>{st.correct}: <strong>{correctCount}</strong></span>
                </div>
                <div className="mqp-donut-legend-item">
                  <span
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: 4,
                      background: '#ef4444',
                      display: 'inline-block',
                    }}
                  />
                  <span>{st.incorrect}: <strong>{wrongCount}</strong></span>
                </div>
                <div className="mqp-donut-legend-item">
                  <span
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: 4,
                      background: '#94a3b8',
                      display: 'inline-block',
                    }}
                  />
                  <span>{st.skipped}: <strong>{skippedCount}</strong></span>
                </div>
              </div>
            </div>

            {/* 4 Stat Boxes */}
            <div className="mqp-result-grid">
              <div className="mqp-result-stat">
                <div className="mqp-result-stat-label">{st.marksObtained}</div>
                <div className="mqp-result-stat-val">
                  {marksObtained} / {totalMarks}
                </div>
              </div>
              <div className="mqp-result-stat">
                <div className="mqp-result-stat-label">{st.accuracy}</div>
                <div className="mqp-result-stat-val">{accuracy}%</div>
              </div>
              <div className="mqp-result-stat">
                <div className="mqp-result-stat-label">{st.timeTaken}</div>
                <div className="mqp-result-stat-val">
                  {minsTaken}:{secsTaken}
                </div>
              </div>
              <div className="mqp-result-stat">
                <div className="mqp-result-stat-label">{st.rank}</div>
                <div className="mqp-result-stat-val" style={{ color: '#2563eb' }} id="rankText">
                  {userRankText ? (
                    userRankText
                  ) : isRetryMode ? (
                    'N/A (अभ्यास मोड)'
                  ) : (
                    <>
                      #{rankInfo.rank}{' '}
                      <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#64748b' }}>
                        / {rankInfo.total}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="mqp-result-actions">
              <button
                type="button"
                className="mqp-btn mqp-btn-primary"
                style={{ padding: '14px 24px', fontSize: '1.05rem', width: '100%' }}
                onClick={() => setScreen('SOLUTIONS')}
              >
                <Eye size={18} />
                <span>{st.viewSolutions}</span>
              </button>
              <div className="mqp-result-actions-secondary">
                <button
                  type="button"
                  className="mqp-btn mqp-btn-secondary"
                  onClick={handleAttemptAgain}
                >
                  <RotateCcw size={16} />
                  <span>{st.attemptAgain}</span>
                </button>
                <button
                  type="button"
                  className="mqp-btn mqp-btn-secondary"
                  onClick={handleClosePlayer}
                >
                  <ArrowLeft size={16} />
                  <span>{st.backToQuizzes}</span>
                </button>
              </div>
            </div>

            <hr className="mqp-result-hr" />

            {/* 🏆 LIVE LEADERBOARD - ALL INDIA RANK (AIR) */}
            <div className="mqp-leaderboard-section">
              <h3>🏆 लाइव लीडरबोर्ड - ऑल इंडिया रैंक : AIR</h3>
              <table className="mqp-leaderboard-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>नाम</th>
                    <th>स्कोर</th>
                    <th>समय</th>
                  </tr>
                </thead>
                <tbody id="board">
                  {leaderboardLoading ? (
                    <tr>
                      <td colSpan={4}>लोड हो रहा है...</td>
                    </tr>
                  ) : leaderboardError ? (
                    <tr>
                      <td colSpan={4}>लीडरबोर्ड लोड नहीं हुआ</td>
                    </tr>
                  ) : leaderboardList.length === 0 ? (
                    <tr>
                      <td colSpan={4}>अभी कोई परिणाम नहीं</td>
                    </tr>
                  ) : (
                    leaderboardList.map((x, i) => {
                      const currentUid = user?.uid
                      const currentUserName = user?.displayName || user?.email?.split('@')[0] || 'Student'
                      const you = Boolean(
                        (currentUid && x.userId === currentUid && x.score === marksObtained && x.timeTakenSec === timeTakenSeconds) ||
                        (currentUserName && x.name === currentUserName && x.score === marksObtained && x.timeTakenSec === timeTakenSeconds) ||
                        (!isRetryMode && currentUserName && x.name === currentUserName && x.score === marksObtained)
                      )
                      const bData = getBadgeAndTitle(i, x.score, topScoreUnderRank1)
                      return (
                        <tr
                          key={x.id || `${x.name}-${i}`}
                          className={you ? 'mqp-leaderboard-row-me' : ''}
                          style={you ? { background: '#e3f2fd', fontWeight: 'bold' } : undefined}
                        >
                          <td>{i + 1}</td>
                          <td>
                            {bData.badge} {x.name}
                            {you ? ' (आप)' : ''}
                          </td>
                          <td>
                            <b>{x.score}</b>
                          </td>
                          <td>{x.timeTakenStr || '-'}</td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ==========================================================================
  // RENDER: 4. VIEW SOLUTIONS SCREEN
  // ==========================================================================
  if (screen === 'SOLUTIONS') {
    const fullQuestions = solutionsQuestions
    return (
      <div
      className={`modern-quiz-player theme-${quizTheme} ${isLandscapeMobile ? 'is-landscape-mobile' : ''} ${
        isLandscapeMobile && !landscapeBarsVisible ? 'bars-hidden' : ''
      }`}
      data-theme={quizTheme}
      role="dialog"
      aria-modal="true"
    >
        <header className="mqp-solutions-header">
          <div>
            <h2 style={{ margin: 0, fontSize: '1.25rem' }}>
              {st.solutionsTitle}
            </h2>
            <p style={{ margin: '2px 0 0', fontSize: '0.84rem', color: '#64748b' }}>
              {displayQuizTitle}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              type="button"
              className={`mqp-topbar-toggle-btn mqp-lang-toggle-btn ${isTranslating ? 'is-translating' : ''}`}
              onClick={handleToggleLanguage}
              title={quizLang === 'en' ? 'हिंदी में बदलें' : 'Switch to English'}
              aria-label="Toggle Language"
              disabled={isTranslating}
            >
              {isTranslating ? (
                <Loader2 size={15} className="mqp-spin" />
              ) : (
                quizLang === 'en' ? 'हिं' : 'E'
              )}
            </button>
            <button
              type="button"
              className="mqp-topbar-toggle-btn mqp-theme-toggle-btn"
              onClick={handleToggleTheme}
              title={quizTheme === 'dark' ? 'Light Theme' : 'Dark Theme'}
              aria-label="Toggle Theme"
            >
              {quizTheme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
            </button>
            <button
              type="button"
              className="mqp-btn mqp-btn-secondary"
              onClick={() => setScreen('RESULT')}
            >
              <ArrowLeft size={16} />
              <span>{st.backToScoreCard}</span>
            </button>
          </div>
        </header>

        {isTranslating ? (
          <div className="mqp-translating-banner">
            <Loader2 size={15} className="mqp-spin" />
            <span>
              {quizLang === 'en'
                ? `Translating solutions & explanations to English (${translationProgress.current}/${translationProgress.total})...`
                : `समाधान व व्याख्या का अनुवाद हो रहा है (${translationProgress.current}/${translationProgress.total})...`}
            </span>
          </div>
        ) : null}

        <div className="mqp-solutions-content">
          <div className="mqp-solutions-container">
            {fullQuestions.map((q, qIdx) => {
              const dq = getDisplayQuestion(q)
              const studentAnswerIdx = answers[q.id]
              const correctAnswerIdx = Number(q.correctOption ?? 0)
              const hasAnswered = studentAnswerIdx !== undefined && studentAnswerIdx !== null
              const isCorrect = hasAnswered && Number(studentAnswerIdx) === correctAnswerIdx

              return (
                <div key={q.id || qIdx} className="mqp-solution-card">
                  <div className="mqp-solution-head">
                    <span style={{ fontWeight: 800 }}>
                      {st.question} {qIdx + 1} {st.of} {fullQuestions.length}
                    </span>
                    <span
                      className={`mqp-solution-tag ${
                        !hasAnswered
                          ? 'is-skipped'
                          : isCorrect
                            ? 'is-correct'
                            : 'is-wrong'
                      }`}
                    >
                      {!hasAnswered
                        ? `${st.skipped} (0 ${st.pts})`
                        : isCorrect
                          ? `✓ ${st.correct} (+${quizDetails.marksPerQuestion || 1})`
                          : `✗ ${st.incorrect} (-${quizDetails.negativeMarking || 0})`}
                    </span>
                  </div>

                  <h3
                    className="mqp-solution-text"
                    dangerouslySetInnerHTML={{
                      __html: renderMathInHtml(dq.questionText),
                    }}
                  />

                  {q.imageUrl ? (
                    <img src={q.imageUrl} alt="" className="mqp-question-image" />
                  ) : null}

                  <div className="mqp-solution-options">
                    {dq.options.map((opt, optIdx) => {
                      const isCorrectChoice = optIdx === correctAnswerIdx
                      const isStudentChoice = hasAnswered && optIdx === Number(studentAnswerIdx)

                      let optClass = 'mqp-sol-opt'
                      if (isCorrectChoice) optClass += ' is-correct-ans'
                      else if (isStudentChoice && !isCorrect) optClass += ' is-user-wrong'

                      return (
                        <div key={optIdx} className={optClass}>
                          <span
                            className="mqp-option-letter"
                            style={{
                              background: isCorrectChoice
                                ? '#22c55e'
                                : isStudentChoice
                                  ? '#ef4444'
                                  : undefined,
                              color: isCorrectChoice || isStudentChoice ? '#ffffff' : undefined,
                              borderColor: isCorrectChoice
                                ? '#16a34a'
                                : isStudentChoice
                                  ? '#dc2626'
                                  : undefined,
                            }}
                          >
                            {OPTION_LETTERS[optIdx] || optIdx + 1}
                          </span>
                          <span
                            style={{ flex: 1 }}
                            dangerouslySetInnerHTML={{ __html: renderMathInHtml(opt) }}
                          />
                          {isCorrectChoice && isStudentChoice ? (
                            <span className="mqp-sol-badge is-green">{st.yourAnswerCorrect}</span>
                          ) : isCorrectChoice ? (
                            <span className="mqp-sol-badge is-green">{st.correctAnswer}</span>
                          ) : isStudentChoice ? (
                            <span className="mqp-sol-badge is-red">{st.yourAnswerWrong}</span>
                          ) : null}
                        </div>
                      )
                    })}
                  </div>

                  {dq.explanation ? (
                    <div className="mqp-explanation-box">
                      <span className="mqp-explanation-title-inline">
                        <Sparkles size={15} style={{ display: 'inline', verticalAlign: 'text-bottom', marginRight: 4 }} />
                        <strong>{st.explanationTitle}</strong>
                      </span>{' '}
                      <span
                        className="mqp-explanation-text-inline"
                        dangerouslySetInnerHTML={{
                          __html: renderMathInHtml(dq.explanation),
                        }}
                      />
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  // ==========================================================================
  // RENDER: 2. QUIZ PLAY SCREEN (All questions one below another on same screen)
  // ==========================================================================
  const totalQ = playableQuestions.length
  const progressPercent = totalQ > 0 ? Math.round((paletteStats.answered / totalQ) * 100) : 0

  return (
    <div
      className={`modern-quiz-player theme-${quizTheme} ${isLandscapeMobile ? 'is-landscape-mobile' : ''} ${
        isLandscapeMobile && !landscapeBarsVisible ? 'bars-hidden' : ''
      }`}
      data-theme={quizTheme}
      role="dialog"
      aria-modal="true"
    >
      {/* 1. Sticky Top Bar */}
      <header className="mqp-topbar">
        <div className="mqp-topbar-left">
          <h2 className="mqp-topbar-title">{displayQuizTitle}</h2>
        </div>

        <div className="mqp-topbar-right">
          {/* Language Toggle: E / हिं */}
          <button
            type="button"
            className={`mqp-topbar-toggle-btn mqp-lang-toggle-btn ${isTranslating ? 'is-translating' : ''}`}
            onClick={handleToggleLanguage}
            title={quizLang === 'en' ? 'हिंदी में बदलें' : 'Switch to English'}
            aria-label="Toggle Language"
            disabled={isTranslating}
          >
            {isTranslating ? (
              <Loader2 size={15} className="mqp-spin" />
            ) : (
              quizLang === 'en' ? 'हिं' : 'E'
            )}
          </button>

          {/* Theme Toggle: Sun / Moon */}
          <button
            type="button"
            className="mqp-topbar-toggle-btn mqp-theme-toggle-btn"
            onClick={handleToggleTheme}
            title={quizTheme === 'dark' ? 'Light Theme' : 'Dark Theme'}
            aria-label="Toggle Theme"
          >
            {quizTheme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
          </button>

          {/* Timer */}
          <div className={`mqp-timer-badge ${isUrgentTimer ? 'is-urgent' : ''}`}>
            <Clock size={16} />
            <span>
              {timerMins}:{timerSecs}
            </span>
          </div>
        </div>
      </header>

      {/* Dynamic Progress Strip directly below Title, Language, Theme & Timer */}
      {/* Green fill growing left-to-right, remainder in Red */}
      <div
        className="mqp-fullwidth-progress-strip"
        role="progressbar"
        aria-valuenow={progressPercent}
        aria-valuemin="0"
        aria-valuemax="100"
      >
        <div
          className="mqp-fullwidth-progress-green"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Dynamic Live Translation Banner */}
      {isTranslating ? (
        <div className="mqp-translating-banner">
          <Loader2 size={15} className="mqp-spin" />
          <span>
            {quizLang === 'en'
              ? `Translating questions, options & explanations to English (${translationProgress.current}/${translationProgress.total})...`
              : `प्रश्नों, विकल्पों एवं व्याख्या का अनुवाद हो रहा है (${translationProgress.current}/${translationProgress.total})...`}
          </span>
        </div>
      ) : null}

      {/* Warning Toast Banner (5m and 1m left) */}
      {activeBanner ? (
        <div className={`mqp-warning-banner ${activeBanner.urgent ? 'is-urgent' : ''}`}>
          <span>{activeBanner.text}</span>
          <button
            type="button"
            onClick={() => setActiveBanner(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}
          >
            <X size={16} />
          </button>
        </div>
      ) : null}

      {/* 2. Main Body Area */}
      <div className="mqp-body">
        {/* Left: Question Area with all questions vertically stacked */}
        <main className="mqp-main-area">
          {playableQuestions.length > 0 ? (
            <div className="mqp-vertical-feed">
              {playableQuestions.map((q, idx) => {
                const dq = getDisplayQuestion(q)
                const selectedOpt = answers[q.id]
                const isMarked = Boolean(markedForReview[q.id])
                const isAnswered = selectedOpt !== undefined && selectedOpt !== null

                // Solution data for instant feedback
                const correctOpt = Number(q.correctOption ?? 0)
                const isUserCorrect = isAnswered && Number(selectedOpt) === correctOpt
                const isUserWrong = isAnswered && Number(selectedOpt) !== correctOpt
                const isBookmarked = isQuestionBookmarked(q.id)

                return (
                  <article
                    key={q.id || idx}
                    id={`question-card-${idx}`}
                    data-q-index={idx}
                    className={`mqp-question-block ${isAnswered ? 'is-answered-card' : ''} ${isMarked ? 'is-marked-card' : ''}`}
                  >
                    {/* Question text with only number prefix (e.g. 1. , 2. ) without 'प्रश्न', 'Q', or 'marks' */}
                    <h2 className="mqp-question-text">
                      <span className="mqp-q-num-prefix">{idx + 1}. </span>
                      <span
                        dangerouslySetInnerHTML={{
                          __html: renderMathInHtml(dq.questionText),
                        }}
                      />
                    </h2>

                    {q.imageUrl ? (
                      <img src={q.imageUrl} alt="" className="mqp-question-image" />
                    ) : null}

                    {/* Options List with beautiful red ring feedback */}
                    <div className="mqp-options-list">
                      {dq.options.map((opt, optIdx) => {
                        const isSelected = selectedOpt === optIdx
                        const isCorrectAnswer = optIdx === correctOpt

                        // Ring outline logic:
                        // - Correct answer chosen: green ring
                        // - Wrong answer chosen: that option gets red ring AND correct answer option gets green ring
                        let ringClass = ''
                        if (isAnswered) {
                          if (isUserCorrect && isSelected) {
                            ringClass = 'is-green-ring is-correct-ring'
                          } else if (isUserWrong) {
                            if (isSelected) {
                              ringClass = 'is-red-ring is-wrong-ring'
                            } else if (isCorrectAnswer) {
                              ringClass = 'is-green-ring is-correct-ring'
                            }
                          }
                        }

                        return (
                          <button
                            key={optIdx}
                            type="button"
                            className={`mqp-option-card ${ringClass} ${isSelected ? 'is-selected' : ''}`}
                            onClick={() => handleSelectOption(q.id, optIdx, idx)}
                          >
                            <span className="mqp-option-letter">
                              {isAnswered && isCorrectAnswer ? (
                                <Check size={18} />
                              ) : isAnswered && isSelected && isUserWrong ? (
                                <X size={18} />
                              ) : (
                                OPTION_LETTERS[optIdx] || optIdx + 1
                              )}
                            </span>
                            <span
                              className="mqp-option-text"
                              dangerouslySetInnerHTML={{ __html: renderMathInHtml(opt) }}
                            />
                            {isAnswered && isCorrectAnswer ? (
                              <span
                                style={{
                                  fontSize: '0.78rem',
                                  fontWeight: 800,
                                  color: '#16a34a',
                                  marginLeft: 'auto',
                                  padding: '2px 8px',
                                  background: 'rgba(34, 197, 94, 0.12)',
                                  borderRadius: 6,
                                }}
                              >
                                ✓ {quizLang === 'hi' ? 'सही उत्तर' : 'Correct'}
                              </span>
                            ) : isAnswered && isSelected && isUserWrong ? (
                              <span
                                style={{
                                  fontSize: '0.78rem',
                                  fontWeight: 800,
                                  color: '#dc2626',
                                  marginLeft: 'auto',
                                  padding: '2px 8px',
                                  background: 'rgba(239, 68, 68, 0.12)',
                                  borderRadius: 6,
                                }}
                              >
                                ✗ {quizLang === 'hi' ? 'आपका उत्तर' : 'Your Answer'}
                              </span>
                            ) : null}
                          </button>
                        )
                      })}
                    </div>

                    {/* Instant Explanation Box shown right below options */}
                    {isAnswered && dq.explanation ? (
                      <div id={`explanation-${idx}`} className="mqp-explanation-box mqp-instant-explanation">
                        <span className="mqp-explanation-title-inline">
                          <Sparkles size={16} style={{ display: 'inline', verticalAlign: 'text-bottom', marginRight: 4 }} />
                          <strong>{quizLang === 'hi' ? 'व्याख्या:' : 'Explanation:'}</strong>
                        </span>{' '}
                        <span
                          className="mqp-explanation-text-inline"
                          dangerouslySetInnerHTML={{
                            __html: renderMathInHtml(dq.explanation),
                          }}
                        />
                      </div>
                    ) : null}

                    {/* Three Action Buttons: Review, Bookmark, Report ans */}
                    <div className="mqp-q-action-row">
                      {/* Review */}
                      <button
                        type="button"
                        className={`mqp-action-btn mqp-btn-review ${isMarked ? 'is-marked' : ''}`}
                        onClick={() => handleToggleMarkForReview(q.id)}
                        title="Review (पैलेट में जामुनी)"
                      >
                        <Flag size={15} />
                        <span>Review</span>
                      </button>

                      {/* Bookmark */}
                      <button
                        type="button"
                        className={`mqp-action-btn mqp-btn-bookmark ${isBookmarked ? 'is-bookmarked' : ''}`}
                        onClick={() => handleToggleBookmark(q)}
                        title="Student Dashboard के Bookmarked Questions में सेव करें"
                      >
                        <Bookmark size={15} fill={isBookmarked ? 'currentColor' : 'none'} />
                        <span>{isBookmarked ? 'Bookmarked' : 'Bookmark'}</span>
                      </button>

                      {/* Report ans */}
                      <button
                        type="button"
                        className="mqp-action-btn mqp-btn-report"
                        onClick={() => handleOpenReportModal(q, idx)}
                        title="प्रश्न/उत्तर में त्रुटि रिपोर्ट करें"
                      >
                        <AlertTriangle size={15} />
                        <span>Report ans</span>
                      </button>
                    </div>
                  </article>
                )
              })}

              {/* End of Feed Card */}
              <div className="mqp-feed-end-card">
                <h3>{st.endOfQuiz}</h3>
                <p>
                  {st.answered}: <strong>{paletteStats.answered}</strong> / <strong>{totalQ}</strong>
                </p>
                <button
                  type="button"
                  className="mqp-btn-submit"
                  style={{ margin: '0 auto', display: 'inline-flex' }}
                  onClick={() => setShowSubmitConfirm(true)}
                >
                  {st.submitQuiz}
                </button>
              </div>
            </div>
          ) : (
            <p style={{ textAlign: 'center', color: '#64748b' }}>{st.noQuestions}</p>
          )}
        </main>

        {/* Right: Question Palette Sidebar (Desktop) */}
        <aside className="mqp-sidebar">
          <div className="mqp-sidebar-head">
            <h3 className="mqp-sidebar-title">{st.questionPalette}</h3>
            <span style={{ fontSize: '0.82rem', color: '#64748b', fontWeight: 600 }}>
              {playableQuestions.length} {st.totalQuestions}
            </span>
          </div>

          <div className="mqp-palette-grid">
            {playableQuestions.map((q, idx) => {
              const status = getPaletteStatus(idx, q.id)
              const isCurrent = idx === currentIndex
              return (
                <button
                  key={q.id || idx}
                  type="button"
                  className={`mqp-palette-btn ${status} ${isCurrent ? 'is-current' : ''}`}
                  onClick={() => handleJumpToQuestion(idx)}
                  title={`${st.jumpToQuestion} ${idx + 1}`}
                >
                  {idx + 1}
                </button>
              )
            })}
          </div>

          <div className="mqp-palette-legend">
            <div className="mqp-legend-item">
              <span className="mqp-legend-box is-answered" />
              <span>{st.answered} ({paletteStats.answered})</span>
            </div>
            <div className="mqp-legend-item">
              <span className="mqp-legend-box is-not-answered" />
              <span>{st.notAnswered} ({paletteStats.notAnswered})</span>
            </div>
            <div className="mqp-legend-item">
              <span className="mqp-legend-box is-marked" />
              <span>{st.markedForReview}</span>
            </div>
            <div className="mqp-legend-item">
              <span className="mqp-legend-box is-answered-marked" />
              <span>{st.answered} &amp; {st.marked}</span>
            </div>
            <div className="mqp-legend-item">
              <span className="mqp-legend-box is-not-visited" />
              <span>{st.notVisited} ({paletteStats.notVisited})</span>
            </div>
          </div>
        </aside>
      </div>

      {/* 3. Sticky Bottom Bar */}
      <footer className="mqp-bottombar">
        {/* Desktop View: Stats + Actions in one clean flex row */}
        <div className="mqp-bottom-desktop-row">
          <div className="mqp-bottom-stats">
            <span className="mqp-stat-pill is-green">{st.answered}: {paletteStats.answered}</span>
            <span className="mqp-stat-pill is-red">{st.notAnswered}: {paletteStats.notAnswered}</span>
            <span className="mqp-stat-pill is-purple">{st.marked}: {paletteStats.marked}</span>
            <span className="mqp-stat-pill is-grey">{st.notVisited}: {paletteStats.notVisited}</span>
          </div>

          <div className="mqp-bottom-actions">
            {isLastQuestionReached ? (
              <button
                type="button"
                className="mqp-btn-submit"
                onClick={() => setShowSubmitConfirm(true)}
              >
                {st.submitQuiz}
              </button>
            ) : null}
          </div>
        </div>

        {/* Mobile View: 3-Column Grid as Requested */}
        <div className="mqp-bottom-mobile-container">
          {isLastQuestionReached ? (
            <button
              type="button"
              className="mqp-btn-submit mqp-btn-submit-mobile-top"
              onClick={() => setShowSubmitConfirm(true)}
            >
              {st.submitQuiz}
            </button>
          ) : null}

          <div className="mqp-mobile-grid-bar">
            {/* 1. सभी प्रश्न (Spans full height, no icon) */}
            <button
              type="button"
              className="mqp-mobile-grid-col-all"
              onClick={() => setShowMobilePalette(true)}
            >
              <span>{quizLang === 'hi' ? 'सभी प्रश्न' : 'All Questions'}</span>
            </button>

            {/* 2. Middle Column: उत्तर दिए (Top) & छोड़ा गया (Bottom) */}
            <div className="mqp-mobile-grid-col-mid">
              <div className="mqp-mobile-grid-cell mqp-cell-answered">
                <span>{quizLang === 'hi' ? 'उत्तर दिए' : 'Answered'}</span>
                <strong>{paletteStats.answered}</strong>
              </div>
              <div className="mqp-mobile-grid-cell mqp-cell-skipped">
                <span>{quizLang === 'hi' ? 'छोड़ा गया' : 'Skipped'}</span>
                <strong>{paletteStats.notAnswered}</strong>
              </div>
            </div>

            {/* 3. Right Column: समीक्षा हेतु (Top) & देखा नहीं (Bottom) */}
            <div className="mqp-mobile-grid-col-right">
              <div className="mqp-mobile-grid-cell mqp-cell-review">
                <span>{quizLang === 'hi' ? 'समीक्षा हेतु' : 'Review'}</span>
                <strong>{paletteStats.marked}</strong>
              </div>
              <div className="mqp-mobile-grid-cell mqp-cell-unvisited">
                <span>{quizLang === 'hi' ? 'देखा नहीं' : 'Not Visited'}</span>
                <strong>{paletteStats.notVisited}</strong>
              </div>
            </div>
          </div>
        </div>
      </footer>

      {/* Mobile Palette Bottom Drawer */}
      {showMobilePalette ? (
        <div
          className="mqp-mobile-drawer-backdrop"
          onClick={() => setShowMobilePalette(false)}
        >
          <div className="mqp-mobile-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="mqp-drawer-handle" />
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 16,
              }}
            >
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>
                {st.questionPalette} ({playableQuestions.length})
              </h3>
              <button
                type="button"
                className="mqp-btn-clear"
                onClick={() => setShowMobilePalette(false)}
              >
                {quizLang === 'hi' ? 'बंद करें' : 'Close'}
              </button>
            </div>

            <div className="mqp-palette-grid">
              {playableQuestions.map((q, idx) => {
                const status = getPaletteStatus(idx, q.id)
                const isCurrent = idx === currentIndex
                return (
                  <button
                    key={q.id || idx}
                    type="button"
                    className={`mqp-palette-btn ${status} ${isCurrent ? 'is-current' : ''}`}
                    onClick={() => handleJumpToQuestion(idx)}
                  >
                    {idx + 1}
                  </button>
                )
              })}
            </div>

            <div className="mqp-palette-legend" style={{ marginTop: 20 }}>
              <div className="mqp-legend-item">
                <span className="mqp-legend-box is-answered" />
                <span>{st.answered}</span>
              </div>
              <div className="mqp-legend-item">
                <span className="mqp-legend-box is-not-answered" />
                <span>{st.notAnswered}</span>
              </div>
              <div className="mqp-legend-item">
                <span className="mqp-legend-box is-marked" />
                <span>{st.markedForReview}</span>
              </div>
              <div className="mqp-legend-item">
                <span className="mqp-legend-box is-answered-marked" />
                <span>{st.answered} &amp; {st.marked}</span>
              </div>
              <div className="mqp-legend-item">
                <span className="mqp-legend-box is-not-visited" />
                <span>{st.notVisited}</span>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Confirmation Submit Popup Modal */}
      {showSubmitConfirm ? (
        <div className="mqp-modal-backdrop" role="dialog" aria-modal="true">
          <div className="mqp-modal-card">
            <div className="mqp-modal-icon">
              <AlertCircle size={28} />
            </div>
            <h3 className="mqp-modal-title">{st.submitConfirmTitle}</h3>
            <p className="mqp-modal-desc">
              {st.submitConfirmMsg(paletteStats.answered, playableQuestions.length)}
            </p>

            <div className="mqp-modal-breakdown">
              <div className="mqp-modal-stat">
                <div className="mqp-modal-stat-label">{st.answered}</div>
                <div className="mqp-modal-stat-val" style={{ color: '#059669' }}>
                  {paletteStats.answered}
                </div>
              </div>
              <div className="mqp-modal-stat">
                <div className="mqp-modal-stat-label">{st.notAnswered}</div>
                <div className="mqp-modal-stat-val" style={{ color: '#dc2626' }}>
                  {paletteStats.notAnswered}
                </div>
              </div>
              <div className="mqp-modal-stat">
                <div className="mqp-modal-stat-label">{st.markedForReview}</div>
                <div className="mqp-modal-stat-val" style={{ color: '#7c3aed' }}>
                  {paletteStats.marked}
                </div>
              </div>
              <div className="mqp-modal-stat">
                <div className="mqp-modal-stat-label">{st.notVisited}</div>
                <div className="mqp-modal-stat-val" style={{ color: '#64748b' }}>
                  {paletteStats.notVisited}
                </div>
              </div>
            </div>

            <div className="mqp-modal-actions">
              <button
                type="button"
                className="mqp-btn mqp-btn-secondary"
                onClick={() => setShowSubmitConfirm(false)}
                disabled={submitting}
              >
                {st.goBack}
              </button>
              <button
                type="button"
                className="mqp-btn mqp-btn-primary"
                onClick={handleSubmitQuiz}
                disabled={submitting}
              >
                {submitting ? st.submitting : st.confirmSubmit}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* 5. Report Answer Modal */}
      {reportModalQuestion ? (
        <div className="mqp-modal-backdrop" role="dialog" aria-modal="true" onClick={handleCloseReportModal}>
          <div className="mqp-report-modal" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 8,
                    background: 'rgba(239, 68, 68, 0.12)',
                    color: '#dc2626',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <AlertTriangle size={18} />
                </div>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800 }}>
                  Report Error · प्रश्न #{reportModalQuestion.idx + 1}
                </h3>
              </div>
              <button
                type="button"
                className="mqp-close-start-btn"
                style={{ position: 'static' }}
                onClick={handleCloseReportModal}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            {reportSubmittedSuccess ? (
              <div className="mqp-report-success-box">
                <div
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: '50%',
                    background: '#ecfdf5',
                    color: '#059669',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 12px',
                  }}
                >
                  <Check size={28} />
                </div>
                <h3 style={{ margin: '0 0 8px', color: '#059669', fontSize: '1.2rem', fontWeight: 800 }}>
                  थैंक यू! / Thank You!
                </h3>
                <p style={{ margin: '0 0 16px', color: '#64748b', lineHeight: 1.5 }}>
                  आपकी रिपोर्ट सफलतापूर्वक दर्ज कर ली गई है। हमारी टीम शीघ्र ही इस प्रश्न की समीक्षा करेगी।
                </p>
                <button
                  type="button"
                  className="mqp-btn mqp-btn-primary"
                  style={{ margin: '0 auto' }}
                  onClick={handleCloseReportModal}
                >
                  बंद करें (Close)
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmitReport}>
                <p style={{ fontSize: '0.92rem', fontWeight: 600, margin: '0 0 10px', lineHeight: 1.45 }}>
                  आपको क्यों लगता है कि इस प्रश्न/उत्तर में कोई त्रुटि है? कृपया विवरण / संलग्नक उपलब्ध कराएं:
                </p>

                <textarea
                  className="mqp-report-textarea"
                  value={reportDescription}
                  onChange={(e) => setReportDescription(e.target.value)}
                  placeholder="यहाँ त्रुटि का विवरण विस्तार से लिखें..."
                  rows={4}
                />

                <div className="mqp-report-upload-box">
                  <label style={{ fontSize: '0.84rem', fontWeight: 600, color: '#64748b' }}>
                    संलग्नक (छवि या पीडीएफ - अधिकतम 10MB):
                  </label>
                  <label className="mqp-report-file-btn">
                    <Upload size={15} />
                    <span>{reportAttachment ? reportAttachment.name : 'फ़ाइल चुनें (Image / PDF)'}</span>
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={handleReportFileChange}
                      style={{ display: 'none' }}
                    />
                  </label>
                  {reportAttachment ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: '#059669' }}>
                      <FileText size={14} />
                      <span>{reportAttachment.name} संलग्न है</span>
                      <button
                        type="button"
                        onClick={() => setReportAttachment(null)}
                        style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', padding: 0 }}
                      >
                        (हटाएं)
                      </button>
                    </div>
                  ) : null}
                </div>

                {reportError ? (
                  <p style={{ color: '#dc2626', fontSize: '0.82rem', margin: '8px 0 0' }}>
                    {reportError}
                  </p>
                ) : null}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
                  <button
                    type="button"
                    className="mqp-btn mqp-btn-secondary"
                    onClick={handleCloseReportModal}
                    disabled={reportSubmitting}
                  >
                    रद्द करें (Cancel)
                  </button>
                  <button
                    type="submit"
                    className="mqp-btn mqp-btn-primary"
                    disabled={reportSubmitting}
                  >
                    {reportSubmitting ? 'सबमिट हो रहा है...' : 'सबमिट करें (Submit)'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      ) : null}
      {/* Semi-visible Floating Ball in Landscape Mobile */}
      {isLandscapeMobile ? (
        <button
          type="button"
          className={`mqp-landscape-toggle-ball ${landscapeBarsVisible ? 'is-active' : ''}`}
          onClick={() => setLandscapeBarsVisible((prev) => !prev)}
          title={landscapeBarsVisible ? 'नेविगेशन बार छिपाएं (Hide Bars)' : 'नेविगेशन बार दिखाएं (Show Bars)'}
          aria-label={landscapeBarsVisible ? 'Hide quiz navigation bars' : 'Show quiz navigation bars'}
        >
          <div className="mqp-ball-inner">
            {landscapeBarsVisible ? <X size={18} /> : <Menu size={18} />}
          </div>
          <span className="mqp-ball-pulse-ring" />
        </button>
      ) : null}
    </div>
  )
}
