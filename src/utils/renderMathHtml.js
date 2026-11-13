import katex from 'katex'
import 'katex/dist/katex.min.css'

export function sanitizeBasicHtml(html) {
  if (!html) return ''
  return String(html)
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, '')
    .replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/javascript:/gi, '')
}

export function renderLatexPreview(expression, displayMode = false) {
  const expr = String(expression || '').trim()
  if (!expr) return ''
  return katex.renderToString(expr, {
    displayMode,
    throwOnError: false,
    strict: false,
  })
}

export function renderMathInHtml(rawHtml) {
  const safe = sanitizeBasicHtml(rawHtml)
  if (!safe) return ''

  // First replace explicit block math $$...$$, avoiding already rendered KaTeX spans.
  const withDisplayMath = safe.replace(/\$\$([\s\S]+?)\$\$/g, (_, expr) => {
    const cleanExpr = expr.replace(/<[^>]+>/g, '').trim()
    if (!cleanExpr) return ''
    return `<div class="katex-block">${renderLatexPreview(cleanExpr, true)}</div>`
  })

  // Then replace inline math $...$ when not preceded/followed by another $.
  return withDisplayMath.replace(/(?<!\$)\$(?!\$)([^$\n<>]+?)(?<!\$)\$(?!\$)/g, (_, expr) => {
    const cleanExpr = expr.trim()
    if (!cleanExpr) return ''
    return renderLatexPreview(cleanExpr, false)
  })
}
