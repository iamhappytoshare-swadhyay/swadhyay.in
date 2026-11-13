/**
 * Parses bulk-pasted Hindi/English quiz questions into separate question objects.
 * Supports:
 * - Question prefixes: "प्रश्न 1:", "प्र 1:", "Q1.", "Q1:"
 * - Option prefixes: A), B), C), D), A., B., C., D., 1., 2., 3., 4.
 * - Answer prefixes: "सही उत्तर:", "सही:", "Correct Answer:", "Correct:"
 * - Explanation prefixes: "व्याख्या:", "स्पष्टीकरण:", "Explanation:"
 */
export function parseBulkQuestionsText(rawText) {
  const trimmed = String(rawText || '').replace(/\r\n/g, '\n').trim()
  if (!trimmed) {
    return { added: [], empty: true }
  }

  const blocks = trimmed
    .split(/\n(?=\s*(?:प्रश्न|प्र\s*\d+|Q\d+)\s*\d*[:.]?)/i)
    .map((b) => b.trim())
    .filter(Boolean)

  const added = []

  for (const block of blocks) {
    const lines = block
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)

    let qText = ''
    const options = []
    let correctOpt = 0
    let explanation = ''

    for (const line of lines) {
      if (/^(?:प्रश्न|प्र\s*\d+|Q\d+)\s*\d*\s*[:.)-]\s*/i.test(line) || /^(?:प्रश्न|प्र\s*\d+|Q\d+)\s*\d*\s+/i.test(line)) {
        qText = line
          .replace(/^(?:प्रश्न\s*\d*|प्र\s*\d+|Q\s*\d+)\s*[:.)-]?\s*/i, '')
          .trim()
      } else if (/^(?:[A-D][).]|[1-4][.)])\s*/i.test(line)) {
        const optText = line.replace(/^(?:[A-D][).]|[1-4][.)])\s*/i, '').trim()
        if (optText) options.push(optText)
      } else if (/^(?:सही\s*उत्तर|सही|Correct\s*Answer|Correct)\s*:/i.test(line)) {
        const correctStr = line
          .replace(/^(?:सही\s*उत्तर|सही|Correct\s*Answer|Correct)\s*:\s*/i, '')
          .trim()

        if (correctStr) {
          const letterMatch = correctStr.match(/^([A-D])(?:\)|\.|:|\s|$)/i)
          // Only treat leading A-D as option letter if it's a standalone label (e.g. "A", "B)", "C.")
          // and NOT a full word like "Delhi" or "Chennai".
          const isStandaloneLetter =
            letterMatch && (correctStr.length === 1 || /^([A-D])[).:\s]/i.test(correctStr))

          if (isStandaloneLetter) {
            correctOpt = letterMatch[1].toUpperCase().charCodeAt(0) - 65
          } else {
            const lower = correctStr.toLowerCase()
            const exactIdx = options.findIndex((o) => o.toLowerCase() === lower)
            if (exactIdx !== -1) {
              correctOpt = exactIdx
            } else {
              const containsIdx = options.findIndex((o) => o.toLowerCase().includes(lower))
              if (containsIdx !== -1) {
                correctOpt = containsIdx
              }
            }
          }
        }
      } else if (/^(?:व्याख्या|स्पष्टीकरण|Explanation)\s*:/i.test(line)) {
        explanation = line
          .replace(/^(?:व्याख्या|स्पष्टीकरण|Explanation)\s*:\s*/i, '')
          .trim()
      } else if (!qText) {
        qText = line
      } else if (options.length < 4) {
        options.push(line)
      }
    }

    if (qText && options.length >= 2) {
      const safeIndex =
        correctOpt >= 0 && correctOpt < options.length ? correctOpt : 0
      added.push({
        question: qText,
        options,
        correctOptionIndex: safeIndex,
        explanation: explanation || 'Explanation not available.',
      })
    }
  }

  return { added, empty: false }
}
