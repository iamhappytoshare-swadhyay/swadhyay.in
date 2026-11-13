import { useEffect, useId, useMemo, useRef, useState } from 'react'
import katex from 'katex'
import { renderMathInHtml } from '../utils/renderMathHtml.js'
import { postNeedsUniversalFrame } from '../utils/postValidator.js'

const BASE_POST_CSS = `
*, *::before, *::after {
  box-sizing: border-box;
}
html {
  margin: 0;
  padding: 0;
  width: 100%;
  max-width: 100%;
  height: auto !important;
  min-height: 0 !important;
  overflow-x: hidden;
  overflow-y: visible;
}
body {
  margin: 0;
  padding: 0;
  width: 100%;
  max-width: 100%;
  height: auto !important;
  min-height: 0 !important;
  overflow-x: hidden;
  overflow-y: visible;
  font-family: "Inter", "Noto Sans Devanagari", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  font-size: 16px;
  line-height: 1.72;
  color: #1f2937;
  background: transparent;
  -webkit-font-smoothing: antialiased;
  overflow-wrap: break-word;
  word-wrap: break-word;
}
.sw-post-root {
  width: 100%;
  max-width: 100%;
  padding: 2px 2px 12px;
}
h1, h2, h3, h4, h5, h6 {
  color: #111827;
  font-weight: 700;
  line-height: 1.3;
  margin: 1.25em 0 0.55em;
}
h1 { font-size: clamp(1.5rem, 3vw, 2rem); }
h2 { font-size: clamp(1.28rem, 2.4vw, 1.55rem); }
h3 { font-size: clamp(1.1rem, 2vw, 1.28rem); }
p {
  margin: 0 0 1em;
}
a {
  color: #dc2626;
  text-decoration: underline;
  text-underline-offset: 2px;
}
a:hover {
  color: #b91c1c;
}
ul, ol {
  margin: 0 0 1.1em;
  padding-left: 1.45em;
}
li {
  margin-bottom: 0.35em;
}
img, video, svg {
  max-width: 100%;
  height: auto;
  border-radius: 8px;
}
blockquote {
  margin: 1.1em 0;
  padding: 12px 16px;
  border-left: 4px solid #dc2626;
  background: #fef2f2;
  color: #374151;
  border-radius: 0 8px 8px 0;
}
pre {
  background: #0f172a;
  color: #f8fafc;
  padding: 14px 16px;
  border-radius: 10px;
  overflow-x: auto;
  font-size: 0.9rem;
  line-height: 1.55;
  margin: 1em 0;
}
code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.9em;
  background: #f3f4f6;
  padding: 2px 6px;
  border-radius: 5px;
}
pre code {
  background: transparent;
  padding: 0;
}
hr {
  border: none;
  border-top: 1px solid #e5e7eb;
  margin: 1.4em 0;
}
.sw-table-scroll {
  width: 100%;
  max-width: 100%;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  margin: 1.1em 0;
  border-radius: 10px;
  border: 1px solid #e5e7eb;
}
.sw-table-scroll > table,
table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.94rem;
}
th, td {
  border: 1px solid #e5e7eb;
  padding: 10px 12px;
  text-align: left;
  vertical-align: top;
}
th {
  background: #f9fafb;
  font-weight: 600;
  color: #111827;
}
tr:nth-child(even) td {
  background: #fcfcfd;
}
form {
  margin: 1.1em 0;
  max-width: 100%;
}
label {
  display: block;
  font-weight: 600;
  color: #374151;
  font-size: 0.92rem;
  margin-bottom: 6px;
}
input, select, textarea, button {
  font: inherit;
  max-width: 100%;
}
:where(input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="color"]),
select,
button,
input[type="submit"],
input[type="button"]) {
  min-height: 42px;
  line-height: 1.3;
  vertical-align: middle;
}
:where(input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="color"]):not([type="submit"]):not([type="button"]),
select,
textarea) {
  width: 100%;
  padding: 9px 12px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  background: #ffffff;
  color: #111827;
  margin-bottom: 12px;
}
:where(input, select, textarea):focus {
  outline: 2px solid rgba(220, 38, 38, 0.25);
  border-color: #dc2626;
}
:where(button, input[type="button"]) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 9px 18px;
  border-radius: 8px;
  border: 1px solid #d1d5db;
  background: #f3f4f6;
  color: #111827;
  font-weight: 600;
  cursor: pointer;
}
:where(button, input[type="button"]):hover {
  background: #e5e7eb;
}
:where(button[type="submit"], input[type="submit"]) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 9px 18px;
  border-radius: 8px;
  border: 1px solid #dc2626;
  background: #dc2626;
  color: #ffffff;
  font-weight: 600;
  cursor: pointer;
}
:where(button[type="submit"], input[type="submit"]):hover {
  background: #b91c1c;
}
.cms-video-embed {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 9;
  margin: 14px 0;
  border-radius: 10px;
  overflow: hidden;
  background: #0f172a;
}
.cms-video-embed iframe, .cms-video-embed video {
  width: 100%;
  height: 100%;
  border: 0;
}
.katex-block {
  overflow-x: auto;
  padding: 6px 0;
}
@media (max-width: 640px) {
  html, body {
    font-size: 15px;
  }
  th, td {
    padding: 8px 10px;
    font-size: 0.88rem;
  }
}
`

