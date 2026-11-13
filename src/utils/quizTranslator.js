/**
 * quizTranslator.js
 * Dynamic bilingual translation utility for Swadhyay Quiz Player.
 * Translates questions, options, explanations, and quiz metadata between Hindi and English.
 * Supports native bilingual fields (questionEn, optionsEn, etc.), in-memory & sessionStorage caching,
 * batch delimiter bundling, and concurrent pool execution.
 */

const DELIMITER = ' ||| '
const memoryCache = new Map()

/**
 * Decode common HTML entities that translation endpoints might return
 */
export function decodeHtmlEntities(str) {
  if (!str) return ''
  if (typeof document !== 'undefined') {
    const el = document.createElement('textarea')
    el.innerHTML = str
    return el.value
  }
  return str
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
}

/**
 * Translate a single string via MyMemory API
 */
export async function translateSingleText(text, from = 'hi', to = 'en') {
  if (!text || typeof text !== 'string' || !text.trim()) {
    return text || ''
  }

  const cacheKey = `${from}_${to}_${text.trim()}`
  if (memoryCache.has(cacheKey)) {
    return memoryCache.get(cacheKey)
  }

  try {
    const encoded = encodeURIComponent(text.trim())
    const url = `https://api.mymemory.translated.net/get?q=${encoded}&langpair=${from}|${to}&de=swadhyay@swadhyay.app`
    const res = await fetch(url)
    if (!res.ok) {
      throw new Error(`Translation HTTP error: ${res.status}`)
    }
    const data = await res.json()
    if (data?.responseData?.translatedText) {
      const translated = decodeHtmlEntities(data.responseData.translatedText)
      memoryCache.set(cacheKey, translated)
      return translated
    }
  } catch (err) {
    console.warn('[quizTranslator] Translation error:', err.message)
  }

  return text
}

/**
 * Translate an array of options in a single API call using delimiter bundling
 */
export async function translateOptionsArray(options, from = 'hi', to = 'en') {
  if (!Array.isArray(options) || options.length === 0) return options || []

  // Check if all options are numbers or symbols or already in English
  const joined = options.map((opt) => (opt != null ? String(opt).trim() : '')).join(DELIMITER)
  const cacheKey = `${from}_${to}_opts_${joined}`

  if (memoryCache.has(cacheKey)) {
    return memoryCache.get(cacheKey)
  }

  try {
    const translatedJoined = await translateSingleText(joined, from, to)
    const split = translatedJoined.split(/\s*\|\|\|\s*/)

    if (split.length === options.length) {
      const cleanSplit = split.map((s) => decodeHtmlEntities(s.trim()))
      memoryCache.set(cacheKey, cleanSplit)
      return cleanSplit
    }
  } catch (err) {
    console.warn('[quizTranslator] Options translation fallback:', err)
  }

  // Fallback: translate individually
  const individualResults = await Promise.all(
    options.map((opt) => translateSingleText(opt, from, to)),
  )
  memoryCache.set(cacheKey, individualResults)
  return individualResults
}

/**
 * Concurrency helper for running tasks with a concurrency limit
 */
async function runWithConcurrency(tasks, limit = 3, onProgress) {
  let completed = 0
  const results = new Array(tasks.length)
  let currentIndex = 0

  async function worker() {
    while (currentIndex < tasks.length) {
      const idx = currentIndex++
      try {
        results[idx] = await tasks[idx]()
      } catch (e) {
        console.warn(`Task ${idx} failed:`, e)
      } finally {
        completed += 1
        onProgress?.(completed, tasks.length)
      }
    }
  }

  const pool = Array.from({ length: Math.min(limit, tasks.length) }, () => worker())
  await Promise.all(pool)
  return results
}

/**
 * Translate full quiz content: title, instructions, questions, options, and explanations.
 * Reads existing native fields (e.g. questionEn, optionsEn, explanationEn) first,
 * then checks cache, and dynamically translates missing items.
 */
