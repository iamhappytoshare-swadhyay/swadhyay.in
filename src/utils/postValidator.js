const VOID_TAGS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
])

const UNSUPPORTED_TAGS = new Set(['applet', 'frameset', 'frame', 'marquee', 'blink', 'bgsound'])

/**
 * Validates HTML and CSS authored in the Admin CMS before publishing.
 * Returns an array of { level: 'error' | 'warning' | 'info', message: string }.
 */
export function validatePostCode(rawHtml = '', rawCss = '') {
  const issues = []
  const html = String(rawHtml || '')
  const css = String(rawCss || '')

  // 1. Check HTML tags (ignoring comments, <script>...</script>, <style>...</style>)
  const strippedHtml = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '<script></script>')
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, '<style></style>')

  const tagRegex = /<\/?([a-zA-Z][a-zA-Z0-9-]*)(?:\s[^<>]*)?\/?>/g
  const stack = []
  const flaggedUnsupported = new Set()
  let match

  while ((match = tagRegex.exec(strippedHtml)) !== null) {
    const fullTag = match[0]
    const tagName = match[1].toLowerCase()
    const isClosing = fullTag.startsWith('</')
    const isSelfClosing = fullTag.endsWith('/>') || VOID_TAGS.has(tagName)

    if (UNSUPPORTED_TAGS.has(tagName) && !flaggedUnsupported.has(tagName)) {
      flaggedUnsupported.add(tagName)
      issues.push({
        level: 'warning',
        message: `Unsupported or deprecated tag <${tagName}> detected. Replace it with modern HTML/CSS.`,
      })
    }

    if (isSelfClosing) continue

    if (!isClosing) {
      stack.push(tagName)
    } else {
      if (stack.length === 0) {
        issues.push({
          level: 'error',
          message: `Unexpected closing tag </${tagName}> with no matching opening tag.`,
        })
      } else {
        const top = stack[stack.length - 1]
        if (top === tagName) {
          stack.pop()
        } else {
          const foundIdx = stack.lastIndexOf(tagName)
          if (foundIdx === -1) {
            issues.push({
              level: 'error',
              message: `Mismatched closing tag </${tagName}> (expected </${top}>).`,
            })
          } else {
            const unclosed = stack.slice(foundIdx + 1)
            issues.push({
              level: 'warning',
              message: `Unclosed tag(s) before </${tagName}>: ${unclosed.map((t) => `<${t}>`).join(', ')}.`,
            })
            stack.length = foundIdx
          }
        }
      }
    }
  }

  if (stack.length > 0) {
    issues.push({
      level: 'warning',
      message: `Unclosed HTML tag(s): ${stack.map((t) => `<${t}>`).join(', ')}.`,
    })
  }

  // Check unclosed <script> or <style>
  const scriptOpens = (html.match(/<script\b/gi) || []).length
  const scriptCloses = (html.match(/<\/script>/gi) || []).length
  if (scriptOpens !== scriptCloses) {
    issues.push({
      level: 'error',
      message: 'Unclosed <script> tag detected. Make sure every <script> has a matching </script>.',
    })
  }

  const styleOpens = (html.match(/<style\b/gi) || []).length
  const styleCloses = (html.match(/<\/style>/gi) || []).length
  if (styleOpens !== styleCloses) {
    issues.push({
      level: 'error',
      message: 'Unclosed <style> tag detected. Make sure every <style> has a matching </style>.',
    })
  }

  // 2. Validate CSS (both Post Custom CSS and inline <style> blocks)
  const inlineStyles = []
  const styleBlockRe = /<style[^>]*>([\s\S]*?)<\/style>/gi
  let styleMatch
  while ((styleMatch = styleBlockRe.exec(html)) !== null) {
    inlineStyles.push(styleMatch[1])
  }
  const combinedCss = [css, ...inlineStyles].filter(Boolean).join('\n')

  if (combinedCss.trim()) {
    // Check unclosed CSS comments
    const commentOpens = (combinedCss.match(/\/\*/g) || []).length
    const commentCloses = (combinedCss.match(/\*\//g) || []).length
    if (commentOpens > commentCloses) {
      issues.push({
        level: 'error',
        message: 'Unclosed CSS comment (/* without matching */) detected.',
      })
    }

    // Strip comments & strings before brace counting
    const cleanCss = combinedCss
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g, '""')
    let depth = 0
    for (let i = 0; i < cleanCss.length; i += 1) {
      if (cleanCss[i] === '{') depth += 1
      else if (cleanCss[i] === '}') depth -= 1
      if (depth < 0) {
        issues.push({
          level: 'error',
          message: 'Extra closing brace "}" found in CSS.',
        })
        break
      }
    }
    if (depth > 0) {
      issues.push({
        level: 'error',
        message: `Missing ${depth} closing brace(s) "}" in CSS.`,
      })
    }

    if (/body\s*\{[^}]*overflow\s*:\s*hidden/i.test(cleanCss)) {
      issues.push({
        level: 'info',
        message: 'CSS sets "body { overflow: hidden }" — inside the post frame this may clip long content.',
      })
    }
  }

  // 3. Security check: warn if Firebase config / API keys / secret tokens are pasted inside Post HTML
  if (/AIza[0-9A-Za-z_-]{25,}|firebaseConfig\s*=|["']?apiKey["']?\s*:\s*["'][^"']+["']|-----BEGIN PRIVATE KEY-----/i.test(html)) {
    issues.push({
      level: 'error',
      message:
        'Security warning: Do NOT paste Firebase config, apiKey, or secret keys inside Post HTML.',
    })
  }

  return issues
}

export function postNeedsUniversalFrame(html = '', customCss = '', interactiveTool = false) {
  if (interactiveTool) return true
  if (String(customCss || '').trim()) return true
  const raw = String(html || '')
  return (
    /<(style|script|form|input|select|textarea|button|iframe)\b/i.test(raw) ||
    /\son[a-z]+\s*=/i.test(raw)
  )
}