function renderMathSafelyOutsideCode(rawHtml) {
  const html = String(rawHtml || '')
  if (!html || !html.includes('$')) return { html, hasMath: false }

  let hasMath = false
  const parts = html.split(/(<(?:script|style|pre|code)\b[^>]*>[\s\S]*?<\/(?:script|style|pre|code)>)/gi)

  const transformed = parts
    .map((part, idx) => {
      if (idx % 2 === 1) return part
      const withDisplay = part.replace(/\$\$([\s\S]+?)\$\$/g, (_, expr) => {
        const cleanExpr = expr.replace(/<[^>]+>/g, '').trim()
        if (!cleanExpr) return ''
        hasMath = true
        return `<div class="katex-block">${katex.renderToString(cleanExpr, {
          displayMode: true,
          throwOnError: false,
          strict: false,
        })}</div>`
      })
      return withDisplay.replace(/(?<!\$)\$(?!\$)([^$\n<>]+?)(?<!\$)\$(?!\$)/g, (_, expr) => {
        const cleanExpr = expr.trim()
        if (!cleanExpr) return ''
        hasMath = true
        return katex.renderToString(cleanExpr, {
          displayMode: false,
          throwOnError: false,
          strict: false,
        })
      })
    })
    .join('')

  return { html: transformed, hasMath }
}

function buildAutoResizeScript(frameId) {
  return `
<script>
(function() {
  var FRAME_ID = ${JSON.stringify(frameId)};
  var lastSentHeight = 0;
  var lastSentWidth = window.innerWidth;

  function wrapTables() {
    var tables = document.querySelectorAll('table');
    for (var i = 0; i < tables.length; i++) {
      var tbl = tables[i];
      if (tbl.parentElement && tbl.parentElement.classList.contains('sw-table-scroll')) continue;
      var wrapper = document.createElement('div');
      wrapper.className = 'sw-table-scroll';
      tbl.parentNode.insertBefore(wrapper, tbl);
      wrapper.appendChild(tbl);
    }
  }

  function neutralizeFullHeightWrappers() {
    try {
      if (document.documentElement) {
        document.documentElement.style.setProperty('min-height', '0px', 'important');
        document.documentElement.style.setProperty('height', 'auto', 'important');
        document.documentElement.style.setProperty('overflow-y', 'visible', 'important');
      }
      if (document.body) {
        document.body.style.setProperty('min-height', '0px', 'important');
        document.body.style.setProperty('height', 'auto', 'important');
        document.body.style.setProperty('overflow-y', 'visible', 'important');
      }
      var elList = document.querySelectorAll('#root, #app, #__next, .app, [class*="min-h-screen"], [class*="h-screen"], [style*="100vh"], [style*="min-height"]');
      for (var i = 0; i < elList.length; i++) {
        var el = elList[i];
        el.style.setProperty('min-height', '0px', 'important');
        el.style.setProperty('height', 'auto', 'important');
      }
    } catch (_) {}
  }

  function getContentHeight() {
    neutralizeFullHeightWrappers();

    var body = document.body;
    if (!body) return 0;

    // 1. Unwrap single-wrapper hierarchy (e.g. body -> #root -> .app)
    var root = document.getElementById('sw-post-root');
    var container = root || body;
    var depth = 0;
    while (container && container.children && depth < 5) {
      depth++;
      var meaningfulKids = [];
      for (var k = 0; k < container.children.length; k++) {
        var kid = container.children[k];
        var ktag = kid.tagName ? kid.tagName.toLowerCase() : '';
        if (ktag !== 'script' && ktag !== 'style' && ktag !== 'link') {
          meaningfulKids.push(kid);
        }
      }
      if (meaningfulKids.length === 1 && (meaningfulKids[0].tagName.toLowerCase() === 'div' || meaningfulKids[0].tagName.toLowerCase() === 'main' || meaningfulKids[0].tagName.toLowerCase() === 'section')) {
        container = meaningfulKids[0];
      } else {
        break;
      }
    }

    // 2. Measure max bottom of all direct children of the unwrapped container
    var maxBottom = 0;
    var scrollY = window.pageYOffset || (document.documentElement ? document.documentElement.scrollTop : 0) || 0;
    var children = container.children;
    for (var i = 0; i < children.length; i++) {
      var el = children[i];
      var tag = el.tagName ? el.tagName.toLowerCase() : '';
      if (tag === 'script' || tag === 'style' || tag === 'link') continue;
      var rect = el.getBoundingClientRect();
      var b = rect.bottom + scrollY;
      if (b > maxBottom) maxBottom = b;
    }

    // 3. Also scan significant content elements to guarantee nothing is cut off
    var contentBlocks = body.querySelectorAll('form, table, footer, button, [role="main"], .emrs-card, .kvs-card, .card, main, .kvs-container, .emrs-container');
    for (var m = 0; m < contentBlocks.length; m++) {
      var cRect = contentBlocks[m].getBoundingClientRect();
      var cBottom = cRect.bottom + scrollY;
      if (cBottom > maxBottom) maxBottom = cBottom;
    }

    if (maxBottom <= 0) {
      maxBottom = container.offsetHeight || body.offsetHeight || 140;
    }

    // Fixed safe padding once at the bottom
    return Math.ceil(maxBottom + 16);
  }

  function postHeight() {
    var h = getContentHeight();
    if (h <= 0) return;
    if (Math.abs(h - lastSentHeight) > 4) {
      lastSentHeight = h;
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ type: 'swadhyay-post-height', frameId: FRAME_ID, height: h }, '*');
      }
    }
  }

  function init() {
    wrapTables();
    neutralizeFullHeightWrappers();
    postHeight();

    if (typeof ResizeObserver !== 'undefined') {
      var ro = new ResizeObserver(function() {
        postHeight();
      });
      var root = document.getElementById('sw-post-root');
      if (root) {
        ro.observe(root);
      } else if (document.body) {
        var observedTarget = document.getElementById('root') || document.body.firstElementChild || document.body;
        ro.observe(observedTarget);
      }
    }

    if (typeof MutationObserver !== 'undefined' && document.body) {
      var mo = new MutationObserver(function() {
        wrapTables();
        neutralizeFullHeightWrappers();
        postHeight();
      });
      mo.observe(document.body, { childList: true, subtree: true });
    }

    setTimeout(postHeight, 150);
    setTimeout(postHeight, 500);
    setTimeout(postHeight, 1200);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.addEventListener('load', function() {
    wrapTables();
    neutralizeFullHeightWrappers();
    postHeight();
  });

  window.addEventListener('resize', function() {
    var currentWidth = window.innerWidth;
    if (Math.abs(currentWidth - lastSentWidth) > 6) {
      lastSentWidth = currentWidth;
      postHeight();
    }
  });
})();
</script>`
}