export async function translateQuizContent(
  quiz,
  questions,
  fromLang = 'hi',
  toLang = 'en',
  onProgress,
) {
  const quizId = quiz?.id || 'quiz'
  const storageKey = `swadhyay_tr_${quizId}_${toLang}`

  // 1. Check browser sessionStorage cache
  try {
    const cachedJson = sessionStorage.getItem(storageKey)
    if (cachedJson) {
      const parsed = JSON.parse(cachedJson)
      if (parsed && parsed.questionsMap) {
        onProgress?.(questions.length + 1, questions.length + 1)
        return parsed
      }
    }
  } catch {
    // sessionStorage disabled/full
  }

  const result = {
    quizTitle: '',
    instructions: '',
    questionsMap: {}, // [qId]: { questionText, options, explanation }
  }

  const tasks = []

  // Task 0: Quiz Title
  tasks.push(async () => {
    if (toLang === 'en' && (quiz?.titleEn || quiz?.title_en)) {
      result.quizTitle = quiz.titleEn || quiz.title_en
    } else if (toLang === 'hi' && (quiz?.titleHi || quiz?.title_hi)) {
      result.quizTitle = quiz.titleHi || quiz.title_hi
    } else if (quiz?.title) {
      result.quizTitle = await translateSingleText(quiz.title, fromLang, toLang)
    }
  })

  // Task for each question
  questions.forEach((q) => {
    tasks.push(async () => {
      const qId = q.id
      let finalQuestionText = q.questionText || q.question || ''
      let finalOptions = Array.isArray(q.options) ? [...q.options] : []
      let finalExplanation = q.explanation || ''

      // Check native fields if target is English
      if (toLang === 'en') {
        const nativeQ = q.questionTextEn || q.questionEn || q.question_en
        const nativeOpts = q.optionsEn || q.options_en
        const nativeExpl = q.explanationEn || q.explanation_en

        if (nativeQ) finalQuestionText = nativeQ
        else if (finalQuestionText) {
          finalQuestionText = await translateSingleText(finalQuestionText, fromLang, toLang)
        }

        if (Array.isArray(nativeOpts) && nativeOpts.length === finalOptions.length) {
          finalOptions = nativeOpts
        } else if (finalOptions.length > 0) {
          finalOptions = await translateOptionsArray(finalOptions, fromLang, toLang)
        }

        if (nativeExpl) finalExplanation = nativeExpl
        else if (finalExplanation) {
          finalExplanation = await translateSingleText(finalExplanation, fromLang, toLang)
        }
      } else if (toLang === 'hi') {
        // Target is Hindi
        const nativeQ = q.questionTextHi || q.questionHi || q.question_hi
        const nativeOpts = q.optionsHi || q.options_hi
        const nativeExpl = q.explanationHi || q.explanation_hi

        if (nativeQ) finalQuestionText = nativeQ
        else if (finalQuestionText) {
          finalQuestionText = await translateSingleText(finalQuestionText, fromLang, toLang)
        }

        if (Array.isArray(nativeOpts) && nativeOpts.length === finalOptions.length) {
          finalOptions = nativeOpts
        } else if (finalOptions.length > 0) {
          finalOptions = await translateOptionsArray(finalOptions, fromLang, toLang)
        }

        if (nativeExpl) finalExplanation = nativeExpl
        else if (finalExplanation) {
          finalExplanation = await translateSingleText(finalExplanation, fromLang, toLang)
        }
      }

      result.questionsMap[qId] = {
        questionText: finalQuestionText,
        options: finalOptions,
        explanation: finalExplanation,
      }
    })
  })

  // Run all tasks with concurrency pool of 4
  await runWithConcurrency(tasks, 4, onProgress)

  // Cache in sessionStorage
  try {
    sessionStorage.setItem(storageKey, JSON.stringify(result))
  } catch {
    // quota exceeded or private mode
  }

  return result
}
