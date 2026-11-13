/**
 * Advanced Multi-Choice Bulk Quiz Parser
 *
 * Rules:
 * 1. Question Start: Begins with 'प्रश्न' (e.g. 'प्रश्न 1:', 'प्रश्न 1.', 'प्रश्न 1-', 'प्रश्न:', 'प्रश्न')
 *    All lines before option (a) belong to the question (multi-line statements, lists, tables).
 * 2. Capital Letters: Capital letters (A., B., C., D. / A-iii, B-iv) are parts of question lists/statements, NOT options!
 * 3. Options: Start ONLY with lowercase letters: '(a)', '(b)', '(c)', '(d)' (or 'a)', 'b)')
 *    or Hindi bracket options: '(अ)', '(ब)', '(स)', '(द)' / '(क)', '(ख)', '(ग)', '(घ)'.
 *    Supports multiple options on single line: e.g. '(a) ... (b) ...'
 * 4. Correct Option: Preceded by 'उत्तर' (e.g. 'उत्तर: (a)', 'उत्तर - (b)', 'उत्तर: a', 'उत्तर: [option text]')
 * 5. Explanation: Preceded by 'व्याख्या' (e.g. 'व्याख्या:', 'व्याख्या -', with full multi-line explanation support)
 */

// Matches ONLY lowercase (a), (b), (c), (d), (e) or a), b), c), d), e)
// Or Hindi bracketed options: (अ), (ब), (स), (द), (क), (ख), (ग), (घ)
// Capital letters (A., B., C., D.) are deliberately EXCLUDED as they belong to question lists/statements!
const OPTION_TOKEN_RE = /(?:^|\s+)((?:\([a-e\u0905-\u0939]\)|[a-e][)]))\s*/g

export function extractOptionsFromLine(line) {
  const matches = [...line.matchAll(OPTION_TOKEN_RE)]
  if (matches.length === 0) return null
  // Make sure first option token appears at or near the beginning of the line
  if (matches[0].index > 6) return null

  const results = []
  for (let i = 0; i < matches.length; i++) {
    const marker = matches[i][1]
    const startIndex = matches[i].index + matches[i][0].length
    const endIndex = i + 1 < matches.length ? matches[i + 1].index : line.length
    const text = line
      .substring(startIndex, endIndex)
      .trim()
      .replace(/^[;,.]\s*|[;,.]\s*$/g, '')
    results.push({ marker, text })
  }
  return results
}

export function stripQuestionPrefix(str) {
  return str
    .replace(/^\s*(?:प्रश्न|प्र|Question|Q)\s*[:.)-]?\s*[\d०-९]*\s*[:.)-]?\s*/i, '')
    .trim()
}

export function stripAnswerPrefix(str) {
  return str
    .replace(/^\s*(?:सही\s*उत्तर|उत्तर|Correct\s*Answer|Answer|Ans)\s*[:.)-]?\s*/i, '')
    .trim()
}

export function stripExplanationPrefix(str) {
  return str
    .replace(/^\s*(?:व्याख्या|स्पष्टीकरण|Explanation|Explain|Exp)\s*[:.)-]?\s*/i, '')
    .trim()
}

export function resolveCorrectOption(answerStr, options) {
  const clean = String(answerStr || '').trim()
  if (!clean || options.length === 0) return 0

  // 1. Bracket letter (a), (b), (c), (d)
  const bracketLetter = clean.match(/\(\s*([a-dA-D])\s*\)/i)
  if (bracketLetter) {
    const code = bracketLetter[1].toLowerCase().charCodeAt(0) - 97
    if (code >= 0 && code < options.length) return code
  }

  // 2. Hindi bracket (अ), (ब), (स), (द), (क), (ख), (ग), (घ)
  const hindiBracket = clean.match(/\(\s*([अबसदनकखगघ])\s*\)/)
  if (hindiBracket) {
    const char = hindiBracket[1]
    const hindiMap = { 'अ': 0, 'क': 0, 'ब': 1, 'ख': 1, 'स': 2, 'ग': 2, 'द': 3, 'घ': 3 }
    if (char in hindiMap && hindiMap[char] < options.length) return hindiMap[char]
  }

  // 3. "विकल्प (a)" or "विकल्प a"
  const vikalpMatch = clean.match(/विकल्प\s*(?:\(?\s*([a-dA-Dअबसदनकखगघ1-4])\s*\)?)/i)
  if (vikalpMatch) {
    const v = vikalpMatch[1].toLowerCase()
    if (v >= 'a' && v <= 'd') {
      const idx = v.charCodeAt(0) - 97
      if (idx < options.length) return idx
    }
    const hindiMap = { 'अ': 0, 'क': 0, 'ब': 1, 'ख': 1, 'स': 2, 'ग': 2, 'द': 3, 'घ': 3 }
    if (v in hindiMap && hindiMap[v] < options.length) return hindiMap[v]
    const n = parseInt(v, 10)
    if (!isNaN(n) && n >= 1 && n <= options.length) return n - 1
  }

  // 4. Standalone leading letter: e.g. "a", "A", "b)", "C."
  const leadingLetter = clean.match(/^([a-dA-D])(?:\s*[:.)-]|\s+|$)/i)
  if (leadingLetter) {
    const code = leadingLetter[1].toLowerCase().charCodeAt(0) - 97
    if (code >= 0 && code < options.length) return code
  }

  // 5. Standalone Hindi char: e.g. "अ", "ब"
  const leadingHindi = clean.match(/^([अबसदनकखगघ])(?:\s*[:.)-]|\s+|$)/)
  if (leadingHindi) {
    const char = leadingHindi[1]
    const hindiMap = { 'अ': 0, 'क': 0, 'ब': 1, 'ख': 1, 'स': 2, 'ग': 2, 'द': 3, 'घ': 3 }
    if (char in hindiMap && hindiMap[char] < options.length) return hindiMap[char]
  }

  // 6. Number 1, 2, 3, 4
  const digitMatch = clean.match(/(?:^|\(?)([1-4])(?:\)?|\.|$)/)
  if (digitMatch) {
    const num = parseInt(digitMatch[1], 10) - 1
    if (num >= 0 && num < options.length) return num
  }

  // 7. Match against exact option text (case insensitive)
  const lowerClean = clean.toLowerCase()
  const exactIdx = options.findIndex((opt) => opt.toLowerCase() === lowerClean)
  if (exactIdx !== -1) return exactIdx

  // 8. Containment match (e.g. if option is "A-iii, B-iv..." and answer is "A-iii, B-iv...")
  const containsIdx = options.findIndex((opt) => {
    const oLower = opt.toLowerCase()
    return oLower.includes(lowerClean) || lowerClean.includes(oLower)
  })
  if (containsIdx !== -1) return containsIdx

  return 0
}