const ANTI_EXPAND_GUARD_STYLE = `<style id="sw-anti-expand-guard">
  html, body {
    height: auto !important;
    min-height: 0 !important;
    max-height: none !important;
    overflow-x: hidden !important;
    overflow-y: visible !important;
  }
  #root, #app, #__next, .app, [class*="min-h-screen"], [class*="h-screen"], [style*="100vh"], [style*="min-height: 100vh"], [style*="min-height:100vh"] {
    min-height: 0 !important;
    height: auto !important;
  }
</style>`

const SAFE_STORAGE_SHIM_SCRIPT = `<script>
(function() {
  function makeMemStorage() {
    var store = Object.create(null);
    return {
      getItem: function(k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
      setItem: function(k, v) { store[String(k)] = String(v); },
      removeItem: function(k) { delete store[String(k)]; },
      clear: function() { store = Object.create(null); },
      key: function(i) { var keys = Object.keys(store); return keys[i] || null; },
      get length() { return Object.keys(store).length; }
    };
  }
  ['localStorage', 'sessionStorage'].forEach(function(prop) {
    try {
      var s = window[prop];
      s.setItem('__sw_test__', '1');
      s.removeItem('__sw_test__');
    } catch (e) {
      try {
        Object.defineProperty(window, prop, {
          configurable: true,
          value: makeMemStorage()
        });
      } catch (_) {}
    }
  });
})();
</script>`

function buildSandboxedSrcDoc({ html, customCss, frameId }) {
  const { html: processedHtml, hasMath } = renderMathSafelyOutsideCode(html)
  const katexLink = hasMath
    ? '<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css" crossorigin="anonymous" />'
    : ''
  const autoResizeScript = buildAutoResizeScript(frameId)
  const safeCustomCss = String(customCss || '').trim()
  const baseStyleTag = `<style id="sw-base-post-css">${BASE_POST_CSS}</style>`
  const customStyleTag = safeCustomCss
    ? `<style id="sw-custom-post-css">${safeCustomCss}</style>`
    : ''

  // If the admin pasted a complete HTML document (<!DOCTYPE html> / <html> / <body>),
  // preserve its structure while injecting storage shim, base styles, custom CSS, and auto-resize script.
  if (/<html[\s>]/i.test(processedHtml) || /<body[\s>]/i.test(processedHtml)) {
    let doc = processedHtml
    const headInject = `${SAFE_STORAGE_SHIM_SCRIPT}\n<base target="_blank" />\n${katexLink}\n${baseStyleTag}`
    if (/<head[\s>]/i.test(doc)) {
      doc = doc.replace(/<head([^>]*)>/i, `<head$1>\n${headInject}`)
    } else if (/<html[\s>]/i.test(doc)) {
      doc = doc.replace(/<html([^>]*)>/i, `<html$1>\n<head>${headInject}</head>`)
    }
    if (customStyleTag) {
      if (/<\/head>/i.test(doc)) {
        doc = doc.replace(/<\/head>/i, `${customStyleTag}\n${ANTI_EXPAND_GUARD_STYLE}\n</head>`)
      } else if (/<body[^>]*>/i.test(doc)) {
        doc = doc.replace(/<body([^>]*)>/i, `<head>${customStyleTag}\n${ANTI_EXPAND_GUARD_STYLE}</head>\n<body$1>`)
      } else {
        doc = `${customStyleTag}\n${ANTI_EXPAND_GUARD_STYLE}\n${doc}`
      }
    } else {
      if (/<\/head>/i.test(doc)) {
        doc = doc.replace(/<\/head>/i, `${ANTI_EXPAND_GUARD_STYLE}\n</head>`)
      } else if (/<body[^>]*>/i.test(doc)) {
        doc = doc.replace(/<body([^>]*)>/i, `<head>${ANTI_EXPAND_GUARD_STYLE}</head>\n<body$1>`)
      } else {
        doc = `${ANTI_EXPAND_GUARD_STYLE}\n${doc}`
      }
    }
    if (/<\/body>/i.test(doc)) {
      doc = doc.replace(/<\/body>/i, `${autoResizeScript}\n</body>`)
    } else {
      doc = `${doc}\n${autoResizeScript}`
    }
    return doc
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  ${SAFE_STORAGE_SHIM_SCRIPT}
  <base target="_blank" />
  ${katexLink}
  ${baseStyleTag}
  ${customStyleTag}
  ${ANTI_EXPAND_GUARD_STYLE}
</head>
<body>
  <div id="sw-post-root" class="sw-post-root">${processedHtml}</div>
  ${autoResizeScript}
</body>
</html>`
}

export default function UniversalPostRenderer({
  html = '',
  customCss = '',
  interactiveTool = false,
  title = 'Post content',
  minHeight = 140,
  className = '',
}) {
  const reactId = useId()
  const frameId = `sw-frame-${reactId.replace(/[^a-zA-Z0-9_-]/g, '')}`
  const iframeRef = useRef(null)
  const [height, setHeight] = useState(minHeight)

  const useIframe = useMemo(
    () => postNeedsUniversalFrame(html, customCss, interactiveTool),
    [html, customCss, interactiveTool],
  )

  const simpleHtml = useMemo(
    () => (useIframe ? '' : renderMathInHtml(html || '')),
    [useIframe, html],
  )

  const srcDoc = useMemo(
    () => (useIframe ? buildSandboxedSrcDoc({ html, customCss, frameId }) : ''),
    [useIframe, html, customCss, frameId],
  )

  useEffect(() => {
    if (!useIframe) return undefined
    let lastTime = 0
    let rapidCount = 0

    function handleMessage(event) {
      const data = event?.data
      if (!data || data.type !== 'swadhyay-post-height' || data.frameId !== frameId) return
      const nextHeight = Number(data.height)
      if (!Number.isFinite(nextHeight) || nextHeight <= 0) return

      const now = Date.now()
      if (now - lastTime < 350) {
        rapidCount++
        if (rapidCount > 6) {
          // Circuit breaker: Freeze height to permanently prevent runaway loops across any post
          return
        }
      } else {
        rapidCount = 0
      }
      lastTime = now

      setHeight((prev) => {
        const target = Math.max(minHeight, Math.ceil(nextHeight))
        if (Math.abs(prev - target) <= 4) return prev
        return target
      })
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [useIframe, frameId, minHeight])

  if (!useIframe) {
    return (
      <div
        className={`article-prose ${className}`.trim()}
        dangerouslySetInnerHTML={{ __html: simpleHtml }}
      />
    )
  }

  return (
    <div className={`universal-post-frame-wrap ${className}`.trim()}>
      <iframe
        ref={iframeRef}
        title={title}
        srcDoc={srcDoc}
        sandbox="allow-scripts allow-forms allow-popups allow-modals"
        scrolling="no"
        style={{
          width: '100%',
          height: `${height}px`,
          border: 'none',
          display: 'block',
          background: 'transparent',
          overflow: 'hidden',
        }}
      />
    </div>
  )
}