export function parseBulkQuestionsText(rawText) {
  const trimmed = String(rawText || '').replace(/\r\n/g, '\n').trim()
  if (!trimmed) {
    return { added: [], empty: true }
  }

  const lines = trimmed.split('\n')
  const questions = []
  let curQ = null
  let state = 'NONE' // 'QUESTION', 'OPTIONS', 'ANSWER', 'EXPLANATION'

  function finalizeCurrent() {
    if (!curQ) return
    const qText = curQ.questionLines.join('\n').trim()
    const opts = curQ.options.map((o) => o.trim()).filter(Boolean)
    if (qText && opts.length >= 2) {
      const correctIdx = resolveCorrectOption(curQ.answerRaw, opts)
      const explanationText = curQ.explanationLines.join('\n').trim()
      questions.push({
        question: qText,
        options: opts,
        correctOptionIndex: correctIdx,
        explanation: explanationText || 'व्याख्या उपलब्ध नहीं है।',
      })
    }
    curQ = null
    state = 'NONE'
  }

  for (let rawLine of lines) {
    const line = rawLine.trim()
    if (!line) continue

    // 1. Is this a new question start?
    const isNewQuestion = /^\s*(?:प्रश्न\b|प्रश्न\s*[\d०-९]|प्र\s*[\d०-९]+|Q\s*[\d०-९]+|Q\b)/i.test(line)

    if (isNewQuestion) {
      finalizeCurrent()
      curQ = {
        questionLines: [],
        options: [],
        answerRaw: '',
        explanationLines: [],
      }
      const cleanQ = stripQuestionPrefix(line)
      if (cleanQ) curQ.questionLines.push(cleanQ)
      state = 'QUESTION'
      continue
    }

    if (!curQ) {
      curQ = {
        questionLines: [line],
        options: [],
        answerRaw: '',
        explanationLines: [],
      }
      state = 'QUESTION'
      continue
    }

    // 2. Is this an Answer line?
    const isAnswer = /^\s*(?:सही\s*उत्तर|उत्तर|Correct\s*Answer|Answer|Ans)\s*[:.)-]?\s*/i.test(line)
    if (isAnswer) {
      state = 'ANSWER'
      curQ.answerRaw = stripAnswerPrefix(line)
      continue
    }

    // 3. Is this an Explanation line?
    const isExplanation = /^\s*(?:व्याख्या|स्पष्टीकरण|Explanation|Explain|Exp)\s*[:.)-]?\s*/i.test(line)
    if (isExplanation) {
      state = 'EXPLANATION'
      const cleanExp = stripExplanationPrefix(line)
      if (cleanExp) curQ.explanationLines.push(cleanExp)
      continue
    }

    // 4. Is this an Option line (or contains options)?
    // Only lowercase (a), (b), (c), (d) or (अ), (ब)... are parsed as options!
    if (state === 'QUESTION' || state === 'OPTIONS') {
      const extractedOpts = extractOptionsFromLine(line)
      if (extractedOpts && extractedOpts.length > 0) {
        state = 'OPTIONS'
        for (const opt of extractedOpts) {
          curQ.options.push(opt.text)
        }
        continue
      }
    }

    // 5. Continuation lines based on state
    if (state === 'QUESTION') {
      curQ.questionLines.push(line)
    } else if (state === 'OPTIONS') {
      if (curQ.options.length > 0) {
        curQ.options[curQ.options.length - 1] += ' ' + line
      }
    } else if (state === 'EXPLANATION') {
      curQ.explanationLines.push(line)
    } else if (state === 'ANSWER') {
      if (!curQ.answerRaw) {
        curQ.answerRaw = line
      } else {
        curQ.answerRaw += ' ' + line
      }
    }
  }

  finalizeCurrent()
  return { added: questions, empty: questions.length === 0 }
}
